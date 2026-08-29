import { forwardRef } from 'react';

/** The player: a 1-bit figure with a "YOU" tag. Position is driven imperatively by useCeo. */
export const Ceo = forwardRef<HTMLDivElement>(function Ceo(_props, ref) {
  return (
    <div className="sprite ceo" ref={ref}>
      <span className="tag">YOU</span>
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
