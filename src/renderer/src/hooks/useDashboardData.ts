import { useEffect, useState } from 'react'
import { configService } from '../services/config.service'
import { scheduledTaskService as oceanTaskService } from '../services/ocean-engine.service'
import {
  scheduledTaskService as tencentTaskService,
  tencentBatchAssistantJobService
} from '../services/tencent-ads.service'
import type { Config } from '../types/config.types'

// ─── 类型 ──────────────────────────────────────────────

export interface CookieSummary {
  total: number
  online: number
  configs: Config[]
  loading: boolean
}

export interface TaskSummary {
  total: number
  active: number
  loading: boolean
}

export interface RecentTask {
  id: number
  name: string
  source: 'ocean' | 'tencent'
  status: string
  lastRunAt: string | null
  nextRunAt: string | null
  isActive: boolean
  runCount: number
}

export interface BatchJobSummary {
  running: number
  recent: number
  loading: boolean
}

export interface DashboardData {
  oceanCookie: CookieSummary
  tencentCookie: CookieSummary
  oceanTasks: TaskSummary
  tencentTasks: TaskSummary
  batchJobs: BatchJobSummary
  recentTasks: RecentTask[]
  recentTasksLoading: boolean
}

// ─── 工具 ──────────────────────────────────────────────

function buildCookieDefault(): CookieSummary {
  return { total: 0, online: 0, configs: [], loading: true }
}

function buildTaskDefault(): TaskSummary {
  return { total: 0, active: 0, loading: true }
}

// ─── Hook ──────────────────────────────────────────────

export function useDashboardData(): DashboardData {
  const [oceanCookie, setOceanCookie] = useState<CookieSummary>(buildCookieDefault)
  const [tencentCookie, setTencentCookie] = useState<CookieSummary>(buildCookieDefault)
  const [oceanTasks, setOceanTasks] = useState<TaskSummary>(buildTaskDefault)
  const [tencentTasks, setTencentTasks] = useState<TaskSummary>(buildTaskDefault)
  const [batchJobs, setBatchJobs] = useState<BatchJobSummary>({ running: 0, recent: 0, loading: true })
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([])
  const [recentTasksLoading, setRecentTasksLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    // 1) Cookie 配置
    configService
      .getConfigsBySource(1)
      .then((data) => {
        if (!cancelled) {
          setOceanCookie({
            total: data.length,
            online: data.filter((c) => c.status).length,
            configs: data,
            loading: false
          })
        }
      })
      .catch(() => {
        if (!cancelled) setOceanCookie({ total: 0, online: 0, configs: [], loading: false })
      })

    configService
      .getConfigsBySource(2)
      .then((data) => {
        if (!cancelled) {
          setTencentCookie({
            total: data.length,
            online: data.filter((c) => c.status).length,
            configs: data,
            loading: false
          })
        }
      })
      .catch(() => {
        if (!cancelled) setTencentCookie({ total: 0, online: 0, configs: [], loading: false })
      })

    // 2) 定时任务 — 巨量 + 腾讯并行，汇总 + 合并最近任务列表
    const oceanP = oceanTaskService
      .getScheduledTasks({ page: 1, page_size: 100 })
      .catch(() => ({ items: [], meta: {} }))

    const tencentP = tencentTaskService
      .getScheduledTasks({ page: 1, page_size: 100 })
      .catch(() => ({ items: [], meta: {} }))

    Promise.all([oceanP, tencentP]).then(([oceanRes, tencentRes]) => {
      if (cancelled) return

      const oItems = oceanRes.items || []
      const tItems = tencentRes.items || []

      setOceanTasks({
        total: oItems.length,
        active: oItems.filter((t: any) => t.is_active).length,
        loading: false
      })

      setTencentTasks({
        total: tItems.length,
        active: tItems.filter((t: any) => t.is_active).length,
        loading: false
      })

      // 合并最近任务列表，按 last_run_at 倒序，取前 10 条
      const merged: RecentTask[] = [
        ...oItems.map((t: any) => ({
          id: t.id,
          name: t.name,
          source: 'ocean' as const,
          status: t.status || 'unknown',
          lastRunAt: t.last_run_at,
          nextRunAt: t.next_run_at,
          isActive: t.is_active,
          runCount: t.run_count || 0
        })),
        ...tItems.map((t: any) => ({
          id: t.id,
          name: t.name,
          source: 'tencent' as const,
          status: t.status || 'unknown',
          lastRunAt: t.last_run_at,
          nextRunAt: t.next_run_at,
          isActive: t.is_active,
          runCount: t.run_count || 0
        }))
      ]
        .filter((t) => t.lastRunAt)
        .sort((a, b) => (b.lastRunAt! > a.lastRunAt! ? 1 : -1))
        .slice(0, 10)

      setRecentTasks(merged)
      setRecentTasksLoading(false)
    })

    // 3) 腾讯批量助手任务
    tencentBatchAssistantJobService
      .listJobs({ page: 1, page_size: 20 })
      .then((res) => {
        if (cancelled) return
        const items = res.items || []
        const runningCount = items.filter(
          (j) => j.status === 'running' || j.status === 'pending'
        ).length
        setBatchJobs({ running: runningCount, recent: items.length, loading: false })
      })
      .catch(() => {
        if (!cancelled) setBatchJobs({ running: 0, recent: 0, loading: false })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return {
    oceanCookie,
    tencentCookie,
    oceanTasks,
    tencentTasks,
    batchJobs,
    recentTasks,
    recentTasksLoading
  }
}
