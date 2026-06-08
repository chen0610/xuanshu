import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Pause,
  Play,
  FolderTree,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ArrowDown,
  ArrowUp,
  Columns,
  GripVertical,
  RotateCcw,
  X
} from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../../components/ui'
import { configService } from '../../services/config.service'
import {
  dataAssistantV2Service,
  dataControlService,
  type DataControlListRequest,
  type DataControlListResponse,
  type DataControlStatusItem
} from '../../services/ocean-engine.service'
import type { Config } from '../../types/config.types'

type ControlTab = 'projects' | 'promotions'
type FilterOperator = 'gt' | 'eq' | 'lt' | 'between'

interface MetricFilterCondition {
  id: string
  field: string
  operator: FilterOperator
  value: string
  minValue: string
  maxValue: string
}

interface FilterLoadingState {
  page: number
  matched: number
  scanned: number
}

interface FilterFetchResult {
  items: any[]
  scanned: number
  reachedLimit: boolean
}

interface OrgNodeSelection {
  id: string
  name: string
}

interface RememberedSelection {
  configId: number | null
  ebpId: string
  orgNodes: OrgNodeSelection[]
}

interface PaginationState {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

interface DataControlColumn {
  key: string
  label: string
  source?: 'root' | 'metrics'
  orderField?: string
}

interface DataControlColumnConfig {
  fixed: DataControlColumn[]
  optional: DataControlColumn[]
}

const DEFAULT_EBP_ID = '1853254961360906'
const COLUMN_STORAGE_KEY = 'ocean-engine-data-control-visible-optional-columns'
const SELECTION_STORAGE_KEY = 'ocean-engine-data-control-selection'
const MAX_FILTER_LOAD_PAGES = 50
const DEFAULT_FILTER_OPERATOR: FilterOperator = 'gt'
const FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
  gt: '大于',
  eq: '等于',
  lt: '小于',
  between: '介于'
}

const retentionOptionalColumns: DataControlColumn[] = [
  { key: 'active', label: '激活数', source: 'metrics', orderField: 'active' },
  {
    key: 'attribution_next_day_open_rate',
    label: '次留率',
    source: 'metrics',
    orderField: 'attribution_next_day_open_rate'
  },
  {
    key: 'cpm_platform',
    label: '平均千次展现费用(元)',
    source: 'metrics',
    orderField: 'cpm_platform'
  },
  { key: 'conversion_rate', label: '转化率', source: 'metrics', orderField: 'conversion_rate' },
  {
    key: 'attribution_retention_2d_rate',
    label: '2日留存率',
    source: 'metrics',
    orderField: 'attribution_retention_2d_rate'
  },
  {
    key: 'attribution_retention_3d_rate',
    label: '3日留存率',
    source: 'metrics',
    orderField: 'attribution_retention_3d_rate'
  },
  {
    key: 'attribution_retention_4d_rate',
    label: '4日留存率',
    source: 'metrics',
    orderField: 'attribution_retention_4d_rate'
  },
  {
    key: 'attribution_retention_5d_rate',
    label: '5日留存率',
    source: 'metrics',
    orderField: 'attribution_retention_5d_rate'
  },
  {
    key: 'attribution_retention_6d_rate',
    label: '6日留存率',
    source: 'metrics',
    orderField: 'attribution_retention_6d_rate'
  },
  {
    key: 'attribution_retention_7d_rate',
    label: '7日次留率',
    source: 'metrics',
    orderField: 'attribution_retention_7d_rate'
  },
  {
    key: 'attribution_retention_2d_cnt',
    label: '2日留存数',
    source: 'metrics',
    orderField: 'attribution_retention_2d_cnt'
  },
  {
    key: 'attribution_retention_3d_cnt',
    label: '3日留存数',
    source: 'metrics',
    orderField: 'attribution_retention_3d_cnt'
  },
  {
    key: 'attribution_retention_4d_cnt',
    label: '4日留存数',
    source: 'metrics',
    orderField: 'attribution_retention_4d_cnt'
  },
  {
    key: 'attribution_retention_5d_cnt',
    label: '5日留存数',
    source: 'metrics',
    orderField: 'attribution_retention_5d_cnt'
  },
  {
    key: 'attribution_retention_6d_cnt',
    label: '6日留存数',
    source: 'metrics',
    orderField: 'attribution_retention_6d_cnt'
  },
  {
    key: 'attribution_retention_7d_cnt',
    label: '7日留存数',
    source: 'metrics',
    orderField: 'attribution_retention_7d_cnt'
  },
  {
    key: 'attribution_retention_2d_cost',
    label: '2日留存成本',
    source: 'metrics',
    orderField: 'attribution_retention_2d_cost'
  },
  {
    key: 'attribution_retention_3d_cost',
    label: '3日留存成本',
    source: 'metrics',
    orderField: 'attribution_retention_3d_cost'
  },
  {
    key: 'attribution_retention_4d_cost',
    label: '4日留存成本',
    source: 'metrics',
    orderField: 'attribution_retention_4d_cost'
  },
  {
    key: 'attribution_retention_5d_cost',
    label: '5日留存成本',
    source: 'metrics',
    orderField: 'attribution_retention_5d_cost'
  },
  {
    key: 'attribution_retention_6d_cost',
    label: '6日留存成本',
    source: 'metrics',
    orderField: 'attribution_retention_6d_cost'
  },
  {
    key: 'attribution_retention_7d_cost',
    label: '7日留存成本',
    source: 'metrics',
    orderField: 'attribution_retention_7d_cost'
  }
]

const projectColumnConfig: DataControlColumnConfig = {
  fixed: [
    { key: 'project_name', label: '项目名称', orderField: 'project_name' },
    { key: 'project_status_first_name', label: '项目状态', orderField: 'project_status_first' },
    { key: 'campaign_budget', label: '项目预算', orderField: 'campaign_budget' },
    { key: 'stat_cost', label: '消耗', source: 'metrics', orderField: 'stat_cost' }
  ],
  optional: [
    {
      key: 'attribution_micro_game_iaap_roi_1day',
      label: '小程序/小游戏当日内购&变现ROI（激活时间）',
      source: 'metrics',
      orderField: 'attribution_micro_game_iaap_roi_1day'
    },
    { key: 'active_cost', label: '激活成本', source: 'metrics', orderField: 'active_cost' },
    {
      key: 'conversion_cost',
      label: '平均转化成本',
      source: 'metrics',
      orderField: 'conversion_cost'
    },
    {
      key: 'attribution_day_active_pay_cost',
      label: '计费当日激活且首次付费成本',
      source: 'metrics',
      orderField: 'attribution_day_active_pay_cost'
    },
    {
      key: 'attribution_billing_game_in_app_ltv_1day',
      label: '计费当日付费金额',
      source: 'metrics',
      orderField: 'attribution_billing_game_in_app_ltv_1day'
    },
    {
      key: 'attribution_micro_game_0d_roi',
      label: '小程序/小游戏当日变现ROI',
      source: 'metrics',
      orderField: 'attribution_micro_game_0d_roi'
    },
    {
      key: 'attribution_micro_game_0d_ltv',
      label: '小程序/小游戏当日LTV',
      source: 'metrics',
      orderField: 'attribution_micro_game_0d_ltv'
    },
    {
      key: 'attribution_micro_game_3d_ltv',
      label: '小程序/小游戏激活后三日LTV',
      source: 'metrics',
      orderField: 'attribution_micro_game_3d_ltv'
    },
    {
      key: 'attribution_micro_game_3d_roi',
      label: '小程序/小游戏激活后三日变现ROI',
      source: 'metrics',
      orderField: 'attribution_micro_game_3d_roi'
    },
    ...retentionOptionalColumns
  ]
}

const promotionColumnConfig: DataControlColumnConfig = {
  fixed: [
    { key: 'promotion_name', label: '单元名称', orderField: 'promotion_name' },
    { key: 'promotion_status_name', label: '单元状态', orderField: 'promotion_status_first' },
    { key: 'stat_cost', label: '消耗', source: 'metrics', orderField: 'stat_cost' }
  ],
  optional: [
    {
      key: 'attribution_micro_game_iaap_roi_1day',
      label: '小程序/小游戏当日内购&变现ROI（激活时间）',
      source: 'metrics',
      orderField: 'attribution_micro_game_iaap_roi_1day'
    },
    { key: 'active_cost', label: '激活成本', source: 'metrics', orderField: 'active_cost' },
    {
      key: 'conversion_cost',
      label: '平均转化成本',
      source: 'metrics',
      orderField: 'conversion_cost'
    },
    {
      key: 'attribution_day_active_pay_cost',
      label: '计费当日激活且首次付费成本',
      source: 'metrics',
      orderField: 'attribution_day_active_pay_cost'
    },
    {
      key: 'attribution_billing_game_in_app_ltv_1day',
      label: '计费当日付费金额',
      source: 'metrics',
      orderField: 'attribution_billing_game_in_app_ltv_1day'
    },
    {
      key: 'attribution_micro_game_0d_roi',
      label: '小程序/小游戏当日变现ROI',
      source: 'metrics',
      orderField: 'attribution_micro_game_0d_roi'
    },
    {
      key: 'attribution_micro_game_0d_ltv',
      label: '小程序/小游戏当日LTV',
      source: 'metrics',
      orderField: 'attribution_micro_game_0d_ltv'
    },
    {
      key: 'attribution_micro_game_3d_ltv',
      label: '小程序/小游戏激活后三日LTV',
      source: 'metrics',
      orderField: 'attribution_micro_game_3d_ltv'
    },
    {
      key: 'attribution_micro_game_3d_roi',
      label: '小程序/小游戏激活后三日变现ROI',
      source: 'metrics',
      orderField: 'attribution_micro_game_3d_roi'
    },
    ...retentionOptionalColumns
  ]
}

function getToday(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDefaultVisibleOptionalColumns(): Record<ControlTab, string[]> {
  return {
    projects: projectColumnConfig.optional.map((column) => column.key),
    promotions: promotionColumnConfig.optional.map((column) => column.key)
  }
}

function normalizeVisibleOptionalColumns(
  tab: ControlTab,
  keys: string[] | undefined,
  defaults: Record<ControlTab, string[]>
): string[] {
  if (!Array.isArray(keys)) return defaults[tab]
  const optionalKeys = new Set(
    (tab === 'projects' ? projectColumnConfig : promotionColumnConfig).optional.map(
      (column) => column.key
    )
  )
  const normalized = keys.filter(
    (key, index) => optionalKeys.has(key) && keys.indexOf(key) === index
  )
  return normalized.length > 0 ? normalized : defaults[tab]
}

function loadVisibleOptionalColumns(): Record<ControlTab, string[]> {
  const defaults = getDefaultVisibleOptionalColumns()
  try {
    const raw = window.localStorage.getItem(COLUMN_STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<Record<ControlTab, string[]>>
    return {
      projects: normalizeVisibleOptionalColumns('projects', parsed.projects, defaults),
      promotions: normalizeVisibleOptionalColumns('promotions', parsed.promotions, defaults)
    }
  } catch {
    return defaults
  }
}

function normalizeRememberedOrgNodes(value: unknown): OrgNodeSelection[] {
  if (!Array.isArray(value)) return []
  return value
    .map((node) => ({
      id: String((node as OrgNodeSelection)?.id || '').trim(),
      name: String((node as OrgNodeSelection)?.name || (node as OrgNodeSelection)?.id || '').trim()
    }))
    .filter(
      (node, index, nodes) => node.id && nodes.findIndex((item) => item.id === node.id) === index
    )
}

function loadRememberedSelection(): RememberedSelection {
  try {
    const raw = window.localStorage.getItem(SELECTION_STORAGE_KEY)
    if (!raw) return { configId: null, ebpId: DEFAULT_EBP_ID, orgNodes: [] }
    const parsed = JSON.parse(raw) as Partial<RememberedSelection>
    return {
      configId: typeof parsed.configId === 'number' ? parsed.configId : null,
      ebpId:
        typeof parsed.ebpId === 'string' && parsed.ebpId.trim() ? parsed.ebpId : DEFAULT_EBP_ID,
      orgNodes: normalizeRememberedOrgNodes(parsed.orgNodes)
    }
  } catch {
    return { configId: null, ebpId: DEFAULT_EBP_ID, orgNodes: [] }
  }
}

function resolveColumnValue(item: Record<string, any>, column: DataControlColumn): React.ReactNode {
  const value = column.source === 'metrics' ? item.metrics?.[column.key] : item[column.key]
  if (value === null || value === undefined || value === '') return '--'
  if (Array.isArray(value)) return value.length > 0 ? value.join('、') : '--'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function getMetricValue(item: Record<string, any>, field: string): unknown {
  return item.metrics?.[field] ?? item[field]
}

function parseMetricNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const normalized = value.replace(/,/g, '').replace(/%$/, '').trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function createFilterCondition(field = 'stat_cost'): MetricFilterCondition {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    field,
    operator: DEFAULT_FILTER_OPERATOR,
    value: '',
    minValue: '',
    maxValue: ''
  }
}

function getConditionThreshold(condition: MetricFilterCondition): number | null {
  if (condition.operator === 'between') return parseMetricNumber(condition.minValue)
  return parseMetricNumber(condition.value)
}

function isValidCondition(condition: MetricFilterCondition): boolean {
  if (!condition.field) return false
  if (condition.operator !== 'between') return parseMetricNumber(condition.value) !== null
  const minValue = parseMetricNumber(condition.minValue)
  const maxValue = parseMetricNumber(condition.maxValue)
  return minValue !== null && maxValue !== null && minValue <= maxValue
}

function matchCondition(item: Record<string, any>, condition: MetricFilterCondition): boolean {
  const actual = parseMetricNumber(getMetricValue(item, condition.field))
  if (actual === null) return false

  if (condition.operator === 'between') {
    const minValue = parseMetricNumber(condition.minValue)
    const maxValue = parseMetricNumber(condition.maxValue)
    return minValue !== null && maxValue !== null && actual >= minValue && actual <= maxValue
  }

  const expected = parseMetricNumber(condition.value)
  if (expected === null) return false
  if (condition.operator === 'gt') return actual > expected
  if (condition.operator === 'lt') return actual < expected
  return actual === expected
}

function shouldStopLoadingBySortedMetric(items: any[], condition: MetricFilterCondition): boolean {
  if (condition.operator === 'lt') return false
  const threshold = getConditionThreshold(condition)
  if (threshold === null) return false
  const sortedValues = items
    .map((item) => parseMetricNumber(getMetricValue(item, condition.field)))
    .filter((value): value is number => value !== null)
  if (sortedValues.length === 0) return false
  const minSortedValue = Math.min(...sortedValues)
  return condition.operator === 'gt' ? minSortedValue <= threshold : minSortedValue < threshold
}

function filterItemsByConditions(items: any[], conditions: MetricFilterCondition[]): any[] {
  if (conditions.length === 0) return items
  if (conditions.length === 1) return items.filter((item) => matchCondition(item, conditions[0]))

  const costCondition = conditions.find((condition) => condition.field === 'stat_cost')
  if (!costCondition) return []
  const unionConditions = conditions.filter((condition) => condition.id !== costCondition.id)
  const costMatchedItems = items.filter((item) => matchCondition(item, costCondition))
  if (unionConditions.length === 0) return costMatchedItems
  return costMatchedItems.filter((item) =>
    unionConditions.some((condition) => matchCondition(item, condition))
  )
}

function getFilterBaseCondition(conditions: MetricFilterCondition[]): MetricFilterCondition | null {
  if (conditions.length === 0) return null
  if (conditions.length === 1) return conditions[0]
  return conditions.find((condition) => condition.field === 'stat_cost') || null
}

function getFilterSortField(condition: MetricFilterCondition): string {
  return condition.field
}

function dedupeItems(items: any[]): any[] {
  const seen = new Set<string>()
  return items.filter((item, index) => {
    const key = getRowKey(item, index)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getRowKey(item: Record<string, any>, index: number): string {
  return `${item.ebp_id || 'unknown'}-${item.entity_id || index}`
}

function toStatusItem(item: Record<string, any>): DataControlStatusItem | null {
  const ebpId = String(item.ebp_id || '').trim()
  const advertiserId = String(item.advertiser_id || '').trim()
  const entityId = String(item.entity_id || '').trim()
  if (!ebpId || !advertiserId || !entityId) return null
  return {
    ebp_id: ebpId,
    advertiser_id: advertiserId,
    entity_id: entityId
  }
}

export const DataControlPage: React.FC = () => {
  const rememberedSelection = useMemo(loadRememberedSelection, [])
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(
    rememberedSelection.configId
  )
  const [ebpId, setEbpId] = useState(rememberedSelection.ebpId)
  const [organizationTree, setOrganizationTree] = useState<any>(null)
  const [selectedOrgNodes, setSelectedOrgNodes] = useState<OrgNodeSelection[]>(
    rememberedSelection.orgNodes
  )
  const [loadingOrgTree, setLoadingOrgTree] = useState(false)
  const [orgTreeError, setOrgTreeError] = useState('')
  const [activeTab, setActiveTab] = useState<ControlTab>('projects')
  const [queryDate, setQueryDate] = useState(getToday())
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('all')
  const [orderField, setOrderField] = useState('')
  const [orderType, setOrderType] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [loadingList, setLoadingList] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 100,
    total: 0,
    hasMore: false
  })
  const [listError, setListError] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [visibleOptionalColumns, setVisibleOptionalColumns] = useState<
    Record<ControlTab, string[]>
  >(loadVisibleOptionalColumns)
  const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null)
  const [optionalColumnSearch, setOptionalColumnSearch] = useState('')
  const [filterConditions, setFilterConditions] = useState<MetricFilterCondition[]>([])
  const [filterLoadingState, setFilterLoadingState] = useState<FilterLoadingState | null>(null)

  const columnConfig = activeTab === 'projects' ? projectColumnConfig : promotionColumnConfig
  const optionalColumnMap = useMemo(
    () => new Map(columnConfig.optional.map((column) => [column.key, column])),
    [columnConfig]
  )
  const filteredOptionalColumns = useMemo(() => {
    const searchText = optionalColumnSearch.trim().toLowerCase()
    if (!searchText) return columnConfig.optional
    return columnConfig.optional.filter(
      (column) =>
        column.label.toLowerCase().includes(searchText) ||
        column.key.toLowerCase().includes(searchText)
    )
  }, [columnConfig.optional, optionalColumnSearch])
  const selectedOptionalColumns = useMemo(
    () =>
      visibleOptionalColumns[activeTab]
        .map((key) => optionalColumnMap.get(key))
        .filter(Boolean) as DataControlColumn[],
    [activeTab, optionalColumnMap, visibleOptionalColumns]
  )
  const columns = useMemo(
    () => [...columnConfig.fixed, ...selectedOptionalColumns],
    [columnConfig.fixed, selectedOptionalColumns]
  )
  const filterableColumns = useMemo(
    () =>
      [...columnConfig.fixed, ...columnConfig.optional].filter(
        (column) => column.source === 'metrics' && column.orderField
      ),
    [columnConfig.fixed, columnConfig.optional]
  )
  const validFilterConditions = useMemo(
    () => filterConditions.filter(isValidCondition),
    [filterConditions]
  )
  const hasFilterConditions = validFilterConditions.length > 0
  const selectedItems = useMemo(() => {
    const selectedKeySet = new Set(selectedRowKeys)
    return items.filter((item, index) => selectedKeySet.has(getRowKey(item, index)))
  }, [items, selectedRowKeys])
  const selectableRowKeys = useMemo(
    () => items.map((item, index) => getRowKey(item, index)),
    [items]
  )
  const isAllCurrentPageSelected =
    selectableRowKeys.length > 0 && selectableRowKeys.every((key) => selectedRowKeys.includes(key))
  const selectedCount = selectedRowKeys.length

  const selectedConfig = useMemo(
    () => configs.find((config) => config.id === selectedConfigId),
    [configs, selectedConfigId]
  )

  useEffect(() => {
    loadConfigs()
  }, [])

  useEffect(() => {
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleOptionalColumns))
  }, [visibleOptionalColumns])

  useEffect(() => {
    window.localStorage.setItem(
      SELECTION_STORAGE_KEY,
      JSON.stringify({ configId: selectedConfigId, ebpId, orgNodes: selectedOrgNodes })
    )
  }, [ebpId, selectedConfigId, selectedOrgNodes])

  useEffect(() => {
    setItems([])
    setSelectedRowKeys([])
    setPagination((prev) => ({ ...prev, page: 1, total: 0, hasMore: false }))
  }, [activeTab, selectedConfigId, selectedOrgNodes, queryDate])

  const loadConfigs = async (): Promise<void> => {
    try {
      const availableConfigs = await configService.getConfigsBySource(1)
      setConfigs(availableConfigs)
      if (availableConfigs.length > 0) {
        const rememberedConfigExists = availableConfigs.some(
          (config) => config.id === rememberedSelection.configId
        )
        setSelectedConfigId(
          rememberedConfigExists ? rememberedSelection.configId : availableConfigs[0].id
        )
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
    }
  }

  const loadOrganizationTree = async (): Promise<void> => {
    if (!selectedConfigId) {
      setOrgTreeError('请先选择Cookie账户')
      return
    }
    if (!ebpId.trim()) {
      setOrgTreeError('请先输入EBP ID')
      return
    }

    setLoadingOrgTree(true)
    setOrgTreeError('')
    try {
      const result = await dataAssistantV2Service.getOrganizationTree(
        selectedConfigId,
        ebpId.trim()
      )
      if (result.code === 0 && result.data) {
        setOrganizationTree(result.data)
      } else {
        setOrganizationTree(null)
        setOrgTreeError(result.msg || result.error || '获取组织树失败')
      }
    } catch (err: any) {
      setOrganizationTree(null)
      setOrgTreeError(err?.response?.data?.detail || err?.message || '获取组织树失败')
    } finally {
      setLoadingOrgTree(false)
    }
  }

  useEffect(() => {
    if (!selectedConfigId || !ebpId.trim()) return
    setOrganizationTree(null)
    void loadOrganizationTree()
  }, [selectedConfigId])

  const toggleOrgNodeSelection = (node: OrgNodeSelection): void => {
    setSelectedOrgNodes((prev) => {
      const exists = prev.some((item) => item.id === node.id)
      return exists ? prev.filter((item) => item.id !== node.id) : [...prev, node]
    })
  }

  const renderOrgTreeNode = (node: any, level = 0): React.ReactNode => {
    const nodeId = String(node.id || node.ebp_id || '')
    const nodeName = String(node.name || node.ebp_name || node.group_name || nodeId)
    const isSelected = selectedOrgNodes.some((item) => item.id === nodeId)
    const children = Array.isArray(node.children) ? node.children : []

    return (
      <div key={nodeId || `${nodeName}-${level}`} className="select-none">
        <button
          type="button"
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent ${
            isSelected ? 'bg-primary/10 text-primary' : ''
          }`}
          style={{ paddingLeft: `${level * 18 + 8}px` }}
          onClick={() => nodeId && toggleOrgNodeSelection({ id: nodeId, name: nodeName })}
        >
          <span
            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 ${
              isSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-muted-foreground/30'
            }`}
          >
            {isSelected && <Check className="h-3 w-3" />}
          </span>
          <span className="flex-1 truncate text-sm">{nodeName}</span>
          <span className="text-xs text-muted-foreground">{nodeId}</span>
        </button>
        {children.length > 0 && (
          <div>{children.map((child: any) => renderOrgTreeNode(child, level + 1))}</div>
        )}
      </div>
    )
  }

  const toggleOptionalColumn = (tab: ControlTab, columnKey: string): void => {
    setVisibleOptionalColumns((prev) => {
      const currentKeys = prev[tab]
      const nextKeys = currentKeys.includes(columnKey)
        ? currentKeys.filter((key) => key !== columnKey)
        : [...currentKeys, columnKey]
      return { ...prev, [tab]: nextKeys }
    })
  }

  const moveOptionalColumn = (tab: ControlTab, fromIndex: number, toIndex: number): void => {
    setVisibleOptionalColumns((prev) => {
      const currentKeys = [...prev[tab]]
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= currentKeys.length ||
        toIndex >= currentKeys.length
      ) {
        return prev
      }
      const [movedKey] = currentKeys.splice(fromIndex, 1)
      currentKeys.splice(toIndex, 0, movedKey)
      return { ...prev, [tab]: currentKeys }
    })
  }

  const handleOptionalColumnDrop = (tab: ControlTab, targetKey: string): void => {
    if (!draggingColumnKey || draggingColumnKey === targetKey) return
    const currentKeys = visibleOptionalColumns[tab]
    moveOptionalColumn(tab, currentKeys.indexOf(draggingColumnKey), currentKeys.indexOf(targetKey))
    setDraggingColumnKey(null)
  }

  const removeOptionalColumn = (tab: ControlTab, columnKey: string): void => {
    setVisibleOptionalColumns((prev) => ({
      ...prev,
      [tab]: prev[tab].filter((key) => key !== columnKey)
    }))
  }

  const resetOptionalColumns = (tab: ControlTab): void => {
    const defaults = getDefaultVisibleOptionalColumns()
    setVisibleOptionalColumns((prev) => ({ ...prev, [tab]: defaults[tab] }))
  }

  const addFilterCondition = (): void => {
    setFilterConditions((prev) => [
      ...prev,
      createFilterCondition(filterableColumns[0]?.key || 'stat_cost')
    ])
  }

  const updateFilterCondition = (
    id: string,
    patch: Partial<Omit<MetricFilterCondition, 'id'>>
  ): void => {
    setFilterConditions((prev) =>
      prev.map((condition) => (condition.id === id ? { ...condition, ...patch } : condition))
    )
  }

  const removeFilterCondition = (id: string): void => {
    setFilterConditions((prev) => prev.filter((condition) => condition.id !== id))
  }

  const clearFilterConditions = (): void => {
    setFilterConditions([])
    setFilterLoadingState(null)
  }

  const fetchDataControlList = async (
    requestData: DataControlListRequest
  ): Promise<DataControlListResponse> => {
    return activeTab === 'projects'
      ? await dataControlService.getProjectList(requestData)
      : await dataControlService.getPromotionList(requestData)
  }

  const buildListRequest = (
    page: number,
    currentOrderField: string,
    currentOrderType: number,
    extraCustomFields: string[] = []
  ): DataControlListRequest => ({
    config_id: selectedConfigId as number,
    ebp_ids: selectedOrgNodes.map((node) => node.id),
    query_date: queryDate,
    page,
    limit: pageSize,
    order_field: currentOrderField.trim() || undefined,
    order_type: currentOrderType,
    keyword: keyword.trim() || undefined,
    status: status === 'all' ? undefined : status,
    custom_fields: Array.from(
      new Set([
        ...columns.filter((column) => column.source === 'metrics').map((column) => column.key),
        ...extraCustomFields
      ])
    )
  })

  const fetchFilteredList = async (
    conditions: MetricFilterCondition[]
  ): Promise<FilterFetchResult> => {
    const baseCondition = getFilterBaseCondition(conditions)
    if (!baseCondition) return { items: [], scanned: 0, reachedLimit: false }

    const matchedItems: any[] = []
    let scanned = 0
    let reachedLimit = false
    const filterFields = conditions.map((condition) => condition.field)
    const sortField = getFilterSortField(baseCondition)

    for (let page = 1; page <= MAX_FILTER_LOAD_PAGES; page += 1) {
      setFilterLoadingState({ page, matched: matchedItems.length, scanned })
      const requestData = buildListRequest(page, sortField, 1, filterFields)
      const response = await fetchDataControlList(requestData)

      if (response.code !== 0 || !response.data) {
        throw new Error(response.msg || response.error || '查询失败')
      }

      const pageItems = response.data.items || []
      scanned += pageItems.length
      matchedItems.push(...filterItemsByConditions(pageItems, conditions))
      const dedupedMatched = dedupeItems(matchedItems)
      matchedItems.splice(0, matchedItems.length, ...dedupedMatched)
      setFilterLoadingState({ page, matched: matchedItems.length, scanned })

      if (pageItems.length === 0 || shouldStopLoadingBySortedMetric(pageItems, baseCondition)) break
      if (!response.data.has_more) break
      reachedLimit = page === MAX_FILTER_LOAD_PAGES
    }

    return { items: matchedItems, scanned, reachedLimit }
  }

  const fetchList = async (
    page = 1,
    sortOptions?: { orderField: string; orderType: number }
  ): Promise<void> => {
    if (!selectedConfigId) {
      setListError('请先选择Cookie账户')
      return
    }
    if (selectedOrgNodes.length === 0) {
      setListError('请至少选择一个组织节点')
      return
    }

    const activeFilters = validFilterConditions
    if (
      activeFilters.length > 1 &&
      !activeFilters.some((condition) => condition.field === 'stat_cost')
    ) {
      setListError('多条件筛选必须添加消耗条件')
      return
    }

    setLoadingList(true)
    setFilterLoadingState(null)
    setListError('')
    try {
      if (activeFilters.length > 0) {
        const result = await fetchFilteredList(activeFilters)
        setItems(result.items)
        setSelectedRowKeys([])
        setPagination({
          page: 1,
          limit: pageSize,
          total: result.items.length,
          hasMore: false
        })
        if (result.reachedLimit) {
          setListError(`已达到筛选加载上限 ${MAX_FILTER_LOAD_PAGES} 页，请缩窄消耗条件后重试`)
        } else {
          setListError(`筛选完成：扫描 ${result.scanned} 条，命中 ${result.items.length} 条`)
        }
        return
      }

      const currentOrderField = sortOptions?.orderField ?? orderField
      const currentOrderType = sortOptions?.orderType ?? orderType
      const requestData = buildListRequest(page, currentOrderField, currentOrderType)
      const response = await fetchDataControlList(requestData)

      if (response.code === 0 && response.data) {
        setItems(response.data.items || [])
        setSelectedRowKeys([])
        setPagination({
          page: response.data.page || page,
          limit: response.data.limit || pageSize,
          total: response.data.total || 0,
          hasMore: Boolean(response.data.has_more)
        })
      } else {
        setListError(response.msg || response.error || '查询失败')
      }
    } catch (err: any) {
      setListError(err?.response?.data?.detail || err?.message || '查询失败')
    } finally {
      setLoadingList(false)
      setFilterLoadingState(null)
    }
  }

  const toggleCurrentPageSelection = (): void => {
    setSelectedRowKeys((prev) => {
      if (isAllCurrentPageSelected) {
        const currentPageKeySet = new Set(selectableRowKeys)
        return prev.filter((key) => !currentPageKeySet.has(key))
      }
      return Array.from(new Set([...prev, ...selectableRowKeys]))
    })
  }

  const toggleRowSelection = (rowKey: string): void => {
    setSelectedRowKeys((prev) =>
      prev.includes(rowKey) ? prev.filter((key) => key !== rowKey) : [...prev, rowKey]
    )
  }

  const handleBatchStatusUpdate = async (isPause: boolean): Promise<void> => {
    if (!selectedConfigId) {
      setListError('请先选择Cookie账户')
      return
    }
    const actionText = isPause ? '关闭' : '开启'
    const statusItems = selectedItems.map(toStatusItem).filter(Boolean) as DataControlStatusItem[]
    if (statusItems.length === 0) {
      setListError('请先勾选可执行的数据')
      return
    }
    if (statusItems.length !== selectedItems.length) {
      setListError('部分勾选项缺少广告主ID或对象ID，无法执行批量操作')
      return
    }
    const targetText = activeTab === 'projects' ? '项目' : '单元'
    const confirmed = window.confirm(
      `确认批量${actionText}已勾选的 ${statusItems.length} 个${targetText}吗？`
    )
    if (!confirmed) return

    setUpdatingStatus(true)
    setListError('')
    try {
      const requestData = {
        config_id: selectedConfigId,
        items: statusItems,
        is_pause: isPause
      }
      const response =
        activeTab === 'projects'
          ? await dataControlService.updateProjectStatus(requestData)
          : await dataControlService.updatePromotionStatus(requestData)

      if (response.code === 0 && !response.data?.has_failed) {
        await fetchList(pagination.page)
        setListError(`批量${actionText}成功`)
      } else {
        setListError(response.msg || response.error || `批量${actionText}存在失败项`)
      }
    } catch (err: any) {
      setListError(err?.response?.data?.detail || err?.message || `批量${actionText}失败`)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleColumnSort = (column: DataControlColumn): void => {
    const nextOrderField = column.orderField || column.key
    const nextOrderType = orderField === nextOrderField && orderType === 1 ? 0 : 1
    setOrderField(nextOrderField)
    setOrderType(nextOrderType)
    fetchList(1, { orderField: nextOrderField, orderType: nextOrderType })
  }

  const renderSortIcon = (column: DataControlColumn): React.ReactNode => {
    const currentOrderField = column.orderField || column.key
    if (orderField !== currentOrderField) {
      return <ArrowDown className="h-3.5 w-3.5 opacity-30" />
    }
    return orderType === 1 ? (
      <ArrowDown className="h-3.5 w-3.5 text-primary" />
    ) : (
      <ArrowUp className="h-3.5 w-3.5 text-primary" />
    )
  }

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.58)]"
      >
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_58%)]" />
        <div className="relative flex flex-col gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            Data Control
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">巨量数据调控</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              选择 Cookie
              账户和组织节点后，按项目或单元维度拉取数据，为后续预算、ROI、启停等调控动作提供基础数据。
            </p>
          </div>
        </div>
      </motion.section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-primary" />
            数据范围
          </CardTitle>
          <CardDescription>
            选择 Cookie 账户、根 EBP 和组织节点，已选内容会自动记住。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1.1fr)_minmax(180px,0.9fr)_auto]">
            <div className="space-y-1.5">
              <Label>Cookie 账户</Label>
              <select
                value={selectedConfigId ?? ''}
                onChange={(event) => setSelectedConfigId(Number(event.target.value) || null)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {configs.length === 0 ? (
                  <option value="">暂无可用账户配置</option>
                ) : (
                  configs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.cookie_name}
                      {config.realname ? ` / ${config.realname}` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>根 EBP ID</Label>
              <Input
                value={ebpId}
                onChange={(event) => setEbpId(event.target.value.trim())}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') loadOrganizationTree()
                }}
                placeholder="请输入根 EBP ID"
              />
            </div>
            <div className="flex items-end">
              <Button
                size="icon"
                className="w-full lg:w-10"
                onClick={loadOrganizationTree}
                disabled={loadingOrgTree || !selectedConfigId}
                title="刷新组织树"
                aria-label="刷新组织树"
              >
                {loadingOrgTree ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span>当前：</span>
            <span className="font-medium text-foreground">
              {selectedConfig?.cookie_name || '未选择账户'}
            </span>
            <span className="text-muted-foreground/60">/</span>
            <span>
              {selectedOrgNodes.length > 0
                ? `已选 ${selectedOrgNodes.length} 个组织节点`
                : '未选择组织节点'}
            </span>
            {selectedOrgNodes.map((node) => (
              <span
                key={node.id}
                className="inline-flex max-w-[180px] items-center gap-1.5 rounded-full bg-primary/10 px-2 py-1 font-medium text-primary"
              >
                <span className="truncate">{node.name}</span>
                <button
                  type="button"
                  className="rounded-full hover:bg-primary/15"
                  aria-label={`移除 ${node.name}`}
                  onClick={() => toggleOrgNodeSelection(node)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          {orgTreeError && <div className="text-sm text-destructive">{orgTreeError}</div>}
          {organizationTree && (
            <div className="max-h-[260px] overflow-y-auto rounded-xl border p-2">
              {Array.isArray(organizationTree.children) && organizationTree.children.length > 0 ? (
                organizationTree.children.map((child: any) => renderOrgTreeNode(child))
              ) : (
                <div className="p-2 text-sm text-muted-foreground">暂无组织数据</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>查询条件</CardTitle>
          <CardDescription>项目调控和单元调控共用筛选条件。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                日期
              </Label>
              <Input
                type="date"
                value={queryDate}
                onChange={(event) => setQueryDate(event.target.value)}
              />
            </div>
            <div className="space-y-2 xl:col-span-2">
              <Label className="flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                关键字
              </Label>
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="名称关键字"
              />
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">全部</option>
                <option value="0">启用/投放中</option>
                <option value="1">暂停</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>排序字段</Label>
              <Input
                value={orderField}
                onChange={(event) => setOrderField(event.target.value)}
                placeholder="默认字段"
              />
            </div>
            <div className="space-y-2">
              <Label>每页</Label>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>
          <div className="mt-5 rounded-xl border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">多条件筛选</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  单条件按该指标降序加载；多条件必须包含消耗，后续条件按并集筛选。
                </div>
              </div>
              <div className="flex items-center gap-2">
                {filterConditions.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilterConditions}>
                    清空条件
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={addFilterCondition}>
                  添加条件
                </Button>
              </div>
            </div>
            {filterConditions.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed bg-background/60 px-3 py-3 text-xs text-muted-foreground">
                未设置数值筛选条件，查询时将沿用普通分页列表。
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {filterConditions.map((condition, index) => {
                  const isCostCondition = condition.field === 'stat_cost'
                  const isInvalid = !isValidCondition(condition)
                  return (
                    <div
                      key={condition.id}
                      className="grid grid-cols-1 gap-2 rounded-lg border bg-background/80 p-2 md:grid-cols-[minmax(180px,1.4fr)_110px_minmax(120px,1fr)_minmax(120px,1fr)_auto]"
                    >
                      <div className="space-y-1">
                        <Label className="text-xs">指标</Label>
                        <select
                          value={condition.field}
                          onChange={(event) =>
                            updateFilterCondition(condition.id, { field: event.target.value })
                          }
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {filterableColumns.map((column) => (
                            <option key={column.key} value={column.key}>
                              {column.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">条件</Label>
                        <select
                          value={condition.operator}
                          onChange={(event) =>
                            updateFilterCondition(condition.id, {
                              operator: event.target.value as FilterOperator
                            })
                          }
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {Object.entries(FILTER_OPERATOR_LABELS).map(([value, label]) => (
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
                              onChange={(event) =>
                                updateFilterCondition(condition.id, {
                                  minValue: event.target.value
                                })
                              }
                              className="h-9"
                              placeholder="含边界"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">最大值</Label>
                            <Input
                              type="number"
                              value={condition.maxValue}
                              onChange={(event) =>
                                updateFilterCondition(condition.id, {
                                  maxValue: event.target.value
                                })
                              }
                              className="h-9"
                              placeholder="含边界"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1 md:col-span-2">
                          <Label className="text-xs">数值</Label>
                          <Input
                            type="number"
                            value={condition.value}
                            onChange={(event) =>
                              updateFilterCondition(condition.id, { value: event.target.value })
                            }
                            className="h-9"
                            placeholder="请输入筛选值"
                          />
                        </div>
                      )}
                      <div className="flex items-end gap-2">
                        <div className="flex min-w-[86px] flex-col gap-1 pb-1 text-xs text-muted-foreground">
                          <span>条件 {index + 1}</span>
                          {isCostCondition && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                              消耗基准
                            </span>
                          )}
                          {isInvalid && <span className="text-destructive">未生效</span>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFilterCondition(condition.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => fetchList(1)} disabled={loadingList}>
              {loadingList ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              查询数据
            </Button>
            <Button
              variant="outline"
              onClick={() => setOrderType((value) => (value === 1 ? 0 : 1))}
            >
              排序：{orderType === 1 ? '降序' : '升序'}
            </Button>
            {listError && <span className="text-sm text-destructive">{listError}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            数据列表
          </CardTitle>
          <CardDescription>
            当前共 {pagination.total} 条，已加载 {items.length} 条。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ControlTab)}>
            <TabsList>
              <TabsTrigger value="projects">项目调控</TabsTrigger>
              <TabsTrigger value="promotions">单元调控</TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab} className="mt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3">
                <div className="text-sm text-muted-foreground">
                  固定列始终显示，可选列已显示 {visibleOptionalColumns[activeTab].length} /{' '}
                  {columnConfig.optional.length} 列，已勾选 {selectedCount} 条
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selectedCount === 0 || updatingStatus || loadingList}
                    onClick={() => handleBatchStatusUpdate(false)}
                  >
                    {updatingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    批量开启
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selectedCount === 0 || updatingStatus || loadingList}
                    onClick={() => handleBatchStatusUpdate(true)}
                  >
                    {updatingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Pause className="h-4 w-4" />
                    )}
                    批量关闭
                  </Button>
                  {selectedCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedRowKeys([])}>
                      清空勾选
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Columns className="h-4 w-4" />
                        自定义列
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[760px] max-w-[90vw] p-3">
                      <div className="grid max-h-[460px] grid-cols-1 gap-3 md:grid-cols-[180px_minmax(240px,1fr)_minmax(260px,1fr)]">
                        <div className="min-h-0 rounded-lg border bg-muted/20 p-2">
                          <DropdownMenuLabel className="px-1">固定列</DropdownMenuLabel>
                          <div className="mt-1 space-y-1 overflow-y-auto pr-1">
                            {columnConfig.fixed.map((column) => (
                              <div
                                key={column.key}
                                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm"
                              >
                                <span className="truncate" title={column.label}>
                                  {column.label}
                                </span>
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                  固定
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="min-h-0 rounded-lg border bg-muted/20 p-2">
                          <DropdownMenuLabel className="px-1">可选列</DropdownMenuLabel>
                          <div className="relative mt-1">
                            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={optionalColumnSearch}
                              onChange={(event) => setOptionalColumnSearch(event.target.value)}
                              onKeyDown={(event) => event.stopPropagation()}
                              placeholder="搜索列名"
                              className="h-8 pl-7 text-xs"
                            />
                          </div>
                          <div className="mt-2 max-h-[360px] overflow-y-auto pr-1">
                            {filteredOptionalColumns.length === 0 ? (
                              <div className="rounded-md border border-dashed bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                                未找到匹配列
                              </div>
                            ) : (
                              filteredOptionalColumns.map((column) => (
                                <DropdownMenuCheckboxItem
                                  key={column.key}
                                  checked={visibleOptionalColumns[activeTab].includes(column.key)}
                                  onCheckedChange={() =>
                                    toggleOptionalColumn(activeTab, column.key)
                                  }
                                  onSelect={(event) => event.preventDefault()}
                                >
                                  <span className="whitespace-normal leading-5">
                                    {column.label}
                                  </span>
                                </DropdownMenuCheckboxItem>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="min-h-0 rounded-lg border border-primary/20 bg-primary/5 p-2">
                          <DropdownMenuLabel className="px-1">
                            已选列预览（拖拽排序）
                          </DropdownMenuLabel>
                          <div className="mt-1 max-h-[400px] space-y-1 overflow-y-auto pr-1">
                            {selectedOptionalColumns.length === 0 ? (
                              <div className="rounded-md border border-dashed bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                                暂未选择可选列
                              </div>
                            ) : (
                              selectedOptionalColumns.map((column, index) => (
                                <div
                                  key={column.key}
                                  draggable
                                  onDragStart={() => setDraggingColumnKey(column.key)}
                                  onDragEnd={() => setDraggingColumnKey(null)}
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={() => handleOptionalColumnDrop(activeTab, column.key)}
                                  className={`flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs transition-colors ${
                                    draggingColumnKey === column.key
                                      ? 'border-primary/60 bg-primary/10'
                                      : ''
                                  }`}
                                >
                                  <GripVertical className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                                  <span className="flex-1 truncate" title={column.label}>
                                    {index + 1}. {column.label}
                                  </span>
                                  <button
                                    type="button"
                                    title="上移"
                                    className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                                    disabled={index === 0}
                                    onClick={() => moveOptionalColumn(activeTab, index, index - 1)}
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    title="下移"
                                    className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                                    disabled={index === selectedOptionalColumns.length - 1}
                                    onClick={() => moveOptionalColumn(activeTab, index, index + 1)}
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    title="移除该列"
                                    className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => removeOptionalColumn(activeTab, column.key)}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                      <DropdownMenuSeparator className="my-3" />
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                        onClick={() => resetOptionalColumns(activeTab)}
                      >
                        <RotateCcw className="h-4 w-4" />
                        恢复默认全部显示
                      </button>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="rounded-xl border">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1260px] text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="sticky top-0 z-20 w-12 bg-muted/95 px-3 py-3 text-left font-medium shadow-sm backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                          <input
                            type="checkbox"
                            checked={isAllCurrentPageSelected}
                            onChange={toggleCurrentPageSelection}
                            disabled={items.length === 0 || loadingList}
                            aria-label="勾选当前页全部数据"
                            className="h-4 w-4 rounded border-input"
                          />
                        </th>
                        {columns.map((column) => (
                          <th
                            key={column.key}
                            className="sticky top-0 z-20 bg-muted/95 px-3 py-3 text-left font-medium shadow-sm backdrop-blur supports-[backdrop-filter]:bg-muted/80"
                          >
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-background/70 hover:text-foreground"
                              onClick={() => handleColumnSort(column)}
                              disabled={loadingList}
                              title={`按${column.label}排序`}
                            >
                              <span>{column.label}</span>
                              {renderSortIcon(column)}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loadingList ? (
                        <tr>
                          <td
                            colSpan={columns.length + 1}
                            className="px-3 py-10 text-center text-muted-foreground"
                          >
                            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                            {filterLoadingState
                              ? `正在筛选数据：第 ${filterLoadingState.page} 页，已扫描 ${filterLoadingState.scanned} 条，命中 ${filterLoadingState.matched} 条`
                              : '正在加载数据...'}
                          </td>
                        </tr>
                      ) : items.length === 0 ? (
                        <tr>
                          <td
                            colSpan={columns.length + 1}
                            className="px-3 py-10 text-center text-muted-foreground"
                          >
                            暂无数据，请选择组织后查询。
                          </td>
                        </tr>
                      ) : (
                        items.map((item, index) => {
                          const rowKey = getRowKey(item, index)
                          const isSelected = selectedRowKeys.includes(rowKey)
                          return (
                            <tr
                              key={rowKey}
                              className={`border-t hover:bg-muted/30 ${isSelected ? 'bg-primary/5' : ''}`}
                            >
                              <td className="px-3 py-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleRowSelection(rowKey)}
                                  aria-label="勾选当前数据"
                                  className="h-4 w-4 rounded border-input"
                                />
                              </td>
                              {columns.map((column) => (
                                <td key={column.key} className="max-w-[260px] truncate px-3 py-3">
                                  {resolveColumnValue(item, column)}
                                </td>
                              ))}
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  第 {pagination.page} 页，每页 {pagination.limit} 条
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingList || pagination.page <= 1 || hasFilterConditions}
                    onClick={() => fetchList(Math.max(1, pagination.page - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingList || !pagination.hasMore || hasFilterConditions}
                    onClick={() => fetchList(pagination.page + 1)}
                  >
                    下一页
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
