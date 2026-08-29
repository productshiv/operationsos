import { useEffect, useRef, useState } from 'react';
import { useAgentChat } from '../state/useAgentChat';
import type { AgentConfig } from '../lib/agents';

/**
 * A live conversation with an agent: streams the turn, shows the tools it runs (with the SQL),
 * and — when a tool needs sign-off — a gold approval gate right in the thread. The agent doesn't
 * touch the database until you authorise.
 */
export function AgentChat({ agent }: { agent: AgentConfig }) {
  const { items, busy, pending, send, decide } = useAgentChat(agent.spec);
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const l = logRef.current;
    if (l) l.scrollTop = l.scrollHeight;
  }, [items, pending, busy]);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setDraft('');
    void send(t);
  };

  return (
    <>
      <div className="aghead">
        <div>
          <span className="agname chi">{agent.name}</span> <span className="muted">{agent.role}</span>
        </div>
        <span className="tag8">ONLINE</span>
      </div>

      <div className="chatlog" ref={logRef}>
        {items.length === 0 && !busy && (
          <p className="muted" style={{ fontSize: 13 }}>
            Ask about usage, revenue, churn, or incidents. I discover the schema and query it — and
            pause for your sign-off before any query runs.
          </p>
        )}

        {items.map((it) => (
          <div key={it.key} className={`msg ${it.role === 'user' ? 'me' : 'ag'}`}>
            {it.role === 'assistant' && <div className="who">{agent.name}</div>}
            {it.tools.map((t) => (
              <div key={t.id} className="toolcard">
                <div className="toolhd">
                  <span className="tag8">{t.server ? t.server + ' · ' + t.tool : t.tool}</span>
                  <span className={t.result ? 'tok ok' : 'tok'}>{t.result ? 'done' : 'running…'}</span>
                </div>
                {t.query && <pre className="sql">{t.query}</pre>}
                {t.result && <div className="toolres">{t.result.slice(0, 400)}</div>}
              </div>
            ))}
            {it.text && <div className="mtext">{it.text}</div>}
          </div>
        ))}

        {busy && !pending && <div className="typing muted">…thinking</div>}

        {pending && (
          <div className="approval">
            <div className="aphd">
              <span className="apdot" />awaiting your authorisation
            </div>
            <div className="apbody">
              <p>
                <b>{agent.name}</b> wants to run{' '}
                {pending.toolCalls.length > 1 ? `${pending.toolCalls.length} queries` : 'a query'} on{' '}
                <b>{pending.toolCalls[0]?.server || 'the database'}</b>:
              </p>
              {pending.toolCalls.map((tc) => tc.query && (
                <pre key={tc.id} className="sql gold">{tc.query}</pre>
              ))}
            </div>
            <div className="aprow">
              <button className="btn go" onClick={() => void decide('allow')}>Authorise</button>
              <button className="btn" onClick={() => void decide('deny')}>Deny</button>
            </div>
            <div className="aphint">Nothing runs against the database until you authorise.</div>
          </div>
        )}
      </div>

      <div className="chips">
        {agent.suggestions.map((s) => (
          <button key={s} className="qchip" onClick={() => submit(s)} disabled={busy}>{s}</button>
        ))}
      </div>

      <div className="composer">
        <input
          className="cin"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(draft); }}
          placeholder={`Ask ${agent.name}…`}
          disabled={busy}
        />
        <button className="btn send" onClick={() => submit(draft)} disabled={busy}>Send</button>
      </div>
    </>
  );
}
