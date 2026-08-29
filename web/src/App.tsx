import { useEffect, useState } from 'react';
import { checkConnection, TRUEFORGE_BASE_URL, type ConnectionState } from './lib/trueforge';
import './App.css';

export default function App() {
  const [conn, setConn] = useState<ConnectionState>('connecting');

  useEffect(() => {
    let alive = true;
    checkConnection().then((state) => {
      if (alive) setConn(state);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="app">
      <header className="menubar">
        <span className="brand">◆ OperationsOS</span>
        <span className="file">FILE TF-007</span>
        <span className={`status status--${conn}`}>harness: {conn}</span>
      </header>

      <main className="floor">
        <h1>OperationsOS</h1>
        <p>
          Front-end scaffold, wired to the TrueForge SDK at <code>{TRUEFORGE_BASE_URL}</code>.
        </p>
        <p className="dim">
          The walkable 1-bit office ships next — the interaction north-star lives in{' '}
          <code>design/mock.html</code>.
        </p>
      </main>
    </div>
  );
}
