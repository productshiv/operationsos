import { useEffect, useRef, useState } from 'react';
import { useJukebox } from '../state/useJukebox';

/* ------- Minimal typings for the bits of the YouTube IFrame API we drive ------- */
interface YTPlayer {
  loadVideoById(id: string): void;
  cueVideoById(id: string): void;
  playVideo(): void;
  pauseVideo(): void;
  getVideoData?: () => { video_id?: string };
  destroy(): void;
}
interface YTNamespace {
  Player: new (el: Element, opts: unknown) => YTPlayer;
  PlayerState: { ENDED: number };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Load the IFrame API script once; resolve when `window.YT` is ready. */
let apiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return apiPromise;
}

/**
 * The floor jukebox: a small 1-bit player in the centre of the office, a modal to manage the
 * playlist (paste YouTube links, saved per device), and an offscreen YouTube player that is the
 * actual audio engine. It uses the official IFrame API so commands wait for real player readiness
 * (no fixed-delay races), a paused load is cued rather than autoplayed, and a finished track
 * advances the playlist.
 */
export function MusicPlayer() {
  const jb = useJukebox();
  // Stable handle to the latest hook value for use inside the player's event callbacks.
  const jbRef = useRef(jb);
  jbRef.current = jb;

  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);

  // Don't touch YouTube on a cold floor — build the engine the first time the CEO presses play.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (jb.playing) setArmed(true);
  }, [jb.playing]);

  useEffect(() => {
    if (!armed) return;
    let cancelled = false;
    void loadYouTubeApi().then(() => {
      if (cancelled || !hostRef.current || playerRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(hostRef.current, {
        width: '320',
        height: '180',
        videoId: jbRef.current.current?.videoId,
        playerVars: { playsinline: 1, rel: 0, autoplay: 0 },
        events: {
          onReady: () => { if (!cancelled) setReady(true); },
          onStateChange: (e: { data: number }) => {
            if (e.data === window.YT?.PlayerState.ENDED) jbRef.current.next();
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try { playerRef.current?.destroy(); } catch { /* already gone */ }
      playerRef.current = null;
      setReady(false);
    };
  }, [armed]);

  const videoId = jb.current?.videoId;

  // Load the current track once the player is ready. Cue (no autoplay) when paused, so switching
  // tracks or resetting while paused never starts sound on its own.
  useEffect(() => {
    const p = playerRef.current;
    if (!ready || !p || !videoId) return;
    if (p.getVideoData?.().video_id === videoId) return; // already the loaded track
    if (jb.playing) p.loadVideoById(videoId);
    else p.cueVideoById(videoId);
  }, [ready, videoId, jb.playing]);

  // Reflect play/pause on the ready player.
  useEffect(() => {
    const p = playerRef.current;
    if (!ready || !p || !videoId) return;
    if (jb.playing) p.playVideo();
    else p.pauseVideo();
  }, [ready, jb.playing, videoId]);

  return (
    <>
      {armed && <div ref={hostRef} className="jukebox-engine" />}

      <div className="jukebox">
        <button
          className="jb-toggle"
          onClick={jb.toggle}
          disabled={jb.tracks.length === 0}
          aria-label={jb.playing ? 'Pause' : 'Play'}
        >
          {jb.playing ? '❚❚' : '▶'}
        </button>
        <button className="jb-open" onClick={() => jb.setOpen(true)} aria-label="Open jukebox">
          <span className={`jb-eq${jb.playing ? ' on' : ''}`} aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="jb-label">{jb.current ? jb.current.videoId : 'add music'}</span>
        </button>
      </div>

      {jb.open && <JukeboxModal jb={jb} onClose={() => jb.setOpen(false)} />}
    </>
  );
}

function JukeboxModal({ jb, onClose }: { jb: ReturnType<typeof useJukebox>; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = () => {
    if (jb.add(url)) {
      setUrl('');
      setErr(false);
    } else {
      setErr(true);
    }
  };

  return (
    <div className="scrim on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="win jukebox-win" role="dialog" aria-modal="true" aria-label="Jukebox">
        <div className="wtb">
          <button className="cb" aria-label="Close" onClick={onClose} />
          <span className="wt">OperationsOS · Jukebox</span>
        </div>

        <div className="wbody jukebox-body">
          {jb.tracks.length === 0 ? (
            <p className="dim">No tracks — paste a YouTube link below.</p>
          ) : (
            <div className="jb-list">
              {jb.tracks.map((t) => {
                const cur = t.id === jb.currentId;
                return (
                  <div className={`jb-row${cur ? ' cur' : ''}`} key={t.id}>
                    <img className="jb-thumb" src={`https://i.ytimg.com/vi/${t.videoId}/default.jpg`} alt="" />
                    <button
                      className="jb-play"
                      onClick={() => (cur ? jb.toggle() : jb.play(t.id))}
                      aria-label={cur && jb.playing ? 'Pause' : 'Play'}
                    >
                      {cur && jb.playing ? '❚❚' : '▶'}
                    </button>
                    <span className="jb-vid">{t.videoId}</span>
                    <button className="jb-x" onClick={() => jb.remove(t.id)} aria-label="Remove">×</button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="jb-add">
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setErr(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="paste a YouTube link…"
            />
            <button className="btn" onClick={submit} disabled={!url.trim()}>Add</button>
          </div>
          {err && <div className="conn-err">Not a YouTube link.</div>}

          <div className="jb-foot">
            <span className="dim">Saved on this device.</span>
            <button className="btn" onClick={jb.reset}>Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}
