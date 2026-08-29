import { useState } from 'react';
import { MenuBar } from './components/MenuBar';
import { Ticker } from './components/Ticker';
import { Office } from './world/Office';
import { Setup } from './setup/Setup';
import { useHarnessStatus } from './lib/useHarnessStatus';
import './ui.css';

export default function App() {
  const conn = useHarnessStatus();
  // First run opens on the connect-tools setup (the empty state); reopen it from the menu bar.
  const [setupOpen, setSetupOpen] = useState(true);

  return (
    <div className="app">
      <MenuBar conn={conn} onConnect={() => setSetupOpen(true)} />
      <Office />
      <Ticker />
      {setupOpen && <Setup onClose={() => setSetupOpen(false)} />}
    </div>
  );
}
