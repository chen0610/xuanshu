/** 手动批量创建：定时入队相关工具（固定东八区 naive，与后端 scheduled_at 一致） */

const SHANGHAI_TZ = 'Asia/Shanghai'
const MIN_SCHEDULE_LEAD_MS = 2 * 60 * 1000
const MAX_SCHEDULE_MS = 30 * 24 * 60 * 60 * 1000

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 将后端 naive 时间（北京时间）解析为 UTC 毫秒时间戳 */
export function parseShanghaiNaiveMs(iso: string): number {
  const trimmed = iso.trim()
  if (!trimmed) return NaN
  let normalized = trimmed.replace(' ', 'T')
  if (normalized.length === 16) normalized += ':00'
  if (/[zZ]$/.test(normalized) || /[+-]\d{2}:\d{2}$/.test(normalized)) {
    return new Date(normalized).getTime()
  }
  return new Date(`${normalized}+08:00`).getTime()
}

/** 按东八区格式化为 datetime-local 字符串（与浏览器系统时区无关） */
export function formatShanghaiDatetimeLocal(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SHANGHAI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

export function isScheduledPending(
  status: string,
  scheduledAt: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (status !== 'pending' || !scheduledAt) return false
  const t = parseShanghaiNaiveMs(scheduledAt)
  return !Number.isNaN(t) && t > nowMs
}

export function formatBatchCreateJobStatusZh(
  status: string,
  scheduledAt?: string | null
): string {
  if (isScheduledPending(status, scheduledAt)) {
    return '定时待执行'
  }
  const map: Record<string, string> = {
    pending: '排队中',
    running: '执行中',
    success: '成功',
    partial: '部分成功',
    failed: '失败',
    cancelled: '已取消'
  }
  return map[status] ?? status
}

export function batchCreateStatusBadgeClass(
  status: string,
  scheduledAt?: string | null
): string {
  if (isScheduledPending(status, scheduledAt)) {
    return 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
  }
  switch (status) {
    case 'success':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
    case 'partial':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
    case 'failed':
      return 'bg-destructive/15 text-destructive'
    case 'running':
      return 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
    case 'pending':
      return 'bg-muted text-muted-foreground'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

/** datetime-local 默认值：北京时间当前 + 30 分钟 */
export function defaultScheduledDatetimeLocal(): string {
  return formatShanghaiDatetimeLocal(new Date(Date.now() + 30 * 60 * 1000))
}

/** datetime-local 输入值 → 后端 naive ISO（数字部分即北京时间） */
export function datetimeLocalToNaiveIso(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  return trimmed.length === 16 ? `${trimmed}:00` : trimmed
}

export function validateScheduledDatetimeLocal(value: string): string | null {
  if (!value.trim()) return '请选择计划执行时间'
  const scheduledMs = parseShanghaiNaiveMs(datetimeLocalToNaiveIso(value))
  if (Number.isNaN(scheduledMs)) return '计划执行时间格式无效'
  if (scheduledMs < Date.now() + MIN_SCHEDULE_LEAD_MS) {
    return '计划执行时间须至少 2 分钟后（北京时间）'
  }
  if (scheduledMs > Date.now() + MAX_SCHEDULE_MS) {
    return '计划执行时间不能超过 30 天'
  }
  return null
}

export function formatScheduledAtDisplay(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const ms = parseShanghaiNaiveMs(iso)
    if (Number.isNaN(ms)) return iso
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: SHANGHAI_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).format(ms)
  } catch {
    return iso
  }
}
