import React, { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  CheckCircle,
  Clock3,
  GalleryHorizontal,
  KeyRound,
  Loader2,
  PieChart,
  PlayCircle,
  PlusCircle,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  Trash2,
  XCircle
} from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../../components/ui'
import { useOverviewData } from '../../hooks/useOverviewData'
import {
  scheduledTaskService,
  tencentBatchAssistantJobService
} from '../../services/tencent-ads.service'

const TASK_SERVICE = scheduledTaskService

const professionalFeatures = [
  {
    title: '转化归因',
    description: '创建或维护转化归因配置。',
    icon: Target,
    path: '/tencent-ads/conversion-attribution'
  },
  {
    title: '搜索广告创建',
    description: '创建新的搜索广告并串联配置流程。',
    icon: PlusCircle,
    path: '/tencent-ads/search-ad-create'
  },
  {
    title: '定时任务',
    description: '把重复动作沉淀成自动化任务。',
    icon: Activity,
    path: '/tencent-ads/scheduled-tasks'
  },
  {
    title: '数据调控',
    description: '按广告类型与筛选条件管理数据规则。',
    icon: PieChart,
    path: '/tencent-ads/data-control'
  },
  {
    title: '账户广告清空',
    description: '集中清理账户内广告数据，适合治理场景。',
    icon: Trash2,
    path: '/tencent-ads/account-ad-clear'
  },
  {
    title: '创意资产',
    description: '按类型查看创意组件与分页数据。',
    icon: GalleryHorizontal,
    path: '/tencent-ads/creative-assets'
  },
  {
    title: '数据报表',
    description: '查看并分析腾讯广告数据报表。',
    icon: TrendingUp,
    path: '/tencent-ads/data-assistant'
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

interface JobSummary {
  running: number
  recent: number
  loading: boolean
}

export const TencentAdsOverviewPage: React.FC = () => {
  const { configs, configsLoading, tasks, tasksLoading } = useOverviewData(2, TASK_SERVICE)
  const onlineConfigs = useMemo(() => configs.filter((c) => c.status), [configs])

  // 批量助手任务概况
  const [jobs, setJobs] = useState<JobSummary>({ running: 0, recent: 0, loading: true })
  useEffect(() => {
    let cancelled = false
    tencentBatchAssistantJobService
      .listJobs({ page: 1, page_size: 20 })
      .then((res) => {
        if (cancelled) return
        const items = res.items || []
        const runningCount = items.filter(
          (j) => j.status === 'running' || j.status === 'pending'
        ).length
        setJobs({ running: runningCount, recent: items.length, loading: false })
      })
      .catch(() => {
        if (!cancelled) setJobs({ running: 0, recent: 0, loading: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

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
      label: '批量任务',
      value: jobs.loading ? '—' : jobs.running > 0 ? `${jobs.running} 运行中` : `${jobs.recent} 条记录`,
      detail: jobs.loading
        ? '加载中…'
        : jobs.running > 0
          ? `还有 ${jobs.running} 个任务正在执行`
          : jobs.recent === 0
            ? '暂无批量任务记录'
            : '最近 20 条任务均已完成',
      icon: jobs.running > 0 ? PlayCircle : CheckCircle,
      tone: jobs.running > 0 ? 'text-amber-400' : 'text-emerald-400',
      loading: jobs.loading
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
              Tencent Ads Workspace
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">腾讯助手工作台</h1>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                下方卡片展示当前运行状态，快捷入口可直接进入高频场景。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link to="/tencent-ads/batch-assistant">
                打开批量助手
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

      {/* 专业模块快捷入口 */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">快捷入口</h2>
          <p className="mt-1 text-sm text-muted-foreground">直接进入各专业模块。</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {professionalFeatures.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.path}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * (index + 1), duration: 0.35 }}
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
        </div>
      </section>
    </div>
  )
}
