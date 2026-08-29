import { useEffect } from 'react';
import type { Desk } from './desks';

/**
 * The window that opens when you interact with a desk. For this slice it is a placeholder shell;
 * the full desk views (agent chat, reports, the authorisation dossier) slot in here next.
 */
export function DeskWindow({ desk, onClose }: { desk: Desk; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const title = desk.kind === 'door' ? 'LOCKED' : desk.name || desk.plate;

  return (
    <div className="scrim on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="win" role="dialog" aria-modal="true" aria-label={title}>
        <div className="wtb">
          <button className="cb" aria-label="Close" onClick={onClose} />
          <span className="wt">{title}</span>
        </div>
        <div className="wbody">
          {desk.kind === 'door' ? (
            <p>
              <b>{desk.plate.split(' ')[0]}</b> comes online in a later update. The desk is wired — the
              agent isn’t hired yet.
            </p>
          ) : (
            <p>
              <b>{desk.plate}</b> — the full desk view (live chat, reports, and the authorisation
              dossier) arrives in the next update.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
