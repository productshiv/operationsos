import { useEffect } from 'react';
import type { Desk } from './desks';
import { AGENTS } from '../lib/agents';
import { AgentChat } from '../agents/AgentChat';

/**
 * The window that opens when you interact with a desk. Live agents (those with a config) get a
 * real chat; the rest are placeholder shells until their agent lands.
 */
export function DeskWindow({ desk, onClose }: { desk: Desk; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const agent = desk.kind === 'agent' ? AGENTS[desk.id] : undefined;
  const title = desk.kind === 'door' ? 'LOCKED' : desk.name || desk.plate;

  return (
    <div className="scrim on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`win${agent ? ' chatwin' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="wtb">
          <button className="cb" aria-label="Close" onClick={onClose} />
          <span className="wt">{title}</span>
        </div>
        <div className="wbody">
          {agent ? (
            <AgentChat agent={agent} />
          ) : desk.kind === 'door' ? (
            <p>
              <b>{desk.plate.split(' ')[0]}</b> comes online in a later update. The desk is wired — the
              agent isn’t hired yet.
            </p>
          ) : (
            <p>
              <b>{desk.plate}</b> — this agent’s desk view arrives in a later update.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
