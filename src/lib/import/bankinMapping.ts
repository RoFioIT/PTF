import type { ExtractedItem } from './parseBankinText'

const STORAGE_KEY = 'ptf_bankin_mapping_v1'

export interface MappingEntry {
  accountId: string  // PTF account UUID, or '__skip__'
}

export type MappingStore = Record<string, MappingEntry>

/**
 * Normalize a source item into a stable localStorage key.
 * e.g. sourceSection="REVOLUT FR", sourceName="Pocket EUR" → "REVOLUT FR::pocket eur"
 */
export function mappingKey(item: Pick<ExtractedItem, 'sourceSection' | 'sourceName'>): string {
  return `${item.sourceSection.toUpperCase().trim()}::${item.sourceName.toLowerCase().trim()}`
}

export function loadMapping(): MappingStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as { version: number; profiles: MappingStore }
    if (parsed?.version !== 1 || typeof parsed.profiles !== 'object') return {}
    return parsed.profiles ?? {}
  } catch {
    return {}
  }
}

export function saveMapping(store: MappingStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, profiles: store }))
  } catch {
    // Storage quota exceeded or private browsing — silently ignore
  }
}

/**
 * Merge new row mappings into the existing store and persist.
 * rows: array of { item, accountId } — only rows with a resolved accountId are saved.
 */
export function persistMappings(
  rows: Array<{ item: ExtractedItem; accountId: string }>
): void {
  const store = loadMapping()
  for (const { item, accountId } of rows) {
    if (accountId && accountId !== '__new__') {
      store[mappingKey(item)] = { accountId }
    }
  }
  saveMapping(store)
}
