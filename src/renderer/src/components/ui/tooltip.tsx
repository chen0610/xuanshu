import * as React from 'react'
import { cn } from '../../lib/utils'

interface TooltipProviderProps {
  children: React.ReactNode
  delayDuration?: number
}

export const TooltipProvider: React.FC<TooltipProviderProps> = ({ children }) => {
  return <>{children}</>
}

interface TooltipProps {
  children: React.ReactNode
}

export const Tooltip: React.FC<TooltipProps> = ({ children }) => {
  return <>{children}</>
}

interface TooltipTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

export const TooltipTrigger = React.forwardRef<HTMLDivElement, TooltipTriggerProps>(
  ({ children, asChild, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ref,
        ...props
      } as any)
    }

    return (
      <div ref={ref} {...props}>
        {children}
      </div>
    )
  }
)
TooltipTrigger.displayName = 'TooltipTrigger'

interface TooltipContentProps {
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
  className?: string
}

export const TooltipContent: React.FC<TooltipContentProps> = ({
  children,
  side = 'right',
  className
}) => {
  return (
    <div
      className={cn(
        'absolute z-50 px-3 py-1.5 text-sm text-popover-foreground bg-popover border rounded-md shadow-md whitespace-nowrap',
        side === 'right' && 'left-full ml-2 top-1/2 -translate-y-1/2',
        side === 'left' && 'right-full mr-2 top-1/2 -translate-y-1/2',
        side === 'top' && 'bottom-full mb-2 left-1/2 -translate-x-1/2',
        side === 'bottom' && 'top-full mt-2 left-1/2 -translate-x-1/2',
        'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200',
        className
      )}
    >
      {children}
    </div>
  )
}
TooltipContent.displayName = 'TooltipContent'
