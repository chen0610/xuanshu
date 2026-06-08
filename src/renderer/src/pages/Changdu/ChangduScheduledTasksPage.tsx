import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Loader2,
  Trash2,
  Edit2,
  Play,
  Pause,
  Clock,
  Calendar,
  CheckCircle,
  Sparkles,
  ScrollText
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  RadioGroup,
  RadioGroupItem,
  Checkbox
} from '../../components/ui'
import {
  changduService,
  type ChangduScheduledTaskExecutionLog
} from '../../services/changdu.service'
import { configService } from '../../services/config.service'
import { toast } from 'sonner'

type ChangduTaskKind = 'series_list_collect' | 'manju_push_feishu'

interface ScheduledTask {
  id: number
  name: string
  task_type: string
  config_id: number
  cron_expression: string
  task_config: Record<string, unknown> | null
  is_active: boolean
  last_run_at: string | null
  next_run_at: string | null
  run_count: number
  status: string
  created_at: string
}

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString('zh-CN')
  } catch {
    return iso
  }
}

/**
 * 间隔分钟 → 5 段 Cron（与后端 app.utils.cron_utils.minutes_to_cron_expression 一致）
 */
function minutesToCronExpression(minutes: number): string {
  const m = Math.round(minutes)
  if (m <= 0) {
    throw new Error('间隔分钟数必须大于 0')
  }
  if (m <= 59) {
    return `*/${m} * * * *`
  }
  const hours = Math.floor(m / 60)
  const remainingMinutes = m % 60
  if (remainingMinutes === 0) {
    return `0 */${hours} * * *`
  }
  return `${remainingMinutes} */${hours} * * *`
}

/**
 * 从 Cron 反推间隔分钟（仅支持 minutesToCronExpression 生成的形式；与 cron_expression_to_minutes 一致）
 */
function cronExpressionToMinutes(cron: string): number | null {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [minutePart, hourPart] = parts
  if (minutePart.startsWith('*/') && hourPart === '*') {
    const n = parseInt(minutePart.slice(2), 10)
    if (!Number.isNaN(n) && n >= 1 && n <= 59) {
      return n
    }
    return null
  }
  if (hourPart.startsWith('*/')) {
    const hours = parseInt(hourPart.slice(2), 10)
    if (Number.isNaN(hours) || hours <= 0) return null
    if (minutePart === '0') {
      return hours * 60
    }
    const min = parseInt(minutePart, 10)
    if (!Number.isNaN(min) && min >= 0 && min <= 59) {
      return hours * 60 + min
    }
  }
  return null
}

/** 解析「每天固定时刻」旧数据（M H * * *） */
function tryParseDailyClock(cron: string): { hour: number; minute: number } | null {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [minStr, hourStr, d, mo, w] = parts
  if (d !== '*' || mo !== '*' || w !== '*') return null
  const minute = parseInt(minStr, 10)
  const hour = parseInt(hourStr, 10)
  if (Number.isNaN(minute) || Number.isNaN(hour)) return null
  if (minStr.includes('*') || hourStr.includes('*')) return null
  if (minute < 0 || minute > 59 || hour < 0 || hour > 23) return null
  return { hour, minute }
}

const INTERVAL_MIN = 1
const INTERVAL_MAX = 10080

type SyncMode = 'feishu' | 'database'

function syncModeLabel(tc: Record<string, unknown> | null): SyncMode {
  if (tc && typeof tc === 'object' && tc.sync_mode === 'database') return 'database'
  return 'feishu'
}

function taskKindLabel(taskType: string): string {
  if (taskType === 'manju_push_feishu') return '漫剧推送（本地→飞书）'
  return '采集短剧列表'
}

/** 列表摘要 */
function formatScheduleDisplay(cron: string): string {
  const mins = cronExpressionToMinutes(cron)
  if (mins !== null) {
    if (mins < 60) return `每 ${mins} 分钟执行一次`
    if (mins % 60 === 0) return `每 ${mins / 60} 小时执行一次`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `每 ${h} 小时 ${m} 分钟执行一次`
  }
  const daily = tryParseDailyClock(cron)
  if (daily) {
    return `每天 ${daily.hour}:${daily.minute.toString().padStart(2, '0')}（旧：每日时刻，请改为间隔）`
  }
  return cron
}

function getStatusBadge(status: string, isActive: boolean) {
  if (!isActive) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
        已暂停
      </span>
    )
  }
  if (status === 'running') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
        执行中
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
      就绪
    </span>
  )
}

export const ChangduScheduledTasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)

  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  /** series_list_collect=抓取短剧列表；manju_push_feishu=本地 changdu_series 推飞书 */
  const [taskKind, setTaskKind] = useState<ChangduTaskKind>('series_list_collect')
  const [taskName, setTaskName] = useState('')
  /** 每 N 分钟循环（保存时生成 Cron，与后端 cron_utils 一致） */
  const [intervalMinutes, setIntervalMinutes] = useState(30)
  const [error, setError] = useState('')

  const [feishuBitableName, setFeishuBitableName] = useState('常读短剧列表')
  const [feishuTableName, setFeishuTableName] = useState('短剧数据')
  const [feishuStartPage, setFeishuStartPage] = useState(0)
  const [feishuMaxPages, setFeishuMaxPages] = useState(1)
  const [feishuFolderToken, setFeishuFolderToken] = useState('')
  const [feishuTarget, setFeishuTarget] = useState<'create' | 'append'>('append')
  const [feishuExistingAppToken, setFeishuExistingAppToken] = useState('')
  const [feishuExistingTableId, setFeishuExistingTableId] = useState('')
  const [feishuExistingBitableUrl, setFeishuExistingBitableUrl] = useState('')
  /** 追加到已有表时：按短剧ID 更新已有行 */
  const [feishuUpsertByBookId, setFeishuUpsertByBookId] = useState(false)

  /** 与 task_config.sync_mode 一致：feishu=飞书，database=本地库 upsert */
  const [syncMode, setSyncMode] = useState<SyncMode>('feishu')

  const [blockedTimeRanges, setBlockedTimeRanges] = useState<
    Array<{ start_hour: number; end_hour: number }>
  >([])

  const [logsOpen, setLogsOpen] = useState(false)
  const [logsTaskId, setLogsTaskId] = useState<number | null>(null)
  const [logsTaskTitle, setLogsTaskTitle] = useState('')
  const [executionLogs, setExecutionLogs] = useState<ChangduScheduledTaskExecutionLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const loadConfigs = useCallback(async () => {
    try {
      const list = await configService.getConfigsBySource(3)
      setConfigs(list)
      if (list.length > 0) {
        setSelectedConfigId((prev) => (prev != null ? prev : list[0].id))
      }
    } catch (err) {
      console.error(err)
      toast.error('加载常读配置失败')
    }
  }, [])

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const response = await changduService.getScheduledTasks({
        page: 1,
        page_size: 100
      })
      setTasks(response.items as ScheduledTask[])
    } catch (err) {
      console.error(err)
      toast.error('加载定时任务失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConfigs()
    void loadTasks()
  }, [loadConfigs, loadTasks])

  const resetForm = () => {
    setEditingTaskId(null)
    setTaskKind('series_list_collect')
    setTaskName('')
    setIntervalMinutes(30)
    setError('')
    setFeishuBitableName('常读短剧列表')
    setFeishuTableName('短剧数据')
    setFeishuStartPage(0)
    setFeishuMaxPages(1)
    setFeishuFolderToken('')
    setFeishuTarget('append')
    setFeishuExistingAppToken('')
    setFeishuExistingTableId('')
    setFeishuExistingBitableUrl('')
    setFeishuUpsertByBookId(false)
    setSyncMode('feishu')
    setBlockedTimeRanges([])
    if (configs.length > 0) {
      setSelectedConfigId(configs[0].id)
    }
  }

  const openCreate = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const fillFormFromTask = (task: ScheduledTask) => {
    setTaskName(task.name)
    setTaskKind(
      task.task_type === 'manju_push_feishu' ? 'manju_push_feishu' : 'series_list_collect'
    )
    setSelectedConfigId(task.config_id)
    const parsed = cronExpressionToMinutes(task.cron_expression)
    if (parsed !== null) {
      setIntervalMinutes(Math.min(INTERVAL_MAX, Math.max(INTERVAL_MIN, parsed)))
    } else {
      setIntervalMinutes(30)
    }
    const tc = task.task_config || {}
    setSyncMode(syncModeLabel(tc as Record<string, unknown>))
    setFeishuBitableName(String(tc.bitable_name || '常读短剧列表'))
    setFeishuTableName(String(tc.table_name || '短剧数据'))
    setFeishuStartPage(Number(tc.start_page ?? 0))
    setFeishuMaxPages(Math.min(50, Math.max(1, Number(tc.max_pages ?? 1))))
    setFeishuFolderToken(String(tc.folder_token || ''))
    const app = String(tc.existing_app_token || '').trim()
    const tid = String(tc.existing_table_id || '').trim()
    if (app && tid) {
      setFeishuTarget('append')
      setFeishuExistingAppToken(app)
      setFeishuExistingTableId(tid)
      setFeishuExistingBitableUrl(String(tc.existing_bitable_url || ''))
    } else {
      setFeishuTarget('create')
      setFeishuExistingAppToken('')
      setFeishuExistingTableId('')
      setFeishuExistingBitableUrl('')
    }
    const blocked = tc.blocked_time_ranges
    if (Array.isArray(blocked)) {
      setBlockedTimeRanges(
        blocked.map((r: { start_hour?: number; end_hour?: number }) => ({
          start_hour: Number(r.start_hour ?? 0),
          end_hour: Number(r.end_hour ?? 24)
        }))
      )
    } else {
      setBlockedTimeRanges([])
    }
    setFeishuUpsertByBookId(Boolean((tc as Record<string, unknown>).upsert_by_book_id))
  }

  const handleEdit = async (task: ScheduledTask) => {
    try {
      const detail = await changduService.getScheduledTask(task.id)
      setEditingTaskId(detail.id)
      fillFormFromTask(detail as ScheduledTask)
      setIsDialogOpen(true)
    } catch (err) {
      console.error(err)
      toast.error('加载任务详情失败')
    }
  }

  const buildTaskConfig = (): Record<string, unknown> => {
    if (taskKind === 'manju_push_feishu') {
      const cfg: Record<string, unknown> = {
        bitable_name: feishuBitableName.trim() || '常读漫剧列表',
        table_name: feishuTableName.trim() || '漫剧数据',
        default_view_name: '表格视图'
      }
      if (feishuFolderToken.trim()) {
        cfg.folder_token = feishuFolderToken.trim()
      }
      if (feishuTarget === 'append') {
        cfg.existing_app_token = feishuExistingAppToken.trim()
        cfg.existing_table_id = feishuExistingTableId.trim()
        if (feishuExistingBitableUrl.trim()) {
          cfg.existing_bitable_url = feishuExistingBitableUrl.trim()
        }
        if (feishuUpsertByBookId) {
          cfg.upsert_by_book_id = true
        }
      }
      if (blockedTimeRanges.length > 0) {
        cfg.blocked_time_ranges = blockedTimeRanges
      }
      return cfg
    }
    if (syncMode === 'database') {
      const cfg: Record<string, unknown> = {
        sync_mode: 'database',
        start_page: feishuStartPage,
        max_pages: feishuMaxPages
      }
      if (blockedTimeRanges.length > 0) {
        cfg.blocked_time_ranges = blockedTimeRanges
      }
      return cfg
    }
    const cfg: Record<string, unknown> = {
      sync_mode: 'feishu',
      bitable_name: feishuBitableName.trim() || '常读短剧列表',
      table_name: feishuTableName.trim() || '短剧数据',
      start_page: feishuStartPage,
      max_pages: feishuMaxPages,
      default_view_name: '表格视图'
    }
    if (feishuFolderToken.trim()) {
      cfg.folder_token = feishuFolderToken.trim()
    }
    if (feishuTarget === 'append') {
      cfg.existing_app_token = feishuExistingAppToken.trim()
      cfg.existing_table_id = feishuExistingTableId.trim()
      if (feishuExistingBitableUrl.trim()) {
        cfg.existing_bitable_url = feishuExistingBitableUrl.trim()
      }
      if (feishuUpsertByBookId) {
        cfg.upsert_by_book_id = true
      }
    }
    if (blockedTimeRanges.length > 0) {
      cfg.blocked_time_ranges = blockedTimeRanges
    }
    return cfg
  }

  const handleSubmit = async () => {
    if (!taskName.trim()) {
      setError('请填写任务名称')
      return
    }
    if (!selectedConfigId) {
      setError('请选择常读账号配置')
      return
    }
    if (intervalMinutes < INTERVAL_MIN || intervalMinutes > INTERVAL_MAX) {
      setError(`间隔分钟须在 ${INTERVAL_MIN}–${INTERVAL_MAX} 之间`)
      return
    }
    let cron_expression: string
    try {
      cron_expression = minutesToCronExpression(intervalMinutes)
    } catch (e) {
      setError(e instanceof Error ? e.message : '间隔不合法')
      return
    }
    const needFeishuAppend =
      (taskKind === 'manju_push_feishu' ||
        (taskKind === 'series_list_collect' && syncMode === 'feishu')) &&
      feishuTarget === 'append'
    if (needFeishuAppend) {
      if (!feishuExistingAppToken.trim() || !feishuExistingTableId.trim()) {
        setError('追加到已有表时，请填写多维表格 app_token 与数据表 table_id')
        return
      }
    }
    setError('')
    setIsSubmitting(true)
    try {
      const task_config = buildTaskConfig()
      if (editingTaskId) {
        await changduService.updateScheduledTask(editingTaskId, {
          name: taskName.trim(),
          task_type: taskKind,
          config_id: selectedConfigId,
          cron_expression,
          task_config
        })
        toast.success('任务已更新')
      } else {
        await changduService.createScheduledTask({
          name: taskName.trim(),
          task_type: taskKind,
          config_id: selectedConfigId,
          cron_expression,
          task_config
        })
        toast.success('任务已创建')
      }
      setIsDialogOpen(false)
      resetForm()
      await loadTasks()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        '保存失败'
      setError(typeof msg === 'string' ? msg : '保存失败')
      toast.error(typeof msg === 'string' ? msg : '保存失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggle = async (id: number) => {
    try {
      await changduService.toggleScheduledTask(id)
      toast.success('状态已更新')
      await loadTasks()
    } catch (err) {
      console.error(err)
      toast.error('切换状态失败')
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('确定删除该定时任务？')) return
    try {
      await changduService.deleteScheduledTask(id)
      toast.success('已删除')
      await loadTasks()
    } catch (err) {
      console.error(err)
      toast.error('删除失败')
    }
  }

  const openExecutionLogs = (task: ScheduledTask) => {
    setLogsTaskId(task.id)
    setLogsTaskTitle(task.name)
    setLogsOpen(true)
    setLogsLoading(true)
    setExecutionLogs([])
    changduService
      .getScheduledTaskExecutionLogs(task.id, { page: 1, page_size: 50 })
      .then((res) => setExecutionLogs(res.items))
      .catch((err) => {
        console.error(err)
        toast.error('加载执行记录失败')
      })
      .finally(() => setLogsLoading(false))
  }

  const addBlockedRange = () => {
    setBlockedTimeRanges((prev) => [...prev, { start_hour: 0, end_hour: 6 }])
  }

  const updateBlockedRange = (index: number, field: 'start_hour' | 'end_hour', value: number) => {
    setBlockedTimeRanges((prev) => {
      const next = [...prev]
      const cur = { ...next[index], [field]: value }
      next[index] = cur
      return next
    })
  }

  const removeBlockedRange = (index: number) => {
    setBlockedTimeRanges((prev) => prev.filter((_, i) => i !== index))
  }

  const configLabel = (c: Config) =>
    c.realname ? `${c.cookie_name}（${c.realname}）` : c.cookie_name

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">定时任务</h1>
            <p className="text-sm text-muted-foreground mt-1">
              支持「采集短剧列表」（抓取常读接口→飞书或本地库）与「漫剧推送」（本地 changdu_series
              表→飞书多维表格）。按间隔分钟循环执行。常读独立定时任务表与
              API，调度与巨量/腾讯共用进程，需启动定时任务进程。
            </p>
          </div>
        </div>
      </motion.div>

      <div className="flex justify-end">
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-2 w-4 h-4" />
          创建任务
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>任务列表</CardTitle>
          <CardDescription>常读采集短剧列表与漫剧推送（本地表→飞书）任务</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center p-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              暂无任务，点击「创建任务」添加
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group relative p-5 rounded-lg border bg-card hover:border-primary/40 transition-colors"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {getStatusBadge(task.status, task.is_active)}
                        <h3 className="text-base font-semibold truncate">{task.name}</h3>
                        <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {taskKindLabel(task.task_type)}
                        </span>
                        {task.task_type !== 'manju_push_feishu' && (
                          <span
                            className={
                              syncModeLabel(task.task_config as Record<string, unknown> | null) ===
                              'database'
                                ? 'text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
                                : 'text-xs px-2 py-0.5 rounded bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100'
                            }
                          >
                            {syncModeLabel(task.task_config as Record<string, unknown> | null) ===
                            'database'
                              ? '同步：本地库'
                              : '同步：飞书'}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                        <div className="flex gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground">执行频率</div>
                            <div>{formatScheduleDisplay(task.cron_expression)}</div>
                            {task.next_run_at && (
                              <div className="text-xs text-muted-foreground">
                                下次 {formatDate(task.next_run_at)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground">最后执行</div>
                            <div>
                              {task.last_run_at ? formatDate(task.last_run_at) : '从未执行'}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <CheckCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground">执行次数</div>
                            <div>{task.run_count ?? 0} 次</div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-1">
                          配置 ID：{task.config_id}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="执行记录"
                        onClick={() => openExecutionLogs(task)}
                      >
                        <ScrollText className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="编辑"
                        onClick={() => void handleEdit(task)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={task.is_active ? '暂停' : '启动'}
                        onClick={() => void handleToggle(task.id)}
                      >
                        {task.is_active ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="删除"
                        onClick={() => void handleDelete(task.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent
          className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{editingTaskId ? '编辑定时任务' : '创建定时任务'}</DialogTitle>
            <DialogDescription>
              {taskKind === 'manju_push_feishu'
                ? '将当前账号下本地漫剧表（changdu_series）全量追加或新建推送到飞书；需已绑定飞书。'
                : '采集短剧列表：选择同步到飞书或本地数据库；设置执行间隔后保存将生成与后端 cron_utils 一致的 Cron。'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cd-task-name">任务名称 *</Label>
              <Input
                id="cd-task-name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="例如：每日同步短剧到飞书"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label>任务类型 *</Label>
              <RadioGroup
                value={taskKind}
                onValueChange={(v) => setTaskKind(v as ChangduTaskKind)}
                className="flex flex-col gap-2"
                disabled={isSubmitting}
              >
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="series_list_collect" id="cd-kind-series" />
                  <span>采集短剧列表（抓取常读接口）</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="manju_push_feishu" id="cd-kind-manju" />
                  <span>漫剧推送（本地漫剧表 → 飞书多维表格）</span>
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>常读账号配置 *</Label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                value={selectedConfigId ?? ''}
                onChange={(e) => setSelectedConfigId(Number(e.target.value))}
                disabled={isSubmitting || configs.length === 0}
              >
                {configs.length === 0 ? (
                  <option value="">请先在配置中心添加常读 Cookie</option>
                ) : (
                  configs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {configLabel(c)}
                    </option>
                  ))
                )}
              </select>
              {taskKind === 'manju_push_feishu' && (
                <p className="text-xs text-muted-foreground">
                  漫剧推送仅关联常读配置以标识账号；数据来自已同步的本地表，可不填
                  Cookie（空配置亦可保存）。
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cd-interval">执行间隔（分钟）*</Label>
              <Input
                id="cd-interval"
                type="number"
                min={INTERVAL_MIN}
                max={INTERVAL_MAX}
                value={intervalMinutes}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (Number.isNaN(v)) {
                    setIntervalMinutes(INTERVAL_MIN)
                    return
                  }
                  setIntervalMinutes(Math.min(INTERVAL_MAX, Math.max(INTERVAL_MIN, v)))
                }}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                每 {intervalMinutes} 分钟执行一次；对应 Cron{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  {(() => {
                    try {
                      return minutesToCronExpression(intervalMinutes)
                    } catch {
                      return '—'
                    }
                  })()}
                </code>
                。≤59 分钟用分钟字段；更长间隔会按小时组合（与后端{' '}
                <code className="text-[11px]">minutes_to_cron_expression</code> 一致）。
              </p>
            </div>

            {taskKind === 'series_list_collect' && (
              <div className="space-y-2">
                <Label>同步方式 *</Label>
                <RadioGroup
                  value={syncMode}
                  onValueChange={(v) => setSyncMode(v as SyncMode)}
                  className="flex flex-col gap-2"
                >
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="feishu" id="cd-sync-feishu" />
                    <span>飞书多维表格</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="database" id="cd-sync-db" />
                    <span>本地数据库（按短剧ID 插入/更新，变更记入执行记录）</span>
                  </label>
                </RadioGroup>
              </div>
            )}

            {taskKind === 'series_list_collect' && (
              <div className="rounded-md border p-3 space-y-3 bg-muted/30">
                <p className="text-sm font-medium">列表抓取范围</p>
                <p className="text-xs text-muted-foreground">与「常读短剧列表」一致：每页 100 条</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>起始页（0 起）</Label>
                    <Input
                      type="number"
                      min={0}
                      value={feishuStartPage}
                      onChange={(e) => setFeishuStartPage(parseInt(e.target.value, 10) || 0)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>抓取页数（1–50）</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={feishuMaxPages}
                      onChange={(e) =>
                        setFeishuMaxPages(
                          Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1))
                        )
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
            )}

            {(taskKind === 'manju_push_feishu' || syncMode === 'feishu') && (
              <div className="rounded-md border p-3 space-y-3 bg-muted/30">
                <p className="text-sm font-medium">飞书同步方式</p>
                <RadioGroup
                  value={feishuTarget}
                  onValueChange={(v) => setFeishuTarget(v as 'create' | 'append')}
                  className="flex flex-col gap-2"
                >
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="append" id="cd-append" />
                    <span>追加到已有数据表（推荐用于周期任务）</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="create" id="cd-create" />
                    <span>每次执行新建多维表格（慎用，易重复建表）</span>
                  </label>
                </RadioGroup>

                {feishuTarget === 'append' ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>多维表格 app_token *</Label>
                      <Input
                        value={feishuExistingAppToken}
                        onChange={(e) => setFeishuExistingAppToken(e.target.value)}
                        placeholder="bascn…"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>数据表 table_id *</Label>
                      <Input
                        value={feishuExistingTableId}
                        onChange={(e) => setFeishuExistingTableId(e.target.value)}
                        placeholder="tbl…"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>浏览器打开链接（可选）</Label>
                      <Input
                        value={feishuExistingBitableUrl}
                        onChange={(e) => setFeishuExistingBitableUrl(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-3 items-start rounded-md border border-border/60 bg-muted/20 p-3">
                      <Checkbox
                        id="cd-feishu-upsert"
                        checked={feishuUpsertByBookId}
                        onCheckedChange={(c) => setFeishuUpsertByBookId(c === true)}
                        disabled={isSubmitting}
                      />
                      <label
                        htmlFor="cd-feishu-upsert"
                        className="text-sm leading-snug cursor-pointer text-muted-foreground"
                      >
                        按「短剧ID」更新已有行（需表中存在「短剧ID」列；执行时会先拉取该表全部记录再合并）
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label>多维表格名称</Label>
                      <Input
                        value={feishuBitableName}
                        onChange={(e) => setFeishuBitableName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>数据表名称</Label>
                      <Input
                        value={feishuTableName}
                        onChange={(e) => setFeishuTableName(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <Label>文件夹 token（可选）</Label>
                  <Input
                    value={feishuFolderToken}
                    onChange={(e) => setFeishuFolderToken(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="rounded-md border p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">禁止执行时段（可选）</span>
                <Button type="button" variant="outline" size="sm" onClick={addBlockedRange}>
                  添加
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                与巨量定时任务相同：在以下小时区间内跳过执行（0–23）
              </p>
              {blockedTimeRanges.map((range, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    className="w-20"
                    value={range.start_hour}
                    onChange={(e) =>
                      updateBlockedRange(index, 'start_hour', parseInt(e.target.value, 10) || 0)
                    }
                  />
                  <span className="text-sm">至</span>
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    className="w-20"
                    value={range.end_hour}
                    onChange={(e) =>
                      updateBlockedRange(index, 'end_hour', parseInt(e.target.value, 10) || 24)
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBlockedRange(index)}
                  >
                    删除
                  </Button>
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingTaskId ? (
                '保存'
              ) : (
                '创建'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>执行记录</DialogTitle>
            <DialogDescription>
              {logsTaskTitle ? `任务：${logsTaskTitle}` : ''}
              {logsTaskId != null ? `（ID ${logsTaskId}）` : ''} · 最近 50 条
            </DialogDescription>
          </DialogHeader>
          {logsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : executionLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              暂无执行记录（任务触发并成功/失败后会出现）
            </p>
          ) : (
            <div className="space-y-3">
              {executionLogs.map((log) => (
                <div key={log.id} className="rounded-lg border bg-muted/20 p-3 text-sm space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        log.execution_status === 'success'
                          ? 'inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }
                    >
                      {log.execution_status === 'success' ? '成功' : '失败'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      开始 {formatDate(log.start_time)}
                      {log.end_time ? ` · 结束 ${formatDate(log.end_time)}` : ''}
                      {log.duration_seconds != null
                        ? ` · 耗时 ${log.duration_seconds.toFixed(1)}s`
                        : ''}
                    </span>
                  </div>
                  {log.error_message && (
                    <pre className="text-xs whitespace-pre-wrap break-words text-destructive bg-destructive/5 rounded p-2">
                      {log.error_message}
                    </pre>
                  )}
                  {log.result_summary && Object.keys(log.result_summary).length > 0 && (
                    <pre className="text-xs whitespace-pre-wrap break-words bg-background rounded p-2 border max-h-40 overflow-y-auto">
                      {JSON.stringify(log.result_summary, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLogsOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
