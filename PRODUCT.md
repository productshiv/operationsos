# PRODUCT.md — OperationsOS

> Product truth for the build. Written from the brief so far; lines marked _(assumption)_ are
> inferred and awaiting the user's confirmation.

## One sentence
OperationsOS is an operating system for a company whose employees are AI agents — you run the
company by supervising autonomous agents and holding the one power they don't: authorising
anything irreversible before it happens.

## The mechanism (what only this product does)
Real work is handed to a roster of specialised agents that reach live tools, write and run their
own code in a sandbox, and delegate to each other — but every irreversible action stops and waits
for a human's authorisation. The human is the CEO; the agents are the staff.

## Audience & scene
- **Primary user:** the founder/operator of a small company (the "CEO"). _(assumption: also useful to ops/RevOps leads at larger orgs.)_
- **Scene:** one person at a desk, watching autonomous workers carry the operational load, stepping in only at the moments that carry real consequence (sending to a customer, filing a ticket, changing a record, rolling something back).

## The problem
Founders drown in operational work that is individually low-skill but collectively enormous:
watching usage, chasing churn, answering support, researching accounts, triaging incidents.
Agents can do most of it — but you cannot hand an agent your customer inbox and your production
systems without a way to (a) reach the real tools, (b) run generated code safely, and (c) stop it
before it does something you can't undo. OperationsOS is that supervised layer.

## The staff (agents) — built in this order
1. **Data Analyst** ("Analyst") — runs & maintains BI; writes SQL/Python, runs it in the sandbox, returns metrics + charts. _First agent shipped; the sandbox showcase._
2. **Customer Support** ("Medic") — answers customers, reproduces reported errors by running their code in the sandbox, files/updates tickets.
3. **Research** ("Scout") — profiles each customer and writes findings into the CRM.
4. **Account Manager** ("Handler") — the coordinator; delegates to Analyst/Support/Research (A2A) to understand account health and keep customers happy.
5. **Sales** ("Closer") — finds new / non-business-plan customers and reaches out to explain and sell.
6. **PM** ("Architect") — knows the product surface and plans next steps.
7. **Incident Management** ("Watch") — detects incidents, reports to support, coordinates tickets and customer comms.

Tool surfaces (via MCP): BI tool, database, ticketing, support platform, CRM, Grafana/analytics,
project management, web search.

## Core loop (the flagship flow we demo)
A customer is silently churning → the **Analyst** detects a usage anomaly (sandbox) → the
**Handler** delegates to **Scout/Watch/Medic** to build a health dossier → Handler proposes a save
(email + ticket + CRM update) → **the actions stop for the CEO to authorise** → on approval, the
agents execute; the session is logged.

## Platform truth (how it's actually built)
- Runs on **TrueForge** (TrueFoundry's open-source agent harness): MCP tools, **Daytona sandbox**,
  **subagents**, **human approval gates** (`require_approval_for_tools`), persistent sessions, schedules (cron).
- Each agent = a saved TrueForge **AgentSpec** (model + instructions + mcp_servers + approvals).
- Frontend is **bespoke React + Vite + TypeScript** talking to the TrueForge **HTTP API / TS SDK**
  and rendering the live **event stream** (`thread.created`, `tool.response`, `tool.approval_required`, …).
- Every change ships through a **Qodo-reviewed GitHub PR**; README carries the Qodo evidence.
- Built with AI assistance (Claude Code); the team owns and can explain every decision. _(disclosed per hackathon rules.)_

## This surface (what we're designing now)
The **CEO's operating view**: a spatial "office" the CEO walks, where each agent is a character at
a desk doing live work; approaching an agent opens its output; irreversible actions surface in the
CEO's inbox as an authorisation dossier (Authorise / Deny). Mode: **Operate**, pushed hard on delight.

## Success criteria
- Wins the hackathon **Best UI** track: a stranger can pick it up and drive; it *shows* what each agent
  is doing, what it's waiting on, and what it did, and asks before the irreversible step.
- Makes the harness visible: a real tool reached, code run in the sandbox, a pause for a human.
- Reads as a product with a point of view — not a templated dashboard, not a generic office clone.

## Constraints
- Now: a single self-contained interactive HTML mock (north-star; re-implemented in React later).
- Demo-safe: outward actions routed to sandbox/demo sinks; nothing irreversible fires without the human.
- Two themes: daytime office (light) and night-shift (dark).

## Named / not-to-touch
- Product name **OperationsOS**; the "licence to act" / authorisation motif is core.
- Agent codenames (Analyst/Medic/Scout/Handler/Closer/Architect/Watch) — _(assumption; easily changed.)_
