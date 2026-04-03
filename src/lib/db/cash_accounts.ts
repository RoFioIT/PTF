// ============================================================
// DB Layer — Cash Accounts & Quarterly Snapshots
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CashAccount, CashAccountSnapshot } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export interface CreateCashAccountInput {
  user_id: string
  owner: string
  category: string
  name: string
  currency?: string
  notes?: string
}

export interface UpdateCashAccountInput {
  owner?: string
  category?: string
  name?: string
  currency?: string
  notes?: string
  is_active?: boolean
}

export interface UpsertSnapshotInput {
  account_id: string
  quarter: string
  balance: number
  notes?: string
}

// ── Accounts ─────────────────────────────────────────────────

export async function getCashAccounts(client: Client): Promise<CashAccount[]> {
  const { data, error } = await client
    .from('cash_accounts')
    .select('*')
    .order('owner')
    .order('category')
    .order('name')
  if (error) throw new Error(`getCashAccounts: ${error.message}`)
  return data ?? []
}

export async function createCashAccount(
  client: Client,
  input: CreateCashAccountInput,
): Promise<CashAccount> {
  const { data, error } = await client
    .from('cash_accounts')
    .insert({ currency: 'EUR', ...input })
    .select()
    .single()
  if (error) throw new Error(`createCashAccount: ${error.message}`)
  return data
}

export async function updateCashAccount(
  client: Client,
  id: string,
  updates: UpdateCashAccountInput,
): Promise<CashAccount> {
  const { data, error } = await client
    .from('cash_accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`updateCashAccount: ${error.message}`)
  return data
}

export async function deleteCashAccount(client: Client, id: string): Promise<void> {
  const { error } = await client.from('cash_accounts').delete().eq('id', id)
  if (error) throw new Error(`deleteCashAccount: ${error.message}`)
}

// ── Snapshots ─────────────────────────────────────────────────

export async function getCashAccountSnapshots(client: Client): Promise<CashAccountSnapshot[]> {
  const { data, error } = await client
    .from('cash_account_snapshots')
    .select('*')
    .order('quarter', { ascending: true })
  if (error) throw new Error(`getCashAccountSnapshots: ${error.message}`)
  return data ?? []
}

export async function upsertSnapshot(
  client: Client,
  input: UpsertSnapshotInput,
): Promise<CashAccountSnapshot> {
  const { data, error } = await client
    .from('cash_account_snapshots')
    .upsert(input, { onConflict: 'account_id,quarter' })
    .select()
    .single()
  if (error) throw new Error(`upsertSnapshot: ${error.message}`)
  return data
}

export async function deleteSnapshot(client: Client, id: string): Promise<void> {
  const { error } = await client.from('cash_account_snapshots').delete().eq('id', id)
  if (error) throw new Error(`deleteSnapshot: ${error.message}`)
}
