/** A small 1-bit agent, seated and typing at a desk. */
export function AgentSprite() {
  return (
    <svg className="asvg" viewBox="0 0 22 18" width="30" height="24">
      <rect x="8" y="0" width="6" height="5" fill="var(--ink)" />
      <rect x="5" y="5" width="12" height="8" fill="var(--ink)" />
      <rect x="2" y="7" width="3" height="4" fill="var(--ink)" />
      <rect x="17" y="7" width="3" height="4" fill="var(--ink)" />
    </svg>
  );
}
