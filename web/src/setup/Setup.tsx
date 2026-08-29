import { useEffect } from 'react';
import { useConnectors } from '../state/useConnectors';
import { TRUEFORGE_BASE_URL } from '../lib/trueforge';
import type { Connector } from '../lib/connectors';

/**
 * First-run / connect-tools window. Lists the MCP connectors configured in the harness and runs
 * the real authorize flow. Agents can only act once their tools are connected — so this is where
 * the harness's MCP layer becomes visible.
 */
export function Setup({ onClose }: { onClose: () => void }) {
  const { loading, offline, connectors, refresh, connect } = useConnectors();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const authed = connectors.filter((c) => c.status !== 'auth_required').length;

  return (
    <div className="scrim on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="win setup" role="dialog" aria-modal="true" aria-label="Setup">
        <div className="wtb">
          <button className="cb" aria-label="Close" onClick={onClose} />
          <span className="wt">OperationsOS · Setup</span>
        </div>

        <div className="wbody setup-body">
          <div className="setup-head">
            <span className="chi setup-title">Connect your tools.</span>
            <p className="dim">
              Your agents can <b>talk</b> without them — but they can’t <b>act</b>. Each tool is a live
              MCP connector on the harness.
            </p>
          </div>

          {loading && <p className="dim">Scanning the harness at {TRUEFORGE_BASE_URL}…</p>}

          {!loading && offline && (
            <div className="setup-note">
              <p><b>Harness not reachable</b> at {TRUEFORGE_BASE_URL}.</p>
              <p className="dim">Start it with <code>npx @truefoundry/trueforge@latest</code>, then refresh.</p>
            </div>
          )}

          {!loading && !offline && connectors.length === 0 && (
            <div className="setup-note">
              <p><b>No MCP connectors configured yet.</b></p>
              <p className="dim">Add one in TrueForge → Settings → Connectors, then refresh.</p>
            </div>
          )}

          {!loading && !offline && connectors.length > 0 && (
            <>
              <div className="prog chi">{authed} / {connectors.length} connected</div>
              <div className="conns">
                {connectors.map((c) => (
                  <ConnectorRow key={c.name} connector={c} onConnect={() => connect(c.name)} />
                ))}
              </div>
            </>
          )}

          <div className="setup-foot">
            <button className="btn" onClick={() => void refresh()}>Refresh</button>
            <button className="btn primary" onClick={onClose}>Enter the floor ▸</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectorRow({ connector, onConnect }: { connector: Connector; onConnect: () => void }) {
  return (
    <div className="conn">
      <div className="conn-id">
        <div className="conn-name">{connector.name}</div>
        <div className="conn-url dim">{connector.url}</div>
      </div>
      {connector.status === 'authenticated' && <span className="conn-ok">✓ connected</span>}
      {connector.status === 'not_required' && <span className="conn-ok dim">ready</span>}
      {connector.status === 'auth_required' && (
        <button className="btn" onClick={onConnect}>Connect</button>
      )}
    </div>
  );
}
