import { useEffect, useRef, useState } from 'react';
import { ROAMER_COUNT, WAYPOINTS } from './ambient';

/** Reactive prefers-reduced-motion — updates if the OS/browser setting changes while mounted. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** A small standing worker (walk cycle via the legA/legB swap). */
function WorkerFigure() {
  const ink = 'var(--ink)';
  return (
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
  );
}

/**
 * One self-driving worker: pause a beat, walk to a random waypoint (movement animated by a CSS
 * transition whose duration scales with distance, so speed stays roughly constant), then repeat.
 * Honours prefers-reduced-motion by standing still.
 */
function Worker({ startIdx }: { startIdx: number }) {
  const reduced = useReducedMotion();
  const [pos, setPos] = useState(() => WAYPOINTS[startIdx % WAYPOINTS.length]);
  const [walking, setWalking] = useState(false);
  const [flip, setFlip] = useState(false);
  const [dur, setDur] = useState(0);
  const posRef = useRef(pos);
  posRef.current = pos;

  // Re-runs when the reduced-motion preference changes: under reduced motion the worker stands still
  // (the effect returns early, and transitions are disabled below so any in-flight move stops too).
  useEffect(() => {
    if (reduced) {
      setWalking(false);
      return;
    }
    let alive = true;
    let arrive: number | undefined;
    let t = window.setTimeout(function loop() {
      if (!alive) return;
      const cur = posRef.current;
      const next = WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)];
      const dist = Math.hypot(next.x - cur.x, next.y - cur.y);
      const travel = Math.max(900, Math.round(dist * 16)); // ~16ms per px → a calm stroll
      setFlip(next.x < cur.x - 2);
      setDur(travel);
      setWalking(true);
      setPos(next);
      arrive = window.setTimeout(() => {
        if (!alive) return;
        setWalking(false);
        const pause = 1800 + Math.random() * 3600; // idle a moment at the destination
        t = window.setTimeout(loop, pause);
      }, travel);
    }, 600 + Math.random() * 2400);

    return () => {
      alive = false;
      clearTimeout(t);
      if (arrive) clearTimeout(arrive);
    };
  }, [reduced]);

  return (
    <div
      className={`sprite roamer${walking && !reduced ? ' walk' : ''}`}
      style={{
        left: pos.x,
        top: pos.y,
        transition: reduced ? 'none' : `left ${dur}ms linear, top ${dur}ms linear`,
      }}
    >
      <div className="shadow" />
      <div className="roamer-body" style={{ transform: flip ? 'scaleX(-1)' : 'none' }}>
        <WorkerFigure />
      </div>
    </div>
  );
}

/** The wandering workers that give the floor ambient life. */
export function Roamers() {
  return (
    <>
      {Array.from({ length: ROAMER_COUNT }, (_, i) => (
        <Worker key={i} startIdx={i * 3 + 1} />
      ))}
    </>
  );
}
