import type { Desk as DeskData } from './desks';
import { AgentSprite } from './AgentSprite';
import { useOpenTaskCount } from '../state/tasks';
import { usePresence } from '../state/presence';
import { inboundFor, useBusinessStats } from '../state/useBusinessStats';
import { useParty } from '../state/party';

interface DeskProps {
  desk: DeskData;
  onOpen?: (id: string) => void;
}

/** A workstation on the floor: an agent desk, your Inbox, or a locked (roadmap) door. */
export function Desk({ desk, onOpen }: DeskProps) {
  const style = { left: desk.x, top: desk.y, width: desk.w };
  // Active tasks routed to this agent — shown as a number badge (their workload to check on).
  const tasks = useOpenTaskCount(desk.id);
  // Work that arrived on its own — complaints for Support, error bursts for Incident Response.
  const inbound = inboundFor(desk.id, useBusinessStats());
  // Whether the agent is at their desk — when out (grabbing a coffee, or at the floor party), the
  // chair sits empty and the walking/dancing avatar represents them instead.
  const party = useParty();
  const away = usePresence(desk.id) === 'out' || party.phase !== 'off';

  if (desk.kind === 'hr') {
    return (
      <div className="hrroom" style={{ ...style, height: desk.h }} onClick={() => onOpen?.(desk.id)}>
        <div className="hrroom-sign">{desk.plate}</div>
        <div className="hrroom-note">call everyone</div>
      </div>
    );
  }

  if (desk.kind === 'door') {
    return (
      <div className="door" style={{ ...style, height: desk.h }} onClick={() => onOpen?.(desk.id)}>
        <span>{desk.plate}</span>
      </div>
    );
  }

  if (desk.kind === 'inbox') {
    return (
      <div className="desk inbox" style={style} onClick={() => onOpen?.(desk.id)}>
        <div className="tray">
          <span className="badge">1</span>
          <div className="lbl chi">IN-TRAY</div>
          <div className="slot" />
          <div className="slot" />
          <div className="slot" />
        </div>
        <div className="seat">
          <div className="plate">{desk.plate}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="desk" data-id={desk.id} style={style} onClick={() => onOpen?.(desk.id)}>
      <div className="scr" style={{ height: desk.h - 30 }}>
        <div className="tb">
          <span className="cb" />
          <span className="nm">{desk.name}</span>
        </div>
        <div className="disp">
          {desk.act === 'bars' ? (
            <div className="workbar"><i /></div>
          ) : (
            <div className="cursorline">&gt; run <b /></div>
          )}
          <div className="stat">{desk.stat}</div>
        </div>
      </div>
      <div className="seat">
        {away ? <div className="seat-empty" title="Away from desk" /> : <AgentSprite />}
        <div className="plate">{desk.plate}</div>
      </div>
      {(tasks > 0 || inbound) && (
        <div
          className={`deskbadge${inbound ? ' inbound' : ''}`}
          title={[
            tasks > 0 ? `${tasks} active task${tasks === 1 ? '' : 's'}` : '',
            inbound?.label ?? '',
          ]
            .filter(Boolean)
            .join(' · ')}
        >
          {tasks + (inbound?.count ?? 0)}
        </div>
      )}
    </div>
  );
}
