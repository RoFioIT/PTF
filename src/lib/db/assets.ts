// ============================================================
// DB Layer — Assets & Identifiers
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Asset, AssetIdentifier, AssetType, AssetWithIdentifiers, IdentifierType } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export interface CreateAssetInput {
  name: string
  asset_type: AssetType
  currency?: string
  sector?: string
  country?: string
}

export async function getAssetById(
  client: Client,
  id: string
): Promise<AssetWithIdentifiers | null> {
  const { data, error } = await client
    .from('assets')
    .select('*, asset_identifiers(*)')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`getAssetById: ${error.message}`)
  }
  return data as AssetWithIdentifiers
}

export async function searchAssets(
  client: Client,
  query: string
): Promise<AssetWithIdentifiers[]> {
  const { data, error } = await client
    .from('assets')
    .select('*, asset_identifiers(*)')
    .ilike('name', `%${query}%`)
    .limit(20)

  if (error) throw new Error(`searchAssets: ${error.message}`)
  return (data ?? []) as AssetWithIdentifiers[]
}

/**
 * resolveAssetByIdentifier — finds an asset given an identifier value and type.
 * Used by the market data layer to link fetched prices to DB assets.
 */
export async function resolveAssetByIdentifier(
  client: Client,
  type: IdentifierType,
  value: string
): Promise<Asset | null> {
  const { data, error } = await client
    .from('asset_identifiers')
    .select('asset_id, assets(*)')
    .eq('type', type)
    .eq('value', value)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`resolveAssetByIdentifier: ${error.message}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any).assets as Asset) ?? null
}

export async function createAsset(
  client: Client,
  input: CreateAssetInput,
  identifiers?: Omit<AssetIdentifier, 'id' | 'asset_id'>[]
): Promise<AssetWithIdentifiers> {
  const { data: asset, error: assetError } = await client
    .from('assets')
    .insert(input)
    .select()
    .single()

  if (assetError) throw new Error(`createAsset: ${assetError.message}`)

  if (identifiers && identifiers.length > 0) {
    const { error: idError } = await client.from('asset_identifiers').insert(
      identifiers.map((ident) => ({ ...ident, asset_id: (asset as Asset).id }))
    )
    if (idError) throw new Error(`createAsset (identifiers): ${idError.message}`)
  }

  const full = await getAssetById(client, (asset as Asset).id)
  if (!full) throw new Error('createAsset: asset disappeared after insert')
  return full
}

export async function addAssetIdentifier(
  client: Client,
  assetId: string,
  type: IdentifierType,
  value: string
): Promise<AssetIdentifier> {
  const { data, error } = await client
    .from('asset_identifiers')
    .insert({ asset_id: assetId, type, value })
    .select()
    .single()

  if (error) throw new Error(`addAssetIdentifier: ${error.message}`)
  return data
}
