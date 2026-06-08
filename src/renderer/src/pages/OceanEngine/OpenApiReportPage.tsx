import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Table2 } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label
} from '../../components/ui'
import {
  customReportService,
  type CustomReportFactItem
} from '../../services/ocean-engine.service'

const getToday = (): string => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const parseStatCost = (metrics: Record<string, string | number | null>): string => {
  const v = metrics.stat_cost ?? metrics.cost
  if (v === undefined || v === null) return '—'
  return String(v)
}

export const OpenApiReportPage: React.FC = () => {
  const [items, setItems] = useState<CustomReportFactItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [filterAdvertiser, setFilterAdvertiser] = useState('')
  const [filterEntityType, setFilterEntityType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [bfAdvertiser, setBfAdvertiser] = useState('')
  const [bfStart, setBfStart] = useState(getToday())
  const [bfEnd, setBfEnd] = useState(getToday())
  const [bfLoading, setBfLoading] = useState(false)
  const [bfMsg, setBfMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await customReportService.listFacts({
        page,
        page_size: pageSize,
        advertiser_id: filterAdvertiser.trim() || undefined,
        entity_type: filterEntityType.trim() || undefined,
        start_date: startDate.trim() || undefined,
        end_date: endDate.trim() || undefined
      })
      setItems(res.items)
      setTotal(res.total)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filterAdvertiser, filterEntityType, startDate, endDate])

  useEffect(() => {
    void load()
  }, [load])

  const onBackfill = async (): Promise<void> => {
    if (!bfAdvertiser.trim()) {
      setBfMsg('请填写广告主 ID')
      return
    }
    setBfLoading(true)
    setBfMsg('')
    try {
      const res = await customReportService.backfill({
        advertiser_id: bfAdvertiser.trim(),
        entity_types: ['project', 'promotion', 'material'],
        start_date: bfStart,
        end_date: bfEnd
      })
      setBfMsg(`已写入约 ${res.rows_written} 行，可刷新列表查看`)
      await load()
    } catch (e: unknown) {
      setBfMsg(e instanceof Error ? e.message : '补数失败')
    } finally {
      setBfLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Table2 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">OpenAPI 报表</h1>
            <p className="text-sm text-muted-foreground">
              SPI activeprogram 触发后由自定义报表入库；也可手动补数
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">刷新</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>补数（按广告主 + 日期）</CardTitle>
          <CardDescription>
            调用开放平台自定义报表接口拉取 project / promotion / material 维度数据并入库
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
          <div className="grid gap-2">
            <Label htmlFor="bf-adv">广告主 ID</Label>
            <Input
              id="bf-adv"
              placeholder="advertiser_id"
              value={bfAdvertiser}
              onChange={(e) => setBfAdvertiser(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bf-s">开始日期</Label>
            <Input
              id="bf-s"
              type="date"
              value={bfStart}
              onChange={(e) => setBfStart(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bf-e">结束日期</Label>
            <Input id="bf-e" type="date" value={bfEnd} onChange={(e) => setBfEnd(e.target.value)} />
          </div>
          <Button onClick={() => void onBackfill()} disabled={bfLoading}>
            {bfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span className={bfLoading ? 'ml-2' : ''}>开始补数</span>
          </Button>
        </CardContent>
        {bfMsg ? <p className="px-6 pb-4 text-sm text-muted-foreground">{bfMsg}</p> : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>入库明细</CardTitle>
          <CardDescription>共 {total} 条</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
            <div className="grid gap-2">
              <Label>广告主 ID</Label>
              <Input
                placeholder="可选"
                value={filterAdvertiser}
                onChange={(e) => setFilterAdvertiser(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>实体类型</Label>
              <Input
                placeholder="project / promotion / material"
                value={filterEntityType}
                onChange={(e) => setFilterEntityType(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>开始日期</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>结束日期</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button
              onClick={() => {
                setPage(1)
                void load()
              }}
            >
              查询
            </Button>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 font-medium">日期</th>
                  <th className="p-2 font-medium">广告主</th>
                  <th className="p-2 font-medium">类型</th>
                  <th className="p-2 font-medium">实体 ID</th>
                  <th className="p-2 font-medium">stat_cost</th>
                  <th className="p-2 font-medium">show_cnt</th>
                  <th className="p-2 font-medium">SPI 事件</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2 whitespace-nowrap">{row.stat_date}</td>
                      <td className="p-2 font-mono text-xs">{row.advertiser_id}</td>
                      <td className="p-2">{row.entity_type}</td>
                      <td className="p-2 font-mono text-xs">{row.entity_id}</td>
                      <td className="p-2">{parseStatCost(row.metrics)}</td>
                      <td className="p-2">{String(row.metrics.show_cnt ?? '—')}</td>
                      <td className="p-2 font-mono text-xs">{row.spi_event_id ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              第 {page} / {totalPages} 页
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
