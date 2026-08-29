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
