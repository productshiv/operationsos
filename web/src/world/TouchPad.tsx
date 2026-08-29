import type { Dir } from './useCeo';

interface TouchPadProps {
  press: (dir: Dir) => void;
  release: (dir: Dir) => void;
  onInteract?: () => void;
}

const PAD: { dir: Dir; cls: string; label: string }[] = [
  { dir: 'up', cls: 'u', label: '▲' },
  { dir: 'left', cls: 'l', label: '◀' },
  { dir: 'right', cls: 'r', label: '▶' },
  { dir: 'down', cls: 'd', label: '▼' },
];

/** On-screen controls for touch devices: a d-pad plus an interact button. */
export function TouchPad({ press, release, onInteract }: TouchPadProps) {
  return (
    <div className="touch">
      <div className="dpad">
        {PAD.map(({ dir, cls, label }) => (
          <button
            key={dir}
            className={cls}
            aria-label={dir}
            onPointerDown={(e) => { e.preventDefault(); press(dir); }}
            onPointerUp={(e) => { e.preventDefault(); release(dir); }}
            onPointerLeave={() => release(dir)}
            onPointerCancel={() => release(dir)}
          >
            {label}
          </button>
        ))}
      </div>
      <button className="abtn" aria-label="Interact" onClick={onInteract}>E</button>
    </div>
  );
}
