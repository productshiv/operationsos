import { useCallback, useRef, useState } from 'react';
import { trueforge } from '../lib/trueforge';
import { WEATHERAPI_PROJECT_REF } from '../lib/agents';

export interface ToolActivity {
  id: string;
  server: string;
  tool: string;
  query?: string;
  project?: string;
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
  try {
    const a = JSON.parse(tc.function.arguments || '{}');
    if (tc.function.name === 'call_tool') {
      server = a.mcp_server ?? '';
      tool = a.tool_name ?? 'call_tool';
      query = a.input?.query;
      project = a.input?.project_id;
    } else if (tc.function.name === 'list_tools') {
      server = a.mcp_server ?? '';
      tool = 'list tools';
    } else {
      query = typeof a.query === 'string' ? a.query : undefined;
      project = typeof a.project_id === 'string' ? a.project_id : undefined;
    }
  } catch {
    /* partial args mid-stream */
  }
  return { id: tc.id, server, tool, query, project };
}

/** Client-side policy check surfaced at the approval gate (defence-in-depth; the human decides). */
function policyWarning(t: ToolActivity): string | undefined {
  if (t.query && !/^\s*(with|select)\b/i.test(t.query)) return 'This is not a read-only SELECT.';
  if (t.project && t.project !== WEATHERAPI_PROJECT_REF) return 'Targets a different project.';
  return undefined;
}

export function useAgentChat(spec: Record<string, unknown>) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const sessionRef = useRef<string | null>(null);
  const basesRef = useRef<Map<string, MessageBase>>(new Map());
  const orderRef = useRef<string[]>([]);
  const userTextRef = useRef<Map<string, string>>(new Map());
  const toolResultRef = useRef<Map<string, string>>(new Map());
  const counterRef = useRef(0);

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
            warn: info ? policyWarning(info) : undefined,
          };
        });
        setPending({ threadId, toolCalls });
        break;
      }
      case 'turn.done':
        setBusy(false);
        break;
    }
    rebuild();
  }

  async function consume(stream: { withMetadata(): AsyncIterable<{ data: unknown }> }) {
    for await (const { data } of stream.withMetadata()) handle(data as StreamEvent);
  }

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (busy || pending || !t) return; // don't start a turn while a checkpoint is open
      const key = `user:${counterRef.current++}`;
      userTextRef.current.set(key, t);
      orderRef.current.push(key);
      rebuild();
      setBusy(true);
      try {
        if (!sessionRef.current) {
          const created = await trueforge.sessions.create({ agent: { spec } } as never);
          sessionRef.current = (created as { data: { id: string } }).data.id;
        }
        const stream = await trueforge.sessions.createTurnStream(sessionRef.current, {
          input: [{ type: 'user.message', content: t }],
        });
        await consume(stream as never);
      } catch (e) {
        note(`⚠ ${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [busy, pending, spec, rebuild],
  );

  const decide = useCallback(
    async (status: 'allow' | 'deny') => {
      if (!pending || busy || !sessionRef.current) return;
      const resolving = pending; // keep it until the resume is accepted, so failures can retry
      setBusy(true);
      try {
        const input = resolving.toolCalls.map((tc) => ({
          type: 'user.tool_approval',
          threadId: resolving.threadId,
          toolCallId: tc.id,
          approval: status === 'allow' ? { status: 'allow' } : { status: 'deny' },
        }));
        const stream = await trueforge.sessions.createTurnStream(sessionRef.current, {
          input: input as never,
        });
        await consume(stream as never);
        // Clear only if the resume didn't raise a fresh checkpoint.
        setPending((cur) => (cur === resolving ? null : cur));
      } catch (e) {
        note(`⚠ ${(e as Error).message} — the checkpoint is still open; try again.`);
      } finally {
        setBusy(false);
      }
    },
    [pending, busy, rebuild],
  );

  return { items, busy, pending, send, decide };
}
