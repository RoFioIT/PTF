import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface MetricCardProps {
  label: string
  value: string
  subvalue?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: ReactNode
  className?: string
}

export function MetricCard({
  label,
  value,
  subvalue,
  trend,
  icon,
  className,
}: MetricCardProps) {
  return (
    <div
      className={clsx(
        'bg-[#12121a] border border-[#1e1e2e] rounded-xl p-3.5 md:p-5 flex flex-col gap-2 md:gap-3',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">
          {label}
        </span>
        {icon && (
          <span className="text-gray-600">{icon}</span>
        )}
      </div>

      <div>
        <div className="text-xl md:text-2xl font-bold text-white tabular-nums">{value}</div>
        {subvalue && (
          <div
            className={clsx(
              'text-sm mt-1 font-medium',
              trend === 'up' && 'text-emerald-400',
              trend === 'down' && 'text-red-400',
              trend === 'neutral' && 'text-gray-400',
              !trend && 'text-gray-400'
            )}
          >
            {subvalue}
          </div>
        )}
      </div>
    </div>
  )
}
