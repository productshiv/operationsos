import { useEffect } from 'react';
import type { Desk } from './desks';
import { AGENTS } from '../lib/agents';
import { AgentChat } from '../agents/AgentChat';
import { callEveryone, endParty, useParty } from '../state/party';
import type { useJukebox } from '../state/useJukebox';

/**
 * The window that opens when you interact with a desk. Live agents (those with a config) get a
 * real chat; the rest are placeholder shells until their agent lands.
 */
export function DeskWindow({
  desk,
  jira,
  agentModel,
  jukebox,
  onClose,
}: {
  desk: Desk;
  /** The live Jira connector name (or null), threaded to the chat for the "Open a ticket" action. */
  jira: string | null | undefined;
  /** The model agents run on (the CEO's chosen default), injected into the agent spec. */
  agentModel: string;
  /** The jukebox — a floor party starts the music, so the bar actually has sound. */
  jukebox: ReturnType<typeof useJukebox>;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const agent = desk.kind === 'agent' ? AGENTS[desk.id] : undefined;
  const title = desk.kind === 'door' ? 'LOCKED' : desk.name || desk.plate;
  const party = useParty();

  return (
    <div className="scrim on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`win${agent ? ' chatwin' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="wtb">
          <button className="cb" aria-label="Close" onClick={onClose} />
          <span className="wt">{title}</span>
        </div>
        <div className="wbody">
          {agent ? (
            <AgentChat agent={agent} jira={jira} agentModel={agentModel} />
          ) : desk.kind === 'hr' ? (
            <div className="hrcall">
              <p>
                <b>HR room.</b>{' '}
                {party.phase === 'off'
                  ? 'Call everyone over for a floor party — the team downs tools and heads to the dance floor.'
                  : party.phase === 'gathering'
                    ? 'Calling everyone over…'
                    : 'The bar is open. Music’s from your jukebox playlist.'}
              </p>
              <div className="fixrow">
                {party.phase === 'off' ? (
                  <button
                    className="btn go"
                    onClick={() => {
                      callEveryone();
                      // Start the music here, inside the click — browsers only allow audio to start
                      // from a user gesture, so kicking it off later (when everyone arrives) would be
                      // blocked. `toggle` also selects the first track if none is current yet.
                      if (!jukebox.playing) jukebox.toggle();
                      onClose();
                    }}
                  >
                    🎉 Call everyone
                  </button>
                ) : (
                  <button className="btn" onClick={() => { endParty(); onClose(); }}>
                    Back to work
                  </button>
                )}
              </div>
            </div>
          ) : desk.kind === 'door' ? (
            <p>
              <b>{desk.plate.split(' ')[0]}</b> comes online in a later update. The desk is wired — the
              agent isn’t hired yet.
            </p>
          ) : (
            <p>
              <b>{desk.plate}</b> — this agent’s desk view arrives in a later update.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
