# Chatbot SaaS — Next.js (`web/`)

Full-stack Next.js 14 (App Router, TypeScript) multi-tenant chatbot platform — UI and API in one app.

| Layer | Technology |
|-------|------------|
| UI | React SPA mounted in the App Router |
| API | Next.js Route Handlers under `src/app/api/**` |
| Metadata / auth / analytics | Firebase Firestore |
| Vectors | Qdrant Cloud |
| Embeddings + default LLM | OpenRouter |

---

## Prerequisites

- Node.js 18+ (Node 20 recommended)
- Accounts (free tiers are fine to start):
  - [Firebase](https://console.firebase.google.com/) (Firestore)
  - [Qdrant Cloud](https://cloud.qdrant.io/)
  - [OpenRouter](https://openrouter.ai/)
  - SMTP provider (e.g. Gmail App Password) for signup / password-reset emails

---

## Quick start

```bash
cd web
cp .env.example .env
# Fill in Firebase, Qdrant, OpenRouter, JWT, and email (see below)

mkdir -p secrets
# Place your Firebase service account JSON in secrets/ (see Firebase setup)

npm install
npm run qdrant:check   # verify Qdrant Cloud connection
npm run dev            # http://localhost:3000
```

Production build:

```bash
npm run build
npm run start
```

---

## External accounts setup

### 1. Firebase (Firestore)

Used for companies, admins, bots, documents metadata, chat audit, and analytics.

1. Go to [Firebase Console](https://console.firebase.google.com/) → create a project (or use an existing one).
2. Enable **Firestore Database** (Native mode).
3. Project settings → **Service accounts** → **Generate new private key** → download the JSON file.
4. Put the file under `web/secrets/` (this folder is gitignored):

   ```
   web/
     secrets/
       firebase-adminsdk.json    # your downloaded service account
     .env
   ```

5. In `.env` set:

   ```env
   FIREBASE_CREDENTIALS_PATH=./secrets/firebase-adminsdk.json
   ```

   Use your actual filename if different. Path is relative to the `web/` directory (where you run `npm`).

**Security:** never commit the service account JSON or `.env` to git.

---

### 2. Qdrant Cloud (vector database)

Used for document embeddings and RAG retrieval.

1. Sign up at [cloud.qdrant.io](https://cloud.qdrant.io).
2. **Clusters** → **Create** (free tier is fine to start).
3. Copy the **Cluster Endpoint** (e.g. `https://xxxx.region.aws.cloud.qdrant.io`).
4. Copy / create an **API key**.
5. Create a collection (or let the app create it on first ingest). If the Cloud UI asks for **payload indexes**, add these as **integer**:
   - `doc_id`
   - `company_id`
   - `bot_id`
6. Set in `.env`:

   ```env
   QDRANT_URL=https://your-cluster-endpoint.cloud.qdrant.io
   QDRANT_API_KEY=your-api-key
   QDRANT_COLLECTION_NAME=documents
   QDRANT_VECTOR_SIZE=1536
   QDRANT_VECTOR_NAME=
   ```

7. Verify:

   ```bash
   npm run qdrant:check
   ```

   You should see health OK and your collection listed (0 vectors is fine before first ingest).

**Vector size must match your embedding model**, for example:

| Embedding model | Typical `QDRANT_VECTOR_SIZE` |
|-----------------|------------------------------|
| `openai/text-embedding-ada-002` | `1536` |
| `openai/text-embedding-3-small` | `1536` |
| `openai/text-embedding-3-large` | `3072` |

If the Cloud UI created a **named** vector (not the default unnamed one), set `QDRANT_VECTOR_NAME` to that name; otherwise leave it empty.

---

### 3. OpenRouter (embeddings + LLM)

1. Create an account at [openrouter.ai](https://openrouter.ai/) and generate an API key.
2. Set in `.env`:

   ```env
   OPENROUTER_API_KEY=sk-or-v1-...
   OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
   OPENROUTER_CHAT_MODEL=google/gemini-2.5-flash
   OPENROUTER_REFERER=http://localhost:3000
   ```

   For production, set `OPENROUTER_REFERER` to your real site URL (e.g. `https://yourapp.com`).

**Note:** Document **embeddings** always use the server `OPENROUTER_API_KEY`. Chat can use per-bot provider API keys configured in the admin UI; if a bot has no key, server defaults apply.

---

### 4. Email (SMTP)

Needed for email verification and password reset.

Example (Gmail with an [App Password](https://support.google.com/accounts/answer/185833)):

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=you@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
EMAIL_USE_TLS=true
DEFAULT_FROM_EMAIL=you@gmail.com
```

---

### 5. JWT secret

```env
JWT_SECRET_KEY=a-long-random-string-change-this
```

**Required for production.** Do not leave the example default.

---

## Environment variables reference

Copy `.env.example` → `.env` (or `.env.local`) and fill values. Variables are loaded by Next.js from the `web/` directory.

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | No | _(empty)_ | Leave empty so the browser calls same-origin `/api/*`. |

### Firebase

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FIREBASE_CREDENTIALS_PATH` | **Yes** | — | Path to service account JSON (e.g. `./secrets/firebase-adminsdk.json`). |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | — | Alternate path; used if `FIREBASE_CREDENTIALS_PATH` is empty. |

### Qdrant

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `QDRANT_URL` | **Yes** | — | Qdrant Cloud cluster URL. |
| `QDRANT_API_KEY` | **Yes** | — | Qdrant Cloud API key. |
| `QDRANT_COLLECTION_NAME` | No | `documents` | Collection name for vectors. |
| `QDRANT_VECTOR_SIZE` | No | `1536` | Must match embedding model dimension. |
| `QDRANT_VECTOR_NAME` | No | _(empty)_ | Named vector in Cloud UI; leave empty for default unnamed vector. |
| `QDRANT_TIMEOUT_SEC` | No | `120` | Client timeout (seconds). |
| `QDRANT_AUTO_RECREATE_ON_DIMENSION_MISMATCH` | No | `false` | If `true`, deletes and recreates collection on dim mismatch (**destructive**). |
| `QDRANT_UPSERT_BATCH_SIZE` | No | `64` | Points per upsert batch. |
| `QDRANT_UPSERT_RETRIES` | No | `3` | Upsert retry count. |
| `QDRANT_UPSERT_RETRY_BACKOFF_SEC` | No | `1.0` | Backoff between retries. |

### OpenRouter / LLM

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | **Yes** | — | Server key for embeddings (and fallback chat). |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | API base URL. |
| `OPENROUTER_REFERER` | No | `http://localhost:3000` | `HTTP-Referer` header; use your production URL when deployed. |
| `OPENROUTER_TITLE` | No | `chatbot-backend` | `X-Title` header. |
| `OPENROUTER_CHAT_MODEL` | No | `google/gemini-2.5-flash` | Default chat model id. |
| `OPENROUTER_EMBEDDING_MODEL` | No | `openai/text-embedding-3-small` | Embedding model; keep in sync with `QDRANT_VECTOR_SIZE`. |
| `OPENROUTER_MAX_OUTPUT_TOKENS` | No | `1024` | Max tokens for chat completions. |
| `OPENROUTER_TEMPERATURE` | No | `0.3` | Chat temperature. |
| `OPENROUTER_HTTP_TIMEOUT_SEC` | No | `120` | Chat HTTP timeout. |
| `OPENROUTER_EMBEDDING_TIMEOUT_SEC` | No | `180` | Embedding HTTP timeout. |
| `OPENROUTER_EMBEDDING_MAX_RETRIES` | No | `6` | Embedding retry attempts. |
| `OPENROUTER_MAX_CONTINUATIONS` | No | `1` | Extra continuation rounds for long answers. |
| `OPENROUTER_SUMMARY_MODEL` | No | _(empty)_ | Optional model for summaries; falls back to chat model. |
| `OPENROUTER_SUMMARY_MAX_OUTPUT_TOKENS` | No | `384` | Max tokens for summary calls. |

### RAG tuning

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RAG_TOP_K` | No | `6` | Top chunks after retrieval. |
| `RAG_SIMILARITY_THRESHOLD` | No | `0.15` | Minimum dense similarity to keep a chunk. |
| `RAG_MAX_CONTEXT_TOKENS` | No | `3200` | Token budget for packed context. |
| `RAG_CANDIDATE_MULTIPLIER` | No | `2` | Fetch multiplier before filtering. |
| `RAG_LLM_FOCUSED_CONTEXT_CHUNKS` | No | `5` | Chunks passed into focused LLM context. |
| `RAG_LLM_POST_SUMMARY` | No | `false` | Optional post-answer summarization. |
| `RAG_SUMMARIZE_MIN_INPUT_CHARS` | No | `200` | Min chars before summarization runs. |
| `RAG_STRICT_MAX_SENTENCES` | No | `5` | Soft cap on answer length (sentences). |
| `RAG_INGEST_CHUNK_SIZE_TOKENS` | No | `420` | Chunk size at ingest. |
| `RAG_INGEST_CHUNK_OVERLAP_TOKENS` | No | `80` | Chunk overlap at ingest. |
| `EMBEDDING_BATCH_SIZE` | No | `64` | Texts per embedding API batch. |

### Auth / JWT

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET_KEY` | **Yes** (prod) | insecure default | Signing secret for access/refresh tokens. |
| `JWT_ALGORITHM` | No | `HS256` | JWT algorithm. |
| `JWT_ACCESS_TOKEN_LIFETIME_MIN` | No | `15` | Access token lifetime (minutes). |
| `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | No | `7` | Refresh token lifetime (days). |

### Email (SMTP)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EMAIL_HOST` | For email flows | — | SMTP host. |
| `EMAIL_PORT` | No | `587` | SMTP port. |
| `EMAIL_HOST_USER` | For email flows | — | SMTP username. |
| `EMAIL_HOST_PASSWORD` | For email flows | — | SMTP password / app password. |
| `EMAIL_USE_TLS` | No | `true` | Use TLS. |
| `DEFAULT_FROM_EMAIL` | No | `EMAIL_HOST_USER` or `no-reply@example.com` | From address. |

### Plans / cache

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FREE_PLAN_MAX_BOTS` | No | `1` | Max bots on free plan. |
| `PAID_PLAN_MAX_BOTS` | No | `10` | Max bots on paid plan. |
| `SUPER_ADMIN_DASHBOARD_CACHE_TTL_SECONDS` | No | `300` | Super-admin overview cache TTL. |
| `BOT_WORKSPACE_CACHE_TTL_SECONDS` | No | `60` | Bot workspace cache TTL. |

---

## First-run checklist

1. `.env` filled (Firebase path, Qdrant, OpenRouter, JWT, SMTP).
2. Service account JSON in `web/secrets/` and path matches `FIREBASE_CREDENTIALS_PATH`.
3. `npm install` → `npm run qdrant:check` → `npm run dev`.
4. Open http://localhost:3000 → sign up / log in.
5. Create a company (if prompted) → create a bot.
6. Upload a document (ingest writes vectors to Qdrant).
7. Test admin chat, then generate a widget script and test the public widget.

---

## Deploying

Deploy the `web/` folder (set host **Root Directory** to `web` if your repo has a parent folder).

1. Set the same environment variables as in `.env` on the host.
2. Make the Firebase JSON available on the server and set `FIREBASE_CREDENTIALS_PATH` to that path.
3. Set `JWT_SECRET_KEY` to a strong production value.
4. Set `OPENROUTER_REFERER` to your production URL.
5. Leave `NEXT_PUBLIC_API_BASE_URL` empty if UI and API share the same domain.
6. After deploy, upload documents so vectors exist in your Qdrant collection.

Suggested hosts: Vercel, Railway, Render, or any Node host. Prefer a plan with enough request timeout for document ingest (embeddings can take tens of seconds).

---

## Project structure

```
web/
  src/
    app/
      [[...slug]]/page.tsx   # SPA shell
      api/**/route.ts        # HTTP API → lib/server/handlers/*
    App.tsx, views/, components/, hooks/
    lib/
      api.ts                 # browser API client
      server/                # server-only backend
        env.ts firebase.ts repository.ts auth.ts tenant.ts
        rag/                 # embeddings, qdrant, chunking, generate, rag
        handlers/            # auth, bots, documents, chat, public, superAdmin
  secrets/                   # Firebase JSON (gitignored) — create locally
  .env.example               # template for all variables
  scripts/check-qdrant.mjs   # npm run qdrant:check
```

---

## Security notes

- Never commit `.env`, `.env.local`, or `secrets/*.json`.
- Never trust client-sent `company_id` on public routes; public chat resolves tenant from `widget_key` only.
- Every Qdrant search/delete is filtered by `company_id` / `bot_id`.
- Roles: `super_admin` (platform) and `company_admin` (own company only).

---

## Product notes

- Tenant isolation on all retrieval and admin paths.
- Embeddable widget: `/api/public/widget.js`.

---

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| Firestore / auth errors | `FIREBASE_CREDENTIALS_PATH` exists and is readable from `web/`; JSON is a valid service account. |
| Qdrant connection failed | `QDRANT_URL`, `QDRANT_API_KEY`; run `npm run qdrant:check`. |
| Ingest fails / dim mismatch | `QDRANT_VECTOR_SIZE` matches embedding model; use a fresh collection name if size changed. |
| Named vector errors | Set `QDRANT_VECTOR_NAME` to the name shown in Qdrant Cloud UI. |
| Empty / weak answers | Confirm documents were ingested and collection vector count > 0. |
| Email not sending | SMTP host/user/password; Gmail needs an App Password. |
| 401 on admin APIs | Log in again; check `JWT_SECRET_KEY` was not changed mid-session. |
