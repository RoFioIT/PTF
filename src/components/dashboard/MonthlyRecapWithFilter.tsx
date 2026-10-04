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

interface AssetOption {
  id: string
  label: string
  data: MonthlyPerf[]
}

interface Props {
  allData: MonthlyPerf[]
  portfolios: PortfolioOption[]
  assets?: AssetOption[]
  currency?: string
}

const pillClass = (active: boolean) =>
  `px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
    active
      ? 'bg-indigo-600 text-white'
      : 'text-ink-3 border border-line hover:border-indigo-500/50 hover:text-ink'
  }`

export function MonthlyRecapWithFilter({ allData, portfolios, assets = [], currency = 'EUR' }: Props) {
  const [view, setView] = useState<'portfolio' | 'asset'>('portfolio')
  const [selected, setSelected] = useState<string>('all')
  const [selectedAsset, setSelectedAsset] = useState<string>(assets[0]?.id ?? '')

  const currentAsset = assets.find((a) => a.id === selectedAsset) ?? assets[0]
  const currentData =
    view === 'asset'
      ? (currentAsset?.data ?? [])
      : selected === 'all'
        ? allData
        : (portfolios.find((p) => p.id === selected)?.data ?? allData)

  return (
    <>
      {assets.length > 0 && (
        <div className="flex items-center gap-4 px-4 md:px-6 pt-3 border-b border-line">
          {([['portfolio', 'By portfolio'], ['asset', 'By asset']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`pb-2 text-xs font-medium border-b-2 transition-colors ${
                view === v
                  ? 'border-indigo-500 text-ink'
                  : 'border-transparent text-ink-3 hover:text-ink-2'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {view === 'asset' && assets.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 px-4 md:px-6 py-3 border-b border-line max-h-28 overflow-y-auto">
          {assets.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedAsset(a.id)}
              className={pillClass(currentAsset?.id === a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : (
        portfolios.length > 1 && (
          <div className="flex items-center gap-2 px-4 md:px-6 py-3 border-b border-line">
            <button onClick={() => setSelected('all')} className={pillClass(selected === 'all')}>
              All
            </button>
            {portfolios.map((p) => (
              <button key={p.id} onClick={() => setSelected(p.id)} className={pillClass(selected === p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        )
      )}
      <MonthlyRecap data={currentData} currency={currency} />
    </>
  )
}
