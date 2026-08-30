import { useEffect } from 'react';

/**
 * The two "how this works" windows reachable from the menu bar: a simplified **architecture** of the
 * system, and the **roadmap**. Both are read-only reference — drawn in the same 1-bit language as the
 * floor so they feel like part of the OS rather than a docs page.
 */
export type InfoKind = 'architecture' | 'roadmap';

/** One layer of the architecture: what it is, and what it's responsible for. */
const LAYERS: Array<{ title: string; sub: string; items: string[]; gate?: boolean }> = [
  {
    title: 'YOU · the CEO',
    sub: 'walk the floor, decide',
    items: ['Talk to any agent at their desk', 'Authorise or deny every write', 'Board: what needs you + open tasks'],
  },
  {
    title: 'OPERATIONSOS',
    sub: 'React + Vite · this app',
    items: ['Desks, chat, task board', 'Native model + connector setup', 'Conversations persist per agent'],
  },
  {
    title: 'APPROVAL GATE',
    sub: 'nothing writes without you',
    items: ['Every tool call pauses here', 'You see the exact SQL / payload', 'Allow or deny — then it runs'],
    gate: true,
  },
  {
    title: 'TRUEFORGE HARNESS',
    sub: 'the agent runtime · Postgres + Redis',
    items: ['Sessions, turns, streaming', 'Tool approval + questions', 'MCP connector registry'],
  },
  {
    title: 'THE AGENTS',
    sub: 'model + instructions + connectors',
    items: ['Data Analyst · Market Research', 'Ops Manager · Support Lead', 'Incident Response'],
  },
  {
    title: 'CONNECTORS (MCP)',
    sub: 'how agents actually act',
    items: ['supabase — the business data', 'atlassian — Jira tickets', 'exa — web research'],
  },
  {
    title: 'THE BUSINESS',
    sub: 'a Weather API company',
    items: ['Customers, usage, payments, errors', 'Complaints from real users', 'Kept live by its own feed service'],
  },
];

/** Roadmap: what is already running, and what comes next. */
const ROADMAP: Array<{ state: 'done' | 'next' | 'later'; title: string; detail: string }> = [
  { state: 'done', title: 'The walkable floor', detail: 'A 1-bit office you move through — desks, props, agents who step out for coffee.' },
  { state: 'done', title: 'Five working agents', detail: 'Analyst, Market Research, Ops Manager, Support Lead, Incident Response — each with its own tools.' },
  { state: 'done', title: 'The approval gate', detail: 'Every write pauses for the CEO with the exact payload shown before it runs.' },
  { state: 'done', title: 'Set up inside the app', detail: 'Model providers and MCP connectors are configured here — no raw admin UI.' },
  { state: 'done', title: 'Conversations that persist', detail: 'Harness-backed, so context survives a reload and follows you across devices.' },
  { state: 'done', title: 'Tasks + attention', detail: 'Tickets route to the Ops Manager; badges show workload and what needs you.' },
  { state: 'done', title: 'A business that moves', detail: 'A live feed changes the data and files customer complaints for Support to triage.' },
  { state: 'next', title: 'Agents consulting agents', detail: 'Let Market Research pull the Data Analyst into a thread instead of asking you to relay.' },
  { state: 'next', title: 'Live desk stats', detail: 'Real open-ticket and incident counts on each desk instead of flavour text.' },
  { state: 'next', title: 'Sales & PM desks', detail: 'The two locked doors on the floor — the next two agents to hire.' },
  { state: 'later', title: 'More floors', detail: 'Departments as floors, with a lift between them.' },
  { state: 'later', title: 'Handheld', detail: 'A tighter layout so the floor is genuinely usable on a phone.' },
];

export function InfoPanel({ kind, onClose }: { kind: InfoKind; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isArch = kind === 'architecture';
  return (
    <div className="scrim on" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="win infowin" role="dialog" aria-modal="true" aria-label={isArch ? 'Architecture' : 'Roadmap'}>
        <div className="wtb">
          <button className="cb" aria-label="Close" onClick={onClose} />
          <span className="wt">{isArch ? 'OperationsOS · Architecture' : 'OperationsOS · Roadmap'}</span>
        </div>
        <div className="wbody infobody">
          {isArch ? (
            <>
              <p className="dim info-lede">
                You supervise agents that run a real business. Everything they do flows down this stack —
                and nothing writes until you say so.
              </p>
              <div className="archstack">
                {LAYERS.map((l, i) => (
                  <div key={l.title} className="archwrap">
                    <div className={`archbox${l.gate ? ' gate' : ''}`}>
                      <div className="archhead">
                        <span className="archtitle chi">{l.title}</span>
                        <span className="dim archsub">{l.sub}</span>
                      </div>
                      <ul className="archlist">
                        {l.items.map((it) => (
                          <li key={it}>{it}</li>
                        ))}
                      </ul>
                    </div>
                    {i < LAYERS.length - 1 && <div className="archarrow" aria-hidden="true">▼</div>}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="dim info-lede">Where OperationsOS is, and where it goes next.</p>
              <div className="roadlist">
                {ROADMAP.map((r) => (
                  <div key={r.title} className={`roaditem road-${r.state}`}>
                    <span className="roadmark" aria-hidden="true">
                      {r.state === 'done' ? '✓' : r.state === 'next' ? '▸' : '·'}
                    </span>
                    <div className="roadtext">
                      <div className="roadtitle">{r.title}</div>
                      <div className="dim roaddetail">{r.detail}</div>
                    </div>
                    <span className="roadtag tag8">{r.state === 'done' ? 'shipped' : r.state}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
