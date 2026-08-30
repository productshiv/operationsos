# OperationsOS

**An operating system for a company run by AI agents.** You run the company by supervising
autonomous agents and holding the one power they don't: **authorising anything irreversible
before it happens.**

Built for the [Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge)
(WeMakeDevs × TrueFoundry × Qodo) on **[TrueForge](https://github.com/truefoundry/trueforge)**,
TrueFoundry's open-source agent harness.

> Live at **[operationalos.productshiv.com](https://operationalos.productshiv.com)** — a 1-bit
> "operating system" you walk around. The original north-star mock is [`design/mock.html`](design/mock.html).

## What it does

You walk a 1-bit office floor. At each desk sits a specialised agent doing real operational work
against a live business over **MCP** — and every irreversible action **pauses for your
authorisation**, with the exact SQL or payload shown before it runs.

The roster:

| Agent | Does | Reaches |
| --- | --- | --- |
| Data Analyst | Business numbers — customers, revenue, usage, churn | Supabase |
| Market Research | Companies, markets and competitors | Exa (web) |
| Support Lead | Reads and files tickets | Jira |
| Incident Response | Error spikes, who they hit, likely cause | Supabase |
| Operations Manager | Turns a situation into a routed plan | — (routes, then tracks in Jira) |

How the harness does the work:

| Capability | In OperationsOS |
| --- | --- |
| MCP tools | `supabase` (the business data), `atlassian` (Jira), `exa` (web) — configured in-app, not the admin UI |
| Approval gates | Every write pauses in the thread; you see the payload, then allow or deny |
| Persistent state | Each conversation is a resumable TrueForge session — context survives reloads and follows you across devices |
| Agent-to-agent | An agent can pull a colleague in; the app runs a turn on *their* session, because harness sub-agents inherit the parent's (wrong) toolset |
| Tasks + attention | An authorised ticket routes a task to the Operations Manager; badges show workload and what needs you |

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
- **[#22 — Persist conversations across reload/reopen (harness-backed, cross-device)](https://github.com/productshiv/operationsos/pull/22)** —
  **5 findings** (2 High / 3 Medium, Correctness/Reliability) hardening the new restore path: a session
  reopened mid-gate didn't restore its pending approval; a session created before Jira resolved was
  reused even once Jira was available; the lookup only scanned recent sessions; and a lookup/history
  **failure** was indistinguishable from an empty session (forking the conversation or attaching a
  blank-but-live one). Fixed by rebuilding the pending gate from the turn's `requiredActions`, adding
  the connector set to the session identity, and returning discriminated found/none/error results with
  a Retry; re-review **0 findings**.
- **[#23 — New chat (clear a piled-up thread) + provider upsert to fix a 404'd model](https://github.com/productshiv/operationsos/pull/23)** —
  **1 finding** (Medium, Correctness): "New chat" only cleared local state, so a remount/reload
  re-restored the abandoned session. Fixed with a per-browser blocklist of abandoned session ids that
  the lookup skips; re-review **0 findings**.
- **[#24 — Ambient floor life (props + roaming workers)](https://github.com/productshiv/operationsos/pull/24)** —
  **3 findings** (2 High / 1 Medium, Correctness): the walk cycle's second frame was hidden by a global
  `display:none`; roamers had a positive z-index and intercepted desk clicks while crossing them; and
  `prefers-reduced-motion` was read only once. Fixed by rendering the second frame, making roamers
  `pointer-events:none` behind the desks, and subscribing to the motion-preference media query;
  re-review **0 findings**.

- **[#26 — Task board: routed tasks, desk badges, CEO attention, contextual tickets](https://github.com/productshiv/operationsos/pull/26)** —
  **3 findings** (2 High / 1 Medium): the board became unreachable once the last approval cleared
  (the badge was gated on attention alone, so open tasks were stranded); malformed persisted
  attention could crash the floor; and `createIssueLink` was mis-read as a new ticket. Fixed by
  badging attention **plus** open tasks, validating each stored entry, and tightening the tool match
  to start-with-`create` / end-with-`issue`; re-review **0 findings**.
  (Opened first as #25, which GitHub auto-closed when its stacked base branch was deleted on merge;
  the same work, and its 4 findings, carried into #26.)
- **[#27 — HR room: call everyone and the office becomes a bar](https://github.com/productshiv/operationsos/pull/27)** —
  **4 findings** (1 High / 3 Medium): agents who were already away wandered off again the moment the
  party ended; the TV equalizer kept moving while the jukebox was paused; two `@keyframes eq` blocks
  collided so the TV never ran its own animation; and — the High — a question checkpoint was cleared
  before the harness accepted the answer, so a transient failure stranded the thread on a 422. All
  fixed; re-review **0 findings**.
- **[#28 — Agents consult each other + architecture & roadmap windows](https://github.com/productshiv/operationsos/pull/28)** —
  **8 findings across two rounds** (4 High / 4 Medium) — the largest review of the project, almost
  all on the new cross-agent path: a colleague paused on a question or approval stranded every later
  consultation; a lookup failure forked the conversation; overlapping turns could race one session;
  streamed output was double-counted; answering a question left stale attention on the board; and the
  new menu buttons overflowed (then, once hidden, became unreachable). Seven fixed. One —
  "strands approval in open desk" — was **verified as a false positive** and answered on the thread
  rather than changed: `Office` renders a single `DeskWindow`, so two agent chats never mount at once.
  Chasing the menu finding also turned up a **pre-existing** overflow (the header clipped its own
  controls on phones), fixed at the same time.

Across all 28 PRs Qodo surfaced **70 findings** (including **2 security** issues); every one was
fixed — or, where appropriate, dismissed with reasoning on the thread — and each PR that carried
actionable findings passed a **follow-up review with 0 findings** before merge.

> Worth recording: Qodo reviews on PR **open**, not on later pushes. Follow-up commits are reviewed
> by asking for one explicitly (`/review` as a PR comment) — which is how the #28 round-two findings,
> including two real bugs in the fixes themselves, were caught before merge.

_Updated as each PR merges — what Qodo surfaced, and how it was resolved or, with reasoning, dismissed._

## License

[MIT](LICENSE)
