import { useEffect, useRef, useState, type RefObject } from 'react';
import { DESKS, WORLD_W, WORLD_H } from './desks';

export type Dir = 'up' | 'down' | 'left' | 'right';

const KEYMAP: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
};
const INTERACT_KEYS = new Set(['e', 'E', 'Enter', ' ']);

/**
 * True when the keystroke belongs to a text field (form input, textarea, select, or any
 * contenteditable). Movement keys (WASD/arrows) and interact keys (e/space/Enter) must yield to
 * typing — otherwise entering an API key or chatting would walk the avatar and, worse, get
 * swallowed by preventDefault.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

const SPEED = 2.5;
const FEET_W = 18;
const FEET_H = 10;
const NEAR_PAD = 46;

const SOLIDS = DESKS.map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h }));
function collides(x: number, y: number, w: number, h: number): boolean {
  return SOLIDS.some((s) => x < s.x + s.w && x + w > s.x && y < s.y + s.h && y + h > s.y);
}

/**
 * Drives the CEO avatar: keyboard (arrows/WASD) + touch, per-axis collision against desks, a
 * walk animation, which desk (if any) is in reach, and firing `onInteract` for it. Position lives
 * in a ref and is written straight to the element's transform each frame, so movement never
 * re-renders React; only the nearby-desk id — which changes rarely — is state.
 */
export function useCeo(ceoRef: RefObject<HTMLDivElement | null>, onInteract?: (id: string) => void) {
  const [nearId, setNearId] = useState<string | null>(null);
  const keys = useRef<Record<Dir, boolean>>({ up: false, down: false, left: false, right: false });
  const interactRef = useRef(onInteract);
  useEffect(() => { interactRef.current = onInteract; }, [onInteract]);

  const press = (dir: Dir) => { keys.current[dir] = true; };
  const release = (dir: Dir) => { keys.current[dir] = false; };

  useEffect(() => {
    let nearNow: string | null = null;

    const resetKeys = () => {
      keys.current.up = keys.current.down = keys.current.left = keys.current.right = false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return; // don't hijack keys while typing in a field
      if (INTERACT_KEYS.has(e.key)) {
        if (nearNow) { interactRef.current?.(nearNow); e.preventDefault(); }
        return;
      }
      const dir = KEYMAP[e.key];
      if (dir) { keys.current[dir] = true; e.preventDefault(); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const dir = KEYMAP[e.key];
      if (dir) keys.current[dir] = false;
    };
    // A held key whose keyup is lost during focus loss would latch on; clear on blur/hide.
    const onVisibility = () => { if (document.hidden) resetKeys(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', resetKeys);
    document.addEventListener('visibilitychange', onVisibility);

    const pos = { x: 470, y: 300 };
    let facing = 1;
    let stepTimer = 0;
    let stepFrame = false;
    let last = 0;
    let raf = 0;
    const spriteEl = ceoRef.current?.querySelector('svg') as SVGElement | null;

    const applyTransform = () => {
      const el = ceoRef.current;
      if (el) el.style.transform = `translate(${pos.x - 13}px, ${pos.y - 28}px)`;
      // Flip only the sprite, so the "YOU" label and shadow stay upright.
      if (spriteEl) spriteEl.style.transform = `scaleX(${facing})`;
    };
    applyTransform();

    const loop = (ts: number) => {
      const dt = Math.min(2, (ts - last) / 16.67 || 1);
      last = ts;
      const k = keys.current;
      const vx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      const vy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
      const moving = vx !== 0 || vy !== 0;
      if (vx) facing = vx > 0 ? 1 : -1;

      if (vx) {
        const nx = pos.x + vx * SPEED * dt;
        if (nx > 13 && nx < WORLD_W - 13 && !collides(nx - FEET_W / 2, pos.y + 16 - FEET_H, FEET_W, FEET_H)) pos.x = nx;
      }
      if (vy) {
        const ny = pos.y + vy * SPEED * dt;
        if (ny > 34 && ny < WORLD_H - 6 && !collides(pos.x - FEET_W / 2, ny + 16 - FEET_H, FEET_W, FEET_H)) pos.y = ny;
      }

      const el = ceoRef.current;
      if (el) {
        if (moving) {
          stepTimer += dt;
          if (stepTimer > 7) { stepTimer = 0; stepFrame = !stepFrame; el.classList.toggle('walk', stepFrame); }
        } else {
          el.classList.remove('walk');
        }
      }
      applyTransform();

      let best: string | null = null;
      let bestDist = Infinity;
      for (const d of DESKS) {
        const zx = d.x - NEAR_PAD, zy = d.y - NEAR_PAD, zw = d.w + NEAR_PAD * 2, zh = d.h + NEAR_PAD * 2;
        if (pos.x > zx && pos.x < zx + zw && pos.y > zy && pos.y < zy + zh) {
          const dx = pos.x - (d.x + d.w / 2), dy = pos.y - (d.y + d.h / 2);
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) { bestDist = dist; best = d.id; }
        }
      }
      if (best !== nearNow) { nearNow = best; setNearId(best); }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', resetKeys);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ceoRef]);

  return { nearId, press, release };
}
