import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  KeyRound,
  Loader2,
  PlayCircle,
  Settings2,
  Sparkles,
  Waves,
  Workflow,
  XCircle
} from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../../components/common'
import { useAuth } from '../../hooks/useAuth'
import { useDashboardData, type RecentTask } from '../../hooks/useDashboardData'

// ─── 工具 ────────────────────────────────────────────────

function fmtRelative(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

const statusCfg: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  success: { icon: CheckCircle, color: 'text-emerald-500', label: '成功' },
  failed: { icon: XCircle, color: 'text-rose-500', label: '失败' },
  partial: { icon: AlertTriangle, color: 'text-amber-500', label: '部分成功' },
  running: { icon: PlayCircle, color: 'text-sky-500', label: '运行中' }
}
const statusFallback = { icon: Clock, color: 'text-muted-foreground', label: '未知' }

const sourceLabel = { ocean: '巨量', tencent: '腾讯' } as const
const sourceBadgeClass = {
  ocean: 'bg-sky-500/10 text-sky-600',
  tencent: 'bg-violet-500/10 text-violet-600'
} as const

// ─── 单条任务动态 ─────────────────────────────────────

function TaskRow({ task }: { task: RecentTask }): React.JSX.Element {
  const cfg = statusCfg[task.status] ?? statusFallback
  const StatusIcon = cfg.icon

  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/40">
      <StatusIcon className={`h-4 w-4 flex-shrink-0 ${cfg.color}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{task.name}</span>
          <span
            className={`flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sourceBadgeClass[task.source]}`}
          >
            {sourceLabel[task.source]}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {cfg.label}
          {task.lastRunAt && <> · {fmtRelative(task.lastRunAt)}</>}
          {task.runCount > 0 && <> · 已执行 {task.runCount} 次</>}
        </p>
      </div>
      {task.isActive && (
        <span className="flex h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" title="活跃中" />
      )}
    </div>
  )
}

// ─── 状态卡片组件 ─────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  detail: string
  icon: typeof KeyRound
  tone: string
  loading: boolean
  /** 有失效 Cookie 时显示警告指示器 */
  warn?: boolean
}

function StatCard({ label, value, detail, icon: Icon, tone, loading, warn }: StatCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-background/70">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Icon className={`h-4 w-4 ${tone}`} />
            )}
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-2xl sm:text-3xl">{value}</CardTitle>
            {warn && !loading && (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
          </div>
          <CardDescription>{detail}</CardDescription>
        </div>
      </CardHeader>
    </Card>
  )
}

// ─── 环形进度条 ─────────────────────────────────────

function MiniRing({ online, total }: { online: number; total: number }) {
  const pct = total === 0 ? 0 : online / total
  const r = 18
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct)
  const color = pct === 1 ? '#10b981' : pct >= 0.5 ? '#f59e0b' : '#ef4444'

  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="flex-shrink-0">
      <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 24 24)"
        className="transition-all duration-700"
      />
      <text x="24" y="24" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-[11px] font-bold">
        {total === 0 ? '0' : online}
      </text>
    </svg>
  )
}

// ─── 页面 ────────────────────────────────────────────────

export const DashboardPage = () => {
  const { user } = useAuth()
  const {
    oceanCookie,
    tencentCookie,
    oceanTasks,
    tencentTasks,
    batchJobs,
    recentTasks,
    recentTasksLoading
  } = useDashboardData()

  // 汇总定时任务
  const totalTasks = oceanTasks.total + tencentTasks.total
  const activeTasks = oceanTasks.active + tencentTasks.active
  const tasksLoading = oceanTasks.loading || tencentTasks.loading

  const oceanOffline = oceanCookie.total - oceanCookie.online
  const tencentOffline = tencentCookie.total - tencentCookie.online

  return (
    <div className="space-y-6">
      {/* Hero 欢迎栏 */}
      <motion.section
        className="relative overflow-hidden rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.6)] sm:p-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_58%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              运营驾驶舱
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              你好，<span className="text-primary">{user?.name}</span>
            </h1>
            <p className="text-sm leading-7 text-muted-foreground sm:text-base">
              下方是当前系统各项运行概况，异常指标会高亮提示。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link to="/ocean-engine">
                巨量工作台
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/tencent-ads">腾讯工作台</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/config">配置中心</Link>
            </Button>
          </div>
        </div>
      </motion.section>

      {/* Cookie 健康度：环形图 + 状态卡片组合 */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* 巨量 Cookie */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-4">
                <MiniRing online={oceanCookie.online} total={oceanCookie.total} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Waves className="h-4 w-4 text-sky-500" />
                    <span className="text-sm font-semibold">巨量 Cookie</span>
                    {oceanOffline > 0 && !oceanCookie.loading && (
                      <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                        {oceanOffline} 失效
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {oceanCookie.loading
                      ? '加载中…'
                      : oceanCookie.total === 0
                        ? '尚未配置'
                        : `${oceanCookie.online} 在线 / ${oceanCookie.total} 总计`}
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        {/* 腾讯 Cookie */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-4">
                <MiniRing online={tencentCookie.online} total={tencentCookie.total} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-violet-500" />
                    <span className="text-sm font-semibold">腾讯 Cookie</span>
                    {tencentOffline > 0 && !tencentCookie.loading && (
                      <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                        {tencentOffline} 失效
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {tencentCookie.loading
                      ? '加载中…'
                      : tencentCookie.total === 0
                        ? '尚未配置'
                        : `${tencentCookie.online} 在线 / ${tencentCookie.total} 总计`}
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>
        </motion.div>
      </section>

      {/* 任务状态行 */}
      <section className="grid gap-4 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <StatCard
            label="定时任务"
            value={tasksLoading ? '—' : `${activeTasks} / ${totalTasks}`}
            detail={
              tasksLoading
                ? '加载中…'
                : totalTasks === 0
                  ? '暂无定时任务'
                  : `${activeTasks} 个活跃，${totalTasks - activeTasks} 个暂停`
            }
            icon={Workflow}
            tone={activeTasks > 0 ? 'text-sky-400' : 'text-muted-foreground'}
            loading={tasksLoading}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <StatCard
            label="腾讯批量任务"
            value={
              batchJobs.loading
                ? '—'
                : batchJobs.running > 0
                  ? `${batchJobs.running} 运行中`
                  : `${batchJobs.recent} 条记录`
            }
            detail={
              batchJobs.loading
                ? '加载中…'
                : batchJobs.running > 0
                  ? `还有 ${batchJobs.running} 个任务正在执行`
                  : batchJobs.recent === 0
                    ? '暂无批量任务记录'
                    : '最近批量任务均已完成'
            }
            icon={Settings2}
            tone={batchJobs.running > 0 ? 'text-amber-400' : 'text-emerald-400'}
            loading={batchJobs.loading}
            warn={batchJobs.running > 0}
          />
        </motion.div>
      </section>

      {/* 最近任务动态 */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg sm:text-xl">最近任务动态</CardTitle>
                <CardDescription>巨量和腾讯的定时任务按执行时间混合排序。</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/ocean-engine/scheduled-tasks">查看全部</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentTasksLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">加载中…</span>
              </div>
            ) : recentTasks.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                暂无任务执行记录
              </div>
            ) : (
              <div className="-mx-3 divide-y divide-border/50">
                {recentTasks.map((task) => (
                  <TaskRow key={`${task.source}-${task.id}`} task={task} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.section>
    </div>
  )
}
