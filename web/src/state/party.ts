import { useSyncExternalStore } from 'react';
import { resetPresence } from './presence';

/**
 * Friday-at-the-office mode. The CEO calls everyone from the HR room; the agents down tools and walk
 * to the dance floor, and once they've all arrived the office turns into a pixelated bar — TV showing
 * the jukebox track, agents dancing.
 *
 * - `off`      — normal working floor.
 * - `gathering` — everyone summoned, walking to the floor.
 * - `party`    — all arrived: the bar is on.
 */
export type PartyPhase = 'off' | 'gathering' | 'party';

interface PartyState {
  phase: PartyPhase;
  /** Agent ids that have reached the dance floor. */
  arrived: string[];
}

let state: PartyState = { phase: 'off', arrived: [] };
const subscribers = new Set<() => void>();

function commit(next: PartyState) {
  state = next;
  subscribers.forEach((fn) => fn());
}
const subscribe = (fn: () => void) => {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
};

/** Call everyone over — agents start heading to the dance floor. */
export function callEveryone() {
  if (state.phase !== 'off') return;
  commit({ phase: 'gathering', arrived: [] });
}

/** An agent reached the floor; when every expected agent is in, the bar opens. */
export function markArrived(agentId: string, expected: number) {
  if (state.phase !== 'gathering' || state.arrived.includes(agentId)) return;
  const arrived = [...state.arrived, agentId];
  commit({ phase: arrived.length >= expected ? 'party' : 'gathering', arrived });
}

/**
 * Back to work. Everyone is standing on the dance floor, so reset ambient presence too — otherwise an
 * agent who happened to be `out` before the party would still read as away when AgentRoamers remounts
 * and would immediately start another desk-to-waypoint trip instead of returning to work.
 */
export function endParty() {
  resetPresence();
  commit({ phase: 'off', arrived: [] });
}

export function useParty(): PartyState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
