import { useSyncExternalStore } from 'react';

/**
 * What is waiting for a human in the business right now — open complaints and live error bursts.
 *
 * The floor has no database of its own (only the agents reach Supabase, over MCP), so it can't know
 * that complaints are piling up. The business's own feed service does, and publishes it on `/stats`;
 * this polls that and shares one result with every desk.
 *
 * If the feed isn't reachable — not deployed, or the proxy isn't configured — this stays null and
 * the desks simply show no inbound badge, rather than breaking.
 */
export interface BusinessStats {
  openComplaints: number;
  highSeverityComplaints: number;
  errorsLast24h: number;
  bursts: Array<{ what: string; count: number }>;
}

/** Same-origin `/feed` by default (proxied like `/tf`); override for a directly-reachable feed. */
const FEED_URL = (import.meta.env.VITE_FEED_URL ?? '/feed').replace(/\/+$/, '');
const POLL_MS = 30000;

let stats: BusinessStats | null = null;
const subscribers = new Set<() => void>();
let started = false;

async function refresh() {
  try {
    const res = await fetch(`${FEED_URL}/stats`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(String(res.status));
    const s = (await res.json()) as Partial<BusinessStats>;
    stats = {
      openComplaints: Number(s.openComplaints ?? 0),
      highSeverityComplaints: Number(s.highSeverityComplaints ?? 0),
      errorsLast24h: Number(s.errorsLast24h ?? 0),
      // Validate each entry: `inboundFor` reads bursts[0].what, so an array of nulls would throw
      // and take the whole floor down over a malformed (but successful) response.
      // Validate BOTH fields: the label renders `what` and `count`, so a half-formed entry would
      // otherwise put "undefined" on a desk badge tooltip.
      bursts: Array.isArray(s.bursts)
        ? s.bursts.filter((b): b is { what: string; count: number } => {
            if (!b || typeof b !== 'object') return false;
            const { what, count } = b as { what?: unknown; count?: unknown };
            return typeof what === 'string' && typeof count === 'number' && Number.isFinite(count);
          })
        : [],
    };
  } catch {
    stats = null; // feed unreachable — show nothing rather than a stale or wrong number
  }
  subscribers.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  if (!started) {
    started = true;
    void refresh();
    setInterval(() => void refresh(), POLL_MS);
  }
  return () => subscribers.delete(fn);
}

export function useBusinessStats(): BusinessStats | null {
  return useSyncExternalStore(subscribe, () => stats, () => null);
}

/**
 * The inbound work waiting at a given desk: complaints for the Support Lead, live error bursts for
 * Incident Response. Everyone else has nothing arriving on its own.
 */
export function inboundFor(deskId: string, s: BusinessStats | null): { count: number; label: string } | null {
  if (!s) return null;
  if (deskId === 'medic' && s.openComplaints > 0) {
    const high = s.highSeverityComplaints;
    return {
      count: s.openComplaints,
      label: `${s.openComplaints} open complaint${s.openComplaints === 1 ? '' : 's'}${high ? ` · ${high} high severity` : ''}`,
    };
  }
  if (deskId === 'watch' && s.bursts.length > 0) {
    return {
      count: s.bursts.length,
      label: `${s.bursts.length} error burst${s.bursts.length === 1 ? '' : 's'} in 24h — worst: ${s.bursts[0].what} (${s.bursts[0].count})`,
    };
  }
  return null;
}
