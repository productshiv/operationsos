import { useCallback, useEffect, useState } from 'react';
import { createCustomProvider, listModels, type CustomProviderInput, type ModelRef } from '../lib/models';

export interface ModelsState {
  loading: boolean;
  /** True when the harness could not be reached at all. */
  offline: boolean;
  models: ModelRef[];
}

/** State while the CEO is adding a provider. */
export type SaveState = 'idle' | 'saving' | 'error';

/**
 * Loads the harness's configured model providers and adds new ones, so the model can be configured
 * from inside OperationsOS instead of the raw TrueForge admin UI. Mirrors {@link useConnectors}.
 */
export function useModels() {
  const [state, setState] = useState<ModelsState>({ loading: true, offline: false, models: [] });
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const refresh = useCallback(async () => {
    try {
      const models = await listModels();
      setState({ loading: false, offline: false, models });
    } catch {
      setState({ loading: false, offline: true, models: [] });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  return { ...state, saveState, refresh, addProvider };
}
