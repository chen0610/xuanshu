import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCw,
  Router,
  ShieldAlert
} from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label
} from '../../components/ui'
import { oceanEngineGatewayService } from '../../services/ocean-engine-gateway.service'
import type {
  OceanEngineApiCallLog,
  OceanEngineGatewayHealthItem,
  OceanEngineGatewayHealthResponse
} from '../../types/ocean-engine-gateway.types'

const HEALTH_PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const
type HealthPageSize = (typeof HEALTH_PAGE_SIZE_OPTIONS)[number]

function formatTs(ts?: number | null): string {
  if (!ts) return '--'
  return new Date(ts * 1000).toLocaleString()
}

export const OceanEngineGatewayPage: React.FC = () => {
  const [health, setHealth] = useState<OceanEngineGatewayHealthResponse | null>(null)
  const [logs, setLogs] = useState<OceanEngineApiCallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [endpointKey, setEndpointKey] = useState('')
  const [appCode, setAppCode] = useState('')
  const [healthPage, setHealthPage] = useState(1)
  const [healthPageSize, setHealthPageSize] = useState<HealthPageSize>(20)
  const [healthPageInput, setHealthPageInput] = useState('1')

  const loadData = async (): Promise<void> => {
    setLoading(true)
    try {
      const [healthResp, logsResp] = await Promise.all([
        oceanEngineGatewayService.getHealth(),
        oceanEngineGatewayService.getLogs({
          page: 1,
          page_size: 50,
          endpoint_key: endpointKey || undefined,
          app_code: appCode || undefined
        })
      ])
      setHealth(healthResp)
      setLogs(logsResp.items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const healthItems: OceanEngineGatewayHealthItem[] = health?.items || []
  const healthTotal = healthItems.length
  const healthTotalPages = Math.max(1, Math.ceil(healthTotal / healthPageSize))
  const paginatedHealthItems = useMemo(() => {
    const start = (healthPage - 1) * healthPageSize
    return healthItems.slice(start, start + healthPageSize)
  }, [healthItems, healthPage, healthPageSize])

  useEffect(() => {
    setHealthPageInput(String(healthPage))
  }, [healthPage])

  useEffect(() => {
    if (healthPage > healthTotalPages) {
      setHealthPage(healthTotalPages)
    }
  }, [healthPage, healthTotalPages])

  const jumpToHealthPage = (): void => {
    const n = parseInt(healthPageInput, 10)
    if (Number.isNaN(n)) return
    setHealthPage(Math.min(Math.max(1, n), healthTotalPages))
  }

  const changeHealthPageSize = (size: HealthPageSize): void => {
    setHealthPageSize(size)
    setHealthPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gateway 监控</h1>
          <p className="text-sm text-muted-foreground">
            查看多 App 路由、限流模式、频控命中和最近调用日志。
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw className={`mr-2 w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Limiter Mode</CardDescription>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Router className="w-4 h-4 text-primary" />
              {health?.limiter_mode || 'memory'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Health Keys</CardDescription>
            <CardTitle className="text-lg">{health?.total || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recent Logs</CardDescription>
            <CardTitle className="text-lg">{logs.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rate Limited</CardDescription>
            <CardTitle className="text-lg">
              {healthItems.reduce((sum, item) => sum + item.rate_limited_calls, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>日志过滤</CardTitle>
          <CardDescription>按接口或 App Code 过滤最近调用日志</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="endpoint_key">Endpoint Key</Label>
            <Input
              id="endpoint_key"
              value={endpointKey}
              onChange={(e) => setEndpointKey(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="app_code">App Code</Label>
            <Input id="app_code" value={appCode} onChange={(e) => setAppCode(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={() => void loadData()} disabled={loading}>
              查询
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>App / Endpoint 健康度</CardTitle>
          <CardDescription>内存态健康统计与冷却信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {healthTotal > 0 ? (
            <p className="text-sm text-muted-foreground">
              共 {healthTotal} 条，第 {healthPage} / {healthTotalPages} 页，每页 {healthPageSize} 条
            </p>
          ) : null}
          {healthItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">暂无健康统计数据</div>
          ) : (
            paginatedHealthItems.map((item) => (
              <div key={`${item.app_code}:${item.endpoint_key}`} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Activity className="w-4 h-4 text-primary" />
                      {item.app_code}
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      {item.endpoint_key}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-5">
                    <div>
                      <div className="text-muted-foreground">总调用</div>
                      <div className="font-semibold">{item.total_calls}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">成功</div>
                      <div className="font-semibold text-emerald-600">{item.success_calls}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">失败</div>
                      <div className="font-semibold text-rose-600">{item.failed_calls}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">频控</div>
                      <div className="font-semibold text-amber-600">{item.rate_limited_calls}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">冷却至</div>
                      <div className="font-semibold">{formatTs(item.cooldown_until)}</div>
                    </div>
                  </div>
                </div>
                {item.last_error ? (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700">
                    <ShieldAlert className="mt-0.5 w-4 h-4 shrink-0" />
                    <span>{item.last_error}</span>
                  </div>
                ) : null}
              </div>
            ))
          )}
          {healthTotal > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="health-page-size" className="whitespace-nowrap text-xs text-muted-foreground">
                  每页
                </Label>
                <select
                  id="health-page-size"
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={healthPageSize}
                  disabled={loading}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (HEALTH_PAGE_SIZE_OPTIONS.includes(v as HealthPageSize)) {
                      changeHealthPageSize(v as HealthPageSize)
                    }
                  }}
                >
                  {HEALTH_PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} 条
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={healthPage <= 1 || loading}
                  onClick={() => setHealthPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一页
                </Button>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>跳至</span>
                  <Input
                    value={healthPageInput}
                    onChange={(e) => setHealthPageInput(e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && jumpToHealthPage()}
                    className="h-8 w-16 text-center"
                    inputMode="numeric"
                    disabled={loading}
                  />
                  <span>/ {healthTotalPages} 页</span>
                  <Button type="button" variant="outline" size="sm" onClick={jumpToHealthPage} disabled={loading}>
                    确定
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={healthPage >= healthTotalPages || loading}
                  onClick={() => setHealthPage((p) => Math.min(healthTotalPages, p + 1))}
                >
                  下一页
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>最近调用日志</CardTitle>
          <CardDescription>展示最近 50 条 Gateway 调用记录</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {logs.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">暂无调用日志</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {log.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : log.is_rate_limited ? (
                        <Clock3 className="w-4 h-4 text-amber-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                      )}
                      <span>{log.app_code}</span>
                      <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]">
                        {log.method}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {log.endpoint_key}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      source {log.source_advertiser_id} → target {log.target_advertiser_id}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                    <div>
                      <div className="text-muted-foreground">HTTP</div>
                      <div className="font-semibold">{log.http_status ?? '--'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">业务码</div>
                      <div className="font-semibold">{log.biz_code ?? '--'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">耗时</div>
                      <div className="font-semibold">
                        {log.latency_ms ? `${log.latency_ms.toFixed(1)} ms` : '--'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">时间</div>
                      <div className="font-semibold">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
                {log.error_message || log.biz_message ? (
                  <div className="mt-3 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                    {log.error_message || log.biz_message}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
