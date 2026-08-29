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

> _To be populated with links to representative merged PRs, a note on what Qodo surfaced and how
> it was resolved or intentionally dismissed, and the follow-up review against the final code._

## License

[MIT](LICENSE)
