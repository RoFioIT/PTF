'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { MetricCard } from '@/components/ui/MetricCard'
import { Badge } from '@/components/ui/Badge'
import { MortgageImport } from './MortgageImport'
import type { PropertyWithMortgage, MortgagePayment } from '@/types/database'

interface Props {
  property: PropertyWithMortgage
  payments: MortgagePayment[]
  remainingBalance: number
  netEquity: number
  today: string
}

const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
const fmtShort = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })
const PAGE_SIZE = 24

function findCurrentPageIdx(payments: MortgagePayment[], today: string): number {
  const lastPastIdx = [...payments].reverse().findIndex((p) => p.payment_date <= today)
  if (lastPastIdx === -1) return 0
  const actualIdx = payments.length - 1 - lastPastIdx
  return Math.floor(actualIdx / PAGE_SIZE)
}

export function PropertyDetailView({ property, payments, remainingBalance, netEquity, today }: Props) {
  const router = useRouter()
  const [page, setPage] = useState(() => findCurrentPageIdx(payments, today))
  const [deleting, setDeleting] = useState(false)

  const totalPages = Math.ceil(payments.length / PAGE_SIZE)
  const pagePayments = payments.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Find current row (last payment with date <= today)
  const currentRowIdx = (() => {
    let last = -1
    payments.forEach((p, i) => { if (p.payment_date <= today) last = i })
    return last
  })()

  const totalInterestPaid = payments
    .filter((p) => p.payment_date <= today)
    .reduce((s, p) => s + p.interest, 0)

  const totalInsurancePaid = payments
    .filter((p) => p.payment_date <= today)
    .reduce((s, p) => s + p.insurance, 0)

  async function handleDelete() {
    if (!confirm(`Delete "${property.name}"? This will also remove all mortgage data.`)) return
    setDeleting(true)
    await fetch(`/api/properties?id=${property.id}`, { method: 'DELETE' })
    router.push('/properties')
  }

  const countryLabel = property.country === 'france' ? '🇫🇷 France' : '🇮🇹 Italy'

  return (
    <div className="p-4 md:p-8">
      {/* Back + actions */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/properties" className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Properties
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/properties/${property.id}/edit`}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white border border-[#2a2a3e] hover:border-indigo-500 px-3 py-2 rounded-lg transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 border border-red-400/20 hover:border-red-400/50 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl md:text-2xl font-bold text-white">{property.name}</h1>
          <Badge variant={property.type === 'home' ? 'purple' : 'info'}>
            {property.type === 'home' ? 'Résidence principale' : 'Investissement locatif'}
          </Badge>
          <Badge variant="default">{countryLabel}</Badge>
        </div>
        {property.address && <p className="text-gray-500 text-sm mt-1">{property.address}</p>}
      </div>

      {/* Summary MetricCards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard
          label="Current value"
          value={fmtShort.format(property.current_value)}
          subvalue={property.purchase_date ? `Acquired ${property.purchase_date}` : undefined}
          trend="neutral"
        />
        <MetricCard
          label="Net equity"
          value={fmtShort.format(netEquity)}
          subvalue={property.current_value > 0 ? `${Math.round((netEquity / property.current_value) * 100)}% of value` : undefined}
          trend={netEquity >= 0 ? 'up' : 'down'}
        />
        <MetricCard
          label="Remaining debt"
          value={fmtShort.format(remainingBalance)}
          subvalue={property.mortgage ? property.mortgage.bank_name : 'No mortgage'}
          trend={remainingBalance > 0 ? 'down' : 'neutral'}
        />
      </div>

      {/* Mortgage summary card */}
      {property.mortgage && (
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Mortgage</h2>
            {payments.length > 0 && (
              <span className="text-xs text-gray-500">{payments.length} payments imported</span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Bank</p>
              <p className="text-white font-medium">{property.mortgage.bank_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Start date</p>
              <p className="text-white font-medium">{property.mortgage.start_date}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Initial amount</p>
              <p className="text-white font-medium tabular-nums">{fmtShort.format(property.mortgage.initial_amount)}</p>
            </div>
            {payments.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Interest paid to date</p>
                <p className="text-red-400 font-medium tabular-nums">{fmtShort.format(totalInterestPaid)}</p>
              </div>
            )}
            {totalInsurancePaid > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Insurance paid to date</p>
                <p className="text-gray-300 font-medium tabular-nums">{fmtShort.format(totalInsurancePaid)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Amortization table */}
      {property.mortgage && (
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e1e2e] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Amortization Schedule</h2>
            {payments.length > 0 && (
              <span className="text-xs text-gray-500">
                {payments.length} rows · {Math.ceil(payments.length / 12)} years
              </span>
            )}
          </div>

          {payments.length === 0 ? (
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4">
                No amortization data yet. Import your bank's schedule to track your mortgage progress.
              </p>
              <MortgageImport propertyId={property.id} mortgageId={property.mortgage.id} />
            </div>
          ) : (
            <>
              {/* Re-import option */}
              <div className="px-5 py-3 border-b border-[#1e1e2e] flex items-center justify-between bg-[#0d0d14]">
                <span className="text-xs text-gray-600">Showing page {page + 1} of {totalPages}</span>
                <details className="group">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 list-none">
                    Re-import schedule ↓
                  </summary>
                  <div className="absolute z-10 mt-2 w-full max-w-2xl">
                    <MortgageImport propertyId={property.id} mortgageId={property.mortgage.id} />
                  </div>
                </details>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#0d0d14]">
                    <tr>
                      {['#', 'Date', 'Payment', 'Principal', 'Interest', 'Insurance', 'Remaining Balance'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagePayments.map((p) => {
                      const globalIdx = payments.indexOf(p)
                      const isCurrent = globalIdx === currentRowIdx
                      return (
                        <tr
                          key={p.id}
                          className={`border-t border-[#1e1e2e] ${
                            isCurrent
                              ? 'bg-indigo-600/10 border-l-2 border-l-indigo-500'
                              : p.payment_date <= today
                              ? 'opacity-60'
                              : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-gray-400 tabular-nums w-12">{p.month_number}</td>
                          <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                            {p.payment_date}
                            {isCurrent && <span className="ml-2 text-xs text-indigo-400 font-medium">← now</span>}
                          </td>
                          <td className="px-4 py-3 text-white tabular-nums whitespace-nowrap">{fmt.format(p.total_payment)}</td>
                          <td className="px-4 py-3 text-emerald-400 tabular-nums whitespace-nowrap">{fmt.format(p.principal)}</td>
                          <td className="px-4 py-3 text-gray-300 tabular-nums whitespace-nowrap">{fmt.format(p.interest)}</td>
                          <td className="px-4 py-3 text-gray-400 tabular-nums whitespace-nowrap">{fmt.format(p.insurance)}</td>
                          <td className="px-4 py-3 text-gray-200 tabular-nums whitespace-nowrap font-medium">{fmt.format(p.remaining_balance)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-[#1e1e2e] flex items-center justify-between">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const p = totalPages <= 7 ? i : i === 0 ? 0 : i === 6 ? totalPages - 1 : page - 2 + i
                      return (
                        <button
                          key={i}
                          onClick={() => setPage(p)}
                          className={`w-7 h-7 text-xs rounded-lg ${
                            p === page ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-white'
                          }`}
                        >
                          {p + 1}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!property.mortgage && (
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm mb-3">No mortgage linked to this property.</p>
          <Link
            href={`/properties/${property.id}/edit`}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Add a mortgage →
          </Link>
        </div>
      )}
    </div>
  )
}
