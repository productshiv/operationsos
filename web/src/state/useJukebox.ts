import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearTracks,
  defaultTracks,
  fetchTitle,
  loadTracks,
  makeTrack,
  saveTracks,
  type Track,
} from '../music/jukebox';

/**
 * Playlist + transport state for the floor jukebox. Tracks persist to localStorage (per device);
 * `playing` is ephemeral. Playback itself is handled by a YouTube iframe in {@link MusicPlayer};
 * this hook only owns which track is current and whether it should be playing.
 */
export function useJukebox() {
  const [tracks, setTracks] = useState<Track[]>(loadTracks);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);

  // Persist every change to the playlist.
  useEffect(() => {
    saveTracks(tracks);
  }, [tracks]);

  // Backfill real titles via oEmbed for any track that lacks one (default, freshly added, or an
  // older stored track). Each id is fetched at most once; failures leave the id showing.
  const titled = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const t of tracks) {
      if (t.title || titled.current.has(t.id)) continue;
      titled.current.add(t.id);
      void fetchTitle(t.videoId).then((title) => {
        if (title) setTracks((ts) => ts.map((x) => (x.id === t.id ? { ...x, title } : x)));
      });
    }
  }, [tracks]);

  // Keep transport state consistent with the playlist: an empty playlist has nothing to play, and
  // otherwise the current selection falls back to the first track when it's unset or was removed.
  useEffect(() => {
    if (tracks.length === 0) {
      setCurrentId(null);
      setPlaying(false);
      return;
    }
    setCurrentId((cur) => (cur && tracks.some((t) => t.id === cur) ? cur : tracks[0].id));
  }, [tracks]);

  const current = tracks.find((t) => t.id === currentId) ?? null;

  const add = useCallback((url: string): boolean => {
    const t = makeTrack(url);
    if (!t) return false;
    setTracks((ts) => [...ts, t]);
    return true;
  }, []);

  const remove = useCallback((id: string) => {
    setTracks((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const play = useCallback((id: string) => {
    setCurrentId(id);
    setPlaying(true);
  }, []);

  /** Toggle the current track, or start the first one if nothing is selected yet. */
  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (currentId) return !p;
      setCurrentId(tracks[0]?.id ?? null);
      return tracks.length > 0;
    });
  }, [currentId, tracks]);

  const next = useCallback(() => {
    if (tracks.length === 0) return;
    const i = tracks.findIndex((t) => t.id === currentId);
    const nx = tracks[(i + 1) % tracks.length];
    setCurrentId(nx.id);
    setPlaying(true);
  }, [tracks, currentId]);

  /** Clear local overrides — the default track comes back. */
  const reset = useCallback(() => {
    clearTracks();
    const d = defaultTracks();
    setTracks(d);
    setCurrentId(d[0]?.id ?? null);
    setPlaying(false);
  }, []);

  return { tracks, current, currentId, playing, open, setOpen, add, remove, play, toggle, next, reset };
}
