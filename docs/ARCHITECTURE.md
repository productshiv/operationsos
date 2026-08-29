# OperationsOS — Architecture (living doc)

> Kept in sync with the shareable architecture artifact. Update the **Decision log** whenever we
> make or change a decision.

## 1. The shape

```
┌─────────────────────────────────────────────────────────────────────┐
│  OperationsOS front-end  (React + Vite + TS)  — bespoke, in web/     │
│  • the 1-bit "office" world  • agent chat  • connect-tools setup     │
│  • Inbox / authorisation dossier  • live event-stream ticker         │
└───────────────▲──────────────────────────────────┬──────────────────┘
                │  HTTP API + SSE event stream      │  TS SDK
                │  (@truefoundry/trueforge-sdk)     │  sessions · agents · schedules
┌───────────────┴──────────────────────────────────▼──────────────────┐
│  TrueForge harness  (npx @truefoundry/trueforge, :8790)              │
│  runs the agent loop: planning · tool routing · context · approvals  │
└───────┬───────────────────┬────────────────────┬────────────────────┘
        │ MCP servers        │ Sandbox (Daytona)  │ Model provider
        ▼                    ▼                    ▼
  CRM · DB · Zendesk     generated SQL/Python   OpenAI / Anthropic / …
  Grafana · Gmail · web  runs in isolation
```

**We build** the front-end + the agent definitions (AgentSpecs) + the demo data/tools.
**The harness provides** the loop, sandbox, approvals, subagents, sessions, event stream.

## 2. Core mapping (product → TrueForge primitive)

| OperationsOS concept        | TrueForge primitive                                        |
| --------------------------- | ---------------------------------------------------------- |
| An agent (Analyst, Handler) | A saved **AgentSpec** (model + instructions + mcp_servers) |
| "Deploy / it works"         | A **session**; runs autonomously via **schedules** (cron)  |
| Connect a tool              | An **MCP server** + its OAuth/auth                          |
| The approval gate           | `require_approval_for_tools` → `tool.approval_required`     |
| Chat with an agent          | A **session → turn**, streamed as events                   |
| Watch the floor             | Render the **event stream** (`thread.created`, `tool.response`, …) |
| A2A / delegation            | **Subagents** (lead delegates within a session)            |

## 3. Front-end structure (planned)

- `web/src/lib/trueforge.ts` — SDK client (`baseUrl` → `:8790`) + typed event helpers
- `web/src/state/` — session + event-stream state, connector state, inbox/approvals
- `web/src/world/` — the office (floor, desks, CEO movement, sprites)
- `web/src/windows/` — agent chat, setup/connect, authorisation dossier
- `web/src/agents/` — the seven AgentSpecs + tool requirements

## 4. The flagship demo flow

Empty office → connect tools (MCP) → agents boot on their one essential tool → Analyst detects a
usage anomaly (sandbox) → Handler delegates to subagents → drafts a save → **3 irreversible
actions wait in the Inbox** → human authorises → agents execute → session logged.

## 5. Track strategy (one project, all tracks)

- **Best Use of TrueForge (DGX)** — MCP + sandbox + subagents + approvals + sessions all visible.
- **Best Code Quality (Mac Mini)** — every change via a Qodo-reviewed PR; clean trail from PR #1.
- **Best UI (iPads)** — the bespoke 1-bit "OS you walk" surface.
- **Best Blog Post (Keychron)** — write up the build as we go.

## 6. Decision log

| Date (UTC) | Decision | Why |
| ---------- | -------- | --- |
| 2026-08-29 | One project submitted to all judged tracks; primary = Best Use of TrueForge | Rules allow it; concentrates effort |
| 2026-08-29 | Domain = "OS for a company run by AI agents"; software/ops flavour | Judges' own examples skew software/infra; plays to strengths |
| 2026-08-29 | Bespoke React+Vite+TS on the SDK/HTTP API, not the embedded UI SDK | Max control for the UI track; still 100% "uses TrueForge" |
| 2026-08-29 | UI world = walkable 1-bit "operating system"; only colour = gold of a pending authorisation | Distinct, on-brand, ties visuals to the "licence to act" theme |
| 2026-08-29 | Fonts: Silkscreen (chrome) + JetBrains Mono (reading text) | Pixel body font was unreadable; mono reads as a real terminal |
| 2026-08-29 | Agents boot on ONE essential tool (Analyst = Warehouse); BI/Gmail are enhancers | Matches reality; lets partial setups work |
| 2026-08-29 | Ship v1 = shell + Data Analyst end-to-end; other 6 agents shown as roadmap | Rules reward one job done end-to-end over many half-built |
