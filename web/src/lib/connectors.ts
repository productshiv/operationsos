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
