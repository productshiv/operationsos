import type { Desk as DeskData } from './desks';
import { AgentSprite } from './AgentSprite';

interface DeskProps {
  desk: DeskData;
  onOpen?: (id: string) => void;
}

/** A workstation on the floor: an agent desk, your Inbox, or a locked (roadmap) door. */
export function Desk({ desk, onOpen }: DeskProps) {
  const style = { left: desk.x, top: desk.y, width: desk.w };

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
        <AgentSprite />
        <div className="plate">{desk.plate}</div>
        {desk.flag && (
          <div className="flag">
            <div className="pole" />
            <div className="pn" />
          </div>
        )}
      </div>
    </div>
  );
}
