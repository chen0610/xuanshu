import React from 'react'
import { X } from 'lucide-react'
import { Button, Input, Label } from '../../../../components/ui'
import {
  PROJECT_CLEANUP_FILTER_OPERATOR_LABELS,
  PROJECT_CLEANUP_METRIC_OPTIONS,
  isValidProjectCleanupMetricCondition,
  type ProjectCleanupMetricCondition
} from '../projectCleanupMetrics'

interface MetricConditionRowProps {
  condition: ProjectCleanupMetricCondition
  onUpdate: (patch: Partial<Omit<ProjectCleanupMetricCondition, 'id'>>) => void
  onRemove: () => void
}

export const MetricConditionRow: React.FC<MetricConditionRowProps> = ({
  condition,
  onUpdate,
  onRemove
}) => {
  const isInvalid = !isValidProjectCleanupMetricCondition(condition)

  return (
    <div className="space-y-2 rounded-lg border bg-background p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(160px,1.4fr)_100px_1fr_1fr_auto]">
        <div className="space-y-1 sm:col-span-2 lg:col-span-1">
          <Label className="text-xs">指标</Label>
          <select
            value={condition.field}
            onChange={(e) => onUpdate({ field: e.target.value })}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {PROJECT_CLEANUP_METRIC_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">条件</Label>
          <select
            value={condition.operator}
            onChange={(e) =>
              onUpdate({ operator: e.target.value as ProjectCleanupMetricCondition['operator'] })
            }
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {Object.entries(PROJECT_CLEANUP_FILTER_OPERATOR_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {condition.operator === 'between' ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs">最小值</Label>
              <Input
                type="number"
                value={condition.minValue}
                onChange={(e) => onUpdate({ minValue: e.target.value })}
                className="h-9"
                placeholder="含边界"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">最大值</Label>
              <Input
                type="number"
                value={condition.maxValue}
                onChange={(e) => onUpdate({ maxValue: e.target.value })}
                className="h-9"
                placeholder="含边界"
              />
            </div>
          </>
        ) : (
          <div className="space-y-1 sm:col-span-2 lg:col-span-2">
            <Label className="text-xs">数值</Label>
            <Input
              type="number"
              value={condition.value}
              onChange={(e) => onUpdate({ value: e.target.value })}
              className="h-9"
              placeholder="请输入比较值"
            />
          </div>
        )}
        <div className="flex items-end justify-end sm:col-span-2 lg:col-span-1">
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="删除条件">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {isInvalid && <div className="text-xs text-destructive">请填写有效的指标比较值</div>}
    </div>
  )
}
