// ============================================================
// DB Layer — Properties
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Property, PropertyWithMortgage } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export interface CreatePropertyInput {
  user_id: string
  name: string
  type: 'home' | 'investment'
  country: 'france' | 'italy'
  address?: string | null
  current_value: number
  purchase_price?: number | null
  purchase_date?: string | null
  notes?: string | null
}

export interface UpdatePropertyInput {
  name?: string
  type?: 'home' | 'investment'
  country?: 'france' | 'italy'
  address?: string | null
  current_value?: number
  purchase_price?: number | null
  purchase_date?: string | null
  notes?: string | null
}

export async function getProperties(client: Client): Promise<PropertyWithMortgage[]> {
  const { data, error } = await client
    .from('properties')
    .select('*, mortgages(*)')
    .order('country', { ascending: true })
    .order('type', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw new Error(`getProperties: ${error.message}`)

  return (data ?? []).map((row) => ({
    ...row,
    current_value: Number(row.current_value),
    purchase_price: row.purchase_price != null ? Number(row.purchase_price) : null,
    mortgage: row.mortgages?.[0]
      ? {
          ...row.mortgages[0],
          initial_amount: Number(row.mortgages[0].initial_amount),
        }
      : null,
  }))
}

export async function getPropertyById(
  client: Client,
  id: string
): Promise<PropertyWithMortgage | null> {
  const { data, error } = await client
    .from('properties')
    .select('*, mortgages(*)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`getPropertyById: ${error.message}`)
  if (!data) return null

  return {
    ...data,
    current_value: Number(data.current_value),
    purchase_price: data.purchase_price != null ? Number(data.purchase_price) : null,
    mortgage: data.mortgages?.[0]
      ? {
          ...data.mortgages[0],
          initial_amount: Number(data.mortgages[0].initial_amount),
        }
      : null,
  }
}

export async function createProperty(
  client: Client,
  input: CreatePropertyInput
): Promise<Property> {
  const { data, error } = await client
    .from('properties')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`createProperty: ${error.message}`)
  return { ...data, current_value: Number(data.current_value), purchase_price: data.purchase_price != null ? Number(data.purchase_price) : null }
}

export async function updateProperty(
  client: Client,
  id: string,
  updates: UpdatePropertyInput
): Promise<Property> {
  const { data, error } = await client
    .from('properties')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateProperty: ${error.message}`)
  return { ...data, current_value: Number(data.current_value), purchase_price: data.purchase_price != null ? Number(data.purchase_price) : null }
}

export async function deleteProperty(client: Client, id: string): Promise<void> {
  const { error } = await client.from('properties').delete().eq('id', id)
  if (error) throw new Error(`deleteProperty: ${error.message}`)
}
