interface Event {
  t: string;
  ev: string;
  msg: string;
  gold?: boolean;
}

// Placeholder event feed for the world slice; wired to the live TrueForge stream in a later PR.
const EVENTS: Event[] = [
  { t: '08:06', ev: 'turn.created', msg: 'Operations Manager opened OP-4471' },
  { t: '08:06', ev: 'thread.created', msg: 'routed to Market Research → enrich ACME' },
  { t: '08:07', ev: 'sandbox.exec', msg: 'Data Analyst ran usage_anomaly.py → −63% WoW' },
  { t: '08:07', ev: 'tool.response', msg: 'Incident Response grafana.query → no active incident' },
  { t: '08:07', ev: 'model.message', msg: 'Operations Manager drafted retention plan · 3 actions' },
];

/** The bottom comms feed — a scrolling render of harness events. */
export function Ticker() {
  return (
    <div className="ticker">
      <div className="lead">EVENT&nbsp;STREAM</div>
      <div className="twrap">
        <div className="tmove">
          {EVENTS.map((e, i) => (
            <span key={i} className={`e${e.gold ? ' gold' : ''}`}>
              <b>{e.t} {e.ev}</b> · {e.msg}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
