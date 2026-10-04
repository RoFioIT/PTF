import { clsx } from 'clsx'

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info' | 'purple'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-surface text-ink-2',
  success: 'bg-emerald-400/10 text-gain',
  danger: 'bg-red-400/10 text-loss',
  warning: 'bg-amber-400/10 text-warn',
  info: 'bg-blue-400/10 text-blue-600',
  purple: 'bg-indigo-400/10 text-accent',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
