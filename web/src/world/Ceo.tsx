import { forwardRef } from 'react';

/** The player: a 1-bit figure with a "YOU" tag. Position is driven imperatively by useCeo. A number
 *  badge shows whenever there's anything on your board (agents waiting on you + active tasks) so the
 *  board stays reachable; it pulses only when something actually needs your sign-off. */
export const Ceo = forwardRef<HTMLDivElement, { count: number; urgent: boolean; onAttention: () => void }>(
  function Ceo({ count, urgent, onAttention }, ref) {
    return (
      <div className="sprite ceo" ref={ref}>
        <span className="tag">YOU</span>
        {count > 0 && (
          <button
            className={`youbadge${urgent ? ' urgent' : ''}`}
            title={urgent ? 'Agents are waiting on you — open your board' : 'Open your board'}
            onClick={(e) => {
              e.stopPropagation();
              onAttention();
            }}
          >
            {count}
          </button>
        )}
        <div className="shadow" />
      <svg viewBox="0 0 26 34" width="26" height="34">
        <rect x="9" y="2" width="8" height="7" fill="var(--ink)" />
        <rect x="8" y="4" width="1" height="4" fill="var(--ink)" />
        <rect x="17" y="4" width="1" height="4" fill="var(--ink)" />
        <rect x="6" y="10" width="14" height="12" fill="var(--ink)" />
        <rect x="12" y="11" width="2" height="7" fill="var(--paper)" />
        <rect x="3" y="11" width="3" height="9" fill="var(--ink)" />
        <rect x="20" y="11" width="3" height="9" fill="var(--ink)" />
        <g className="legA">
          <rect x="8" y="22" width="4" height="10" fill="var(--ink)" />
          <rect x="14" y="22" width="4" height="10" fill="var(--ink)" />
        </g>
        <g className="legB">
          <rect x="7" y="22" width="4" height="10" fill="var(--ink)" />
          <rect x="15" y="22" width="4" height="10" fill="var(--ink)" />
        </g>
      </svg>
    </div>
  );
});
