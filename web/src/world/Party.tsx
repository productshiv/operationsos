import { useEffect, useMemo, useRef, useState } from 'react';
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

/** The dance moves — each agent gets its own style, layered on top of the shared step routine (see
 *  the `choreo` keyframes), so the group travels in lockstep while nobody looks like a clone. */
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

/** What the bartender is doing right now, and how long each bit lasts (ms). */
const BAR_ROUTINE = [
  { phase: 'slide', ms: 2200 },
  { phase: 'shake', ms: 2600 },
  { phase: 'pour', ms: 1900 },
  { phase: 'slide', ms: 1800 },
  { phase: 'flair', ms: 1900 },
  { phase: 'shake', ms: 2000 },
  { phase: 'wipe', ms: 2200 },
] as const;
/** Spots along the counter he works from. */
const BAR_STOPS = [0, 72, 148, 214, 280];

/**
 * The bartender: works the counter rather than just pacing it. He slides to a spot, stops to shake a
 * drink, pours it into the glasses, tosses the shaker for a bit of flair, and wipes down — then moves
 * on. The phase drives which animation the arms/shaker/glasses run (see the `.phase-*` rules).
 */
function Bartender() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [x, setX] = useState(BAR_STOPS[0]);
  const [flip, setFlip] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const { phase, ms } = BAR_ROUTINE[step % BAR_ROUTINE.length];
    if (phase === 'slide') {
      // Pick a new spot on the counter and face the way he's heading.
      const to = BAR_STOPS[Math.floor(Math.random() * BAR_STOPS.length)];
      setFlip(to < x);
      setX(to);
    }
    const t = window.setTimeout(() => setStep((n) => n + 1), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, reduced]);

  const phase = reduced ? 'shake' : BAR_ROUTINE[step % BAR_ROUTINE.length].phase;
  const ink = 'var(--ink)';
  return (
    <div
      className={`bartender phase-${phase}`}
      aria-hidden="true"
      style={{ transform: `translateX(${x}px)`, transition: reduced ? 'none' : 'transform 1.8s ease-in-out' }}
    >
      <div className="bartender-body" style={{ transform: flip ? 'scaleX(-1)' : 'none' }}>
        <span className="roamer-tag" style={{ transform: `translateX(-50%) ${flip ? 'scaleX(-1)' : ''}` }}>
          BAR
        </span>
        <svg viewBox="0 0 30 28" width="30" height="28" shapeRendering="crispEdges">
          {/* head, bow tie, torso */}
          <rect x="7" y="1" width="6" height="6" fill={ink} />
          <rect x="8" y="8" width="4" height="2" fill={ink} />
          <rect x="5" y="10" width="10" height="8" fill={ink} />
          <rect x="9" y="11" width="2" height="5" fill="var(--paper)" />
          {/* left arm — wipes the counter */}
          <g className="wipeArm">
            <rect x="2" y="11" width="3" height="6" fill={ink} />
          </g>
          {/* right arm + shaker — shakes, pours, and gets tossed */}
          <g className="shakeArm">
            <rect x="15" y="11" width="3" height="6" fill={ink} />
            <g className="shaker">
              <rect x="15" y="6" width="4" height="6" fill={ink} />
              <rect x="16" y="7" width="2" height="3" fill="var(--paper)" />
            </g>
          </g>
          <rect x="6" y="18" width="8" height="7" fill={ink} />
          {/* the two glasses on the counter, filled during the pour */}
          <g className="glasses">
            <rect x="21" y="14" width="3" height="5" fill={ink} />
            <rect x="26" y="14" width="3" height="5" fill={ink} />
            <g className="pourStream">
              <rect x="22" y="10" width="1" height="4" fill={ink} />
              <rect x="27" y="10" width="1" height="4" fill={ink} />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}


/** The bar: back-shelf bottles, the counter, a working bartender, the TV, and the lit dance floor. */
function BarScene({ jukebox }: { jukebox: ReturnType<typeof useJukebox> }) {
  const track = jukebox.current;
  const title = track?.title || track?.videoId || 'nothing queued';
  return (
    <>
      <div className="dancefloor" aria-hidden="true" />

      {/* TV mounted on the wall above the bar. */}
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
      </div>

      {/* The bar itself: bottle shelf behind, bartender working, counter in front. */}
      <div className="barshelf" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <i key={i} className={i % 3 === 0 ? 'tall' : ''} />
        ))}
      </div>
      <Bartender />
      <div className="barcounter" aria-hidden="true">
        <span className="barcounter-label">BAR</span>
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
  const dancing = phase === 'party';

  // Drop the needle the moment everyone's on the floor. The CEO clicked "Call everyone" moments ago,
  // which gives the document sticky user activation, so the browser still allows audio to start here.
  const handled = useRef(false); // this party has already decided about the music
  const started = useRef(false); // ...and true only if the party is what actually started it
  useEffect(() => {
    if (!dancing || handled.current) return;
    handled.current = true;
    if (!jukebox.playing) {
      started.current = true;
      jukebox.toggle();
    }
  }, [dancing, jukebox]);
  // ...and stop it when the party ends, so "Back to work" actually means back to work. Only pauses
  // music this party started, so a track the CEO put on themselves beforehand is left alone.
  useEffect(() => {
    if (phase !== 'off' || !handled.current) return;
    const wasOurs = started.current;
    handled.current = false;
    started.current = false;
    if (wasOurs && jukebox.playing) jukebox.toggle();
  }, [phase, jukebox]);

  if (phase === 'off') return null;
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
