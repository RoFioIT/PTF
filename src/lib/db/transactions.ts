// ============================================================
// DB Layer — Transactions
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Transaction, TransactionType, TransactionWithAsset } from '@/types/database'
import type { FinTransaction } from '@/lib/finance/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export interface CreateTransactionInput {
  portfolio_id: string
  asset_id: string
  type: TransactionType
  quantity: number
  price: number
  fees?: number
  currency?: string
  date: string
  notes?: string
}

export interface UpdateTransactionInput {
  quantity?: number
  price?: number
  fees?: number
  date?: string
  notes?: string
}

export async function getTransactionsByPortfolio(
  client: Client,
  portfolioId: string
): Promise<TransactionWithAsset[]> {
  const { data, error } = await client
    .from('transactions')
    .select('*, asset:assets(*)')
    .eq('portfolio_id', portfolioId)
    .order('date', { ascending: true })

  if (error) throw new Error(`getTransactionsByPortfolio: ${error.message}`)
  return (data ?? []) as TransactionWithAsset[]
}

export async function getTransactionsByAsset(
  client: Client,
  portfolioId: string,
  assetId: string
): Promise<Transaction[]> {
  const { data, error } = await client
    .from('transactions')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .eq('asset_id', assetId)
    .order('date', { ascending: true })

  if (error) throw new Error(`getTransactionsByAsset: ${error.message}`)
  return data ?? []
}

export async function createTransaction(
  client: Client,
  input: CreateTransactionInput
): Promise<Transaction> {
  const { data, error } = await client
    .from('transactions')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`createTransaction: ${error.message}`)
  return data
}

export async function updateTransaction(
  client: Client,
  id: string,
  updates: UpdateTransactionInput
): Promise<Transaction> {
  const { data, error } = await client
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateTransaction: ${error.message}`)
  return data
}

export async function deleteTransaction(client: Client, id: string): Promise<void> {
  const { error } = await client.from('transactions').delete().eq('id', id)
  if (error) throw new Error(`deleteTransaction: ${error.message}`)
}

/**
 * toFinTransaction — converts a DB Transaction row to the engine's FinTransaction type.
 * Ensures quantity and price are numbers (Supabase returns numeric as string).
 */
export function toFinTransaction(tx: Transaction): FinTransaction {
  return {
    id: tx.id,
    assetId: tx.asset_id,
    type: tx.type,
    quantity: Number(tx.quantity),
    price: Number(tx.price),
    fees: Number(tx.fees),
    date: tx.date,
  }
}
