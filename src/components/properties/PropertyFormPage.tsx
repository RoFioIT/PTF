'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import type { PropertyWithMortgage } from '@/types/database'

interface Props {
  mode: 'create' | 'edit'
  property?: PropertyWithMortgage
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n)
}

function computeMonthlyPayment(amount: number, annualRate: number, termMonths: number): number {
  if (amount <= 0 || termMonths <= 0) return 0
  if (annualRate === 0) return amount / termMonths
  const r = annualRate / 12
  return (amount * r) / (1 - Math.pow(1 + r, -termMonths))
}

export function PropertyFormPage({ mode, property }: Props) {
  const router = useRouter()
  const isEdit = mode === 'edit'

  const [name, setName] = useState(property?.name ?? '')
  const [type, setType] = useState<'home' | 'investment'>(property?.type ?? 'home')
  const [country, setCountry] = useState<'france' | 'italy'>(property?.country ?? 'france')
  const [address, setAddress] = useState(property?.address ?? '')
  const [currentValue, setCurrentValue] = useState(String(property?.current_value ?? ''))
  const [purchasePrice, setPurchasePrice] = useState(String(property?.purchase_price ?? ''))
  const [purchaseDate, setPurchaseDate] = useState(property?.purchase_date ?? '')
  const [notes, setNotes] = useState(property?.notes ?? '')

  const [hasMortgage, setHasMortgage] = useState(!!property?.mortgage)
  const [bankName, setBankName] = useState(property?.mortgage?.bank_name ?? '')
  const [startDate, setStartDate] = useState(property?.mortgage?.start_date ?? '')
  const [initialAmount, setInitialAmount] = useState(String(property?.mortgage?.initial_amount ?? ''))
  const [mortgageNotes, setMortgageNotes] = useState(property?.mortgage?.notes ?? '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const monthlyPaymentPreview = hasMortgage && parseFloat(initialAmount) > 0
    ? fmt(computeMonthlyPayment(parseFloat(initialAmount), 0, 240)) // placeholder shown as reference only
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !currentValue) { setError('Name and current value are required'); return }
    if (hasMortgage && (!bankName || !startDate || !initialAmount)) {
      setError('Bank name, start date, and loan amount are required for mortgage')
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (isEdit && property) {
        // Update property
        const res = await fetch('/api/properties', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: property.id,
            name, type, country,
            address: address || null,
            current_value: parseFloat(currentValue),
            purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
            purchase_date: purchaseDate || null,
            notes: notes || null,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Update failed')

        // Handle mortgage
        if (hasMortgage) {
          if (property.mortgage) {
            await fetch(`/api/properties/${property.id}/mortgage`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: property.mortgage.id,
                bank_name: bankName,
                start_date: startDate,
                initial_amount: parseFloat(initialAmount),
                notes: mortgageNotes || null,
              }),
            })
          } else {
            await fetch(`/api/properties/${property.id}/mortgage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bank_name: bankName,
                start_date: startDate,
                initial_amount: parseFloat(initialAmount),
                notes: mortgageNotes || null,
              }),
            })
          }
        } else if (!hasMortgage && property.mortgage) {
          await fetch(`/api/properties/${property.id}/mortgage`, { method: 'DELETE' })
        }
      } else {
        // Create property (+ optional mortgage)
        const res = await fetch('/api/properties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name, type, country,
            address: address || null,
            current_value: parseFloat(currentValue),
            purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
            purchase_date: purchaseDate || null,
            notes: notes || null,
            ...(hasMortgage ? {
              bank_name: bankName,
              start_date: startDate,
              initial_amount: parseFloat(initialAmount),
              mortgage_notes: mortgageNotes || null,
            } : {}),
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Create failed')
      }

      router.push('/properties')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'bg-[#0d0d14] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 w-full'
  const labelCls = 'text-xs font-medium text-gray-400 mb-1 block'

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">
          {isEdit ? 'Edit property' : 'Add property'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {isEdit ? 'Update your property details.' : 'Add a new real estate asset to your portfolio.'}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-5">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Property section ── */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Property</h2>

          <div>
            <label className={labelCls}>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Appartement Paris 11e" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Type *</label>
              <select value={type} onChange={(e) => setType(e.target.value as 'home' | 'investment')} className={inputCls}>
                <option value="home">Résidence principale</option>
                <option value="investment">Investissement locatif</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Country *</label>
              <select value={country} onChange={(e) => setCountry(e.target.value as 'france' | 'italy')} className={inputCls}>
                <option value="france">🇫🇷 France</option>
                <option value="italy">🇮🇹 Italy</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 12 rue de la Paix, Paris" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Current estimated value (€) *</label>
              <input type="number" min="0" step="1000" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} placeholder="350000" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Purchase price (€)</label>
              <input type="number" min="0" step="1000" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="300000" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Purchase date</label>
            <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes…" className={`${inputCls} resize-none`} />
          </div>
        </div>

        {/* ── Mortgage section ── */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Mortgage</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setHasMortgage((v) => !v)}
                className={`relative w-9 h-5 rounded-full transition-colors ${hasMortgage ? 'bg-indigo-600' : 'bg-[#2a2a3e]'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${hasMortgage ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-xs text-gray-400">This property has a mortgage</span>
            </label>
          </div>

          {hasMortgage && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Bank name *</label>
                  <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Crédit Agricole" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>First payment date *</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Initial loan amount (€) *</label>
                <input type="number" min="0" step="1000" value={initialAmount} onChange={(e) => setInitialAmount(e.target.value)} placeholder="250000" className={inputCls} />
                {monthlyPaymentPreview && (
                  <p className="text-xs text-gray-500 mt-1">
                    Import your bank's amortization schedule on the property detail page after saving.
                  </p>
                )}
              </div>

              <div>
                <label className={labelCls}>Notes</label>
                <textarea value={mortgageNotes} onChange={(e) => setMortgageNotes(e.target.value)} rows={2} placeholder="e.g. Fixed rate, notary fees included…" className={`${inputCls} resize-none`} />
              </div>
            </>
          )}

          {!hasMortgage && (
            <p className="text-xs text-gray-600">Toggle on to add mortgage details. You can import the full amortization schedule after saving.</p>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/properties')}
            className="border border-[#2a2a3e] text-gray-400 hover:text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add property'}
          </button>
        </div>
      </form>
    </div>
  )
}
