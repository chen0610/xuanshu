import { useEffect, useState } from 'react'
import { configService } from '../services/config.service'
import type { Config } from '../types/config.types'

interface ScheduledTaskSummary {
  total: number
  active: number
  /** 后端 status 原始值，或 'none' 表示从未执行 */
  lastRunStatus: string
  lastRunAt: string | null
}

interface OverviewData {
  configs: Config[]
  configsLoading: boolean
  tasks: ScheduledTaskSummary
  tasksLoading: boolean
}

/**
 * 获取 Overview 页面共用数据
 * @param source 1=巨量, 2=腾讯
 * @param taskService 对应模块的 scheduledTaskService
 */
export function useOverviewData(
  source: number,
  taskService: {
    getScheduledTasks: (params?: any) => Promise<{ items: any[]; meta: any }>
  }
): OverviewData {
  const [configs, setConfigs] = useState<Config[]>([])
  const [configsLoading, setConfigsLoading] = useState(true)
  const [tasks, setTasks] = useState<ScheduledTaskSummary>({
    total: 0,
    active: 0,
    lastRunStatus: 'none',
    lastRunAt: null
  })
  const [tasksLoading, setTasksLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    configService
      .getConfigsBySource(source)
      .then((data) => {
        if (!cancelled) setConfigs(data)
      })
      .catch(() => {
        if (!cancelled) setConfigs([])
      })
      .finally(() => {
        if (!cancelled) setConfigsLoading(false)
      })

    taskService
      .getScheduledTasks({ page: 1, page_size: 100 })
      .then((res) => {
        if (cancelled) return
        const items = res.items || []
        const activeCount = items.filter((t: any) => t.is_active).length

        // 找到最近执行的任务
        let lastRunStatus: ScheduledTaskSummary['lastRunStatus'] = 'none'
        let lastRunAt: string | null = null
        for (const t of items) {
          if (t.last_run_at) {
            if (!lastRunAt || t.last_run_at > lastRunAt) {
              lastRunAt = t.last_run_at
              lastRunStatus = t.status || 'none'
            }
          }
        }

        setTasks({ total: items.length, active: activeCount, lastRunStatus, lastRunAt })
      })
      .catch(() => {
        if (!cancelled) setTasks({ total: 0, active: 0, lastRunStatus: 'none', lastRunAt: null })
      })
      .finally(() => {
        if (!cancelled) setTasksLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [source, taskService])

  return { configs, configsLoading, tasks, tasksLoading }
}
