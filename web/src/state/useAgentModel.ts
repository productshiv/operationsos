import { useCallback, useState } from 'react';
import { AGENT_MODEL } from '../lib/agents';

const KEY = 'oos.agentModel.v1';

/**
 * The model agents run on, as `<provider>/<model>`. Defaults to {@link AGENT_MODEL}; the CEO can pick
 * any configured model as the default from the Integrations panel (e.g. to switch off a provider
 * that's out of credits). The choice is a lightweight UI preference saved in this browser and is
 * injected into every agent spec at runtime — so agents' new conversations run on it.
 */
export function useAgentModel() {
  const [model, setModelState] = useState<string>(() => {
    try {
      return localStorage.getItem(KEY) || AGENT_MODEL;
    } catch {
      return AGENT_MODEL;
    }
  });
  const setModel = useCallback((m: string) => {
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* private mode / storage disabled — the in-memory choice still applies for this session */
    }
    setModelState(m);
  }, []);
  return { model, setModel };
}
