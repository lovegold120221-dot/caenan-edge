#!/usr/bin/env bash
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${CYAN}[caenan]${NC} $*"; }
ok()   { echo -e "${GREEN}[caenan]${NC} $*"; }
warn() { echo -e "${YELLOW}[caenan]${NC} $*"; }
err()  { echo -e "${RED}[caenan]${NC} $*"; exit 1; }

cd "$(dirname "$0")"

# ── 1. Prerequisites ─────────────────────────────────────────────────────────
command -v node   >/dev/null 2>&1 || err "node is not installed"
command -v npm    >/dev/null 2>&1 || err "npm is not installed"
command -v supabase >/dev/null 2>&1 || err "supabase CLI is not installed (brew install supabase/tap/supabase)"
command -v docker >/dev/null 2>&1 || err "docker is not installed or not running"

# ── 2. .env.local check ───────────────────────────────────────────────────────
if [ ! -f .env.local ]; then
  err ".env.local not found — copy .env.example or create it with your keys"
fi
ok ".env.local found"

# ── 3. npm install (only if node_modules missing or package.json newer) ───────
if [ ! -d node_modules ] || [ package.json -nt node_modules/.package-lock.json ]; then
  log "Installing npm dependencies..."
  npm install --silent
  ok "Dependencies installed"
else
  ok "node_modules up-to-date"
fi

# ── 4. Local Supabase ─────────────────────────────────────────────────────────
log "Checking local Supabase..."
if supabase status 2>/dev/null | grep -q "API URL"; then
  ok "Supabase already running"
else
  log "Starting local Supabase (this may take a minute on first run)..."
  supabase start
  ok "Supabase started"
fi

# ── 5. Apply pending migrations ───────────────────────────────────────────────
log "Applying database migrations..."
supabase db push --local 2>/dev/null || supabase migration up 2>/dev/null || warn "Migration step skipped (no pending migrations or already applied)"

# ── 6. Print connection info ──────────────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Caenan Local Edge${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  App:          ${GREEN}http://localhost:3375${NC}"
echo -e "  Supabase API: ${CYAN}http://127.0.0.1:54321${NC}"
echo -e "  Supabase Studio: ${CYAN}http://127.0.0.1:54323${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── 7. Start Next.js dev server ───────────────────────────────────────────────
log "Starting Next.js dev server..."
npm run dev
