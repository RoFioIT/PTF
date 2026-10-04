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
        'bg-panel border border-line rounded-xl p-3.5 md:p-5 flex flex-col gap-2 md:gap-3',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-3 uppercase tracking-wider font-medium">
          {label}
        </span>
        {icon && (
          <span className="text-ink-4">{icon}</span>
        )}
      </div>

      <div>
        <div className="text-xl md:text-2xl font-bold text-ink tabular-nums">{value}</div>
        {subvalue && (
          <div
            className={clsx(
              'text-sm mt-1 font-medium',
              trend === 'up' && 'text-gain',
              trend === 'down' && 'text-loss',
              trend === 'neutral' && 'text-ink-3',
              !trend && 'text-ink-3'
            )}
          >
            {subvalue}
          </div>
        )}
      </div>
    </div>
  )
}
