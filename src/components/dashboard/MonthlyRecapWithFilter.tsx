'use client'

import { useState } from 'react'
import { MonthlyRecap } from './MonthlyRecap'
import type { MonthlyPerf } from '@/lib/finance/monthly'

interface PortfolioOption {
  id: string
  label: string
  type: string
  data: MonthlyPerf[]
}

interface Props {
  allData: MonthlyPerf[]
  portfolios: PortfolioOption[]
  currency?: string
}

export function MonthlyRecapWithFilter({ allData, portfolios, currency = 'EUR' }: Props) {
  const [selected, setSelected] = useState<string>('all')
  const currentData =
    selected === 'all' ? allData : (portfolios.find((p) => p.id === selected)?.data ?? allData)

  return (
    <>
      {portfolios.length > 1 && (
        <div className="flex items-center gap-2 px-4 md:px-6 py-3 border-b border-[#1e1e2e]">
          <button
            onClick={() => setSelected('all')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              selected === 'all'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 border border-[#1e1e2e] hover:border-indigo-500/50 hover:text-gray-200'
            }`}
          >
            All
          </button>
          {portfolios.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                selected === p.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 border border-[#1e1e2e] hover:border-indigo-500/50 hover:text-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <MonthlyRecap data={currentData} currency={currency} />
    </>
  )
}
