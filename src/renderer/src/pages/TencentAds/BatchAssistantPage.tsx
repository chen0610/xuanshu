import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Clock,
  DollarSign,
  Loader2,
  Rocket,
  Search,
  Settings2,
  Sparkles,
  Tag,
  Trash2,
  Settings
} from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Textarea
} from '../../components/ui'
import {
  TENCENT_BATCH_ASSISTANT_FEATURES,
  TENCENT_BATCH_ASSISTANT_GROUPS,
  type TencentBatchAssistantFeatureGroup
} from './tencentBatchAssistantFeatures'
import {
  TencentBatchLogPanel,
  TencentConfigSelector,
  useTencentConfigs,
  type TencentBatchLogEntry
} from './batchAssistantShared'
import { tencentBatchAssistantJobService } from '../../services/tencent-ads.service'
import { TencentBatchAssistantJobCenter } from './TencentBatchAssistantJobCenter'

const EMBEDDED_FEATURE_KEYS = new Set([
  'auto-acquisition',
  'account-remark',
  'account-ad-clear',
  'rta',
  'bid-management',
  'schedule-management'
])

type EmbeddedFeatureKey =
  | 'auto-acquisition'
  | 'account-remark'
  | 'account-ad-clear'
  | 'rta'
  | 'bid-management'
  | 'schedule-management'

const embeddedFeatureMeta: Record<EmbeddedFeatureKey, { title: string; description: string }> = {
  'auto-acquisition': {
    title: '一键起量',
    description: '批量开启或关闭广告组的一键起量功能。'
  },
  'account-remark': {
    title: '修改备注标签',
    description: '批量修改账号备注或标签，支持多个账号自动编号。'
  },
  'account-ad-clear': {
    title: '账户广告清空',
    description: '批量清空账号下的展示广告或智能投放营销单元，高风险操作会二次确认。'
  },
  rta: {
    title: '修改 RTA',
    description: '批量修改账号的 RTA 设置，支持在投广告维度与账户维度。'
  },
  'bid-management': {
    title: '广告出价修改',
    description: '批量修改广告出价和成本控制策略。'
  },
  'schedule-management': {
    title: '修改投放时间',
    description: '批量修改广告账户的投放日期或投放时段。'
  }
}

const FEATURE_GROUP_LABELS: Record<TencentBatchAssistantFeatureGroup, string> = {
  delivery: '投放调控',
  account: '账户设置',
  asset: '素材处理',
  advanced: '高级配置'
}

const StepSection: React.FC<{
  step: number
  title: string
  description: string
  children: React.ReactNode
}> = ({ step, title, description, children }) => (
  <section className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm sm:p-5">
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {step}
      </div>
      <div>
        <h3 className="text-base font-semibold leading-none tracking-tight">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
    <div className="space-y-5">{children}</div>
  </section>
)

const parseAccountInput = (value: string): string[] =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

const getDuplicateAccountIds = (ids: string[]): string[] => {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  ids.forEach((id) => {
    if (seen.has(id)) {
      duplicates.add(id)
    } else {
      seen.add(id)
    }
  })

  return Array.from(duplicates)
}

type AccountAdClearType = 'all' | 'display' | 'smart'

const ACCOUNT_AD_CLEAR_TYPE_LABELS: Record<AccountAdClearType, string> = {
  all: '全部',
  display: '展示广告',
  smart: '智能投放'
}

const TENCENT_SCHEDULE_DAY_NAMES = [
  '星期一',
  '星期二',
  '星期三',
  '星期四',
  '星期五',
  '星期六',
  '星期日'
]

const createDefaultWeekSchedule = (): boolean[][] =>
  Array.from({ length: 7 }, () => Array(48).fill(true))

const AccountIdsInput: React.FC<{
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  placeholder?: string
}> = ({ id, label, value, onChange, disabled, placeholder = '请输入账号ID，每行填写一个' }) => {
  const ids = useMemo(() => parseAccountInput(value), [value])
  const duplicateIds = useMemo(() => getDuplicateAccountIds(ids), [ids])
  const uniqueIds = useMemo(() => Array.from(new Set(ids)), [ids])
  const emptyLineCount = value.split('\n').filter((item) => item.trim().length === 0).length

  const handleDeduplicate = (): void => {
    onChange(uniqueIds.join('\n'))
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Label htmlFor={id} className="text-base font-semibold">
          {label}
        </Label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDeduplicate}
            disabled={disabled || ids.length === uniqueIds.length}
          >
            一键去重
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange('')}
            disabled={disabled || value.length === 0}
          >
            清空
          </Button>
        </div>
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="min-h-[132px] resize-y font-mono"
        placeholder={placeholder}
      />
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-muted-foreground">
          已识别 {ids.length} 个账号
        </span>
        <span className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-muted-foreground">
          去重后 {uniqueIds.length} 个
        </span>
        {emptyLineCount > 0 ? (
          <span className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-muted-foreground">
            空行 {emptyLineCount} 行已忽略
          </span>
        ) : null}
        {duplicateIds.length > 0 ? (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-300">
            存在 {duplicateIds.length} 个重复账号
          </span>
        ) : null}
      </div>
      {duplicateIds.length > 0 ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-300">
          重复账号：{duplicateIds.slice(0, 6).join('、')}
          {duplicateIds.length > 6 ? ` 等 ${duplicateIds.length} 个` : ''}
        </div>
      ) : null}
    </div>
  )
}

const BatchAssistantEmbeddedPanel: React.FC<{
  featureKey: EmbeddedFeatureKey
  onAsyncJobCreated?: (jobId: number) => void
}> = ({ featureKey, onAsyncJobCreated }) => {
  const { configs, loading, error: configError } = useTencentConfigs()
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<TencentBatchLogEntry[]>([])
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [autoAccountIds, setAutoAccountIds] = useState('')
  const [autoOperationType, setAutoOperationType] = useState<'enable' | 'disable'>('enable')
  const [launchAmount, setLaunchAmount] = useState('')

  const [remarkAccountIds, setRemarkAccountIds] = useState('')
  const [remarkOperationType, setRemarkOperationType] = useState<'remark' | 'tag'>('remark')
  const [aliasName, setAliasName] = useState('')
  const [startNumber, setStartNumber] = useState<number>(1)
  const [orgId, setOrgId] = useState('')

  const [clearAccountIds, setClearAccountIds] = useState('')
  const [clearType, setClearType] = useState<AccountAdClearType>('all')

  const [rtaAccountIds, setRtaAccountIds] = useState('')
  const [dimensionType, setDimensionType] = useState<'adgroup' | 'account'>('adgroup')
  const [rtaId, setRtaId] = useState('10079')
  const [strategyId, setStrategyId] = useState('42000')
  const [rtaTargetId, setRtaTargetId] = useState('42000')

  const [bidAccountIds, setBidAccountIds] = useState('')
  const [bidType, setBidType] = useState<'max_conversion' | 'normal_bid_modify' | 'smart_target'>(
    'max_conversion'
  )
  const [controlCost, setControlCost] = useState('')
  const [bidAmount, setBidAmount] = useState('')
  const [deepBidAmount, setDeepBidAmount] = useState('')
  const [activateCost, setActivateCost] = useState('')
  const [retentionCost, setRetentionCost] = useState('')

  const [scheduleAccountIds, setScheduleAccountIds] = useState('')
  const [scheduleOperationType, setScheduleOperationType] = useState<'date' | 'time'>('date')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [weekSchedule, setWeekSchedule] = useState<boolean[][]>(createDefaultWeekSchedule)
  const [isDraggingSchedule, setIsDraggingSchedule] = useState(false)
  const [scheduleDragStart, setScheduleDragStart] = useState<{ day: number; slot: number } | null>(
    null
  )
  const [scheduleDragEnd, setScheduleDragEnd] = useState<{ day: number; slot: number } | null>(null)
  const [scheduleDragTargetState, setScheduleDragTargetState] = useState<boolean | null>(null)

  useEffect(() => {
    if (!selectedConfigId && configs.length > 0) {
      setSelectedConfigId(configs[0].id)
    }
  }, [configs, selectedConfigId])

  useEffect(() => {
    setError(configError)
  }, [configError])

  useEffect(() => {
    const today = new Date()
    const nextYear = new Date(today)
    nextYear.setFullYear(today.getFullYear() + 1)

    const formatDate = (date: Date): string => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    setStartDate(formatDate(today))
    setEndDate(formatDate(nextYear))
  }, [])

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info'): void => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }])
  }

  const clearLogs = (): void => {
    setLogs([])
  }

  const parseIds = parseAccountInput

  const handleAutoSubmit = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个账号配置')
      return
    }

    const accountIdList = parseIds(autoAccountIds)
    if (accountIdList.length === 0) {
      setError('请输入至少一个广告账户ID')
      return
    }

    if (autoOperationType === 'enable') {
      if (!launchAmount.trim()) {
        setError('开启一键起量时，起量金额为必填项')
        return
      }
      const amount = parseFloat(launchAmount)
      if (Number.isNaN(amount) || amount < 200) {
        setError('起量金额最低为200元')
        return
      }
      if (amount > 100000) {
        setError('起量金额最高为100000元')
        return
      }
    }

    setIsSubmitting(true)
    setError('')
    clearLogs()
    setIsLogPanelOpen(true)

    try {
      const operationText = autoOperationType === 'enable' ? '开启' : '关闭'
      addLog(`开始批量${operationText}一键起量，账户数: ${accountIdList.length}`, 'info')
      if (autoOperationType === 'enable') {
        addLog(`起量金额: ${launchAmount}元`, 'info')
      }

      const jobResponse = await tencentBatchAssistantJobService.createJob({
        job_type: 'auto_acquisition',
        payload: {
          account_ids: accountIdList,
          operation_type: autoOperationType,
          selected_cookie_id: selectedConfigId,
          launch_amount: autoOperationType === 'enable' ? parseFloat(launchAmount) : undefined
        }
      })

      if (jobResponse.code !== 0) {
        throw new Error(jobResponse.msg || '创建异步任务失败')
      }

      addLog(`异步任务已提交，任务ID: ${jobResponse.job_id}`, 'success')
      addLog('任务将在独立 Worker 容器中执行，可从任务记录查看进度', 'info')
      onAsyncJobCreated?.(jobResponse.job_id)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '操作失败，请稍后重试'
      setError(errorMessage)
      addLog(`错误: ${errorMessage}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemarkSubmit = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个账号配置')
      return
    }

    const accountIdList = parseIds(remarkAccountIds)
    if (accountIdList.length === 0) {
      setError('请输入至少一个账号ID')
      return
    }
    if (!aliasName.trim()) {
      setError('请输入备注/标签名称')
      return
    }
    if (accountIdList.length > 1 && (Number.isNaN(startNumber) || startNumber < 0)) {
      setError('起始数字必须是大于等于0的整数')
      return
    }
    if (remarkOperationType === 'tag' && !orgId.trim()) {
      setError('选择标签操作时必须填写组织ID')
      return
    }

    setIsSubmitting(true)
    setError('')
    clearLogs()
    setIsLogPanelOpen(true)

    try {
      const operationText = remarkOperationType === 'remark' ? '修改备注' : '更新标签'
      addLog(
        `开始批量${operationText} ${accountIdList.length} 个账号${accountIdList.length > 1 ? `（起始数字: ${startNumber}）` : ''}...`,
        'info'
      )
      addLog('已切换为异步任务模式，提交后将由腾讯批量助手 Worker 执行', 'info')

      const jobResponse = await tencentBatchAssistantJobService.createJob({
        job_type: 'account_remark',
        payload: {
          account_ids: accountIdList,
          operation_type: remarkOperationType,
          selected_cookie_id: selectedConfigId,
          alias_name: aliasName.trim(),
          start_number: startNumber,
          org_id: remarkOperationType === 'tag' ? orgId.trim() : undefined
        }
      })

      if (jobResponse.code !== 0) {
        throw new Error(jobResponse.msg || '创建异步任务失败')
      }

      addLog(`异步任务已提交，任务ID: ${jobResponse.job_id}`, 'success')
      addLog('任务将在独立 Worker 容器中执行，可从任务记录查看进度', 'info')
      onAsyncJobCreated?.(jobResponse.job_id)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '操作失败，请稍后重试'
      setError(errorMessage)
      addLog(`错误: ${errorMessage}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAccountAdClearSubmit = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个账号配置')
      return
    }

    const accountIdList = parseIds(clearAccountIds)
    if (accountIdList.length === 0) {
      setError('请输入至少一个账号ID')
      return
    }

    const invalidAccountId = accountIdList.find((accountId) => !/^\d+$/.test(accountId))
    if (invalidAccountId) {
      setError(`存在无效账号：${invalidAccountId}`)
      return
    }

    const clearTypeLabel = ACCOUNT_AD_CLEAR_TYPE_LABELS[clearType]
    const confirmed = window.confirm(
      `确认清空 ${accountIdList.length} 个账号下的${clearTypeLabel}营销单元？该操作不可逆。`
    )
    if (!confirmed) return

    setIsSubmitting(true)
    setError('')
    clearLogs()
    setIsLogPanelOpen(true)

    try {
      addLog(`准备提交账户广告清空任务，账户数: ${accountIdList.length}`, 'info')
      addLog(`清除类型: ${clearTypeLabel}`, 'info')
      addLog('高风险异步任务已提交前确认，提交后将由腾讯批量助手 Worker 执行', 'info')

      const jobResponse = await tencentBatchAssistantJobService.createJob({
        job_type: 'account_ad_clear',
        payload: {
          account_ids: accountIdList,
          selected_cookie_id: selectedConfigId,
          clear_type: clearType
        }
      })

      if (jobResponse.code !== 0) {
        throw new Error(jobResponse.msg || '创建异步任务失败')
      }

      addLog(`异步任务已提交，任务ID: ${jobResponse.job_id}`, 'success')
      addLog('任务将在独立 Worker 容器中执行，可从任务记录查看进度', 'info')
      onAsyncJobCreated?.(jobResponse.job_id)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '操作失败，请稍后重试'
      setError(errorMessage)
      addLog(`错误: ${errorMessage}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRtaSubmit = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个账号配置')
      return
    }

    const accountIdList = parseIds(rtaAccountIds)
    if (accountIdList.length === 0) {
      setError('请输入至少一个账号ID')
      return
    }
    if (dimensionType === 'adgroup') {
      if (!rtaId.trim()) {
        setError('请填写RTA ID')
        return
      }
      if (!strategyId.trim()) {
        setError('请填写策略ID')
        return
      }
    } else if (!rtaTargetId.trim()) {
      setError('请填写RTA策略')
      return
    }

    setIsSubmitting(true)
    setError('')
    clearLogs()
    setIsLogPanelOpen(true)

    try {
      if (dimensionType === 'adgroup') {
        addLog(
          `开始批量修改RTA ${accountIdList.length} 个账号（在投广告维度）... (RTA ID: ${rtaId}, 策略ID: ${strategyId})`,
          'info'
        )
      } else {
        addLog(
          `开始批量修改RTA ${accountIdList.length} 个账号（账户维度）... (RTA策略: ${rtaTargetId})`,
          'info'
        )
      }
      addLog('已切换为异步任务模式，提交后将由腾讯批量助手 Worker 执行', 'info')

      const jobResponse = await tencentBatchAssistantJobService.createJob({
        job_type: 'rta_modify',
        payload: {
          account_ids: accountIdList,
          selected_cookie_id: selectedConfigId,
          dimension_type: dimensionType,
          ...(dimensionType === 'adgroup'
            ? { rta_id: rtaId.trim(), strategy_id: strategyId.trim() }
            : { rta_target_id: rtaTargetId.trim() })
        }
      })

      if (jobResponse.code !== 0) {
        throw new Error(jobResponse.msg || '创建异步任务失败')
      }

      addLog(`异步任务已提交，任务ID: ${jobResponse.job_id}`, 'success')
      addLog('任务将在独立 Worker 容器中执行，可从任务记录查看进度', 'info')
      onAsyncJobCreated?.(jobResponse.job_id)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '操作失败，请稍后重试'
      setError(errorMessage)
      addLog(`错误: ${errorMessage}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBidSubmit = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个账号配置')
      return
    }

    const accountIdList = parseIds(bidAccountIds)
    if (accountIdList.length === 0) {
      setError('请输入至少一个广告账户ID')
      return
    }

    if (bidType === 'max_conversion') {
      if (!controlCost || parseFloat(controlCost) <= 0) {
        setError('请输入有效的控制成本')
        return
      }
    } else if (bidType === 'normal_bid_modify') {
      if (
        (!bidAmount || parseFloat(bidAmount) <= 0) &&
        (!deepBidAmount || parseFloat(deepBidAmount) <= 0)
      ) {
        setError('请至少输入一个出价（出价金额或深度目标出价）')
        return
      }
    } else if (!activateCost && !retentionCost) {
      setError('请至少输入一个成本值（激活成本或次留成本）')
      return
    }

    setIsSubmitting(true)
    setError('')
    clearLogs()
    setIsLogPanelOpen(true)

    try {
      addLog(`开始批量修改出价，账户数: ${accountIdList.length}`, 'info')

      if (bidType === 'normal_bid_modify') {
        addLog('出价类型: 常规修改出价', 'info')
        if (bidAmount) addLog(`出价金额: ${bidAmount}元`, 'info')
        if (deepBidAmount) addLog(`深度目标出价: ${deepBidAmount}元`, 'info')
        addLog('已切换为异步任务模式，提交后将由腾讯批量助手 Worker 执行', 'info')

        const jobResponse = await tencentBatchAssistantJobService.createJob({
          job_type: 'normal_bid_modify',
          payload: {
            account_ids: accountIdList,
            selected_cookie_id: selectedConfigId,
            bid_amount: bidAmount ? parseFloat(bidAmount) * 100 : undefined,
            deep_conversion_behavior_bid: deepBidAmount ? parseFloat(deepBidAmount) : undefined
          }
        })

        if (jobResponse.code !== 0) {
          throw new Error(jobResponse.msg || '创建异步任务失败')
        }

        addLog(`异步任务已提交，任务ID: ${jobResponse.job_id}`, 'success')
        addLog('任务将在独立 Worker 容器中执行，可从任务记录查看进度', 'info')
        onAsyncJobCreated?.(jobResponse.job_id)
      } else if (bidType === 'smart_target') {
        addLog('出价类型: 智投投放目标', 'info')
        if (activateCost) addLog(`激活成本: ${activateCost}元`, 'info')
        if (retentionCost) addLog(`次留成本: ${retentionCost}元`, 'info')
        addLog('已切换为异步任务模式，提交后将由腾讯批量助手 Worker 执行', 'info')

        const jobResponse = await tencentBatchAssistantJobService.createJob({
          job_type: 'smart_target_modify',
          payload: {
            account_ids: accountIdList,
            selected_cookie_id: selectedConfigId,
            activate_cost: activateCost ? parseFloat(activateCost) : undefined,
            retention_cost: retentionCost ? parseFloat(retentionCost) : undefined
          }
        })

        if (jobResponse.code !== 0) {
          throw new Error(jobResponse.msg || '创建异步任务失败')
        }

        addLog(`异步任务已提交，任务ID: ${jobResponse.job_id}`, 'success')
        addLog('任务将在独立 Worker 容器中执行，可从任务记录查看进度', 'info')
        onAsyncJobCreated?.(jobResponse.job_id)
      } else {
        addLog(`出价类型: 最大转化量投放，控制成本: ${controlCost}元`, 'info')
        addLog('已切换为异步任务模式，提交后将由腾讯批量助手 Worker 执行', 'info')

        const jobResponse = await tencentBatchAssistantJobService.createJob({
          job_type: 'batch_modify_bids',
          payload: {
            account_ids: accountIdList,
            bid_type: 'max_conversion',
            selected_cookie_id: selectedConfigId,
            control_cost: parseFloat(controlCost)
          }
        })

        if (jobResponse.code !== 0) {
          throw new Error(jobResponse.msg || '创建异步任务失败')
        }

        addLog(`异步任务已提交，任务ID: ${jobResponse.job_id}`, 'success')
        addLog('任务将在独立 Worker 容器中执行，可稍后从任务记录查看进度', 'info')
        onAsyncJobCreated?.(jobResponse.job_id)
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '修改失败，请稍后重试'
      setError(errorMessage)
      addLog(`错误: ${errorMessage}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleScheduleMouseDown = (day: number, slot: number): void => {
    setIsDraggingSchedule(true)
    const startPos = { day, slot }
    setScheduleDragStart(startPos)
    setScheduleDragEnd(startPos)

    const targetState = !weekSchedule[day][slot]
    setScheduleDragTargetState(targetState)
    setWeekSchedule((prev) =>
      prev.map((daySlots, dayIndex) =>
        dayIndex === day
          ? daySlots.map((selected, slotIndex) => (slotIndex === slot ? targetState : selected))
          : daySlots
      )
    )
  }

  const getScheduleDragRange = (
    start: { day: number; slot: number },
    end: { day: number; slot: number }
  ): { startDay: number; endDay: number; startSlot: number; endSlot: number } => ({
    startDay: Math.min(start.day, end.day),
    endDay: Math.max(start.day, end.day),
    startSlot:
      start.day === end.day
        ? Math.min(start.slot, end.slot)
        : start.day < end.day
          ? start.slot
          : end.slot,
    endSlot:
      start.day === end.day
        ? Math.max(start.slot, end.slot)
        : start.day < end.day
          ? end.slot
          : start.slot
  })

  const handleScheduleMouseMove = (day: number, slot: number): void => {
    if (!isDraggingSchedule || !scheduleDragStart || scheduleDragTargetState === null) return

    const newEnd = { day, slot }
    setScheduleDragEnd(newEnd)
    const { startDay, endDay, startSlot, endSlot } = getScheduleDragRange(scheduleDragStart, newEnd)

    setWeekSchedule((prev) =>
      prev.map((daySlots, dayIndex) => {
        if (dayIndex < startDay || dayIndex > endDay) return daySlots

        return daySlots.map((selected, slotIndex) => {
          const inSingleDayRange =
            dayIndex === startDay &&
            dayIndex === endDay &&
            slotIndex >= startSlot &&
            slotIndex <= endSlot
          const inStartDayRange =
            dayIndex === startDay && dayIndex !== endDay && slotIndex >= startSlot
          const inEndDayRange = dayIndex === endDay && dayIndex !== startDay && slotIndex <= endSlot
          const inMiddleDayRange = dayIndex > startDay && dayIndex < endDay

          return inSingleDayRange || inStartDayRange || inEndDayRange || inMiddleDayRange
            ? scheduleDragTargetState
            : selected
        })
      })
    )
  }

  const handleScheduleMouseUp = (): void => {
    setIsDraggingSchedule(false)
    setScheduleDragStart(null)
    setScheduleDragEnd(null)
    setScheduleDragTargetState(null)
  }

  const isInScheduleDragRange = (day: number, slot: number): boolean => {
    if (!isDraggingSchedule || !scheduleDragStart || !scheduleDragEnd) return false

    const { startDay, endDay, startSlot, endSlot } = getScheduleDragRange(
      scheduleDragStart,
      scheduleDragEnd
    )

    if (day < startDay || day > endDay) return false
    if (day === startDay && day === endDay) return slot >= startSlot && slot <= endSlot
    if (day === startDay) return slot >= startSlot
    if (day === endDay) return slot <= endSlot
    return true
  }

  const handleScheduleSubmit = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个账号配置')
      return
    }

    const accountIdList = parseIds(scheduleAccountIds)
    if (accountIdList.length === 0) {
      setError('请输入至少一个广告账户ID')
      return
    }

    if (scheduleOperationType === 'date') {
      if (!startDate || !endDate) {
        setError('请选择日期区间')
        return
      }

      if (new Date(startDate) > new Date(endDate)) {
        setError('开始日期不能大于结束日期')
        return
      }
    } else {
      const hasSelection = weekSchedule.some((daySlots) => daySlots.some((selected) => selected))
      if (!hasSelection) {
        setError('请选择投放时段')
        return
      }
    }

    setIsSubmitting(true)
    setError('')
    clearLogs()
    setIsLogPanelOpen(true)

    try {
      const operationText = scheduleOperationType === 'date' ? '修改投放日期' : '修改投放时段'
      const weekScheduleFormatted =
        scheduleOperationType === 'time'
          ? weekSchedule.map((daySlots) =>
              daySlots
                .map((selected, index) => (selected ? index : null))
                .filter((value): value is number => value !== null)
            )
          : undefined

      addLog(`开始批量${operationText}，账户数: ${accountIdList.length}`, 'info')
      if (scheduleOperationType === 'date') {
        addLog(`日期区间: ${startDate} 至 ${endDate}`, 'info')
      } else {
        addLog('已读取投放时段配置，将按 7 天 × 48 个半小时时段提交', 'info')
      }
      addLog('已切换为异步任务模式，提交后将由腾讯批量助手 Worker 执行', 'info')

      const jobResponse = await tencentBatchAssistantJobService.createJob({
        job_type: 'schedule_management',
        payload: {
          account_ids: accountIdList,
          operation_type: scheduleOperationType,
          selected_cookie_id: selectedConfigId,
          start_date: scheduleOperationType === 'date' ? startDate : undefined,
          end_date: scheduleOperationType === 'date' ? endDate : undefined,
          week_schedule: weekScheduleFormatted
        }
      })

      if (jobResponse.code !== 0) {
        throw new Error(jobResponse.msg || '创建异步任务失败')
      }

      addLog(`异步任务已提交，任务ID: ${jobResponse.job_id}`, 'success')
      addLog('任务将在独立 Worker 容器中执行，可从任务记录查看进度', 'info')
      onAsyncJobCreated?.(jobResponse.job_id)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '操作失败，请稍后重试'
      setError(errorMessage)
      addLog(`错误: ${errorMessage}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitHandler =
    featureKey === 'auto-acquisition'
      ? handleAutoSubmit
      : featureKey === 'account-remark'
        ? handleRemarkSubmit
        : featureKey === 'account-ad-clear'
          ? handleAccountAdClearSubmit
          : featureKey === 'rta'
            ? handleRtaSubmit
            : featureKey === 'bid-management'
              ? handleBidSubmit
              : handleScheduleSubmit

  const currentMeta = embeddedFeatureMeta[featureKey]

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/70 bg-muted/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-background shadow-sm">
                  {featureKey === 'auto-acquisition' ? (
                    <Rocket className="h-5 w-5 text-primary" />
                  ) : featureKey === 'account-remark' ? (
                    <Tag className="h-5 w-5 text-primary" />
                  ) : featureKey === 'account-ad-clear' ? (
                    <Trash2 className="h-5 w-5 text-destructive" />
                  ) : featureKey === 'bid-management' ? (
                    <DollarSign className="h-5 w-5 text-primary" />
                  ) : featureKey === 'schedule-management' ? (
                    <Clock className="h-5 w-5 text-primary" />
                  ) : (
                    <Settings className="h-5 w-5 text-primary" />
                  )}
                </span>
                <span>{currentMeta.title}</span>
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6">
                {currentMeta.description}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                当前操作
              </span>
              <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                三步完成
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 bg-muted/[0.08] p-4 sm:p-6">
          <StepSection
            step={1}
            title="选择账号配置"
            description="选择用于调用腾讯广告接口的 Cookie 配置。"
          >
            <TencentConfigSelector
              configs={configs}
              loading={loading}
              selectedConfigId={selectedConfigId}
              onSelect={setSelectedConfigId}
            />
          </StepSection>

          <StepSection
            step={2}
            title="输入操作对象"
            description="按行粘贴需要批量处理的账号 ID，空行会被自动忽略。"
          >
            {featureKey === 'auto-acquisition' ? (
              <>
                <AccountIdsInput
                  id="autoAccountIds"
                  label="广告账户列表 (一行一个) *"
                  value={autoAccountIds}
                  onChange={setAutoAccountIds}
                  disabled={isSubmitting}
                  placeholder="请输入广告账户ID，每行填写一个"
                />
                <div className="space-y-3">
                  <Label className="text-base font-semibold">操作类型 *</Label>
                  <RadioGroup
                    value={autoOperationType}
                    onValueChange={(value) => setAutoOperationType(value as 'enable' | 'disable')}
                    disabled={isSubmitting}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="enable" id="auto-enable" />
                      <Label htmlFor="auto-enable" className="cursor-pointer font-normal">
                        开启一键起量
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="disable" id="auto-disable" />
                      <Label htmlFor="auto-disable" className="cursor-pointer font-normal">
                        关闭一键起量
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                {autoOperationType === 'enable' ? (
                  <div className="grid gap-2">
                    <Label htmlFor="launchAmount" className="text-base font-semibold">
                      起量金额 (元) *
                    </Label>
                    <Input
                      id="launchAmount"
                      type="number"
                      step="0.01"
                      min="200"
                      max="100000"
                      value={launchAmount}
                      onChange={(event) => setLaunchAmount(event.target.value)}
                      disabled={isSubmitting}
                      placeholder="请输入开启一键起量时的预算金额（200-100000元）"
                      className="h-11"
                    />
                  </div>
                ) : null}
              </>
            ) : null}
          </StepSection>

          <StepSection
            step={3}
            title="设置操作参数"
            description="根据当前功能填写批量操作参数，确认无误后再执行。"
          >
            {featureKey === 'account-remark' ? (
              <>
                <AccountIdsInput
                  id="remarkAccountIds"
                  label="账号列表 (一行一个) *"
                  value={remarkAccountIds}
                  onChange={setRemarkAccountIds}
                  disabled={isSubmitting}
                  placeholder="请输入账号ID，每行一个"
                />
                <div className="grid gap-2">
                  <Label className="text-base font-semibold">操作类型 *</Label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={remarkOperationType === 'remark'}
                        onChange={() => setRemarkOperationType('remark')}
                        disabled={isSubmitting}
                      />
                      备注
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={remarkOperationType === 'tag'}
                        onChange={() => setRemarkOperationType('tag')}
                        disabled={isSubmitting}
                      />
                      标签
                    </label>
                  </div>
                </div>
                {remarkOperationType === 'tag' ? (
                  <div className="grid gap-2">
                    <Label htmlFor="orgId" className="text-base font-semibold">
                      组织ID *
                    </Label>
                    <Input
                      id="orgId"
                      value={orgId}
                      onChange={(event) => setOrgId(event.target.value)}
                      disabled={isSubmitting}
                      className="h-11"
                      placeholder="请输入组织ID"
                    />
                  </div>
                ) : null}
                <div className="grid gap-2">
                  <Label htmlFor="aliasName" className="text-base font-semibold">
                    备注/标签名称 *
                  </Label>
                  <Input
                    id="aliasName"
                    value={aliasName}
                    onChange={(event) => setAliasName(event.target.value)}
                    disabled={isSubmitting}
                    className="h-11"
                    placeholder="请输入备注/标签名称"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="startNumber" className="text-base font-semibold">
                    起始数字
                  </Label>
                  <Input
                    id="startNumber"
                    type="number"
                    min="0"
                    max="999"
                    value={String(startNumber)}
                    onChange={(event) => setStartNumber(parseInt(event.target.value, 10) || 1)}
                    disabled={isSubmitting}
                    className="h-11"
                  />
                </div>
              </>
            ) : null}

            {featureKey === 'account-ad-clear' ? (
              <>
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm leading-6 text-destructive">
                  账户广告清空属于高风险不可逆操作。提交前会再次确认，提交后由独立 Worker
                  执行，执行进度请在任务记录中查看。
                </div>
                <AccountIdsInput
                  id="clearAccountIds"
                  label="账号列表 (一行一个) *"
                  value={clearAccountIds}
                  onChange={setClearAccountIds}
                  disabled={isSubmitting}
                  placeholder="请输入需要清空广告的账号ID，每行一个"
                />
                <div className="grid gap-2">
                  <Label className="text-base font-semibold">清除类型 *</Label>
                  <RadioGroup
                    value={clearType}
                    onValueChange={(value) => setClearType(value as AccountAdClearType)}
                    disabled={isSubmitting}
                    className="flex flex-wrap gap-6"
                  >
                    {(Object.keys(ACCOUNT_AD_CLEAR_TYPE_LABELS) as AccountAdClearType[]).map(
                      (type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <RadioGroupItem value={type} id={`clear-type-${type}`} />
                          <Label
                            htmlFor={`clear-type-${type}`}
                            className="cursor-pointer font-normal"
                          >
                            {ACCOUNT_AD_CLEAR_TYPE_LABELS[type]}
                          </Label>
                        </div>
                      )
                    )}
                  </RadioGroup>
                </div>
              </>
            ) : null}

            {featureKey === 'rta' ? (
              <>
                <AccountIdsInput
                  id="rtaAccountIds"
                  label="账号列表 (一行一个) *"
                  value={rtaAccountIds}
                  onChange={setRtaAccountIds}
                  disabled={isSubmitting}
                  placeholder="请输入账号ID，每行一个"
                />
                <div className="grid gap-2">
                  <Label className="text-base font-semibold">RTA修改类型维度 *</Label>
                  <RadioGroup
                    value={dimensionType}
                    onValueChange={(value) => setDimensionType(value as 'adgroup' | 'account')}
                    disabled={isSubmitting}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="adgroup" id="dimension-adgroup-inline" />
                      <Label
                        htmlFor="dimension-adgroup-inline"
                        className="cursor-pointer font-normal"
                      >
                        在投广告维度
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="account" id="dimension-account-inline" />
                      <Label
                        htmlFor="dimension-account-inline"
                        className="cursor-pointer font-normal"
                      >
                        账户维度
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                {dimensionType === 'adgroup' ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="rtaId" className="text-base font-semibold">
                        RTA ID *
                      </Label>
                      <Input
                        id="rtaId"
                        value={rtaId}
                        onChange={(event) => setRtaId(event.target.value)}
                        disabled={isSubmitting}
                        className="h-11"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="strategyId" className="text-base font-semibold">
                        策略ID *
                      </Label>
                      <Input
                        id="strategyId"
                        value={strategyId}
                        onChange={(event) => setStrategyId(event.target.value)}
                        disabled={isSubmitting}
                        className="h-11"
                      />
                    </div>
                  </>
                ) : (
                  <div className="grid gap-2">
                    <Label htmlFor="rtaTargetId" className="text-base font-semibold">
                      RTA策略 *
                    </Label>
                    <Input
                      id="rtaTargetId"
                      value={rtaTargetId}
                      onChange={(event) => setRtaTargetId(event.target.value)}
                      disabled={isSubmitting}
                      className="h-11"
                    />
                  </div>
                )}
              </>
            ) : null}

            {featureKey === 'bid-management' ? (
              <>
                <AccountIdsInput
                  id="bidAccountIds"
                  label="广告账户列表 (一行一个) *"
                  value={bidAccountIds}
                  onChange={setBidAccountIds}
                  disabled={isSubmitting}
                  placeholder="请输入广告账户ID，每行填写一个"
                />
                <div className="grid gap-2">
                  <Label className="text-base font-semibold">出价类型 *</Label>
                  <RadioGroup
                    value={bidType}
                    onValueChange={(value) =>
                      setBidType(value as 'max_conversion' | 'normal_bid_modify' | 'smart_target')
                    }
                    disabled={isSubmitting}
                    className="grid gap-3"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="max_conversion" id="bid-max-conversion" />
                      <Label htmlFor="bid-max-conversion" className="cursor-pointer font-normal">
                        最大转化量投放
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="normal_bid_modify" id="bid-normal-modify" />
                      <Label htmlFor="bid-normal-modify" className="cursor-pointer font-normal">
                        常规修改出价
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="smart_target" id="bid-smart-target" />
                      <Label htmlFor="bid-smart-target" className="cursor-pointer font-normal">
                        智投投放目标
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                {bidType === 'max_conversion' ? (
                  <div className="grid gap-2">
                    <Label htmlFor="controlCost" className="text-base font-semibold">
                      控制成本 (元) *
                    </Label>
                    <Input
                      id="controlCost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={controlCost}
                      onChange={(event) => setControlCost(event.target.value)}
                      disabled={isSubmitting}
                      className="h-11"
                      placeholder="请输入控制成本"
                    />
                  </div>
                ) : null}
                {bidType === 'normal_bid_modify' ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="bidAmount" className="text-base font-semibold">
                        出价金额 (元)
                      </Label>
                      <Input
                        id="bidAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={bidAmount}
                        onChange={(event) => setBidAmount(event.target.value)}
                        disabled={isSubmitting}
                        className="h-11"
                        placeholder="可选"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="deepBidAmount" className="text-base font-semibold">
                        深度目标出价 (元)
                      </Label>
                      <Input
                        id="deepBidAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={deepBidAmount}
                        onChange={(event) => setDeepBidAmount(event.target.value)}
                        disabled={isSubmitting}
                        className="h-11"
                        placeholder="可选"
                      />
                    </div>
                  </div>
                ) : null}
                {bidType === 'smart_target' ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="activateCost" className="text-base font-semibold">
                        激活成本 (元)
                      </Label>
                      <Input
                        id="activateCost"
                        type="number"
                        step="0.01"
                        min="0"
                        value={activateCost}
                        onChange={(event) => setActivateCost(event.target.value)}
                        disabled={isSubmitting}
                        className="h-11"
                        placeholder="可选"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="retentionCost" className="text-base font-semibold">
                        次留成本 (元)
                      </Label>
                      <Input
                        id="retentionCost"
                        type="number"
                        step="0.01"
                        min="0"
                        value={retentionCost}
                        onChange={(event) => setRetentionCost(event.target.value)}
                        disabled={isSubmitting}
                        className="h-11"
                        placeholder="可选"
                      />
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {featureKey === 'schedule-management' ? (
              <>
                <AccountIdsInput
                  id="scheduleAccountIds"
                  label="广告账户列表 (一行一个) *"
                  value={scheduleAccountIds}
                  onChange={setScheduleAccountIds}
                  disabled={isSubmitting}
                  placeholder="请输入广告账户ID，每行填写一个"
                />
                <div className="grid gap-2">
                  <Label className="text-base font-semibold">操作类型 *</Label>
                  <RadioGroup
                    value={scheduleOperationType}
                    onValueChange={(value) => setScheduleOperationType(value as 'date' | 'time')}
                    disabled={isSubmitting}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="date" id="schedule-date" />
                      <Label htmlFor="schedule-date" className="cursor-pointer font-normal">
                        修改投放日期
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="time" id="schedule-time" />
                      <Label htmlFor="schedule-time" className="cursor-pointer font-normal">
                        修改投放时段
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                {scheduleOperationType === 'date' ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="startDate" className="text-base font-semibold">
                        开始日期 *
                      </Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        disabled={isSubmitting}
                        className="h-11"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="endDate" className="text-base font-semibold">
                        结束日期 *
                      </Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        disabled={isSubmitting}
                        className="h-11"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">投放时段设置 *</Label>
                    <div
                      className="rounded-lg border border-border/70 bg-background p-4"
                      onMouseLeave={handleScheduleMouseUp}
                      onMouseUp={handleScheduleMouseUp}
                    >
                      <div className="mb-2 flex">
                        <div className="w-16 flex-shrink-0" />
                        <div className="flex flex-1">
                          {Array.from({ length: 24 }, (_, hour) => (
                            <div
                              key={hour}
                              className="flex-1 text-center text-xs text-muted-foreground"
                            >
                              {hour}
                            </div>
                          ))}
                        </div>
                      </div>

                      {TENCENT_SCHEDULE_DAY_NAMES.map((dayName, dayIndex) => (
                        <div key={dayName} className="mb-1 flex items-center">
                          <div className="w-16 flex-shrink-0 text-sm text-muted-foreground">
                            {dayName}
                          </div>
                          <div className="flex flex-1">
                            {Array.from({ length: 24 }, (_, hour) => (
                              <div key={hour} className="flex flex-1">
                                {[0, 1].map((half) => {
                                  const slotIndex = hour * 2 + half
                                  const isSelected = weekSchedule[dayIndex][slotIndex]
                                  const inDragRange = isInScheduleDragRange(dayIndex, slotIndex)

                                  return (
                                    <div
                                      key={slotIndex}
                                      className={`h-6 flex-1 cursor-pointer select-none border-b border-r transition-colors ${
                                        isSelected
                                          ? 'bg-primary hover:bg-primary/80'
                                          : inDragRange
                                            ? 'bg-primary/50 hover:bg-primary/60'
                                            : 'bg-muted/30 hover:bg-accent'
                                      }`}
                                      onMouseDown={(event) => {
                                        event.preventDefault()
                                        handleScheduleMouseDown(dayIndex, slotIndex)
                                      }}
                                      onMouseEnter={() =>
                                        handleScheduleMouseMove(dayIndex, slotIndex)
                                      }
                                      title={`${dayName} ${hour}:${half === 0 ? '00' : '30'}`}
                                    />
                                  )
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      <p className="mt-3 text-xs text-muted-foreground">
                        提示：点击或拖动选择时间段，蓝色表示投放，灰色表示不投放。
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </StepSection>

          {error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end border-t pt-4">
            <Button
              onClick={submitHandler}
              disabled={isSubmitting}
              size="lg"
              className="min-w-[140px]"
            >
              {isSubmitting ? (
                <>
                  <Settings className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <Settings className="mr-2 h-4 w-4" />
                  确认执行
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <TencentBatchLogPanel
        logs={logs}
        isOpen={isLogPanelOpen}
        isSubmitting={isSubmitting}
        onToggle={() => setIsLogPanelOpen((prev) => !prev)}
        onClear={clearLogs}
        title={`${currentMeta.title}日志`}
        description="查看批量操作的执行过程与结果"
      />
    </div>
  )
}

export const BatchAssistantPage: React.FC = () => {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [activeEmbeddedFeature, setActiveEmbeddedFeature] =
    useState<EmbeddedFeatureKey>('auto-acquisition')
  const [jobRefreshToken, setJobRefreshToken] = useState(0)
  const [focusedJobId, setFocusedJobId] = useState<number | null>(null)
  const [isJobCenterOpen, setIsJobCenterOpen] = useState(false)

  const handleAsyncJobCreated = (jobId: number): void => {
    setFocusedJobId(jobId)
    setJobRefreshToken((prev) => prev + 1)
    setIsJobCenterOpen(true)
  }

  const normalizedKeyword = searchKeyword.trim().toLowerCase()
  const visibleFeatures = useMemo(() => {
    return TENCENT_BATCH_ASSISTANT_FEATURES.filter((feature) => {
      if (normalizedKeyword.length === 0) return true
      return (
        feature.title.toLowerCase().includes(normalizedKeyword) ||
        feature.description.toLowerCase().includes(normalizedKeyword) ||
        feature.keywords.some((keyword) => keyword.toLowerCase().includes(normalizedKeyword))
      )
    })
  }, [normalizedKeyword])

  const activeFeature = TENCENT_BATCH_ASSISTANT_FEATURES.find(
    (feature) => feature.key === activeEmbeddedFeature
  )
  const embeddedCount = TENCENT_BATCH_ASSISTANT_FEATURES.filter((feature) =>
    EMBEDDED_FEATURE_KEYS.has(feature.key)
  ).length
  const professionalCount = TENCENT_BATCH_ASSISTANT_FEATURES.length - embeddedCount
  const groupedFeatures = TENCENT_BATCH_ASSISTANT_FEATURES.reduce(
    (groups, feature) => {
      if (!visibleFeatures.some((item) => item.key === feature.key)) return groups
      groups[feature.group].push(feature)
      return groups
    },
    {
      delivery: [],
      account: [],
      asset: [],
      advanced: []
    } as Record<TencentBatchAssistantFeatureGroup, typeof TENCENT_BATCH_ASSISTANT_FEATURES>
  )

  return (
    <div className="space-y-6">
      <motion.section
        className="relative overflow-hidden rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.58)] sm:p-8"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_58%)]" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Tencent Batch Workspace
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">腾讯批量助手</h1>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                统一选择功能、账号配置和批量参数，减少在多个页面之间来回切换。当前聚焦投放调控与账户设置等高频批量动作。
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/75 px-4 py-4">
              <div className="text-sm font-medium text-muted-foreground">已内嵌能力</div>
              <div className="mt-2 text-3xl font-semibold text-foreground">{embeddedCount}</div>
              <div className="mt-1 text-sm text-muted-foreground">可直接执行</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/75 px-4 py-4">
              <div className="text-sm font-medium text-muted-foreground">专业页面</div>
              <div className="mt-2 text-3xl font-semibold text-foreground">{professionalCount}</div>
              <div className="mt-1 text-sm text-muted-foreground">复杂场景跳转</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/75 px-4 py-4">
              <div className="text-sm font-medium text-muted-foreground">当前功能</div>
              <div className="mt-2 truncate text-lg font-semibold text-foreground">
                {activeFeature?.title}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">三步完成配置</div>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card className="overflow-hidden border-border/70">
            <CardHeader className="space-y-4 border-b border-border/70 bg-muted/20">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Settings2 className="h-5 w-5 text-primary" />
                  批量操作
                </CardTitle>
                <CardDescription>选择一个功能后，在右侧完成批量操作。</CardDescription>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder="搜索功能或关键词"
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-3">
              {Object.entries(groupedFeatures).map(([group, features]) => {
                if (features.length === 0) return null
                return (
                  <div key={group} className="space-y-2">
                    <div className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {FEATURE_GROUP_LABELS[group as TencentBatchAssistantFeatureGroup]}
                    </div>
                    <div className="space-y-1.5">
                      {features.map((feature) => {
                        const Icon = feature.icon
                        const isEmbedded = EMBEDDED_FEATURE_KEYS.has(feature.key)
                        const isActive = activeEmbeddedFeature === feature.key

                        if (!isEmbedded) {
                          return (
                            <Link
                              key={feature.key}
                              to={feature.path}
                              className="group flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-sm transition-colors hover:border-border/70 hover:bg-accent/50"
                            >
                              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background">
                                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-foreground">
                                  {feature.title}
                                </span>
                                <span className="mt-1 inline-flex rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                                  专业页
                                </span>
                              </span>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </Link>
                          )
                        }

                        return (
                          <button
                            key={feature.key}
                            type="button"
                            onClick={() =>
                              setActiveEmbeddedFeature(feature.key as EmbeddedFeatureKey)
                            }
                            className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm transition-colors ${
                              isActive
                                ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
                                : 'border-transparent hover:border-border/70 hover:bg-accent/50'
                            }`}
                          >
                            <span
                              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border ${
                                isActive
                                  ? 'border-primary/30 bg-background'
                                  : 'border-border/70 bg-background'
                              }`}
                            >
                              <Icon
                                className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-foreground">
                                {feature.title}
                              </span>
                              <span
                                className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] ${
                                  isActive
                                    ? 'border-primary/20 bg-primary/10 text-primary'
                                    : 'border-border/70 text-muted-foreground'
                                }`}
                              >
                                可直接操作
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {visibleFeatures.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
                  未找到匹配功能
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-muted/20">
            <CardContent className="space-y-3 p-4 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">操作建议</div>
              <p className="leading-6">
                先确认 Cookie 配置有效，再批量粘贴账号
                ID。执行后可通过右下角日志查看每个账号的处理结果。
              </p>
              <Button variant="outline" asChild className="w-full">
                <Link to="/config">前往配置中心</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>

        <motion.div
          key={activeEmbeddedFeature}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          <BatchAssistantEmbeddedPanel
            featureKey={activeEmbeddedFeature}
            onAsyncJobCreated={handleAsyncJobCreated}
          />
        </motion.div>
      </section>

      <TencentBatchAssistantJobCenter
        refreshToken={jobRefreshToken}
        focusJobId={focusedJobId}
        isOpen={isJobCenterOpen}
        onOpen={() => setIsJobCenterOpen(true)}
        onClose={() => setIsJobCenterOpen(false)}
      />
    </div>
  )
}
