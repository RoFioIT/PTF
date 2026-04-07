'use client'

import { useState, useRef } from 'react'
import { X, Upload, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import type { CashAccount, CashAccountSnapshot } from '@/types/database'
import type { ExtractedItem } from '@/lib/import/parseBankinText'
import { loadMapping, persistMappings, mappingKey } from '@/lib/import/bankinMapping'

// ── Constants ─────────────────────────────────────────────────
const OWNERS = ['Roberto', 'Silvia', 'Studio'] as const
const CATEGORIES = ['Cash', 'Cash Risparmio', 'Investimenti - Assurance', 'Investimenti - Borsa'] as const

function getCurrentQuarter(): string {
  const now = new Date()
  return `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`
}

function generateQuarterOptions(): string[] {
  const options: string[] = []
  const now = new Date()
  let year = now.getFullYear()
  let q = Math.ceil((now.getMonth() + 1) / 3)
  for (let i = 0; i < 8; i++) {
    options.push(`${year}-Q${q}`)
    q--
    if (q === 0) { q = 4; year-- }
  }
  return options
}

function fmt(v: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v)
}

// ── Types ─────────────────────────────────────────────────────

interface NewAccountDraft {
  owner: string
  category: string
  name: string
}

interface MappingRow {
  extracted: ExtractedItem
  accountId: string  // PTF UUID, '__skip__', or '__new__'
  newAccountDraft: NewAccountDraft
}

type Step = 'upload' | 'review' | 'saving'

// ── Props ─────────────────────────────────────────────────────

interface Props {
  accounts: CashAccount[]
  onDone: (snapshots: CashAccountSnapshot[], newAccounts: CashAccount[]) => void
  onClose: () => void
}

// ── Helper: group accounts by owner for <optgroup> ────────────

function groupByOwner(accounts: CashAccount[]): Map<string, CashAccount[]> {
  const map = new Map<string, CashAccount[]>()
  for (const acc of accounts) {
    if (!map.has(acc.owner)) map.set(acc.owner, [])
    map.get(acc.owner)!.push(acc)
  }
  return map
}

// ── Component ─────────────────────────────────────────────────

export function ImportSnapshotModal({ accounts, onDone, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [quarter, setQuarter] = useState(getCurrentQuarter())
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [rows, setRows] = useState<MappingRow[]>([])
  const [processing, setProcessing] = useState(false)
  const [processError, setProcessError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const quarters = generateQuarterOptions()
  const byOwner = groupByOwner(accounts.filter((a) => a.is_active))
  const savedMapping = loadMapping()

  // ── File selection ────────────────────────────────────────────

  function handleFiles(selected: FileList | null) {
    if (!selected) return
    const newFiles = Array.from(selected).filter((f) => f.type.startsWith('image/'))
    if (newFiles.length === 0) return

    setFiles((prev) => [...prev, ...newFiles])
    // Generate data URL previews
    newFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviews((prev) => [...prev, e.target?.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
    setPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── OCR processing ────────────────────────────────────────────

  async function processImages() {
    if (files.length === 0) return
    setProcessing(true)
    setProcessError(null)

    try {
      // Call OCR API in parallel for all images
      const results = await Promise.all(
        files.map(async (file) => {
          const fd = new FormData()
          fd.append('image', file)
          const res = await fetch('/api/cash-accounts/import-ocr', { method: 'POST', body: fd })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error ?? `OCR failed for ${file.name}`)
          return json.items as ExtractedItem[]
        })
      )

      // Flatten all extracted items
      const allItems = results.flat()
      if (allItems.length === 0) {
        setProcessError('No accounts detected in the image(s). Try a clearer screenshot.')
        setProcessing(false)
        return
      }

      // Apply saved mappings to pre-fill accountIds
      const mappedRows: MappingRow[] = allItems.map((item) => {
        const key = mappingKey(item)
        const saved = savedMapping[key]
        let accountId = ''

        if (saved) {
          if (saved.accountId === '__skip__') {
            accountId = '__skip__'
          } else {
            // Verify the saved account still exists
            const exists = accounts.find((a) => a.id === saved.accountId && a.is_active)
            accountId = exists ? saved.accountId : ''
          }
        }

        return {
          extracted: item,
          accountId,
          newAccountDraft: { owner: 'Roberto', category: 'Cash', name: item.sourceName },
        }
      })

      setRows(mappedRows)
      setStep('review')
    } catch (err) {
      setProcessError((err as Error).message)
    } finally {
      setProcessing(false)
    }
  }

  // ── Row updates ───────────────────────────────────────────────

  function updateRow(idx: number, patch: Partial<MappingRow>) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  function updateDraft(idx: number, patch: Partial<NewAccountDraft>) {
    setRows((prev) => prev.map((r, i) =>
      i === idx ? { ...r, newAccountDraft: { ...r.newAccountDraft, ...patch } } : r
    ))
  }

  // ── Save ──────────────────────────────────────────────────────

  const activeRows = rows.filter((r) => r.accountId !== '__skip__' && r.accountId !== '')
  const validRows = rows.filter((r) =>
    r.accountId !== '' &&
    r.accountId !== '__skip__' &&
    (r.accountId !== '__new__' || (r.newAccountDraft.name.trim() !== ''))
  )
  const allResolved = rows.every((r) =>
    r.accountId === '__skip__' ||
    (r.accountId !== '' && r.accountId !== '__new__') ||
    (r.accountId === '__new__' && r.newAccountDraft.name.trim() !== '')
  )

  async function handleSave() {
    setStep('saving')
    setSaveError(null)

    try {
      // 1. Create any new accounts first
      const newAccountMap = new Map<number, CashAccount>()  // row index → created account
      const newAccountRows = rows
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.accountId === '__new__' && r.newAccountDraft.name.trim() !== '')

      for (const { r, i } of newAccountRows) {
        const res = await fetch('/api/cash-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner: r.newAccountDraft.owner,
            category: r.newAccountDraft.category,
            name: r.newAccountDraft.name.trim(),
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Failed to create account')
        newAccountMap.set(i, json.account as CashAccount)
      }

      // 2. Build snapshot payload — resolve __new__ accountIds
      const snapshotPayload = rows
        .map((r, i) => {
          if (r.accountId === '__skip__' || r.accountId === '') return null
          const accountId = r.accountId === '__new__'
            ? newAccountMap.get(i)?.id
            : r.accountId
          if (!accountId) return null
          return { account_id: accountId, quarter, balance: r.extracted.amount }
        })
        .filter(Boolean) as Array<{ account_id: string; quarter: string; balance: number }>

      // 3. Upsert snapshots
      const snapRes = await fetch('/api/cash-accounts/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshotPayload),
      })
      const snapJson = await snapRes.json()
      if (!snapRes.ok) throw new Error(snapJson.error ?? 'Failed to save snapshots')

      // 4. Persist mappings for future imports
      persistMappings(
        rows.map((r, i) => ({
          item: r.extracted,
          accountId: r.accountId === '__new__'
            ? (newAccountMap.get(i)?.id ?? '__skip__')
            : r.accountId || '__skip__',
        }))
      )

      // 5. Return results to parent
      const createdAccounts = [...newAccountMap.values()]
      onDone(snapJson.snapshots as CashAccountSnapshot[], createdAccounts)
    } catch (err) {
      setSaveError((err as Error).message)
      setStep('review')
    }
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#13131f] border border-[#2a2a3e] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl mx-0 sm:mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a3e] flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-400" />
              Import from screenshot
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === 'upload' && 'Upload one or more bank app screenshots'}
              {step === 'review' && `${rows.length} item${rows.length !== 1 ? 's' : ''} detected — map to accounts`}
              {step === 'saving' && 'Saving snapshots…'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-5 py-2.5 border-b border-[#1e1e2e] flex-shrink-0">
          {(['upload', 'review'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3 text-gray-700" />}
              <span className={clsx(
                'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded',
                step === s ? 'bg-emerald-600/20 text-emerald-400' : 'text-gray-600'
              )}>
                {i + 1}. {s === 'upload' ? 'Upload' : 'Map & Import'}
              </span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── STEP 1: Upload ─────────────────────────────────── */}
          {step === 'upload' && (
            <div className="p-5 space-y-5">
              {/* Quarter selector */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Import for quarter</label>
                <select
                  value={quarter}
                  onChange={(e) => setQuarter(e.target.value)}
                  className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {quarters.map((q) => (
                    <option key={q} value={q}>{q.replace('-Q', ' Q')}</option>
                  ))}
                </select>
              </div>

              {/* Drop zone / file select */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Screenshots</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-[#2a2a3e] hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-center"
                >
                  <ImageIcon className="w-8 h-8 text-gray-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-300">Tap to select screenshots</p>
                    <p className="text-xs text-gray-600 mt-0.5">From Photos library or camera — multiple allowed</p>
                  </div>
                </button>
              </div>

              {/* Thumbnail strip */}
              {files.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">{files.length} image{files.length !== 1 ? 's' : ''} selected</p>
                  <div className="flex gap-2 flex-wrap">
                    {previews.map((src, i) => (
                      <div key={i} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={files[i]?.name} className="w-16 h-24 object-cover rounded-lg border border-[#2a2a3e]" />
                        <button
                          onClick={() => removeFile(i)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {processError && (
                <div className="flex items-start gap-2 text-red-400 bg-red-400/10 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="text-xs">{processError}</p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Review / Map ────────────────────────────── */}
          {step === 'review' && (
            <div className="divide-y divide-[#1e1e2e]">
              {/* Quarter reminder */}
              <div className="px-5 py-2.5 bg-[#0e0e1a] flex items-center gap-2">
                <span className="text-xs text-gray-500">Quarter:</span>
                <span className="text-xs font-semibold text-white">{quarter.replace('-Q', ' Q')}</span>
                <span className="text-xs text-gray-600 ml-2">·</span>
                <span className={clsx(
                  'text-xs font-medium',
                  validRows.length === activeRows.length ? 'text-emerald-400' : 'text-amber-400'
                )}>
                  {validRows.length}/{rows.filter((r) => r.accountId !== '__skip__').length} mapped
                </span>
              </div>

              {rows.map((row, idx) => (
                <div key={idx} className={clsx(
                  'px-5 py-4',
                  row.accountId === '__skip__' ? 'opacity-40' : ''
                )}>
                  {/* Source info */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-0.5">
                        {row.extracted.sourceSection || 'Unknown source'}
                      </div>
                      <div className="text-sm font-medium text-white truncate">{row.extracted.sourceName}</div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-base font-bold text-white tabular-nums">{fmt(row.extracted.amount)}</div>
                    </div>
                  </div>

                  {/* Mapping selector */}
                  <select
                    value={row.accountId}
                    onChange={(e) => updateRow(idx, { accountId: e.target.value })}
                    className={clsx(
                      'w-full bg-[#1e1e2e] border text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500',
                      row.accountId === '__skip__'
                        ? 'border-gray-700 text-gray-500'
                        : row.accountId === '' || row.accountId === '__new__'
                          ? 'border-amber-500/40 text-white'
                          : 'border-emerald-500/40 text-white'
                    )}
                  >
                    <option value="">— Select account —</option>
                    <option value="__skip__">⊘ Skip this item</option>
                    {[...byOwner.entries()].map(([owner, accs]) => (
                      <optgroup key={owner} label={owner}>
                        {accs.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.category})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <option value="__new__">+ Create new account…</option>
                  </select>

                  {/* Inline new account form */}
                  {row.accountId === '__new__' && (
                    <div className="mt-3 p-3 bg-[#0e0e1a] rounded-xl border border-[#2a2a3e] space-y-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">New account details</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-600 mb-1">Owner</label>
                          <select
                            value={row.newAccountDraft.owner}
                            onChange={(e) => updateDraft(idx, { owner: e.target.value })}
                            className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {OWNERS.map((o) => <option key={o}>{o}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-600 mb-1">Category</label>
                          <select
                            value={row.newAccountDraft.category}
                            onChange={(e) => updateDraft(idx, { category: e.target.value })}
                            className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-600 mb-1">Account name</label>
                        <input
                          type="text"
                          value={row.newAccountDraft.name}
                          onChange={(e) => updateDraft(idx, { name: e.target.value })}
                          className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-white text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Account display name"
                        />
                      </div>
                    </div>
                  )}

                  {/* Mapped indicator */}
                  {row.accountId !== '' && row.accountId !== '__skip__' && row.accountId !== '__new__' && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs text-emerald-400">
                        {accounts.find((a) => a.id === row.accountId)?.name}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {saveError && (
                <div className="px-5 py-3 flex items-start gap-2 text-red-400 bg-red-400/10">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="text-xs">{saveError}</p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: Saving ────────────────────────────────────── */}
          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-sm text-gray-400">Saving {validRows.length} snapshot{validRows.length !== 1 ? 's' : ''}…</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#2a2a3e] flex-shrink-0">
          <button
            onClick={step === 'review' ? () => setStep('upload') : onClose}
            className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-all"
          >
            {step === 'review' ? '← Back' : 'Cancel'}
          </button>

          {step === 'upload' && (
            <button
              onClick={processImages}
              disabled={files.length === 0 || processing}
              className="flex items-center gap-2 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg transition-colors font-medium"
            >
              {processing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
              ) : (
                <><Upload className="w-4 h-4" /> Process {files.length > 0 ? `${files.length} image${files.length > 1 ? 's' : ''}` : 'images'}</>
              )}
            </button>
          )}

          {step === 'review' && (
            <button
              onClick={handleSave}
              disabled={!allResolved || validRows.length === 0}
              className="flex items-center gap-2 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg transition-colors font-medium"
            >
              <CheckCircle2 className="w-4 h-4" />
              Import {validRows.length} snapshot{validRows.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
