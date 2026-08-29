import { useEffect, useState } from 'react';
import { MenuBar } from './components/MenuBar';
import { Ticker } from './components/Ticker';
import { Office } from './world/Office';
import { checkConnection, type ConnectionState } from './lib/trueforge';
import './ui.css';

export default function App() {
  const [conn, setConn] = useState<ConnectionState>('connecting');

  useEffect(() => {
    let alive = true;
    checkConnection().then((state) => {
      if (alive) setConn(state);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="app">
      <MenuBar conn={conn} />
      <Office />
      <Ticker />
    </div>
  );
}
