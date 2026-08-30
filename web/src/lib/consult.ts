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
  | { kind: 'error'; message: string };

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

  try {
    const spec = buildAgentSpec(agent, opts.jira, opts.model);
    const instructions = typeof spec.instructions === 'string' ? spec.instructions : '';
    const servers = Array.isArray(spec.mcpServers)
      ? (spec.mcpServers as Array<{ name?: string }>).map((s) => s?.name ?? '').filter(Boolean)
      : [];

    // Continue their existing thread when there is one; otherwise open a fresh session for them.
    let sessionId: string | null = null;
    const look = await findAgentSession(instructions, opts.model, servers);
    if (look.status === 'found') sessionId = look.session.id;
    if (!sessionId) {
      const created = await trueforge.sessions.create({ agent: { spec } } as never);
      sessionId = (created as { data: { id: string } }).data.id;
    }

    const stream = await trueforge.sessions.createTurnStream(sessionId, {
      input: [{ type: 'user.message', content: opts.question }],
    });

    let text = '';
    let pendingTool: string | null = null;
    let failure: string | null = null;
    const toolNames = new Map<string, string>();

    for await (const { data } of (stream as unknown as { withMetadata(): AsyncIterable<{ data: Ev }> }).withMetadata()) {
      const ev = data;
      if ((ev.threadId ?? 'main') !== 'main') continue;
      if (ev.type === 'model.message' || ev.type === 'model.message.delta') {
        if (typeof ev.content === 'string') text += ev.content;
        for (const tc of ev.toolCalls ?? []) if (tc.id && tc.function?.name) toolNames.set(tc.id, tc.function.name);
      } else if (ev.type === 'tool.approval_required') {
        const ref = (ev.toolCalls ?? [])[0];
        pendingTool = (ref?.id && toolNames.get(ref.id)) || 'a tool';
      } else if (ev.type === 'turn.done' && ev.state?.status === 'error') {
        failure = ev.state.message ?? 'the turn failed';
      }
    }

    if (failure) return { kind: 'error', message: failure };
    // A pause outranks a partial answer: without the sign-off they haven't actually answered.
    if (pendingTool) return { kind: 'needs-approval', tool: pendingTool };
    const answer = stripThink(text);
    return answer
      ? { kind: 'answer', text: answer }
      : { kind: 'error', message: `${agent.name} had nothing to add.` };
  } catch (e) {
    return { kind: 'error', message: (e as Error).message ?? String(e) };
  }
}
