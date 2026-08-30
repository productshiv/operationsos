# The business OperationsOS runs

OperationsOS is pointed at a business's live data through MCP connectors and runs its operations.
That business is a **Weather API company** whose data lives in **Supabase**, read through the
**supabase** connector — but nothing in the app or the agents is hard-wired to it.

## Agents discover the schema — they don't assume it

Point OperationsOS at a *different* project and there is no `oos_*` schema to rely on. So the agents
**introspect the data model at runtime** rather than hardcoding table or column names:

1. `list_tables` (supabase MCP) and/or `select ... from information_schema.tables / .columns`
   to learn what tables and columns actually exist.
2. Then write SQL against what they found to answer the question.

This keeps OperationsOS portable: connect any Supabase (or other DB) business and the agents adapt.
Table names below are only what this business happens to expose — reference, not a contract.

## The business data model (`public.oos_*`)

| Table | Columns | Used for |
| --- | --- | --- |
| `oos_customers` | id, name, email, country, plan (`free`/`developer`/`business`), status, signed_up_at | accounts, MRR, churn, upsell targets |
| `oos_api_keys` | id, customer_id, created_at, last_used_at, revoked | activity |
| `oos_usage_daily` | customer_id, day, calls, errors | usage trends, anomaly / churn detection |
| `oos_payments` | id, customer_id, ts, amount_cents, plan, status (`paid`/`failed`) | revenue, failed-payment follow-up |
| `oos_error_events` | id, ts, endpoint, status_code, message, customer_id | incidents, affected customers |
| `oos_support_complaints` | id, ts, customer_id, channel, subject, body, severity, status | what customers are complaining about → tickets |
| `oos_pricing` | plan, monthly_cents, included_calls, overage, rate_limit_rpm, support, notes | "what do we charge?" |

The tables and the data are owned by a separate service (the **`weather-business`** repo, hosted on
Coolify); this app only reads and acts on them. That service does two jobs:

1. **Stands the business up** — `schema.sql` + a seeder.
2. **Keeps it moving** — a live feed makes one plausible change every ~20s (usage, a payment, a
   signup, an error burst, a plan change, a churn) and every so often files a **customer complaint**.

That last one closes the loop this product is built around: a complaint lands in
`oos_support_complaints` → the Support Lead triages it → opens a Jira ticket through the approval
gate → OperationsOS routes the follow-up task to the Operations Manager.

Anything the agents should be able to answer has to *be* in here — which is why pricing is a table.
Ask an agent "what do we charge?" with no `oos_pricing` and it will correctly tell you it doesn't
know, which is honest but useless.

## Reaching the data + the safety gate

The **supabase** connector exposes `execute_sql` (the Analyst uses it read-only — SELECT only) plus
`list_projects` / `list_tables`. The harness **gates `execute_sql` behind human approval**, so a
query against production surfaces in the CEO's Inbox with the exact SQL before it runs.
