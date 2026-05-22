import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveAssetByIdentifier } from '@/lib/db/assets'
import YahooFinance from 'yahoo-finance2'
import type { AssetType } from '@/types/database'

const yahooFinance = new YahooFinance()

export const dynamic = 'force-dynamic'

// Preferred exchange suffixes in priority order (EU-first for a French portfolio)
const EXCHANGE_PRIORITY = ['.PA', '.DE', '.AS', '.MI', '.BR', '.LS', '.MC', '.HE', '.ST', '.CO', '.OL', '.L', '.TO', '.AX']

function rankTicker(symbol: string): number {
  for (let i = 0; i < EXCHANGE_PRIORITY.length; i++) {
    if (symbol.endsWith(EXCHANGE_PRIORITY[i])) return i
  }
  return EXCHANGE_PRIORITY.length // US (no suffix) is deprioritized
}

function mapQuoteType(quoteType: string): AssetType {
  switch (quoteType?.toUpperCase()) {
    case 'EQUITY': return 'stock'
    case 'ETF': return 'etf'
    case 'MUTUALFUND': return 'etf'
    case 'CRYPTOCURRENCY': return 'crypto'
    case 'BOND': return 'bond'
    default: return 'other'
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const isin = (searchParams.get('isin') ?? '').trim().toUpperCase()

  if (!isin || !/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)) {
    return NextResponse.json({ error: 'Invalid ISIN format' }, { status: 400 })
  }

  // Return existing asset immediately if ISIN is already in the DB
  try {
    const existing = await resolveAssetByIdentifier(supabase, 'ISIN', isin)
    if (existing) {
      return NextResponse.json({ existing: true, asset: existing })
    }
  } catch {
    // resolveAssetByIdentifier only throws on unexpected DB errors; log and continue
  }

  // Search Yahoo Finance by ISIN
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchResult: any = await yahooFinance.search(isin, { newsCount: 0 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotes: any[] = (searchResult.quotes ?? []).filter((q: any) => q.symbol && q.quoteType !== 'FUTURE' && q.quoteType !== 'INDEX')

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    // Sort by exchange preference: EU exchanges first, US last
    quotes.sort((a, b) => rankTicker(a.symbol ?? '') - rankTicker(b.symbol ?? ''))
    const best = quotes[0]
    const ticker: string = best.symbol

    // Fetch detailed metadata for the best-ranked ticker
    let name: string = best.longname ?? best.shortname ?? ticker
    let currency = 'EUR'
    let asset_type: AssetType = mapQuoteType(best.quoteType ?? '')

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const summary: any = await yahooFinance.quoteSummary(ticker, { modules: ['price'] })
      const p = summary?.price
      if (p) {
        name = p.longName ?? p.shortName ?? name
        currency = p.currency ?? currency
        asset_type = mapQuoteType(p.quoteType ?? best.quoteType ?? '')
      }
    } catch {
      // quoteSummary failed — use search result data as-is
    }

    return NextResponse.json({ existing: false, ticker, name, currency, asset_type, isin })
  } catch {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 502 })
  }
}
