import { useRef, useState } from 'react';
import { DESKS } from './desks';
import { PROPS } from './ambient';
import { Desk } from './Desk';
import { Prop } from './Prop';
import { AgentRoamers } from './AgentRoamers';
import { Ceo } from './Ceo';
import { TouchPad } from './TouchPad';
import { DeskWindow } from './DeskWindow';
import { AttentionPanel } from './AttentionPanel';
import { Party } from './Party';
import { useCamera } from './useCamera';
import { useCeo } from './useCeo';
import { useAttention, useOpenTasks } from '../state/tasks';
import { useParty } from '../state/party';
import type { useJukebox } from '../state/useJukebox';

/**
 * The walkable floor. The world is a fixed-size plane scaled to fit the viewport; the CEO moves
 * within it, a prompt appears when a desk is in reach, and interacting (E / tap / click) opens
 * that desk's window.
 */
export function Office({
  jira,
  agentModel,
  jukebox,
}: {
  jira: string | null | undefined;
  agentModel: string;
  jukebox: ReturnType<typeof useJukebox>;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const ceoRef = useRef<HTMLDivElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  const attention = useAttention();
  const openTasks = useOpenTasks();
  // The board badge shows whenever there's anything on it (things needing you + active tasks), so the
  // board stays reachable; it only "pulses" (urgent) when an agent is actually waiting on your sign-off.
  const boardCount = attention.length + openTasks.length;

  const party = useParty();
  const partying = party.phase !== 'off';

  useCamera(viewportRef, worldRef);
  const { nearId, press, release } = useCeo(ceoRef, setOpenId);

  const near = nearId ? DESKS.find((d) => d.id === nearId) ?? null : null;
  const open = openId ? DESKS.find((d) => d.id === openId) ?? null : null;
  const promptLabel = near?.kind === 'door' ? 'Locked' : 'Open';

  return (
    <div className={`viewport${party.phase === 'party' ? ' partymode' : ''}`} ref={viewportRef}>
      <div className="world" ref={worldRef}>
        <div className="rug" />
        {/* Ambient life — props, and the agents who occasionally step out to them (and return when
            you walk up to their desk). Behind the desks and the CEO. */}
        {PROPS.map((p) => (
          <Prop key={p.id} prop={p} />
        ))}
        {/* Normal roaming pauses during a party — the agents are on the dance floor instead. */}
        {!partying && <AgentRoamers nearId={nearId} />}
        <Party jukebox={jukebox} />
        {DESKS.map((desk) => (
          <Desk key={desk.id} desk={desk} onOpen={setOpenId} />
        ))}
        <Ceo
          ref={ceoRef}
          count={boardCount}
          urgent={attention.length > 0}
          onAttention={() => setBoardOpen(true)}
        />
        {near && (
          <div className="prompt on" style={{ left: near.x + near.w / 2, top: near.y - 6 }}>
            <span className="k">E</span>
            {promptLabel}
          </div>
        )}
      </div>

      <TouchPad press={press} release={release} onInteract={() => nearId && setOpenId(nearId)} />

      <div className="hint">
        <span className="k">↑↓←→</span> / <span className="k">WASD</span> walk · <span className="k">E</span> interact
      </div>

      {open && (
        <DeskWindow
          desk={open}
          jira={jira}
          agentModel={agentModel}
          jukebox={jukebox}
          onClose={() => setOpenId(null)}
        />
      )}

      {boardOpen && (
        <AttentionPanel
          onClose={() => setBoardOpen(false)}
          onGoto={(id) => {
            setBoardOpen(false);
            setOpenId(id);
          }}
        />
      )}
    </div>
  );
}
