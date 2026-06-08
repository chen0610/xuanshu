import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Plus,
  Loader2,
  Trash2,
  Edit2,
  Edit,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Filter,
  FileText,
  AlertCircle,
  Search,
  X,
  RefreshCw,
  User,
  Settings,
  Users,
  Tag,
  Image
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Checkbox,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '../../components/ui'
import {
  scheduledTaskService,
  dataAssistantService,
  TagInfo,
  TagGroup
} from '../../services/ocean-engine.service'
import { configService } from '../../services/config.service'
import { oceanEngineOAuthService } from '../../services/ocean-engine-oauth.service'
import type { OceanEngineOAuthToken } from '../../types/ocean-engine-oauth.types'
import { useAuthStore } from '../../stores/auth.store'

interface ScheduledTask {
  id: number
  name: string
  task_type: string
  config_id: number
  cron_expression: string
  task_config: Record<string, any> | null
  is_active: boolean
  last_run_at: string | null
  next_run_at: string | null
  run_count: number
  status: string
  created_at: string
  updated_at: string
}

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

interface FilterCondition {
  operator: 'gte' | 'lte'
  value: string
}

interface AdControlFilters {
  stat_cost: FilterCondition
  convert_cnt: FilterCondition
  conversion_cost: FilterCondition
  active_cost: FilterCondition
}

const DEFAULT_FILTERS: AdControlFilters = {
  stat_cost: { operator: 'lte', value: '' },
  convert_cnt: { operator: 'lte', value: '' },
  conversion_cost: { operator: 'lte', value: '' },
  active_cost: { operator: 'lte', value: '' }
}

interface ExecutionLog {
  id: number
  task_id: number
  execution_status: 'success' | 'failed' | 'partial' | 'running'
  start_time: string
  end_time: string | null
  duration_seconds: number | null
  total_targets: number
  total_ads_found: number
  total_ads_processed: number
  total_success: number
  total_failed: number
  error_message: string | null
  created_at: string
  details?: ExecutionDetail[]
  ad_details?: AdDetail[]
}

interface ExecutionDetail {
  id: number
  config_id: number
  config_name: string | null
  ads_found: number
  ads_processed: number
  success_count: number
  failed_count: number
  success_ad_ids?: string[]
  failed_ad_ids?: string[]
  error_message: string | null
}

interface AdDetail {
  id: number
  promotion_id: string
  advertiser_id: string
  promotion_name: string | null
  execution_status: 'success' | 'failed'
  error_message: string | null
}

/** 合并表单：去掉任务名称中的「· 预检」「· 创建」后缀 */
function stripBitableTaskNameSuffix(name: string): string {
  return name
    .replace(/\s*·\s*预检\s*$/u, '')
    .replace(/\s*·\s*创建\s*$/u, '')
    .trim()
}

/** 同一多维表格的另一条 Bitable 定时任务（预检 ↔ 创建） */
/** 从浏览器地址栏多维表格 URL 解析 app_token、table_id（与 BitableImportPanel 一致） */
function parseBitableUrl(url: string): { appToken: string; tableId: string } | null {
  try {
    const parsed = new URL(url.trim())
    const match = parsed.pathname.match(/\/base\/([A-Za-z0-9]+)/)
    if (!match) return null
    const appToken = match[1]
    const tableId = parsed.searchParams.get('table') ?? ''
    if (!tableId) return null
    return { appToken, tableId }
  } catch {
    return null
  }
}

function buildBitableTableUrl(appToken: string, tableId: string): string {
  return `https://www.feishu.cn/base/${appToken}?table=${tableId}`
}

const BITABLE_DEFAULT_MATERIALS_PER_UNIT = 10

/** 每 N 分钟执行一次 → Cron */
function minutesToCronEveryNMinutes(n: number): string {
  if (!Number.isFinite(n) || n < 1 || n > 59) {
    throw new Error('间隔分钟数需在 1～59 之间')
  }
  return `*/${Math.floor(n)} * * * *`
}

/** 将「每 N 分钟」类 Cron（如 star-slash-N 空格）解析为分钟数字符串 */
function parseCronToMinuteInterval(cron: string): string {
  const m = String(cron)
    .trim()
    .match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/)
  if (!m) return ''
  return m[1]
}

function findBitableSiblingTask(
  current: ScheduledTask,
  allTasks: ScheduledTask[]
): ScheduledTask | undefined {
  const tc = current.task_config as Record<string, unknown> | null
  if (!tc?.app_token || !tc?.table_id) return undefined
  const at = String(tc.app_token)
  const tid = String(tc.table_id)
  return allTasks.find((t) => {
    if (t.id === current.id) return false
    if (t.task_type !== 'bitable_preview' && t.task_type !== 'bitable_create_ads') return false
    const t2 = t.task_config as Record<string, unknown> | null
    if (!t2?.app_token || !t2?.table_id) return false
    return String(t2.app_token) === at && String(t2.table_id) === tid
  })
}

export const ScheduledTasksPage: React.FC = () => {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [latestLogs, setLatestLogs] = useState<Record<number, ExecutionLog>>({}) // taskId -> latest log

  // 日志查看相关状态
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false)
  const [viewingTaskId, setViewingTaskId] = useState<number | null>(null)
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsPage, setLogsPage] = useState(1)
  const [logsTotal, setLogsTotal] = useState(0)
  const logsPageSize = 20

  // Form State
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [taskName, setTaskName] = useState('')
  const [taskType, setTaskType] = useState('auto_ad_control')
  const [cronExpression, setCronExpression] = useState('')
  const [error, setError] = useState('')

  const [selectedConfigIds, setSelectedConfigIds] = useState<number[]>([]) // Still useful for quick checks
  const [targetSettings, setTargetSettings] = useState<Record<number, string[]>>({}) // configId -> tagValues[]
  const [cachedTags, setCachedTags] = useState<Record<number, TagInfo[]>>({})
  const [loadingTagsFor, setLoadingTagsFor] = useState<number | null>(null)

  const [conditions, setConditions] = useState<
    Array<{ metric: string; operator: string; value: string; value2?: string }>
  >([])
  const [actionType, setActionType] = useState<'enable' | 'disable'>('disable')
  const [checkInterval, setCheckInterval] = useState('5')

  // 禁止执行的时间段配置
  const [blockedTimeRanges, setBlockedTimeRanges] = useState<
    Array<{ start_hour: number; end_hour: number }>
  >([])

  // 数据助手报表（升级版）任务相关状态
  const [dataAssistantConfigId, setDataAssistantConfigId] = useState<number | null>(null)
  const [reportType, setReportType] = useState<'时报' | '日报'>('时报')
  const [scheduleHour, setScheduleHour] = useState<number>(0) // 小时（0-23）
  const [scheduleMinute, setScheduleMinute] = useState<number>(5) // 分钟（0-59）
  const [useKeywordGrouping, setUseKeywordGrouping] = useState(true)
  const [keywordText, setKeywordText] = useState('纯激励\n纯短剧')
  const [chatId, setChatId] = useState<string>('oc_7fc46dcc7187bc1ed2f95c1544e32b10')
  const [sendAsImage, setSendAsImage] = useState<boolean>(false)

  // 数据助手报表（部门版）任务相关状态
  const [deptConfigIds, setDeptConfigIds] = useState<number[]>([])
  const [deptActiveConfigId, setDeptActiveConfigId] = useState<number | null>(null)
  const [deptReportType, setDeptReportType] = useState<'时报' | '日报'>('时报')
  const [deptScheduleHour, setDeptScheduleHour] = useState<number>(0)
  const [deptScheduleMinute, setDeptScheduleMinute] = useState<number>(5)
  const [deptTagGroupsMap, setDeptTagGroupsMap] = useState<Record<number, TagGroup[]>>({})
  const [deptChatId, setDeptChatId] = useState<string>('oc_7fc46dcc7187bc1ed2f95c1544e32b10')
  const [deptSendAsImage, setDeptSendAsImage] = useState<boolean>(false)

  // 飞书 Bitable 定时任务（预检 / 创建广告拆分）
  const [bitableConfigId, setBitableConfigId] = useState<number | null>(null)
  /** 多维表格浏览器链接，提交时解析 app_token / table_id */
  const [bitableTableUrl, setBitableTableUrl] = useState('')
  /** 授权纵横组织 ID（单选） */
  const [bitableSelectedOrgId, setBitableSelectedOrgId] = useState<string | null>(null)
  const [oceanTokens, setOceanTokens] = useState<OceanEngineOAuthToken[]>([])
  const [loadingOceanTokens, setLoadingOceanTokens] = useState(false)
  const [bitableNotifyOpenId, setBitableNotifyOpenId] = useState('')
  const [bitableAppUrl, setBitableAppUrl] = useState('')
  /** 预检 / 创建：每 N 分钟（1–59），空表示不创建该侧定时任务 */
  const [bitablePreviewIntervalMinutes, setBitablePreviewIntervalMinutes] = useState('')
  const [bitableCreateIntervalMinutes, setBitableCreateIntervalMinutes] = useState('')
  const [bitableEditPreviewTaskId, setBitableEditPreviewTaskId] = useState<number | null>(null)
  const [bitableEditCreateTaskId, setBitableEditCreateTaskId] = useState<number | null>(null)

  // 快速组合标签的三个选择组（部门版）
  const [deptQuickTagSelector1, setDeptQuickTagSelector1] = useState<Record<number, TagInfo[]>>({}) // 投手
  const [deptQuickTagSelector2, setDeptQuickTagSelector2] = useState<Record<number, TagInfo[]>>({}) // 投放类型
  const [deptQuickTagSelector3, setDeptQuickTagSelector3] = useState<Record<number, TagInfo[]>>({}) // 出价类型
  const [deptQuickSelectorSearchTerm1, setDeptQuickSelectorSearchTerm1] = useState<
    Record<number, string>
  >({})
  const [deptQuickSelectorSearchTerm2, setDeptQuickSelectorSearchTerm2] = useState<
    Record<number, string>
  >({})
  const [deptQuickSelectorSearchTerm3, setDeptQuickSelectorSearchTerm3] = useState<
    Record<number, string>
  >({})

  // 附加统计标签（部门版）
  const [deptAdditionalTagGroupsMap, setDeptAdditionalTagGroupsMap] = useState<
    Record<number, TagInfo[]>
  >({})
  const [deptActiveGroupId, setDeptActiveGroupId] = useState<string | null>(null)
  const [deptSearchTerm, setDeptSearchTerm] = useState('')

  // 固定的组织节点ID和名称
  const fixedEbpIds = [
    '1853482085448265',
    '1853482000646153',
    '1853481210457097',
    '1853482069978187',
    '1853482046820427',
    '1853481228847306',
    '1853268352333129'
  ]
  const fixedEbpNames = [
    '红果短剧分销-一刀',
    '红果短剧分销-梅煊',
    '红果短剧分销-谢超',
    '红果短剧分销-朝阳',
    '番茄小说分销-梅煊',
    '番茄小说分销-谢超',
    '番茄畅听分销'
  ]

  // Helper to get available tags for a config, fetching if needed
  const handleLoadTags = async (configId: number) => {
    if (cachedTags[configId]) return

    setLoadingTagsFor(configId)
    try {
      const response = await dataAssistantService.getAccountTags(configId)
      if (response.data?.tags) {
        setCachedTags((prev) => ({ ...prev, [configId]: response.data.tags || [] }))
      }
    } catch (err) {
      console.error(`Failed to load tags for config ${configId}:`, err)
    } finally {
      setLoadingTagsFor(null)
    }
  }

  const toggleConfigSelection = (configId: number, checked: boolean) => {
    if (checked) {
      setSelectedConfigIds((prev) => [...prev, configId])
      // Initialize settings if not present
      if (!targetSettings[configId]) {
        setTargetSettings((prev) => ({ ...prev, [configId]: [] }))
      }
      // Preload tags
      handleLoadTags(configId)
    } else {
      setSelectedConfigIds((prev) => prev.filter((id) => id !== configId))
      // Optional: Clean up settings? Maybe keep them in case of re-select
      const newSettings = { ...targetSettings }
      delete newSettings[configId]
      setTargetSettings(newSettings)
    }
  }

  const toggleTagSelection = (configId: number, tagId: string) => {
    setTargetSettings((prev) => {
      const currentTagIds = prev[configId] || []
      const newTagIds = currentTagIds.includes(tagId)
        ? currentTagIds.filter((id) => id !== tagId)
        : [...currentTagIds, tagId]
      return { ...prev, [configId]: newTagIds }
    })
  }

  // 部门版：切换快速选择器标签
  const toggleDeptQuickSelectorTag = (
    configId: number,
    selectorIndex: 1 | 2 | 3,
    tag: TagInfo
  ): void => {
    if (selectorIndex === 1) {
      setDeptQuickTagSelector1((prev) => {
        const current = prev[configId] || []
        const isSelected = current.some((t) => t.id === tag.id)
        return {
          ...prev,
          [configId]: isSelected ? current.filter((t) => t.id !== tag.id) : [...current, tag]
        }
      })
    } else if (selectorIndex === 2) {
      setDeptQuickTagSelector2((prev) => {
        const current = prev[configId] || []
        const isSelected = current.some((t) => t.id === tag.id)
        return {
          ...prev,
          [configId]: isSelected ? current.filter((t) => t.id !== tag.id) : [...current, tag]
        }
      })
    } else if (selectorIndex === 3) {
      setDeptQuickTagSelector3((prev) => {
        const current = prev[configId] || []
        const isSelected = current.some((t) => t.id === tag.id)
        return {
          ...prev,
          [configId]: isSelected ? current.filter((t) => t.id !== tag.id) : [...current, tag]
        }
      })
    }
  }

  // 部门版：生成快速标签组
  const generateDeptQuickTagGroups = (configId: number): void => {
    const selector1 = deptQuickTagSelector1[configId] || [] // 投手
    const selector2 = deptQuickTagSelector2[configId] || [] // 投放类型
    const selector3 = deptQuickTagSelector3[configId] || [] // 出价类型

    if (selector1.length === 0) {
      setError('请至少选择一个投手标签')
      return
    }

    const newGroups: TagGroup[] = []
    let counter = 0
    const baseTime = Date.now()

    // 交替模式生成：投手单独标签、投手+投放类型+出价类型、投手单独标签、投手+投放类型+出价类型...
    selector1.forEach((tag1) => {
      // 先添加投手单独标签
      const soloGroupId = `group_${baseTime}_${counter++}_${Math.random().toString(36).substr(2, 9)}`
      newGroups.push({
        id: soloGroupId,
        name: tag1.value,
        tags: [tag1]
      })

      // 如果第二组和第三组都有标签，添加组合标签组
      if (selector2.length > 0 && selector3.length > 0) {
        selector2.forEach((tag2) => {
          selector3.forEach((tag3) => {
            const comboGroupId = `group_${baseTime}_${counter++}_${Math.random().toString(36).substr(2, 9)}`
            newGroups.push({
              id: comboGroupId,
              name: `${tag1.value}-${tag2.value}-${tag3.value}`,
              tags: [tag1, tag2, tag3]
            })
          })
        })
      }
      // 如果只有第二组有标签
      else if (selector2.length > 0) {
        selector2.forEach((tag2) => {
          const comboGroupId = `group_${baseTime}_${counter++}_${Math.random().toString(36).substr(2, 9)}`
          newGroups.push({
            id: comboGroupId,
            name: `${tag1.value}-${tag2.value}`,
            tags: [tag1, tag2]
          })
        })
      }
      // 如果只有第三组有标签
      else if (selector3.length > 0) {
        selector3.forEach((tag3) => {
          const comboGroupId = `group_${baseTime}_${counter++}_${Math.random().toString(36).substr(2, 9)}`
          newGroups.push({
            id: comboGroupId,
            name: `${tag1.value}-${tag3.value}`,
            tags: [tag1, tag3]
          })
        })
      }
    })

    // 更新标签组映射（替换现有标签组）
    setDeptTagGroupsMap((prev) => ({
      ...prev,
      [configId]: newGroups
    }))

    // 清空快速选择器
    setDeptQuickTagSelector1((prev) => ({ ...prev, [configId]: [] }))
    setDeptQuickTagSelector2((prev) => ({ ...prev, [configId]: [] }))
    setDeptQuickTagSelector3((prev) => ({ ...prev, [configId]: [] }))
    setDeptQuickSelectorSearchTerm1((prev) => ({ ...prev, [configId]: '' }))
    setDeptQuickSelectorSearchTerm2((prev) => ({ ...prev, [configId]: '' }))
    setDeptQuickSelectorSearchTerm3((prev) => ({ ...prev, [configId]: '' }))
  }

  // 部门版：切换账户选择
  const toggleDeptConfigSelection = (configId: number, checked: boolean) => {
    if (checked) {
      setDeptConfigIds((prev) => [...prev, configId])
      if (!deptActiveConfigId) {
        setDeptActiveConfigId(configId)
      }
      // 初始化标签组映射
      if (!deptTagGroupsMap[configId]) {
        setDeptTagGroupsMap((prev) => ({ ...prev, [configId]: [] }))
      }
      // 预加载标签
      handleLoadTags(configId)
    } else {
      setDeptConfigIds((prev) => prev.filter((id) => id !== configId))
      // 如果取消选择的是当前活动账户，切换到第一个选中的账户
      if (deptActiveConfigId === configId) {
        const remainingIds = deptConfigIds.filter((id) => id !== configId)
        setDeptActiveConfigId(remainingIds.length > 0 ? remainingIds[0] : null)
      }
      // 清理标签组映射
      setDeptTagGroupsMap((prev) => {
        const newMap = { ...prev }
        delete newMap[configId]
        return newMap
      })
    }
  }

  const addCondition = () => {
    setConditions([...conditions, { metric: 'stat_cost', operator: 'gte', value: '' }])
  }

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index))
  }

  const updateCondition = (index: number, field: keyof (typeof conditions)[0], value: string) => {
    const newConditions = [...conditions]
    const updatedCondition = { ...newConditions[index], [field]: value }
    // 如果操作符从 between 改为其他，清除 value2
    if (field === 'operator' && value !== 'between') {
      delete updatedCondition.value2
    }
    // 如果操作符改为 between，初始化 value2
    if (field === 'operator' && value === 'between' && !updatedCondition.value2) {
      updatedCondition.value2 = ''
    }
    newConditions[index] = updatedCondition
    setConditions(newConditions)
  }

  const loadConfigs = async () => {
    try {
      const oceanConfigs = await configService.getConfigsBySource(1)
      setConfigs(oceanConfigs)
      if (oceanConfigs.length > 0 && !selectedConfigId) {
        setSelectedConfigId(oceanConfigs[0].id)
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
    }
  }

  // 查看日志处理函数
  const handleViewLogs = async (taskId: number) => {
    setViewingTaskId(taskId)
    setIsLogsDialogOpen(true)
    setLogsPage(1)
    await loadExecutionLogs(taskId, 1)
  }

  // 加载执行日志列表
  const loadExecutionLogs = async (taskId: number, page: number = 1) => {
    setLogsLoading(true)
    try {
      const response = await scheduledTaskService.getExecutionLogs(taskId, {
        page,
        page_size: logsPageSize
      })
      setExecutionLogs(response.items)
      setLogsTotal(response.meta.total)
      setLogsPage(page)
    } catch (err) {
      console.error('Failed to load execution logs:', err)
      setExecutionLogs([])
      setLogsTotal(0)
    } finally {
      setLogsLoading(false)
    }
  }

  // 获取执行状态标签
  const getExecutionStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      success: {
        label: '成功',
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      },
      failed: {
        label: '失败',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      },
      partial: {
        label: '部分成功',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      },
      running: {
        label: '执行中',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      }
    }
    const statusInfo = statusMap[status] || {
      label: status,
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusInfo.className}`}
      >
        {statusInfo.label}
      </span>
    )
  }

  const loadTasks = async () => {
    setLoading(true)
    try {
      const response = await scheduledTaskService.getScheduledTasks({
        page: 1,
        page_size: 100
      })
      setTasks(response.items)

      // 加载每个任务的最新执行日志（并行加载以提高性能）
      const logs: Record<number, ExecutionLog> = {}
      const logPromises = response.items
        .filter((task) => task.task_type === 'auto_ad_control')
        .map(async (task) => {
          try {
            const latestLog = await scheduledTaskService.getLatestExecutionLog(task.id)
            // 如果返回 null，说明没有执行日志，跳过
            if (latestLog) {
              return { taskId: task.id, log: latestLog }
            }
            return null
          } catch (err: any) {
            // 如果请求失败，记录错误但不影响主流程
            console.error(`Failed to load execution log for task ${task.id}:`, err)
            return null
          }
        })

      const logResults = await Promise.all(logPromises)
      logResults.forEach((result) => {
        if (result && result.log) {
          logs[result.taskId] = result.log
        }
      })
      setLatestLogs(logs)
    } catch (err) {
      console.error('Failed to load tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  // 初始化加载任务列表
  useEffect(() => {
    loadTasks()
  }, [])

  const loadOceanTokens = useCallback(async () => {
    setLoadingOceanTokens(true)
    try {
      const res = await oceanEngineOAuthService.getTokens(true)
      setOceanTokens(res.items ?? [])
    } catch {
      setOceanTokens([])
    } finally {
      setLoadingOceanTokens(false)
    }
  }, [])

  /** 同一纵横组织可能在多个巨量应用下各有一条 OAuth，按 advertiser_id 去重展示 */
  const uniqueBitableOrgTokens = useMemo(() => {
    const grouped = new Map<string, OceanEngineOAuthToken[]>()
    for (const token of oceanTokens) {
      const list = grouped.get(token.advertiser_id)
      if (list) list.push(token)
      else grouped.set(token.advertiser_id, [token])
    }
    return Array.from(grouped.values()).map((group) => {
      const primary = group[0]
      const appCodes = Array.from(new Set(group.map((item) => item.app_code))).sort()
      return {
        advertiser_id: primary.advertiser_id,
        advertiser_name: primary.advertiser_name,
        appCodes
      }
    })
  }, [oceanTokens])

  // 当对话框打开且任务类型为 auto_ad_control 或 data_assistant_report 或 data_assistant_report_dept 时，加载配置列表
  useEffect(() => {
    if (
      isDialogOpen &&
      (taskType === 'auto_ad_control' ||
        taskType === 'data_assistant_report' ||
        taskType === 'data_assistant_report_dept' ||
        taskType === 'feishu_bitable_auto')
    ) {
      loadConfigs()
    }
  }, [isDialogOpen, taskType])

  useEffect(() => {
    if (isDialogOpen && taskType === 'feishu_bitable_auto') {
      void loadOceanTokens()
    }
  }, [isDialogOpen, taskType, loadOceanTokens])

  // 根据报表类型和时间设置动态生成Cron表达式
  useEffect(() => {
    if (taskType === 'data_assistant_report') {
      if (reportType === '日报') {
        // 日报：每天 scheduleHour:scheduleMinute 执行
        setCronExpression(`${scheduleMinute} ${scheduleHour} * * *`)
      } else {
        // 时报：每小时的 scheduleMinute 分执行
        setCronExpression(`${scheduleMinute} * * * *`)
      }
    } else if (taskType === 'data_assistant_report_dept') {
      if (deptReportType === '日报') {
        // 日报：每天 deptScheduleHour:deptScheduleMinute 执行
        setCronExpression(`${deptScheduleMinute} ${deptScheduleHour} * * *`)
      } else {
        // 时报：每小时的 deptScheduleMinute 分执行
        setCronExpression(`${deptScheduleMinute} * * * *`)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    reportType,
    scheduleHour,
    scheduleMinute,
    taskType,
    deptReportType,
    deptScheduleHour,
    deptScheduleMinute
  ])

  const handleSubmit = async () => {
    if (!taskName) {
      setError('请填写任务名称')
      return
    }

    if (taskType === 'auto_ad_control') {
      if (selectedConfigIds.length === 0) {
        setError('请至少选择一个账号配置')
        return
      }
      if (!checkInterval) {
        setError('请填写检查间隔')
        return
      }
    } else if (taskType === 'data_assistant_report') {
      if (!dataAssistantConfigId) {
        setError('请选择账号配置')
        return
      }
    } else if (taskType === 'data_assistant_report_dept') {
      if (deptConfigIds.length === 0) {
        setError('请至少选择一个账号配置')
        return
      }
      // 检查是否所有选中的账户都有标签组
      const hasEmptyTagGroups = deptConfigIds.some(
        (configId) => !deptTagGroupsMap[configId] || deptTagGroupsMap[configId].length === 0
      )
      if (hasEmptyTagGroups) {
        setError('请为所有选中的账户添加至少一个标签组')
        return
      }
    } else if (taskType === 'feishu_bitable_auto') {
      // 定时任务表要求 config_id 外键；Bitable 预检/创建实际只用 OAuth（org），不读 Cookie
      if ((bitableConfigId ?? configs[0]?.id) == null) {
        setError(
          '请先在配置管理中添加至少一条巨量账号配置（仅满足任务记录；投放使用下方 OAuth 组织，不依赖 Cookie）'
        )
        return
      }
      const parsedUrl = parseBitableUrl(bitableTableUrl)
      if (!parsedUrl) {
        setError('请填写有效的飞书多维表格链接（需含 /base/xxx 与 ?table=xxx）')
        return
      }
      if (!bitableSelectedOrgId) {
        setError('请选择一个授权来源组织（纵横组织）')
        return
      }
      const parseInterval = (s: string): number | null => {
        const t = s.trim()
        if (!t) return null
        const n = parseInt(t, 10)
        if (Number.isNaN(n) || n < 1 || n > 59) return -1
        return n
      }
      const prevN = parseInterval(bitablePreviewIntervalMinutes)
      const createN = parseInterval(bitableCreateIntervalMinutes)
      if (prevN === -1 || createN === -1) {
        setError('「每 N 分钟」须为 1～59 的整数')
        return
      }
      const hasPreview = prevN !== null
      const hasCreate = createN !== null
      if (!hasPreview && !hasCreate) {
        setError('请至少填写「预检」或「创建广告」的间隔分钟数之一')
        return
      }
      if (bitableEditPreviewTaskId != null && !hasPreview) {
        setError('已存在预检定时任务：请填写预检间隔分钟数，或先在列表中删除该任务')
        return
      }
      if (bitableEditCreateTaskId != null && !hasCreate) {
        setError('已存在创建广告定时任务：请填写创建间隔分钟数，或先在列表中删除该任务')
        return
      }
    } else {
      if (!selectedConfigId || !cronExpression) {
        setError('请填写所有必填字段')
        return
      }
    }

    setIsSubmitting(true)
    setError('')
    try {
      if (taskType === 'feishu_bitable_auto') {
        const parsed = parseBitableUrl(bitableTableUrl)!
        const orgIds = [bitableSelectedOrgId!]
        const sharedTaskConfig: Record<string, unknown> = {
          app_token: parsed.appToken,
          table_id: parsed.tableId,
          org_advertiser_ids: orgIds,
          materials_per_unit: BITABLE_DEFAULT_MATERIALS_PER_UNIT,
          blocked_time_ranges: blockedTimeRanges.length > 0 ? blockedTimeRanges : undefined
        }
        if (bitableNotifyOpenId.trim()) {
          sharedTaskConfig.notify_open_id = bitableNotifyOpenId.trim()
        }
        const baseName = taskName.trim()
        const previewName = `${baseName} · 预检`
        const createName = `${baseName} · 创建`
        const cid = bitableConfigId ?? configs[0]!.id

        const prevMin = bitablePreviewIntervalMinutes.trim()
          ? parseInt(bitablePreviewIntervalMinutes.trim(), 10)
          : null
        const createMin = bitableCreateIntervalMinutes.trim()
          ? parseInt(bitableCreateIntervalMinutes.trim(), 10)
          : null
        const hasPreview = prevMin !== null && prevMin >= 1 && prevMin <= 59
        const hasCreate = createMin !== null && createMin >= 1 && createMin <= 59
        const cronPreview = hasPreview ? minutesToCronEveryNMinutes(prevMin!) : ''
        const cronCreate = hasCreate ? minutesToCronEveryNMinutes(createMin!) : ''

        if (bitableEditPreviewTaskId != null && hasPreview) {
          await scheduledTaskService.updateScheduledTask(bitableEditPreviewTaskId, {
            name: previewName,
            task_type: 'bitable_preview',
            config_id: cid,
            cron_expression: cronPreview,
            task_config: sharedTaskConfig
          })
        } else if (hasPreview && bitableEditPreviewTaskId == null) {
          await scheduledTaskService.createScheduledTask({
            name: previewName,
            task_type: 'bitable_preview',
            config_id: cid,
            cron_expression: cronPreview,
            task_config: sharedTaskConfig
          })
        }

        const createTaskConfig: Record<string, unknown> = { ...sharedTaskConfig }
        createTaskConfig.app_url = bitableAppUrl.trim()
          ? bitableAppUrl.trim()
          : buildBitableTableUrl(parsed.appToken, parsed.tableId)

        if (bitableEditCreateTaskId != null && hasCreate) {
          await scheduledTaskService.updateScheduledTask(bitableEditCreateTaskId, {
            name: createName,
            task_type: 'bitable_create_ads',
            config_id: cid,
            cron_expression: cronCreate,
            task_config: createTaskConfig
          })
        } else if (hasCreate && bitableEditCreateTaskId == null) {
          await scheduledTaskService.createScheduledTask({
            name: createName,
            task_type: 'bitable_create_ads',
            config_id: cid,
            cron_expression: cronCreate,
            task_config: createTaskConfig
          })
        }

        setIsDialogOpen(false)
        resetForm()
        loadTasks()
        return
      }

      let finalCronExpression = cronExpression
      let taskConfig: any = null
      let primaryConfigId = selectedConfigId

      if (taskType === 'auto_ad_control') {
        // Generate cron expression from check interval: every X minutes
        // */X * * * *
        finalCronExpression = `*/${checkInterval} * * * *`
        primaryConfigId = selectedConfigIds[0]

        // Construct detailed target configuration
        const targets = selectedConfigIds.map((id) => {
          const selectedTagIds = targetSettings[id] || []
          const availableTags = cachedTags[id] || []
          // Convert tag IDs to tag objects with both ID and value
          const tags = selectedTagIds.map((tagId) => {
            const tag = availableTags.find((t) => t.id === tagId)
            return tag ? { id: tag.id, value: tag.value } : { id: tagId, value: tagId }
          })

          return {
            config_id: id,
            tags: tags
          }
        })

        // 处理条件：将 between 操作符转换为两个条件（gte 和 lte）
        const processedConditions = conditions.flatMap((condition) => {
          if (condition.operator === 'between' && condition.value && condition.value2) {
            // 转换为两个条件：一个 gte（最小值），一个 lte（最大值）
            return [
              { metric: condition.metric, operator: 'gte', value: condition.value },
              { metric: condition.metric, operator: 'lte', value: condition.value2 }
            ]
          }
          // 其他操作符直接返回，但需要移除 value2 字段
          const { value2, ...rest } = condition
          return [rest]
        })

        taskConfig = {
          targets: targets,
          conditions: processedConditions,
          action_type: actionType,
          check_interval: parseInt(checkInterval),
          blocked_time_ranges: blockedTimeRanges.length > 0 ? blockedTimeRanges : undefined
        }
      } else if (taskType === 'data_assistant_report') {
        primaryConfigId = dataAssistantConfigId!
        // 根据报表类型和时间设置生成Cron表达式
        if (reportType === '日报') {
          finalCronExpression = `${scheduleMinute} ${scheduleHour} * * *` // 每天 scheduleHour:scheduleMinute 执行
        } else {
          finalCronExpression = `${scheduleMinute} * * * *` // 每小时的 scheduleMinute 分执行
        }

        taskConfig = {
          config_id: dataAssistantConfigId,
          report_type: reportType, // 保存报表类型
          ebp_ids: fixedEbpIds,
          ebp_names: fixedEbpNames,
          use_keyword_grouping: useKeywordGrouping,
          keyword_text: keywordText,
          chat_id: chatId,
          send_as_image: sendAsImage,
          blocked_time_ranges: blockedTimeRanges.length > 0 ? blockedTimeRanges : undefined
        }
      } else if (taskType === 'data_assistant_report_dept') {
        primaryConfigId = deptConfigIds[0]!
        // 根据报表类型和时间设置生成Cron表达式
        if (deptReportType === '日报') {
          finalCronExpression = `${deptScheduleMinute} ${deptScheduleHour} * * *`
        } else {
          finalCronExpression = `${deptScheduleMinute} * * * *`
        }

        // 构建标签组映射表（多账户模式）
        const tagGroupsMap: Record<string, TagGroup[]> = {}
        const additionalTagGroupsMap: Record<string, TagInfo[]> = {}
        deptConfigIds.forEach((configId) => {
          const tagGroups = deptTagGroupsMap[configId] || []
          // 与 DataAssistantPage.handleFetchData 一致：只提交有名称、有有效标签的标签组
          if (tagGroups.length > 0) {
            const built = tagGroups
              .filter((g) => g.name.trim() && (g.tags || []).length > 0)
              .map((tg) => ({
                id: tg.id,
                name: tg.name,
                tags: (tg.tags || [])
                  .filter((t) => t.id && t.value)
                  .map((t) => ({ id: t.id, value: t.value }))
              }))
              .filter((g) => g.tags.length > 0)
            if (built.length > 0) {
              tagGroupsMap[String(configId)] = built
            }
          }

          // 添加附加统计标签
          const additionalTags = deptAdditionalTagGroupsMap[configId] || []
          if (additionalTags.length > 0) {
            additionalTagGroupsMap[String(configId)] = additionalTags
              .map((t) => ({ id: t.id, value: t.value }))
              .filter((t) => t.id && t.value)
          }
        })

        if (deptConfigIds.some((id) => !tagGroupsMap[String(id)])) {
          setError(
            '每个账户至少需要一组有效标签（组名非空且至少一个含 id 与 value 的标签），与数据助手拉数条件一致'
          )
          return
        }

        taskConfig = {
          config_ids: deptConfigIds,
          report_type: deptReportType,
          tag_groups_map: tagGroupsMap,
          additional_tag_groups_map:
            Object.keys(additionalTagGroupsMap).length > 0 ? additionalTagGroupsMap : null,
          chat_id: deptChatId,
          send_as_image: deptSendAsImage,
          // 与数据助手页默认一致（不启用时拉取全量，不按关键词拆分）
          use_keyword_grouping: false,
          keyword_text: null,
          blocked_time_ranges: blockedTimeRanges.length > 0 ? blockedTimeRanges : undefined
        }
      }

      if (editingTaskId) {
        // 更新任务
        await scheduledTaskService.updateScheduledTask(editingTaskId, {
          name: taskName,
          task_type: taskType,
          config_id: primaryConfigId!,
          cron_expression: finalCronExpression,
          task_config: taskConfig
        })
      } else {
        // 创建任务
        await scheduledTaskService.createScheduledTask({
          name: taskName,
          task_type: taskType,
          config_id: primaryConfigId!,
          cron_expression: finalCronExpression,
          task_config: taskConfig
        })
      }

      setIsDialogOpen(false)
      resetForm()
      loadTasks()
    } catch (err: any) {
      setError(err.message || (editingTaskId ? '更新失败' : '创建失败'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个任务吗？')) return

    try {
      await scheduledTaskService.deleteScheduledTask(id)
      loadTasks()
    } catch (err) {
      console.error('Failed to delete task:', err)
    }
  }

  const handleToggle = async (id: number) => {
    try {
      await scheduledTaskService.toggleScheduledTask(id)
      loadTasks()
    } catch (err) {
      console.error('Failed to toggle task:', err)
    }
  }

  const handleEdit = async (task: ScheduledTask) => {
    try {
      // 加载任务详情（确保获取最新数据）
      const taskDetail = await scheduledTaskService.getScheduledTask(task.id)

      // 设置编辑状态
      setEditingTaskId(task.id)

      // 填充表单数据
      setTaskName(taskDetail.name)
      setTaskType(taskDetail.task_type)

      if (taskDetail.task_type === 'auto_ad_control') {
        // 加载配置列表
        await loadConfigs()

        const taskConfig = taskDetail.task_config as any
        if (taskConfig) {
          // 设置选中的账户
          const configIds = taskConfig.targets?.map((t: any) => t.config_id) || []
          setSelectedConfigIds(configIds)

          // 设置标签选择
          const settings: Record<number, string[]> = {}
          taskConfig.targets?.forEach((target: any) => {
            settings[target.config_id] = target.tags?.map((tag: any) => tag.id) || []
          })
          setTargetSettings(settings)

          // 设置触发条件，将同一指标的两个条件（gte 和 lte）合并为 between
          if (taskConfig.conditions) {
            const processedConditions: Array<{
              metric: string
              operator: string
              value: string
              value2?: string
            }> = []
            const conditionMap = new Map<string, { gte?: string; lte?: string }>()

            // 先按指标分组
            taskConfig.conditions.forEach((cond: any) => {
              const metric = cond.metric
              if (!conditionMap.has(metric)) {
                conditionMap.set(metric, {})
              }
              const metricConditions = conditionMap.get(metric)!
              if (cond.operator === 'gte') {
                metricConditions.gte = cond.value
              } else if (cond.operator === 'lte') {
                metricConditions.lte = cond.value
              }
            })

            // 处理分组后的条件
            conditionMap.forEach((conds, metric) => {
              // 如果同时有 gte 和 lte，且是激活成本，则合并为 between
              if (conds.gte && conds.lte && metric === 'active_cost') {
                processedConditions.push({
                  metric,
                  operator: 'between',
                  value: conds.gte,
                  value2: conds.lte
                })
              } else {
                // 否则分别添加
                if (conds.gte) {
                  processedConditions.push({ metric, operator: 'gte', value: conds.gte })
                }
                if (conds.lte) {
                  processedConditions.push({ metric, operator: 'lte', value: conds.lte })
                }
              }
            })

            setConditions(processedConditions)
          }

          // 设置执行类型
          if (taskConfig.action_type) {
            setActionType(taskConfig.action_type)
          }

          // 从cron表达式解析检查间隔
          if (taskDetail.cron_expression) {
            const match = taskDetail.cron_expression.match(/^\*\/(\d+)/)
            if (match) {
              setCheckInterval(match[1])
            } else if (taskConfig.check_interval) {
              setCheckInterval(taskConfig.check_interval.toString())
            }
          }

          // 预加载标签
          for (const configId of configIds) {
            await handleLoadTags(configId)
          }
        }
      } else if (taskDetail.task_type === 'data_assistant_report') {
        // 加载配置列表
        await loadConfigs()

        const taskConfig = taskDetail.task_config as any
        if (taskConfig) {
          setDataAssistantConfigId(taskDetail.config_id)

          // 先解析Cron表达式获取时间设置
          let detectedHour = 0
          let detectedMinute = 5
          const cronParts = taskDetail.cron_expression.trim().split(/\s+/)
          if (cronParts.length >= 2) {
            const minuteStr = cronParts[0]
            const hourStr = cronParts[1]
            const minute = parseInt(minuteStr)
            const hour = parseInt(hourStr)

            if (!isNaN(minute)) {
              detectedMinute = minute
            }
            if (!isNaN(hour)) {
              detectedHour = hour
            } else if (hourStr === '*') {
              // 时报类型，小时为*
              detectedHour = 0 // 时报不需要小时，但设置为0作为默认值
            }
          }

          // 从配置中获取报表类型，如果没有则根据Cron表达式推断
          let detectedReportType: '时报' | '日报' = '时报'
          if (taskConfig.report_type) {
            detectedReportType = taskConfig.report_type
          } else {
            // 根据Cron表达式推断报表类型
            if (cronParts.length >= 2 && cronParts[1] === '*') {
              detectedReportType = '时报'
            } else {
              detectedReportType = '日报'
            }
          }

          setReportType(detectedReportType)
          setScheduleHour(detectedHour)
          setScheduleMinute(detectedMinute)
          setUseKeywordGrouping(taskConfig.use_keyword_grouping !== false)
          setKeywordText(taskConfig.keyword_text || '纯激励\n纯短剧')
          setChatId(taskConfig.chat_id || 'oc_7fc46dcc7187bc1ed2f95c1544e32b10')
          setSendAsImage(taskConfig.send_as_image === true)
        }
      } else if (taskDetail.task_type === 'data_assistant_report_dept') {
        // 加载配置列表
        await loadConfigs()

        const taskConfig = taskDetail.task_config as any
        if (taskConfig) {
          // 支持多账户模式
          const configIds = taskConfig.config_ids || [taskDetail.config_id]
          setDeptConfigIds(configIds)
          if (configIds.length > 0) {
            setDeptActiveConfigId(configIds[0])
          }

          // 先解析Cron表达式获取时间设置
          let detectedHour = 0
          let detectedMinute = 5
          const cronParts = taskDetail.cron_expression.trim().split(/\s+/)
          if (cronParts.length >= 2) {
            const minuteStr = cronParts[0]
            const hourStr = cronParts[1]
            const minute = parseInt(minuteStr)
            const hour = parseInt(hourStr)

            if (!isNaN(minute)) {
              detectedMinute = minute
            }
            if (!isNaN(hour)) {
              detectedHour = hour
            } else if (hourStr === '*') {
              // 时报类型，小时为*
              detectedHour = 0
            }
          }

          // 从配置中获取报表类型
          let detectedReportType: '时报' | '日报' = '时报'
          if (taskConfig.report_type) {
            detectedReportType = taskConfig.report_type
          } else {
            if (cronParts.length >= 2 && cronParts[1] === '*') {
              detectedReportType = '时报'
            } else {
              detectedReportType = '日报'
            }
          }

          setDeptReportType(detectedReportType)
          setDeptScheduleHour(detectedHour)
          setDeptScheduleMinute(detectedMinute)
          setDeptChatId(taskConfig.chat_id || 'oc_7fc46dcc7187bc1ed2f95c1544e32b10')
          setDeptSendAsImage(taskConfig.send_as_image === true)

          // 加载标签组配置（支持多账户模式）
          const tagGroupsMap: Record<number, TagGroup[]> = {}
          if (taskConfig.tag_groups_map) {
            // 多账户模式
            Object.keys(taskConfig.tag_groups_map).forEach((configIdStr) => {
              const configId = parseInt(configIdStr)
              const tagGroups = taskConfig.tag_groups_map[configIdStr] || []
              tagGroupsMap[configId] = tagGroups.map((tg: any) => ({
                id: tg.id,
                name: tg.name,
                tags: tg.tags.map((t: any) => ({ id: String(t.id), value: t.value }))
              }))
            })
          } else if (taskConfig.tag_groups && Array.isArray(taskConfig.tag_groups)) {
            // 单账户模式（兼容旧数据）
            const configId = configIds[0]
            tagGroupsMap[configId] = taskConfig.tag_groups.map((tg: any) => ({
              id: tg.id,
              name: tg.name,
              tags: tg.tags.map((t: any) => ({ id: String(t.id), value: t.value }))
            }))
          }
          setDeptTagGroupsMap(tagGroupsMap)

          // 加载附加统计标签配置
          if (taskConfig.additional_tag_groups_map) {
            const additionalMap: Record<number, TagInfo[]> = {}
            Object.keys(taskConfig.additional_tag_groups_map).forEach((configIdStr) => {
              const configId = parseInt(configIdStr)
              const tags = taskConfig.additional_tag_groups_map[configIdStr] || []
              additionalMap[configId] = tags.map((t: any) => ({
                id: String(t.id),
                value: t.value
              }))
            })
            setDeptAdditionalTagGroupsMap(additionalMap)
          }

          // 预加载所有账户的标签
          for (const configId of configIds) {
            await handleLoadTags(configId)
          }
        }
      } else if (
        taskDetail.task_type === 'bitable_preview' ||
        taskDetail.task_type === 'bitable_create_ads'
      ) {
        await loadConfigs()
        setTaskType('feishu_bitable_auto')
        setTaskName(stripBitableTaskNameSuffix(taskDetail.name))
        const sibling = findBitableSiblingTask(taskDetail, tasks)
        if (taskDetail.task_type === 'bitable_preview') {
          setBitableEditPreviewTaskId(taskDetail.id)
          setBitablePreviewIntervalMinutes(
            parseCronToMinuteInterval(taskDetail.cron_expression || '')
          )
          if (sibling?.task_type === 'bitable_create_ads') {
            setBitableEditCreateTaskId(sibling.id)
            setBitableCreateIntervalMinutes(
              parseCronToMinuteInterval(sibling.cron_expression || '')
            )
          } else {
            setBitableEditCreateTaskId(null)
            setBitableCreateIntervalMinutes('')
          }
        } else {
          setBitableEditCreateTaskId(taskDetail.id)
          setBitableCreateIntervalMinutes(
            parseCronToMinuteInterval(taskDetail.cron_expression || '')
          )
          if (sibling?.task_type === 'bitable_preview') {
            setBitableEditPreviewTaskId(sibling.id)
            setBitablePreviewIntervalMinutes(
              parseCronToMinuteInterval(sibling.cron_expression || '')
            )
          } else {
            setBitableEditPreviewTaskId(null)
            setBitablePreviewIntervalMinutes('')
          }
        }
        const tc = taskDetail.task_config as Record<string, unknown> | null
        if (tc) {
          setBitableConfigId(taskDetail.config_id)
          setSelectedConfigId(taskDetail.config_id)
          const at = String(tc.app_token ?? '')
          const tid = String(tc.table_id ?? '')
          if (at && tid) {
            setBitableTableUrl(buildBitableTableUrl(at, tid))
          }
          const orgs = tc.org_advertiser_ids
          if (Array.isArray(orgs) && orgs.length > 0) {
            setBitableSelectedOrgId(String(orgs[0]))
          } else {
            setBitableSelectedOrgId(null)
          }
          setBitableNotifyOpenId(String(tc.notify_open_id ?? ''))
          setBitableAppUrl(String(tc.app_url ?? ''))
        }
      } else {
        // 其他任务类型
        setSelectedConfigId(taskDetail.config_id)
        setCronExpression(taskDetail.cron_expression)
      }

      // 加载禁止执行的时间段配置
      const taskConfig = taskDetail.task_config as any
      if (taskConfig?.blocked_time_ranges) {
        setBlockedTimeRanges(taskConfig.blocked_time_ranges)
      } else {
        setBlockedTimeRanges([])
      }

      setIsDialogOpen(true)
    } catch (err) {
      console.error('Failed to load task for editing:', err)
      setError('加载任务数据失败')
    }
  }

  const resetForm = () => {
    setTaskName('')
    setTaskType('auto_ad_control')
    setCronExpression('')
    setSelectedConfigIds([])
    setTargetSettings({})
    setCachedTags({})
    setConditions([])
    setActionType('disable')
    setCheckInterval('5')
    setError('')
    setEditingTaskId(null)
    // 重置数据助手报表（升级版）任务相关状态
    setDataAssistantConfigId(null)
    setReportType('时报')
    setScheduleHour(0)
    setScheduleMinute(5)
    setUseKeywordGrouping(true)
    setKeywordText('纯激励\n纯短剧')
    setChatId('oc_7fc46dcc7187bc1ed2f95c1544e32b10')
    setSendAsImage(false)
    // 重置数据助手报表（部门版）任务相关状态
    setDeptConfigIds([])
    setDeptActiveConfigId(null)
    setDeptReportType('时报')
    setDeptScheduleHour(0)
    setDeptScheduleMinute(5)
    setDeptTagGroupsMap({})
    setDeptChatId('oc_7fc46dcc7187bc1ed2f95c1544e32b10')
    setDeptSendAsImage(false)
    setDeptQuickTagSelector1({})
    setDeptQuickTagSelector2({})
    setDeptQuickTagSelector3({})
    setDeptQuickSelectorSearchTerm1({})
    setDeptQuickSelectorSearchTerm2({})
    setDeptQuickSelectorSearchTerm3({})
    setDeptAdditionalTagGroupsMap({})
    setDeptActiveGroupId(null)
    setDeptSearchTerm('')
    setBitableConfigId(null)
    setBitableNotifyOpenId('')
    setBitableAppUrl('')
    setBitableTableUrl('')
    setBitableSelectedOrgId(null)
    setBitablePreviewIntervalMinutes('')
    setBitableCreateIntervalMinutes('')
    setBitableEditPreviewTaskId(null)
    setBitableEditCreateTaskId(null)
    // 重置禁止执行的时间段
    setBlockedTimeRanges([])
  }

  const getTaskTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      bid_update: '出价修改',
      batch_operation: '批量操作',
      auto_ad_control: '定时启停广告',
      data_assistant_report: '数据助手报表（升级版）',
      data_assistant_report_dept: '数据助手报表（部门版）',
      bitable_preview: '飞书自动化创建广告',
      bitable_create_ads: '飞书自动化创建广告'
    }
    return typeMap[type] || type
  }

  const getStatusBadge = (status: string, isActive: boolean) => {
    if (!isActive) {
      return (
        <div className="flex items-center gap-2 text-gray-600">
          <Pause className="w-4 h-4" />
          <span className="text-sm font-medium">已暂停</span>
        </div>
      )
    }

    const statusMap: Record<string, { icon: React.ReactNode; text: string; className: string }> = {
      pending: {
        icon: <Clock className="w-4 h-4" />,
        text: '监控中',
        className: 'text-yellow-600'
      },
      running: {
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        text: '运行中',
        className: 'text-blue-600'
      },
      paused: { icon: <Pause className="w-4 h-4" />, text: '已暂停', className: 'text-gray-600' },
      completed: {
        icon: <CheckCircle className="w-4 h-4" />,
        text: '已完成',
        className: 'text-green-600'
      }
    }

    const statusInfo = statusMap[status] || { icon: null, text: status, className: 'text-gray-600' }

    return (
      <div className={`flex items-center gap-2 ${statusInfo.className}`}>
        {statusInfo.icon}
        <span className="text-sm font-medium">{statusInfo.text}</span>
      </div>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('zh-CN')
  }

  // 将Cron表达式转换为易读的中文描述
  const parseCronExpression = (cron: string): string => {
    if (!cron) return '未设置'

    const parts = cron.trim().split(/\s+/)
    if (parts.length < 5) return cron

    const [minute, hour, day, month, weekday] = parts

    // 每X分钟执行: */X * * * *
    if (
      minute.startsWith('*/') &&
      hour === '*' &&
      day === '*' &&
      month === '*' &&
      weekday === '*'
    ) {
      const minutes = minute.replace('*/', '')
      const num = parseInt(minutes)
      if (!isNaN(num)) {
        if (num < 60) return `每${num}分钟`
        if (num === 60) return '每小时'
      }
    }

    // 每天X点执行: 0 X * * *
    if (minute === '0' && hour !== '*' && day === '*' && month === '*' && weekday === '*') {
      const h = parseInt(hour)
      if (!isNaN(h)) return `每天${h}点`
    }

    // 每天X点Y分执行: Y X * * *
    if (minute !== '*' && hour !== '*' && day === '*' && month === '*' && weekday === '*') {
      const m = parseInt(minute)
      const h = parseInt(hour)
      if (!isNaN(m) && !isNaN(h)) return `每天${h}:${m.toString().padStart(2, '0')}`
    }

    // 每小时执行: 0 * * * *
    if (minute === '0' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
      return '每小时'
    }

    // 默认返回原始表达式
    return cron
  }

  // 获取任务配置摘要信息
  const getTaskConfigSummary = (task: ScheduledTask): string => {
    if (task.task_type === 'auto_ad_control' && task.task_config) {
      const config = task.task_config as any
      const targetCount = config.targets?.length || 0
      const conditionCount = config.conditions?.length || 0
      const action = config.action_type === 'enable' ? '开启' : '关闭'
      const interval = config.check_interval || 'N'

      const parts: string[] = []
      if (targetCount > 0) parts.push(`${targetCount}个账户`)
      if (conditionCount > 0) parts.push(`${conditionCount}个条件`)
      if (action) parts.push(`执行${action}`)

      return parts.length > 0 ? parts.join(' · ') : '已配置'
    } else if (task.task_type === 'data_assistant_report' && task.task_config) {
      const config = task.task_config as any
      const reportType =
        config.report_type || (task.cron_expression === '30 0 * * *' ? '日报' : '时报')
      const ebpCount = config.ebp_ids?.length || 0
      const parts: string[] = []
      parts.push(`类型: ${reportType}`)
      if (ebpCount > 0) parts.push(`${ebpCount}个组织节点`)
      if (config.use_keyword_grouping) parts.push('关键字分组')
      return parts.join(' · ')
    } else if (task.task_type === 'data_assistant_report_dept' && task.task_config) {
      const config = task.task_config as any
      const reportType = config.report_type || '时报'
      const configIds = config.config_ids || [task.config_id]
      const tagGroupsMap = config.tag_groups_map || {}
      const totalTagGroupCount = Object.values(tagGroupsMap).reduce(
        (sum: number, groups: any) => sum + (Array.isArray(groups) ? groups.length : 0),
        0
      )
      const parts: string[] = []
      parts.push(`类型: ${reportType}`)
      if (configIds.length > 1) parts.push(`${configIds.length}个账户`)
      if (totalTagGroupCount > 0) parts.push(`${totalTagGroupCount}个标签组`)
      if (config.send_as_image) parts.push('以图片发送')
      return parts.join(' · ')
    } else if (
      (task.task_type === 'bitable_preview' || task.task_type === 'bitable_create_ads') &&
      task.task_config
    ) {
      const c = task.task_config as Record<string, unknown>
      const phase = task.task_type === 'bitable_preview' ? '预检' : '创建'
      const mins = parseCronToMinuteInterval(task.cron_expression || '')
      const sched = mins ? `每${mins}分钟` : task.cron_expression || ''
      return `${phase} · ${sched} · 表 ${String(c.table_id ?? '').slice(0, 8)}…`
    }
    return '-'
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 text-primary" />
                Ocean Engine Task Center
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl sm:text-3xl">定时任务管理</CardTitle>
                <CardDescription className="max-w-2xl">
                  在同一个页面里创建、查看、编辑和追踪自动化任务，适合作为投放流程的统一调度台。
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={() => {
                resetForm()
                setIsDialogOpen(true)
              }}
            >
              <Plus className="mr-2 w-4 h-4" />
              创建任务
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">任务总数</span>
              <Settings className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-2xl">{tasks.length}</CardTitle>
            <CardDescription>当前工作区已创建的自动化任务数量。</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">启用中</span>
              <CheckCircle className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-2xl">
              {tasks.filter((task) => task.is_active).length}
            </CardTitle>
            <CardDescription>正在持续调度中的任务数量。</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">运行中</span>
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-2xl">
              {tasks.filter((task) => task.status === 'running').length}
            </CardTitle>
            <CardDescription>当前处于执行状态或等待完成的任务。</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* 任务列表 */}
      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle className="text-lg sm:text-xl">任务列表</CardTitle>
          <CardDescription>查看状态、执行频率、最近运行时间和快捷操作。</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              暂无任务，点击&ldquo;创建任务&rdquo;添加新任务
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group relative p-5 rounded-lg border bg-card hover:border-primary/50 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* 左侧：主要信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-shrink-0 mt-1">
                          {getStatusBadge(task.status, task.is_active)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-semibold text-foreground truncate">
                              {task.name}
                            </h3>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                              {getTaskTypeLabel(task.task_type)}
                            </span>
                          </div>
                          {task.task_type === 'auto_ad_control' && (
                            <>
                              <p className="text-xs text-muted-foreground mt-1">
                                {getTaskConfigSummary(task)}
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 详细信息网格 */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border/50">
                        <div className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground mb-0.5">执行频率</div>
                            <div className="text-sm font-medium text-foreground">
                              {parseCronExpression(task.cron_expression)}
                            </div>
                            {task.next_run_at && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                下次: {formatDate(task.next_run_at)}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground mb-0.5">最后执行</div>
                            <div className="text-sm text-foreground">
                              {task.last_run_at ? (
                                formatDate(task.last_run_at)
                              ) : (
                                <span className="text-muted-foreground italic">从未执行</span>
                              )}
                            </div>
                            {task.last_run_at && task.status === 'running' && (
                              <div className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                正在执行中...
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground mb-0.5">执行次数</div>
                            <div className="text-sm font-medium text-foreground">
                              {task.run_count || 0} 次
                            </div>
                            {task.run_count > 0 && task.last_run_at && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                成功率: {task.status === 'running' ? '计算中...' : '100%'}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <div className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground mb-0.5">创建时间</div>
                            <div className="text-sm text-foreground">
                              {formatDate(task.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 右侧：操作按钮 */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(task)}
                        title="编辑任务"
                        className="h-9 w-9 p-0 text-muted-foreground hover:text-primary"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(task.id)}
                        title={task.is_active ? '暂停任务' : '启动任务'}
                        className="h-9 w-9 p-0"
                      >
                        {task.is_active ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(task.id)}
                        className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                        title="删除任务"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      {task.task_type === 'auto_ad_control' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewLogs(task.id)}
                          title="查看执行日志"
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-primary"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 创建/编辑对话框 */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) {
            resetForm()
          }
        }}
      >
        <DialogContent
          className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editingTaskId
                ? taskType === 'auto_ad_control'
                  ? '编辑自动启停策略'
                  : taskType === 'data_assistant_report'
                    ? '编辑数据助手报表（升级版）任务'
                    : taskType === 'data_assistant_report_dept'
                      ? '编辑数据助手报表（部门版）任务'
                      : taskType === 'feishu_bitable_auto'
                        ? '编辑飞书自动化创建广告'
                        : '编辑定时任务'
                : taskType === 'auto_ad_control'
                  ? '创建自动启停策略'
                  : taskType === 'data_assistant_report'
                    ? '创建数据助手报表（升级版）任务'
                    : taskType === 'data_assistant_report_dept'
                      ? '创建数据助手报表（部门版）任务'
                      : taskType === 'feishu_bitable_auto'
                        ? '创建飞书自动化创建广告'
                        : '创建定时任务'}
            </DialogTitle>
            <DialogDescription>
              {editingTaskId
                ? taskType === 'auto_ad_control'
                  ? '修改自动化广告启停规则配置。'
                  : taskType === 'data_assistant_report'
                    ? '修改数据助手报表（升级版）任务配置，系统将定时拉取数据并发送到飞书群组。'
                    : taskType === 'data_assistant_report_dept'
                      ? '修改数据助手报表（部门版）任务配置，系统将定时拉取数据、生成图片或飞书表格并发送到群组。'
                      : taskType === 'feishu_bitable_auto'
                        ? '修改后将分别更新后端的预检任务与创建广告任务（同一表格）。'
                        : '修改定时任务配置。'
                : taskType === 'auto_ad_control'
                  ? '配置自动化广告启停规则，系统将根据设定的消耗、转化等指标自动管理广告状态。'
                  : taskType === 'data_assistant_report'
                    ? '配置数据助手报表（升级版）任务，系统将定时拉取数据、生成飞书表格并发送链接到群组。'
                    : taskType === 'data_assistant_report_dept'
                      ? '配置数据助手报表（部门版）任务，系统将定时拉取数据、生成图片或飞书表格并发送到群组。'
                      : taskType === 'feishu_bitable_auto'
                        ? '填写同一套多维表格参数，并分别为「预检」「创建广告」设置 Cron；提交后系统会创建两条定时任务。'
                        : '创建一个新的定时任务，用于定期执行特定操作。'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* 基础信息区域 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="taskName">任务名称 *</Label>
                <Input
                  id="taskName"
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="请输入任务名称"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="taskType">任务类型 *</Label>
                <select
                  id="taskType"
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  disabled={isSubmitting || !!editingTaskId}
                >
                  {/* <option value="bid_update">出价修改</option>
                  <option value="batch_operation">批量操作</option> */}
                  <option value="auto_ad_control">定时启停广告</option>
                  <option value="feishu_bitable_auto">飞书自动化创建广告</option>
                  {isAdmin && (
                    <>
                      <option value="data_assistant_report">数据助手报表（升级版）</option>
                      <option value="data_assistant_report_dept">数据助手报表（部门版）</option>
                    </>
                  )}
                </select>
                {editingTaskId && (
                  <p className="text-xs text-muted-foreground">编辑模式下无法修改任务类型</p>
                )}
              </div>
            </div>

            {taskType === 'data_assistant_report' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 左侧：账户配置 */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      1. 选择账户配置
                    </Label>
                  </div>

                  <div className="bg-card rounded-lg border shadow-sm">
                    <div className="p-4">
                      <div className="grid gap-2">
                        <Label htmlFor="dataAssistantConfig">账号配置 *</Label>
                        <select
                          id="dataAssistantConfig"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={dataAssistantConfigId || ''}
                          onChange={(e) => {
                            const configId = parseInt(e.target.value)
                            setDataAssistantConfigId(configId)
                          }}
                          disabled={isSubmitting}
                        >
                          <option value="">请选择账号配置</option>
                          {configs.map((config) => (
                            <option key={config.id} value={config.id}>
                              {config.cookie_name} {config.realname && `(${config.realname})`}
                            </option>
                          ))}
                        </select>
                        {dataAssistantConfigId && (
                          <div className="mt-2 p-2 bg-primary/5 border border-primary/20 rounded-md">
                            <div className="flex items-center gap-2 text-sm">
                              <CheckCircle className="w-4 h-4 text-primary" />
                              <span className="font-medium">
                                {configs.find((c) => c.id === dataAssistantConfigId)?.cookie_name}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 右侧：报表配置 */}
                <div className="space-y-6">
                  <div className="bg-card rounded-lg border shadow-sm h-full flex flex-col">
                    <div className="p-4 border-b bg-muted/10">
                      <h3 className="font-semibold flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        2. 报表配置
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        配置报表查询类型和执行时间
                      </p>
                    </div>

                    <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                      <div className="grid gap-2">
                        <Label>查询类型 *</Label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="reportType"
                              value="时报"
                              checked={reportType === '时报'}
                              onChange={(e) => setReportType(e.target.value as '时报' | '日报')}
                              className="accent-primary"
                              disabled={isSubmitting}
                            />
                            <span className="text-sm">时报（查询当前日期）</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="reportType"
                              value="日报"
                              checked={reportType === '日报'}
                              onChange={(e) => setReportType(e.target.value as '时报' | '日报')}
                              className="accent-primary"
                              disabled={isSubmitting}
                            />
                            <span className="text-sm">日报（查询昨天）</span>
                          </label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {reportType === '时报'
                            ? '时报：查询日期为当前日期，每小时的指定分钟执行'
                            : '日报：查询日期为昨天，每天指定时间执行'}
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <Label>执行时间 *</Label>
                        <div className="flex items-center gap-4 flex-wrap">
                          {reportType === '日报' && (
                            <div className="flex items-center gap-2">
                              <Label htmlFor="scheduleHour" className="text-sm whitespace-nowrap">
                                每天
                              </Label>
                              <select
                                id="scheduleHour"
                                className="px-3 py-2 border rounded-md bg-background"
                                value={scheduleHour}
                                onChange={(e) => setScheduleHour(parseInt(e.target.value))}
                                disabled={isSubmitting}
                              >
                                {Array.from({ length: 24 }, (_, i) => (
                                  <option key={i} value={i}>
                                    {i}时
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Label htmlFor="scheduleMinute" className="text-sm whitespace-nowrap">
                              {reportType === '日报' ? '' : '每小时的'}
                            </Label>
                            <select
                              id="scheduleMinute"
                              className="px-3 py-2 border rounded-md bg-background"
                              value={scheduleMinute}
                              onChange={(e) => setScheduleMinute(parseInt(e.target.value))}
                              disabled={isSubmitting}
                            >
                              {Array.from({ length: 60 }, (_, i) => (
                                <option key={i} value={i}>
                                  {i}分
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="p-2 bg-muted/30 rounded-md">
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            {reportType === '日报'
                              ? `执行时间：每天 ${scheduleHour}:${scheduleMinute.toString().padStart(2, '0')}`
                              : `执行时间：每小时的 ${scheduleMinute} 分`}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border-t bg-muted/10">
                      <h3 className="font-semibold flex items-center gap-2 mb-4">
                        <Users className="w-4 h-4 text-primary" />
                        3. 组织节点配置
                      </h3>
                      <div className="space-y-3">
                        <div className="border rounded-md p-3 bg-muted/30">
                          <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                            <span className="font-medium">
                              已固定选择 {fixedEbpIds.length} 个组织节点：
                            </span>
                          </div>
                          <div className="space-y-1 max-h-[120px] overflow-y-auto">
                            {fixedEbpNames.map((name, index) => (
                              <div
                                key={fixedEbpIds[index]}
                                className="text-xs p-1.5 bg-background rounded border flex items-center gap-2"
                              >
                                <CheckCircle className="w-3 h-3 text-primary flex-shrink-0" />
                                <span className="font-medium">{name}</span>
                                <span className="text-muted-foreground">
                                  ({fixedEbpIds[index]})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border-t bg-muted/10">
                      <h3 className="font-semibold flex items-center gap-2 mb-4">
                        <Tag className="w-4 h-4 text-primary" />
                        4. 关键字分组配置
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="useKeywordGrouping"
                            checked={useKeywordGrouping}
                            onCheckedChange={(checked) => setUseKeywordGrouping(checked === true)}
                            disabled={isSubmitting}
                          />
                          <Label htmlFor="useKeywordGrouping" className="cursor-pointer">
                            启用关键字分组
                          </Label>
                        </div>
                        {useKeywordGrouping && (
                          <div className="grid gap-2 ml-6">
                            <Label htmlFor="keywordText">关键字文本（每行一个）</Label>
                            <textarea
                              id="keywordText"
                              className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px]"
                              value={keywordText}
                              onChange={(e) => setKeywordText(e.target.value)}
                              placeholder="纯激励&#10;纯短剧"
                              disabled={isSubmitting}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 border-t bg-muted/10">
                      <h3 className="font-semibold flex items-center gap-2 mb-4">
                        <Settings className="w-4 h-4 text-primary" />
                        5. 飞书群组配置
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="sendAsImage"
                            checked={sendAsImage}
                            onCheckedChange={(checked) => setSendAsImage(checked === true)}
                            disabled={isSubmitting}
                          />
                          <Label
                            htmlFor="sendAsImage"
                            className="cursor-pointer flex items-center gap-2"
                          >
                            <Image className="w-4 h-4" />
                            以图片形式发送到飞书
                          </Label>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          勾选后，报表将以图片形式发送到飞书群组；不勾选则创建飞书表格并发送链接
                        </p>
                        <div className="space-y-2">
                          <Label htmlFor="chatId">飞书群组ID</Label>
                          <Input
                            id="chatId"
                            placeholder="oc_7fc46dcc7187bc1ed2f95c1544e32b10"
                            value={chatId}
                            onChange={(e) => setChatId(e.target.value)}
                            disabled={isSubmitting}
                          />
                          <p className="text-xs text-muted-foreground">
                            默认: oc_7fc46dcc7187bc1ed2f95c1544e32b10
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : taskType === 'data_assistant_report_dept' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 左侧：账户配置 */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      1. 选择账户配置
                    </Label>
                    <div className="flex gap-2">
                      <span className="text-xs text-muted-foreground">
                        已选 {deptConfigIds.length} 个账户
                      </span>
                    </div>
                  </div>

                  <div className="h-[400px] overflow-y-auto p-1">
                    {configs.length === 0 ? (
                      <div className="flex justify-center items-center h-full text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                        暂无可用账户
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {configs.map((config) => {
                          const isSelected = deptConfigIds.includes(config.id)
                          return (
                            <div
                              key={config.id}
                              className={`relative p-3 border rounded-md cursor-pointer transition-all flex flex-col gap-2 ${
                                isSelected
                                  ? 'shadow-sm border-primary bg-primary/5'
                                  : 'border-border hover:border-primary/50 hover:bg-accent/50'
                              }`}
                              onClick={() => toggleDeptConfigSelection(config.id, !isSelected)}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex flex-1 gap-2 items-center min-w-0">
                                  <div
                                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 ${
                                      isSelected
                                        ? 'border-primary bg-primary'
                                        : 'border-muted-foreground/30'
                                    }`}
                                  >
                                    {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div
                                      className="text-sm font-medium truncate"
                                      title={config.cookie_name}
                                    >
                                      {config.cookie_name}
                                    </div>
                                    {config.realname && (
                                      <div className="text-xs truncate text-muted-foreground">
                                        {config.realname}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* 标签组配置区域 */}
                  {deptConfigIds.length > 0 && (
                    <>
                      <Card className="border shadow-sm mt-4">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Tag className="w-4 h-4 text-primary" />
                            标签组配置 *
                          </CardTitle>
                          <CardDescription className="text-xs">
                            为每个账户配置标签组，用于报表数据筛选
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex overflow-x-auto gap-1 bg-muted/50 p-1 rounded-lg">
                            {deptConfigIds.map((configId) => {
                              const config = configs.find((c) => c.id === configId)
                              const isActive = deptActiveConfigId === configId
                              return (
                                <button
                                  key={configId}
                                  type="button"
                                  onClick={() => {
                                    setDeptActiveConfigId(configId)
                                    setDeptQuickSelectorSearchTerm1((prev) => ({
                                      ...prev,
                                      [configId]: ''
                                    }))
                                    setDeptQuickSelectorSearchTerm2((prev) => ({
                                      ...prev,
                                      [configId]: ''
                                    }))
                                    setDeptQuickSelectorSearchTerm3((prev) => ({
                                      ...prev,
                                      [configId]: ''
                                    }))
                                  }}
                                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                                    isActive
                                      ? 'bg-background text-primary shadow-sm'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                  }`}
                                >
                                  {config?.cookie_name || `账户${configId}`}
                                  <span
                                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                      isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'bg-muted text-muted-foreground'
                                    }`}
                                  >
                                    {
                                      (deptTagGroupsMap[configId] || []).filter(
                                        (g) => g.tags.length > 0
                                      ).length
                                    }
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>

                {/* 右侧：报表配置 */}
                <div className="space-y-6">
                  <div className="bg-card rounded-lg border shadow-sm h-full flex flex-col">
                    <div className="p-4 border-b bg-muted/10">
                      <h3 className="font-semibold flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        2. 报表配置
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        配置报表查询类型和执行时间
                      </p>
                    </div>

                    <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                      <div className="grid gap-2">
                        <Label>查询类型 *</Label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="deptReportType"
                              value="时报"
                              checked={deptReportType === '时报'}
                              onChange={(e) => setDeptReportType(e.target.value as '时报' | '日报')}
                              className="accent-primary"
                              disabled={isSubmitting}
                            />
                            <span className="text-sm">时报（查询当前日期）</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="deptReportType"
                              value="日报"
                              checked={deptReportType === '日报'}
                              onChange={(e) => setDeptReportType(e.target.value as '时报' | '日报')}
                              className="accent-primary"
                              disabled={isSubmitting}
                            />
                            <span className="text-sm">日报（查询昨天）</span>
                          </label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {deptReportType === '时报'
                            ? '时报：查询日期为当前日期，每小时的指定分钟执行'
                            : '日报：查询日期为昨天，每天指定时间执行'}
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <Label>执行时间 *</Label>
                        <div className="flex items-center gap-4 flex-wrap">
                          {deptReportType === '日报' && (
                            <div className="flex items-center gap-2">
                              <Label
                                htmlFor="deptScheduleHour"
                                className="text-sm whitespace-nowrap"
                              >
                                每天
                              </Label>
                              <select
                                id="deptScheduleHour"
                                className="px-3 py-2 border rounded-md bg-background"
                                value={deptScheduleHour}
                                onChange={(e) => setDeptScheduleHour(parseInt(e.target.value))}
                                disabled={isSubmitting}
                              >
                                {Array.from({ length: 24 }, (_, i) => (
                                  <option key={i} value={i}>
                                    {i}时
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor="deptScheduleMinute"
                              className="text-sm whitespace-nowrap"
                            >
                              {deptReportType === '日报' ? '' : '每小时的'}
                            </Label>
                            <select
                              id="deptScheduleMinute"
                              className="px-3 py-2 border rounded-md bg-background"
                              value={deptScheduleMinute}
                              onChange={(e) => setDeptScheduleMinute(parseInt(e.target.value))}
                              disabled={isSubmitting}
                            >
                              {Array.from({ length: 60 }, (_, i) => (
                                <option key={i} value={i}>
                                  {i}分
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="p-2 bg-muted/30 rounded-md">
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            {deptReportType === '日报'
                              ? `执行时间：每天 ${deptScheduleHour}:${deptScheduleMinute.toString().padStart(2, '0')}`
                              : `执行时间：每小时的 ${deptScheduleMinute} 分`}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border-t bg-muted/10">
                      <h3 className="font-semibold flex items-center gap-2 mb-4">
                        <Settings className="w-4 h-4 text-primary" />
                        3. 飞书群组配置
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="deptSendAsImage"
                            checked={deptSendAsImage}
                            onCheckedChange={(checked) => setDeptSendAsImage(checked === true)}
                            disabled={isSubmitting}
                          />
                          <Label
                            htmlFor="deptSendAsImage"
                            className="cursor-pointer flex items-center gap-2"
                          >
                            <Image className="w-4 h-4" />
                            以图片形式发送到飞书
                          </Label>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          勾选后，报表将以图片形式发送到飞书群组；不勾选则创建飞书表格并发送链接
                        </p>
                        <div className="space-y-2">
                          <Label htmlFor="deptChatId">飞书群组ID</Label>
                          <Input
                            id="deptChatId"
                            placeholder="oc_7fc46dcc7187bc1ed2f95c1544e32b10"
                            value={deptChatId}
                            onChange={(e) => setDeptChatId(e.target.value)}
                            disabled={isSubmitting}
                          />
                          <p className="text-xs text-muted-foreground">
                            默认: oc_7fc46dcc7187bc1ed2f95c1544e32b10
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 标签组配置区域 - 完整内容，在grid布局外 */}
                {deptConfigIds.length > 0 && (
                  <div className="col-span-1 md:col-span-2">
                    {/* 快速组合标签选择器 */}
                    {deptActiveConfigId && (
                      <div className="mt-4">
                        <Card className="border-dashed">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">快速组合标签</CardTitle>
                            <CardDescription className="text-xs">
                              选择三个标签组后，点击"生成标签组"自动组合
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* 选择投手 */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium">选择投手</label>
                                <div className="relative">
                                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="搜索标签..."
                                    value={deptQuickSelectorSearchTerm1[deptActiveConfigId] || ''}
                                    onChange={(e) =>
                                      setDeptQuickSelectorSearchTerm1((prev) => ({
                                        ...prev,
                                        [deptActiveConfigId]: e.target.value
                                      }))
                                    }
                                    className="pl-8 h-9 text-sm"
                                  />
                                </div>
                                <div className="border rounded-md p-2 max-h-[200px] overflow-y-auto space-y-1">
                                  {cachedTags[deptActiveConfigId]
                                    ?.filter((tag) =>
                                      tag.value
                                        .toLowerCase()
                                        .includes(
                                          (
                                            deptQuickSelectorSearchTerm1[deptActiveConfigId] || ''
                                          ).toLowerCase()
                                        )
                                    )
                                    .map((tag) => {
                                      const isSelected = (
                                        deptQuickTagSelector1[deptActiveConfigId] || []
                                      ).some((t) => t.id === tag.id)
                                      return (
                                        <label
                                          key={tag.id}
                                          className={`flex items-center space-x-2 cursor-pointer p-1.5 rounded hover:bg-accent transition-colors ${
                                            isSelected ? 'bg-accent/50' : ''
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() =>
                                              toggleDeptQuickSelectorTag(deptActiveConfigId, 1, tag)
                                            }
                                            className="w-4 h-4"
                                          />
                                          <span
                                            className="text-xs truncate flex-1"
                                            title={tag.value}
                                          >
                                            {tag.value}
                                          </span>
                                        </label>
                                      )
                                    })}
                                  {(!cachedTags[deptActiveConfigId] ||
                                    cachedTags[deptActiveConfigId].filter((tag) =>
                                      tag.value
                                        .toLowerCase()
                                        .includes(
                                          (
                                            deptQuickSelectorSearchTerm1[deptActiveConfigId] || ''
                                          ).toLowerCase()
                                        )
                                    ).length === 0) && (
                                    <div className="text-xs text-muted-foreground text-center py-2">
                                      未找到标签
                                    </div>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  已选: {(deptQuickTagSelector1[deptActiveConfigId] || []).length}
                                </div>
                              </div>

                              {/* 选择投放类型 */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium">选择投放类型</label>
                                <div className="relative">
                                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="搜索标签..."
                                    value={deptQuickSelectorSearchTerm2[deptActiveConfigId] || ''}
                                    onChange={(e) =>
                                      setDeptQuickSelectorSearchTerm2((prev) => ({
                                        ...prev,
                                        [deptActiveConfigId]: e.target.value
                                      }))
                                    }
                                    className="pl-8 h-9 text-sm"
                                  />
                                </div>
                                <div className="border rounded-md p-2 max-h-[200px] overflow-y-auto space-y-1">
                                  {cachedTags[deptActiveConfigId]
                                    ?.filter((tag) =>
                                      tag.value
                                        .toLowerCase()
                                        .includes(
                                          (
                                            deptQuickSelectorSearchTerm2[deptActiveConfigId] || ''
                                          ).toLowerCase()
                                        )
                                    )
                                    .map((tag) => {
                                      const isSelected = (
                                        deptQuickTagSelector2[deptActiveConfigId] || []
                                      ).some((t) => t.id === tag.id)
                                      return (
                                        <label
                                          key={tag.id}
                                          className={`flex items-center space-x-2 cursor-pointer p-1.5 rounded hover:bg-accent transition-colors ${
                                            isSelected ? 'bg-accent/50' : ''
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() =>
                                              toggleDeptQuickSelectorTag(deptActiveConfigId, 2, tag)
                                            }
                                            className="w-4 h-4"
                                          />
                                          <span
                                            className="text-xs truncate flex-1"
                                            title={tag.value}
                                          >
                                            {tag.value}
                                          </span>
                                        </label>
                                      )
                                    })}
                                  {(!cachedTags[deptActiveConfigId] ||
                                    cachedTags[deptActiveConfigId].filter((tag) =>
                                      tag.value
                                        .toLowerCase()
                                        .includes(
                                          (
                                            deptQuickSelectorSearchTerm2[deptActiveConfigId] || ''
                                          ).toLowerCase()
                                        )
                                    ).length === 0) && (
                                    <div className="text-xs text-muted-foreground text-center py-2">
                                      未找到标签
                                    </div>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  已选: {(deptQuickTagSelector2[deptActiveConfigId] || []).length}
                                </div>
                              </div>

                              {/* 选择出价类型 */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium">选择出价类型</label>
                                <div className="relative">
                                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="搜索标签..."
                                    value={deptQuickSelectorSearchTerm3[deptActiveConfigId] || ''}
                                    onChange={(e) =>
                                      setDeptQuickSelectorSearchTerm3((prev) => ({
                                        ...prev,
                                        [deptActiveConfigId]: e.target.value
                                      }))
                                    }
                                    className="pl-8 h-9 text-sm"
                                  />
                                </div>
                                <div className="border rounded-md p-2 max-h-[200px] overflow-y-auto space-y-1">
                                  {cachedTags[deptActiveConfigId]
                                    ?.filter((tag) =>
                                      tag.value
                                        .toLowerCase()
                                        .includes(
                                          (
                                            deptQuickSelectorSearchTerm3[deptActiveConfigId] || ''
                                          ).toLowerCase()
                                        )
                                    )
                                    .map((tag) => {
                                      const isSelected = (
                                        deptQuickTagSelector3[deptActiveConfigId] || []
                                      ).some((t) => t.id === tag.id)
                                      return (
                                        <label
                                          key={tag.id}
                                          className={`flex items-center space-x-2 cursor-pointer p-1.5 rounded hover:bg-accent transition-colors ${
                                            isSelected ? 'bg-accent/50' : ''
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() =>
                                              toggleDeptQuickSelectorTag(deptActiveConfigId, 3, tag)
                                            }
                                            className="w-4 h-4"
                                          />
                                          <span
                                            className="text-xs truncate flex-1"
                                            title={tag.value}
                                          >
                                            {tag.value}
                                          </span>
                                        </label>
                                      )
                                    })}
                                  {(!cachedTags[deptActiveConfigId] ||
                                    cachedTags[deptActiveConfigId].filter((tag) =>
                                      tag.value
                                        .toLowerCase()
                                        .includes(
                                          (
                                            deptQuickSelectorSearchTerm3[deptActiveConfigId] || ''
                                          ).toLowerCase()
                                        )
                                    ).length === 0) && (
                                    <div className="text-xs text-muted-foreground text-center py-2">
                                      未找到标签
                                    </div>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  已选: {(deptQuickTagSelector3[deptActiveConfigId] || []).length}
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-end pt-2 border-t">
                              <Button
                                type="button"
                                onClick={() => generateDeptQuickTagGroups(deptActiveConfigId)}
                                disabled={
                                  !deptActiveConfigId ||
                                  (deptQuickTagSelector1[deptActiveConfigId] || []).length === 0
                                }
                                size="sm"
                              >
                                <Plus className="mr-2 w-4 h-4" />
                                生成标签组
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* 标签组列表 */}
                    {deptActiveConfigId && (
                      <div className="mt-4">
                        <div className="grid gap-2">
                          <div className="flex items-center justify-between">
                            <Label>标签组列表</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const baseTime = Date.now()
                                const newGroup: TagGroup = {
                                  id: `group_${baseTime}_${Math.random().toString(36).substr(2, 9)}`,
                                  name: '新标签组',
                                  tags: []
                                }
                                setDeptTagGroupsMap((prev) => ({
                                  ...prev,
                                  [deptActiveConfigId]: [
                                    ...(prev[deptActiveConfigId] || []),
                                    newGroup
                                  ]
                                }))
                              }}
                              disabled={isSubmitting}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              手动添加组
                            </Button>
                          </div>
                          {!deptTagGroupsMap[deptActiveConfigId] ||
                          deptTagGroupsMap[deptActiveConfigId].length === 0 ? (
                            <div className="border-2 border-dashed rounded-md p-8 text-center text-muted-foreground text-sm">
                              请使用快速组合标签或手动添加标签组
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                              {deptTagGroupsMap[deptActiveConfigId].map((group, groupIndex) => {
                                const availableTags = cachedTags[deptActiveConfigId] || []
                                return (
                                  <div
                                    key={group.id}
                                    className="border rounded-md p-3 bg-card flex flex-col"
                                  >
                                    <div className="flex items-center justify-between mb-2 gap-2">
                                      <Input
                                        className="flex-1 text-sm"
                                        value={group.name}
                                        onChange={(e) => {
                                          const newGroups = [
                                            ...(deptTagGroupsMap[deptActiveConfigId] || [])
                                          ]
                                          newGroups[groupIndex] = { ...group, name: e.target.value }
                                          setDeptTagGroupsMap((prev) => ({
                                            ...prev,
                                            [deptActiveConfigId]: newGroups
                                          }))
                                        }}
                                        placeholder="标签组名称"
                                        disabled={isSubmitting}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const newGroups = (
                                            deptTagGroupsMap[deptActiveConfigId] || []
                                          ).filter((_, i) => i !== groupIndex)
                                          setDeptTagGroupsMap((prev) => ({
                                            ...prev,
                                            [deptActiveConfigId]: newGroups
                                          }))
                                        }}
                                        disabled={isSubmitting}
                                        className="text-destructive hover:text-destructive flex-shrink-0"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                    <div className="space-y-2 flex-1 flex flex-col">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full justify-between text-xs"
                                            disabled={isSubmitting}
                                          >
                                            <span className="truncate">
                                              {group.tags.length > 0
                                                ? `已选 ${group.tags.length} 个标签`
                                                : '选择标签...'}
                                            </span>
                                            <Plus className="w-3 h-3 ml-1 flex-shrink-0" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-56 max-h-60 overflow-y-auto">
                                          <DropdownMenuLabel>
                                            选择标签（同时满足）
                                          </DropdownMenuLabel>
                                          <DropdownMenuSeparator />
                                          {availableTags.map((tag) => (
                                            <DropdownMenuCheckboxItem
                                              key={tag.id}
                                              checked={group.tags.some((t) => t.id === tag.id)}
                                              onCheckedChange={(checked) => {
                                                const newGroups = [
                                                  ...(deptTagGroupsMap[deptActiveConfigId] || [])
                                                ]
                                                if (checked) {
                                                  newGroups[groupIndex] = {
                                                    ...group,
                                                    tags: [...group.tags, tag]
                                                  }
                                                } else {
                                                  newGroups[groupIndex] = {
                                                    ...group,
                                                    tags: group.tags.filter((t) => t.id !== tag.id)
                                                  }
                                                }
                                                setDeptTagGroupsMap((prev) => ({
                                                  ...prev,
                                                  [deptActiveConfigId]: newGroups
                                                }))
                                              }}
                                            >
                                              {tag.value}
                                            </DropdownMenuCheckboxItem>
                                          ))}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                      {group.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-auto">
                                          {group.tags.map((tag) => (
                                            <span
                                              key={tag.id}
                                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary"
                                            >
                                              <span
                                                className="truncate max-w-[60px]"
                                                title={tag.value}
                                              >
                                                {tag.value}
                                              </span>
                                              <XCircle
                                                className="w-2.5 h-2.5 ml-1 cursor-pointer hover:text-destructive flex-shrink-0"
                                                onClick={() => {
                                                  const newGroups = [
                                                    ...(deptTagGroupsMap[deptActiveConfigId] || [])
                                                  ]
                                                  newGroups[groupIndex] = {
                                                    ...group,
                                                    tags: group.tags.filter((t) => t.id !== tag.id)
                                                  }
                                                  setDeptTagGroupsMap((prev) => ({
                                                    ...prev,
                                                    [deptActiveConfigId]: newGroups
                                                  }))
                                                }}
                                              />
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 附加统计标签 */}
                    {deptActiveConfigId && (
                      <div className="mt-4">
                        <Card className="border-2 border-dashed border-primary/30">
                          <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-base">附加统计标签</CardTitle>
                            <CardDescription className="text-xs">
                              选择用于附加统计的标签，这些标签将单独统计并显示在总计前面
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="p-4 pt-2">
                            <div className="min-h-[60px] max-h-[120px] overflow-y-auto border rounded-md p-2 bg-background">
                              {(deptAdditionalTagGroupsMap[deptActiveConfigId] || []).length ===
                              0 ? (
                                <div className="flex justify-center items-center h-full text-xs text-muted-foreground">
                                  未选择附加标签
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {(deptAdditionalTagGroupsMap[deptActiveConfigId] || []).map(
                                    (tag) => (
                                      <div
                                        key={tag.id}
                                        className="flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors max-w-full"
                                      >
                                        <span className="truncate max-w-[100px]" title={tag.value}>
                                          {tag.value}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDeptAdditionalTagGroupsMap((prev) => ({
                                              ...prev,
                                              [deptActiveConfigId]: (
                                                prev[deptActiveConfigId] || []
                                              ).filter((t) => t.id !== tag.id)
                                            }))
                                          }}
                                          className="ml-0.5 text-muted-foreground hover:text-foreground shrink-0"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex justify-end mt-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full h-8 text-xs"
                                onClick={() => {
                                  setDeptActiveGroupId('additional_tags')
                                  setDeptSearchTerm('')
                                }}
                                disabled={isSubmitting}
                              >
                                <Edit className="w-3 h-3 mr-1.5" />
                                选择附加标签 (
                                {(deptAdditionalTagGroupsMap[deptActiveConfigId] || []).length})
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : taskType === 'feishu_bitable_auto' ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  粘贴飞书多维表格链接即可识别表格；选择一个已 OAuth
                  的纵横组织；预检与创建可分别设置「每 N
                  分钟」执行（1～59），至少填一侧。提交后后端仍分别写入 bitable_preview /
                  bitable_create_ads。 投放接口使用 OAuth，不读取
                  Cookie；若账号下尚无巨量配置记录，请先在配置管理添加一条（仅用于满足定时任务记录）。
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="bitableTableUrl">飞书多维表格链接 *</Label>
                  <Input
                    id="bitableTableUrl"
                    value={bitableTableUrl}
                    onChange={(e) => setBitableTableUrl(e.target.value)}
                    placeholder="https://xxx.feishu.cn/base/xxxx?table=tblxxxx"
                    disabled={isSubmitting}
                  />
                  {bitableTableUrl.trim() && !parseBitableUrl(bitableTableUrl) && (
                    <p className="text-xs text-destructive">
                      链接无法识别，请包含 /base/ 与 ?table=
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>授权来源组织（单选）*</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void loadOceanTokens()}
                      disabled={isSubmitting || loadingOceanTokens}
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 mr-1 ${loadingOceanTokens ? 'animate-spin' : ''}`}
                      />
                      刷新
                    </Button>
                  </div>
                  {loadingOceanTokens ? (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      加载组织列表…
                    </p>
                  ) : uniqueBitableOrgTokens.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      暂无已授权组织，请前往{' '}
                      <Link
                        to="/config"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        配置管理 → 巨量 OAuth
                      </Link>{' '}
                      完成授权。
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 max-h-[220px] overflow-y-auto border rounded-md p-2">
                      {uniqueBitableOrgTokens.map((t) => (
                        <label
                          key={t.advertiser_id}
                          className={`flex gap-2 items-center p-2 rounded-md border cursor-pointer text-sm ${
                            bitableSelectedOrgId === t.advertiser_id
                              ? 'border-primary/60 bg-primary/5'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="bitableOrg"
                            className="accent-primary shrink-0"
                            checked={bitableSelectedOrgId === t.advertiser_id}
                            onChange={() => setBitableSelectedOrgId(t.advertiser_id)}
                            disabled={isSubmitting}
                          />
                          <span className="min-w-0">
                            <span className="font-medium block truncate">
                              {t.advertiser_name || t.advertiser_id}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono truncate block">
                              {t.advertiser_id}
                            </span>
                            {t.appCodes.length > 1 ? (
                              <span className="text-xs text-muted-foreground truncate block mt-0.5">
                                多应用已授权：{t.appCodes.join('、')}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="bitablePreviewInterval">预检：每 N 分钟</Label>
                    <Input
                      id="bitablePreviewInterval"
                      type="number"
                      min={1}
                      max={59}
                      value={bitablePreviewIntervalMinutes}
                      onChange={(e) => setBitablePreviewIntervalMinutes(e.target.value)}
                      placeholder="留空表示不创建预检定时任务"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bitableCreateInterval">创建广告：每 N 分钟</Label>
                    <Input
                      id="bitableCreateInterval"
                      type="number"
                      min={1}
                      max={59}
                      value={bitableCreateIntervalMinutes}
                      onChange={(e) => setBitableCreateIntervalMinutes(e.target.value)}
                      placeholder="留空表示不创建创建侧定时任务"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bitableNotify">飞书通知接收方 ID（可选）</Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    用户填 open_id（ou_…）；群组填会话 chat_id（oc_…），并将飞书机器人拉入该群。
                  </p>
                  <Input
                    id="bitableNotify"
                    value={bitableNotifyOpenId}
                    onChange={(e) => setBitableNotifyOpenId(e.target.value)}
                    placeholder="ou_… 或 oc_…，预检/执行完成后推送卡片"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bitableAppUrl">
                    表格链接 app_url（可选，用于创建任务结果卡片）
                  </Label>
                  <Input
                    id="bitableAppUrl"
                    value={bitableAppUrl}
                    onChange={(e) => setBitableAppUrl(e.target.value)}
                    placeholder="不填则可在保存后使用上方表格链接"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            ) : taskType === 'auto_ad_control' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 左侧：目标账户配置 */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-semibold">1. 选择目标账户及标签</Label>
                    <div className="flex gap-2">
                      <span className="text-xs text-muted-foreground">
                        已选 {selectedConfigIds.length} 个账户
                      </span>
                    </div>
                  </div>

                  <div className="h-[400px] overflow-y-auto p-1">
                    {configs.length === 0 ? (
                      <div className="flex justify-center items-center h-full text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                        暂无可用账户
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {configs.map((config) => {
                          const isSelected = selectedConfigIds.includes(config.id)
                          const selectedTagIds = targetSettings[config.id] || []
                          const availableTagsForConfig = cachedTags[config.id] || []
                          const isLoadingTags = loadingTagsFor === config.id
                          // Convert tag IDs to tag values for display
                          const tags = selectedTagIds.map((tagId) => {
                            const tag = availableTagsForConfig.find((t) => t.id === tagId)
                            return tag ? tag.value : tagId
                          })

                          return (
                            <div
                              key={config.id}
                              className={`relative p-3 border rounded-md cursor-pointer transition-all flex flex-col gap-2 ${
                                isSelected
                                  ? 'shadow-sm border-primary bg-primary/5'
                                  : 'border-border hover:border-primary/50 hover:bg-accent/50'
                              }`}
                              onClick={(e) => {
                                // Prevent toggling when clicking dropdown triggers or tags
                                const target = e.target as HTMLElement
                                if (target.closest('[data-no-toggle]')) return
                                // Also check if clicking on button or interactive elements
                                if (target.closest('button') || target.closest('[role="menuitem"]'))
                                  return
                                toggleConfigSelection(config.id, !isSelected)
                              }}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex flex-1 gap-2 items-center min-w-0">
                                  <div
                                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 ${
                                      isSelected
                                        ? 'border-primary bg-primary'
                                        : 'border-muted-foreground/30'
                                    }`}
                                  >
                                    {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div
                                      className="text-sm font-medium truncate"
                                      title={config.cookie_name}
                                    >
                                      {config.cookie_name}
                                    </div>
                                    {config.realname && (
                                      <div className="text-xs truncate text-muted-foreground">
                                        {config.realname}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {isSelected && (
                                <div
                                  className="mt-1 pt-2 border-t border-border/50"
                                  data-no-toggle="true"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <DropdownMenu
                                    onOpenChange={(open) => {
                                      if (open) {
                                        handleLoadTags(config.id)
                                      }
                                    }}
                                  >
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs w-full justify-between hover:bg-primary/10 px-1"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <span className="truncate text-muted-foreground">
                                          {selectedTagIds.length > 0
                                            ? `已选 ${selectedTagIds.length} 个标签`
                                            : '选择标签...'}
                                        </span>
                                        <Plus className="w-3 h-3 ml-1 opacity-50" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      className="w-56 max-h-60 overflow-y-auto"
                                      align="start"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <DropdownMenuLabel>
                                        {isLoadingTags ? (
                                          <div className="flex items-center gap-2">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            加载标签中...
                                          </div>
                                        ) : (
                                          '选择标签 (同时满足)'
                                        )}
                                      </DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      {!isLoadingTags && availableTagsForConfig.length === 0 && (
                                        <div className="p-2 text-xs text-muted-foreground text-center">
                                          无可用标签
                                        </div>
                                      )}
                                      {availableTagsForConfig.map((tag) => (
                                        <DropdownMenuCheckboxItem
                                          key={tag.id}
                                          checked={selectedTagIds.includes(tag.id)}
                                          onCheckedChange={() =>
                                            toggleTagSelection(config.id, tag.id)
                                          }
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {tag.value}
                                        </DropdownMenuCheckboxItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  {selectedTagIds.length > 0 && (
                                    <div
                                      className="flex flex-wrap gap-1 mt-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {selectedTagIds.slice(0, 3).map((tagId) => {
                                        const tag = availableTagsForConfig.find(
                                          (t) => t.id === tagId
                                        )
                                        const tagValue = tag ? tag.value : tagId
                                        return (
                                          <span
                                            key={tagId}
                                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-background border shadow-sm"
                                          >
                                            <span className="truncate max-w-[60px]">
                                              {tagValue}
                                            </span>
                                            <XCircle
                                              className="w-3 h-3 ml-1 cursor-pointer hover:text-destructive"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                toggleTagSelection(config.id, tagId)
                                              }}
                                            />
                                          </span>
                                        )
                                      })}
                                      {selectedTagIds.length > 3 && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                                          +{selectedTagIds.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 右侧：规则配置 */}
                <div className="space-y-6">
                  <div className="bg-card rounded-lg border shadow-sm h-full flex flex-col">
                    <div className="p-4 border-b bg-muted/10">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Filter className="w-4 h-4 text-primary" />
                        2. 触发条件
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">当满足以下所有条件时触发</p>
                    </div>
                    <div className="p-4 space-y-4 flex-1 overflow-y-auto min-h-[150px]">
                      {conditions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-md">
                          暂无触发条件，请添加
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {conditions.map((condition, index) => {
                            const isBetween = condition.operator === 'between'
                            const isActiveCost = condition.metric === 'active_cost'
                            return (
                              <div
                                key={index}
                                className="flex items-center gap-2 bg-muted/30 p-2 rounded-md flex-wrap"
                              >
                                <select
                                  className="h-8 px-2 text-sm border rounded bg-background min-w-[100px]"
                                  value={condition.metric}
                                  onChange={(e) => {
                                    const newMetric = e.target.value
                                    updateCondition(index, 'metric', newMetric)
                                    // 如果切换到非激活成本，且当前是 between，则改为 gte
                                    if (
                                      newMetric !== 'active_cost' &&
                                      condition.operator === 'between'
                                    ) {
                                      updateCondition(index, 'operator', 'gte')
                                    }
                                  }}
                                >
                                  <option value="stat_cost">消耗金额</option>
                                  <option value="convert_cnt">转化数</option>
                                  <option value="conversion_cost">转化成本</option>
                                  <option value="active_cost">激活成本</option>
                                </select>
                                <select
                                  className="h-8 px-2 text-sm border rounded bg-background w-[80px]"
                                  value={condition.operator}
                                  onChange={(e) => {
                                    const newOperator = e.target.value
                                    // 如果切换到 between 但当前指标不是激活成本，则不允许
                                    if (newOperator === 'between' && !isActiveCost) {
                                      return
                                    }
                                    updateCondition(index, 'operator', newOperator)
                                  }}
                                >
                                  <option value="gte">≥</option>
                                  <option value="lte">≤</option>
                                  {isActiveCost && <option value="between">介于</option>}
                                </select>
                                {isBetween ? (
                                  <>
                                    <Input
                                      type="number"
                                      className="h-8 flex-1 min-w-[100px]"
                                      placeholder="最小值"
                                      value={condition.value}
                                      onChange={(e) =>
                                        updateCondition(index, 'value', e.target.value)
                                      }
                                    />
                                    <span className="text-sm text-muted-foreground">至</span>
                                    <Input
                                      type="number"
                                      className="h-8 flex-1 min-w-[100px]"
                                      placeholder="最大值"
                                      value={condition.value2 || ''}
                                      onChange={(e) => {
                                        const newConditions = [...conditions]
                                        newConditions[index] = {
                                          ...newConditions[index],
                                          value2: e.target.value
                                        }
                                        setConditions(newConditions)
                                      }}
                                    />
                                  </>
                                ) : (
                                  <Input
                                    type="number"
                                    className="h-8 flex-1"
                                    placeholder="数值"
                                    value={condition.value}
                                    onChange={(e) =>
                                      updateCondition(index, 'value', e.target.value)
                                    }
                                  />
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeCondition(index)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-dashed"
                        onClick={addCondition}
                      >
                        <Plus className="w-3 h-3 mr-2" />
                        添加触发条件
                      </Button>
                    </div>

                    <div className="p-4 border-t bg-muted/10">
                      <h3 className="font-semibold flex items-center gap-2 mb-4">
                        <Clock className="w-4 h-4 text-primary" />
                        3. 执行计划
                      </h3>

                      <div className="space-y-4">
                        <div className="grid gap-2">
                          <Label>执行类型</Label>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="actionType"
                                value="enable"
                                checked={actionType === 'enable'}
                                onChange={(e) => setActionType(e.target.value as 'enable')}
                                className="accent-primary"
                              />
                              <span className="text-sm">开启广告 (Open)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="actionType"
                                value="disable"
                                checked={actionType === 'disable'}
                                onChange={(e) => setActionType(e.target.value as 'disable')}
                                className="accent-primary"
                              />
                              <span className="text-sm">关闭广告 (Close)</span>
                            </label>
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="checkInterval">定时时间 (分钟)</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="checkInterval"
                              type="number"
                              min="1"
                              value={checkInterval}
                              onChange={(e) => setCheckInterval(e.target.value)}
                              placeholder="5"
                              className="w-full"
                            />
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              分钟
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">每隔 N 分钟执行一次检查</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="config">账号配置 *</Label>
                  <select
                    id="config"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={selectedConfigId || ''}
                    onChange={(e) => setSelectedConfigId(parseInt(e.target.value))}
                    disabled={isSubmitting}
                  >
                    <option value="">请选择账号配置</option>
                    {configs.map((config) => (
                      <option key={config.id} value={config.id}>
                        {config.cookie_name} {config.realname && `(${config.realname})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="cronExpression">Cron表达式 *</Label>
                  <Input
                    id="cronExpression"
                    placeholder="例如: 0 0 * * * (每天0点执行)"
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    格式: 分 时 日 月 周，例如: 0 0 * * * 表示每天0点执行
                  </p>
                </div>
              </div>
            )}

            {/* 禁止执行的时间段配置 */}
            <div className="grid gap-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">禁止执行的时间段</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBlockedTimeRanges([...blockedTimeRanges, { start_hour: 0, end_hour: 6 }])
                  }}
                  disabled={isSubmitting}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  添加时间段
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                设置禁止执行的时间段，例如：0-6点、23-24点不执行任务
              </p>
              {blockedTimeRanges.length > 0 && (
                <div className="space-y-2">
                  {blockedTimeRanges.map((range, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-3 border rounded-md bg-card"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <Label className="text-sm whitespace-nowrap">开始时间：</Label>
                        <select
                          className="px-2 py-1 border rounded-md bg-background text-sm"
                          value={range.start_hour}
                          onChange={(e) => {
                            const newRanges = [...blockedTimeRanges]
                            newRanges[index].start_hour = parseInt(e.target.value)
                            setBlockedTimeRanges(newRanges)
                          }}
                          disabled={isSubmitting}
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>
                              {i}点
                            </option>
                          ))}
                        </select>
                        <Label className="text-sm whitespace-nowrap">结束时间：</Label>
                        <select
                          className="px-2 py-1 border rounded-md bg-background text-sm"
                          value={range.end_hour}
                          onChange={(e) => {
                            const newRanges = [...blockedTimeRanges]
                            newRanges[index].end_hour = parseInt(e.target.value)
                            setBlockedTimeRanges(newRanges)
                          }}
                          disabled={isSubmitting}
                        >
                          {Array.from({ length: 25 }, (_, i) => (
                            <option key={i} value={i}>
                              {i === 24 ? '24点（次日0点）' : `${i}点`}
                            </option>
                          ))}
                        </select>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({range.start_hour}点 -{' '}
                          {range.end_hour === 24 ? '次日0点' : `${range.end_hour}点`})
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBlockedTimeRanges(blockedTimeRanges.filter((_, i) => i !== index))
                        }}
                        disabled={isSubmitting}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {blockedTimeRanges.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  未设置禁止执行的时间段，任务将在所有时间执行
                </p>
              )}
            </div>

            {error && (
              <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false)
                resetForm()
              }}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  {editingTaskId ? '更新中...' : '创建中...'}
                </>
              ) : (
                <>
                  {editingTaskId ? (
                    <>
                      <Edit2 className="mr-2 w-4 h-4" />
                      确认更新
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 w-4 h-4" />
                      确认创建
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 选择附加标签对话框（部门版） */}
      <Dialog
        open={deptActiveGroupId === 'additional_tags'}
        onOpenChange={(open) => !open && setDeptActiveGroupId(null)}
      >
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>选择附加统计标签</DialogTitle>
            <DialogDescription>
              选择用于附加统计的标签，这些标签将单独统计并显示在总计前面
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col flex-1 space-y-4 min-h-0">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索标签..."
                value={deptSearchTerm}
                onChange={(e) => setDeptSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* 全选/取消全选 */}
            {deptActiveConfigId && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  已选择 {(deptAdditionalTagGroupsMap[deptActiveConfigId] || []).length} 个标签
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (deptActiveConfigId) {
                      const allTags = cachedTags[deptActiveConfigId] || []
                      const currentTags = deptAdditionalTagGroupsMap[deptActiveConfigId] || []
                      const allSelected = allTags.every((tag) =>
                        currentTags.some((t) => t.id === tag.id)
                      )
                      if (allSelected) {
                        setDeptAdditionalTagGroupsMap((prev) => ({
                          ...prev,
                          [deptActiveConfigId]: []
                        }))
                      } else {
                        setDeptAdditionalTagGroupsMap((prev) => ({
                          ...prev,
                          [deptActiveConfigId]: allTags
                        }))
                      }
                    }
                  }}
                >
                  {deptActiveConfigId &&
                  (cachedTags[deptActiveConfigId] || []).every((tag) =>
                    (deptAdditionalTagGroupsMap[deptActiveConfigId] || []).some(
                      (t) => t.id === tag.id
                    )
                  )
                    ? '取消全选'
                    : '全选'}
                </Button>
              </div>
            )}

            {/* 标签列表 */}
            <div className="flex-1 overflow-y-auto border rounded-md p-4">
              {deptActiveConfigId && cachedTags[deptActiveConfigId] ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {cachedTags[deptActiveConfigId]
                    .filter((tag) => tag.value.toLowerCase().includes(deptSearchTerm.toLowerCase()))
                    .map((tag) => {
                      const isSelected = (
                        deptAdditionalTagGroupsMap[deptActiveConfigId] || []
                      ).some((t) => t.id === tag.id)
                      return (
                        <label
                          key={tag.id}
                          className={`flex items-center space-x-2 cursor-pointer p-2 rounded-md border transition-colors ${
                            isSelected
                              ? 'bg-primary/10 border-primary text-primary'
                              : 'hover:bg-accent border-border'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (deptActiveConfigId) {
                                const currentTags =
                                  deptAdditionalTagGroupsMap[deptActiveConfigId] || []
                                const isTagSelected = currentTags.some((t) => t.id === tag.id)
                                if (isTagSelected) {
                                  setDeptAdditionalTagGroupsMap((prev) => ({
                                    ...prev,
                                    [deptActiveConfigId]: currentTags.filter((t) => t.id !== tag.id)
                                  }))
                                } else {
                                  setDeptAdditionalTagGroupsMap((prev) => ({
                                    ...prev,
                                    [deptActiveConfigId]: [...currentTags, tag]
                                  }))
                                }
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm truncate flex-1" title={tag.value}>
                            {tag.value}
                          </span>
                        </label>
                      )
                    })}
                </div>
              ) : (
                <div className="flex justify-center items-center h-full text-muted-foreground">
                  请先选择账户并加载标签
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptActiveGroupId(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 执行日志查看对话框 */}
      <Dialog open={isLogsDialogOpen} onOpenChange={setIsLogsDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>执行日志</DialogTitle>
            <DialogDescription>
              {viewingTaskId && tasks.find((t) => t.id === viewingTaskId)?.name && (
                <>
                  查看任务 &ldquo;{tasks.find((t) => t.id === viewingTaskId)?.name}&rdquo;
                  的执行历史记录
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {logsLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : executionLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>暂无执行记录</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {executionLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 rounded-lg border bg-card hover:border-primary/50 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          {getExecutionStatusBadge(log.execution_status)}
                          <span className="text-sm text-muted-foreground">
                            {formatDate(log.start_time)}
                          </span>
                        </div>
                        {log.duration_seconds !== null && (
                          <span className="text-xs text-muted-foreground">
                            耗时: {log.duration_seconds.toFixed(1)}s
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">目标账户</div>
                          <div className="font-medium">{log.total_targets}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">找到广告</div>
                          <div className="font-medium">{log.total_ads_found}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">成功</div>
                          <div className="font-medium text-green-600">{log.total_success}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">失败</div>
                          <div className="font-medium text-red-600">{log.total_failed}</div>
                        </div>
                      </div>

                      {/* 显示账户级别的明细 */}
                      {log.details && log.details.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-border/50">
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            账户执行明细
                          </div>
                          <div className="space-y-2">
                            {log.details.map((detail) => (
                              <div key={detail.id} className="p-2 bg-muted/30 rounded text-xs">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium">
                                    {detail.config_name || `配置 ${detail.config_id}`}
                                  </span>
                                  <span className="text-muted-foreground">
                                    成功:{' '}
                                    <span className="text-green-600">{detail.success_count}</span> /
                                    失败:{' '}
                                    <span className="text-red-600">{detail.failed_count}</span>
                                  </span>
                                </div>
                                {/* 显示成功的广告ID */}
                                {detail.success_ad_ids && detail.success_ad_ids.length > 0 && (
                                  <div className="mt-1">
                                    <span className="text-muted-foreground">成功广告ID: </span>
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                      {detail.success_ad_ids.map((adId) => (
                                        <span
                                          key={adId}
                                          className="px-1.5 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded text-[10px] font-mono"
                                        >
                                          {adId}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {/* 显示失败的广告ID */}
                                {detail.failed_ad_ids && detail.failed_ad_ids.length > 0 && (
                                  <div className="mt-1">
                                    <span className="text-muted-foreground">失败广告ID: </span>
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                      {detail.failed_ad_ids.map((adId) => (
                                        <span
                                          key={adId}
                                          className="px-1.5 py-0.5 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded text-[10px] font-mono"
                                        >
                                          {adId}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {detail.error_message && (
                                  <div className="mt-1 text-red-600 text-[10px]">
                                    错误: {detail.error_message}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 显示广告级别的明细（如果存在） */}
                      {log.ad_details && log.ad_details.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-border/50">
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            广告执行明细
                          </div>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {log.ad_details.map((ad) => (
                              <div
                                key={ad.id}
                                className="flex items-center justify-between p-1.5 bg-muted/20 rounded text-xs"
                              >
                                <span className="font-mono">{ad.promotion_id}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                                    ad.execution_status === 'success'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  }`}
                                >
                                  {ad.execution_status === 'success' ? '成功' : '失败'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {log.error_message && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="text-xs text-muted-foreground mb-1">错误信息</div>
                              <div className="text-sm text-red-600">{log.error_message}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {log.end_time && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          结束时间: {formatDate(log.end_time)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* 分页 */}
                {logsTotal > logsPageSize && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      共 {logsTotal} 条记录，第 {logsPage} / {Math.ceil(logsTotal / logsPageSize)}{' '}
                      页
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          viewingTaskId && loadExecutionLogs(viewingTaskId, logsPage - 1)
                        }
                        disabled={logsPage <= 1 || logsLoading}
                      >
                        上一页
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          viewingTaskId && loadExecutionLogs(viewingTaskId, logsPage + 1)
                        }
                        disabled={logsPage >= Math.ceil(logsTotal / logsPageSize) || logsLoading}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
