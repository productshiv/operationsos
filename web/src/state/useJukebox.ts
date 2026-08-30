import { useCallback, useEffect, useState } from 'react';
import {
  clearTracks,
  defaultTracks,
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

  // Keep a valid current selection: fall back to the first track when there's none or it vanished.
  useEffect(() => {
    setCurrentId((cur) => (cur && tracks.some((t) => t.id === cur) ? cur : tracks[0]?.id ?? null));
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
