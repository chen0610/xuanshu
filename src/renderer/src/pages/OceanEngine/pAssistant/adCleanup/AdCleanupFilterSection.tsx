import React from 'react'
import { Button, Input, Label, Switch } from '../../../../components/ui'
import type { AdCleanupFilter } from '../../../../services/ocean-engine.service'
import { CleanupStepSection } from '../shared/CleanupStepSection'
import {
  DURATION_NO_LIMIT,
  DURATION_PRESET_HOURS,
  isCustomDurationHours
} from '../shared/cleanupOrgConfig'

interface AdCleanupFilterSectionProps {
  filter: AdCleanupFilter
  onFilterChange: (patch: Partial<AdCleanupFilter>) => void
  durationHours: string
  onDurationHoursChange: (value: string) => void
  filterEnabled: boolean
  onFilterEnabledChange: (enabled: boolean) => void
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
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${badgeClassName}`}>
          {badge}
        </span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    {children}
  </div>
)

export const AdCleanupFilterSection: React.FC<AdCleanupFilterSectionProps> = ({
  filter,
  onFilterChange,
  durationHours,
  onDurationHoursChange,
  filterEnabled,
  onFilterEnabledChange
}) => {
  const isCustomDuration = isCustomDurationHours(durationHours)

  return (
    <CleanupStepSection
      step={2}
      title="筛选规则"
      description="拉取范围与本地条件同时生效，按顺序依次过滤广告。"
    >
      <div className="space-y-3">
        <FilterRuleGroup
          badge="拉取阶段"
          badgeClassName="bg-primary/10 text-primary"
          title="API 拉取范围"
          description="传给巨量 API，决定拉取哪段时间、哪些状态的广告及统计数据。"
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
            <div className="space-y-2">
              <Label>广告状态</Label>
              <select
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                value={filter.ad_status}
                onChange={(e) =>
                  onFilterChange({
                    ad_status: e.target.value as 'all' | 'running' | 'paused' | 'project_paused'
                  })
                }
              >
                <option value="all">全部</option>
                <option value="running">投放中</option>
                <option value="paused">已暂停</option>
                <option value="project_paused">项目已暂停</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>投放模式</Label>
              <select
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                value={filter.delivery_mode}
                onChange={(e) =>
                  onFilterChange({
                    delivery_mode: e.target.value as 'all' | 'manual' | 'auto'
                  })
                }
              >
                <option value="all">全部</option>
                <option value="manual">手动投放</option>
                <option value="auto">自动投放</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-background p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="ad-cleanup-filter-enabled" className="text-sm">
                  数据指标筛选
                </Label>
                <p className="text-xs text-muted-foreground">
                  消耗、转化数、关键词会写入 API 请求体，在拉取列表时由服务端过滤。
                </p>
              </div>
              <Switch
                id="ad-cleanup-filter-enabled"
                checked={filterEnabled}
                onCheckedChange={onFilterEnabledChange}
              />
            </div>

            {filterEnabled && (
              <div className="grid gap-4 border-t pt-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>消耗条件</Label>
                  <div className="flex gap-2">
                    <select
                      className="h-11 rounded-md border bg-background px-3 text-sm"
                      value={filter.spend_operator}
                      onChange={(e) =>
                        onFilterChange({
                          spend_operator: e.target.value as 'gte' | 'lte'
                        })
                      }
                    >
                      <option value="lte">小于等于</option>
                      <option value="gte">大于等于</option>
                    </select>
                    <Input
                      type="number"
                      min={0}
                      value={filter.spend_value ?? 0}
                      onChange={(e) => onFilterChange({ spend_value: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>转化数条件</Label>
                  <div className="flex gap-2">
                    <select
                      className="h-11 rounded-md border bg-background px-3 text-sm"
                      value={filter.conversion_num_operator}
                      onChange={(e) =>
                        onFilterChange({
                          conversion_num_operator: e.target.value as 'gte' | 'lte'
                        })
                      }
                    >
                      <option value="lte">小于等于</option>
                      <option value="gte">大于等于</option>
                    </select>
                    <Input
                      type="number"
                      min={0}
                      value={filter.conversion_num_value ?? 0}
                      onChange={(e) =>
                        onFilterChange({ conversion_num_value: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>关键词</Label>
                  <Input
                    placeholder="按广告名称关键词筛选，可选"
                    value={filter.keyword || ''}
                    onChange={(e) => onFilterChange({ keyword: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>
        </FilterRuleGroup>

        <FilterRuleGroup
          badge="本地筛选阶段"
          badgeClassName="bg-orange-500/10 text-orange-700 dark:text-orange-400"
          title="本地筛选条件"
          description="列表拉取完成后在本地过滤，不直接从API请求。"
        >
          <div className="space-y-2">
            <Label>广告创建时长</Label>
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
              只清理创建超过指定小时数的广告；选择「不限制」则跳过创建时长筛选。
            </p>
          </div>
        </FilterRuleGroup>
      </div>
    </CleanupStepSection>
  )
}
