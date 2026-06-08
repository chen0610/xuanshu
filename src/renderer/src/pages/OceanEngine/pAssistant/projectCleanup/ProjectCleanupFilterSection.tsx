import React from 'react'
import { Plus } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Switch
} from '../../../../components/ui'
import { type ProjectCleanupMetricCondition } from '../projectCleanupMetrics'
import type { ProjectCleanupFilter } from '../../../../services/ocean-engine.service'
import { DURATION_NO_LIMIT, DURATION_PRESET_HOURS, isCustomDurationHours } from './projectCleanupConfig'
import { MetricConditionRow } from './MetricConditionRow'
import { ProjectCleanupStepSection } from './ProjectCleanupStepSection'

interface ProjectCleanupFilterSectionProps {
  filter: ProjectCleanupFilter
  onFilterChange: (patch: Partial<ProjectCleanupFilter>) => void
  durationHours: string
  onDurationHoursChange: (value: string) => void
  filterEnabled: boolean
  onFilterEnabledChange: (enabled: boolean) => void
  metricConditions: ProjectCleanupMetricCondition[]
  onAddMetricCondition: () => void
  onUpdateMetricCondition: (
    id: string,
    patch: Partial<Omit<ProjectCleanupMetricCondition, 'id'>>
  ) => void
  onRemoveMetricCondition: (id: string) => void
  onClearMetricConditions: () => void
}

interface FilterRuleGroupProps {
  title: string
  badge: string
  badgeClassName?: string
  description: string
  children: React.ReactNode
}

const FilterRuleGroup: React.FC<FilterRuleGroupProps> = ({
  title,
  badge,
  badgeClassName = 'bg-muted text-muted-foreground',
  description,
  children
}) => (
  <div className="space-y-3 rounded-lg border bg-background/60 p-4">
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-medium ${badgeClassName}`}
        >
          {badge}
        </span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    {children}
  </div>
)


export const ProjectCleanupFilterSection: React.FC<ProjectCleanupFilterSectionProps> = ({
  filter,
  onFilterChange,
  durationHours,
  onDurationHoursChange,
  filterEnabled,
  onFilterEnabledChange,
  metricConditions,
  onAddMetricCondition,
  onUpdateMetricCondition,
  onRemoveMetricCondition,
  onClearMetricConditions
}) => {
  const isCustomDuration = isCustomDurationHours(durationHours)

  const handleFilterEnabledChange = (enabled: boolean): void => {
    onFilterEnabledChange(enabled)
    if (enabled && metricConditions.length === 0) {
      onAddMetricCondition()
    }
  }

  return (
    <ProjectCleanupStepSection
      step={2}
      title="筛选规则"
      description="拉取范围与本地条件同时生效，按顺序依次过滤项目。"
    >
      <div className="space-y-3">
        <FilterRuleGroup
          badge="拉取阶段"
          badgeClassName="bg-primary/10 text-primary"
          title="API 拉取范围"
          description="传给巨量 API，决定拉取哪段时间、哪些状态的项目及统计数据。"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>开始日期</Label>
              <Input
                type="date"
                value={filter.start_date || ''}
                onChange={(e) => onFilterChange({ start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>结束日期</Label>
              <Input
                type="date"
                value={filter.end_date || ''}
                onChange={(e) => onFilterChange({ end_date: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>项目状态 </Label>
              <select
                className="h-11 w-full rounded-md border bg-background px-3 text-sm sm:max-w-xs"
                value={filter.project_status}
                onChange={(e) =>
                  onFilterChange({
                    project_status: e.target.value as 'all' | 'running' | 'paused'
                  })
                }
              >
                <option value="all">全部</option>
                <option value="running">启用中</option>
                <option value="paused">已暂停</option>
              </select>
            </div>
          </div>
        </FilterRuleGroup>

        <FilterRuleGroup
          badge="本地筛选阶段"
          badgeClassName="bg-orange-500/10 text-orange-700 dark:text-orange-400"
          title="本地筛选条件"
          description="列表拉取完成后在本地过滤，不直接从API请求。"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>项目创建时长</Label>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESET_HOURS.map((hours) => (
                  <Button
                    key={hours}
                    type="button"
                    size="sm"
                    variant={durationHours === hours ? 'default' : 'outline'}
                    onClick={() => onDurationHoursChange(hours)}
                  >
                    {hours}h
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={durationHours === DURATION_NO_LIMIT ? 'default' : 'outline'}
                  onClick={() => onDurationHoursChange(DURATION_NO_LIMIT)}
                >
                  不限制
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={isCustomDuration ? 'default' : 'outline'}
                  onClick={() => {
                    if (!isCustomDuration) onDurationHoursChange('')
                  }}
                >
                  自定义
                </Button>
              </div>
              {isCustomDuration && (
                <Input
                  type="number"
                  min={1}
                  value={durationHours}
                  onChange={(e) => onDurationHoursChange(e.target.value)}
                  placeholder="请输入小时数"
                />
              )}
              <p className="text-xs text-muted-foreground">
                只清理创建超过指定小时数的项目；选择「不限制」则跳过创建时长筛选。
              </p>
            </div>

            <div className="space-y-3 rounded-lg border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="project-cleanup-filter-enabled" className="text-sm">
                    自定义指标筛选
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    按消耗、转化、ROI 等指标过滤，全部满足才进入待清理列表。
                  </p>
                </div>
                <Switch
                  id="project-cleanup-filter-enabled"
                  checked={filterEnabled}
                  onCheckedChange={handleFilterEnabledChange}
                />
              </div>

              {filterEnabled && (
                <div className="space-y-2 border-t pt-3">
                  <div className="flex items-center justify-end gap-2">
                    {metricConditions.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClearMetricConditions}
                      >
                        清空条件
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={onAddMetricCondition}>
                      <Plus className="mr-1 h-4 w-4" />
                      添加条件
                    </Button>
                  </div>
                  {metricConditions.map((condition) => (
                    <MetricConditionRow
                      key={condition.id}
                      condition={condition}
                      onUpdate={(patch) => onUpdateMetricCondition(condition.id, patch)}
                      onRemove={() => onRemoveMetricCondition(condition.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </FilterRuleGroup>
      </div>
    </ProjectCleanupStepSection>
  )
}
