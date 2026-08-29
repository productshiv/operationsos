import { TrueForge } from '@truefoundry/trueforge-sdk';

/**
 * Base URL of the harness. Points at the local instance by default; override with
 * VITE_TRUEFORGE_BASE_URL.
 */
export const TRUEFORGE_BASE_URL =
  import.meta.env.VITE_TRUEFORGE_BASE_URL ?? 'http://localhost:8790';

/** Main client. Turns can stream for a long time, so the timeout is generous. */
export const trueforge = new TrueForge({
  baseUrl: TRUEFORGE_BASE_URL,
  timeoutInSeconds: 600,
});

/**
 * Separate client for health probes with a short timeout. Reusing the main client would make a
 * hung request pin the UI on "connecting" for the full ten-minute streaming timeout before it
 * could report "offline".
 */
const probeClient = new TrueForge({
  baseUrl: TRUEFORGE_BASE_URL,
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
