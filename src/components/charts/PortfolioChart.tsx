'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { HistoricalDataPoint } from '@/lib/finance/types'

interface PortfolioChartProps {
  data: HistoricalDataPoint[]
  currency?: string
}

function formatCurrency(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    month: 'short',
    year: '2-digit',
  })
}

export function PortfolioChart({ data, currency = 'EUR' }: PortfolioChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-600 text-sm">
        No historical data available
      </div>
    )
  }

  const isPositive =
    data[data.length - 1]?.value >= (data[0]?.invested ?? 0)

  const strokeColor = isPositive ? '#10b981' : '#ef4444'
  const fillColor = isPositive ? '#10b98120' : '#ef444420'

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={strokeColor} stopOpacity={0.2} />
            <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="investedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v) => formatCurrency(v, currency)}
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#12121a',
            border: '1px solid #1e1e2e',
            borderRadius: '8px',
            color: '#e8e8f0',
          }}
          formatter={(value, name) => [
            formatCurrency(Number(value ?? 0), currency),
            name === 'value' ? 'Portfolio Value' : 'Invested',
          ]}
          labelFormatter={(label) =>
            new Date(label).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          }
        />

        {/* Invested capital baseline */}
        <Area
          type="monotone"
          dataKey="invested"
          stroke="#6366f1"
          strokeWidth={1}
          strokeDasharray="4 4"
          fill="url(#investedGradient)"
          dot={false}
          name="invested"
        />

        {/* Portfolio value */}
        <Area
          type="monotone"
          dataKey="value"
          stroke={strokeColor}
          strokeWidth={2}
          fill="url(#valueGradient)"
          dot={false}
          name="value"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
