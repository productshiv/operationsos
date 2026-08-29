import { useCallback, useRef, useState } from 'react';
import { trueforge } from '../lib/trueforge';

export interface ToolActivity {
  id: string;
  server: string;
  tool: string;
  query?: string;
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
  toolCalls?: Array<{ id?: string; index?: number; function?: { name?: string; arguments?: string } }>;
  toolCallId?: string;
  state?: { status?: string } | null;
}

/**
 * The harness wraps MCP calls as `call_tool({ mcp_server, tool_name, input })`, so the useful
 * label is the inner tool and the SQL sits at `input.query`. Arguments stream in fragments, so a
 * mid-stream JSON.parse can fail — that's fine, it resolves once complete.
 */
function readTool(tc: RawToolCall): ToolActivity {
  let server = '';
  let tool = tc.function.name || 'tool';
  let query: string | undefined;
  try {
    const a = JSON.parse(tc.function.arguments || '{}');
    if (tc.function.name === 'call_tool') {
      // deferred wrapper: call_tool({ mcp_server, tool_name, input })
      server = a.mcp_server ?? '';
      tool = a.tool_name ?? 'call_tool';
      query = a.input?.query ?? (a.input ? JSON.stringify(a.input) : undefined);
    } else if (tc.function.name === 'list_tools') {
      server = a.mcp_server ?? '';
      tool = 'list tools';
    } else {
      // preloaded tool called directly, e.g. execute_sql({ project_id, query })
      query = typeof a.query === 'string' ? a.query : undefined;
    }
  } catch {
    /* partial args mid-stream */
  }
  return { id: tc.id, server, tool, query };
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
        const calls: PendingCall[] = (ev.toolCalls ?? []).map((c) => {
          let found: RawToolCall | undefined;
          for (const b of basesRef.current.values()) {
            found = b.toolCalls.find((t) => t && t.id === c.id);
            if (found) break;
          }
          const info = found ? readTool(found) : undefined;
          return {
            id: c.id ?? info?.id ?? '',
            server: info?.server ?? '',
            tool: info?.tool ?? 'tool',
            query: info?.query ?? '',
          };
        });
        setPending({ threadId, toolCalls: calls });
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
      if (busy || !t) return;
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
    [busy, spec, rebuild],
  );

  const decide = useCallback(
    async (status: 'allow' | 'deny') => {
      if (!pending || !sessionRef.current) return;
      const p = pending;
      setPending(null);
      setBusy(true);
      try {
        const input = p.toolCalls.map((tc) => ({
          type: 'user.tool_approval',
          threadId: p.threadId,
          toolCallId: tc.id,
          approval: status === 'allow' ? { status: 'allow' } : { status: 'deny' },
        }));
        const stream = await trueforge.sessions.createTurnStream(sessionRef.current, {
          input: input as never,
        });
        await consume(stream as never);
      } catch (e) {
        note(`⚠ ${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [pending, rebuild],
  );

  return { items, busy, pending, send, decide };
}
