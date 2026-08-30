import { trueforge } from './trueforge';
import { AGENTS, buildAgentSpec } from './agents';
import { findAgentSession } from './sessionHistory';

/**
 * Agent-to-agent consulting.
 *
 * The harness has no way for one agent to call another: `create_sub_agent` children inherit the
 * PARENT's toolset, so a sub-agent spawned by Market Research would still have only `exa` — never the
 * database. So the collaboration is orchestrated here instead: we run a turn on the colleague's *own*
 * session, with their own tools, and hand the answer back to the agent that asked.
 *
 * If the colleague's answer needs a gated tool (the Analyst's SQL, a Jira write), the turn pauses at
 * the approval gate. We don't try to approve on the CEO's behalf — we report it, and the caller
 * surfaces it on the board so they can go and sign it off.
 */

export type ConsultResult =
  | { kind: 'answer'; text: string }
  | { kind: 'needs-approval'; tool: string }
  /** The colleague asked a clarifying question — only the CEO can answer it, at their desk. */
  | { kind: 'needs-input' }
  /** Their session already has a checkpoint waiting on the CEO, so it can't take a question yet. */
  | { kind: 'blocked' }
  | { kind: 'error'; message: string };

/**
 * Colleagues currently mid-consult. A session accepts one turn at a time, so overlapping turns would
 * be rejected or interleave — this keeps consultations one-at-a-time per colleague.
 */
const inFlight = new Set<string>();

interface Ev {
  type: string;
  id?: string;
  threadId?: string;
  content?: string | null;
  toolCalls?: Array<{ id?: string; function?: { name?: string } }>;
  state?: { status?: string; message?: string };
}

const stripThink = (t: string) =>
  t
    .replace(/<mm:think>[\s\S]*?<\/mm:think>/g, '')
    .replace(/<mm:think>[\s\S]*$/g, '')
    // A stray closing tag with no opener also turns up mid-stream — drop it too.
    .replace(/<\/mm:think>/g, '')
    .trim();

/**
 * Ask another agent a question and wait for their reply. Reuses their existing conversation when one
 * exists, so they answer with their own context rather than from a blank slate.
 */
export async function consultAgent(opts: {
  agentId: string;
  question: string;
  jira: string | null;
  model: string;
}): Promise<ConsultResult> {
  const agent = AGENTS[opts.agentId];
  if (!agent) return { kind: 'error', message: `No such colleague: ${opts.agentId}` };

  if (inFlight.has(opts.agentId)) {
    return { kind: 'error', message: `${agent.name} is already answering another question — try again in a moment.` };
  }
  inFlight.add(opts.agentId);

  try {
    const spec = buildAgentSpec(agent, opts.jira, opts.model);
    const instructions = typeof spec.instructions === 'string' ? spec.instructions : '';
    const servers = Array.isArray(spec.mcpServers)
      ? (spec.mcpServers as Array<{ name?: string }>).map((s) => s?.name ?? '').filter(Boolean)
      : [];

    // Continue their existing thread when there is one; otherwise open a fresh session for them.
    // A lookup *failure* is not "no session": creating one then would fork their conversation and
    // lose their context, so we surface it instead.
    const look = await findAgentSession(instructions, opts.model, servers);
    if (look.status === 'error') {
      return { kind: 'error', message: `Couldn't reach ${agent.name}'s conversation — try again.` };
    }
    let sessionId: string;
    if (look.status === 'found') {
      sessionId = look.session.id;
    } else {
      const created = await trueforge.sessions.create({ agent: { spec } } as never);
      sessionId = (created as { data: { id: string } }).data.id;
    }

    const stream = await trueforge.sessions.createTurnStream(sessionId, {
      input: [{ type: 'user.message', content: opts.question }],
    });

    // Accumulate the same way the chat's own consumer does: `model.message` is the message base and
    // `model.message.delta` appends to it. Adding both would duplicate the reply.
    const parts = new Map<string, string>();
    const order: string[] = [];
    let pendingTool: string | null = null;
    let askedQuestion = false;
    let failure: string | null = null;
    const toolNames = new Map<string, string>();

    for await (const { data } of (stream as unknown as { withMetadata(): AsyncIterable<{ data: Ev }> }).withMetadata()) {
      const ev = data;
      if ((ev.threadId ?? 'main') !== 'main') continue;
      for (const tc of ev.toolCalls ?? []) if (tc.id && tc.function?.name) toolNames.set(tc.id, tc.function.name);

      if (ev.type === 'model.message' && ev.id) {
        if (!parts.has(ev.id)) order.push(ev.id);
        parts.set(ev.id, typeof ev.content === 'string' ? ev.content : '');
      } else if (ev.type === 'model.message.delta' && ev.id) {
        if (!parts.has(ev.id)) order.push(ev.id);
        if (typeof ev.content === 'string') parts.set(ev.id, (parts.get(ev.id) ?? '') + ev.content);
      } else if (ev.type === 'tool.approval_required') {
        const ref = (ev.toolCalls ?? [])[0];
        pendingTool = (ref?.id && toolNames.get(ref.id)) || 'a tool';
      } else if (ev.type === 'tool.response_required') {
        // They asked a clarifying question. Their session is now paused on it — only the CEO can
        // answer, at their desk. Reporting it keeps later consultations from hitting a 422.
        askedQuestion = true;
      } else if (ev.type === 'turn.done' && ev.state?.status === 'error') {
        failure = ev.state.message ?? 'the turn failed';
      }
    }

    if (failure) return { kind: 'error', message: failure };
    // A pause outranks a partial answer: without the sign-off or the answer they haven't finished.
    if (pendingTool) return { kind: 'needs-approval', tool: pendingTool };
    if (askedQuestion) return { kind: 'needs-input' };
    const answer = stripThink(order.map((id) => parts.get(id) ?? '').join(''));
    return answer
      ? { kind: 'answer', text: answer }
      : { kind: 'error', message: `${agent.name} had nothing to add.` };
  } catch (e) {
    const message = (e as Error).message ?? String(e);
    // The harness refuses a new message while that session is paused on an approval or a question.
    // That's not a failure to report raw — it means their desk needs the CEO first.
    if (/approvals or questions are pending/i.test(message)) return { kind: 'blocked' };
    return { kind: 'error', message };
  } finally {
    inFlight.delete(opts.agentId);
  }
}
