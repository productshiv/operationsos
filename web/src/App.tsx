import { useState } from 'react';
import { MenuBar } from './components/MenuBar';
import { Ticker } from './components/Ticker';
import { Office } from './world/Office';
import { Setup } from './setup/Setup';
import { useHarnessStatus } from './lib/useHarnessStatus';
import { useConnectors } from './state/useConnectors';
import { useModels } from './state/useModels';
import './ui.css';

export default function App() {
  const conn = useHarnessStatus();
  const connectors = useConnectors();
  const models = useModels();
  const [setupOpen, setSetupOpen] = useState(false);

  // Only nag when something actually needs doing: the harness is unreachable, a tool needs auth, or
  // no model is configured (agents can't run without one). Don't nag while still probing.
  const noModel = !models.loading && !models.offline && models.models.length === 0;
  const needsAttention =
    connectors.offline ||
    connectors.connectors.some((c) => c.status === 'auth_required') ||
    noModel;

  return (
    <div className="app">
      <MenuBar conn={conn} attention={needsAttention} onManage={() => setSetupOpen(true)} />
      <Office />
      <Ticker />
      {setupOpen && (
        <Setup connectors={connectors} models={models} onClose={() => setSetupOpen(false)} />
      )}
    </div>
  );
}
