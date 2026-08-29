import { MenuBar } from './components/MenuBar';
import { Ticker } from './components/Ticker';
import { Office } from './world/Office';
import { useHarnessStatus } from './lib/useHarnessStatus';
import './ui.css';

export default function App() {
  const conn = useHarnessStatus();

  return (
    <div className="app">
      <MenuBar conn={conn} />
      <Office />
      <Ticker />
    </div>
  );
}
