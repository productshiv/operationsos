import { useEffect, useState } from 'react';
import type { ConnectionState } from '../lib/trueforge';

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  // Local time — the bar shows no timezone label, so UTC would mislead non-UTC users.
  return now.toLocaleTimeString([], { hour12: false });
}

function toggleTheme() {
  const root = document.documentElement;
  const current = root.getAttribute('data-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const next = current ? (current === 'dark' ? 'light' : 'dark') : prefersDark ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
}

/** The OS menu bar: brand, live clock, harness connection status, day/night toggle. */
export function MenuBar({ conn }: { conn: ConnectionState }) {
  const clock = useClock();
  return (
    <header className="menubar">
      <div className="logo">
        <span className="mk" />
        <b className="chi">OperationsOS</b>
      </div>
      <span className="m">File&nbsp;TF-007</span>
      <span className="m">View</span>
      <div className="spread">
        <span className={`hstatus hstatus--${conn}`}>harness: {conn}</span>
        <span className="clock chi">{clock}</span>
        <button className="iconbtn" onClick={toggleTheme} title="Day / night shift" aria-label="Toggle day / night shift">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
          </svg>
        </button>
      </div>
    </header>
  );
}
