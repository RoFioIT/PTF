// ============================================================
// DB Layer — Asset Prices (cache)
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AssetPrice } from '@/types/database'
import type { FinPricePoint } from '@/lib/finance/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export interface UpsertPriceInput {
  asset_id: string
  price: number
  currency: string
  date: string
  source?: string
}

export async function getLatestPrice(
  client: Client,
  assetId: string,
  currency?: string
): Promise<AssetPrice | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = client.from('asset_prices').select('*').eq('asset_id', assetId)
  if (currency) q = q.eq('currency', currency)
  const { data, error } = await q.order('date', { ascending: false }).limit(1).single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`getLatestPrice: ${error.message}`)
  }
  return data
}

export async function getPriceHistory(
  client: Client,
  assetId: string,
  from: string,
  to: string,
  currency?: string
): Promise<AssetPrice[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = client
    .from('asset_prices')
    .select('*')
    .eq('asset_id', assetId)
    .gte('date', from)
    .lte('date', to)
  if (currency) q = q.eq('currency', currency)
  const { data, error } = await q.order('date', { ascending: true })

  if (error) throw new Error(`getPriceHistory: ${error.message}`)
  return data ?? []
}

/**
 * upsertPrice — insert or update a single price point.
 * Safe to call repeatedly with the same (asset_id, date, currency) key.
 */
export async function upsertPrice(
  client: Client,
  input: UpsertPriceInput
): Promise<void> {
  const { error } = await client
    .from('asset_prices')
    .upsert(input, { onConflict: 'asset_id,date,currency' })

  if (error) throw new Error(`upsertPrice: ${error.message}`)
}

/**
 * upsertPriceBatch — efficiently insert multiple price points.
 * Used when seeding historical data from a market data provider.
 */
export async function upsertPriceBatch(
  client: Client,
  rows: UpsertPriceInput[]
): Promise<void> {
  if (rows.length === 0) return

  // Deduplicate by (asset_id, date, currency) — keep last occurrence
  // Needed when a provider returns two points that collapse to the same date after transformation
  const seen = new Map<string, UpsertPriceInput>()
  for (const row of rows) {
    seen.set(`${row.asset_id}|${row.date}|${row.currency}`, row)
  }
  const deduped = [...seen.values()]

  const { error } = await client
    .from('asset_prices')
    .upsert(deduped, { onConflict: 'asset_id,date,currency' })

  if (error) throw new Error(`upsertPriceBatch: ${error.message}`)
}

export function toFinPricePoint(p: AssetPrice): FinPricePoint {
  return { date: p.date, price: Number(p.price) }
}
