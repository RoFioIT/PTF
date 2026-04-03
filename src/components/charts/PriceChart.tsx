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

export interface PricePoint {
  date: string
  price: number
}

interface PriceChartProps {
  data: PricePoint[]
  currency?: string
}

function formatPrice(value: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    month: 'short',
    year: '2-digit',
  })
}

export function PriceChart({ data, currency = 'EUR' }: PriceChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
        No price history — click Refresh prices on the dashboard first.
      </div>
    )
  }

  const first = data[0].price
  const last = data[data.length - 1].price
  const isPositive = last >= first
  const strokeColor = isPositive ? '#10b981' : '#ef4444'

  const min = Math.min(...data.map((d) => d.price))
  const max = Math.max(...data.map((d) => d.price))
  const padding = (max - min) * 0.1 || max * 0.05

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={strokeColor} stopOpacity={0.2} />
            <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
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
          domain={[min - padding, max + padding]}
          tickFormatter={(v) => formatPrice(v, currency)}
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={90}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#12121a',
            border: '1px solid #1e1e2e',
            borderRadius: '8px',
            color: '#e8e8f0',
          }}
          formatter={(value) => [formatPrice(Number(value), currency), 'Price']}
          labelFormatter={(label) =>
            new Date(label).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          }
        />

        <Area
          type="monotone"
          dataKey="price"
          stroke={strokeColor}
          strokeWidth={2}
          fill="url(#priceGradient)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
