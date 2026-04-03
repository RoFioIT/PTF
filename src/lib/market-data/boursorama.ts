// ============================================================
// Market Data — Boursorama Provider
//
// Uses Boursorama's internal chart API (no authentication needed).
// Primarily used for French OPCVM / mutual funds not available
// on Yahoo Finance (e.g. PEA Profile Dynamique: 0P0001PRAT).
//
// API endpoint:
//   https://www.boursorama.com/bourse/action/graph/ws/GetTicksEOD
//   ?symbol={symbol}&length={days}&period=0&guid=
//
// Notes:
//   - `length` = number of calendar days to look back (max ~750)
//   - `d` field in each quote = days since Unix epoch (1970-01-01)
//   - Returns only trading days (~65% of calendar days)
//   - Rate-limited: requests >750 days or too frequent return []
// ============================================================

import type { MarketDataProvider, AssetIdentifierQuery, Quote, PricePoint } from './types'
import { MarketDataError } from './types'
import type { IdentifierType } from '@/types/database'

const BASE_URL = 'https://www.boursorama.com/bourse/action/graph/ws/GetTicksEOD'
const MAX_LENGTH = 730   // ~2 years — Boursorama hard cap
const RETRY_DELAY = 2000 // ms to wait before retry

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.boursorama.com/',
  'Accept': 'application/json, text/javascript, */*',
  'X-Requested-With': 'XMLHttpRequest',
}

/** Convert Boursorama day-serial to ISO date string */
function serialToDate(serial: number): string {
  return new Date(serial * 86_400_000).toISOString().slice(0, 10)
}

interface BoursoramaQuote {
  d: number   // days since Unix epoch
  o: number   // open
  h: number   // high
  l: number   // low
  c: number   // close
  v: number   // volume
}

interface BoursoramaResponse {
  d: {
    Name: string
    SymbolId: string
    QuoteTab: BoursoramaQuote[]
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchTicks(symbol: string, days: number, attempt = 1): Promise<BoursoramaQuote[]> {
  const length = Math.min(days, MAX_LENGTH)
  const url = `${BASE_URL}?symbol=${encodeURIComponent(symbol)}&length=${length}&period=0&guid=`

  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) {
    throw new Error(`Boursorama HTTP ${res.status} for "${symbol}"`)
  }

  const json: BoursoramaResponse | [] = await res.json()

  // [] = rate-limited or no data — retry once after a delay
  if (Array.isArray(json)) {
    if (attempt >= 2) {
      throw new Error(`Boursorama returned no data for "${symbol}" after ${attempt} attempts (possibly rate-limited)`)
    }
    await sleep(RETRY_DELAY)
    return fetchTicks(symbol, days, attempt + 1)
  }

  return json?.d?.QuoteTab ?? []
}

export class BoursoramaProvider implements MarketDataProvider {
  readonly name = 'boursorama'

  supportsIdentifierType(type: IdentifierType): boolean {
    return type === 'BOURSORAMA'
  }

  async getQuote(identifier: AssetIdentifierQuery): Promise<Quote> {
    try {
      const ticks = await fetchTicks(identifier.value, 5)
      if (ticks.length === 0) {
        throw new Error('No ticks returned')
      }
      const last = ticks[ticks.length - 1]

      return {
        price: last.c,
        currency: 'EUR',
        timestamp: new Date(serialToDate(last.d)),
        source: this.name,
      }
    } catch (err) {
      throw new MarketDataError(
        err instanceof Error ? err.message : String(err),
        this.name,
        identifier
      )
    }
  }

  async getHistoricalPrices(
    identifier: AssetIdentifierQuery,
    from: string,
    to: string
  ): Promise<PricePoint[]> {
    try {
      const fromMs = new Date(from).getTime()
      const toMs = new Date(to).getTime()
      // Add a small buffer; cap at Boursorama's limit
      const requestedDays = Math.ceil((toMs - fromMs) / 86_400_000) + 5

      const ticks = await fetchTicks(identifier.value, requestedDays)

      return ticks
        .filter((t) => {
          const date = serialToDate(t.d)
          return date >= from && date <= to
        })
        .map((t) => ({
          date: serialToDate(t.d),
          close: t.c,
          open: t.o,
          high: t.h,
          low: t.l,
          volume: t.v,
          currency: 'EUR',
        }))
    } catch (err) {
      throw new MarketDataError(
        err instanceof Error ? err.message : String(err),
        this.name,
        identifier
      )
    }
  }
}
