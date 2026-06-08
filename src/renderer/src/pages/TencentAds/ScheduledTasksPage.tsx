import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Loader2,
  Trash2,
  Edit2,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  User,
  Users,
  Tag,
  Settings,
  FileText,
  X,
  Check,
  Rocket,
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
  Textarea,
  RadioGroup,
  RadioGroupItem
} from '../../components/ui'
import {
  scheduledTaskService,
  organizationListService,
  type OrganizationItem
} from '../../services/tencent-ads.service'
import { configService } from '../../services/config.service'
import { dataAssistantConfigService } from '../../services/ocean-engine.service'
import { toast } from 'sonner'

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
  success_item_ids?: string[] | null
  success_item_id_type?: string | null
  error_message: string | null
  created_at: string
}

interface Condition {
  id: string
  metric: string
  operator: string
  value1: string
  value2: string
}

interface AccountGroup {
  id: string
  name: string
  accountsText: string
}

interface DataControlGroupConfig {
  groups: AccountGroup[]
  selectedGroupIds: string[]
}

const createDefaultCondition = (): Condition => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  metric: 'cost',
  operator: 'gte',
  value1: '',
  value2: ''
})

const normalizeDataControlGroups = (raw: any): Record<string, DataControlGroupConfig> => {
  if (!raw || typeof raw !== 'object') return {}
  const normalized: Record<string, DataControlGroupConfig> = {}
  Object.keys(raw).forEach((key) => {
    const value = raw[key] || {}
    const groups = Array.isArray(value.groups) ? value.groups : []
    const selectedGroupIds = Array.isArray(value.selected_group_ids || value.selectedGroupIds)
      ? value.selected_group_ids || value.selectedGroupIds
      : []
    normalized[key] = {
      groups: groups.map((group: any) => ({
        id: String(group.id || ''),
        name: String(group.name || '未命名分组'),
        accountsText: String(group.accountsText || group.accounts_text || '')
      })),
      selectedGroupIds: selectedGroupIds.map((id: any) => String(id))
    }
  })
  return normalized
}

export const TencentAdsScheduledTasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false)
  const [viewingTaskId, setViewingTaskId] = useState<number | null>(null)
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsPage, setLogsPage] = useState(1)
  const [logsTotal, setLogsTotal] = useState(0)
  const logsPageSize = 20
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [taskName, setTaskName] = useState('')
  const [taskType, setTaskType] = useState('data_control')
  const [cronExpression, setCronExpression] = useState('')
  const [error, setError] = useState('')

  // 数据助手报表任务配置
  const [reportType, setReportType] = useState<'时报' | '日报'>('时报')
  const [scheduleHour, setScheduleHour] = useState<number>(0) // 小时（0-23）
  const [scheduleMinute, setScheduleMinute] = useState<number>(5) // 分钟（0-59）
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(false)
  interface OrganizationGroup {
    id: string
    name: string
    businessIds: number[]
  }
  interface OperatorGroup {
    id: string
    name: string
    tags: string[]
  }
  const [organizationGroups, setOrganizationGroups] = useState<OrganizationGroup[]>([])
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState<string>('')
  const [groupSearchKeywords, setGroupSearchKeywords] = useState<Record<string, string>>({})
  const [useTagGrouping, setUseTagGrouping] = useState(true)
  const [tagText, setTagText] = useState('纯短剧\n纯激励')
  const [useOperatorDimension, setUseOperatorDimension] = useState(false)
  const [operatorGroups, setOperatorGroups] = useState<OperatorGroup[]>([])
  const [editingOperatorGroupId, setEditingOperatorGroupId] = useState<string | null>(null)
  const [editingOperatorGroupName, setEditingOperatorGroupName] = useState<string>('')
  const [editingOperatorGroupTags, setEditingOperatorGroupTags] = useState<string>('')
  const [chatId, setChatId] = useState('oc_7fc46dcc7187bc1ed2f95c1544e32b10')
  const [sendAsImage, setSendAsImage] = useState(false)

  // 禁止执行的时间段配置
  const [blockedTimeRanges, setBlockedTimeRanges] = useState<
    Array<{ start_hour: number; end_hour: number }>
  >([])
  // 数据调控任务配置
  const [dataControlTab, setDataControlTab] = useState<'display' | 'smart' | 'search'>('display')
  const [dataControlAccountSource, setDataControlAccountSource] = useState<'group' | 'manual'>(
    'group'
  )
  const [dataControlAccountsText, setDataControlAccountsText] = useState('')
  const [dataControlDimension, setDataControlDimension] = useState<'ad' | 'creative'>('ad')
  const [dataControlConditions, setDataControlConditions] = useState<Condition[]>([
    createDefaultCondition()
  ])
  const [dataControlAction, setDataControlAction] = useState<'enable' | 'pause'>('pause')
  const [dataControlGroups, setDataControlGroups] = useState<
    Record<string, DataControlGroupConfig>
  >({})
  const [loadingDataControlGroups, setLoadingDataControlGroups] = useState(false)
  const [dataControlSelectedGroupIds, setDataControlSelectedGroupIds] = useState<string[]>([])
  const [dataControlIntervalMinutes, setDataControlIntervalMinutes] = useState<number>(30)

  // 定时一键起量任务配置
  const [autoAcquisitionAccountsText, setAutoAcquisitionAccountsText] = useState('')
  const [autoAcquisitionOperationType, setAutoAcquisitionOperationType] = useState<
    'enable' | 'disable'
  >('enable')
  const [autoAcquisitionLaunchAmount, setAutoAcquisitionLaunchAmount] = useState('')
  const [autoAcquisitionScheduleMode, setAutoAcquisitionScheduleMode] = useState<
    'interval' | 'daily'
  >('interval')
  const [autoAcquisitionIntervalHours, setAutoAcquisitionIntervalHours] = useState<number>(0)
  const [autoAcquisitionIntervalMinutes, setAutoAcquisitionIntervalMinutes] = useState<number>(30)
  const [autoAcquisitionDailyTimes, setAutoAcquisitionDailyTimes] = useState<
    Array<{ hour: number; minute: number }>
  >([{ hour: 9, minute: 0 }])

  useEffect(() => {
    loadConfigs()
    loadTasks()
  }, [])

  const loadConfigs = async () => {
    try {
      const tencentConfigs = await configService.getConfigsBySource(2)
      setConfigs(tencentConfigs)
      if (tencentConfigs.length > 0 && !selectedConfigId) {
        setSelectedConfigId(tencentConfigs[0].id)
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
    }
  }

  const loadTasks = async () => {
    setLoading(true)
    try {
      const response = await scheduledTaskService.getScheduledTasks({
        page: 1,
        page_size: 100
      })
      setTasks(response.items)
    } catch (err) {
      console.error('Failed to load tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleViewLogs = async (taskId: number) => {
    setViewingTaskId(taskId)
    setIsLogsDialogOpen(true)
    setLogsPage(1)
    await loadExecutionLogs(taskId, 1)
  }

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

  const handleCreate = async () => {
    if (!taskName) {
      setError('请填写任务名称')
      return
    }

    // 如果是数据助手报表任务，验证额外配置
    if (taskType === 'data_assistant_report') {
      if (!selectedConfigId) {
        setError('请选择账号配置')
        return
      }
      if (organizationGroups.length === 0) {
        setError('请至少创建一个组织分组')
        return
      }
      const emptyGroups = organizationGroups.filter((g) => g.businessIds.length === 0)
      if (emptyGroups.length > 0) {
        setError(`分组 "${emptyGroups[0].name}" 至少需要选择一个组织`)
        return
      }
      if (useOperatorDimension) {
        if (organizationGroups.length !== 1) {
          setError('投手维度仅支持一个组织分组')
          return
        }
        if (operatorGroups.length === 0) {
          setError('请至少创建一个投手分组')
          return
        }
        const emptyOperatorGroups = operatorGroups.filter((g) => g.tags.length === 0)
        if (emptyOperatorGroups.length > 0) {
          setError(`投手分组 "${emptyOperatorGroups[0].name}" 至少需要添加一个标签`)
          return
        }
      }
      if (!chatId.trim()) {
        setError('请输入飞书群组ID')
        return
      }
    } else if (taskType === 'data_control') {
      if (!selectedConfigId) {
        setError('请填写所有必填字段')
        return
      }
      if (dataControlAccountSource === 'manual' && !dataControlAccountsText.trim()) {
        setError('请输入账户列表')
        return
      }
      if (dataControlAccountSource === 'group' && dataControlSelectedGroupIds.length === 0) {
        setError('请选择至少一个分组')
        return
      }
      if (!dataControlIntervalMinutes || dataControlIntervalMinutes < 1) {
        setError('请设置执行间隔分钟数')
        return
      }
    } else if (taskType === 'auto_acquisition') {
      if (!selectedConfigId) {
        setError('请选择账号配置')
        return
      }
      const accountIdList = autoAcquisitionAccountsText
        .split('\n')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
      if (accountIdList.length === 0) {
        setError('请输入至少一个广告账户ID')
        return
      }
      if (autoAcquisitionOperationType === 'enable') {
        if (!autoAcquisitionLaunchAmount || autoAcquisitionLaunchAmount.trim() === '') {
          setError('开启一键起量时，起量金额为必填项')
          return
        }
        const amount = parseFloat(autoAcquisitionLaunchAmount)
        if (isNaN(amount) || amount < 200) {
          setError('起量金额最低为200元')
          return
        }
        if (amount > 100000) {
          setError('起量金额最高为100000元')
          return
        }
      }
      if (autoAcquisitionScheduleMode === 'interval') {
        const totalMinutes = autoAcquisitionIntervalHours * 60 + autoAcquisitionIntervalMinutes
        if (totalMinutes < 1) {
          setError('执行间隔至少为1分钟')
          return
        }
      } else {
        if (autoAcquisitionDailyTimes.length === 0) {
          setError('请至少添加一个执行时间')
          return
        }
      }
    }

    setIsSubmitting(true)
    setError('')
    try {
      // 构建task_config和cron表达式
      let finalCronExpression = cronExpression
      let taskConfig: Record<string, any> | null = null

      if (taskType === 'data_assistant_report') {
        // 根据报表类型和时间设置生成Cron表达式
        if (reportType === '日报') {
          finalCronExpression = `${scheduleMinute} ${scheduleHour} * * *` // 每天 scheduleHour:scheduleMinute 执行
        } else {
          finalCronExpression = `${scheduleMinute} * * * *` // 每小时的 scheduleMinute 分执行
        }

        taskConfig = {
          report_type: reportType,
          organization_groups: organizationGroups.map((group) => ({
            group_name: group.name,
            business_id_list: group.businessIds
          })),
          use_tag_grouping: useTagGrouping,
          tag_text: useTagGrouping ? tagText : '',
          use_operator_dimension: useOperatorDimension,
          operator_groups: useOperatorDimension
            ? operatorGroups.map((group) => ({
                name: group.name,
                tags: group.tags
              }))
            : undefined,
          chat_id: chatId.trim(),
          send_as_image: sendAsImage,
          blocked_time_ranges: blockedTimeRanges.length > 0 ? blockedTimeRanges : undefined
        }
      } else if (taskType === 'data_control') {
        finalCronExpression = `*/${dataControlIntervalMinutes} * * * *`
        taskConfig = {
          tab: dataControlTab,
          account_source: dataControlAccountSource,
          accounts_text:
            dataControlAccountSource === 'manual' ? dataControlAccountsText.trim() : '',
          selected_group_ids:
            dataControlAccountSource === 'group' ? dataControlSelectedGroupIds : [],
          dimension: dataControlDimension,
          conditions: dataControlConditions.map((condition) => ({
            metric: condition.metric,
            operator: condition.operator,
            value1: condition.value1 ? Number(condition.value1) : null,
            value2: condition.value2 ? Number(condition.value2) : null
          })),
          action: dataControlAction,
          blocked_time_ranges: blockedTimeRanges.length > 0 ? blockedTimeRanges : undefined
        }
      } else if (taskType === 'auto_acquisition') {
        const accountIdList = autoAcquisitionAccountsText
          .split('\n')
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
        if (autoAcquisitionScheduleMode === 'interval') {
          const totalMinutes = autoAcquisitionIntervalHours * 60 + autoAcquisitionIntervalMinutes
          finalCronExpression = '* * * * *'
          taskConfig = {
            account_ids: accountIdList,
            operation_type: autoAcquisitionOperationType,
            launch_amount:
              autoAcquisitionOperationType === 'enable'
                ? parseFloat(autoAcquisitionLaunchAmount)
                : undefined,
            schedule_mode: autoAcquisitionScheduleMode,
            schedule_interval_minutes: totalMinutes,
            blocked_time_ranges: blockedTimeRanges.length > 0 ? blockedTimeRanges : undefined
          }
        } else {
          finalCronExpression = '* * * * *'
          taskConfig = {
            account_ids: accountIdList,
            operation_type: autoAcquisitionOperationType,
            launch_amount:
              autoAcquisitionOperationType === 'enable'
                ? parseFloat(autoAcquisitionLaunchAmount)
                : undefined,
            schedule_mode: autoAcquisitionScheduleMode,
            schedule_times: autoAcquisitionDailyTimes,
            blocked_time_ranges: blockedTimeRanges.length > 0 ? blockedTimeRanges : undefined
          }
        }
      }

      if (editingTaskId) {
        // 更新任务
        await scheduledTaskService.updateScheduledTask(editingTaskId, {
          name: taskName,
          task_type: taskType,
          config_id: selectedConfigId!,
          cron_expression: finalCronExpression,
          task_config: taskConfig
        })
      } else {
        // 创建任务
        await scheduledTaskService.createScheduledTask({
          name: taskName,
          task_type: taskType,
          config_id: selectedConfigId!,
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
      setTaskType(
        taskDetail.task_type === 'data_assistant_report'
          ? 'data_assistant_report'
          : taskDetail.task_type === 'auto_acquisition'
            ? 'auto_acquisition'
            : 'data_control'
      )
      setSelectedConfigId(taskDetail.config_id)

      if (taskDetail.task_type === 'data_assistant_report') {
        // 加载配置列表
        await loadConfigs()

        const taskConfig = taskDetail.task_config as any
        if (taskConfig) {
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

          // 恢复组织分组
          if (taskConfig.organization_groups) {
            const groups: OrganizationGroup[] = taskConfig.organization_groups.map(
              (group: any, index: number) => ({
                id: `group_${Date.now()}_${index}`,
                name: group.group_name || `分组 ${index + 1}`,
                businessIds: group.business_id_list || []
              })
            )
            setOrganizationGroups(groups)
          }

          setUseTagGrouping(taskConfig.use_tag_grouping !== false)
          setTagText(taskConfig.tag_text || '纯短剧\n纯激励')
          setChatId(taskConfig.chat_id || 'oc_7fc46dcc7187bc1ed2f95c1544e32b10')
          setSendAsImage(taskConfig.send_as_image === true)

          // 恢复投手维度配置
          const operatorGroupsConfig = taskConfig.operator_groups || []
          if (Array.isArray(operatorGroupsConfig) && operatorGroupsConfig.length > 0) {
            const groups: OperatorGroup[] = operatorGroupsConfig.map(
              (group: any, index: number) => ({
                id: `operator_group_${Date.now()}_${index}`,
                name: group.name || `投手分组 ${index + 1}`,
                tags: Array.isArray(group.tags) ? group.tags : []
              })
            )
            setUseOperatorDimension(true)
            setOperatorGroups(groups)
          } else {
            setUseOperatorDimension(false)
            setOperatorGroups([])
          }

          // 恢复禁止执行的时间段
          if (taskConfig.blocked_time_ranges && Array.isArray(taskConfig.blocked_time_ranges)) {
            setBlockedTimeRanges(taskConfig.blocked_time_ranges)
          } else {
            setBlockedTimeRanges([])
          }

          // 加载组织列表
          await loadOrganizations()
        }
      } else if (taskDetail.task_type === 'data_control') {
        setCronExpression(taskDetail.cron_expression)
        const taskConfig = (taskDetail.task_config || {}) as any
        setDataControlTab(taskConfig.tab || 'display')
        setDataControlAccountSource(taskConfig.account_source === 'manual' ? 'manual' : 'group')
        setDataControlAccountsText(taskConfig.accounts_text || '')
        const selectedGroupIds = Array.isArray(taskConfig.selected_group_ids)
          ? taskConfig.selected_group_ids.map((id: any) => String(id))
          : []
        setDataControlSelectedGroupIds(selectedGroupIds)
        setDataControlDimension(taskConfig.dimension === 'creative' ? 'creative' : 'ad')
        const conditions = Array.isArray(taskConfig.conditions) ? taskConfig.conditions : []
        if (conditions.length > 0) {
          setDataControlConditions(
            conditions.map((condition: any) => ({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              metric: condition.metric || 'cost',
              operator: condition.operator || 'gte',
              value1: condition.value1 != null ? String(condition.value1) : '',
              value2: condition.value2 != null ? String(condition.value2) : ''
            }))
          )
        } else {
          setDataControlConditions([createDefaultCondition()])
        }
        setDataControlAction(taskConfig.action === 'enable' ? 'enable' : 'pause')
        const cronParts = taskDetail.cron_expression.trim().split(/\s+/)
        if (cronParts.length >= 1 && cronParts[0].startsWith('*/')) {
          const minutes = parseInt(cronParts[0].replace('*/', ''))
          if (!isNaN(minutes)) {
            setDataControlIntervalMinutes(minutes)
          }
        }
        if (taskConfig.blocked_time_ranges && Array.isArray(taskConfig.blocked_time_ranges)) {
          setBlockedTimeRanges(taskConfig.blocked_time_ranges)
        } else {
          setBlockedTimeRanges([])
        }
        await loadDataControlGroups()
      } else if (taskDetail.task_type === 'auto_acquisition') {
        const taskConfig = (taskDetail.task_config || {}) as any
        const accountIds = Array.isArray(taskConfig.account_ids) ? taskConfig.account_ids : []
        setAutoAcquisitionAccountsText(accountIds.join('\n'))
        setAutoAcquisitionOperationType(
          taskConfig.operation_type === 'disable' ? 'disable' : 'enable'
        )
        setAutoAcquisitionLaunchAmount(
          taskConfig.launch_amount != null ? String(taskConfig.launch_amount) : ''
        )
        const detectedScheduleMode = taskConfig.schedule_mode === 'daily' ? 'daily' : 'interval'
        setAutoAcquisitionScheduleMode(detectedScheduleMode)
        const scheduleTimes = taskConfig.schedule_times
        if (Array.isArray(scheduleTimes) && scheduleTimes.length > 0) {
          setAutoAcquisitionDailyTimes(
            scheduleTimes.map((t: { hour?: number; minute?: number }) => ({
              hour: t.hour ?? 0,
              minute: t.minute ?? 0
            }))
          )
        }
        const intervalMinutes = Number(taskConfig.schedule_interval_minutes)
        if (detectedScheduleMode === 'interval' && intervalMinutes > 0) {
          setAutoAcquisitionIntervalHours(Math.floor(intervalMinutes / 60))
          setAutoAcquisitionIntervalMinutes(intervalMinutes % 60)
        } else {
          const cronParts = taskDetail.cron_expression.trim().split(/\s+/)
          if (cronParts.length >= 1 && cronParts[0].startsWith('*/')) {
            const totalMinutes = parseInt(cronParts[0].replace('*/', ''))
            if (!isNaN(totalMinutes) && totalMinutes > 0) {
              setAutoAcquisitionIntervalHours(Math.floor(totalMinutes / 60))
              setAutoAcquisitionIntervalMinutes(totalMinutes % 60)
            }
          }
        }
        if (taskConfig.blocked_time_ranges && Array.isArray(taskConfig.blocked_time_ranges)) {
          setBlockedTimeRanges(taskConfig.blocked_time_ranges)
        } else {
          setBlockedTimeRanges([])
        }
      }

      // 打开对话框
      setIsDialogOpen(true)
    } catch (err: any) {
      console.error('Failed to load task detail:', err)
      toast.error(err.message || '加载任务详情失败')
    }
  }

  const resetForm = () => {
    setEditingTaskId(null)
    setTaskName('')
    setTaskType('data_control')
    setCronExpression('')
    setError('')
    setReportType('时报')
    setScheduleHour(0)
    setScheduleMinute(5)
    setOrganizationGroups([])
    setOrganizations([])
    setGroupSearchKeywords({})
    setUseTagGrouping(true)
    setTagText('纯短剧\n纯激励')
    setUseOperatorDimension(false)
    setOperatorGroups([])
    setEditingOperatorGroupId(null)
    setEditingOperatorGroupName('')
    setEditingOperatorGroupTags('')
    setChatId('oc_7fc46dcc7187bc1ed2f95c1544e32b10')
    setSendAsImage(false)
    setEditingGroupId(null)
    setEditingGroupName('')
    setBlockedTimeRanges([])
    setDataControlTab('display')
    setDataControlAccountSource('group')
    setDataControlAccountsText('')
    setDataControlDimension('ad')
    setDataControlConditions([createDefaultCondition()])
    setDataControlAction('pause')
    setDataControlGroups({})
    setDataControlSelectedGroupIds([])
    setDataControlIntervalMinutes(30)
    setAutoAcquisitionAccountsText('')
    setAutoAcquisitionOperationType('enable')
    setAutoAcquisitionLaunchAmount('')
    setAutoAcquisitionScheduleMode('interval')
    setAutoAcquisitionIntervalHours(0)
    setAutoAcquisitionIntervalMinutes(30)
    setAutoAcquisitionDailyTimes([{ hour: 9, minute: 0 }])
  }

  // 当选择配置或任务类型变化时，加载组织列表
  useEffect(() => {
    if (taskType === 'data_assistant_report' && selectedConfigId && isDialogOpen) {
      loadOrganizations()
    }
  }, [selectedConfigId, taskType, isDialogOpen])

  useEffect(() => {
    if (taskType === 'data_control' && selectedConfigId && isDialogOpen) {
      loadDataControlGroups()
    }
  }, [selectedConfigId, taskType, isDialogOpen])

  useEffect(() => {
    if (useOperatorDimension && organizationGroups.length !== 1) {
      setUseOperatorDimension(false)
    }
  }, [organizationGroups.length, useOperatorDimension])

  const getTaskTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      data_assistant_report: '数据助手报表',
      data_control: '数据调控',
      auto_acquisition: '定时一键起量'
    }
    return typeMap[type] || type
  }

  const loadDataControlGroups = async (): Promise<void> => {
    if (!selectedConfigId) {
      toast.error('请先选择配置')
      return
    }
    setLoadingDataControlGroups(true)
    try {
      const config = await dataAssistantConfigService.getConfig(selectedConfigId)
      const groupConfig = normalizeDataControlGroups(config.data_control_groups || {})
      setDataControlGroups(groupConfig)
      if (dataControlSelectedGroupIds.length === 0) {
        const defaultIds = groupConfig[dataControlTab]?.selectedGroupIds || []
        setDataControlSelectedGroupIds(defaultIds)
      }
    } catch (err: any) {
      console.error('Failed to load data control groups:', err)
      toast.error(err.message || '获取数据调控分组失败')
    } finally {
      setLoadingDataControlGroups(false)
    }
  }

  const addDataControlCondition = (): void => {
    setDataControlConditions((prev) => [...prev, createDefaultCondition()])
  }

  const updateDataControlCondition = (id: string, next: Partial<Condition>): void => {
    setDataControlConditions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...next } : item))
    )
  }

  const removeDataControlCondition = (id: string): void => {
    setDataControlConditions((prev) => prev.filter((item) => item.id !== id))
  }

  const toggleDataControlGroupSelection = (groupId: string, checked: boolean): void => {
    setDataControlSelectedGroupIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(groupId)
      } else {
        next.delete(groupId)
      }
      return Array.from(next)
    })
  }

  const getAccountCount = (text: string): number => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean).length
  }

  const getDataControlTabConfig = (): DataControlGroupConfig => {
    return dataControlGroups[dataControlTab] || { groups: [], selectedGroupIds: [] }
  }

  const updateDataControlTabGroups = (groups: AccountGroup[]): void => {
    setDataControlGroups((prev) => ({
      ...prev,
      [dataControlTab]: {
        groups,
        selectedGroupIds: dataControlSelectedGroupIds
      }
    }))
  }

  const addDataControlGroup = (): void => {
    const tabConfig = getDataControlTabConfig()
    const newGroup: AccountGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `分组 ${tabConfig.groups.length + 1}`,
      accountsText: ''
    }
    updateDataControlTabGroups([...tabConfig.groups, newGroup])
  }

  const updateDataControlGroup = (groupId: string, next: Partial<AccountGroup>): void => {
    const tabConfig = getDataControlTabConfig()
    updateDataControlTabGroups(
      tabConfig.groups.map((group) => (group.id === groupId ? { ...group, ...next } : group))
    )
  }

  const deleteDataControlGroup = (groupId: string): void => {
    const tabConfig = getDataControlTabConfig()
    updateDataControlTabGroups(tabConfig.groups.filter((group) => group.id !== groupId))
    setDataControlSelectedGroupIds((prev) => prev.filter((id) => id !== groupId))
  }

  const saveDataControlGroups = async (): Promise<void> => {
    if (!selectedConfigId) {
      toast.error('请先选择配置')
      return
    }
    const tabConfig = getDataControlTabConfig()
    const payloadGroups = tabConfig.groups.map((group) => ({
      id: group.id,
      name: group.name,
      accountsText: group.accountsText
    }))
    try {
      await dataAssistantConfigService.updateConfig(selectedConfigId, {
        data_control_groups: {
          ...(dataControlGroups || {}),
          [dataControlTab]: {
            groups: payloadGroups,
            selected_group_ids: dataControlSelectedGroupIds
          }
        }
      })
      toast.success('分组配置已保存')
      await loadDataControlGroups()
    } catch (err: any) {
      toast.error(err.message || '分组配置保存失败')
    }
  }

  // 组织分组管理函数（复用DataAssistantPage的逻辑）
  const loadOrganizations = async (): Promise<void> => {
    if (!selectedConfigId) {
      toast.error('请先选择配置')
      return
    }
    setLoadingOrganizations(true)
    try {
      const result = await organizationListService.getOrganizationList({
        selected_cookie_id: selectedConfigId
      })
      if (result.code === 0 && result.data) {
        setOrganizations(result.data)
        toast.success(`成功加载 ${result.data.length} 个组织`)
      } else {
        toast.error(result.error || result.msg || '获取组织列表失败')
      }
    } catch (err: any) {
      console.error('Failed to load organizations:', err)
      toast.error(err.message || '获取组织列表失败')
    } finally {
      setLoadingOrganizations(false)
    }
  }

  const createGroup = (): void => {
    const newGroup: OrganizationGroup = {
      id: `group_${Date.now()}`,
      name: `分组 ${organizationGroups.length + 1}`,
      businessIds: []
    }
    setOrganizationGroups([...organizationGroups, newGroup])
    setEditingGroupId(newGroup.id)
    setEditingGroupName(newGroup.name)
  }

  const deleteGroup = (groupId: string): void => {
    setOrganizationGroups(organizationGroups.filter((g) => g.id !== groupId))
    setGroupSearchKeywords((prev) => {
      const updated = { ...prev }
      delete updated[groupId]
      return updated
    })
  }

  const saveGroupName = (groupId: string): void => {
    if (!editingGroupName.trim()) {
      toast.error('分组名称不能为空')
      return
    }
    setOrganizationGroups(
      organizationGroups.map((g) =>
        g.id === groupId ? { ...g, name: editingGroupName.trim() } : g
      )
    )
    setEditingGroupId(null)
    setEditingGroupName('')
  }

  const toggleOrganizationInGroup = (groupId: string, org: OrganizationItem): void => {
    setOrganizationGroups(
      organizationGroups.map((group) => {
        if (group.id === groupId) {
          const exists = group.businessIds.includes(org.business_id)
          return {
            ...group,
            businessIds: exists
              ? group.businessIds.filter((id) => id !== org.business_id)
              : [...group.businessIds, org.business_id]
          }
        }
        return group
      })
    )
  }

  const isOrganizationInGroup = (groupId: string, businessId: number): boolean => {
    const group = organizationGroups.find((g) => g.id === groupId)
    return group ? group.businessIds.includes(businessId) : false
  }

  const getGroupSearchKeyword = (groupId: string): string => {
    return groupSearchKeywords[groupId] || ''
  }

  const setGroupSearchKeyword = (groupId: string, keyword: string): void => {
    setGroupSearchKeywords((prev) => ({
      ...prev,
      [groupId]: keyword
    }))
  }

  // 投手分组管理函数
  const createOperatorGroup = (): void => {
    const newGroup: OperatorGroup = {
      id: `operator_group_${Date.now()}`,
      name: `投手分组 ${operatorGroups.length + 1}`,
      tags: []
    }
    setOperatorGroups([...operatorGroups, newGroup])
    setEditingOperatorGroupId(newGroup.id)
    setEditingOperatorGroupName(newGroup.name)
    setEditingOperatorGroupTags('')
  }

  const deleteOperatorGroup = (groupId: string): void => {
    setOperatorGroups(operatorGroups.filter((g) => g.id !== groupId))
  }

  const startEditOperatorGroup = (groupId: string): void => {
    const group = operatorGroups.find((g) => g.id === groupId)
    if (group) {
      setEditingOperatorGroupId(groupId)
      setEditingOperatorGroupName(group.name)
      setEditingOperatorGroupTags(group.tags.join('\n'))
    }
  }

  const saveOperatorGroup = (groupId: string): void => {
    if (!editingOperatorGroupName.trim()) {
      toast.error('分组名称不能为空')
      return
    }
    const tags = editingOperatorGroupTags
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t)
    if (tags.length === 0) {
      toast.error('至少需要添加一个标签')
      return
    }
    setOperatorGroups(
      operatorGroups.map((g) =>
        g.id === groupId ? { ...g, name: editingOperatorGroupName.trim(), tags } : g
      )
    )
    setEditingOperatorGroupId(null)
    setEditingOperatorGroupName('')
    setEditingOperatorGroupTags('')
  }

  const cancelEditOperatorGroup = (): void => {
    setEditingOperatorGroupId(null)
    setEditingOperatorGroupName('')
    setEditingOperatorGroupTags('')
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
        text: '待执行',
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

    // 每小时X分执行: X * * * *
    if (
      minute !== '*' &&
      !minute.startsWith('*/') &&
      hour === '*' &&
      day === '*' &&
      month === '*' &&
      weekday === '*'
    ) {
      const m = parseInt(minute)
      if (!isNaN(m)) return `每小时${m}分`
    }

    // 默认返回原始表达式
    return cron
  }

  const formatIntervalMinutes = (minutes: number): string => {
    if (minutes < 60) return `每${minutes}分钟`
    const hours = Math.floor(minutes / 60)
    const remainMinutes = minutes % 60
    if (remainMinutes === 0) return `每${hours}小时`
    return `每${hours}小时${remainMinutes}分钟`
  }

  const formatDailyTimes = (times: Array<{ hour?: number; minute?: number }>): string => {
    const timeText = times
      .map((time): string => {
        const hour = Number(time.hour ?? 0)
        const minute = Number(time.minute ?? 0)
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      })
      .join('、')
    return timeText ? `每天 ${timeText}` : '每天指定时间'
  }

  const getTaskScheduleDisplay = (task: ScheduledTask): string => {
    if (task.task_type === 'auto_acquisition') {
      const taskConfig = task.task_config || {}
      if (taskConfig.schedule_mode === 'interval') {
        const intervalMinutes = Number(taskConfig.schedule_interval_minutes)
        if (intervalMinutes > 0) return formatIntervalMinutes(intervalMinutes)
      }
      if (taskConfig.schedule_mode === 'daily' && Array.isArray(taskConfig.schedule_times)) {
        return formatDailyTimes(taskConfig.schedule_times)
      }
    }

    return parseCronExpression(task.cron_expression)
  }

  const getTaskNextRunDisplay = (task: ScheduledTask): string | null => {
    if (task.task_type === 'auto_acquisition') {
      const taskConfig = task.task_config || {}
      const intervalMinutes = Number(taskConfig.schedule_interval_minutes)
      if (taskConfig.schedule_mode === 'interval' && intervalMinutes > 0 && task.last_run_at) {
        const nextRunAt = new Date(task.last_run_at)
        nextRunAt.setMinutes(nextRunAt.getMinutes() + intervalMinutes)
        return formatDate(nextRunAt.toISOString())
      }
    }

    return task.next_run_at ? formatDate(task.next_run_at) : null
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">定时任务管理</h1>
          <p className="text-muted-foreground mt-2">创建和管理自动化任务</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 w-4 h-4" />
          创建任务
        </Button>
      </div>

      {/* 任务列表 */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              暂无任务，点击"创建任务"添加新任务
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const nextRunDisplay = getTaskNextRunDisplay(task)

                return (
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
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground flex-shrink-0">
                                  # {task.id}
                                </span>
                                <h3 className="text-base font-semibold text-foreground truncate">
                                  {task.name}
                                </h3>
                              </div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                                {getTaskTypeLabel(task.task_type)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 详细信息网格 */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border/50">
                          <div className="flex items-start gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground mb-0.5">执行频率</div>
                              <div className="text-sm font-medium text-foreground">
                                {getTaskScheduleDisplay(task)}
                              </div>
                              {nextRunDisplay && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  下次: {nextRunDisplay}
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
                        {['data_control', 'auto_acquisition'].includes(task.task_type) && (
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(task.id)}
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                          title="删除任务"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 创建对话框 */}
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
          className={`${taskType === 'data_assistant_report' || taskType === 'data_control' || taskType === 'auto_acquisition' ? 'sm:max-w-[900px]' : 'sm:max-w-[500px]'} max-h-[90vh] overflow-y-auto`}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editingTaskId
                ? taskType === 'data_assistant_report'
                  ? '编辑数据助手报表任务'
                  : taskType === 'auto_acquisition'
                    ? '编辑定时一键起量任务'
                    : '编辑数据调控任务'
                : taskType === 'data_assistant_report'
                  ? '创建数据助手报表任务'
                  : taskType === 'auto_acquisition'
                    ? '创建定时一键起量任务'
                    : '创建数据调控任务'}
            </DialogTitle>
            <DialogDescription>
              {editingTaskId
                ? taskType === 'data_assistant_report'
                  ? '修改数据助手报表任务配置，系统将定时拉取数据、生成图片或飞书表格并发送到群组。'
                  : taskType === 'auto_acquisition'
                    ? '修改定时一键起量任务配置，系统将定时批量开启或关闭广告组的一键起量功能。'
                    : '修改数据调控任务配置，系统将定时拉取数据并批量启停广告。'
                : taskType === 'data_assistant_report'
                  ? '配置数据助手报表任务，系统将定时拉取数据、生成图片或飞书表格并发送到群组。'
                  : taskType === 'auto_acquisition'
                    ? '配置定时一键起量任务，系统将定时批量开启或关闭广告组的一键起量功能。'
                    : '配置数据调控任务，系统将定时拉取数据并批量启停广告。'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* 基础信息区域 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  disabled={isSubmitting}
                >
                  <option value="data_control">数据调控</option>
                  <option value="data_assistant_report">数据助手报表</option>
                  <option value="auto_acquisition">定时一键起量</option>
                </select>
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
                          value={selectedConfigId || ''}
                          onChange={(e) => {
                            const configId = parseInt(e.target.value)
                            setSelectedConfigId(configId)
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
                        {selectedConfigId && (
                          <div className="mt-2 p-2 bg-primary/5 border border-primary/20 rounded-md">
                            <div className="flex items-center gap-2 text-sm">
                              <CheckCircle className="w-4 h-4 text-primary" />
                              <span className="font-medium">
                                {configs.find((c) => c.id === selectedConfigId)?.cookie_name}
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
                        3. 组织分组配置
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>组织分组 *</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={loadOrganizations}
                            disabled={loadingOrganizations || !selectedConfigId}
                          >
                            {loadingOrganizations ? (
                              <>
                                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                                加载中...
                              </>
                            ) : (
                              '加载组织列表'
                            )}
                          </Button>
                        </div>

                        <div className="space-y-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={createGroup}
                            disabled={isSubmitting}
                          >
                            <Plus className="mr-2 w-4 h-4" />
                            创建分组
                          </Button>

                          {organizationGroups.map((group) => (
                            <div key={group.id} className="border rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  {editingGroupId === group.id ? (
                                    <>
                                      <Input
                                        value={editingGroupName}
                                        onChange={(e) => setEditingGroupName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            saveGroupName(group.id)
                                          } else if (e.key === 'Escape') {
                                            setEditingGroupId(null)
                                            setEditingGroupName('')
                                          }
                                        }}
                                        className="flex-1"
                                        autoFocus
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => saveGroupName(group.id)}
                                      >
                                        <Check className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setEditingGroupId(null)
                                          setEditingGroupName('')
                                        }}
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-semibold">{group.name}</span>
                                      <span className="text-sm text-muted-foreground">
                                        ({group.businessIds.length} 个组织)
                                      </span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setEditingGroupId(group.id)
                                          setEditingGroupName(group.name)
                                        }}
                                        className="h-6 w-6 p-0"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteGroup(group.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>

                              {organizations.length > 0 && (
                                <>
                                  <Input
                                    type="text"
                                    placeholder="搜索组织（支持ID或名称）"
                                    value={getGroupSearchKeyword(group.id)}
                                    onChange={(e) =>
                                      setGroupSearchKeyword(group.id, e.target.value)
                                    }
                                    className="w-full"
                                  />
                                  <div className="border rounded-md p-2 max-h-[200px] overflow-y-auto bg-muted/30">
                                    <div className="grid grid-cols-2 gap-2">
                                      {organizations
                                        .filter((org) => {
                                          const keyword = getGroupSearchKeyword(group.id)
                                            .toLowerCase()
                                            .trim()
                                          if (!keyword) return true
                                          return (
                                            String(org.business_id).includes(keyword) ||
                                            org.business_name.toLowerCase().includes(keyword)
                                          )
                                        })
                                        .map((org) => {
                                          const isSelected = isOrganizationInGroup(
                                            group.id,
                                            org.business_id
                                          )
                                          return (
                                            <div
                                              key={org.business_id}
                                              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all ${
                                                isSelected
                                                  ? 'bg-primary/10 border border-primary/50'
                                                  : 'border border-border hover:border-primary/50'
                                              }`}
                                              onClick={() =>
                                                toggleOrganizationInGroup(group.id, org)
                                              }
                                            >
                                              <div
                                                className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                                  isSelected
                                                    ? 'border-primary bg-primary'
                                                    : 'border-muted-foreground/30'
                                                }`}
                                              >
                                                {isSelected && (
                                                  <div className="w-2 h-2 rounded-full bg-white" />
                                                )}
                                              </div>
                                              <span className="text-sm">
                                                {org.business_id}-{org.business_name}
                                              </span>
                                            </div>
                                          )
                                        })}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border-t bg-muted/10">
                      <h3 className="font-semibold flex items-center gap-2 mb-4">
                        <Tag className="w-4 h-4 text-primary" />
                        4. 标签分组配置
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="useTagGrouping"
                            checked={useTagGrouping}
                            onCheckedChange={(checked) => setUseTagGrouping(checked === true)}
                            disabled={isSubmitting}
                          />
                          <Label htmlFor="useTagGrouping" className="cursor-pointer">
                            启用标签分组
                          </Label>
                        </div>
                        {useTagGrouping && (
                          <div className="grid gap-2 ml-6">
                            <Label htmlFor="tagText">标签文本（每行一个）</Label>
                            <textarea
                              id="tagText"
                              className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px]"
                              value={tagText}
                              onChange={(e) => setTagText(e.target.value)}
                              placeholder="纯短剧&#10;纯激励"
                              disabled={isSubmitting}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 border-t bg-muted/10">
                      <h3 className="font-semibold flex items-center gap-2 mb-4">
                        <User className="w-4 h-4 text-primary" />
                        5. 投手维度配置
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="useOperatorDimension"
                            checked={useOperatorDimension}
                            onCheckedChange={(checked) => setUseOperatorDimension(checked === true)}
                            disabled={isSubmitting || organizationGroups.length !== 1}
                          />
                          <Label htmlFor="useOperatorDimension" className="cursor-pointer">
                            启用投手维度
                          </Label>
                        </div>
                        {organizationGroups.length !== 1 && (
                          <p className="text-xs text-muted-foreground ml-6">
                            投手维度仅支持一个组织分组
                          </p>
                        )}
                        {useOperatorDimension && organizationGroups.length === 1 && (
                          <div className="space-y-3 ml-6">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={createOperatorGroup}
                              disabled={isSubmitting}
                            >
                              <Plus className="mr-2 w-4 h-4" />
                              创建投手分组
                            </Button>
                            {operatorGroups.length > 0 && (
                              <div className="space-y-3">
                                {operatorGroups.map((group) => (
                                  <div key={group.id} className="border rounded-lg p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 flex-1">
                                        {editingOperatorGroupId === group.id ? (
                                          <>
                                            <Input
                                              value={editingOperatorGroupName}
                                              onChange={(e) =>
                                                setEditingOperatorGroupName(e.target.value)
                                              }
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  saveOperatorGroup(group.id)
                                                } else if (e.key === 'Escape') {
                                                  cancelEditOperatorGroup()
                                                }
                                              }}
                                              className="flex-1"
                                              autoFocus
                                            />
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => saveOperatorGroup(group.id)}
                                            >
                                              <Check className="w-4 h-4" />
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={cancelEditOperatorGroup}
                                            >
                                              <X className="w-4 h-4" />
                                            </Button>
                                          </>
                                        ) : (
                                          <>
                                            <span className="font-semibold">{group.name}</span>
                                            <span className="text-sm text-muted-foreground">
                                              ({group.tags.length} 个标签)
                                            </span>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => startEditOperatorGroup(group.id)}
                                              className="h-6 w-6 p-0"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => deleteOperatorGroup(group.id)}
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                    {editingOperatorGroupId === group.id ? (
                                      <div className="grid gap-2">
                                        <Label className="text-xs text-muted-foreground">
                                          标签列表（每行一个）
                                        </Label>
                                        <textarea
                                          value={editingOperatorGroupTags}
                                          onChange={(e) =>
                                            setEditingOperatorGroupTags(e.target.value)
                                          }
                                          placeholder="请输入标签，每行一个。例如：\n纯短剧\n纯激励"
                                          className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px]"
                                          disabled={isSubmitting}
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex flex-wrap gap-2">
                                        {group.tags.map((tag, idx) => (
                                          <div
                                            key={idx}
                                            className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs"
                                          >
                                            {tag}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {operatorGroups.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-2">
                                未创建投手分组
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="p-4 border-t bg-muted/10">
                      <h3 className="font-semibold flex items-center gap-2 mb-4">
                        <Settings className="w-4 h-4 text-primary" />
                        6. 飞书群组配置
                      </h3>
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
                        <div className="flex items-center gap-2 mt-3">
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
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : taskType === 'data_control' ? (
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
                    <div className="p-4 space-y-4">
                      <div className="grid gap-2">
                        <Label>账号配置 *</Label>
                        <select
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
                        {selectedConfigId && (
                          <div className="mt-2 p-2 bg-primary/5 border border-primary/20 rounded-md">
                            <div className="flex items-center gap-2 text-sm">
                              <CheckCircle className="w-4 h-4 text-primary" />
                              <span className="font-medium">
                                {configs.find((c) => c.id === selectedConfigId)?.cookie_name}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid gap-2">
                        <Label>账户来源 *</Label>
                        <select
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={dataControlAccountSource}
                          onChange={(e) =>
                            setDataControlAccountSource(
                              e.target.value === 'manual' ? 'manual' : 'group'
                            )
                          }
                          disabled={isSubmitting}
                        >
                          <option value="group">配置分组</option>
                          <option value="manual">手动账户列表</option>
                        </select>
                      </div>

                      {dataControlAccountSource === 'manual' ? (
                        <div className="grid gap-2">
                          <Label>账户列表 *</Label>
                          <textarea
                            className="w-full px-3 py-2 border rounded-md bg-background min-h-[120px]"
                            placeholder="一行一个账号ID"
                            value={dataControlAccountsText}
                            onChange={(e) => setDataControlAccountsText(e.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          <div className="flex items-center justify-between">
                            <Label>配置分组 *</Label>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={loadDataControlGroups}
                                disabled={loadingDataControlGroups || !selectedConfigId}
                              >
                                {loadingDataControlGroups ? (
                                  <>
                                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                                    加载中...
                                  </>
                                ) : (
                                  '刷新分组'
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addDataControlGroup}
                                disabled={isSubmitting}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                新增分组
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={saveDataControlGroups}
                                disabled={isSubmitting || !selectedConfigId}
                              >
                                保存分组
                              </Button>
                            </div>
                          </div>
                          <div className="border rounded-md p-3 bg-muted/20 space-y-3">
                            {(() => {
                              const groupConfig = getDataControlTabConfig()
                              const groups = groupConfig.groups || []
                              if (groups.length === 0) {
                                return (
                                  <p className="text-sm text-muted-foreground">
                                    暂无分组配置，请新增分组。
                                  </p>
                                )
                              }
                              return (
                                <div className="space-y-3">
                                  {groups.map((group) => {
                                    const checked = dataControlSelectedGroupIds.includes(group.id)
                                    return (
                                      <div
                                        key={group.id}
                                        className="border rounded-lg p-3 space-y-2 bg-card"
                                      >
                                        <div className="flex items-center gap-2">
                                          <Checkbox
                                            checked={checked}
                                            onCheckedChange={(value) =>
                                              toggleDataControlGroupSelection(
                                                group.id,
                                                value === true
                                              )
                                            }
                                          />
                                          <div className="flex-1 grid gap-1">
                                            <Input
                                              value={group.name}
                                              onChange={(e) =>
                                                updateDataControlGroup(group.id, {
                                                  name: e.target.value
                                                })
                                              }
                                              placeholder="分组名称"
                                            />
                                            <span className="text-xs text-muted-foreground">
                                              {getAccountCount(group.accountsText)} 个账号
                                            </span>
                                          </div>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => deleteDataControlGroup(group.id)}
                                            className="text-destructive"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </div>
                                        <textarea
                                          className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px]"
                                          placeholder="一行一个账号ID"
                                          value={group.accountsText}
                                          onChange={(e) =>
                                            updateDataControlGroup(group.id, {
                                              accountsText: e.target.value
                                            })
                                          }
                                        />
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 右侧：任务配置 */}
                <div className="space-y-6">
                  <div className="bg-card rounded-lg border shadow-sm h-full flex flex-col">
                    <div className="p-4 border-b bg-muted/10">
                      <h3 className="font-semibold flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        2. 调控配置
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        配置广告类型、执行频率与筛选条件
                      </p>
                    </div>

                    <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                      <div className="grid gap-2">
                        <Label>广告类型 *</Label>
                        <div className="flex gap-2 flex-wrap">
                          {[
                            { value: 'display', label: '展示广告' },
                            { value: 'smart', label: '智能投放' },
                            { value: 'search', label: '搜索广告' }
                          ].map((tab) => (
                            <Button
                              key={tab.value}
                              type="button"
                              variant={dataControlTab === tab.value ? 'default' : 'outline'}
                              size="sm"
                              onClick={() =>
                                setDataControlTab(tab.value as 'display' | 'smart' | 'search')
                              }
                              disabled={isSubmitting || tab.value !== 'display'}
                            >
                              {tab.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label>维度 *</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={dataControlDimension === 'ad' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setDataControlDimension('ad')}
                            disabled={isSubmitting}
                          >
                            广告
                          </Button>
                          <Button
                            type="button"
                            variant={dataControlDimension === 'creative' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setDataControlDimension('creative')}
                            disabled={isSubmitting}
                          >
                            创意
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label>执行频率 *</Label>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm whitespace-nowrap">每</Label>
                          <Input
                            type="number"
                            min={1}
                            max={60}
                            value={dataControlIntervalMinutes}
                            onChange={(e) => setDataControlIntervalMinutes(Number(e.target.value))}
                            className="w-24"
                            disabled={isSubmitting}
                          />
                          <Label className="text-sm whitespace-nowrap">分钟</Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          将生成 Cron：*/{dataControlIntervalMinutes} * * * *
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <Label>操作类型 *</Label>
                        <select
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={dataControlAction}
                          onChange={(e) =>
                            setDataControlAction(e.target.value === 'enable' ? 'enable' : 'pause')
                          }
                          disabled={isSubmitting}
                        >
                          <option value="enable">启用</option>
                          <option value="pause">暂停</option>
                        </select>
                      </div>
                    </div>

                    <div className="p-4 border-t bg-muted/10">
                      <h3 className="font-semibold flex items-center gap-2 mb-4">
                        <Settings className="w-4 h-4 text-primary" />
                        3. 筛选条件
                      </h3>
                      <div className="space-y-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addDataControlCondition}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          添加条件
                        </Button>
                        <div className="grid grid-cols-1 gap-3">
                          {dataControlConditions.map((condition) => (
                            <div
                              key={condition.id}
                              className="border rounded-md p-3 space-y-2 bg-card"
                            >
                              <div className="grid grid-cols-3 gap-2">
                                <select
                                  className="px-2 py-1 border rounded-md bg-background text-sm"
                                  value={condition.metric}
                                  onChange={(e) =>
                                    updateDataControlCondition(condition.id, {
                                      metric: e.target.value
                                    })
                                  }
                                >
                                  <option value="cost">花费</option>
                                  <option value="activated_cost">APP激活成本</option>
                                  <option value="activated_count">APP激活数</option>
                                </select>
                                <select
                                  className="px-2 py-1 border rounded-md bg-background text-sm"
                                  value={condition.operator}
                                  onChange={(e) =>
                                    updateDataControlCondition(condition.id, {
                                      operator: e.target.value,
                                      value2: e.target.value === 'between' ? condition.value2 : ''
                                    })
                                  }
                                >
                                  <option value="gte">大于等于</option>
                                  <option value="lte">小于等于</option>
                                  <option value="between">介于</option>
                                </select>
                                <Input
                                  type="number"
                                  value={condition.value1}
                                  onChange={(e) =>
                                    updateDataControlCondition(condition.id, {
                                      value1: e.target.value
                                    })
                                  }
                                />
                              </div>
                              {condition.operator === 'between' && (
                                <Input
                                  type="number"
                                  value={condition.value2}
                                  onChange={(e) =>
                                    updateDataControlCondition(condition.id, {
                                      value2: e.target.value
                                    })
                                  }
                                />
                              )}
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeDataControlCondition(condition.id)}
                                  className="text-destructive"
                                >
                                  删除
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : taskType === 'auto_acquisition' ? (
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
                    <div className="p-4 space-y-4">
                      <div className="grid gap-2">
                        <Label>账号配置 *</Label>
                        <select
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
                        {selectedConfigId && (
                          <div className="mt-2 p-2 bg-primary/5 border border-primary/20 rounded-md">
                            <div className="flex items-center gap-2 text-sm">
                              <CheckCircle className="w-4 h-4 text-primary" />
                              <span className="font-medium">
                                {configs.find((c) => c.id === selectedConfigId)?.cookie_name}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label>广告账户列表 *</Label>
                        <Textarea
                          className="min-h-[120px] resize-y font-mono"
                          placeholder={
                            '请输入广告账户ID，每行填写一个\n例如：\n123456789\n987654321'
                          }
                          value={autoAcquisitionAccountsText}
                          onChange={(e) => setAutoAcquisitionAccountsText(e.target.value)}
                          disabled={isSubmitting}
                          rows={5}
                        />
                        <p className="text-sm text-muted-foreground">
                          每行填写一个广告账户ID，支持多个账户批量操作
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* 右侧：任务配置 */}
                <div className="space-y-6">
                  <div className="bg-card rounded-lg border shadow-sm h-full flex flex-col">
                    <div className="p-4 border-b bg-muted/10">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Rocket className="w-4 h-4 text-primary" />
                        2. 一键起量配置
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        配置操作类型、起量金额与执行频率
                      </p>
                    </div>
                    <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                      <div className="grid gap-2">
                        <Label>操作类型 *</Label>
                        <RadioGroup
                          value={autoAcquisitionOperationType}
                          onValueChange={(v) =>
                            setAutoAcquisitionOperationType(v as 'enable' | 'disable')
                          }
                          disabled={isSubmitting}
                          className="flex gap-6"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="enable" id="autoEnable" />
                            <Label htmlFor="autoEnable" className="font-normal cursor-pointer">
                              开启一键起量
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="disable" id="autoDisable" />
                            <Label htmlFor="autoDisable" className="font-normal cursor-pointer">
                              关闭一键起量
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                      {autoAcquisitionOperationType === 'enable' && (
                        <div className="grid gap-2">
                          <Label htmlFor="launchAmount">起量金额 (元) *</Label>
                          <Input
                            id="launchAmount"
                            type="number"
                            step="0.01"
                            min="200"
                            max="100000"
                            placeholder="200-100000元"
                            value={autoAcquisitionLaunchAmount}
                            onChange={(e) => setAutoAcquisitionLaunchAmount(e.target.value)}
                            disabled={isSubmitting}
                            className="h-11"
                          />
                          <p className="text-sm text-muted-foreground">
                            起量金额范围：200-100000元
                          </p>
                        </div>
                      )}
                      <div className="grid gap-2">
                        <Label>执行频率 *</Label>
                        <div className="flex gap-4 mb-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="autoScheduleMode"
                              value="interval"
                              checked={autoAcquisitionScheduleMode === 'interval'}
                              onChange={() => setAutoAcquisitionScheduleMode('interval')}
                              className="accent-primary"
                              disabled={isSubmitting}
                            />
                            <span className="text-sm">间隔执行</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="autoScheduleMode"
                              value="daily"
                              checked={autoAcquisitionScheduleMode === 'daily'}
                              onChange={() => setAutoAcquisitionScheduleMode('daily')}
                              className="accent-primary"
                              disabled={isSubmitting}
                            />
                            <span className="text-sm">每天指定时间</span>
                          </label>
                        </div>
                        {autoAcquisitionScheduleMode === 'interval' ? (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Label className="text-sm whitespace-nowrap">每</Label>
                              <Input
                                type="number"
                                min={0}
                                max={24}
                                value={autoAcquisitionIntervalHours}
                                onChange={(e) =>
                                  setAutoAcquisitionIntervalHours(Number(e.target.value))
                                }
                                className="w-20"
                                disabled={isSubmitting}
                              />
                              <Label className="text-sm whitespace-nowrap">小时</Label>
                              <Input
                                type="number"
                                min={0}
                                max={59}
                                value={autoAcquisitionIntervalMinutes}
                                onChange={(e) =>
                                  setAutoAcquisitionIntervalMinutes(Number(e.target.value))
                                }
                                className="w-20"
                                disabled={isSubmitting}
                              />
                              <Label className="text-sm whitespace-nowrap">分钟</Label>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {autoAcquisitionIntervalHours * 60 + autoAcquisitionIntervalMinutes >=
                              1
                                ? `将每分钟检查一次，到达 ${autoAcquisitionIntervalHours * 60 + autoAcquisitionIntervalMinutes} 分钟间隔时执行（每${[autoAcquisitionIntervalHours > 0 && `${autoAcquisitionIntervalHours}小时`, autoAcquisitionIntervalMinutes > 0 && `${autoAcquisitionIntervalMinutes}分钟`].filter(Boolean).join('') || '1分钟'}执行）`
                                : '执行间隔至少为1分钟'}
                            </p>
                          </>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setAutoAcquisitionDailyTimes([
                                    ...autoAcquisitionDailyTimes,
                                    { hour: 9, minute: 0 }
                                  ])
                                }
                                disabled={isSubmitting}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                添加时间
                              </Button>
                            </div>
                            <div className="space-y-2 max-h-[160px] overflow-y-auto">
                              {autoAcquisitionDailyTimes.map((slot, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-2 p-2 border rounded-md bg-muted/30"
                                >
                                  <select
                                    className="px-2 py-1 border rounded-md bg-background text-sm"
                                    value={slot.hour}
                                    onChange={(e) => {
                                      const next = [...autoAcquisitionDailyTimes]
                                      next[index] = {
                                        ...next[index],
                                        hour: parseInt(e.target.value)
                                      }
                                      setAutoAcquisitionDailyTimes(next)
                                    }}
                                    disabled={isSubmitting}
                                  >
                                    {Array.from({ length: 24 }, (_, i) => (
                                      <option key={i} value={i}>
                                        {i}时
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    className="px-2 py-1 border rounded-md bg-background text-sm"
                                    value={slot.minute}
                                    onChange={(e) => {
                                      const next = [...autoAcquisitionDailyTimes]
                                      next[index] = {
                                        ...next[index],
                                        minute: parseInt(e.target.value)
                                      }
                                      setAutoAcquisitionDailyTimes(next)
                                    }}
                                    disabled={isSubmitting}
                                  >
                                    {Array.from({ length: 60 }, (_, i) => (
                                      <option key={i} value={i}>
                                        {i}分
                                      </option>
                                    ))}
                                  </select>
                                  <span className="text-sm text-muted-foreground">
                                    {slot.hour.toString().padStart(2, '0')}:
                                    {slot.minute.toString().padStart(2, '0')}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setAutoAcquisitionDailyTimes(
                                        autoAcquisitionDailyTimes.filter((_, i) => i !== index)
                                      )
                                    }
                                    disabled={isSubmitting || autoAcquisitionDailyTimes.length <= 1}
                                    className="text-destructive p-0 h-8 w-8"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              每天在指定时间点执行，可添加多个时间
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* 禁止执行的时间段配置 */}
            {(taskType === 'data_assistant_report' ||
              taskType === 'data_control' ||
              taskType === 'auto_acquisition') && (
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
            )}

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
            <Button
              onClick={handleCreate}
              disabled={
                isSubmitting ||
                !taskName ||
                (taskType === 'data_assistant_report'
                  ? !selectedConfigId ||
                    !chatId.trim() ||
                    organizationGroups.length === 0 ||
                    (useOperatorDimension && operatorGroups.length === 0)
                  : taskType === 'data_control'
                    ? !selectedConfigId ||
                      !dataControlIntervalMinutes ||
                      (dataControlAccountSource === 'manual' && !dataControlAccountsText.trim()) ||
                      (dataControlAccountSource === 'group' &&
                        dataControlSelectedGroupIds.length === 0)
                    : taskType === 'auto_acquisition'
                      ? !selectedConfigId ||
                        !autoAcquisitionAccountsText.trim() ||
                        autoAcquisitionAccountsText.split('\n').filter((id) => id.trim()).length ===
                          0 ||
                        (autoAcquisitionScheduleMode === 'interval' &&
                          autoAcquisitionIntervalHours * 60 + autoAcquisitionIntervalMinutes < 1) ||
                        (autoAcquisitionScheduleMode === 'daily' &&
                          autoAcquisitionDailyTimes.length === 0) ||
                        (autoAcquisitionOperationType === 'enable' &&
                          (!autoAcquisitionLaunchAmount ||
                            parseFloat(autoAcquisitionLaunchAmount) < 200 ||
                            parseFloat(autoAcquisitionLaunchAmount) > 100000))
                      : !selectedConfigId || !cronExpression)
              }
            >
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
                      {log.success_item_ids && log.success_item_ids.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="text-xs text-muted-foreground mb-1">
                            {log.success_item_id_type === 'task_id'
                              ? '异步任务'
                              : log.success_item_id_type === 'dynamic_creative_id'
                                ? '创意'
                                : '广告'}
                            ID
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {log.success_item_ids.map((itemId) => (
                              <span
                                key={itemId}
                                className="px-1.5 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded text-[10px] font-mono"
                              >
                                {itemId}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {log.error_message && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="text-xs text-muted-foreground mb-1">错误信息</div>
                          <div className="text-sm text-red-600">{log.error_message}</div>
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
