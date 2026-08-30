import { useEffect, useState } from 'react';
import { useConnectors, type ConnectState } from '../state/useConnectors';
import { useModels } from '../state/useModels';
import { useAgentModel } from '../state/useAgentModel';
import type { CatalogConnector, Connector, ConnectorAuthKind } from '../lib/connectors';
import type { ModelRef } from '../lib/models';

/**
 * First-run / platform-setup window. Everything an agent needs to run — the model it thinks with
 * and the MCP connectors it acts through — is configured here, natively, instead of the raw
 * TrueForge admin UI. Model and connector state each come from their own hook.
 */
export function Setup({
  connectors,
  models,
  agentModel,
  onClose,
}: {
  connectors: ReturnType<typeof useConnectors>;
  models: ReturnType<typeof useModels>;
  agentModel: ReturnType<typeof useAgentModel>;
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
          </div>

          {harnessDown ? (
            <div className="setup-note">
              <p><b>Harness not reachable.</b></p>
              <p className="dim">Start it, then refresh.</p>
            </div>
          ) : (
            <>
              <ModelsSection models={models} agentModel={agentModel} />
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

function ModelsSection({
  models,
  agentModel,
}: {
  models: ReturnType<typeof useModels>;
  agentModel: ReturnType<typeof useAgentModel>;
}) {
  const [adding, setAdding] = useState(false);

  // Agents run on the chosen default model — a differently named provider doesn't make them runnable.
  const hasAgentModel = models.models.some((m) => `${m.provider}/${m.model}` === agentModel.model);

  return (
    <section className="intg-sec">
      <div className="intg-sec-head">
        <span className="chi intg-sec-title">Models · {models.models.length}</span>
        {!adding && (
          <button className="link-btn" onClick={() => setAdding(true)}>＋ Add provider</button>
        )}
      </div>

      {models.loading && <p className="dim">Loading…</p>}

      {!models.loading && models.offline && (
        <p className="dim">Couldn’t reach model settings — refresh.</p>
      )}

      {!models.loading && !models.offline && (
        <>
          {models.models.length === 0 && !adding && (
            <p className="dim">No model yet — agents can’t run.</p>
          )}

          {models.models.length > 0 && (
            <div className="intg-list">
              {models.models.map((m) => (
                <ModelRow
                  key={`${m.provider}/${m.model}`}
                  model={m}
                  isDefault={`${m.provider}/${m.model}` === agentModel.model}
                  onUse={() => agentModel.setModel(`${m.provider}/${m.model}`)}
                />
              ))}
            </div>
          )}

          {/* The chosen default model isn't configured on the harness — agents can't run on it. */}
          {models.models.length > 0 && !hasAgentModel && !adding && (
            <p className="dim intg-form-note">
              Agents are set to <code>{agentModel.model}</code>, which isn’t configured — add it, or pick
              a listed model as the default.
            </p>
          )}
        </>
      )}

      {adding && <ProviderForm models={models} onDone={() => setAdding(false)} />}
    </section>
  );
}

function ModelRow({
  model,
  isDefault,
  onUse,
}: {
  model: ModelRef;
  isDefault: boolean;
  onUse: () => void;
}) {
  return (
    <div className="conn">
      <div className="conn-id">
        <div className="conn-name">{model.provider}/{model.model}</div>
        <div className="conn-url dim">{model.modelId}</div>
      </div>
      {isDefault ? (
        <span className="conn-ok">✓ agents’ model</span>
      ) : (
        <button className="link-btn" onClick={onUse}>Use for agents</button>
      )}
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
      <Field label="Provider">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="openrouter" />
      </Field>
      <Field label="Base URL">
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://openrouter.ai/api/v1" />
      </Field>
      <Field label="API key">
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-or-…" />
      </Field>
      <div className="form-row">
        <Field label="Model name">
          <input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="minimax-m3" />
        </Field>
        <Field label="Model ID">
          <input value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="minimax/minimax-m1" />
        </Field>
      </div>

      <p className="dim intg-form-note">
        Re-saving with an existing provider name updates it — use this to fix a wrong base URL or model
        ID (e.g. a provider returning 404).
      </p>

      {models.saveState === 'error' && (
        <div className="conn-err">Couldn’t add — check the key and URL.</div>
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
  const [custom, setCustom] = useState(false);
  const { connectors: list, connectState, connect, disconnect, catalog, catalogState, addFromCatalog, hidden, label } = connectors;
  // Hide undeletable dead connectors from the list, but keep them in `configured` so the catalog
  // still won't re-offer them (they do exist on the harness).
  const visible = list.filter((c) => !hidden.has(c.name));
  const authed = visible.filter((c) => c.status !== 'auth_required').length;
  const configured = new Set(list.map((c) => c.name));
  const available = catalog.filter((c) => !configured.has(c.name));

  return (
    <section className="intg-sec">
      <div className="intg-sec-head">
        <span className="chi intg-sec-title">
          Connectors{visible.length > 0 ? ` · ${authed}/${visible.length}` : ''}
        </span>
        {!custom && (
          <button className="link-btn" onClick={() => setCustom(true)}>＋ Custom</button>
        )}
      </div>

      {connectors.loading && <p className="dim">Loading…</p>}

      {!connectors.loading && connectors.offline && (
        <p className="dim">Couldn’t reach connector settings — refresh.</p>
      )}

      {!connectors.loading && !connectors.offline && (
        <>
          {visible.length > 0 && (
            <div className="intg-list">
              {visible.map((c) => (
                <ConnectorRow
                  key={c.name}
                  connector={c}
                  label={label(c.name)}
                  state={connectState[c.name] ?? 'idle'}
                  onConnect={(win) => void connect(c.name, win)}
                  onDisconnect={() => void disconnect(c.name)}
                />
              ))}
            </div>
          )}

          {available.length > 0 && (
            <div className="cat-grid">
              {available.map((entry) => (
                <CatalogTile
                  key={entry.name}
                  entry={entry}
                  state={catalogState[entry.name] ?? 'idle'}
                  onAdd={(headers) => void addFromCatalog(entry, headers)}
                />
              ))}
            </div>
          )}

          {visible.length === 0 && available.length === 0 && !custom && (
            <p className="dim">No connectors — add a custom one.</p>
          )}
        </>
      )}

      {custom && <ConnectorForm connectors={connectors} onDone={() => setCustom(false)} />}
    </section>
  );
}

/**
 * A one-click tile from the connector catalog. `none`/`dcr` add on click; `header` tools reveal a
 * field per required header first (values resolved from the catalog templates). Add failures show a
 * retryable error on the tile.
 */
function CatalogTile({
  entry,
  state,
  onAdd,
}: {
  entry: CatalogConnector;
  state: 'idle' | 'saving' | 'error';
  onAdd: (headers?: Record<string, string>) => void;
}) {
  const headerNames = Object.keys(entry.headerTemplate ?? {});
  const hasHeaders = headerNames.length > 0;
  const [keyOpen, setKeyOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const saving = state === 'saving';
  const badge = entry.authType === 'dcr' ? 'oauth' : entry.authType === 'header' ? 'key' : '';

  const allFilled = headerNames.every((h) => (vals[h] ?? '').trim());
  const submit = () => {
    // Resolve every required header to what the user typed; never keep the template placeholder.
    const headers: Record<string, string> = {};
    for (const h of headerNames) headers[h] = (vals[h] ?? '').trim();
    onAdd(headers);
  };
  const startAdd = () => (hasHeaders ? setKeyOpen(true) : onAdd());

  if (keyOpen) {
    return (
      <div className="cat-tile cat-tile--key">
        <div className="cat-id"><ConnectorLogo entry={entry} /><span className="cat-name">{entry.name}</span></div>
        {headerNames.map((h, i) => (
          <input
            key={h}
            type="password"
            value={vals[h] ?? ''}
            onChange={(e) => setVals((v) => ({ ...v, [h]: e.target.value }))}
            // The catalog template (e.g. "Bearer YOUR_GITHUB_PAT") shows the format as a placeholder;
            // masked prefill would just hide it behind password dots.
            placeholder={entry.headerTemplate?.[h] ?? h}
            autoFocus={i === 0}
          />
        ))}
        {state === 'error' && <div className="conn-err">Couldn’t add — check the key.</div>}
        <div className="cat-key-actions">
          <button className="link-btn" onClick={() => setKeyOpen(false)}>Cancel</button>
          <button className="link-btn" onClick={submit} disabled={!allFilled || saving}>
            {saving ? '…' : 'Add'}
          </button>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="cat-tile cat-tile--error">
        <ConnectorLogo entry={entry} />
        <span className="cat-name">{entry.name}</span>
        <span className="conn-err">couldn’t add</span>
        <button className="link-btn" onClick={startAdd}>Retry</button>
      </div>
    );
  }

  return (
    <button className="cat-tile" disabled={saving} title={entry.description} onClick={startAdd}>
      <ConnectorLogo entry={entry} />
      <span className="cat-name">{entry.name}</span>
      {badge && <span className="cat-badge">{badge}</span>}
      <span className="cat-plus">{saving ? '…' : '＋'}</span>
    </button>
  );
}

/** Catalog logo with a graceful first-letter fallback if the asset fails to load. */
function ConnectorLogo({ entry }: { entry: CatalogConnector }) {
  const [broken, setBroken] = useState(false);
  if (!entry.logo || broken) {
    return <span className="cat-logo cat-logo--fallback">{entry.name[0]?.toUpperCase()}</span>;
  }
  return <img className="cat-logo" src={entry.logo} alt="" onError={() => setBroken(true)} />;
}

function ConnectorRow({
  connector,
  label,
  state,
  onConnect,
  onDisconnect,
}: {
  connector: Connector;
  label: string;
  state: ConnectState;
  onConnect: (popup: Window | null) => void;
  onDisconnect: () => void;
}) {
  // Open the OAuth tab synchronously inside the click so popup blockers don't kill it; the hook
  // navigates it once the authorization URL arrives.
  const handleConnect = () => onConnect(window.open('', '_blank'));
  const busy = state === 'authorizing' || state === 'disconnecting';

  return (
    <div className="conn">
      <div className="conn-id">
        <div className="conn-name">{label}</div>
        <div className="conn-url dim">{connector.url}</div>
        {state === 'error' && (
          <div className="conn-err">Something went wrong — retry.</div>
        )}
      </div>
      {connector.status === 'not_required' && <span className="conn-ok">✓ ready</span>}
      {connector.status === 'authenticated' && (
        <div className="conn-actions">
          <span className="conn-ok">✓ connected</span>
          <button className="link-btn" onClick={onDisconnect} disabled={busy}>
            {state === 'disconnecting' ? '…' : 'Disconnect'}
          </button>
        </div>
      )}
      {connector.status === 'auth_required' && (
        <button className="btn" onClick={handleConnect} disabled={busy}>
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
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="supabase" />
      </Field>
      <Field label="Server URL">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/sse" />
      </Field>
      <Field label="Auth">
        <select value={authKind} onChange={(e) => setAuthKind(e.target.value as ConnectorAuthKind)}>
          <option value="none">None</option>
          <option value="header">API key (header)</option>
          <option value="oauth">OAuth (authorise after)</option>
        </select>
      </Field>

      {authKind === 'header' && (
        <div className="form-row">
          <Field label="Header">
            <input value={headerName} onChange={(e) => setHeaderName(e.target.value)} placeholder="Authorization" />
          </Field>
          <Field label="Value">
            <input type="password" value={headerValue} onChange={(e) => setHeaderValue(e.target.value)} placeholder="Bearer …" />
          </Field>
        </div>
      )}

      {authKind === 'oauth' && (
        <p className="dim intg-form-note">Added as OAuth — hit <b>Connect</b> to authorise.</p>
      )}

      {connectors.addState === 'error' && (
        <div className="conn-err">Couldn’t add — check the URL and auth.</div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
