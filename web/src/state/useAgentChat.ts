import { useCallback, useEffect, useRef, useState } from 'react';
import { trueforge } from '../lib/trueforge';
import { WEATHERAPI_PROJECT_REF } from '../lib/agents';
import { abandonSession, fetchHistory, findAgentSession, type RawToolCallLike } from '../lib/sessionHistory';
import { addTask, clearAttention, setAttention } from './tasks';

export interface ToolActivity {
  id: string;
  server: string;
  tool: string;
  query?: string;
  project?: string;
  /** Pretty-printed tool arguments (the payload) — shown at the gate for non-SQL tools. */
  input?: string;
  result?: string;
}
export interface ChatItem {
  key: string;
  role: 'user' | 'assistant';
  text: string;
  tools: ToolActivity[];
}
export interface PendingCall {
  id: string;
  server: string;
  tool: string;
  query: string;
  /** Pretty-printed arguments (the payload) — what the tool will actually do. */
  input?: string;
  /** Non-empty when the proposed call breaks the read-only / pinned-project policy. */
  warn?: string;
}
export interface Pending {
  threadId: string;
  toolCalls: PendingCall[];
}

interface RawToolCall {
  id: string;
  function: { name: string; arguments: string };
}
interface MessageBase {
  id: string;
  threadId?: string;
  content: string;
  toolCalls: RawToolCall[];
}
/** Loose view of a stream event — the SDK union is large; we read only these fields. */
interface StreamEvent {
  type: string;
  id?: string;
  threadId?: string;
  content?: string | null;
  /** Delta tool-call fragments (model.message) or ToolCallRefs (tool.approval_required). */
  toolCalls?: Array<{
    id?: string;
    index?: number;
    sourceEventId?: string;
    function?: { name?: string; arguments?: string };
  }>;
  toolCallId?: string;
  /** On `turn.done`: the final state. `status: 'error'` carries a human-readable `message`. */
  state?: { status?: string; message?: string };
}

/**
 * The harness wraps MCP calls as `call_tool({ mcp_server, tool_name, input })` when tools are
 * deferred; with `preload` the tool (e.g. execute_sql) is called directly. Either way we surface
 * the inner tool, the SQL, and the project id. Arguments stream in fragments, so a mid-stream
 * JSON.parse can fail — that's fine, it resolves once complete.
 */
function readTool(tc: RawToolCall): ToolActivity {
  let server = '';
  let tool = tc.function.name || 'tool';
  let query: string | undefined;
  let project: string | undefined;
  let input: string | undefined;
  try {
    const a = JSON.parse(tc.function.arguments || '{}');
    if (tc.function.name === 'call_tool') {
      server = a.mcp_server ?? '';
      tool = a.tool_name ?? 'call_tool';
      query = a.input?.query;
      project = a.input?.project_id;
      input = a.input ? JSON.stringify(a.input, null, 2) : undefined;
    } else if (tc.function.name === 'list_tools') {
      server = a.mcp_server ?? '';
      tool = 'list tools';
    } else {
      query = typeof a.query === 'string' ? a.query : undefined;
      project = typeof a.project_id === 'string' ? a.project_id : undefined;
      input = Object.keys(a).length ? JSON.stringify(a, null, 2) : undefined;
    }
  } catch {
    /* partial args mid-stream */
  }
  return { id: tc.id, server, tool, query, project, input };
}

/** Client-side policy check surfaced at the approval gate (defence-in-depth; the human decides). */
function policyWarning(t: ToolActivity): string | undefined {
  if (t.query && !/^\s*(with|select)\b/i.test(t.query)) return 'This is not a read-only SELECT.';
  if (t.project && t.project !== WEATHERAPI_PROJECT_REF) return 'Targets a different project.';
  return undefined;
}

/**
 * When a turn fails because the agent's spec names an MCP server the harness doesn't have, pull out
 * that connector name so the UI can offer to add it and continue — instead of a dead error.
 */
function detectMissingConnector(message: string): string | null {
  // The name arrives quoted (often escaped, e.g. \"exa\"), so skip any non-alphanumerics after
  // "server" before capturing it.
  const m = message.match(/unknown mcp server[^a-z0-9]*([a-z0-9_-]+)/i);
  return m ? m[1] : null;
}

/** Turn a raw error into something readable — a bare "Failed to fetch" isn't helpful. */
function friendlyError(message: string): string {
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return 'Couldn’t reach the harness — it may be offline or restarting. Try again in a moment.';
  }
  return message;
}

/** A tool call is a Jira issue creation — used to route a follow-up task when it's authorised. */
function isTicketCreate(tool: string, server: string): boolean {
  return /create/i.test(tool) && /(issue|jira|atlassian)/i.test(`${tool} ${server}`);
}
/** Pull a human title out of a create-issue tool's arguments (summary field), if present. */
function ticketTitle(input?: string): string {
  if (!input) return 'New ticket';
  try {
    const a = JSON.parse(input) as Record<string, unknown>;
    const fields = (a.fields ?? a) as Record<string, unknown>;
    const summary = (fields.summary ?? a.summary ?? a.title) as string | undefined;
    return summary?.trim() || 'New ticket';
  } catch {
    return 'New ticket';
  }
}

export function useAgentChat(spec: Record<string, unknown>, agentId: string) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  // Set when a turn failed because a connector the agent needs isn't configured on the harness.
  const [needsConnector, setNeedsConnector] = useState<string | null>(null);
  // Set when a turn failed for another reason (e.g. a network error) — shown with a Try-again.
  const [turnError, setTurnError] = useState<string | null>(null);
  // True while we look up and replay this agent's prior session on open, so the composer waits and a
  // send can't race in and spin up a second (empty) session before the existing one is restored.
  const [hydrating, setHydrating] = useState(true);
  // Set when restoring the prior conversation FAILED (lookup or history load errored). We then keep
  // the composer disabled and offer a Retry, rather than silently starting a second conversation
  // (forking) or attaching a session whose history we couldn't actually load (hidden divergence).
  const [hydrationError, setHydrationError] = useState(false);
  // Bumped by retryHydration() to re-run the restore effect.
  const [hydrateNonce, setHydrateNonce] = useState(0);

  const sessionRef = useRef<string | null>(null);
  // The MCP server names the live session was actually created with — frozen at creation, since the
  // server-side session can't be re-specced afterwards. Lets the UI gate Jira-dependent actions on
  // what THIS session can invoke, not on a connector that resolved after the session already existed.
  const [sessionServers, setSessionServers] = useState<string[] | null>(null);
  const basesRef = useRef<Map<string, MessageBase>>(new Map());
  const orderRef = useRef<string[]>([]);
  const userTextRef = useRef<Map<string, string>>(new Map());
  const toolResultRef = useRef<Map<string, string>>(new Map());
  const counterRef = useRef(0);
  const lastUserRef = useRef<string>('');
  // orderRef length at the start of the current turn's assistant output — so a failed turn's
  // partial text and half-run tool cards can be dropped instead of lingering next to a retry.
  const turnStartRef = useRef(0);

  const rebuild = useCallback(() => {
    const out: ChatItem[] = [];
    for (const key of orderRef.current) {
      if (key.startsWith('user:')) {
        out.push({ key, role: 'user', text: userTextRef.current.get(key) ?? '', tools: [] });
        continue;
      }
      const base = basesRef.current.get(key);
      if (!base) continue;
      if (base.threadId && base.threadId !== 'main') continue;
      const tools = base.toolCalls
        .filter(Boolean)
        .map(readTool)
        .map((t) => ({ ...t, result: toolResultRef.current.get(t.id) }));
      if (!base.content && tools.length === 0) continue;
      out.push({ key, role: 'assistant', text: base.content, tools });
    }
    setItems(out);
  }, []);

  function ensureBase(id: string, threadId?: string): MessageBase {
    let base = basesRef.current.get(id);
    if (!base) {
      base = { id, threadId, content: '', toolCalls: [] };
      basesRef.current.set(id, base);
      orderRef.current.push(id);
    }
    return base;
  }

  function mergeDelta(base: MessageBase, ev: StreamEvent) {
    if (typeof ev.content === 'string') base.content += ev.content;
    ev.toolCalls?.forEach((d, i) => {
      const idx = typeof d.index === 'number' ? d.index : i;
      const cur = base.toolCalls[idx] ?? { id: '', function: { name: '', arguments: '' } };
      if (d.id) cur.id = d.id;
      if (d.function?.name) cur.function.name = d.function.name;
      if (d.function?.arguments) cur.function.arguments += d.function.arguments;
      base.toolCalls[idx] = cur;
    });
  }

  function note(text: string) {
    const id = `note:${counterRef.current++}`;
    basesRef.current.set(id, { id, content: text, toolCalls: [] });
    orderRef.current.push(id);
    rebuild();
  }

  /** Drop the assistant output produced by the current (failed) turn, keeping the user's message. */
  function truncateTurn() {
    const removed = orderRef.current.splice(turnStartRef.current);
    for (const key of removed) basesRef.current.delete(key);
  }

  function handle(ev: StreamEvent) {
    switch (ev.type) {
      case 'model.message':
        if (ev.id) ensureBase(ev.id, ev.threadId ?? undefined);
        break;
      case 'model.message.delta':
        if (ev.id) mergeDelta(ensureBase(ev.id, ev.threadId ?? undefined), ev);
        break;
      case 'tool.response':
        if (ev.toolCallId) toolResultRef.current.set(ev.toolCallId, ev.content ?? '');
        break;
      case 'tool.approval_required': {
        const threadId = ev.threadId ?? 'main';
        const toolCalls: PendingCall[] = (ev.toolCalls ?? []).map((ref) => {
          // ToolCallRef: resolve through the model.message that requested the call.
          const base = ref.sourceEventId ? basesRef.current.get(ref.sourceEventId) : undefined;
          let raw = base?.toolCalls.find((t) => t && t.id === ref.id);
          if (!raw) {
            for (const b of basesRef.current.values()) {
              raw = b.toolCalls.find((t) => t && t.id === ref.id);
              if (raw) break;
            }
          }
          const info = raw ? readTool(raw) : undefined;
          return {
            id: ref.id ?? info?.id ?? '',
            server: info?.server ?? '',
            tool: info?.tool ?? 'tool',
            query: info?.query ?? '',
            input: info?.input,
            warn: info ? policyWarning(info) : undefined,
          };
        });
        setPending({ threadId, toolCalls });
        break;
      }
      case 'turn.done':
        setBusy(false);
        // A turn can fail after streaming nothing (e.g. a model 402, or a connector that isn't
        // configured). Turn a missing-connector failure into a fix-it CTA; surface anything else.
        if (ev.state?.status === 'error') {
          const msg = ev.state.message ?? 'The turn failed.';
          truncateTurn(); // drop partial text / still-"running" tools from the failed attempt
          const missing = detectMissingConnector(msg);
          if (missing) setNeedsConnector(missing);
          else setTurnError(friendlyError(msg));
        }
        break;
    }
    rebuild();
  }

  async function consume(stream: { withMetadata(): AsyncIterable<{ data: unknown }> }) {
    for await (const { data } of stream.withMetadata()) handle(data as StreamEvent);
  }

  // Run one turn for `text` — used by both a fresh send and a retry after a fix. Doesn't add a user
  // bubble (the caller decides), so a retry re-runs the same message without duplicating it.
  const runTurn = useCallback(
    async (t: string) => {
      setBusy(true);
      setNeedsConnector(null);
      setTurnError(null);
      turnStartRef.current = orderRef.current.length; // assistant output for this turn starts here
      try {
        if (!sessionRef.current) {
          const created = await trueforge.sessions.create({ agent: { spec } } as never);
          sessionRef.current = (created as { data: { id: string } }).data.id;
          // Freeze the servers this session can use — the action gate reads these, not a later-resolved spec.
          const servers = Array.isArray(spec.mcpServers) ? (spec.mcpServers as Array<{ name?: string }>) : [];
          setSessionServers(servers.map((s) => s?.name ?? '').filter(Boolean));
        }
        const stream = await trueforge.sessions.createTurnStream(sessionRef.current, {
          input: [{ type: 'user.message', content: t }],
        });
        await consume(stream as never);
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        truncateTurn(); // drop any partial output from the failed attempt
        rebuild();
        const missing = detectMissingConnector(msg);
        if (missing) setNeedsConnector(missing);
        else setTurnError(friendlyError(msg));
      } finally {
        setBusy(false);
      }
    },
    [spec, rebuild],
  );

  // On open, restore this agent's conversation from the harness (cross-device, no localStorage):
  // find its prior session by the stable instructions, reuse the id so the agent keeps its context,
  // and replay the session's events into the transcript. Keyed on `instructions` (stable — Jira
  // injection doesn't change it) so it doesn't re-run and duplicate when the resolved spec updates;
  // a fresh run each StrictMode/remount cancels the previous one before it mutates anything.
  const instructions = typeof spec.instructions === 'string' ? spec.instructions : '';
  const modelName = (spec.model as { name?: string } | undefined)?.name ?? '';
  // Connector set is part of the conversation identity (so a Jira-now-available agent gets a fresh,
  // capable session rather than reusing a Jira-free one). Stable string key for the effect deps.
  const serverKey = Array.isArray(spec.mcpServers)
    ? (spec.mcpServers as Array<{ name?: string }>).map((s) => s?.name ?? '').filter(Boolean).sort().join(',')
    : '';
  useEffect(() => {
    let cancelled = false;
    // instructions+model+connectors identify a conversation; if any changes, this is a different
    // conversation, so clear the current transcript before restoring.
    orderRef.current = [];
    basesRef.current.clear();
    userTextRef.current.clear();
    toolResultRef.current.clear();
    sessionRef.current = null;
    setItems([]);
    setPending(null);
    setSessionServers(null);
    setHydrationError(false);
    setHydrating(true);
    void (async () => {
      if (!instructions || !modelName) {
        if (!cancelled) setHydrating(false);
        return;
      }
      const serverNames = serverKey ? serverKey.split(',') : [];
      const look = await findAgentSession(instructions, modelName, serverNames);
      if (cancelled) return;
      if (look.status === 'error') {
        // Lookup failed — don't start a new session (that would fork an existing conversation).
        setHydrationError(true);
        setHydrating(false);
        return;
      }
      if (look.status === 'none') {
        setHydrating(false); // no prior conversation — a fresh one starts on first send
        return;
      }
      const load = await fetchHistory(look.session.id);
      if (cancelled) return;
      if (load.status === 'error') {
        // History load failed — don't attach the session (its context would be hidden but live),
        // which would make the visible transcript diverge from what the model actually remembers.
        setHydrationError(true);
        setHydrating(false);
        return;
      }
      sessionRef.current = look.session.id;
      setSessionServers(look.session.mcpServers);
      for (const h of load.history.items) {
        if (h.kind === 'user') {
          const key = `user:${counterRef.current++}`;
          userTextRef.current.set(key, h.text);
          orderRef.current.push(key);
        } else if (h.kind === 'assistant') {
          basesRef.current.set(h.id, { id: h.id, threadId: 'main', content: h.text, toolCalls: h.toolCalls });
          orderRef.current.push(h.id);
        } else {
          toolResultRef.current.set(h.toolCallId, h.content);
        }
      }
      rebuild();
      // Restore an approval left unresolved when the session was closed mid-gate, so the CEO can still
      // authorise/deny it instead of being stranded with a paused (un-sendable) session.
      if (load.history.pending) {
        const toolCalls: PendingCall[] = load.history.pending.toolCalls.map((raw: RawToolCallLike) => {
          const info = readTool(raw);
          return { id: info.id, server: info.server, tool: info.tool, query: info.query ?? '', input: info.input, warn: policyWarning(info) };
        });
        setPending({ threadId: load.history.pending.threadId, toolCalls });
      }
      setHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [instructions, modelName, serverKey, rebuild, hydrateNonce]);

  // Publish to the floor's board whether this agent is waiting on the CEO (a paused approval gate),
  // so the "YOU" badge reflects it — set while a gate is open (live or restored), cleared when the
  // CEO resolves it. Not cleared on unmount, so closing a paused desk still flags that it needs you.
  useEffect(() => {
    if (pending) setAttention(agentId, pending.toolCalls[0]?.tool ?? 'a tool');
    else clearAttention(agentId);
  }, [pending, agentId]);

  /** Re-run the restore after a transient lookup/history failure. */
  const retryHydration = useCallback(() => setHydrateNonce((n) => n + 1), []);

  /**
   * Start a fresh conversation: clear the transcript and drop the session id, so the next message
   * opens a NEW server session and the current (e.g. error-filled) one is left behind. Note the
   * abandoned session still exists server-side; once the new session gets its first turn it becomes
   * the most-recently-updated one and is what future reopens restore.
   */
  const newChat = useCallback(() => {
    // Persist the abandonment so a remount/reload can't auto-restore this (e.g. error-filled) session
    // before the replacement gets its first turn.
    if (sessionRef.current) abandonSession(sessionRef.current);
    orderRef.current = [];
    basesRef.current.clear();
    userTextRef.current.clear();
    toolResultRef.current.clear();
    sessionRef.current = null;
    counterRef.current = 0;
    lastUserRef.current = '';
    setItems([]);
    setPending(null);
    setNeedsConnector(null);
    setTurnError(null);
    setSessionServers(null);
    setHydrationError(false);
    setHydrating(false);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      // Don't start a turn while restoring, paused at a gate, or after a restore failure (a send then
      // would fork the conversation instead of continuing the existing one).
      if (busy || pending || hydrating || hydrationError || !t) return;
      const key = `user:${counterRef.current++}`;
      userTextRef.current.set(key, t);
      orderRef.current.push(key);
      lastUserRef.current = t;
      rebuild();
      await runTurn(t);
    },
    [busy, pending, hydrating, hydrationError, runTurn, rebuild],
  );

  /** Re-run the last message — e.g. after adding the connector it needed. */
  const retry = useCallback(async () => {
    if (busy || pending || !lastUserRef.current) return;
    await runTurn(lastUserRef.current);
  }, [busy, pending, runTurn]);

  const clearNeedsConnector = useCallback(() => setNeedsConnector(null), []);
  const clearTurnError = useCallback(() => setTurnError(null), []);

  const decide = useCallback(
    async (status: 'allow' | 'deny') => {
      if (!pending || busy || !sessionRef.current) return;
      const resolving = pending; // keep it until the harness accepts the decision, so a send failure can retry
      setBusy(true);
      let stream: unknown;
      try {
        const input = resolving.toolCalls.map((tc) => ({
          type: 'user.tool_approval',
          threadId: resolving.threadId,
          toolCallId: tc.id,
          approval: status === 'allow' ? { status: 'allow' } : { status: 'deny' },
        }));
        stream = await trueforge.sessions.createTurnStream(sessionRef.current, {
          input: input as never,
        });
      } catch (e) {
        // The decision never reached the harness — the checkpoint is still open, so keep the gate up.
        note(`⚠ ${(e as Error).message} — the checkpoint is still open; try again.`);
        setBusy(false);
        return;
      }
      // The harness accepted the decision — close the gate now so the reply streams in its place,
      // instead of the gold card lingering on screen while the response is still being generated.
      setPending((cur) => (cur === resolving ? null : cur));
      // An authorised ticket becomes a routed task for the Operations Manager to coordinate.
      if (status === 'allow') {
        for (const tc of resolving.toolCalls) {
          if (isTicketCreate(tc.tool, tc.server)) {
            addTask({ title: ticketTitle(tc.input), createdBy: agentId, assignedTo: 'handler' });
          }
        }
      }
      turnStartRef.current = orderRef.current.length;
      try {
        await consume(stream as never);
      } catch {
        // The approval was already accepted, so the tool may have run. Do NOT offer the generic
        // retry here: it replays the original message and could duplicate the write (e.g. a second
        // Jira ticket). Surface a passive note and let the CEO check before acting.
        truncateTurn(); // drop partial output from the interrupted resume
        note('⚠ The response stream dropped after your approval was sent — the action may already have run. Check before repeating it, to avoid a duplicate.');
      } finally {
        setBusy(false);
      }
    },
    [pending, busy, rebuild],
  );

  return {
    items,
    busy,
    pending,
    needsConnector,
    turnError,
    /** True while restoring a prior conversation on open. */
    hydrating,
    /** True when restoring failed (lookup/history error) — composer stays disabled, offer Retry. */
    hydrationError,
    retryHydration,
    /** Start a fresh conversation (clears the transcript and the session). */
    newChat,
    /** MCP server names the live session was created with, or null before the first turn. */
    sessionServers,
    send,
    decide,
    retry,
    clearNeedsConnector,
    clearTurnError,
  };
}
