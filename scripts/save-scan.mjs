/**
 * save-scan.mjs
 * Saves a /ptf-ai-chk scan result to Supabase.
 *
 * Run: node /Users/roberto/Documents/LocalProjet/PTF/scripts/save-scan.mjs '<json_payload>'
 *
 * JSON payload shape:
 * {
 *   "scanned_at": "YYYY-MM-DD",
 *   "sector_focus": "defense",
 *   "market_regime": "LOW VOL BULL",
 *   "vix_level": 17.5,
 *   "notes": "...",
 *   "instruments": [
 *     { "ticker": "HO.PA", "name": "Thales", "instrument_type": "stock",
 *       "market": "EU", "sector_or_theme": "Defense Electronics",
 *       "price": 227, "price_currency": "EUR", "pe_forward": 19.7,
 *       "perf_3m": -8.0, "analyst_consensus": "Buy", "score": 17,
 *       "signal": "BUY", "pea_eligible": true, "note": "..." },
 *     { "ticker": "GUARD", "name": "BNP Easy Bloomberg EU Defense",
 *       "instrument_type": "etf", "market": "EU", "sector_or_theme": "EU Defense",
 *       "price": 100, "price_currency": "EUR", "ter": 0.18, "perf_3m": -13.8,
 *       "aum_eur_m": 497, "score": 15, "signal": "BUY", "pea_eligible": true, "note": "..." }
 *   ]
 * }
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// ── Env ──────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const projectRoot = resolve(dirname(__filename), '..')

function parseEnvFile(filePath) {
  const env = {}
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

const env = parseEnvFile(resolve(projectRoot, '.env.local'))
const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// ── Parse payload ─────────────────────────────────────────────────────────────

const raw = process.argv[2]
if (!raw) {
  console.error('❌ Usage: node save-scan.mjs \'<json_payload>\'')
  process.exit(1)
}

let payload
try {
  payload = JSON.parse(raw)
} catch {
  console.error('❌ Invalid JSON payload')
  process.exit(1)
}

const { scanned_at, sector_focus, market_regime, vix_level, notes, instruments } = payload

if (!sector_focus) {
  console.error('❌ Payload must include sector_focus')
  process.exit(1)
}
if (!Array.isArray(instruments) || instruments.length === 0) {
  console.error('❌ Payload must include a non-empty instruments array')
  process.exit(1)
}

// ── Supabase client (service role) ────────────────────────────────────────────

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

// ── Resolve user_id ───────────────────────────────────────────────────────────

const { data: { users }, error: usersErr } = await supabase.auth.admin.listUsers()
if (usersErr) {
  console.error('❌ Failed to list users:', usersErr.message)
  process.exit(1)
}
if (!users || users.length === 0) {
  console.error('❌ No users found in Supabase auth')
  process.exit(1)
}
const userId = users[0].id

// ── Insert scan session ───────────────────────────────────────────────────────

const { data: session, error: sessErr } = await supabase
  .from('scan_sessions')
  .insert({
    user_id: userId,
    scanned_at: scanned_at ?? new Date().toISOString().slice(0, 10),
    sector_focus,
    market_regime: market_regime ?? null,
    vix_level: vix_level ?? null,
    notes: notes ?? null,
  })
  .select()
  .single()

if (sessErr) {
  console.error('❌ Failed to insert scan session:', sessErr.message)
  process.exit(1)
}

// ── Insert instruments ────────────────────────────────────────────────────────

const rows = instruments.map((inst) => ({
  session_id: session.id,
  ticker: inst.ticker,
  name: inst.name,
  instrument_type: inst.instrument_type,
  market: inst.market ?? null,
  sector_or_theme: inst.sector_or_theme ?? null,
  price: inst.price ?? null,
  price_currency: inst.price_currency ?? 'EUR',
  pe_forward: inst.pe_forward ?? null,
  perf_3m: inst.perf_3m ?? null,
  analyst_consensus: inst.analyst_consensus ?? null,
  score: inst.score ?? null,
  signal: inst.signal,
  pea_eligible: inst.pea_eligible ?? null,
  ter: inst.ter ?? null,
  aum_eur_m: inst.aum_eur_m ?? null,
  note: inst.note ?? null,
  entry_price_low:  inst.entry_price_low  ?? null,
  entry_price_high: inst.entry_price_high ?? null,
}))

const { error: instErr } = await supabase.from('scan_instruments').insert(rows)

if (instErr) {
  console.error('❌ Failed to insert scan instruments:', instErr.message)
  // Roll back the session
  await supabase.from('scan_sessions').delete().eq('id', session.id)
  process.exit(1)
}

console.log(`✓ Saved scan session ${session.id} (${instruments.length} instruments) — visible at /scans`)
