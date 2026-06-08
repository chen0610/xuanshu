import { pAssistantServiceExtended } from '../services/ocean-engine.service'

export type AssetShareScheduleConfig = {
  schedule_group_id: string
  selected_cookie_id: number
  group_id: string
  asset_id: string
  account_ids: string[]
  main_account_name: string
  main_account_id: string
  interval_minutes: number
}

export type AssetShareScheduleItem = {
  schedule_group_id: string
  enabled: boolean
  next_run_at: Date | null
  interval_minutes: number
  config: Omit<AssetShareScheduleConfig, 'interval_minutes' | 'schedule_group_id'>
}

export type AssetShareScheduleState = {
  items: AssetShareScheduleItem[]
}

export type AssetShareRunResult = {
  schedule_group_id: string
  success: boolean
  data?: {
    total_success: number
    total_error: number
    results: Array<{ account_id: string; success: boolean; error?: string }>
  }
  error?: string
  started_at: Date
  finished_at: Date
}

const items = new Map<string, AssetShareScheduleItem>()
const timerIds = new Map<string, ReturnType<typeof setInterval>>()
const executing = new Map<string, boolean>()

const listeners = new Set<(nextState: AssetShareScheduleState) => void>()
const runListeners = new Set<(result: AssetShareRunResult) => void>()

const getState = (): AssetShareScheduleState => ({
  items: Array.from(items.values())
})

const notify = () => {
  const state = getState()
  listeners.forEach((listener) => listener(state))
}

const notifyRun = (result: AssetShareRunResult) => {
  runListeners.forEach((listener) => listener(result))
}

const calculateNextRunAt = (intervalMinutes: number) =>
  new Date(Date.now() + intervalMinutes * 60 * 1000)

const executeOnce = async (item: AssetShareScheduleItem): Promise<AssetShareRunResult> => {
  const startedAt = new Date()
  const { config } = item
  try {
    const result = await pAssistantServiceExtended.shareAssets({
      selected_cookie_id: config.selected_cookie_id,
      group_id: config.group_id,
      asset_id: config.asset_id,
      account_ids: config.account_ids
    })

    if (result.code !== 0) {
      return {
        schedule_group_id: item.schedule_group_id,
        success: false,
        error: result.error || result.msg || '资产共享失败',
        started_at: startedAt,
        finished_at: new Date()
      }
    }

    return {
      schedule_group_id: item.schedule_group_id,
      success: true,
      data: result.data,
      started_at: startedAt,
      finished_at: new Date()
    }
  } catch (error) {
    return {
      schedule_group_id: item.schedule_group_id,
      success: false,
      error: error instanceof Error ? error.message : '资产共享失败',
      started_at: startedAt,
      finished_at: new Date()
    }
  }
}

const startTimer = (item: AssetShareScheduleItem) => {
  const { schedule_group_id, interval_minutes } = item
  if (timerIds.has(schedule_group_id)) {
    window.clearInterval(timerIds.get(schedule_group_id)!)
    timerIds.delete(schedule_group_id)
  }

  const timerId = window.setInterval(
    async () => {
      if (executing.get(schedule_group_id) || !items.has(schedule_group_id)) {
        items.set(schedule_group_id, {
          ...item,
          next_run_at: calculateNextRunAt(interval_minutes)
        })
        notify()
        return
      }

      const currentItem = items.get(schedule_group_id)
      if (!currentItem) return

      executing.set(schedule_group_id, true)
      items.set(schedule_group_id, {
        ...currentItem,
        next_run_at: calculateNextRunAt(interval_minutes)
      })
      notify()

      const result = await executeOnce(currentItem)
      notifyRun(result)
      executing.set(schedule_group_id, false)
    },
    interval_minutes * 60 * 1000
  )

  timerIds.set(schedule_group_id, timerId)
}

export const assetShareScheduler = {
  getState,
  subscribe: (listener: (nextState: AssetShareScheduleState) => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  subscribeRun: (listener: (result: AssetShareRunResult) => void) => {
    runListeners.add(listener)
    return () => runListeners.delete(listener)
  },
  start: async (config: AssetShareScheduleConfig) => {
    const { schedule_group_id, interval_minutes, ...rest } = config
    const item: AssetShareScheduleItem = {
      schedule_group_id,
      enabled: true,
      next_run_at: calculateNextRunAt(interval_minutes),
      interval_minutes,
      config: rest
    }
    items.set(schedule_group_id, item)
    notify()
    startTimer(item)

    if (!executing.get(schedule_group_id)) {
      executing.set(schedule_group_id, true)
      const result = await executeOnce(item)
      notifyRun(result)
      executing.set(schedule_group_id, false)
    }
  },
  stop: (scheduleGroupId?: string) => {
    if (scheduleGroupId) {
      const timerId = timerIds.get(scheduleGroupId)
      if (timerId) {
        window.clearInterval(timerId)
        timerIds.delete(scheduleGroupId)
      }
      executing.delete(scheduleGroupId)
      items.delete(scheduleGroupId)
    } else {
      timerIds.forEach((id) => window.clearInterval(id))
      timerIds.clear()
      executing.clear()
      items.clear()
    }
    notify()
  }
}
