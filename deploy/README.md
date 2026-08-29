# Deploying OperationsOS

One stack: the **TrueForge harness** (Postgres + Redis) and the **OperationsOS frontend**, which
serves the app and reverse-proxies `/tf` → the harness on the internal network. The browser only
ever talks to one origin, so there is no CORS to fight.

Only the `web` service is exposed; the harness is reachable solely through `/tf`.

## On Coolify

1. New resource → **Docker Compose**, from this repo.
2. **Compose file path:** `deploy/docker-compose.yml`.
3. Set environment variables (see [`.env.example`](.env.example)):
   - `PUBLIC_BASE_URL` — your Coolify domain **+ `/tf`**, e.g. `https://ops.example.com/tf`
   - (Postgres credentials are internal to the compose — nothing to set.)
4. Point Coolify's domain at the **`web`** service (port 80).
5. Deploy.

## First-run configuration (once)

The harness starts empty. Its admin UI is proxied at **`<your-domain>/tf`** — open it and:

- **Settings → Models** — add your OpenRouter provider + `minimax-m3` (or another tool-calling model).
- **Settings → Connectors** — add Supabase (service key), Exa, Jira, etc. OAuth connectors (Jira)
  open their consent flow; that's why `PUBLIC_BASE_URL` must be your real domain.

Then in **OperationsOS itself**, the **Integrations** panel shows those connectors and lets you
authorise the ones that need it. (A model/connector setup panel inside OperationsOS is on the
roadmap; for now the harness UI at `/tf` is the source of truth.)

Seed the business data from the separate [`weather-business`](../../weather-business) project
(or point at any Supabase — the agents discover the schema).

## Local test

```bash
cd deploy
cp .env.example .env   # optional — only PUBLIC_BASE_URL / WEB_PORT
docker compose up --build
# app on http://localhost:8080 ; harness proxied at http://localhost:8080/tf
```

The Postgres credentials are fixed inside the compose (internal DB), so there is nothing to set for
the database.

## Notes / known rough edges

- The harness image is pulled from `tfy.jfrog.io/tfy-images/trueforge`. If that tag moves or needs
  auth, pin a tag you can pull (or build from the TrueForge repo).
- The harness is exposed (unauthenticated) through `/tf`. For anything beyond a demo, put auth in
  front of it or enable TrueForge's OIDC login.
- **Existing Postgres volume:** the DB credentials are fixed to `trueforge/trueforge`. Postgres
  only applies init credentials to an **empty** data directory, so a `postgres-data` volume that was
  initialised with different credentials will leave the harness unable to connect. If you're
  migrating (or a prior failed deploy left a half-initialised volume), **delete the `postgres-data`
  volume and redeploy** so it re-initialises with the fixed credentials.
- This compose has not been run end-to-end on Coolify yet — expect one round of tuning
  (image tag, `PUBLIC_BASE_URL`, port mapping) on first deploy.
