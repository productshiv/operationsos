import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgentChat, type ToolActivity } from '../state/useAgentChat';
import type { AgentConfig } from '../lib/agents';

/** Assistant replies are markdown; render them (links open safely in a new tab). */
function Markdown({ text }: { text: string }) {
  return (
    <div className="mtext md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}
      >
        {text}
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
    if (!t || busy || pending) return;
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

        {/* One-click follow-up actions, offered once the agent has replied and is idle. */}
        {agent.quickActions?.length && !busy && !pending && items.some((it) => it.role === 'assistant') ? (
          <div className="quickacts">
            {agent.quickActions.map((a) => (
              <button key={a.label} className="qact" onClick={() => submit(a.prompt)}>
                ⚡ {a.label}
              </button>
            ))}
          </div>
        ) : null}

        {busy && !pending && <div className="typing muted">…thinking</div>}

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

      <div className="chips">
        {agent.suggestions.map((s) => (
          <button key={s} className="qchip" onClick={() => submit(s)} disabled={busy || !!pending}>{s}</button>
        ))}
      </div>

      <div className="composer">
        <input
          className="cin"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(draft); }}
          placeholder={`Ask ${agent.name}…`}
          disabled={busy || !!pending}
        />
        <button className="btn send" onClick={() => submit(draft)} disabled={busy || !!pending}>Send</button>
      </div>
    </>
  );
}
