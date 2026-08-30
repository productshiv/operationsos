import { useCallback, useEffect, useState } from 'react';
import {
  addCatalogConnector,
  authorizeConnector,
  createConnector,
  disconnectConnector,
  listCatalog,
  listConnectors,
  type CatalogConnector,
  type Connector,
  type CreateConnectorInput,
} from '../lib/connectors';

export interface ConnectorsState {
  loading: boolean;
  /** True when the harness could not be reached at all. */
  offline: boolean;
  connectors: Connector[];
}

/** Per-connector state while the CEO is authorising or disconnecting it. */
export type ConnectState = 'idle' | 'authorizing' | 'disconnecting' | 'error';

/** State while the CEO is registering a new connector. */
export type AddState = 'idle' | 'saving' | 'error';

/**
 * Loads the harness's MCP connectors and runs a real authorize flow.
 *
 * The OAuth tab must be opened by the click itself (a tab opened after an await is killed by popup
 * blockers), so the caller opens a blank tab synchronously and hands it in; we point it at the
 * authorization URL once the harness returns one. Because `authorize` only yields that URL — it
 * does not wait for the user to finish — we re-list when the user returns to the app (window focus)
 * rather than immediately, and surface per-connector errors instead of dropping them.
 */
export function useConnectors() {
  const [state, setState] = useState<ConnectorsState>({ loading: true, offline: false, connectors: [] });
  const [connectState, setConnectState] = useState<Record<string, ConnectState>>({});
  const [addState, setAddState] = useState<AddState>('idle');
  const [catalog, setCatalog] = useState<CatalogConnector[]>([]);
  // Per-catalog-connector add state, keyed by name so overlapping adds don't clobber one another
  // and each tile can show its own spinner / retryable error.
  const [catalogState, setCatalogState] = useState<Record<string, 'saving' | 'error'>>({});

  const refresh = useCallback(async () => {
    try {
      const connectors = await listConnectors();
      setState({ loading: false, offline: false, connectors });
    } catch {
      setState({ loading: false, offline: true, connectors: [] });
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      setCatalog(await listCatalog());
    } catch {
      setCatalog([]); // catalog is a nicety; its failure must not break manual add
    }
  }, []);

  useEffect(() => {
    void refresh();
    void loadCatalog();
  }, [refresh, loadCatalog]);

  // The user authorises in another tab; refresh when they come back so a completed connect shows.
  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const connect = useCallback(
    async (name: string, popup: Window | null) => {
      setConnectState((s) => ({ ...s, [name]: 'authorizing' }));
      try {
        const { authorizationUrl } = await authorizeConnector(name);
        if (authorizationUrl) {
          if (popup) popup.location.href = authorizationUrl;
          else window.open(authorizationUrl, '_blank'); // fallback if the pre-opened tab was blocked
          setConnectState((s) => ({ ...s, [name]: 'idle' }));
        } else {
          // No auth needed — nothing to open.
          popup?.close();
          setConnectState((s) => ({ ...s, [name]: 'idle' }));
        }
        await refresh();
      } catch {
        popup?.close();
        setConnectState((s) => ({ ...s, [name]: 'error' }));
      }
    },
    [refresh],
  );

  const disconnect = useCallback(
    async (name: string) => {
      setConnectState((s) => ({ ...s, [name]: 'disconnecting' }));
      try {
        await disconnectConnector(name);
        await refresh();
        setConnectState((s) => ({ ...s, [name]: 'idle' }));
      } catch {
        setConnectState((s) => ({ ...s, [name]: 'error' }));
      }
    },
    [refresh],
  );

  const add = useCallback(
    async (input: CreateConnectorInput): Promise<boolean> => {
      setAddState('saving');
      try {
        await createConnector(input);
        await refresh();
        setAddState('idle');
        return true;
      } catch {
        setAddState('error');
        return false;
      }
    },
    [refresh],
  );

  const addFromCatalog = useCallback(
    async (entry: CatalogConnector, headers?: Record<string, string>): Promise<boolean> => {
      // Functional updates so simultaneous adds only touch their own key.
      setCatalogState((s) => ({ ...s, [entry.name]: 'saving' }));
      try {
        await addCatalogConnector(entry, headers);
        await refresh();
        setCatalogState((s) => {
          const next = { ...s };
          delete next[entry.name];
          return next;
        });
        return true;
      } catch {
        setCatalogState((s) => ({ ...s, [entry.name]: 'error' }));
        return false;
      }
    },
    [refresh],
  );

  return {
    ...state,
    connectState,
    addState,
    catalog,
    catalogState,
    refresh,
    connect,
    disconnect,
    add,
    addFromCatalog,
  };
}
