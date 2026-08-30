/**
 * Jukebox model + persistence. The playlist lives in localStorage so each CEO's picks survive
 * reloads on their own device; clearing it (Reset) brings back the single default track. Nothing
 * here talks to the harness — it's a bit of floor ambience.
 */

/** The track every fresh floor starts with. Overridable locally; restored on Reset. */
export const DEFAULT_URL = 'https://youtu.be/8UVNT4wvIGY?si=qXoHZD4pDpbvLc2d';

const KEY = 'oos.jukebox.v1';

export interface Track {
  id: string;
  url: string;
  /** The YouTube video id used for playback + thumbnail. */
  videoId: string;
}

/** A YouTube video id is exactly 11 URL-safe chars. One validator for every code path. */
const VIDEO_ID = /^[\w-]{11}$/;

/**
 * Pull a YouTube video id from the common URL shapes (youtu.be, watch, embed, shorts, live), or a
 * bare id. The extracted candidate is validated the same way as a bare id, so a malformed link like
 * `youtu.be/not-an-id` is rejected rather than stored as an unplayable track.
 */
export function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (VIDEO_ID.test(s)) return s; // already a bare id
  let candidate: string | null = null;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      candidate = u.pathname.slice(1).split('/')[0] || null;
    } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (u.pathname === '/watch') {
        candidate = u.searchParams.get('v');
      } else {
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') candidate = parts[1] ?? null;
      }
    }
  } catch {
    return null;
  }
  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}

function newId(seed: string): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${seed}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Build a Track from a pasted link, or null if it isn't a recognisable YouTube URL. */
export function makeTrack(url: string): Track | null {
  const videoId = parseVideoId(url);
  if (!videoId) return null;
  return { id: newId(videoId), url: url.trim(), videoId };
}

export function defaultTracks(): Track[] {
  const t = makeTrack(DEFAULT_URL);
  return t ? [t] : [];
}

export function loadTracks(): Track[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return defaultTracks(); // never saved → seed the default track
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaultTracks(); // malformed → seed the default track
    // A valid array (including a deliberately emptied one) is the CEO's playlist — keep it as-is.
    return parsed.filter(
      (t): t is Track =>
        !!t && typeof t === 'object' && typeof (t as Track).id === 'string' &&
        typeof (t as Track).url === 'string' && typeof (t as Track).videoId === 'string',
    );
  } catch {
    return defaultTracks();
  }
}

export function saveTracks(tracks: Track[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(tracks));
  } catch {
    /* private mode / quota — ambience isn't worth surfacing an error */
  }
}

export function clearTracks(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
