import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle,
  Clock3,
  KeyRound,
  Loader2,
  Radar,
  Settings2,
  Sparkles,
  XCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../../components/ui'
import { useOverviewData } from '../../hooks/useOverviewData'
import { scheduledTaskService } from '../../services/ocean-engine.service'

const TASK_SERVICE = scheduledTaskService

const features = [
  {
    title: '批量助手',
    description: '快速进入日常投放操作、批量处理与流程协同。',
    icon: Settings2,
    path: '/ocean-engine/p-assistant'
  },
  {
    title: '定时任务',
    description: '统一管理自动化执行计划和任务调度。',
    icon: Clock3,
    path: '/ocean-engine/scheduled-tasks'
  },
  {
    title: '数据助手',
    description: '基于标签组与组合条件进行投放数据分析。',
    icon: Radar,
    path: '/ocean-engine/data-assistant'
  },
  {
    title: '数据面板',
    description: '查看账户、项目和广告层级的数据明细。',
    icon: Activity,
    path: '/ocean-engine/data-panel'
  },
  {
    title: '数据分析',
    description: '从分组和维度上进一步拆解投放表现。',
    icon: BarChart3,
    path: '/ocean-engine/data-analysis'
  }
]

function formatRelativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

const STATUS_FALLBACK = { label: '未知', className: 'text-muted-foreground bg-muted/50' }

const statusMap: Record<string, { label: string; className: string }> = {
  success: { label: '成功', className: 'text-emerald-600 bg-emerald-500/10' },
  failed: { label: '失败', className: 'text-rose-600 bg-rose-500/10' },
  partial: { label: '部分成功', className: 'text-amber-600 bg-amber-500/10' },
  running: { label: '运行中', className: 'text-sky-600 bg-sky-500/10' },
  none: { label: '暂无记录', className: 'text-muted-foreground bg-muted/50' }
}

export const OverviewPage: React.FC = () => {
  const { configs, configsLoading, tasks, tasksLoading } = useOverviewData(1, TASK_SERVICE)

  const onlineConfigs = useMemo(() => configs.filter((c) => c.status), [configs])

  const summaryCards = [
    {
      label: 'Cookie 配置',
      value: configsLoading ? '—' : `${onlineConfigs.length} / ${configs.length}`,
      detail: configsLoading
        ? '加载中…'
        : configs.length === 0
          ? '尚未配置，请先前往配置中心'
          : `${onlineConfigs.length} 个在线，${configs.length - onlineConfigs.length} 个失效`,
      icon: KeyRound,
      tone: onlineConfigs.length > 0 ? 'text-emerald-400' : 'text-rose-400',
      loading: configsLoading
    },
    {
      label: '定时任务',
      value: tasksLoading ? '—' : `${tasks.active} / ${tasks.total}`,
      detail: tasksLoading
        ? '加载中…'
        : tasks.total === 0
          ? '暂无定时任务'
          : `${tasks.active} 个活跃，${tasks.total - tasks.active} 个暂停`,
      icon: Clock3,
      tone: tasks.active > 0 ? 'text-sky-400' : 'text-muted-foreground',
      loading: tasksLoading
    },
    {
      label: '最近执行',
      value: tasksLoading
        ? '—'
        : tasks.lastRunAt
          ? formatRelativeTime(tasks.lastRunAt)
          : '暂无',
      detail: tasksLoading ? '加载中…' : (statusMap[tasks.lastRunStatus] ?? STATUS_FALLBACK).label,
      icon: tasks.lastRunStatus === 'success' ? CheckCircle : tasks.lastRunStatus === 'failed' ? XCircle : Sparkles,
      tone:
        tasks.lastRunStatus === 'success'
          ? 'text-emerald-400'
          : tasks.lastRunStatus === 'failed'
            ? 'text-rose-400'
            : 'text-violet-400',
      loading: tasksLoading
    }
  ]

  return (
    <div className="space-y-6">
      {/* Hero */}
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
              Ocean Engine Workspace
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">巨量助手工作台</h1>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                从这里进入投放、分析、任务协同和自动化工具，下方卡片展示当前运行状态。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link to="/ocean-engine/data-panel">
                打开数据面板
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/config">前往配置中心</Link>
            </Button>
          </div>
        </div>
      </motion.section>

      {/* 实时状态卡片 */}
      <section className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((item, index) => {
          const Icon = item.icon
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * (index + 1) }}
            >
              <Card className="h-full">
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-background/70">
                      {item.loading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Icon className={`h-4 w-4 ${item.tone}`} />
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-2xl sm:text-3xl">{item.value}</CardTitle>
                    <CardDescription>{item.detail}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>
          )
        })}
      </section>

      {/* 快捷入口 */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {features.map((feature, index) => {
          const Icon = feature.icon
          return (
            <motion.div
              key={feature.path}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * index, duration: 0.35 }}
            >
              <Link to={feature.path} className="block h-full">
                <Card className="group h-full transition-colors hover:bg-accent/40">
                  <CardHeader className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-background/70">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </div>
                    <div className="space-y-2">
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                      <CardDescription>{feature.description}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                      进入模块
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          )
        })}
      </section>
    </div>
  )
}
