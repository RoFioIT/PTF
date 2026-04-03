'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { Allocation } from '@/lib/finance/types'

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#06b6d4',
]

interface AllocationChartProps {
  allocations: Allocation[]
  assetNames?: Map<string, string>
  currency?: string
}

function formatCurrency(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(value)
}

export function AllocationChart({
  allocations,
  assetNames,
  currency = 'EUR',
}: AllocationChartProps) {
  if (allocations.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-600 text-sm">
        No positions yet
      </div>
    )
  }

  const data = allocations.map((a) => ({
    name: assetNames?.get(a.assetId) ?? a.assetId.slice(0, 8),
    value: a.currentValue,
    pct: a.allocationPct,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((_entry, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#12121a',
            border: '1px solid #1e1e2e',
            borderRadius: '8px',
            color: '#e8e8f0',
          }}
          formatter={(value, _name, props) => [
            `${formatCurrency(Number(value ?? 0), currency)} (${(props.payload as { pct: number }).pct.toFixed(1)}%)`,
            (props.payload as { name: string }).name,
          ]}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: '#9ca3af', fontSize: 12 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
