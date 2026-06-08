import React from 'react'
import { CheckCircle } from 'lucide-react'
import { Label } from '../../../components/ui'

export interface TemplateSelectorItem {
  code: string
  label: string
  tags: string[]
}

interface TemplateSelectorCardProps {
  items: TemplateSelectorItem[]
  selectedCode: string | null
  onSelect: (code: string) => void
  compact?: boolean
}

export const TemplateSelectorCard: React.FC<TemplateSelectorCardProps> = ({
  items,
  selectedCode,
  onSelect,
  compact = false
}) => {
  return (
    <div className="space-y-2">
      {!compact && <Label>投放模板</Label>}
      <div
        className={
          compact
            ? 'grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4'
            : 'grid grid-cols-2 gap-3'
        }
      >
        {items.map((item) => (
          <button
            key={item.code}
            type="button"
            onClick={() => onSelect(item.code)}
            className={`text-left transition-colors ${
              compact ? 'rounded-xl border px-3 py-2' : 'rounded-lg border p-4'
            } ${
              selectedCode === item.code
                ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                : 'hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{item.label}</span>
              {selectedCode === item.code && (
                <CheckCircle className="w-4 h-4 text-primary shrink-0" />
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
