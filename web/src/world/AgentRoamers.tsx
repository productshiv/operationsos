import { useEffect, useMemo, useState } from 'react';
import { DESKS, type Desk } from './desks';
import { WAYPOINTS } from './ambient';
import { useReducedMotion } from './useReducedMotion';
import { setPresence, usePresence } from '../state/presence';

const AGENT_DESKS = DESKS.filter((d) => d.kind === 'agent');

/** Short initials for the avatar tag, from the desk plate (e.g. "DATA ANALYST" → "DA"). */
const initials = (plate: string) =>
  plate
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase();

/** The point an agent leaves from / returns to — just below its desk, where the seat is. */
const homeOf = (d: Desk) => ({ x: d.x + d.w / 2 - 10, y: d.y + d.h - 2 });

/** A small standing agent (walk cycle via legA/legB), tagged with the agent's initials. */
function AgentFigure({ tag, flip }: { tag: string; flip: boolean }) {
  const ink = 'var(--ink)';
  return (
    <div className="roamer-body" style={{ transform: flip ? 'scaleX(-1)' : 'none' }}>
      <span className="roamer-tag" style={{ transform: flip ? 'scaleX(-1)' : 'none' }}>
        {tag}
      </span>
      <svg viewBox="0 0 20 28" width="20" height="28" shapeRendering="crispEdges">
        <rect x="7" y="1" width="6" height="6" fill={ink} />
        <rect x="5" y="8" width="10" height="9" fill={ink} />
        <rect x="9" y="9" width="2" height="6" fill="var(--paper)" />
        <rect x="2" y="9" width="3" height="7" fill={ink} />
        <rect x="15" y="9" width="3" height="7" fill={ink} />
        <g className="legA">
          <rect x="6" y="17" width="3" height="8" fill={ink} />
          <rect x="11" y="17" width="3" height="8" fill={ink} />
        </g>
        <g className="legB">
          <rect x="5" y="17" width="3" height="8" fill={ink} />
          <rect x="12" y="17" width="3" height="8" fill={ink} />
        </g>
      </svg>
    </div>
  );
}

type Phase = 'leaving' | 'lingering' | 'returning';

/** The away trip: desk → a spot by a prop → linger → back to the desk. Being summoned (the CEO walks
 *  up to the desk) cuts straight to returning, so the agent "arrives" as you reach their table. */
function AgentWalk({ desk, summoned }: { desk: Desk; summoned: boolean }) {
  const home = useMemo(() => homeOf(desk), [desk]);
  const dest = useMemo(() => WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)], []);
  const [phase, setPhase] = useState<Phase>('leaving');
  const [pos, setPos] = useState(home);
  const [walking, setWalking] = useState(true);
  const [flip, setFlip] = useState(false);
  const [dur, setDur] = useState(0);

  // A visit while away → head home now.
  useEffect(() => {
    if (summoned && phase !== 'returning') setPhase('returning');
  }, [summoned, phase]);

  useEffect(() => {
    let alive = true;
    let timer: number;
    const moveTo = (to: { x: number; y: number }) => {
      const ms = Math.max(700, Math.round(Math.hypot(to.x - pos.x, to.y - pos.y) * 16));
      setFlip(to.x < pos.x - 2);
      setDur(ms);
      setWalking(true);
      setPos(to);
      return ms;
    };
    if (phase === 'leaving') {
      timer = window.setTimeout(() => alive && setPhase('lingering'), moveTo(dest));
    } else if (phase === 'lingering') {
      setWalking(false);
      timer = window.setTimeout(() => alive && setPhase('returning'), 8000 + Math.random() * 8000);
    } else {
      timer = window.setTimeout(() => alive && setPresence(desk.id, 'in'), moveTo(home));
    }
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div
      className={`sprite roamer${walking ? ' walk' : ''}`}
      style={{ left: pos.x, top: pos.y, transition: `left ${dur}ms linear, top ${dur}ms linear` }}
    >
      <div className="shadow" />
      <AgentFigure tag={initials(desk.plate)} flip={flip} />
    </div>
  );
}

/** Schedules an agent's occasional outings; renders the walking avatar only while it's away. */
function AgentPresence({ desk, nearId }: { desk: Desk; nearId: string | null }) {
  const presence = usePresence(desk.id);
  const reduced = useReducedMotion();

  // When at the desk, occasionally (and rarely) step out. Never while reduced motion is on.
  useEffect(() => {
    if (reduced || presence !== 'in') return;
    const t = window.setTimeout(
      () => setPresence(desk.id, 'out'),
      60000 + Math.random() * 90000, // 1–2.5 min between outings
    );
    return () => clearTimeout(t);
  }, [reduced, presence, desk.id]);

  if (presence !== 'out') return null;
  return <AgentWalk desk={desk} summoned={nearId === desk.id} />;
}

/** Named agents who occasionally leave their desks — and return when you walk up to them. */
export function AgentRoamers({ nearId }: { nearId: string | null }) {
  return (
    <>
      {AGENT_DESKS.map((desk) => (
        <AgentPresence key={desk.id} desk={desk} nearId={nearId} />
      ))}
    </>
  );
}
