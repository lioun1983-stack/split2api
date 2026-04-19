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

---

## 🚀 Deploy on Deno Deploy (~5 min setup)

[![Deploy on Deno](https://deno.com/button)](https://console.deno.com/new?clone=https://github.com/sayrui/split2api)

> Clicking the button above will **fork this repo to your GitHub account** and create a linked Deno Deploy project. Then follow the 3 steps below.

### Step 1 — Create your database

Get a free PostgreSQL URL from [Neon](https://neon.tech) (free tier, no credit card). Then run the following SQL in the **Neon SQL Editor** to create the table:

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  key         TEXT NOT NULL,
  provider    TEXT,
  note        TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  validation_status   TEXT,
  validation_message  TEXT,
  validated_at        TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Step 2 — Set GitHub repository secrets

In your forked repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|--------|-------|
| `DATABASE_URL` | Your Neon connection string, e.g. `postgres://user:pass@host/db?sslmode=require` |
| `VITE_APP_PASSWORD` | Any password you want for the Key Manager UI |

> **No `DENO_DEPLOY_TOKEN` needed** — the workflow uses GitHub's built-in OIDC authentication.

### Step 3 — Switch to GitHub Actions mode & set the project name

In the Deno Deploy dashboard for your new project:

1. Go to **Settings → Git** → change deployment mode to **"GitHub Actions"**
2. Note the project name (default is your repo name). If it differs from `sapiom2api`, update the `project:` field in `.github/workflows/deno-deploy.yml`

### Trigger your first deploy

Push any commit to `main` (or click **"Re-run"** in GitHub Actions). The workflow will:

1. Build the React frontend with `vite build`
2. Upload `main.ts` + built assets to Deno Deploy

Your app will be live at `https://<project-name>.deno.dev`

---

## Architecture

```
Client (OpenAI SDK / newapi / etc.)
        │  POST /v1/chat/completions
        ▼
  main.ts  (Hono server — runs on Deno Deploy)
  ├── /v1/*  →  proxy to openrouter.services.sapiom.ai
  │             (key rotation + x402 payment handling)
  ├── /api/* →  key management REST API
  └── /*    →  pre-built React key manager UI (SPA)
```

### Tech stack (Deno Deploy)

| Layer | Library |
|-------|---------|
| HTTP framework | [Hono](https://hono.dev) |
| Database ORM | [drizzle-orm](https://orm.drizzle.team) + postgres.js |
| Frontend | React + Vite (pre-built by GitHub Actions) |
| Auth | GitHub OIDC (no token secret needed) |

---

## Local Development

### Requirements

- Node.js 20+, pnpm, PostgreSQL

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `VITE_APP_PASSWORD` | Password for the Key Manager web UI |
| `SESSION_SECRET` | Secret for session signing |

### Install & Run

```bash
pnpm install
pnpm --filter @workspace/db exec drizzle-kit push   # create DB schema
pnpm --filter @workspace/api-server run dev          # API server
pnpm --filter @workspace/key-manager run dev         # frontend UI
```

---

## API Usage

Point any OpenAI-compatible client at your deployment URL:

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://<your-project>.deno.dev/v1",
    api_key="any-value",   # not checked by the proxy
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

Click **Import** and paste keys one per line:

```
<your-sapiom-api-key-1>
<your-sapiom-api-key-2>
```

### Key Validation

| Status | Meaning |
|--------|---------|
| ✅ Valid | Key authenticated and has balance |
| ⚠️ No Balance | Key authenticated but insufficient balance |
| ❌ Invalid | Key rejected (403) — likely expired |
| 🔘 Unreachable | Could not reach Sapiom API |

**Validate All** — checks every active key in batches of 5, saves results to DB.  
**Auto-ban** — invalid keys are automatically disabled during batch validation.  
**Clear Invalid** — permanently deletes all keys with `invalid` status.

---

## Key Management API

```
GET    /api/keys                  List all keys
POST   /api/keys                  Create a key
POST   /api/keys/import           Bulk import keys
POST   /api/keys/validate-all     Batch validate (auto-ban optional)
DELETE /api/keys/purge-invalid    Delete all invalid keys
GET    /api/keys/:id              Get a key
PATCH  /api/keys/:id              Update a key
DELETE /api/keys/:id              Delete a key
POST   /api/keys/:id/validate     Validate a single key
GET    /api/keys/stats            Stats (total / active / valid / invalid)
```

#### `POST /api/keys/validate-all` options

```json
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
├── deno.json                        # Deno tasks + npm import map
├── .github/workflows/
│   └── deno-deploy.yml              # GitHub Actions: build → deploy
├── artifacts/
│   ├── api-server/                  # Express server (Replit dev only)
│   └── key-manager/                 # React + Vite frontend
└── lib/
    └── db/                          # Drizzle ORM schema
```

## License

MIT
