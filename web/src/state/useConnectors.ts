import { useCallback, useEffect, useState } from 'react';
import { authorizeConnector, listConnectors, type Connector } from '../lib/connectors';

export interface ConnectorsState {
  loading: boolean;
  /** True when the harness could not be reached at all. */
  offline: boolean;
  connectors: Connector[];
}

/**
 * Loads the harness's MCP connectors and exposes a real authorize flow. `connect` opens the
 * server's OAuth page (when it needs one) and re-lists so the UI reflects the new auth state.
 */
export function useConnectors() {
  const [state, setState] = useState<ConnectorsState>({ loading: true, offline: false, connectors: [] });

  const refresh = useCallback(async () => {
    try {
      const connectors = await listConnectors();
      setState({ loading: false, offline: false, connectors });
    } catch {
      setState({ loading: false, offline: true, connectors: [] });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(
    async (name: string) => {
      const { authorizationUrl } = await authorizeConnector(name);
      if (authorizationUrl) window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
      await refresh();
    },
    [refresh],
  );

  return { ...state, refresh, connect };
}
