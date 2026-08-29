import { useEffect, useState } from 'react';
import { checkConnection, type ConnectionState } from './trueforge';

/**
 * Live harness connection status. Probes on mount and then on an interval so the header reflects
 * the harness starting up or dropping out, and cleans up on unmount. A one-shot check would go
 * stale the moment connectivity changed.
 */
export function useHarnessStatus(intervalMs = 15000): ConnectionState {
  const [conn, setConn] = useState<ConnectionState>('connecting');

  useEffect(() => {
    let alive = true;
    const run = () => {
      checkConnection().then((state) => {
        if (alive) setConn(state);
      });
    };
    run();
    const id = setInterval(run, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return conn;
}
