import React, { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CleanupStepSectionProps {
  step: number
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export const CleanupStepSection: React.FC<CleanupStepSectionProps> = ({
  step,
  title,
  description,
  children,
  className
}) => (
  <section className={cn('space-y-3 rounded-lg border bg-muted/20 p-4', className)}>
    <div className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {step}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-sm font-medium">{title}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
    <div className="pl-9">{children}</div>
  </section>
)
