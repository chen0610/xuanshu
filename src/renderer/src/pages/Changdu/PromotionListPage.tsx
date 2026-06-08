import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Link2, Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Label,
  Input,
  Checkbox
} from '../../components/ui'
import { configService } from '../../services/config.service'
import {
  changduService,
  type ChangduChannelRow,
  type ChangduPromotionRow
} from '../../services/changdu.service'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const
const DEFAULT_PAGE_SIZE = 50
const CHANGDU_PROMOTION_SELECTED_CONFIG_STORAGE_KEY = 'changdu-promotion:selected-config-id'
const CHANGDU_PROMOTION_SELECTED_CHANNEL_STORAGE_KEY = 'changdu-promotion:selected-channel-key'

const todayText = (): string => new Date().toISOString().slice(0, 10)

const selectedChannelKey = (channel: ChangduChannelRow): string =>
  `${channel.app_type}:${channel.app_id}:${channel.channel}:${channel.distributor_id}`

const getAppTypeLabel = (appType: string): string => {
  if (appType === '21') return '付费漫剧'
  if (appType === '22') return '免费漫剧'
  return `app_type=${appType || '未知'}`
}

const csvCell = (value: unknown): string => {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

const downloadTextFile = (content: string, filename: string, type: string): void => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const buildPromotionCsv = (items: ChangduPromotionRow[]): string => {
  const headers = [
    '推广链名称',
    '推广链ID',
    '推广链接',
    '漫剧名称',
    '漫剧ID',
    '总集数',
    '发布抖音号',
    '面板名称',
    '起始集数',
    '档位个数',
    '创建时间'
  ]
  const dataRows = items.map((row) => [
    row.promotion_name,
    row.promotion_id,
    row.promotion_url,
    row.book_name,
    row.book_id,
    row.episode_amount,
    row.aweme_publish_name,
    row.panel_name,
    row.start_episode,
    row.product_num,
    row.create_time
  ])
  return [headers, ...dataRows].map((cells) => cells.map(csvCell).join(',')).join('\n')
}

export const PromotionListPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(false)
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [channels, setChannels] = useState<ChangduChannelRow[]>([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [selectedDistributorId, setSelectedDistributorId] = useState('')
  const [rows, setRows] = useState<ChangduPromotionRow[]>([])
  const [total, setTotal] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(DEFAULT_PAGE_SIZE)
  const [beginDate, setBeginDate] = useState('')
  const [endDate, setEndDate] = useState(todayText())
  const [bookId, setBookId] = useState('')
  const [bookName, setBookName] = useState('')
  const [fetching, setFetching] = useState(false)
  const [exportReversed, setExportReversed] = useState(false)
  const [hasQueried, setHasQueried] = useState(false)
  const [error, setError] = useState('')
  const didAutoLoadRef = useRef(false)

  const selectedChannel = channels.find(
    (item) => selectedChannelKey(item) === selectedDistributorId
  )
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const canPrev = pageIndex > 0
  const canNext = pageIndex + 1 < totalPages

  useEffect(() => {
    let cancelled = false
    ;(async (): Promise<void> => {
      setLoadingConfigs(true)
      try {
        const list = await configService.getConfigsBySource(3)
        if (cancelled) return
        setConfigs(list)
        const rememberedConfigId = Number(
          window.localStorage.getItem(CHANGDU_PROMOTION_SELECTED_CONFIG_STORAGE_KEY) || ''
        )
        if (list.length > 0) {
          setSelectedConfigId((prev) => {
            if (prev != null && list.some((item) => item.id === prev)) return prev
            if (
              Number.isFinite(rememberedConfigId) &&
              rememberedConfigId > 0 &&
              list.some((item) => item.id === rememberedConfigId)
            ) {
              return rememberedConfigId
            }
            return list[0].id
          })
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) setError('加载常读配置失败，请稍后重试')
      } finally {
        if (!cancelled) setLoadingConfigs(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!selectedConfigId) {
      setChannels([])
      setSelectedDistributorId('')
      return undefined
    }
    ;(async (): Promise<void> => {
      setLoadingChannels(true)
      try {
        const res = await changduService.getChannels(selectedConfigId)
        if (cancelled) return
        setChannels(res.items)
        const rememberedChannelKey = window.localStorage.getItem(
          CHANGDU_PROMOTION_SELECTED_CHANNEL_STORAGE_KEY
        )
        setSelectedDistributorId((prev) => {
          if (prev && res.items.some((item) => selectedChannelKey(item) === prev)) return prev
          if (
            rememberedChannelKey &&
            res.items.some((item) => selectedChannelKey(item) === rememberedChannelKey)
          ) {
            return rememberedChannelKey
          }
          return res.items[0] ? selectedChannelKey(res.items[0]) : ''
        })
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setChannels([])
          setSelectedDistributorId('')
          setError('加载常读渠道失败，请检查 Cookie 是否有效')
        }
      } finally {
        if (!cancelled) setLoadingChannels(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedConfigId])

  useEffect(() => {
    if (selectedConfigId != null) {
      window.localStorage.setItem(
        CHANGDU_PROMOTION_SELECTED_CONFIG_STORAGE_KEY,
        String(selectedConfigId)
      )
    }
  }, [selectedConfigId])

  useEffect(() => {
    if (selectedDistributorId) {
      window.localStorage.setItem(
        CHANGDU_PROMOTION_SELECTED_CHANNEL_STORAGE_KEY,
        selectedDistributorId
      )
    }
  }, [selectedDistributorId])

  useEffect(() => {
    if (
      didAutoLoadRef.current ||
      !selectedConfigId ||
      !selectedChannel ||
      loadingConfigs ||
      loadingChannels
    ) {
      return
    }
    didAutoLoadRef.current = true
    void loadPromotionList(0)
  }, [selectedConfigId, selectedChannel, loadingConfigs, loadingChannels])

  const resetRows = (): void => {
    setRows([])
    setTotal(0)
    setPageIndex(0)
    setHasQueried(false)
    setError('')
  }

  const loadPromotionList = async (
    nextPageIndex = 0,
    nextPageSize: (typeof PAGE_SIZE_OPTIONS)[number] = pageSize
  ): Promise<void> => {
    if (!selectedConfigId || !selectedChannel) {
      setError('请先选择常读账号和渠道')
      return
    }
    setFetching(true)
    setError('')
    try {
      const res = await changduService.getPromotionList({
        config_id: selectedConfigId,
        page_index: nextPageIndex,
        page_size: nextPageSize,
        distributor_id: selectedChannel.distributor_id,
        app_id: selectedChannel.app_id,
        app_type: selectedChannel.app_type,
        begin_date: beginDate || undefined,
        end_date: endDate || undefined,
        book_id: bookId || undefined,
        book_name: bookName || undefined
      })
      setRows(res.items)
      setTotal(res.total)
      setPageIndex(nextPageIndex)
      setHasQueried(true)
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || '加载推广链接列表失败'
      setError(msg)
      setRows([])
      setTotal(0)
      setHasQueried(true)
    } finally {
      setFetching(false)
    }
  }

  const copyText = async (text: string): Promise<void> => {
    if (!text) return
    await navigator.clipboard.writeText(text)
    toast.success('推广链接已复制')
  }

  const exportCurrentRows = (): void => {
    if (rows.length === 0) return
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const exportRows = exportReversed ? rows.slice().reverse() : rows
    downloadTextFile(
      `\uFEFF${buildPromotionCsv(exportRows)}`,
      `常读推广链接_${date}_第${pageIndex + 1}页${exportReversed ? '_倒序' : ''}.csv`,
      'text/csv;charset=utf-8;'
    )
    toast.success(exportReversed ? '当前页推广链接已倒序导出' : '当前页推广链接已导出')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>常读推广链接列表</CardTitle>
              <CardDescription>
                选择常读账号和渠道后，加载当前渠道下的推广链接记录。
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-base font-semibold">选择常读账号配置 *</Label>
              {configs.length > 0 ? (
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedConfigId ?? ''}
                  onChange={(event) => {
                    setSelectedConfigId(Number(event.target.value))
                    didAutoLoadRef.current = false
                    resetRows()
                  }}
                  disabled={loadingConfigs || fetching}
                >
                  {configs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.cookie_name || `配置 #${config.id}`}
                      {config.realname ? `（${config.realname}）` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                  暂无常读配置，请先在配置中心添加常读账号 Cookie。
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">选择常读渠道 *</Label>
              {channels.length > 0 ? (
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedDistributorId}
                  onChange={(event) => {
                    setSelectedDistributorId(event.target.value)
                    didAutoLoadRef.current = false
                    resetRows()
                  }}
                  disabled={loadingChannels || fetching}
                >
                  {channels.map((channel) => (
                    <option key={selectedChannelKey(channel)} value={selectedChannelKey(channel)}>
                      {channel.nick_name ||
                        channel.distributor_name ||
                        channel.app_name ||
                        '未命名渠道'}
                      （{getAppTypeLabel(channel.app_type)}，app_id={channel.app_id}，channel=
                      {channel.channel || '—'}，distributor_id={channel.distributor_id}）
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                  暂无可用渠道，请确认 Cookie 是否有效或账号是否有可用渠道。
                </div>
              )}
            </div>
          </div>

          {selectedChannel && (
            <p className="text-xs text-muted-foreground">
              当前渠道：{selectedChannel.nick_name || selectedChannel.distributor_name || '—'}
              ；类型：
              {getAppTypeLabel(selectedChannel.app_type)}；app_id：{selectedChannel.app_id}
              ；app_type：
              {selectedChannel.app_type}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="changdu-promotion-book-id">漫剧ID</Label>
              <Input
                id="changdu-promotion-book-id"
                value={bookId}
                onChange={(event) => {
                  setBookId(event.target.value)
                  resetRows()
                }}
                placeholder="输入漫剧ID精确搜索"
                disabled={fetching}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="changdu-promotion-book-name">漫剧名称</Label>
              <Input
                id="changdu-promotion-book-name"
                value={bookName}
                onChange={(event) => {
                  setBookName(event.target.value)
                  resetRows()
                }}
                placeholder="输入漫剧名称搜索"
                disabled={fetching}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="changdu-promotion-begin-date">创建开始日期</Label>
              <input
                id="changdu-promotion-begin-date"
                type="date"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={beginDate}
                onChange={(event) => {
                  setBeginDate(event.target.value)
                  resetRows()
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="changdu-promotion-end-date">创建结束日期</Label>
              <input
                id="changdu-promotion-end-date"
                type="date"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value)
                  resetRows()
                }}
              />
            </div>
            <Button
              type="button"
              onClick={() => void loadPromotionList(0)}
              disabled={!selectedConfigId || !selectedDistributorId || fetching || loadingChannels}
            >
              {fetching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  加载中…
                </>
              ) : (
                '加载推广链接'
              )}
            </Button>
          </div>

          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                共 {total} 条，第 {pageIndex + 1} / {totalPages} 页
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={exportReversed}
                    onCheckedChange={(checked) => setExportReversed(checked === true)}
                    disabled={fetching}
                  />
                  倒序导出
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={exportCurrentRows}
                  disabled={rows.length === 0 || fetching}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  导出CSV(本页)
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="min-w-[220px] px-3 py-3 text-left font-medium">推广链信息</th>
                    <th className="min-w-[240px] px-3 py-3 text-left font-medium">漫剧信息</th>
                    <th className="w-[150px] whitespace-nowrap px-3 py-3 text-left font-medium">
                      面板名称
                    </th>
                    <th className="w-[110px] whitespace-nowrap px-3 py-3 text-left font-medium">
                      起始集数
                    </th>
                    <th className="w-[110px] whitespace-nowrap px-3 py-3 text-left font-medium">
                      档位个数
                    </th>
                    <th className="w-[168px] whitespace-nowrap px-3 py-3 text-left font-medium">
                      创建时间
                    </th>
                    <th className="sticky right-0 z-20 w-[120px] whitespace-nowrap bg-muted px-3 py-3 text-left font-medium shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.promotion_id || `${row.book_id}-${row.create_time}`}
                      className="group border-b border-border/60 last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-3 py-3 align-top">
                        <div className="font-medium">{row.promotion_name || '—'}</div>
                        <div className="mt-0.5 break-all font-mono text-xs tabular-nums text-muted-foreground">
                          {row.promotion_id || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-medium">{row.book_name || '—'}</div>
                        <div className="mt-0.5 break-all font-mono text-xs tabular-nums text-muted-foreground">
                          {row.book_id || '—'}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          总集数：{row.episode_amount || '—'}集；发布抖音号：
                          {row.aweme_publish_name || '—'}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top text-muted-foreground">
                        {row.panel_name || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top tabular-nums text-muted-foreground">
                        {row.start_episode || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top tabular-nums text-muted-foreground">
                        {row.product_num || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top tabular-nums text-muted-foreground">
                        {row.create_time || '—'}
                      </td>
                      <td className="sticky right-0 z-10 whitespace-nowrap bg-background px-3 py-3 align-top shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)] group-hover:bg-muted/20">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void copyText(row.promotion_url)}
                          disabled={!row.promotion_url}
                        >
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          复制链接
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!fetching && hasQueried && rows.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">当前页暂无推广链数据。</p>
          )}

          {total > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="changdu-promotion-page-size"
                  className="whitespace-nowrap text-xs text-muted-foreground"
                >
                  每页
                </Label>
                <select
                  id="changdu-promotion-page-size"
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                  value={pageSize}
                  disabled={fetching}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    if (PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number])) {
                      setPageSize(value as (typeof PAGE_SIZE_OPTIONS)[number])
                      void loadPromotionList(0, value as (typeof PAGE_SIZE_OPTIONS)[number])
                    }
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option} 条
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canPrev || fetching}
                onClick={() => void loadPromotionList(pageIndex - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="changdu-promotion-page-index"
                  className="whitespace-nowrap text-xs text-muted-foreground"
                >
                  页码
                </Label>
                <select
                  id="changdu-promotion-page-index"
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                  value={pageIndex}
                  disabled={fetching}
                  onChange={(event) => void loadPromotionList(Number(event.target.value))}
                >
                  {Array.from({ length: totalPages }, (_, index) => (
                    <option key={index} value={index}>
                      第 {index + 1} 页
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canNext || fetching}
                onClick={() => void loadPromotionList(pageIndex + 1)}
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
