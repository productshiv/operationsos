import { TrueForge } from '@truefoundry/trueforge-sdk';

/**
 * Single TrueForge client for the whole app. Points at the local harness by default;
 * override with VITE_TRUEFORGE_BASE_URL. Turns can stream for a long time, so the
 * timeout is generous.
 */
export const TRUEFORGE_BASE_URL =
  import.meta.env.VITE_TRUEFORGE_BASE_URL ?? 'http://localhost:8790';

export const trueforge = new TrueForge({
  baseUrl: TRUEFORGE_BASE_URL,
  timeoutInSeconds: 600,
});

export type ConnectionState = 'connecting' | 'online' | 'offline';

/**
 * Probe the harness so the UI can show whether it is reachable. Listing sessions is a
 * cheap, always-available call; any failure (harness down, CORS, network) reads as offline.
 */
export async function checkConnection(): Promise<ConnectionState> {
  try {
    await trueforge.sessions.list();
    return 'online';
  } catch {
    return 'offline';
  }
}
