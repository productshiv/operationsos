import { useEffect, useRef, useState } from 'react';
import { useJukebox } from '../state/useJukebox';

/**
 * The floor jukebox: a small 1-bit player in the centre of the office, a modal to manage the
 * playlist (paste YouTube links, saved per device), and an offscreen YouTube iframe that is the
 * actual audio engine — kept mounted so playback survives closing the modal.
 */
export function MusicPlayer() {
  const jb = useJukebox();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Only mount the audio engine once the CEO has pressed play — no YouTube load on a cold floor.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (jb.playing) setArmed(true);
  }, [jb.playing]);

  // Drive play/pause through the YouTube IFrame API over postMessage (no external script needed).
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !jb.current) return;
    const func = jb.playing ? 'playVideo' : 'pauseVideo';
    // Give the player a beat to come up after a src (track) change before commanding it.
    const t = setTimeout(() => {
      win.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
    }, 350);
    return () => clearTimeout(t);
  }, [jb.playing, jb.current]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const src = jb.current
    ? `https://www.youtube.com/embed/${jb.current.videoId}?enablejsapi=1&autoplay=1&playsinline=1&rel=0&origin=${encodeURIComponent(origin)}`
    : '';

  return (
    <>
      {armed && jb.current && (
        <iframe
          ref={iframeRef}
          className="jukebox-engine"
          src={src}
          title="Jukebox audio"
          allow="autoplay; encrypted-media"
        />
      )}

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
