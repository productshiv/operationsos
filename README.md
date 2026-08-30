# OperationsOS

**An operating system for a company run by AI agents.** You run the company by supervising
autonomous agents and holding the one power they don't: **authorising anything irreversible
before it happens.**

Built for the [Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge)
(WeMakeDevs × TrueFoundry × Qodo) on **[TrueForge](https://github.com/truefoundry/trueforge)**,
TrueFoundry's open-source agent harness.

> Status: **work in progress.** The interaction north-star is the design mock in
> [`design/mock.html`](design/mock.html) (a 1-bit "operating system" you walk).

## What it does

A roster of specialised agents does real operational work — reaching live tools over **MCP**,
running generated code in a **sandbox**, and delegating to each other as **subagents** — while
every irreversible action **pauses for a human's authorisation**. The flagship flow: an agent
detects a customer silently churning, the team coordinates a save, and the outward actions
(email, ticket, CRM update) wait in your Inbox for sign-off.

How the harness does the work:

| Capability        | In OperationsOS                                                        |
| ----------------- | --------------------------------------------------------------------- |
| MCP tools         | Each tool (CRM, DB, Zendesk, Grafana, Gmail, web) is an MCP connector  |
| Sandbox           | The Data Analyst writes SQL/Python and runs it in the sandbox          |
| Subagents         | The Account Manager delegates to Research / Support / Incident         |
| Approval gates    | `require_approval_for_tools` on every irreversible tool                |
| Persistent state  | Each agent conversation is a resumable TrueForge session               |

## Architecture

See **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** for the living architecture + decision log.

The front-end is a bespoke **React + Vite + TypeScript** app (in [`web/`](web/)) that talks to the
TrueForge **HTTP API / TypeScript SDK** and renders its live event stream — it does not use the
embedded chat UI.

## Running it

> Finalised as the app lands. Current shape:

```bash
# 1. Run the harness (needs Node 22+)
npx @truefoundry/trueforge@latest        # serves http://localhost:8790

# 2. Run the OperationsOS front-end
cd web && npm install && npm run dev
```

You supply your own model API key and MCP connectors in TrueForge (Settings → Models / Connectors).
No credentials live in this repo.

## Built with AI assistance

This project was built with the help of an AI coding assistant (Claude Code). All architectural
and technical decisions were made and are owned by the author, who can explain them.

## Qodo Code Review Evidence

Every substantive change ships through a GitHub pull request reviewed by
[Qodo](https://www.qodo.ai/) before merge; direct pushes to `main` are avoided.

**Reviewed PRs**

- **[#1 — Scaffold React + Vite + TS front-end](https://github.com/productshiv/operationsos/pull/1)** —
  Qodo raised **2 Medium findings**: the harness status was probed only once (would go stale), and
  the health probe inherited the client's 600s streaming timeout. Both were valid and fixed in #2 —
  a polling `useHarnessStatus` hook and a dedicated 5s-timeout probe client — and answered on their
  threads.
- **[#2 — Walkable 1-bit office (world slice)](https://github.com/productshiv/operationsos/pull/2)** —
  Qodo raised **5 findings** (inert interactions, the reduced-motion ticker parked off-screen, the
  facing transform mirroring the "YOU" label, movement keys latching after focus loss, and a UTC
  clock). All five were fixed, each thread answered, and Qodo's **follow-up review returned 0
  findings**.
- **[#3 — Connect-tools setup wired to real MCP connectors](https://github.com/productshiv/operationsos/pull/3)** —
  **4 findings**: the connector scan could hang for the full 10-minute streaming timeout, the OAuth
  pop-up opened after an `await` (so blockers killed it), the auth re-list ran prematurely, and
  authorization failures escaped handling. All fixed; re-review **0 findings**.
- **[#4 — Data Analyst: chat, schema discovery, approval-gated SQL](https://github.com/productshiv/operationsos/pull/4)** —
  **4 findings** including a **Security** one (the pinned Supabase project wasn't enforced at the
  gate): approval used the wrong tool-call id, the gate still let new turns start, a failed approval
  lost the checkpoint, and the project pin was unenforced. All fixed; re-review **0 findings**.
- **[#5 — Support (Jira), Incident, Research agents](https://github.com/productshiv/operationsos/pull/5)** —
  **2 findings** including a **Security** one (Jira approvals hid the payload the tool would send)
  plus analyst-specific guidance leaking onto the new agents. Fixed; re-review **0 findings**.
- **[#6 — Coolify deploy (harness + frontend, /tf proxy)](https://github.com/productshiv/operationsos/pull/6)** —
  **2 findings** (nginx root could serve the wrong app; the production client surfaced a `localhost`
  URL on proxy errors). Fixed; re-review **0 findings**.
- **[#7 — Pin internal Postgres creds](https://github.com/productshiv/operationsos/pull/7)** —
  **2 findings** (pinned creds vs a pre-existing volume; a stale local-test instruction). Documented
  the volume-migration path and corrected the docs; re-review **0 findings**.
- **[#8 — Stop publishing the web host port on Coolify](https://github.com/productshiv/operationsos/pull/8)** —
  review returned **0 findings**.
- **[#9 — Native in-app model + connector setup](https://github.com/productshiv/operationsos/pull/9)** —
  **3 findings** (readiness cleared on an unrelated model, a single-endpoint fault hid both sections,
  and `models.offline` was missing from the attention check). All fixed; re-review **0 findings**.
- **[#10 — Re-resolve the harness per request (502 fix)](https://github.com/productshiv/operationsos/pull/10)** —
  review returned **0 findings**.
- **[#11 — Don't drive the avatar while typing in a field](https://github.com/productshiv/operationsos/pull/11)** —
  review returned **0 findings**.
- **[#12 — One-click connector catalog + trimmed copy](https://github.com/productshiv/operationsos/pull/12)** —
  **3 findings** (only the first auth header was submitted, catalog add-failures were invisible, and
  one add cleared another's pending state). All fixed; re-review **0 findings**.
- **[#13 — Support on fresh `atlassian` connector + Disconnect button + chat error surfacing](https://github.com/productshiv/operationsos/pull/13)** —
  review returned **0 findings**.
- **[#14 — Docs: Qodo review evidence brought current](https://github.com/productshiv/operationsos/pull/14)** —
  documentation only; review returned **0 findings**.
- **[#15 — Hide the undeletable dead `jira` connector, alias `atlassian` as jira](https://github.com/productshiv/operationsos/pull/15)** —
  **2 findings** (both **Correctness**): the hidden `jira` still raised a warning, and the hide-rule
  could globally suppress a *healthy* `jira`. Both fixed (hide is matched by name **and** URL and only
  when a replacement is present); re-review **0 findings**.
- **[#16 — Floor jukebox (playlist modal, paste-to-add, localStorage)](https://github.com/productshiv/operationsos/pull/16)** —
  **6 findings** (3 High / 3 Medium, all Correctness/Reliability in the player): control commands raced
  the YouTube player's readiness, the iframe URL forced autoplay on track change, removing the last
  track kept playing, an empty playlist wasn't persisted, ids pulled from URLs skipped validation, and
  track completion left a stale "playing" state. All fixed; re-review **0 findings**.
- **[#17 — Wider chat + collapsible tool cards (+ restore dropped jukebox work)](https://github.com/productshiv/operationsos/pull/17)** —
  **2 findings**: a claim that the oEmbed title fetch would be CORS-blocked — **dismissed with reasoning**
  (verified 3× that YouTube's oEmbed endpoint reflects the `Origin` header and is CORS-enabled), answered
  on the thread; and the jukebox widget overlapping the menu controls — **fixed** (responsive hide rules).
- **[#18 — Quick-action tickets, missing-connector fix-it, think-strip, selectable text](https://github.com/productshiv/operationsos/pull/18)** —
  **5 findings** (3 High / 2 Medium, Correctness/Reliability): the add-connector call sent placeholder
  header values, OAuth connectors never resumed the turn, the OAuth pop-up was pop-up-blocked (opened
  after an `await`), a retry kept the failed turn's partial output, and a quick action could target a
  stale reply. All fixed; re-review **0 findings**.
- **[#19 — Clearer roster + fix Analyst silence (drop Jira coupling)](https://github.com/productshiv/operationsos/pull/19)** —
  **1 finding** (High, Correctness): the Operations Manager (then "Handler") told `create_sub_agent` to
  delegate work, but dynamic sub-agents inherit the parent's (empty) toolset, so the delegates could do
  nothing. Fixed by reframing it as a planner/router that routes each step to the specialist who holds
  the tools; re-review **0 findings**.
- **[#20 — Real job-title names across the floor](https://github.com/productshiv/operationsos/pull/20)** —
  naming only; review returned **0 findings**.
- **[#21 — Open-a-ticket on every agent + fix lingering approval card](https://github.com/productshiv/operationsos/pull/21)** —
  **3 findings** (2 High / 1 Medium, Correctness/Reliability): after an approval was accepted, a dropped
  response stream exposed the generic retry — which replays the message and could file a **duplicate**
  ticket; the ticket action could target a session created before Jira resolved (so it couldn't invoke
  it); and Jira availability was a one-time snapshot that never refreshed. Fixed by making a post-accept
  failure a passive note (no write-duplicating retry), binding the action to the session's own frozen
  spec, and moving Jira resolution onto the app's shared, refreshable connector state; re-review **0 findings**.

Across all 21 PRs Qodo surfaced **46 findings** (including **2 security** issues); every one was
fixed — or, where appropriate, dismissed with reasoning on the thread — and each PR that carried
actionable findings passed a **follow-up review with 0 findings** before merge.

_Updated as each PR merges — what Qodo surfaced, and how it was resolved or, with reasoning, dismissed._

## License

[MIT](LICENSE)
