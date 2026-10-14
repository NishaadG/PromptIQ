# PromptIQ

Measure, train and certify how well people use AI. Learners write prompts for realistic tasks; PromptIQ runs them
through a model, scores the result against a rubric, counts the tokens it cost, and gives feedback grounded in our
research (*How Many Parameters Is a Prompt Worth?*, PCCOE 2026).

**Everything runs at zero cost.** No database server, no paid API, no accounts needed for local development.

## Quick start

```bash
npm install
npm run db:seed     # creates a local embedded Postgres (PGlite) in .data/ and loads the item bank
npm run dev         # http://localhost:3000
```

Log in with the demo account **demo@promptiq.dev / promptiq-demo** (or create your own account).

Demo path (~3 min): Log in → Dashboard → **Start task** → "Use a sample prompt" or write your own → Submit →
read the rubric results and feedback → **Claim reward** → Leaderboard → Local Lab → Profile → issue a certificate
once a track is passed → open its public verification link.

## What's real

| Area | Implementation |
|---|---|
| Accounts | scrypt-hashed passwords; database-backed sessions (only a SHA-256 of the token is stored) in an httpOnly cookie; rate-limited login/sign-up |
| Item bank | 10 tasks across summarization, extraction, rewriting, explanation, classification, reasoning, code review and grounded Q&A, each with a source text, a weighted rubric, a sample prompt and median benchmarks |
| Scoring | Rubric criteria (`includes_any/all`, `excludes`, `max_words`, `min_items`, `json_fields`, `regex`, optional `llm_judge`); real BPE token counts; **efficiency** = success adjusted for token spend vs. the median solver; **clarity** = readability of the output |
| Feedback | Detects the prompting techniques used (few-shot, chain-of-thought, role, structured output, answer-only, audience, length limits) and gives evidence-based feedback, e.g. the cost of few-shot examples and the "answer-only" compliance trap on reasoning tasks |
| Progression | Rewards with an anti-farming rule (you earn your *best* result per task once), XP and levels, daily streaks, an Elo-style skill rating, adaptive task recommendation |
| Leaderboards | All-time (balance) and this week (tokens earned in the last 7 days) |
| Local Lab | Same prompt on a cloud model and a small local model, scored side by side with cost and latency; history by task type |
| Teams | Learners set an organisation; the Team page shows members' levels, success, efficiency and certificates, plus organisational AI-readiness (share certified, averages, tokens saved vs. task medians) |
| Item bank admin | Admins author/edit tasks with a validated rubric schema, retire tasks, see per-item statistics from real learners (attempts, mean, pass rate, observed medians) and recalibrate benchmarks from data. Grant admin with `npm run db:admin -- you@example.com` or `ADMIN_EMAILS` |
| Certificates | Ed25519-signed credentials per track (all tasks passed at 85+), 24-month expiry, public `/verify/<id>` page, machine verification API and published public key; tamper detection |
| Integrity signals | Typing speed and paste volume recorded per attempt; superhuman-speed attempts are excluded from certification evidence; paste and unlikely-jump flags are informational; admin review list. Signals, never automatic accusations |

## Configuration (`.env.local`)

All optional — see `.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | *(unset → embedded PGlite in `.data/pglite`)* | Any Postgres URL, e.g. a free [Neon](https://neon.tech) database |
| `DB_AUTO_MIGRATE` | `true` | Apply migrations on first connection; set `false` if you run `npm run db:migrate` in your deploy step |
| `LLM_PROVIDER` | `simulated` | `simulated` (offline, deterministic) or `openai` (any OpenAI-compatible endpoint) |
| `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` | — | Endpoint for `openai` mode (see below) |
| `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_MODEL` | *(unset → simulated 3B model)* | The "local" side of Local Lab, e.g. Ollama |
| `CLOUD_USD_PER_MTOK` | `5` | Reference price used to cost the cloud side in Local Lab |
| `ADMIN_EMAILS` | – | Comma-separated emails treated as admins |
| `PROMPTIQ_SIGNING_KEY` | *(dev: auto-generated `.data/signing-key.pem`)* | Ed25519 PKCS#8 PEM private key for certificates — **required in production** |

### Free model options

The default **simulated** provider needs nothing: it degrades a reference answer the way real models do when a prompt
under-specifies the task, so scores are meaningful and reproducible. To use real models for free:

```bash
# Ollama on your own machine (free, offline)
LLM_PROVIDER=openai
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5:1.5b

# or a free-tier hosted API (check the provider's current limits)
LLM_PROVIDER=openai
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=<model id>
LLM_API_KEY=<your free key>
```

Generate a production signing key:

```bash
node -e "const {generateKeyPairSync}=require('crypto');console.log(generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'pem'}))"
```

## Deploying (free)

1. Create a free Postgres database (e.g. Neon) and copy its connection string.
2. In your Vercel project set `DATABASE_URL` and `PROMPTIQ_SIGNING_KEY` (and an LLM provider if you want real models).
3. Seed once from your machine: `DATABASE_URL=... npm run db:seed`.
4. Deploy. Migrations also apply automatically on first request unless `DB_AUTO_MIGRATE=false`.

> PGlite stores data on local disk, so it is for development only — serverless deployments need `DATABASE_URL`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js 16 |
| `npm test` | Vitest — scoring engine, auth, attempts/claims, Local Lab, certificates (in-memory database) |
| `npm run typecheck` | TypeScript |
| `npm run db:seed` | Migrate + load the item bank and demo users (idempotent) |
| `npm run db:reset` | Delete the local PGlite database and reseed |
| `npm run db:generate` | Create a migration after editing `lib/server/db/schema.ts` |
| `npm run db:admin -- <email>` | Grant the admin role to an existing account |
| `npm run db:set-password -- <email>` | Forgotten password: prints a temporary password and signs the user out everywhere (no email service needed) |

## API

All JSON. Authenticated routes use the session cookie set by login/sign-up.

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/auth/signup` · `POST /api/auth/login` · `POST /api/auth/logout` | – | Session management |
| `GET/PATCH /api/me` · `GET /api/me/dashboard` | ✓ | Current user (update name/organisation); dashboard payload |
| `POST /api/me/password` `{currentPassword, newPassword}` | ✓ | Change password; signs out all other sessions |
| `GET /api/me/export` · `DELETE /api/me` `{password}` | ✓ | Download all your data as JSON / permanently delete your account |
| `GET /api/team` | ✓ | Your organisation's members and readiness summary |
| `GET /api/tasks` · `GET /api/tasks/:id` | ✓ | Item bank (rubric internals are never exposed) |
| `POST /api/tasks/:id/attempts` `{prompt, elapsedMs?, pastedChars?}` | ✓ | Run + score a prompt (creates an unclaimed attempt) |
| `POST /api/attempts/:id/claim` | ✓ | Claim the reward (pays only improvements on your best) |
| `GET /api/leaderboard?period=week\|all` | – | Standings |
| `GET/POST /api/local-lab/runs` `{taskId, prompt}` | ✓ | Lab history / run a side-by-side comparison |
| `GET /api/credentials` · `POST /api/credentials` `{track}` | ✓ | Track progress and certificates / issue one |
| `GET /api/credentials/:id/verify` · `GET /api/credentials/public-key` | – | Public verification |
| `GET/POST /api/admin/tasks` · `PATCH /api/admin/tasks/:id` · `POST /api/admin/tasks/:id/recalibrate` | admin | Item bank authoring, retirement and recalibration |
| `GET /api/health` | – | DB + provider status |

## Security

- Passwords: scrypt with per-user salt; login runs a hash comparison even for unknown emails (no timing oracle).
- Sessions: random 256-bit token in an httpOnly, SameSite=Lax cookie (Secure in production); only its SHA-256 is stored. Changing the password revokes every session.
- CSRF: on top of SameSite, every state-changing API request with a foreign `Origin` is rejected.
- Rate limits: fixed-window counters in the database (`rate_limits`), so they hold across serverless instances — login, sign-up, attempts, lab runs, password change, export and deletion.
- Headers: `nosniff`, `X-Frame-Options: DENY` / `frame-ancestors 'none'`, strict referrer policy, restrictive `Permissions-Policy`, HSTS in production.
- Certificates: Ed25519-signed; production refuses to start signing without `PROMPTIQ_SIGNING_KEY`.
- Item bank secrecy: rubrics and reference responses never leave the server.
- Privacy: users can download all their data (`/api/me/export`) and delete their account.

## Project layout

```
app/                    Next.js routes (pages + app/api route handlers)
components/             UI (TaskRunner, LabRunner, Certificates, Sidebar, …)
lib/scoring/            Pure scoring engine: rubric, metrics, technique detection, feedback, progression
lib/server/db/          Drizzle schema, client (PGlite | Postgres), migrations, seed data
lib/server/services/    Accounts, attempts, catalog/leaderboards, Local Lab, certification
lib/server/             DAL (auth), HTTP helpers, LLM providers, credential signing
proxy.ts                Optimistic redirect for signed-out visitors (real checks live in the DAL)
tests/                  Vitest suites
research/               The research study behind the feedback (separate repository)
```
