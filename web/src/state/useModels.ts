import { useCallback, useEffect, useState } from 'react';
import {
  addWellKnownProvider,
  createCustomProvider,
  listModels,
  listProviderCatalog,
  listProviders,
  type CatalogProvider,
  type CustomProviderInput,
  type ModelRef,
  type ProviderConfig,
  type ProviderModel,
} from '../lib/models';

export interface ModelsState {
  loading: boolean;
  /** True when the harness could not be reached at all. */
  offline: boolean;
  models: ModelRef[];
  /** Providers grouped (for display + editing custom ones). */
  providers: ProviderConfig[];
}

/** State while the CEO is adding a provider. */
export type SaveState = 'idle' | 'saving' | 'error';

/**
 * Loads the harness's configured model providers and adds new ones, so the model can be configured
 * from inside OperationsOS instead of the raw TrueForge admin UI. Mirrors {@link useConnectors}.
 */
export function useModels() {
  const [state, setState] = useState<ModelsState>({ loading: true, offline: false, models: [], providers: [] });
  const [saveState, setSaveState] = useState<SaveState>('idle');
  // Well-known providers the harness catalog offers (openai, anthropic, google, …), for the picker.
  const [catalog, setCatalog] = useState<CatalogProvider[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [models, providers] = await Promise.all([listModels(), listProviders()]);
      setState({ loading: false, offline: false, models, providers });
    } catch {
      setState({ loading: false, offline: true, models: [], providers: [] });
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      setCatalog(await listProviderCatalog());
    } catch {
      setCatalog([]); // the picker is a nicety; its failure must not block manual add
    }
  }, []);

  useEffect(() => {
    void refresh();
    void loadCatalog();
  }, [refresh, loadCatalog]);

  const addProvider = useCallback(
    async (input: CustomProviderInput): Promise<boolean> => {
      setSaveState('saving');
      try {
        await createCustomProvider(input);
        await refresh();
        setSaveState('idle');
        return true;
      } catch {
        setSaveState('error');
        return false;
      }
    },
    [refresh],
  );

  const addWellKnown = useCallback(
    async (type: string, apiKey: string, models: ProviderModel[]): Promise<boolean> => {
      setSaveState('saving');
      try {
        await addWellKnownProvider(type, apiKey, models);
        await refresh();
        setSaveState('idle');
        return true;
      } catch {
        setSaveState('error');
        return false;
      }
    },
    [refresh],
  );

  return { ...state, saveState, catalog, refresh, addProvider, addWellKnown };
}
