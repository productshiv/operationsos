import { TrueForge } from '@truefoundry/trueforge-sdk';

/** Where the harness actually runs — shown in the UI, and the default in production. */
export const TRUEFORGE_BASE_URL =
  import.meta.env.VITE_TRUEFORGE_BASE_URL ?? 'http://localhost:8790';

/**
 * URL the SDK actually calls. In dev the browser can't reach the harness directly (CORS), so we
 * route through Vite's same-origin `/tf` proxy (see vite.config.ts). An explicit
 * VITE_TRUEFORGE_BASE_URL (e.g. a harness that already allows this origin) is used as-is.
 */
const CLIENT_BASE_URL =
  import.meta.env.VITE_TRUEFORGE_BASE_URL ??
  (import.meta.env.DEV && typeof window !== 'undefined'
    ? new URL('/tf', window.location.origin).toString()
    : 'http://localhost:8790');

/** Main client. Turns can stream for a long time, so the timeout is generous. */
export const trueforge = new TrueForge({
  baseUrl: CLIENT_BASE_URL,
  timeoutInSeconds: 600,
});

/**
 * Client for quick control-plane calls (listing/authorising connectors). These are not streaming
 * turns, so they get a bounded timeout instead of the main client's 600s — an unresponsive harness
 * fails fast rather than hanging the setup.
 */
export const trueforgeControl = new TrueForge({
  baseUrl: CLIENT_BASE_URL,
  timeoutInSeconds: 20,
});

/**
 * Separate client for health probes with a short timeout. Reusing the main client would make a
 * hung request pin the UI on "connecting" for the full ten-minute streaming timeout before it
 * could report "offline".
 */
const probeClient = new TrueForge({
  baseUrl: CLIENT_BASE_URL,
  timeoutInSeconds: 5,
});

export type ConnectionState = 'connecting' | 'online' | 'offline';

/**
 * Probe the harness so the UI can show whether it is reachable. Listing sessions is a cheap,
 * always-available call; any failure (harness down, CORS, network, timeout) reads as offline.
 */
export async function checkConnection(): Promise<ConnectionState> {
  try {
    await probeClient.sessions.list();
    return 'online';
  } catch {
    return 'offline';
  }
}
