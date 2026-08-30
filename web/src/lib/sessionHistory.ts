import { trueforgeControl } from './trueforge';

/**
 * Cross-device conversation persistence, backed by the harness itself (no localStorage): a session's
 * full turn history lives server-side in the harness's Postgres, so reusing the session id gives the
 * agent its context back, and replaying the session's events rebuilds the visible transcript.
 *
 * Sessions here are created *inline* (no registry agent id to filter on), so we identify "this
 * agent's session" by its stable `instructions` string — which changes only when the agent's role
 * definition changes, so a spec revision naturally starts a fresh conversation.
 */

/** Extract plain text from a message content that is either a string or an array of content parts. */
function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((p) =>
        p && typeof p === 'object' && 'text' in p ? String((p as { text?: unknown }).text ?? '') : '',
      )
      .join('');
  }
  return '';
}

/** A tool call in the shape {@link readTool} understands (id + function name/arguments). */
export interface RawToolCallLike {
  id: string;
  function: { name: string; arguments: string };
}

/** One reconstructed history entry, in chronological order. */
export type HistoryItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; id: string; text: string; toolCalls: RawToolCallLike[] }
  | { kind: 'toolResult'; toolCallId: string; content: string };

export interface FoundSession {
  id: string;
  /** MCP servers the session was created with — so the ticket gate reflects what it can invoke. */
  mcpServers: string[];
}

/** Loose views of the SDK types — we read only the fields we need. */
interface ListedSession {
  id: string;
  agent?: {
    type?: string;
    spec?: { instructions?: string; model?: { name?: string }; mcpServers?: Array<{ name?: string }> };
  };
}
interface HistEvent {
  type: string;
  id?: string;
  threadId?: string | null;
  content?: unknown;
  toolCallId?: string;
  toolCalls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
  input?: Array<{ type?: string; content?: unknown }>;
}

/**
 * Find the most recently-updated session for this agent (matched by its instructions), scanning a
 * bounded number of recent sessions. Returns its id and the servers it was created with, or null if
 * the agent has no prior session (or the harness can't be reached).
 */
export async function findAgentSession(instructions: string, model: string): Promise<FoundSession | null> {
  try {
    // Only the first page (25 most recent). We reuse+bump a session on every turn, so the active one
    // stays on top; and we deliberately don't auto-paginate — the SDK's session pager re-fetches the
    // first page instead of advancing, which would loop forever.
    const page = await trueforgeControl.sessions.list({ limit: 25, order: 'desc' });
    for (const raw of (page.data ?? []) as ListedSession[]) {
      const spec = raw.agent?.spec;
      // Match on instructions AND model, so switching the default model starts a fresh conversation
      // on the new model rather than resuming one pinned to the old (e.g. credit-exhausted) provider.
      if (spec?.instructions === instructions && spec?.model?.name === model) {
        const mcpServers = Array.isArray(spec.mcpServers)
          ? spec.mcpServers.map((m) => m?.name ?? '').filter(Boolean)
          : [];
        return { id: raw.id, mcpServers };
      }
    }
  } catch {
    /* offline / no access — treat as no prior session */
  }
  return null;
}

/**
 * Replay a session's events into chronological {@link HistoryItem}s for the top-level (`main`)
 * thread. listEvents returns newest-first across pages; we collect (bounded) and reverse.
 */
export async function fetchHistory(sessionId: string, maxEvents = 600, maxPages = 12): Promise<HistoryItem[]> {
  const events: HistEvent[] = [];
  try {
    // Manual token pagination (not the SDK's async iterator) with a hard page cap — deterministic,
    // and it can't loop. listEvents returns newest-first toward the session start.
    let pageToken: string | undefined;
    for (let i = 0; i < maxPages; i++) {
      const page = await trueforgeControl.sessions.listEvents(sessionId, { limit: 100, pageToken });
      for (const item of (page.data ?? []) as Array<{ event: HistEvent }>) events.push(item.event);
      pageToken = (page.response as { pagination?: { nextPageToken?: string } })?.pagination?.nextPageToken;
      if (!pageToken || events.length >= maxEvents) break;
    }
  } catch {
    return [];
  }
  events.reverse(); // → oldest first

  const out: HistoryItem[] = [];
  for (const ev of events) {
    switch (ev.type) {
      case 'turn.created':
        for (const inp of ev.input ?? []) {
          if (inp?.type === 'user.message') out.push({ kind: 'user', text: contentText(inp.content) });
        }
        break;
      case 'model.message':
        if ((ev.threadId ?? 'main') !== 'main' || !ev.id) break;
        out.push({
          kind: 'assistant',
          id: ev.id,
          text: contentText(ev.content),
          toolCalls: (ev.toolCalls ?? [])
            .filter((t) => t && t.id)
            .map((t) => ({ id: t.id as string, function: { name: t.function?.name ?? '', arguments: t.function?.arguments ?? '' } })),
        });
        break;
      case 'tool.response':
        if (ev.toolCallId) out.push({ kind: 'toolResult', toolCallId: ev.toolCallId, content: contentText(ev.content) });
        break;
    }
  }
  return out;
}
