// ============================================================
// DB Layer — Dividends
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Dividend, DividendWithAsset } from '@/types/database'
import type { FinDividend } from '@/lib/finance/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export interface CreateDividendInput {
  portfolio_id: string
  asset_id: string
  amount: number
  tax?: number
  currency?: string
  date: string
  notes?: string
}

export async function getDividendsByPortfolio(
  client: Client,
  portfolioId: string
): Promise<DividendWithAsset[]> {
  const { data, error } = await client
    .from('dividends')
    .select('*, asset:assets(*)')
    .eq('portfolio_id', portfolioId)
    .order('date', { ascending: false })

  if (error) throw new Error(`getDividendsByPortfolio: ${error.message}`)
  return (data ?? []) as DividendWithAsset[]
}

export async function createDividend(
  client: Client,
  input: CreateDividendInput
): Promise<Dividend> {
  const { data, error } = await client
    .from('dividends')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`createDividend: ${error.message}`)
  return data
}

export async function deleteDividend(client: Client, id: string): Promise<void> {
  const { error } = await client.from('dividends').delete().eq('id', id)
  if (error) throw new Error(`deleteDividend: ${error.message}`)
}

export function toFinDividend(d: Dividend): FinDividend {
  return {
    id: d.id,
    assetId: d.asset_id,
    amount: Number(d.amount),
    tax: Number(d.tax),
    currency: d.currency,
    date: d.date,
  }
}
