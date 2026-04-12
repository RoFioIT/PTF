import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const ALLOWED_ORIGINS = [
  'https://app.bankin.com',
  'https://app2.bankin.com',
]

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : null
  if (!allowed) return {}
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  }
}

// Preflight
export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

interface BankinAccount {
  mappingKey: string
  balance: number
  currency?: string
}

// POST — receive scraped Bankin' data, resolve mapping, upsert snapshots
// Auth: Authorization: Bearer <supabase_access_token>
// Body: { quarter: 'YYYY-QN', accounts: [{mappingKey, balance, currency}] }
export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  const cors = corsHeaders(origin)

  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Bearer token required' }, { status: 401, headers: cors })
  }
  const token = authHeader.slice(7)

  // Authenticate using the user's JWT against the anon-key client (RLS applies)
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })
  }

  let body: { quarter: string; accounts: BankinAccount[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: cors })
  }

  const { quarter, accounts } = body
  if (!quarter || !Array.isArray(accounts) || accounts.length === 0) {
    return NextResponse.json({ error: 'Missing quarter or accounts' }, { status: 400, headers: cors })
  }
  if (!/^\d{4}-Q[1-4]$/.test(quarter)) {
    return NextResponse.json({ error: 'Invalid quarter format (expected YYYY-Q1..Q4)' }, { status: 400, headers: cors })
  }

  // Load mapping rules from DB (RLS ensures only this user's rules)
  const { data: mappingRows, error: mapErr } = await supabase
    .from('bankin_mappings')
    .select('mapping_key, account_id')

  if (mapErr) {
    return NextResponse.json({ error: mapErr.message }, { status: 500, headers: cors })
  }

  // Build lookup: mappingKey → accountId | null (null = skip)
  const mapping = new Map<string, string | null>()
  for (const row of mappingRows ?? []) {
    mapping.set(row.mapping_key, row.account_id ?? null)
  }

  // Resolve each account
  // Use a Map to deduplicate by account_id — if two Bankin' rows resolve to the
  // same PTF account (e.g. duplicate entries in scrape), keep the larger balance.
  const upsertMap = new Map<string, number>()
  const skipped: string[] = []
  const unmapped: string[] = []

  for (const acc of accounts) {
    if (!mapping.has(acc.mappingKey)) {
      unmapped.push(acc.mappingKey)
      continue
    }
    const accountId = mapping.get(acc.mappingKey)
    if (accountId === null) {
      skipped.push(acc.mappingKey)
      continue
    }
    const existing = upsertMap.get(accountId!) ?? 0
    upsertMap.set(accountId!, existing + acc.balance)
  }

  const toUpsert = Array.from(upsertMap.entries()).map(([account_id, balance]) => ({
    account_id,
    quarter,
    balance,
  }))

  // Upsert snapshots
  if (toUpsert.length > 0) {
    const { error: upsertErr } = await supabase
      .from('cash_account_snapshots')
      .upsert(toUpsert, { onConflict: 'account_id,quarter' })
    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500, headers: cors })
    }
  }

  return NextResponse.json(
    { ok: true, quarter, imported: toUpsert.length, skipped: skipped.length, unmapped },
    { headers: cors }
  )
}
