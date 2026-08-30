import { useEffect } from 'react';
import { AGENTS } from '../lib/agents';
import { useAttention, useOpenTasks } from '../state/tasks';

/** Map an agent/desk id to its display name (falls back to the id). */
const agentName = (id: string) => AGENTS[id]?.name ?? id;

/**
 * The CEO's board: what's waiting on you (agents paused at an approval gate) and the open tasks
 * routed across the floor. Opened from the number badge on "YOU". Clicking an item jumps to that desk.
 */
export function AttentionPanel({ onClose, onGoto }: { onClose: () => void; onGoto: (id: string) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const attention = useAttention();
  const tasks = useOpenTasks();

  return (
    <div className="scrim on" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="win board" role="dialog" aria-modal="true" aria-label="Your board">
        <div className="wtb">
          <button className="cb" aria-label="Close" onClick={onClose} />
          <span className="wt">Your board</span>
        </div>
        <div className="wbody board-body">
          <section className="board-sec">
            <div className="board-head chi">Waiting on you · {attention.length}</div>
            {attention.length === 0 ? (
              <p className="dim">Nothing needs your sign-off right now.</p>
            ) : (
              <div className="board-list">
                {attention.map((a) => (
                  <button key={a.agentId} className="board-row" onClick={() => onGoto(a.agentId)}>
                    <span className="board-row-name">{agentName(a.agentId)}</span>
                    <span className="dim">wants to run {a.label} — authorise ▸</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="board-sec">
            <div className="board-head chi">Active tasks · {tasks.length}</div>
            {tasks.length === 0 ? (
              <p className="dim">No open tasks. Ask an agent to open a ticket when it flags an issue.</p>
            ) : (
              <div className="board-list">
                {tasks.map((t) => (
                  <button key={t.id} className="board-row" onClick={() => onGoto(t.assignedTo)}>
                    <span className="board-row-name">{t.title}</span>
                    <span className="dim">
                      {agentName(t.createdBy)} → {agentName(t.assignedTo)} ▸
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
