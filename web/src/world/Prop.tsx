import type { FloorProp } from './ambient';

/** Small 1-bit pixel art for each prop kind. */
function PropArt({ kind }: { kind: FloorProp['kind'] }) {
  const ink = 'var(--ink)';
  switch (kind) {
    case 'coffee':
      return (
        <svg viewBox="0 0 24 30" width="26" height="32" shapeRendering="crispEdges">
          {/* machine body */}
          <rect x="3" y="1" width="18" height="20" fill={ink} />
          <rect x="5" y="3" width="14" height="6" fill="var(--panel)" />
          <rect x="6" y="4" width="12" height="1" fill={ink} />
          <rect x="6" y="6" width="12" height="1" fill={ink} />
          {/* spout + cup */}
          <rect x="11" y="12" width="2" height="3" fill="var(--panel)" />
          <rect x="9" y="16" width="6" height="4" fill="var(--panel)" />
          <rect x="15" y="17" width="2" height="2" fill="var(--panel)" />
          {/* counter */}
          <rect x="1" y="21" width="22" height="3" fill={ink} />
          <rect x="4" y="24" width="3" height="5" fill={ink} />
          <rect x="17" y="24" width="3" height="5" fill={ink} />
        </svg>
      );
    case 'cooler':
      return (
        <svg viewBox="0 0 20 32" width="22" height="34" shapeRendering="crispEdges">
          {/* bottle */}
          <rect x="6" y="0" width="8" height="10" fill={ink} />
          <rect x="8" y="1" width="4" height="7" fill="var(--panel)" />
          {/* body */}
          <rect x="3" y="10" width="14" height="16" fill={ink} />
          <rect x="8" y="15" width="4" height="3" fill="var(--panel)" />
          {/* legs */}
          <rect x="4" y="26" width="3" height="5" fill={ink} />
          <rect x="13" y="26" width="3" height="5" fill={ink} />
        </svg>
      );
    case 'plant':
      return (
        <svg viewBox="0 0 22 28" width="24" height="30" shapeRendering="crispEdges">
          {/* leaves */}
          <rect x="9" y="0" width="4" height="10" fill={ink} />
          <rect x="4" y="4" width="4" height="8" fill={ink} />
          <rect x="14" y="4" width="4" height="8" fill={ink} />
          <rect x="6" y="10" width="10" height="4" fill={ink} />
          {/* pot */}
          <rect x="5" y="15" width="12" height="3" fill={ink} />
          <rect x="6" y="18" width="10" height="9" fill={ink} />
          <rect x="9" y="21" width="4" height="4" fill="var(--panel)" />
        </svg>
      );
    case 'cube':
      return (
        <svg viewBox="0 0 22 22" width="24" height="24" shapeRendering="crispEdges">
          <rect x="1" y="1" width="20" height="20" fill={ink} />
          {/* 3x3 tiles */}
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => (
              <rect key={`${r}-${c}`} x={3 + c * 6.3} y={3 + r * 6.3} width="4.7" height="4.7" fill="var(--panel)" />
            )),
          )}
        </svg>
      );
  }
}

/** A stationary ambient prop on the floor. */
export function Prop({ prop }: { prop: FloorProp }) {
  return (
    <div className="prop" style={{ left: prop.x, top: prop.y }}>
      <PropArt kind={prop.kind} />
      {prop.label && <span className="prop-label">{prop.label}</span>}
    </div>
  );
}
