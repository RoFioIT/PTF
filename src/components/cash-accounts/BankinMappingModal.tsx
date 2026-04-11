'use client'

import { useState, useMemo, useRef } from 'react'
import { X, Trash2, GitMerge, Search, Upload } from 'lucide-react'
import { clsx } from 'clsx'
import type { CashAccount } from '@/types/database'
import { loadMapping, saveMapping, type MappingStore } from '@/lib/import/bankinMapping'

const OWNERS = ['Roberto', 'Silvia', 'Studio'] as const

function groupByOwner(accounts: CashAccount[]): Map<string, CashAccount[]> {
  const map = new Map<string, CashAccount[]>()
  for (const acc of accounts) {
    if (!map.has(acc.owner)) map.set(acc.owner, [])
    map.get(acc.owner)!.push(acc)
  }
  return map
}

// Split "BOURSOBANK::compte courant roberto" → { section, name }
function splitKey(key: string): { section: string; name: string } {
  const idx = key.indexOf('::')
  if (idx === -1) return { section: '', name: key }
  return {
    section: key.slice(0, idx).toUpperCase(),
    name: key.slice(idx + 2),
  }
}

interface Props {
  accounts: CashAccount[]
  onClose: () => void
}

export function BankinMappingModal({ accounts, onClose }: Props) {
  const [store, setStore] = useState<MappingStore>(() => loadMapping())
  const [search, setSearch] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleImportCSV(file: File) {
    setImportError(null)
    setImportSuccess(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.trim().split('\n')
        const header = lines[0].split(',')
        const keyIdx = header.indexOf('mapping_key')
        if (keyIdx === -1) throw new Error('No mapping_key column found')

        const next = { ...store }
        let added = 0
        for (let i = 1; i < lines.length; i++) {
          // parse CSV respecting quoted fields
          const cols = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) ?? []
          const raw = cols[keyIdx]?.replace(/^"|"$/g, '').trim()
          if (!raw) continue
          if (!next[raw]) {
            next[raw] = { accountId: '__skip__' }
            added++
          }
        }

        setStore(next)
        saveMapping(next)
        setImportSuccess(`${added} new rule${added !== 1 ? 's' : ''} added — assign accounts below`)
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Parse error')
      }
    }
    reader.readAsText(file)
  }

  const activeAccounts = accounts.filter((a) => a.is_active)
  const byOwner = groupByOwner(activeAccounts)

  const keys = useMemo(() => {
    const all = Object.keys(store).sort()
    if (!search.trim()) return all
    const q = search.toLowerCase()
    return all.filter((k) => k.includes(q))
  }, [store, search])

  function setAccountId(key: string, accountId: string) {
    const next = { ...store, [key]: { accountId } }
    setStore(next)
    saveMapping(next)
  }

  function deleteKey(key: string) {
    const next = { ...store }
    delete next[key]
    setStore(next)
    saveMapping(next)
  }

  function clearAll() {
    setStore({})
    saveMapping({})
    setConfirmClear(false)
  }

  function accountName(accountId: string): string {
    if (accountId === '__skip__') return 'Skip'
    const acc = activeAccounts.find((a) => a.id === accountId)
    return acc ? acc.name : '⚠ Account not found'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#13131f] border border-[#2a2a3e] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl mx-0 sm:mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a3e] flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-indigo-400" />
              Bankin&apos; account mapping
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {keys.length} rule{keys.length !== 1 ? 's' : ''} saved — controls how bookmarklet data maps to PTF accounts
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        {Object.keys(store).length > 0 && (
          <div className="px-5 py-3 border-b border-[#1e1e2e] flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by section or account name…"
                className="w-full bg-[#0e0e1a] border border-[#2a2a3e] rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-8">
              <GitMerge className="w-10 h-10 text-gray-700" />
              <p className="text-sm font-medium text-gray-400">
                {Object.keys(store).length === 0 ? 'No mappings saved yet' : 'No results for your search'}
              </p>
              <p className="text-xs text-gray-600">
                {Object.keys(store).length === 0
                  ? 'Use the Import screenshot feature or the bookmarklet to create mappings automatically.'
                  : 'Try a different search term.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#1a1a2a]">
              {keys.map((key) => {
                const { section, name } = splitKey(key)
                const entry = store[key]
                const isSkip = entry.accountId === '__skip__'
                const isMissing = !isSkip && !activeAccounts.find((a) => a.id === entry.accountId)

                return (
                  <div key={key} className="px-5 py-3.5 flex items-center gap-3">
                    {/* Source */}
                    <div className="flex-1 min-w-0">
                      <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-gray-600 bg-[#1e1e2e] px-1.5 py-0.5 rounded mb-1">
                        {section || '—'}
                      </span>
                      <p className="text-sm text-white truncate capitalize">{name}</p>
                    </div>

                    {/* Arrow + mapping select */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-gray-700 text-xs">→</span>
                      <select
                        value={entry.accountId}
                        onChange={(e) => setAccountId(key, e.target.value)}
                        className={clsx(
                          'bg-[#1e1e2e] border text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[180px]',
                          isSkip
                            ? 'border-gray-700 text-gray-500'
                            : isMissing
                              ? 'border-red-500/40 text-red-400'
                              : 'border-emerald-500/30 text-white'
                        )}
                      >
                        <option value="__skip__">⊘ Skip</option>
                        {[...byOwner.entries()].map(([owner, accs]) => (
                          <optgroup key={owner} label={owner}>
                            {accs.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>

                      {/* Missing badge */}
                      {isMissing && (
                        <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded" title={`Saved ID: ${entry.accountId}`}>
                          missing
                        </span>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => deleteKey(key)}
                        className="text-gray-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-400/10"
                        title="Remove this mapping"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Import feedback */}
        {(importError || importSuccess) && (
          <div className={clsx(
            'mx-5 mb-0 mt-0 px-3 py-2 rounded-lg text-xs flex-shrink-0',
            importError ? 'bg-red-400/10 text-red-400' : 'bg-emerald-400/10 text-emerald-400'
          )}>
            {importError ?? importSuccess}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#2a2a3e] flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Import CSV */}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleImportCSV(f)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xs text-gray-500 hover:text-indigo-400 transition-colors flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-indigo-400/10"
              title="Import mapping keys from a Bankin' CSV"
            >
              <Upload className="w-3.5 h-3.5" /> Import CSV
            </button>

            {/* Clear all */}
            {Object.keys(store).length > 0 && (
              confirmClear ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Delete all {Object.keys(store).length} mappings?</span>
                  <button onClick={clearAll} className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1 rounded hover:bg-red-400/10 transition-colors">
                    Yes, clear all
                  </button>
                  <button onClick={() => setConfirmClear(false)} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-white/5 transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmClear(true)} className="text-xs text-gray-600 hover:text-red-400 transition-colors flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-red-400/10">
                  <Trash2 className="w-3.5 h-3.5" /> Clear all
                </button>
              )
            )}
          </div>

          <button onClick={onClose} className="text-sm text-white bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-lg transition-colors font-medium">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
