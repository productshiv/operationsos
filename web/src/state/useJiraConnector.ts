import { useEffect, useState } from 'react';
import { listConnectors } from '../lib/connectors';
import { resolveJiraConnector } from '../lib/agents';

/**
 * Resolve the harness's Jira connector name once — used to inject Jira into agent specs at runtime
 * ({@link buildAgentSpec}) and to gate the "Open a ticket" action. `undefined` while still loading,
 * then the connector name or `null` if the harness has no Jira connector.
 */
export function useJiraConnector(): string | null | undefined {
  const [name, setName] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void listConnectors()
      .then((list) => {
        if (!cancelled) setName(resolveJiraConnector(list));
      })
      .catch(() => {
        if (!cancelled) setName(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return name;
}
