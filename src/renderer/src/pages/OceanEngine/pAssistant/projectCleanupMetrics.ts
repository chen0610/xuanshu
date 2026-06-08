export type ProjectCleanupFilterOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'between'

export interface ProjectCleanupMetricCondition {
  id: string
  field: string
  operator: ProjectCleanupFilterOperator
  value: string
  minValue: string
  maxValue: string
}

export interface ProjectCleanupMetricOption {
  key: string
  label: string
}

export const PROJECT_CLEANUP_METRIC_OPTIONS: ProjectCleanupMetricOption[] = [
  { key: 'stat_cost', label: '消耗' },
  { key: 'convert_cnt', label: '转化数' },
  { key: 'active', label: '激活数' },
  { key: 'conversion_cost', label: '平均转化成本' },
  { key: 'attribution_micro_game_0d_roi', label: '小程序/小游戏当日变现ROI' },
  {
    key: 'attribution_micro_game_iaap_roi_1day',
    label: '小程序/小游戏当日内购&变现ROI（激活时间）'
  }
]

export const PROJECT_CLEANUP_FILTER_OPERATOR_LABELS: Record<
  ProjectCleanupFilterOperator,
  string
> = {
  gt: '大于',
  gte: '大于等于',
  lt: '小于',
  lte: '小于等于',
  eq: '等于',
  between: '介于'
}

export function createProjectCleanupMetricCondition(
  field = 'stat_cost'
): ProjectCleanupMetricCondition {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    field,
    operator: 'lte',
    value: '',
    minValue: '',
    maxValue: ''
  }
}

export function parseProjectCleanupMetricNumber(raw: string): number | null {
  const normalized = raw.trim().replace(/,/g, '')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function isValidProjectCleanupMetricCondition(
  condition: ProjectCleanupMetricCondition
): boolean {
  if (!condition.field) return false
  if (condition.operator === 'between') {
    const minValue = parseProjectCleanupMetricNumber(condition.minValue)
    const maxValue = parseProjectCleanupMetricNumber(condition.maxValue)
    return minValue !== null && maxValue !== null && minValue <= maxValue
  }
  return parseProjectCleanupMetricNumber(condition.value) !== null
}

export function serializeProjectCleanupMetricConditions(
  conditions: ProjectCleanupMetricCondition[]
): Array<{
  field: string
  operator: ProjectCleanupFilterOperator
  value?: number
  min_value?: number
  max_value?: number
}> {
  return conditions.filter(isValidProjectCleanupMetricCondition).map((condition) => {
    if (condition.operator === 'between') {
      return {
        field: condition.field,
        operator: condition.operator,
        min_value: parseProjectCleanupMetricNumber(condition.minValue) ?? undefined,
        max_value: parseProjectCleanupMetricNumber(condition.maxValue) ?? undefined
      }
    }
    return {
      field: condition.field,
      operator: condition.operator,
      value: parseProjectCleanupMetricNumber(condition.value) ?? undefined
    }
  })
}
