import { useSyncExternalStore } from 'react';

/**
 * Where each agent is right now: `in` (at their desk) or `out` (stepped away — grabbing a coffee).
 * A tiny module store so the desk (which shows the empty chair) and the roaming avatar stay in sync.
 */
export type Presence = 'in' | 'out';

let map: Record<string, Presence> = {};
const subscribers = new Set<() => void>();

export function setPresence(agentId: string, p: Presence) {
  if ((map[agentId] ?? 'in') === p) return;
  map = { ...map, [agentId]: p };
  subscribers.forEach((fn) => fn());
}

/** Everyone back at their desks (used when a floor party ends — they're all on the dance floor). */
export function resetPresence() {
  if (Object.keys(map).length === 0) return;
  map = {};
  subscribers.forEach((fn) => fn());
}

const subscribe = (fn: () => void) => {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
};

/** Presence for one agent (defaults to `in`). */
export function usePresence(agentId: string): Presence {
  return useSyncExternalStore(subscribe, () => map[agentId] ?? 'in');
}
