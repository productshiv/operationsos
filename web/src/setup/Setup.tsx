import { useEffect, useState } from 'react';
import { useConnectors, type ConnectState } from '../state/useConnectors';
import { useModels } from '../state/useModels';
import { TRUEFORGE_BASE_URL } from '../lib/trueforge';
import { AGENT_MODEL } from '../lib/agents';
import type { Connector, ConnectorAuthKind } from '../lib/connectors';
import type { ModelRef } from '../lib/models';

/**
 * First-run / platform-setup window. Everything an agent needs to run — the model it thinks with
 * and the MCP connectors it acts through — is configured here, natively, instead of the raw
 * TrueForge admin UI. Model and connector state each come from their own hook.
 */
export function Setup({
  connectors,
  models,
  onClose,
}: {
  connectors: ReturnType<typeof useConnectors>;
  models: ReturnType<typeof useModels>;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Only a true harness-health failure (both endpoints unreachable) collapses the whole panel.
  // A fault in one endpoint leaves the other section fully usable — each renders its own state.
  const harnessDown = connectors.offline && models.offline;

  const refreshAll = () => {
    void connectors.refresh();
    void models.refresh();
  };

  return (
    <div className="scrim on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="win setup" role="dialog" aria-modal="true" aria-label="Integrations">
        <div className="wtb">
          <button className="cb" aria-label="Close" onClick={onClose} />
          <span className="wt">OperationsOS · Integrations</span>
        </div>

        <div className="wbody setup-body">
          <div className="setup-head">
            <span className="chi setup-title">Set up your platform.</span>
            <p className="dim">
              An agent needs a <b>model</b> to think with and <b>connectors</b> to act through. Wire
              both here — no TrueForge admin UI required.
            </p>
          </div>

          {harnessDown ? (
            <div className="setup-note">
              <p><b>Harness not reachable</b> at {TRUEFORGE_BASE_URL}.</p>
              <p className="dim">Start it with <code>npx @truefoundry/trueforge@latest</code>, then refresh.</p>
            </div>
          ) : (
            <>
              <ModelsSection models={models} />
              <ConnectorsSection connectors={connectors} />
            </>
          )}

          <div className="setup-foot">
            <button className="btn" onClick={refreshAll}>Refresh</button>
            <button className="btn primary" onClick={onClose}>Enter the floor ▸</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- MODELS ------------------------------- */

function ModelsSection({ models }: { models: ReturnType<typeof useModels> }) {
  const [adding, setAdding] = useState(false);

  // Agents run on one specific model — a differently named provider doesn't make them runnable.
  const hasAgentModel = models.models.some((m) => `${m.provider}/${m.model}` === AGENT_MODEL);

  return (
    <section className="intg-sec">
      <div className="intg-sec-head">
        <span className="chi intg-sec-title">Models · {models.models.length}</span>
        {!adding && (
          <button className="link-btn" onClick={() => setAdding(true)}>＋ Add provider</button>
        )}
      </div>

      {models.loading && <p className="dim">Loading models…</p>}

      {!models.loading && models.offline && (
        <div className="setup-note">
          <p><b>Couldn’t reach model settings.</b></p>
          <p className="dim">The harness is up but its model endpoint didn’t respond — refresh to retry.</p>
        </div>
      )}

      {!models.loading && !models.offline && (
        <>
          {models.models.length === 0 && !adding && (
            <div className="setup-note">
              <p><b>No model configured.</b> Agents can’t think until one is.</p>
              <p className="dim">Add an OpenAI-compatible provider (OpenRouter, Together, …).</p>
            </div>
          )}

          {models.models.length > 0 && (
            <div className="intg-list">
              {models.models.map((m) => (
                <ModelRow key={`${m.provider}/${m.model}`} model={m} />
              ))}
            </div>
          )}

          {/* Some model exists, but not the one the agents call — say so plainly. */}
          {models.models.length > 0 && !hasAgentModel && !adding && (
            <p className="dim intg-form-note">
              Agents run on <code>{AGENT_MODEL}</code> — add that exact provider/model to go live.
            </p>
          )}
        </>
      )}

      {adding && <ProviderForm models={models} onDone={() => setAdding(false)} />}
    </section>
  );
}

function ModelRow({ model }: { model: ModelRef }) {
  const isAgentModel = `${model.provider}/${model.model}` === AGENT_MODEL;
  return (
    <div className="conn">
      <div className="conn-id">
        <div className="conn-name">{model.provider}/{model.model}</div>
        <div className="conn-url dim">{model.modelId}</div>
      </div>
      <span className="conn-ok">{isAgentModel ? '✓ agents’ model' : '✓ ready'}</span>
    </div>
  );
}

function ProviderForm({
  models,
  onDone,
}: {
  models: ReturnType<typeof useModels>;
  onDone: () => void;
}) {
  // Prefilled for OpenRouter, the OpenAI-compatible gateway the agents target by default.
  const [name, setName] = useState('openrouter');
  const [baseUrl, setBaseUrl] = useState('https://openrouter.ai/api/v1');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('minimax-m3');
  const [modelId, setModelId] = useState('');

  const ready = name.trim() && baseUrl.trim() && apiKey.trim() && modelName.trim() && modelId.trim();

  const save = async () => {
    const ok = await models.addProvider({
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      modelName: modelName.trim(),
      modelId: modelId.trim(),
    });
    if (ok) onDone();
  };

  return (
    <div className="intg-form">
      <Field label="Provider name" hint="the “provider” half of provider/model">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="openrouter" />
      </Field>
      <Field label="Base URL" hint="OpenAI-compatible endpoint">
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://openrouter.ai/api/v1" />
      </Field>
      <Field label="API key" hint="stored on the harness, redacted on read-back">
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-or-…" />
      </Field>
      <div className="form-row">
        <Field label="Model name" hint="local alias">
          <input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="minimax-m3" />
        </Field>
        <Field label="Model ID" hint="upstream id">
          <input value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="minimax/minimax-m1" />
        </Field>
      </div>

      {models.saveState === 'error' && (
        <div className="conn-err">Couldn’t add the provider — check the key and base URL, then retry.</div>
      )}

      <div className="form-actions">
        <button className="btn" onClick={onDone} disabled={models.saveState === 'saving'}>Cancel</button>
        <button className="btn primary" onClick={() => void save()} disabled={!ready || models.saveState === 'saving'}>
          {models.saveState === 'saving' ? 'Saving…' : 'Add provider'}
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- CONNECTORS ----------------------------- */

function ConnectorsSection({ connectors }: { connectors: ReturnType<typeof useConnectors> }) {
  const [adding, setAdding] = useState(false);
  const { connectors: list, connectState, connect } = connectors;
  const authed = list.filter((c) => c.status !== 'auth_required').length;

  return (
    <section className="intg-sec">
      <div className="intg-sec-head">
        <span className="chi intg-sec-title">
          Connectors{list.length > 0 ? ` · ${authed}/${list.length}` : ''}
        </span>
        {!adding && (
          <button className="link-btn" onClick={() => setAdding(true)}>＋ Add connector</button>
        )}
      </div>

      {connectors.loading && <p className="dim">Loading connectors…</p>}

      {!connectors.loading && connectors.offline && (
        <div className="setup-note">
          <p><b>Couldn’t reach connector settings.</b></p>
          <p className="dim">The harness is up but its connector endpoint didn’t respond — refresh to retry.</p>
        </div>
      )}

      {!connectors.loading && !connectors.offline && (
        <>
          {list.length === 0 && !adding && (
            <div className="setup-note">
              <p><b>No connectors yet.</b> Agents can talk, but not act.</p>
              <p className="dim">Add a remote MCP server (Supabase, Jira, Exa, …).</p>
            </div>
          )}

          {list.length > 0 && (
            <div className="intg-list">
              {list.map((c) => (
                <ConnectorRow
                  key={c.name}
                  connector={c}
                  state={connectState[c.name] ?? 'idle'}
                  onConnect={(win) => void connect(c.name, win)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {adding && <ConnectorForm connectors={connectors} onDone={() => setAdding(false)} />}
    </section>
  );
}

function ConnectorRow({
  connector,
  state,
  onConnect,
}: {
  connector: Connector;
  state: ConnectState;
  onConnect: (popup: Window | null) => void;
}) {
  // Open the OAuth tab synchronously inside the click so popup blockers don't kill it; the hook
  // navigates it once the authorization URL arrives.
  const handleConnect = () => onConnect(window.open('', '_blank'));

  return (
    <div className="conn">
      <div className="conn-id">
        <div className="conn-name">{connector.name}</div>
        <div className="conn-url dim">{connector.url}</div>
        {state === 'error' && (
          <div className="conn-err">Couldn’t authorise — allow pop-ups, then retry.</div>
        )}
      </div>
      {connector.status === 'authenticated' && <span className="conn-ok">✓ connected</span>}
      {connector.status === 'not_required' && <span className="conn-ok">✓ ready</span>}
      {connector.status === 'auth_required' && (
        <button className="btn" onClick={handleConnect} disabled={state === 'authorizing'}>
          {state === 'authorizing' ? 'Authorising…' : state === 'error' ? 'Retry' : 'Connect'}
        </button>
      )}
    </div>
  );
}

function ConnectorForm({
  connectors,
  onDone,
}: {
  connectors: ReturnType<typeof useConnectors>;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [authKind, setAuthKind] = useState<ConnectorAuthKind>('none');
  const [headerName, setHeaderName] = useState('Authorization');
  const [headerValue, setHeaderValue] = useState('');

  const ready =
    name.trim() &&
    url.trim() &&
    (authKind !== 'header' || (headerName.trim() && headerValue.trim()));

  const save = async () => {
    const ok = await connectors.add({
      name: name.trim(),
      url: url.trim(),
      authKind,
      headerName: headerName.trim(),
      headerValue: headerValue.trim(),
    });
    if (ok) onDone();
  };

  return (
    <div className="intg-form">
      <Field label="Name" hint="how agents reference this tool">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="supabase" />
      </Field>
      <Field label="Server URL" hint="remote MCP endpoint">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/sse" />
      </Field>
      <Field label="Auth" hint="how it authenticates">
        <select value={authKind} onChange={(e) => setAuthKind(e.target.value as ConnectorAuthKind)}>
          <option value="none">None</option>
          <option value="header">API key (header)</option>
          <option value="oauth">OAuth (authorise after)</option>
        </select>
      </Field>

      {authKind === 'header' && (
        <div className="form-row">
          <Field label="Header" hint="e.g. Authorization">
            <input value={headerName} onChange={(e) => setHeaderName(e.target.value)} placeholder="Authorization" />
          </Field>
          <Field label="Value" hint="secret, stored on the harness">
            <input type="password" value={headerValue} onChange={(e) => setHeaderValue(e.target.value)} placeholder="Bearer …" />
          </Field>
        </div>
      )}

      {authKind === 'oauth' && (
        <p className="dim intg-form-note">Saved as an OAuth connector — hit <b>Connect</b> on it to authorise.</p>
      )}

      {connectors.addState === 'error' && (
        <div className="conn-err">Couldn’t add the connector — check the URL and auth, then retry.</div>
      )}

      <div className="form-actions">
        <button className="btn" onClick={onDone} disabled={connectors.addState === 'saving'}>Cancel</button>
        <button className="btn primary" onClick={() => void save()} disabled={!ready || connectors.addState === 'saving'}>
          {connectors.addState === 'saving' ? 'Saving…' : 'Add connector'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- shared ------------------------------- */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint dim">{hint}</span>}
    </label>
  );
}
