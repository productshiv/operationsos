import { trueforgeControl } from './trueforge';

export type ConnectorStatus = 'authenticated' | 'auth_required' | 'not_required';

export interface Connector {
  name: string;
  url: string;
  status: ConnectorStatus;
  /** Present when the server needs OAuth — open it to authorize. */
  authorizationUrl?: string;
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
