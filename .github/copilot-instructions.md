# Copilot Instructions — Eburon AI

## About this project

**Eburon AI** (`src/lib/brand.ts`) is a voice, agents, and call automation console built with Next.js 16 (App Router), React 19, Supabase, VAPI/Orbit (AI phone agents), ElevenLabs/Echo (TTS), and Deepgram (STT). Tailwind CSS v4 + the OAT CSS framework (`@knadh/oat`) are used for styling.

## Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # Run ESLint
npm run smoke     # Full smoke: lint + build + route checks (no unit test framework)
```

There is no unit test runner. `npm run smoke` is the full verification pipeline.

## Architecture

```
src/
  app/             # Next.js App Router — pages and API routes
    api/           # API routes: orbit/, voice/tts/, voice/stt/, agents/, calls/, billing/, etc.
    admin/         # Admin dashboard page
    billing/       # Billing page
  lib/
    eburon/        # Core alias routing & whitelist engine (barrel: @/lib/eburon)
    eburon-alias-router.ts  # TTS/STT alias resolution (resolveEchoAlias)
    services/      # External provider clients: echo.ts (ElevenLabs), orbit.ts (VAPI), deepgram.ts
    tools/         # Server-side tools (twilio-sms.ts)
    api-key-auth.ts     # Dual-auth helper (Supabase JWT + API key)
    supabase.ts         # Browser client (with mock fallback if unconfigured)
    supabase-server.ts  # Request-scoped server client
    supabase-admin.ts   # Service-role admin client
    brand.ts            # Platform name constants
  components/      # Shared UI components
  types/           # Global TypeScript declarations (speech.d.ts)
supabase/
  migrations/      # SQL migrations: tts_history, user_assistants, api_keys/api_usage, user_agents
IberonKit/         # Self-hosted LiveKit stack (Docker Compose) — separate from Next.js app
agent/             # Agent contract/governance docs — not runtime code
```

`/api/v1/*` is rewritten to `/api/*` in `next.config.ts` for versioned API compatibility.

## Key conventions

### Stealth mode (critical)
Provider brand names are **never** exposed to clients. All error messages and API responses must strip or replace: `elevenlabs`, `11labs`, `openai`, `vapi`, `deepgram`. Use `sanitizeErrorMessage()` from `@/lib/eburon`. The TTS service in `src/lib/services/echo.ts` demonstrates this pattern.

### Alias routing — always use Eburon model IDs
Upstream vendor model strings (e.g., `eleven_flash_v2_5`, `gpt-4o-mini`) must **never** appear in client-facing code or API responses. All model references use Eburon canonical aliases: `<capability>/<alias>_<family>-<version>` (e.g., `tts/echo_flash-v2.5`, `llm/codemax_4o-mini`).

- For TTS: use `resolveEchoAlias(modelId)` from `@/lib/eburon-alias-router`
- For the full alias+whitelist pipeline: use `evaluateRoute()` from `@/lib/eburon`
- The registry lives in `src/lib/eburon/config/alias-registry.json` — add new models there
- Client code receives canonical alias IDs only; upstream model IDs live server-side

### Error handling
Use the two-layer error system from `@/lib/eburon`:
- `EburonError` — internal structured error with HTTP status and error code (`EBRN_*`)
- `publicError()` — UI-safe error shape (no sensitive detail)
- `eburonJsonResponse(err)` — produces `[body, { status }]` for `NextResponse.json(...)`
- `toEburonError(err)` — converts any caught error to an `EburonError`

```ts
import { EburonError, toEburonError, eburonJsonResponse } from '@/lib/eburon';

try { /* ... */ }
catch (err) {
  const e = toEburonError(err);
  return NextResponse.json(...eburonJsonResponse(e));
}
```

### Authentication
API routes use `requireApiPrincipal(request)` from `@/lib/api-key-auth`. It supports two auth paths:
1. Supabase JWT (browser sessions via `Authorization: Bearer <supabase-token>`)
2. API keys via `x-api-key` header or `Authorization: Bearer <vph_...>` (SHA-256 hashed, stored in `api_keys` table)

API keys use the prefix `vph_`. Only the first 18 chars are stored for display (`key_prefix`).

### Supabase client selection
- `supabase` (from `@/lib/supabase`) — browser/client components only; degrades to a mock client when env vars are missing
- `createSupabaseClientFromRequest(request)` (`@/lib/supabase-server`) — server components and API routes with user context
- `getSupabaseAdminClient()` (`@/lib/supabase-admin`) — service-role operations (API key validation, admin writes); requires `SUPABASE_SERVICE_ROLE_KEY`

### API usage logging
After authenticated API route calls, log via `logApiUsage()` from `@/lib/api-key-auth`. It writes to the `api_usage` table.

## Environment variables

See `VERCEL_ENV.md` for the full reference. Key variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase auth/DB |
| `TTS_PROVIDER_KEY` / `ECHO_PROVIDER_KEY` / `ELEVENLABS_API_KEY` | TTS provider (any one) |
| `VAPI_PRIVATE_API_KEY` / `ORBIT_SECRET` | VAPI/Orbit server-side agents |
| `NEXT_PUBLIC_ORBIT_TOKEN` | Orbit public key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for admin client (`supabase-admin.ts`) — API key validation, usage logging |
| `DEEPGRAM_API_KEY` | STT transcription (optional `DEEPGRAM_MODEL`, defaults to `nova-3`) |
| `GEMINI_API_KEY` | Primary LLM for expression enhancer |
| `LIVEKIT_URL` + `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` | LiveKit web calls (optional) |
