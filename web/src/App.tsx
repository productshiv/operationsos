import { useState } from 'react';
import { MenuBar } from './components/MenuBar';
import { Ticker } from './components/Ticker';
import { Office } from './world/Office';
import { Setup } from './setup/Setup';
import { useHarnessStatus } from './lib/useHarnessStatus';
import { useConnectors } from './state/useConnectors';
import './ui.css';

export default function App() {
  const conn = useHarnessStatus();
  const connectors = useConnectors();
  const [setupOpen, setSetupOpen] = useState(false);

  // Only nag when something actually needs doing — a tool needs auth, or the harness is unreachable.
  const needsAttention =
    connectors.offline || connectors.connectors.some((c) => c.status === 'auth_required');

  return (
    <div className="app">
      <MenuBar conn={conn} attention={needsAttention} onManage={() => setSetupOpen(true)} />
      <Office />
      <Ticker />
      {setupOpen && <Setup state={connectors} onClose={() => setSetupOpen(false)} />}
    </div>
  );
}
