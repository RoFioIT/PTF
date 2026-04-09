// ============================================================
// API Route — POST /api/prices
//
// Fetches monthly historical closing prices for all assets:
//   • GOOGLE_SYMBOL → Yahoo Finance (stocks, ETFs)
//   • BOURSORAMA    → Boursorama (French OPCVM / mutual funds)
//
// Uses service role key to write to asset_prices (bypasses RLS).
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { YahooFinanceProvider } from '@/lib/market-data/yahoo-finance'
import { BoursoramaProvider } from '@/lib/market-data/boursorama'
import { upsertPriceBatch } from '@/lib/db/prices'
import type { IdentifierType } from '@/types/database'

export const dynamic = 'force-dynamic'
export const maxDuration = 60   // Vercel: allow up to 60s for batch price fetches

const HISTORY_MONTHS = 36

function startDate(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - HISTORY_MONTHS)
  return d.toISOString().slice(0, 10)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── GET — diagnostic endpoint ─────────────────────────────────
// Quickly checks env vars and DB connectivity without fetching prices.
export async function GET() {
  const checks: Record<string, string> = {}

  checks.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING'
  checks.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING'

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, checks }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  // All identifiers (no type filter)
  const { data: allIds, error: idsError } = await supabase
    .from('asset_identifiers')
    .select('type, value')

  if (idsError) {
    checks.db = `ERROR: ${idsError.message}`
    return NextResponse.json({ ok: false, checks }, { status: 500 })
  }

  // All assets
  const { data: assets, error: assetsError } = await supabase
    .from('assets')
    .select('id, name')
    .limit(20)

  if (assetsError) {
    checks.assets = `ERROR: ${assetsError.message}`
  }

  checks.db = 'ok'
  checks.all_identifiers = `${allIds?.length ?? 0} total rows`
  checks.assets = `${assets?.length ?? 0} assets found`
  const byType: Record<string, number> = {}
  for (const row of allIds ?? []) {
    byType[row.type] = (byType[row.type] ?? 0) + 1
  }

  return NextResponse.json({ ok: true, checks, byType, assets, allIdentifiers: allIds })
}

// ── POST — fetch and store prices ─────────────────────────────
export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const yahoo = new YahooFinanceProvider()
  const boursorama = new BoursoramaProvider()

  const PROVIDERS = {
    GOOGLE_SYMBOL: yahoo,
    BOURSORAMA: boursorama,
  } as const

  type SupportedType = keyof typeof PROVIDERS

  const { data: identifiers, error } = await supabase
    .from('asset_identifiers')
    .select('asset_id, type, value, assets(name, currency)')
    .in('type', Object.keys(PROVIDERS) as SupportedType[])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!identifiers || identifiers.length === 0) {
    return NextResponse.json({ ok: true, fetched: 0, totalPricePoints: 0, failed: 0, results: [] })
  }

  const from = startDate()
  const to = today()

  // Fetch all assets in parallel
  const settled = await Promise.allSettled(
    identifiers.map(async (row) => {
      const assetId: string = row.asset_id
      const identifierType = row.type as SupportedType
      const symbol: string = row.value
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const assetName: string = (row.assets as any)?.name ?? assetId
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const assetCurrency: string = (row.assets as any)?.currency ?? 'EUR'
      const provider = PROVIDERS[identifierType]

      const prices = identifierType === 'GOOGLE_SYMBOL'
        ? await (provider as YahooFinanceProvider).getHistoricalPrices(
            { type: identifierType as IdentifierType, value: symbol }, from, to, '1mo'
          )
        : await provider.getHistoricalPrices(
            { type: identifierType as IdentifierType, value: symbol }, from, to
          )

      if (prices.length === 0) throw new Error('No data returned')

      const rows = prices.map((p) => ({
        asset_id: assetId,
        price: p.close,
        currency: p.currency ?? assetCurrency,
        date: p.date,
        source: provider.name,
      }))

      await upsertPriceBatch(supabase, rows)
      return { assetId, name: assetName, symbol, provider: provider.name, points: prices.length }
    })
  )

  const results = settled.map((s, i) => {
    const row = identifiers[i]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name: string = (row.assets as any)?.name ?? row.asset_id
    if (s.status === 'fulfilled') return s.value
    return {
      assetId: row.asset_id,
      name,
      symbol: row.value,
      provider: row.type === 'BOURSORAMA' ? 'boursorama' : 'yahoo-finance',
      points: 0,
      error: s.reason instanceof Error ? s.reason.message : String(s.reason),
    }
  })

  const total = results.reduce((s, r) => s + r.points, 0)
  const failed = results.filter((r) => 'error' in r && r.error)

  return NextResponse.json({
    ok: true,
    fetched: results.length,
    totalPricePoints: total,
    failed: failed.length,
    results,
  })
}
