// ============================================================
// API Route — POST /api/dividends
//
// Fetches historical dividend events from Yahoo Finance for all
// assets that have a GOOGLE_SYMBOL identifier, then stores them
// in the dividends table — weighted by the user's actual holdings
// on each ex-dividend date.
//
// Logic:
//   1. For each asset, fetch per-share dividend events from Yahoo
//   2. For each portfolio, compute shares held on the ex-date
//      (from transactions up to that date)
//   3. total_dividend = shares_held × amount_per_share
//   4. Upsert into dividends table (skip if already exists)
// ============================================================

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { googleToYahoo } from '@/lib/market-data/yahoo-finance'

export const dynamic = 'force-dynamic'

const YAHOO_RANGE = '5y'

interface YahooDividendEvent {
  amount: number
  date: number   // Unix timestamp (seconds)
}

async function fetchYahooDividends(
  yahooTicker: string
): Promise<YahooDividendEvent[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}` +
    `?events=div&interval=1d&range=${YAHOO_RANGE}`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PTF-tracker/1.0)' },
  })

  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status} for ${yahooTicker}`)

  const json = await res.json()
  const dividends = json?.chart?.result?.[0]?.events?.dividends as
    Record<string, YahooDividendEvent> | undefined

  if (!dividends) return []
  return Object.values(dividends)
}

/** Compute shares held for a set of transactions up to (and including) a given date */
function sharesHeldAtDate(
  transactions: Array<{ type: string; quantity: number; date: string }>,
  date: string
): number {
  return transactions
    .filter((tx) => tx.date <= date)
    .reduce(
      (shares, tx) =>
        tx.type === 'BUY' ? shares + Number(tx.quantity) : shares - Number(tx.quantity),
      0
    )
}

export async function POST() {
  const cookieStore = await cookies()

  // Authenticated client — respects RLS, user sees only their own data
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. Get all assets with a GOOGLE_SYMBOL
  const { data: identifiers, error: idErr } = await supabase
    .from('asset_identifiers')
    .select('asset_id, value, assets(name, currency)')
    .eq('type', 'GOOGLE_SYMBOL')

  if (idErr) return NextResponse.json({ error: idErr.message }, { status: 500 })

  // 2. Get all portfolios for this user
  const { data: portfolios, error: pErr } = await supabase
    .from('portfolios')
    .select('id, name, type, base_currency')
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const results: Array<{
    asset: string
    ticker: string
    dividends: number
    imported: number
    skipped: number
    error?: string
  }> = []

  for (const row of identifiers ?? []) {
    const assetId: string = row.asset_id
    const googleSymbol: string = row.value
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assetName: string = (row.assets as any)?.name ?? assetId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assetCurrency: string = (row.assets as any)?.currency ?? 'EUR'

    const yahooTicker = googleToYahoo(googleSymbol)
    if (!yahooTicker) {
      results.push({ asset: assetName, ticker: googleSymbol, dividends: 0, imported: 0, skipped: 0, error: 'Cannot convert to Yahoo ticker' })
      continue
    }

    try {
      const events = await fetchYahooDividends(yahooTicker)

      let imported = 0
      let skipped = 0

      for (const event of events) {
        const exDate = new Date(event.date * 1000).toISOString().slice(0, 10)

        for (const portfolio of portfolios ?? []) {
          // Get transactions for this asset in this portfolio up to ex-date
          const { data: txs } = await supabase
            .from('transactions')
            .select('type, quantity, date')
            .eq('portfolio_id', portfolio.id)
            .eq('asset_id', assetId)
            .lte('date', exDate)
            .order('date', { ascending: true })

          if (!txs || txs.length === 0) continue

          const sharesHeld = sharesHeldAtDate(txs, exDate)
          if (sharesHeld <= 0) continue

          const totalAmount = sharesHeld * event.amount

          // Check if dividend already exists (avoid duplicates)
          const { data: existing } = await supabase
            .from('dividends')
            .select('id')
            .eq('portfolio_id', portfolio.id)
            .eq('asset_id', assetId)
            .eq('date', exDate)
            .single()

          if (existing) {
            skipped++
            continue
          }

          // PEA dividends: re-invested (no withholding tax in France)
          // CTO dividends: 30% flat tax (PFU) for French residents
          const tax = portfolio.type === 'CTO' ? totalAmount * 0.30 : 0

          const { error: insertErr } = await supabase.from('dividends').insert({
            portfolio_id: portfolio.id,
            asset_id: assetId,
            amount: totalAmount,
            tax,
            currency: assetCurrency,
            date: exDate,
            notes: `Imported from Yahoo Finance — ${sharesHeld.toFixed(4)} shares × €${event.amount}/share`,
          })

          if (insertErr) {
            console.error(`Insert dividend error: ${insertErr.message}`)
          } else {
            imported++
          }
        }
      }

      results.push({
        asset: assetName,
        ticker: yahooTicker,
        dividends: events.length,
        imported,
        skipped,
      })
    } catch (err) {
      results.push({
        asset: assetName,
        ticker: yahooTicker,
        dividends: 0,
        imported: 0,
        skipped: 0,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    await new Promise((r) => setTimeout(r, 300))
  }

  const totalImported = results.reduce((s, r) => s + r.imported, 0)
  const totalSkipped = results.reduce((s, r) => s + r.skipped, 0)
  const failed = results.filter((r) => r.error).length

  return NextResponse.json({ ok: true, totalImported, totalSkipped, failed, results })
}
