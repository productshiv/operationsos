import { useState } from 'react';
import { MenuBar } from './components/MenuBar';
import { Ticker } from './components/Ticker';
import { Office } from './world/Office';
import { MusicEngine, JukeboxModal } from './music/MusicPlayer';
import { Setup } from './setup/Setup';
import { useHarnessStatus } from './lib/useHarnessStatus';
import { useConnectors } from './state/useConnectors';
import { useModels } from './state/useModels';
import { useJukebox } from './state/useJukebox';
import { AGENT_MODEL } from './lib/agents';
import './ui.css';

export default function App() {
  const conn = useHarnessStatus();
  const connectors = useConnectors();
  const models = useModels();
  const jukebox = useJukebox();
  const [setupOpen, setSetupOpen] = useState(false);

  // Nag when something actually needs doing. The model check is for the *exact* model every agent
  // runs on (AGENT_MODEL) — an unrelated provider doesn't make agents runnable — and a failure to
  // list models is itself worth flagging, since we then can't confirm agents have a usable model.
  const hasAgentModel = models.models.some((m) => `${m.provider}/${m.model}` === AGENT_MODEL);
  const missingModel = !models.loading && !models.offline && !hasAgentModel;
  const needsAttention =
    connectors.offline ||
    models.offline ||
    // Ignore hidden connectors (e.g. an undeletable dead one) — no row exists for the user to fix.
    connectors.connectors.some((c) => !connectors.hidden.has(c.name) && c.status === 'auth_required') ||
    missingModel;

  return (
    <div className="app">
      <MenuBar conn={conn} attention={needsAttention} onManage={() => setSetupOpen(true)} jukebox={jukebox} />
      <Office />
      <MusicEngine jb={jukebox} />
      <Ticker />
      {jukebox.open && <JukeboxModal jb={jukebox} onClose={() => jukebox.setOpen(false)} />}
      {setupOpen && (
        <Setup connectors={connectors} models={models} onClose={() => setSetupOpen(false)} />
      )}
    </div>
  );
}
