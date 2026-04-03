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

const HISTORY_MONTHS = 36

function startDate(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - HISTORY_MONTHS)
  return d.toISOString().slice(0, 10)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// Provider map: identifier type → provider instance
const PROVIDERS = {
  GOOGLE_SYMBOL: new YahooFinanceProvider(),
  BOURSORAMA: new BoursoramaProvider(),
} as const

type SupportedType = keyof typeof PROVIDERS

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Fetch all identifiers we know how to price
  const supportedTypes = Object.keys(PROVIDERS) as SupportedType[]

  const { data: identifiers, error } = await supabase
    .from('asset_identifiers')
    .select('asset_id, type, value, assets(name, currency)')
    .in('type', supportedTypes)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const from = startDate()
  const to = today()

  const results: Array<{
    assetId: string
    name: string
    symbol: string
    provider: string
    points: number
    error?: string
  }> = []

  for (const row of identifiers ?? []) {
    const assetId: string = row.asset_id
    const identifierType = row.type as SupportedType
    const symbol: string = row.value
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assetName: string = (row.assets as any)?.name ?? assetId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assetCurrency: string = (row.assets as any)?.currency ?? 'EUR'

    const provider = PROVIDERS[identifierType]

    try {
      // Yahoo: fetch monthly candles. Boursorama: fetch daily then we store each point.
      let prices
      if (identifierType === 'GOOGLE_SYMBOL') {
        prices = await (provider as YahooFinanceProvider).getHistoricalPrices(
          { type: identifierType as IdentifierType, value: symbol },
          from, to,
          '1mo'  // monthly interval
        )
      } else {
        prices = await provider.getHistoricalPrices(
          { type: identifierType as IdentifierType, value: symbol },
          from, to
        )
      }

      if (prices.length === 0) {
        results.push({ assetId, name: assetName, symbol, provider: provider.name, points: 0, error: 'No data returned' })
        continue
      }

      const rows = prices.map((p) => ({
        asset_id: assetId,
        price: p.close,
        currency: p.currency ?? assetCurrency,
        date: p.date,
        source: provider.name,
      }))

      await upsertPriceBatch(supabase, rows)
      results.push({ assetId, name: assetName, symbol, provider: provider.name, points: prices.length })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ assetId, name: assetName, symbol, provider: provider.name, points: 0, error: msg })
    }

    // Polite delay between requests
    await new Promise((r) => setTimeout(r, 300))
  }

  const total = results.reduce((s, r) => s + r.points, 0)
  const failed = results.filter((r) => r.error)

  return NextResponse.json({
    ok: true,
    fetched: results.length,
    totalPricePoints: total,
    failed: failed.length,
    results,
  })
}
