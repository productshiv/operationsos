import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgentChat, type ToolActivity } from '../state/useAgentChat';
import { addCatalogConnector, listCatalog, type CatalogConnector } from '../lib/connectors';
import { AGENTS, buildAgentSpec, type AgentConfig } from '../lib/agents';
import { consultAgent } from '../lib/consult';
import { setAttention } from '../state/tasks';
import { listAgentSessions, sessionPreview, type PastSession } from '../lib/sessionHistory';

/** The reply flags something worth a ticket — so "Open a ticket" is offered contextually, not after
 *  every message. Matches escalation language, warnings, and problems an agent would want tracked. */
const TICKETABLE =
  /⚠|\b(ticket|jira|escalat|advisor|incident|outage|breach|vulnerab|security|exposed|at[-\s]?risk|churn|remediat|recommend|should (?:we|i|you)|flag(?:ged)?|disabled|misconfigur|failing|error spike|needs? (?:fixing|attention|action)|follow[-\s]?up)\b/i;

/** Strip minimax's internal reasoning tags (`<mm:think>…</mm:think>`) — including an unclosed one
 *  mid-stream — so they never leak into the visible reply. */
function stripThink(text: string): string {
  return text
    .replace(/<mm:think>[\s\S]*?<\/mm:think>/g, '')
    .replace(/<mm:think>[\s\S]*$/g, '')
    .replace(/<\/mm:think>/g, '')
    .trimStart();
}

/** Assistant replies are markdown; render them (links open safely in a new tab). */
function Markdown({ text }: { text: string }) {
  return (
    <div className="mtext md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}
      >
        {stripThink(text)}
      </ReactMarkdown>
    </div>
  );
}

/** One tool call in the thread — collapsed to a one-line header by default, expandable for detail. */
function ToolCard({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!(tool.query || tool.result);
  return (
    <div className={`toolcard${open ? ' open' : ''}`}>
      <button
        className="toolhd"
        onClick={() => hasDetail && setOpen((o) => !o)}
        disabled={!hasDetail}
        aria-expanded={open}
      >
        {hasDetail && <span className="toolchev" aria-hidden="true">{open ? '▾' : '▸'}</span>}
        <span className="tag8">{tool.server ? `${tool.server} · ${tool.tool}` : tool.tool}</span>
        <span className={tool.result ? 'tok ok' : 'tok'}>{tool.result ? 'done' : 'running…'}</span>
      </button>
      {open && (
        <div className="toolbody">
          {tool.query && <pre className="sql">{tool.query}</pre>}
          {tool.result && <div className="toolres">{tool.result.slice(0, 400)}</div>}
        </div>
      )}
    </div>
  );
}

/**
 * A live conversation with an agent: streams the turn, shows the tools it runs (with the SQL),
 * and — when a tool needs sign-off — a gold approval gate right in the thread. The agent doesn't
 * touch the database until you authorise.
 */
export function AgentChat({
  agent,
  jira,
  agentModel,
}: {
  agent: AgentConfig;
  jira: string | null | undefined;
  agentModel: string;
}) {
  // Jira (the live connector name, or null) and the chosen default model are resolved by the app and
  // injected into the spec at runtime — so a missing/renamed Jira never breaks normal answers, the
  // atlassian/jira naming difference is handled, and agents run on whichever model the CEO picked.
  const spec = useMemo(() => buildAgentSpec(agent, jira ?? null, agentModel), [agent, jira, agentModel]);
  const {
    items, busy, pending, needsConnector, turnError, hydrating, hydrationError, retryHydration, newChat,
    sessionServers, sessionId, openSession, send, decide, retry, clearNeedsConnector, clearTurnError,
  } = useAgentChat(spec, agent.id);
  const locked = hydrating || hydrationError; // composer disabled while restoring or after a restore error
  // Offer the ticket action only when the connector THIS session was created with includes Jira — so
  // it never targets a session that can't invoke it (e.g. Jira was added after the session started).
  // Before the first turn, fall back to the currently-resolved connector.
  const canTicket = jira != null && (sessionServers ? sessionServers.includes(jira) : true);
  // Offer "Open a ticket" only when the latest reply actually flags something escalation-worthy.
  const lastItem = items[items.length - 1];
  const suggestsTicket = lastItem?.role === 'assistant' && TICKETABLE.test(lastItem.text);
  const [draft, setDraft] = useState('');
  const [fixing, setFixing] = useState(false);
  const [fixErr, setFixErr] = useState<string | null>(null);
  // The catalog entry for the missing connector (prefetched), so we know whether a one-click add is
  // possible (no-auth) or it needs credentials/OAuth that only the Integrations panel collects.
  const [entry, setEntry] = useState<CatalogConnector | null>(null);
  // Agent-to-agent: who we're currently asking, and anything that came back needing the CEO.
  const [asking, setAsking] = useState<string | null>(null);
  const [consultNote, setConsultNote] = useState<string | null>(null);
  // Past conversations for this agent, loaded when the picker is opened.
  const [pastOpen, setPastOpen] = useState(false);
  const [past, setPast] = useState<Array<PastSession & { label?: string }> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const l = logRef.current;
    if (l) l.scrollTop = l.scrollHeight;
  }, [items, pending, busy, needsConnector, turnError]);

  useEffect(() => {
    setFixErr(null);
    if (!needsConnector) {
      setEntry(null);
      return;
    }
    let cancelled = false;
    void listCatalog().then((cat) => {
      if (!cancelled) setEntry(cat.find((c) => c.name === needsConnector) ?? null);
    });
    return () => { cancelled = true; };
  }, [needsConnector]);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || busy || pending || locked) return;
    setDraft('');
    void send(t);
  };

  // Only no-auth connectors can be added in one click; header/OAuth ones need credentials the
  // Integrations panel collects properly, so those route there and the CEO retries afterwards.
  const addAndContinue = async () => {
    if (!entry || entry.authType !== 'none') return;
    setFixing(true);
    setFixErr(null);
    try {
      await addCatalogConnector(entry);
      await retry();
    } catch {
      setFixErr('Couldn’t add it — try again, or add it in Integrations.');
    } finally {
      setFixing(false);
    }
  };

  // Load the history list only when the picker is opened — it costs a request per conversation.
  useEffect(() => {
    if (!pastOpen) return;
    let cancelled = false;
    setPast(null);
    void (async () => {
      const instructions = typeof spec.instructions === 'string' ? spec.instructions : '';
      const model = (spec.model as { name?: string } | undefined)?.name ?? '';
      const servers = Array.isArray(spec.mcpServers)
        ? (spec.mcpServers as Array<{ name?: string }>).map((x) => x?.name ?? '').filter(Boolean)
        : [];
      const list = (await listAgentSessions(instructions, model, servers)).slice(0, 8);
      if (cancelled) return;
      setPast(list);
      // Then fill in what each one was about, so the list reads as conversations not timestamps.
      const labels = await Promise.all(list.map((p) => sessionPreview(p.id)));
      if (!cancelled) setPast(list.map((p, i) => ({ ...p, label: labels[i] })));
    })();
    return () => { cancelled = true; };
  }, [pastOpen, spec]);

  /** "15:04" for today, otherwise "30 Aug 15:04". */
  const when = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay ? time : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`;
  };

  /** The other agents on the floor — who this one can pull into the conversation. */
  const colleagues = Object.values(AGENTS).filter((a) => a.id !== agent.id);

  /**
   * Ask a colleague on the CEO's behalf: run a turn on THEIR session (with their tools), then feed
   * the answer back into this conversation so this agent can carry on with it.
   */
  const askColleague = async (id: string, name: string) => {
    const lastUser = [...items].reverse().find((i) => i.role === 'user')?.text;
    if (!lastUser || busy || pending || locked || asking) return;
    setAsking(id);
    setConsultNote(null);
    const res = await consultAgent({
      agentId: id,
      question: `A colleague (${agent.name}) needs this to answer the CEO: ${lastUser}`,
      jira: jira ?? null,
      model: agentModel,
    });
    setAsking(null);
    if (res.kind === 'answer') {
      void send(`I asked the ${name}. They said:\n\n${res.text}\n\nUse that to answer my question.`);
    } else if (res.kind === 'blocked') {
      setAttention(id, 'a pending checkpoint');
      setConsultNote(`${name} already has something waiting on your sign-off — open their desk to clear it, then ask again.`);
    } else if (res.kind === 'needs-input') {
      setConsultNote(`${name} asked a clarifying question before they can answer — open their desk to reply.`);
    } else if (res.kind === 'needs-approval') {
      // They can't answer without a sign-off — put it on the board rather than failing quietly.
      setAttention(id, res.tool);
      setConsultNote(`${name} needs your sign-off to run ${res.tool} — open their desk to authorise it.`);
    } else {
      setConsultNote(`Couldn't reach ${name}: ${res.message}`);
    }
  };

  return (
    <>
      <div className="aghead">
        <div>
          <span className="agname chi">{agent.name}</span> <span className="muted">{agent.role}</span>
        </div>
        <div className="aghead-right">
          {/* Start over — clears the transcript and starts a fresh session (drops a piled-up or
              error-filled conversation). Only offered once there's something to clear. */}
          <div className="pastwrap">
            <button
              className="link-btn"
              onClick={() => setPastOpen((o) => !o)}
              disabled={busy || hydrating}
              aria-expanded={pastOpen}
            >
              Past chats ▾
            </button>
            {pastOpen && (
              <div className="pastmenu">
                {past === null && <div className="pastempty dim">Loading…</div>}
                {past?.length === 0 && <div className="pastempty dim">No past conversations yet.</div>}
                {past?.map((p) => (
                  <button
                    key={p.id}
                    className={`pastitem${p.id === sessionId ? ' current' : ''}`}
                    onClick={() => {
                      setPastOpen(false);
                      if (p.id !== sessionId) openSession(p.id);
                    }}
                  >
                    <span className="pastlabel">{p.label || 'Untitled conversation'}</span>
                    <span className="dim pastwhen">
                      {when(p.updatedAt)}
                      {p.id === sessionId ? ' · current' : p.abandoned ? ' · set aside' : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {(items.length > 0 || turnError || hydrationError) && !busy && (
            <button className="link-btn" onClick={newChat} disabled={hydrating}>New chat</button>
          )}
          <span className="tag8">ONLINE</span>
        </div>
      </div>

      <div className="chatlog" ref={logRef}>
        {hydrating && items.length === 0 && (
          <p className="typing muted" style={{ fontSize: 13 }}>…restoring conversation</p>
        )}
        {hydrationError && (
          <div className="fixcard">
            <p>Couldn’t restore this conversation — the harness may be busy.</p>
            <div className="fixrow">
              <button className="btn go" onClick={retryHydration}>Retry</button>
            </div>
          </div>
        )}
        {!hydrating && !hydrationError && items.length === 0 && !busy && (
          <p className="muted" style={{ fontSize: 13 }}>{agent.blurb}</p>
        )}

        {items.map((it) => (
          <div key={it.key} className={`msg ${it.role === 'user' ? 'me' : 'ag'}`}>
            {it.role === 'assistant' && <div className="who">{agent.name}</div>}
            {it.tools.map((t) => (
              <ToolCard key={t.id} tool={t} />
            ))}
            {it.text && (it.role === 'assistant'
              ? <Markdown text={it.text} />
              : <div className="mtext">{it.text}</div>)}
          </div>
        ))}

        {/* Follow-up actions, only when the latest reply actually succeeded — never next to an error
            or a connector-recovery prompt, so they can't act on a stale, unrelated reply. The ticket
            action is gated on a Jira connector actually being available. */}
        {agent.quickActions?.length &&
        canTicket &&
        suggestsTicket &&
        !busy &&
        !pending &&
        !turnError &&
        !needsConnector &&
        lastItem?.role === 'assistant' ? (
          <div className="quickacts">
            {agent.quickActions.map((a) => (
              <button key={a.label} className="qact" onClick={() => submit(a.prompt)}>
                ⚡ {a.label}
              </button>
            ))}
          </div>
        ) : null}

        {busy && !pending && <div className="typing muted">…thinking</div>}

        {turnError && !busy && !needsConnector && (
          <div className="fixcard">
            <p>{turnError}</p>
            <div className="fixrow">
              <button className="btn go" onClick={() => void retry()}>Try again</button>
              <button className="btn" onClick={clearTurnError}>Dismiss</button>
            </div>
          </div>
        )}

        {needsConnector && !busy && (
          <div className="fixcard">
            <p>
              <b>{agent.name}</b> needs the <code>{needsConnector}</code> tool, which isn’t connected yet.
              {entry && entry.authType !== 'none' && (
                <> It needs {entry.authType === 'header' ? 'an API key' : 'sign-in'} — add it in{' '}
                <b>Integrations</b> (top bar), then Try again.</>
              )}
              {entry === null && <> Add it in <b>Integrations</b> (top bar), then Try again.</>}
            </p>
            <div className="fixrow">
              {entry?.authType === 'none' ? (
                <button className="btn go" onClick={() => void addAndContinue()} disabled={fixing}>
                  {fixing ? 'Adding…' : `＋ Add ${needsConnector} & continue`}
                </button>
              ) : (
                <button className="btn go" onClick={() => void retry()}>Try again</button>
              )}
              <button className="btn" onClick={clearNeedsConnector} disabled={fixing}>Dismiss</button>
            </div>
            {fixErr && <div className="apwarn">{fixErr}</div>}
          </div>
        )}

        {pending && (
          <div className="approval">
            <div className="aphd">
              <span className="apdot" />awaiting your authorisation
            </div>
            <div className="apbody">
              <p>
                <b>{agent.name}</b> wants to run <b>{pending.toolCalls[0]?.tool || 'a tool'}</b>
                {pending.toolCalls[0]?.server ? (
                  <>
                    {' '}on <b>{pending.toolCalls[0].server}</b>
                  </>
                ) : null}
                :
              </p>
              {pending.toolCalls.map((tc) => {
                const body = tc.query || tc.input;
                return body ? <pre key={tc.id} className="sql gold">{body}</pre> : null;
              })}
              {pending.toolCalls.some((tc) => tc.warn) && (
                <div className="apwarn">
                  ⚠ {pending.toolCalls.find((tc) => tc.warn)?.warn} Deny unless you expect this.
                </div>
              )}
            </div>
            <div className="aprow">
              <button className="btn go" onClick={() => void decide('allow')} disabled={busy}>Authorise</button>
              <button className="btn" onClick={() => void decide('deny')} disabled={busy}>Deny</button>
            </div>
            <div className="aphint">Nothing runs against the database until you authorise.</div>
          </div>
        )}
      </div>

      {(asking || consultNote) && (
        <div className="fixcard">
          <p>{asking ? `Asking the ${AGENTS[asking]?.name ?? 'colleague'}…` : consultNote}</p>
          {!asking && (
            <div className="fixrow">
              <button className="btn" onClick={() => setConsultNote(null)}>Dismiss</button>
            </div>
          )}
        </div>
      )}

      {/* Pull another agent into the thread — they answer with their own tools. */}
      {items.some((i) => i.role === 'user') && !busy && !pending && !locked && (
        <div className="chips consultrow">
          <span className="consultlabel">Ask a colleague:</span>
          {colleagues.map((c) => (
            <button key={c.id} className="qchip" disabled={!!asking} onClick={() => void askColleague(c.id, c.name)}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="chips">
        {agent.suggestions.map((s) => (
          <button key={s} className="qchip" onClick={() => submit(s)} disabled={busy || !!pending || locked}>{s}</button>
        ))}
      </div>

      <div className="composer">
        <input
          className="cin"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(draft); }}
          placeholder={
            hydrationError ? 'Couldn’t restore — Retry above' : hydrating ? 'Restoring conversation…' : `Ask ${agent.name}…`
          }
          disabled={busy || !!pending || locked}
        />
        <button className="btn send" onClick={() => submit(draft)} disabled={busy || !!pending || locked}>Send</button>
      </div>
    </>
  );
}
