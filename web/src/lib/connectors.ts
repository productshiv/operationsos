import { trueforgeControl } from './trueforge';

export type ConnectorStatus = 'authenticated' | 'auth_required' | 'not_required';

export interface Connector {
  name: string;
  url: string;
  status: ConnectorStatus;
  /** Present when the server needs OAuth — open it to authorize. */
  authorizationUrl?: string;
}

/**
 * A dead connector this deployment replaced with a differently-named working one — so the dead
 * original is hidden and the replacement is shown under its name. Matched by name AND url, and only
 * acted on when the replacement is also present, so a different harness with a healthy standalone
 * connector of the same name is left untouched. Drop once TrueForge ships connector deletion (#494).
 */
interface ConnectorReplacement {
  dead: string;
  deadUrl: string;
  replacement: string;
}
const REPLACEMENTS: ConnectorReplacement[] = [
  // `jira`'s OAuth client is pinned to a stale localhost redirect (authorised before
  // PUBLIC_BASE_URL was set) and this harness version can't delete it; `atlassian` is the fresh,
  // working Jira/Confluence connector the agent targets.
  { dead: 'jira', deadUrl: 'https://mcp.atlassian.com/v1/mcp', replacement: 'atlassian' },
];

export interface ConnectorView {
  /** Connector names to hide from the list AND from readiness/attention checks. */
  hidden: Set<string>;
  /** The label to show for a connector — the dead name it stands in for, or its own. */
  label: (name: string) => string;
}

/**
 * Derive the hide/alias view from the connectors actually present. Deployment-specific workarounds
 * live in {@link REPLACEMENTS}; everything else is shown as-is. Call it once and use the result for
 * both rendering and readiness so they never disagree.
 */
export function connectorView(list: Connector[]): ConnectorView {
  const byName = new Map(list.map((c) => [c.name, c] as const));
  const hidden = new Set<string>();
  const alias: Record<string, string> = {};
  for (const r of REPLACEMENTS) {
    const dead = byName.get(r.dead);
    if (dead && dead.url === r.deadUrl && byName.has(r.replacement)) {
      hidden.add(r.dead);
      alias[r.replacement] = r.dead;
    }
  }
  return { hidden, label: (name) => alias[name] ?? name };
}

/** The MCP servers configured in the harness, with their live auth state. */
export async function listConnectors(): Promise<Connector[]> {
  const resp = await trueforgeControl.mcpServers.list();
  return (resp.data ?? []).map((server) => ({
    name: server.name,
    url: server.url,
    status: server.authStatus.status,
    authorizationUrl: server.authStatus.authorizationUrl,
  }));
}

/**
 * Start authorization for a connector. If it needs OAuth, the returned status carries the URL to
 * open in a new tab (matching TrueForge's MCP connector auth flow); the caller re-lists afterwards
 * to pick up the new state.
 */
export async function authorizeConnector(name: string): Promise<{
  status: ConnectorStatus;
  authorizationUrl?: string;
}> {
  const status = await trueforgeControl.mcpServers.authorize(name);
  return { status: status.status, authorizationUrl: status.authorizationUrl };
}

/**
 * Disconnect a connector — revoke its stored OAuth token so it returns to `auth_required` and can
 * be re-authorised (e.g. to switch accounts). A no-op for header / no-auth servers. Note this keeps
 * the connector's dynamically-registered OAuth client, so it re-authorises against the same
 * redirect; it does not re-register that client.
 */
export async function disconnectConnector(name: string): Promise<void> {
  await trueforgeControl.mcpServers.deleteAuthorization(name);
}

/** How a new connector authenticates. `oauth` runs TrueForge's DCR flow after creation. */
export type ConnectorAuthKind = 'none' | 'header' | 'oauth';

export interface CreateConnectorInput {
  name: string;
  url: string;
  description?: string;
  authKind: ConnectorAuthKind;
  /** For `header` auth — the header name (e.g. `Authorization`) and its secret value. */
  headerName?: string;
  headerValue?: string;
}

/**
 * Register a new remote MCP connector on the harness. Header secrets are stored server-side
 * (redacted in every read-back). OAuth connectors are created here and then authorised through the
 * existing {@link authorizeConnector} browser flow.
 */
export async function createConnector(input: CreateConnectorInput): Promise<void> {
  const auth =
    input.authKind === 'header'
      ? { type: 'header' as const, headers: { [input.headerName || 'Authorization']: input.headerValue ?? '' } }
      : input.authKind === 'oauth'
        ? { type: 'dcr' as const }
        : undefined;

  await trueforgeControl.settings.mcpServers.create({
    manifest: {
      type: 'remote',
      name: input.name,
      description: input.description ?? '',
      url: input.url,
      ...(auth ? { auth } : {}),
    },
  });
}

/** How a catalog connector authenticates. `dcr` runs the OAuth flow after it's added. */
export type CatalogAuthType = 'none' | 'header' | 'dcr';

/** A known MCP server from the harness catalog — everything needed to add it in one click. */
export interface CatalogConnector {
  name: string;
  description: string;
  url: string;
  authType: CatalogAuthType;
  /** For `header` auth: header name(s) mapped to a template value (e.g. `Bearer YOUR_TOKEN`). */
  headerTemplate?: Record<string, string>;
  /** Logo asset URL, for the tile. */
  logo?: string;
}

/** The harness catalog of well-known MCP servers (TrueForge's one-click connector list). */
export async function listCatalog(): Promise<CatalogConnector[]> {
  const resp = await trueforgeControl.catalogs.mcpServers.list();
  return (resp.data ?? []).map((s) => ({
    name: s.name,
    description: s.description,
    url: s.url,
    authType: s.auth?.type === 'header' ? 'header' : s.auth?.type === 'dcr' ? 'dcr' : 'none',
    headerTemplate: s.auth?.type === 'header' ? s.auth.headers : undefined,
    logo: s.logo,
  }));
}

/**
 * Add a connector straight from the catalog. `none`/`dcr` need no input (dcr is authorised
 * afterwards via {@link authorizeConnector}); `header` connectors take the resolved header values.
 */
export async function addCatalogConnector(
  entry: CatalogConnector,
  headers?: Record<string, string>,
): Promise<void> {
  const auth =
    entry.authType === 'header'
      ? { type: 'header' as const, headers: headers ?? entry.headerTemplate ?? {} }
      : entry.authType === 'dcr'
        ? { type: 'dcr' as const }
        : undefined;

  await trueforgeControl.settings.mcpServers.create({
    manifest: {
      type: 'remote',
      name: entry.name,
      description: entry.description,
      url: entry.url,
      ...(auth ? { auth } : {}),
    },
  });
}
