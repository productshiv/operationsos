import { useEffect, type RefObject } from 'react';
import { WORLD_W, WORLD_H } from './desks';

/**
 * Scales the fixed-size world to fit (contain) its viewport and centres it, recomputing on
 * resize. All world coordinates stay in world units; only this transform changes with size.
 */
export function useCamera(
  viewportRef: RefObject<HTMLDivElement | null>,
  worldRef: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const fit = () => {
      const vp = viewportRef.current;
      const world = worldRef.current;
      if (!vp || !world) return;
      const rect = vp.getBoundingClientRect();
      const scale = Math.min(rect.width / WORLD_W, rect.height / WORLD_H);
      const offsetX = Math.max(0, (rect.width - WORLD_W * scale) / 2);
      const offsetY = Math.max(0, (rect.height - WORLD_H * scale) / 2);
      world.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [viewportRef, worldRef]);
}
