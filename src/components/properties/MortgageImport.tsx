'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { Upload, ArrowRight, Check, AlertTriangle } from 'lucide-react'

interface ParsedRow {
  month_number: number
  payment_date: string   // 'YYYY-MM-DD'
  total_payment: number
  principal: number
  interest: number
  insurance: number
  remaining_balance: number
}

const REQUIRED_FIELDS = [
  { key: 'month_number',      label: 'Nº échéance / Rata n°',  required: true },
  { key: 'payment_date',      label: 'Date échéance',           required: true },
  { key: 'total_payment',     label: 'Mensualité totale',        required: true },
  { key: 'principal',         label: 'Capital amorti',           required: true },
  { key: 'interest',          label: 'Intérêts',                 required: true },
  { key: 'insurance',         label: 'Assurance',                required: false },
  { key: 'remaining_balance', label: 'Capital restant dû',       required: true },
] as const

// French / Italian bank keyword mapping for auto-detection
const AUTO_DETECT_MAP: Record<string, string[]> = {
  month_number:      ['échéance', 'echeance', 'num', 'n°', 'numero', 'rata', 'n.'],
  payment_date:      ['date', 'scadenza', 'échéance'],
  total_payment:     ['mensualité', 'mensualite', 'total', 'rata', 'importo'],
  principal:         ['capital amorti', 'capital', 'amort', 'quota capitale', 'capitale'],
  interest:          ['intérêts', 'interets', 'interessi', 'quota interessi'],
  insurance:         ['assurance', 'assurances', 'assicurazione', 'insurance'],
  remaining_balance: ['restant', 'résiduel', 'residuel', 'residuo', 'remaining', 'solde'],
}

function parseDateStr(raw: string | number, fmt: string): string {
  if (typeof raw === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(raw)
    const y = date.y, m = String(date.m).padStart(2, '0'), d = String(date.d).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(raw).trim()
  if (fmt === 'DD/MM/YYYY') {
    const parts = s.split(/[\/\-\.]/)
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
  }
  // assume YYYY-MM-DD or similar ISO
  return s.slice(0, 10)
}

function parseNum(raw: unknown): number {
  if (typeof raw === 'number') return raw
  const s = String(raw).replace(/\s/g, '').replace(',', '.')
  return parseFloat(s) || 0
}

interface Props {
  propertyId: string
  mortgageId: string
}

export function MortgageImport({ propertyId, mortgageId }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [rawRows, setRawRows] = useState<unknown[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [dateFormat, setDateFormat] = useState<'DD/MM/YYYY' | 'YYYY-MM-DD'>('DD/MM/YYYY')
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true })

        // Find first non-empty row as header
        const headerRowIdx = rows.findIndex((r) => Array.isArray(r) && r.some((c) => c != null && c !== ''))
        if (headerRowIdx === -1) { setError('File appears empty'); return }

        const hdrs = (rows[headerRowIdx] as unknown[]).map((h) => String(h ?? '').trim())
        const dataRows = rows.slice(headerRowIdx + 1).filter(
          (r) => Array.isArray(r) && r.some((c) => c != null && c !== '')
        ) as unknown[][]

        setHeaders(hdrs)
        setRawRows(dataRows)

        // Auto-detect column mapping
        const detected: Record<string, string> = {}
        for (const [field, keywords] of Object.entries(AUTO_DETECT_MAP)) {
          const match = hdrs.find((h) =>
            keywords.some((kw) => h.toLowerCase().includes(kw.toLowerCase()))
          )
          if (match) detected[field] = match
        }
        setMapping(detected)
        setStep(2)
        setError(null)
      } catch {
        setError('Could not parse file. Please use XLS, XLSX, or CSV format.')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  function buildPreview(): ParsedRow[] {
    return rawRows
      .map((row) => {
        const get = (field: string): unknown => {
          const col = mapping[field]
          if (!col) return undefined
          const idx = headers.indexOf(col)
          return idx >= 0 ? (row as unknown[])[idx] : undefined
        }
        return {
          month_number:      Math.round(parseNum(get('month_number'))),
          payment_date:      parseDateStr(get('payment_date') as string | number, dateFormat),
          total_payment:     parseNum(get('total_payment')),
          principal:         parseNum(get('principal')),
          interest:          parseNum(get('interest')),
          insurance:         get('insurance') != null ? parseNum(get('insurance')) : 0,
          remaining_balance: parseNum(get('remaining_balance')),
        }
      })
      .filter((r) => r.month_number > 0 && r.payment_date.length >= 10)
  }

  function goToPreview() {
    const missing = REQUIRED_FIELDS.filter((f) => f.required && !mapping[f.key]).map((f) => f.label)
    if (missing.length > 0) { setError(`Please map: ${missing.join(', ')}`); return }
    setError(null)
    setPreview(buildPreview())
    setStep(3)
  }

  async function handleImport() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/properties/${propertyId}/mortgage/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mortgageId, rows: preview }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Import failed')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {([1, 2, 3] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step > s ? 'bg-emerald-500 text-white' :
              step === s ? 'bg-indigo-600 text-white' :
              'bg-[#1e1e2e] text-gray-500'
            }`}>
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
            <span className={`text-xs ${step === s ? 'text-white' : 'text-gray-600'}`}>
              {s === 1 ? 'Upload' : s === 2 ? 'Map columns' : 'Preview & import'}
            </span>
            {s < 3 && <ArrowRight className="w-3 h-3 text-gray-700" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Step 1 — File upload */}
      {step === 1 && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-[#2a2a3e] rounded-xl p-10 flex flex-col items-center gap-4 cursor-pointer hover:border-indigo-600/50 transition-colors"
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <Upload className="w-10 h-10 text-gray-600" />
          <div className="text-center">
            <p className="text-white font-medium">Drop your amortization file here</p>
            <p className="text-gray-500 text-sm mt-1">Supports .xls, .xlsx, .csv</p>
          </div>
          <input
            id="file-input"
            type="file"
            accept=".xls,.xlsx,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>
      )}

      {/* Step 2 — Column mapper */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <p className="text-sm text-gray-400 mb-3">
              Detected <span className="text-white font-medium">{rawRows.length}</span> rows.
              Map each required field to a column from your file.
            </p>

            <div className="mb-4 flex items-center gap-3">
              <label className="text-xs text-gray-400">Date format:</label>
              {(['DD/MM/YYYY', 'YYYY-MM-DD'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setDateFormat(f)}
                  className={`text-xs px-3 py-1 rounded-lg border ${
                    dateFormat === f
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-[#2a2a3e] text-gray-400 hover:border-indigo-600/50'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {REQUIRED_FIELDS.map(({ key, label, required }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">
                    {label} {required && <span className="text-red-400">*</span>}
                  </label>
                  <select
                    value={mapping[key] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
                    className="bg-[#0d0d14] border border-[#2a2a3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">— not mapped —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview first 3 raw rows */}
          <div>
            <p className="text-xs text-gray-500 mb-2">First 3 rows from your file:</p>
            <div className="overflow-x-auto">
              <table className="text-xs text-gray-400 border-collapse">
                <thead>
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="px-2 py-1 border border-[#2a2a3e] bg-[#0d0d14] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawRows.slice(0, 3).map((row, i) => (
                    <tr key={i}>
                      {(row as unknown[]).map((cell, j) => (
                        <td key={j} className="px-2 py-1 border border-[#1e1e2e] whitespace-nowrap">{String(cell ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={goToPreview}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Preview →
          </button>
        </div>
      )}

      {/* Step 3 — Preview + confirm */}
      {step === 3 && (
        <div className="space-y-5">
          <p className="text-sm text-gray-400">
            Ready to import <span className="text-white font-semibold">{preview.length}</span> payments.
            Showing first 5 and last 5 rows.
          </p>

          <div className="overflow-x-auto rounded-lg border border-[#1e1e2e]">
            <table className="w-full text-xs">
              <thead className="bg-[#0d0d14]">
                <tr>
                  {['#', 'Date', 'Total', 'Principal', 'Interest', 'Insurance', 'Remaining'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...preview.slice(0, 5), ...(preview.length > 10 ? [null] : []), ...preview.slice(-5)].map((row, i) => {
                  if (row === null) return (
                    <tr key="ellipsis">
                      <td colSpan={7} className="px-3 py-2 text-center text-gray-600">⋯ {preview.length - 10} more rows ⋯</td>
                    </tr>
                  )
                  return (
                    <tr key={i} className="border-t border-[#1e1e2e] hover:bg-[#0d0d14]">
                      <td className="px-3 py-2 text-gray-300 tabular-nums">{row.month_number}</td>
                      <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{row.payment_date}</td>
                      <td className="px-3 py-2 text-white tabular-nums whitespace-nowrap">{fmt.format(row.total_payment)}</td>
                      <td className="px-3 py-2 text-emerald-400 tabular-nums whitespace-nowrap">{fmt.format(row.principal)}</td>
                      <td className="px-3 py-2 text-gray-300 tabular-nums whitespace-nowrap">{fmt.format(row.interest)}</td>
                      <td className="px-3 py-2 text-gray-400 tabular-nums whitespace-nowrap">{fmt.format(row.insurance)}</td>
                      <td className="px-3 py-2 text-gray-300 tabular-nums whitespace-nowrap">{fmt.format(row.remaining_balance)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep(2)}
              className="border border-[#2a2a3e] text-gray-400 hover:text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Importing…' : `Import ${preview.length} payments`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
