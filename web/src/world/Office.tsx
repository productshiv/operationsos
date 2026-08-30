import { useRef, useState } from 'react';
import { DESKS } from './desks';
import { PROPS } from './ambient';
import { Desk } from './Desk';
import { Prop } from './Prop';
import { Roamers } from './Roamers';
import { Ceo } from './Ceo';
import { TouchPad } from './TouchPad';
import { DeskWindow } from './DeskWindow';
import { AttentionPanel } from './AttentionPanel';
import { useCamera } from './useCamera';
import { useCeo } from './useCeo';
import { useAttention } from '../state/tasks';

/**
 * The walkable floor. The world is a fixed-size plane scaled to fit the viewport; the CEO moves
 * within it, a prompt appears when a desk is in reach, and interacting (E / tap / click) opens
 * that desk's window.
 */
export function Office({ jira, agentModel }: { jira: string | null | undefined; agentModel: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const ceoRef = useRef<HTMLDivElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  const attention = useAttention();

  useCamera(viewportRef, worldRef);
  const { nearId, press, release } = useCeo(ceoRef, setOpenId);

  const near = nearId ? DESKS.find((d) => d.id === nearId) ?? null : null;
  const open = openId ? DESKS.find((d) => d.id === openId) ?? null : null;
  const promptLabel = near?.kind === 'door' ? 'Locked' : 'Open';

  return (
    <div className="viewport" ref={viewportRef}>
      <div className="world" ref={worldRef}>
        <div className="rug" />
        {/* Ambient life — props and wandering workers, behind the desks and the CEO. */}
        {PROPS.map((p) => (
          <Prop key={p.id} prop={p} />
        ))}
        <Roamers />
        {DESKS.map((desk) => (
          <Desk key={desk.id} desk={desk} onOpen={setOpenId} />
        ))}
        <Ceo ref={ceoRef} attention={attention.length} onAttention={() => setBoardOpen(true)} />
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
        <DeskWindow desk={open} jira={jira} agentModel={agentModel} onClose={() => setOpenId(null)} />
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
