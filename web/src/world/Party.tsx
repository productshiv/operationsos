import { useEffect, useMemo, useState } from 'react';
import { DANCE_SPOTS, DESKS, type Desk } from './desks';
import { useReducedMotion } from './useReducedMotion';
import { markArrived, useParty } from '../state/party';
import type { useJukebox } from '../state/useJukebox';

const AGENT_DESKS = DESKS.filter((d) => d.kind === 'agent');

/** Short initials for the avatar tag (e.g. "DATA ANALYST" → "DA"). */
const initials = (plate: string) =>
  plate
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase();

const homeOf = (d: Desk) => ({ x: d.x + d.w / 2 - 10, y: d.y + d.h - 2 });

/** The dance moves. Each agent gets its own, and the floor's left/right halves are offset by half a
 *  beat so the room moves in call-and-response rather than one synchronised blob. */
const MOVES = ['bob', 'sway', 'stepTouch', 'raiseRoof', 'shimmy', 'spin'] as const;

/** One agent walking to the dance floor, then dancing once the bar is open. */
function Partygoer({
  desk,
  spot,
  dancing,
  move,
  half,
}: {
  desk: Desk;
  spot: { x: number; y: number };
  dancing: boolean;
  move: (typeof MOVES)[number];
  half: 'l' | 'r';
}) {
  const reduced = useReducedMotion();
  const home = useMemo(() => homeOf(desk), [desk]);
  const [pos, setPos] = useState(home);
  const [dur, setDur] = useState(0);
  const [walking, setWalking] = useState(false);

  // Head to the dance floor as soon as we're called.
  useEffect(() => {
    const ms = reduced ? 0 : Math.max(700, Math.round(Math.hypot(spot.x - home.x, spot.y - home.y) * 14));
    setDur(ms);
    setWalking(!reduced);
    setPos(spot);
    const t = window.setTimeout(() => {
      setWalking(false);
      markArrived(desk.id, AGENT_DESKS.length);
    }, ms + 40);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ink = 'var(--ink)';
  return (
    <div
      className={`sprite roamer partygoer${walking ? ' walk' : ''}${
        dancing && !reduced ? ` dancing move-${move} half-${half}` : ''
      }`}
      style={{ left: pos.x, top: pos.y, transition: reduced ? 'none' : `left ${dur}ms linear, top ${dur}ms linear` }}
    >
      <div className="shadow" />
      <div className="roamer-body">
        <span className="roamer-tag">{initials(desk.plate)}</span>
        <svg viewBox="0 0 20 28" width="20" height="28" shapeRendering="crispEdges">
          <rect x="7" y="1" width="6" height="6" fill={ink} />
          <rect x="5" y="8" width="10" height="9" fill={ink} />
          <rect x="9" y="9" width="2" height="6" fill="var(--paper)" />
          {/* arms — raised while dancing */}
          <g className="armL">
            <rect x="2" y="9" width="3" height="7" fill={ink} />
          </g>
          <g className="armR">
            <rect x="15" y="9" width="3" height="7" fill={ink} />
          </g>
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
    </div>
  );
}

/** The bar: a big pixel TV showing the current jukebox track, plus a disco-lit dance floor. */
function BarScene({ jukebox }: { jukebox: ReturnType<typeof useJukebox> }) {
  const track = jukebox.current;
  const title = track?.title || track?.videoId || 'nothing queued';
  return (
    <>
      <div className="dancefloor" aria-hidden="true" />
      <div className="bartv">
        <div className="bartv-screen">
          {/* The equalizer only animates while the jukebox is actually playing. */}
          <div className={`bartv-bars${jukebox.playing ? ' playing' : ''}`} aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${i * 0.11}s` }} />
            ))}
          </div>
          <div className="bartv-title" title={title}>
            {jukebox.playing ? '▶' : '❚❚'} {title}
          </div>
        </div>
        <div className="bartv-stand" />
      </div>
    </>
  );
}

/**
 * Floor party: once the CEO calls everyone from the HR room, the agents walk to the dance floor and
 * — when they've all arrived — the office turns into a pixelated bar with a TV playing the jukebox
 * track while they dance.
 */
export function Party({ jukebox }: { jukebox: ReturnType<typeof useJukebox> }) {
  const { phase } = useParty();
  if (phase === 'off') return null;
  const dancing = phase === 'party';
  return (
    <>
      {dancing && <BarScene jukebox={jukebox} />}
      {AGENT_DESKS.map((desk, i) => {
        const spot = DANCE_SPOTS[i % DANCE_SPOTS.length];
        // Split the floor down the middle so the two halves alternate (call and response).
        const half = spot.x < 470 ? 'l' : 'r';
        return (
          <Partygoer
            key={desk.id}
            desk={desk}
            spot={spot}
            dancing={dancing}
            move={MOVES[i % MOVES.length]}
            half={half}
          />
        );
      })}
    </>
  );
}
