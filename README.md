# sapiom2api

An OpenAI-compatible reverse proxy for [Sapiom](https://sapiom.ai)'s OpenRouter service (`https://openrouter.services.sapiom.ai`). Manages a pool of `sk_live_*` API keys, rotates them automatically, validates their health, and provides a password-protected web UI for key management.

## Features

- **OpenAI-compatible API** — drop-in replacement for any OpenAI SDK or tool
- **Key rotation** — round-robin across all active keys per request
- **Streaming support** — SSE keep-alive pings every 20s to survive proxy timeouts
- **Key validation** — test each key against Sapiom API; detect valid / invalid / no-balance states
- **Auto-ban** — batch validate all keys and automatically disable invalid ones
- **One-click purge** — delete all keys marked invalid from the database
- **Web UI** — password-protected key manager with import, search, and status display

## Architecture

```
Client (OpenAI SDK / newapi / etc.)
        │  POST /v1/chat/completions
        ▼
  main.ts  (Hono, Deno Deploy / Replit)
  ├── /v1/*  →  proxy to openrouter.services.sapiom.ai
  │             (key rotation + x402 payment handling)
  ├── /api/* →  key management REST API
  └── /*    →  pre-built React key manager UI (SPA)
```

## Deploy on Deno Deploy

[![Deploy on Deno](https://deno.com/button)](https://dash.deno.com/new?url=https://github.com/sayrui/split2api&entrypoint=main.ts)

The project uses **GitHub Actions mode** — a build step is required to compile the React frontend before deployment.

### Prerequisites

- A free account at [dash.deno.com](https://dash.deno.com)
- A PostgreSQL database (e.g. [Neon](https://neon.tech) free tier)

### Step 1 — Create a Deno Deploy project

1. Go to [dash.deno.com](https://dash.deno.com) → **New Project**
2. Link your fork/clone of this GitHub repository
3. Set the deployment mode to **"GitHub Actions"**
4. Name the project **`sapiom2api`** (must match the `project:` field in `.github/workflows/deno-deploy.yml`)

> If you choose a different project name, update the `project:` field in `.github/workflows/deno-deploy.yml` to match.

### Step 2 — Set GitHub repository secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Required | Description |
|--------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string, e.g. `postgres://user:pass@host/db?sslmode=require` |
| `VITE_APP_PASSWORD` | ✅ | Password to access the Key Manager UI |

> **No `DENO_DEPLOY_TOKEN` needed.** The workflow uses GitHub's OIDC token for authentication — `permissions: id-token: write` is already configured in `.github/workflows/deno-deploy.yml`.

### Step 3 — Apply the database schema

Run this once to create the `api_keys` table in your PostgreSQL database:

```bash
DATABASE_URL=postgres://user:pass@host/db pnpm --filter @workspace/db exec drizzle-kit push
```

### Step 4 — Trigger a deploy

Push any commit to `main` — GitHub Actions will automatically:

1. Install pnpm dependencies
2. Build the React key manager frontend (`vite build`)
3. Copy the build output to `./dist/`
4. Deploy `main.ts` + `dist/` to Deno Deploy via `denoland/deployctl`

```
git push origin main
```

The deployment URL will be `https://sapiom2api.deno.dev` (or your custom domain).

### How the GitHub Actions workflow works

```yaml
# .github/workflows/deno-deploy.yml (summary)
permissions:
  id-token: write   # enables OIDC auth — no token secret needed
  contents: read

steps:
  - pnpm install
  - vite build  →  artifacts/key-manager/dist/public/
  - cp dist/public → ./dist/
  - denoland/deployctl  (project: sapiom2api, entrypoint: main.ts)
```

---

## Local Development (Node.js / Replit)

### Requirements

- Node.js 20+
- pnpm
- PostgreSQL (or Replit's built-in DB)

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `VITE_APP_PASSWORD` | Password for the Key Manager web UI |
| `SESSION_SECRET` | Secret for session signing |

### Install & Run

```bash
pnpm install
pnpm --filter @workspace/db exec drizzle-kit push   # apply DB schema
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/key-manager run dev
```

---

## API Usage

Point any OpenAI-compatible client at your deployment URL:

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://sapiom2api.deno.dev/v1",
    api_key="any-value",   # not validated by the proxy
)

response = client.chat.completions.create(
    model="openai/gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
```

### Supported Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/chat/completions` | Chat completions (streaming supported) |
| `GET`  | `/v1/models` | List available models |
| `POST` | `/v1/embeddings` | Text embeddings |
| `*`    | `/v1/*` | All other OpenAI-compatible paths forwarded transparently |

---

## Key Management UI

Access the dashboard at `/` and enter the password (`VITE_APP_PASSWORD`).

### Importing Keys

Click **Import** and paste keys one per line (plain text) or as JSON:

```
<your-sapiom-api-key-1>
<your-sapiom-api-key-2>
```

### Key Validation

Each key can be tested against `api.sapiom.ai`:

| Status | Meaning |
|--------|---------|
| ✅ Valid | Key authenticated and has balance |
| ⚠️ No Balance | Key authenticated but insufficient balance |
| ❌ Invalid | Key rejected (403) — likely expired or wrong key |
| 🔘 Unreachable | Could not reach Sapiom API |

**Validate All** — checks every active key in batches of 5, persists results to DB.  
**Auto-ban** — invalid keys are automatically set to inactive during batch validation.  
**Clear Invalid** — permanently deletes all keys with `invalid` status.

---

## Key Management API

All endpoints are under `/api/keys`.

```
GET    /api/keys                    List all keys
POST   /api/keys                    Create a key
POST   /api/keys/import             Bulk import keys
POST   /api/keys/validate-all       Batch validate (auto-ban optional)
DELETE /api/keys/purge-invalid      Delete all invalid keys
GET    /api/keys/:id                Get a key
PATCH  /api/keys/:id                Update a key
DELETE /api/keys/:id                Delete a key
POST   /api/keys/:id/validate       Validate a single key
GET    /api/keys/stats              Get stats (total, active, valid, invalid)
```

### Validate All — Request Body

```json
POST /api/keys/validate-all
{
  "autoBan": true,       // disable invalid keys automatically
  "onlyActive": true,    // skip already-disabled keys
  "concurrency": 5       // parallel checks (1–20)
}
```

---

## Project Structure

```
.
├── main.ts                          # Deno entry point (Hono server)
├── deno.json                        # Deno config (tasks, npm import map)
├── .github/workflows/
│   └── deno-deploy.yml              # GitHub Actions: build + deploy to Deno
├── artifacts/
│   ├── api-server/                  # Node.js/Express server (Replit dev)
│   │   └── src/routes/
│   │       ├── proxy.ts             # OpenAI-compatible proxy
│   │       └── keys.ts              # Key CRUD + validation
│   └── key-manager/                 # React + Vite web UI
│       └── src/
│           ├── pages/Dashboard.tsx
│           └── components/
│               ├── KeysTable.tsx
│               └── StatsCards.tsx
└── lib/
    └── db/                          # Drizzle ORM + PostgreSQL schema
        └── src/schema/api-keys.ts
```

## License

MIT
