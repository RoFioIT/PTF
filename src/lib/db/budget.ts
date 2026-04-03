import { SupabaseClient } from '@supabase/supabase-js'
import { BudgetCategory, BudgetItem, BudgetEntry } from '@/types/database'

export async function getBudgetCategories(client: SupabaseClient): Promise<BudgetCategory[]> {
  const { data, error } = await client
    .from('budget_categories')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function getBudgetItems(client: SupabaseClient): Promise<BudgetItem[]> {
  const { data, error } = await client
    .from('budget_items')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function getBudgetEntries(client: SupabaseClient, year: number): Promise<BudgetEntry[]> {
  const { data, error } = await client
    .from('budget_entries')
    .select('*')
    .eq('year', year)
  if (error) throw error
  return data ?? []
}

export async function getAvailableYears(client: SupabaseClient): Promise<number[]> {
  const { data, error } = await client
    .from('budget_entries')
    .select('year')
  if (error) throw error
  const years = [...new Set((data ?? []).map((r: { year: number }) => r.year))].sort((a, b) => b - a)
  return years
}

export async function upsertBudgetEntries(
  client: SupabaseClient,
  entries: Array<{ item_id: string; year: number; month: number; budget?: number; actual?: number | null }>,
): Promise<BudgetEntry[]> {
  const { data, error } = await client
    .from('budget_entries')
    .upsert(entries, { onConflict: 'item_id,year,month' })
    .select()
  if (error) throw error
  return data ?? []
}

export async function copyBudgetYear(
  client: SupabaseClient,
  fromYear: number,
  toYear: number,
  copyBudget: boolean,
  copyActual: boolean,
): Promise<void> {
  // Fetch source entries
  const source = await getBudgetEntries(client, fromYear)
  if (source.length === 0) return

  const toUpsert = source.map((e) => ({
    item_id: e.item_id,
    year: toYear,
    month: e.month,
    budget: copyBudget ? e.budget : 0,
    actual: copyActual ? e.actual : null,
  }))

  const { error } = await client
    .from('budget_entries')
    .upsert(toUpsert, { onConflict: 'item_id,year,month' })
  if (error) throw error
}

export async function createBudgetItem(
  client: SupabaseClient,
  input: { category_id: string; name: string; sort_order?: number },
): Promise<BudgetItem> {
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data, error } = await client
    .from('budget_items')
    .insert({ ...input, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteBudgetItem(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('budget_items').delete().eq('id', id)
  if (error) throw error
}
