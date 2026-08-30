import { useEffect, useState } from 'react';
import type { ConnectionState } from '../lib/trueforge';
import { JukeboxWidget, type Jukebox } from '../music/MusicPlayer';

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

/** The OS menu bar: brand, integrations, live clock, harness connection status, day/night toggle. */
export function MenuBar({
  conn,
  onManage,
  onInfo,
  attention,
  jukebox,
}: {
  conn: ConnectionState;
  onManage?: () => void;
  onInfo?: (kind: 'architecture' | 'roadmap') => void;
  attention?: boolean;
  jukebox: Jukebox;
}) {
  const clock = useClock();
  return (
    <header className="menubar">
      <div className="logo">
        <span className="mk" />
        <b className="chi">OperationsOS</b>
      </div>
      <button className="m m-btn" onClick={onManage} title="Manage integrations">
        Integrations
        {attention && <span className="m-warn" aria-label="needs attention" />}
      </button>
      <span className="m">File&nbsp;TF-007</span>
      <span className="m">View</span>
      <JukeboxWidget jb={jukebox} />
      <div className="spread">
        {/* How the system fits together, and where it's going — reference, always one click away. */}
        <button className="m m-btn m-ref" onClick={() => onInfo?.('architecture')} title="How OperationsOS works">
          architecture
        </button>
        <button className="m m-btn m-ref" onClick={() => onInfo?.('roadmap')} title="What's shipped and what's next">
          roadmap
        </button>
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
