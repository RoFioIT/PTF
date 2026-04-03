// ============================================================
// DB Layer — Portfolios
// ============================================================
// All functions expect a Supabase server client.
// RLS ensures users only see their own portfolios.
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Portfolio, PortfolioType, AccountingMethod } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export interface CreatePortfolioInput {
  user_id: string
  name: string
  type: PortfolioType
  base_currency?: string
  accounting_method?: AccountingMethod
  description?: string
}

export interface UpdatePortfolioInput {
  name?: string
  description?: string
  accounting_method?: AccountingMethod
}

export async function getPortfolios(client: Client): Promise<Portfolio[]> {
  const { data, error } = await client
    .from('portfolios')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`getPortfolios: ${error.message}`)
  return data ?? []
}

export async function getPortfolioById(
  client: Client,
  id: string
): Promise<Portfolio | null> {
  const { data, error } = await client
    .from('portfolios')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null  // not found
    throw new Error(`getPortfolioById: ${error.message}`)
  }
  return data
}

export async function createPortfolio(
  client: Client,
  input: CreatePortfolioInput
): Promise<Portfolio> {
  const { data, error } = await client
    .from('portfolios')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`createPortfolio: ${error.message}`)
  return data
}

export async function updatePortfolio(
  client: Client,
  id: string,
  updates: UpdatePortfolioInput
): Promise<Portfolio> {
  const { data, error } = await client
    .from('portfolios')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updatePortfolio: ${error.message}`)
  return data
}

export async function deletePortfolio(client: Client, id: string): Promise<void> {
  const { error } = await client.from('portfolios').delete().eq('id', id)
  if (error) throw new Error(`deletePortfolio: ${error.message}`)
}
