import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Clapperboard,
  Loader2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  Link2,
  Copy,
  Calendar
} from 'lucide-react'
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
  RadioGroup,
  RadioGroupItem,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Checkbox
} from '../../components/ui'
import { configService } from '../../services/config.service'
import {
  changduService,
  type ChangduChannelRow,
  type ChangduPromotionRow,
  type ChangduPromotionTemplateItem,
  type ChangduSeriesRow
} from '../../services/changdu.service'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

interface ImageChoiceCardProps {
  checked: boolean
  disabled?: boolean
  title: string
  subtitle?: string
  meta?: string
  onSelect: () => void
}

interface StatusTagMeta {
  label: string
  className: string
}

const ImageChoiceCard: React.FC<ImageChoiceCardProps> = ({
  checked,
  disabled = false,
  title,
  subtitle,
  meta,
  onSelect
}) => (
  <button
    type="button"
    onClick={onSelect}
    disabled={disabled}
    className={[
      'group relative rounded-lg border px-3 py-2.5 text-left transition-all',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-primary/40 hover:shadow-sm',
      checked
        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
        : 'border-border bg-card hover:bg-accent/20'
    ].join(' ')}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="truncate text-sm font-semibold text-foreground">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
        {meta && <div className="truncate text-[11px] text-muted-foreground">{meta}</div>}
      </div>
      <span
        className={[
          'mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-background text-transparent'
        ].join(' ')}
      >
        <CheckCircle className="h-3.5 w-3.5" />
      </span>
    </div>
  </button>
)

const getTemplateSegmentOneFee = (template: ChangduPromotionTemplateItem): number => {
  const segmentOneProduct = (template.product_list || []).find(
    (product) => Number(product.segment_number) === 1 && product.pay_fee != null
  )
  return segmentOneProduct?.pay_fee ?? Number.POSITIVE_INFINITY
}

const pickPreferredPaidTemplateId = (templates: ChangduPromotionTemplateItem[]): string => {
  if (templates.length === 0) return ''
  const sortedByFee = templates
    .map((template) => ({ template, fee: getTemplateSegmentOneFee(template) }))
    .filter((item) => Number.isFinite(item.fee))
    .sort((a, b) => a.fee - b.fee)

  const preferred = sortedByFee.find((item) => item.fee >= 200 && item.fee <= 500)
  return (preferred || sortedByFee[0])?.template.panel_template_id || templates[0].panel_template_id
}

const renderTemplatePreviewRows = (template: ChangduPromotionTemplateItem): React.ReactNode => (
  <div className="p-3 space-y-2 text-sm rounded-md border bg-muted/20">
    <div className="flex justify-between">
      <span className="text-muted-foreground">付费起始集数</span>
      <span>{template.start_episode || '—'}集</span>
    </div>
    {(template.product_list || []).map((product) => (
      <div
        key={product.segment_number}
        className="grid grid-cols-4 gap-2 pt-2 border-t border-border/60"
      >
        <span>档位{product.segment_number}</span>
        <span>解锁{product.unlock_episode}集</span>
        <span>折扣{product.discount != null ? product.discount / 100 : '—'}</span>
        <span>{product.pay_fee != null ? `${(product.pay_fee / 100).toFixed(2)}元` : '—'}</span>
      </div>
    ))}
  </div>
)

const PAGE_SIZE_OPTIONS = [10, 50, 100] as const
const DEFAULT_PAGE_SIZE = 100
const CHANGDU_SELECTED_CONFIG_STORAGE_KEY = 'changdu-short-drama:selected-config-id'
const CHANGDU_SELECTED_CHANNEL_STORAGE_KEY = 'changdu-short-drama:selected-channel-key'

const formatDateText = (d: Date): string => {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const parseDateText = (dateText: string): Date | null => {
  const normalized = dateText.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null
  const [year, month, day] = normalized.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

const todayText = (): string => formatDateText(new Date())

/** 含首尾在内最多 30 天，即结束日 = 开始日 + 29 */
const SERIES_DATE_RANGE_MAX_DAYS = 30
const SERIES_DATE_RANGE_MAX_OFFSET = SERIES_DATE_RANGE_MAX_DAYS - 1

const minDateText = (a: string, b: string): string => (a < b ? a : b)
const maxDateText = (a: string, b: string): string => (a > b ? a : b)

const shiftDateText = (dateText: string, days: number): string => {
  const base = parseDateText(dateText)
  if (!base) return todayText()
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return formatDateText(next)
}

const inclusiveEndFromStart = (start: string): string =>
  minDateText(shiftDateText(start, SERIES_DATE_RANGE_MAX_OFFSET), todayText())

const defaultSeriesStartDate = (): string =>
  shiftDateText(todayText(), -SERIES_DATE_RANGE_MAX_OFFSET)

const applySeriesStartChange = (start: string): { start: string; end: string } => {
  const nextStart = minDateText(start, todayText())
  return {
    start: nextStart,
    end: inclusiveEndFromStart(nextStart)
  }
}

const applySeriesEndChange = (start: string, end: string): { start: string; end: string } => {
  const maxEnd = inclusiveEndFromStart(start)
  let nextEnd = minDateText(end, todayText())
  nextEnd = minDateText(nextEnd, maxEnd)
  nextEnd = maxDateText(nextEnd, start)
  return { start, end: nextEnd }
}

const getPublishStatusTagMeta = (status?: string): StatusTagMeta => {
  const normalized = String(status || '').trim()
  if (normalized === '已发布') {
    return {
      label: normalized,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700'
    }
  }
  if (!normalized || normalized === '—') {
    return {
      label: normalized || '—',
      className: 'border-slate-200 bg-slate-50 text-slate-600'
    }
  }
  return {
    label: normalized,
    className: 'border-amber-200 bg-amber-50 text-amber-700'
  }
}

const getDeliveryStatusTagMeta = (status?: string): StatusTagMeta => {
  const normalized = String(status || '').trim()
  if (normalized === '可投放') {
    return {
      label: normalized,
      className: 'border-sky-200 bg-sky-50 text-sky-700'
    }
  }
  if (!normalized || normalized === '—') {
    return {
      label: normalized || '—',
      className: 'border-slate-200 bg-slate-50 text-slate-600'
    }
  }
  return {
    label: normalized,
    className: 'border-rose-200 bg-rose-50 text-rose-700'
  }
}

const canOperateSeriesRow = (row: ChangduSeriesRow): boolean =>
  String(row.publish_status || '').trim() === '已发布' &&
  String(row.delivery_status || '').trim() === '可投放'

export const ShortDramaListPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(false)
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [channels, setChannels] = useState<ChangduChannelRow[]>([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [selectedDistributorId, setSelectedDistributorId] = useState('')
  const [selectedPublishStatus, setSelectedPublishStatus] = useState<'all' | '1'>('all')
  const [selectedSearchType, setSelectedSearchType] = useState<'2' | '1'>('2')
  const [searchQuery, setSearchQuery] = useState('')
  const [seriesStartTime, setSeriesStartTime] = useState(() => defaultSeriesStartDate())
  const [seriesEndTime, setSeriesEndTime] = useState(() => todayText())
  const [activeListTab, setActiveListTab] = useState<'series' | 'promotion'>('series')
  const [promotionRows, setPromotionRows] = useState<ChangduPromotionRow[]>([])
  const [promotionTotal, setPromotionTotal] = useState(0)
  const [promotionPageIndex, setPromotionPageIndex] = useState(0)
  const [promotionBeginDate, setPromotionBeginDate] = useState('')
  const [promotionEndDate, setPromotionEndDate] = useState(todayText())
  const [promotionFetchingList, setPromotionFetchingList] = useState(false)
  const [promotionHasQueried, setPromotionHasQueried] = useState(false)
  const [rows, setRows] = useState<ChangduSeriesRow[]>([])
  const [total, setTotal] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [listLoaderMode, setListLoaderMode] = useState<'legacy' | 'direct'>('legacy')
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')
  const [hasQueried, setHasQueried] = useState(false)
  const [feishuOpen, setFeishuOpen] = useState(false)
  const [feishuSubmitting, setFeishuSubmitting] = useState(false)
  const [feishuBitableName, setFeishuBitableName] = useState('常读短剧列表')
  const [feishuTableName, setFeishuTableName] = useState('短剧数据')
  const [feishuStartPage, setFeishuStartPage] = useState(0)
  const [feishuMaxPages, setFeishuMaxPages] = useState(1)
  const [feishuFolderToken, setFeishuFolderToken] = useState('')
  const [feishuTarget, setFeishuTarget] = useState<'create' | 'append'>('create')
  const [feishuExistingAppToken, setFeishuExistingAppToken] = useState('')
  const [feishuExistingTableId, setFeishuExistingTableId] = useState('')
  const [feishuExistingBitableUrl, setFeishuExistingBitableUrl] = useState('')
  const [promotionOpen, setPromotionOpen] = useState(false)
  const [promotionRow, setPromotionRow] = useState<ChangduSeriesRow | null>(null)
  const [promotionName, setPromotionName] = useState('')
  const [promotionTemplates, setPromotionTemplates] = useState<ChangduPromotionTemplateItem[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [promotionLoading, setPromotionLoading] = useState(false)
  const [promotionSubmitting, setPromotionSubmitting] = useState(false)
  const [promotionUrl, setPromotionUrl] = useState('')
  /** 追加到已有表时：按短剧ID 更新已有行 */
  const [feishuUpsertByBookId, setFeishuUpsertByBookId] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async (): Promise<void> => {
      setLoadingConfigs(true)
      try {
        const list = await configService.getConfigsBySource(3)
        if (cancelled) return
        setConfigs(list)
        const rememberedConfigId = Number(
          window.localStorage.getItem(CHANGDU_SELECTED_CONFIG_STORAGE_KEY) || ''
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
          CHANGDU_SELECTED_CHANNEL_STORAGE_KEY
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
      window.localStorage.setItem(CHANGDU_SELECTED_CONFIG_STORAGE_KEY, String(selectedConfigId))
    }
  }, [selectedConfigId])

  useEffect(() => {
    if (selectedDistributorId) {
      window.localStorage.setItem(CHANGDU_SELECTED_CHANNEL_STORAGE_KEY, selectedDistributorId)
    }
  }, [selectedDistributorId])

  const selectedChannelKey = (channel: ChangduChannelRow): string =>
    `${channel.app_type}:${channel.app_id}:${channel.channel}:${channel.distributor_id}`

  const getAppTypeLabel = (appType: string): string => {
    if (appType === '21') return '付费漫剧'
    if (appType === '22') return '免费漫剧'
    return `app_type=${appType || '—'}`
  }

  const selectedChannel = channels.find(
    (item) => selectedChannelKey(item) === selectedDistributorId
  )
  const selectedConfig = configs.find((item) => item.id === selectedConfigId) || null
  const normalizedSearchQuery = searchQuery.trim()

  const resetListAfterFilterChange = (): void => {
    setRows([])
    setTotal(0)
    setPageIndex(0)
    setHasQueried(false)
    setError('')
  }

  const handleSeriesStartTimeChange = (value: string): void => {
    if (!parseDateText(value)) return
    const next = applySeriesStartChange(value)
    setSeriesStartTime(next.start)
    setSeriesEndTime(next.end)
    resetListAfterFilterChange()
  }

  const handleSeriesEndTimeChange = (value: string): void => {
    if (!parseDateText(value)) return
    const next = applySeriesEndChange(seriesStartTime, value)
    setSeriesStartTime(next.start)
    setSeriesEndTime(next.end)
    resetListAfterFilterChange()
  }

  const seriesStartMaxDate = todayText()
  const seriesEndMaxDate = parseDateText(seriesStartTime)
    ? inclusiveEndFromStart(seriesStartTime)
    : todayText()

  const loadListByFetcher = async (
    page: number,
    fetcher: (page: number) => Promise<{ items: ChangduSeriesRow[]; total: number }>
  ): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个常读账号配置')
      return
    }
    setFetching(true)
    setError('')
    try {
      const res = await fetcher(page)
      setRows(res.items)
      setTotal(res.total)
      setPageIndex(page)
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        (err as { detail?: string })?.detail ||
        '获取短剧列表失败'
      setError(msg)
      setRows([])
      setTotal(0)
    } finally {
      setHasQueried(true)
      setFetching(false)
    }
  }

  const loadList = async (page: number): Promise<void> => {
    setListLoaderMode('legacy')
    await loadListByFetcher(page, (targetPage) =>
      changduService.getSeriesList({
        config_id: selectedConfigId!,
        page_index: targetPage,
        page_size: pageSize
      })
    )
  }

  const loadListNew = async (page: number): Promise<void> => {
    if (!selectedChannel) {
      setError('请先选择常读渠道')
      return
    }
    setListLoaderMode('direct')
    await loadListByFetcher(page, (targetPage) =>
      changduService.getSeriesListNew({
        config_id: selectedConfigId!,
        page_index: targetPage,
        page_size: pageSize,
        distributor_id: selectedChannel.distributor_id,
        app_id: selectedChannel.app_id,
        app_type: selectedChannel.app_type,
        publish_status: selectedPublishStatus === 'all' ? undefined : selectedPublishStatus,
        search_type: normalizedSearchQuery ? selectedSearchType : undefined,
        query: normalizedSearchQuery || undefined,
        start_time: seriesStartTime || undefined,
        end_time: seriesEndTime || undefined
      })
    )
  }

  const loadCurrentModeList = async (page: number): Promise<void> => {
    await (listLoaderMode === 'direct' ? loadListNew(page) : loadList(page))
  }

  const handlePageSizeChange = (value: string): void => {
    const nextPageSize = Number(value)
    if (!PAGE_SIZE_OPTIONS.includes(nextPageSize as (typeof PAGE_SIZE_OPTIONS)[number])) return
    setPageSize(nextPageSize)
    if (hasQueried) {
      setRows([])
      setTotal(0)
      setPageIndex(0)
      setHasQueried(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const visiblePageIndexes = Array.from(
    new Set(
      [
        0,
        1,
        pageIndex - 2,
        pageIndex - 1,
        pageIndex,
        pageIndex + 1,
        pageIndex + 2,
        totalPages - 2,
        totalPages - 1
      ].filter((targetPage) => targetPage >= 0 && targetPage < totalPages)
    )
  ).sort((a, b) => a - b)
  const canPrev = pageIndex > 0
  const canNext = pageIndex + 1 < totalPages
  const promotionTotalPages = Math.max(1, Math.ceil(promotionTotal / 10))
  const promotionCanPrev = promotionPageIndex > 0
  const promotionCanNext = promotionPageIndex + 1 < promotionTotalPages

  const copyText = async (text: string, successText = '已复制'): Promise<void> => {
    if (!text) return
    await navigator.clipboard.writeText(text)
    toast.success(successText)
  }

  const openPromotionDialog = async (row: ChangduSeriesRow): Promise<void> => {
    if (!selectedConfigId || !selectedChannel) {
      setError('请先选择常读账号和渠道')
      return
    }
    if (!row.book_id) {
      toast.error('当前行缺少漫剧 ID')
      return
    }
    setPromotionRow(row)
    setPromotionName(`${todayText()}-${row.series_name || row.book_id}`)
    setPromotionTemplates([])
    setSelectedTemplateId('')
    setPromotionUrl('')
    setPromotionOpen(true)
    setPromotionLoading(true)
    try {
      const res = await changduService.getPromotionTemplates({
        config_id: selectedConfigId,
        book_id: row.book_id,
        distributor_id: selectedChannel.distributor_id,
        app_id: selectedChannel.app_id,
        app_type: selectedChannel.app_type as '21' | '22'
      })
      setPromotionTemplates(res.templates)
      setSelectedTemplateId(res.templates[0]?.panel_template_id || '')
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || '加载推广链模板失败'
      toast.error(msg)
    } finally {
      setPromotionLoading(false)
    }
  }

  const selectedTemplate = promotionTemplates.find(
    (item) => item.panel_template_id === selectedTemplateId
  )

  const submitPromotionCreate = async (): Promise<void> => {
    if (!selectedConfigId || !selectedChannel || !promotionRow) return
    if (!promotionName.trim()) {
      toast.error('请填写推广链名称')
      return
    }
    if (!selectedTemplateId) {
      toast.error(selectedChannel.app_type === '22' ? '请选择广告起始集数' : '请选择充值模板')
      return
    }
    setPromotionSubmitting(true)
    try {
      const res = await changduService.createPromotionLink({
        config_id: selectedConfigId,
        book_id: promotionRow.book_id,
        distributor_id: selectedChannel.distributor_id,
        app_id: selectedChannel.app_id,
        app_type: selectedChannel.app_type as '21' | '22',
        promotion_name: promotionName.trim(),
        purchase_panel_template_id: selectedTemplateId
      })
      const url = res.promotion_info?.promotion_url || ''
      setPromotionUrl(url)
      toast.success('推广链创建成功')
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || '创建推广链失败'
      toast.error(msg)
    } finally {
      setPromotionSubmitting(false)
    }
  }

  const copyPromotionUrl = async (): Promise<void> => {
    await copyText(promotionUrl, '推广链接已复制')
  }

  const openFeishuDialog = (): void => {
    if (!selectedConfigId) {
      setError('请选择一个常读账号配置')
      return
    }
    setFeishuStartPage(pageIndex)
    setFeishuOpen(true)
  }

  const submitFeishuPush = async (): Promise<void> => {
    if (!selectedConfigId) return
    const maxPages = Math.min(50, Math.max(1, Math.floor(Number(feishuMaxPages)) || 1))
    const startPage = Math.max(0, Math.floor(Number(feishuStartPage)) || 0)
    if (feishuTarget === 'append') {
      const app = feishuExistingAppToken.trim()
      const tbl = feishuExistingTableId.trim()
      if (!app || !tbl) {
        toast.error('请填写多维表格 app_token 与数据表 table_id（在飞书表格 URL 或 API 中可查看）')
        return
      }
    }
    setFeishuSubmitting(true)
    try {
      const res =
        feishuTarget === 'append'
          ? await changduService.pushSeriesListToFeishu({
              config_id: selectedConfigId,
              start_page: startPage,
              max_pages: maxPages,
              existing_app_token: feishuExistingAppToken.trim(),
              existing_table_id: feishuExistingTableId.trim(),
              existing_bitable_url: feishuExistingBitableUrl.trim() || undefined,
              upsert_by_book_id: feishuUpsertByBookId || undefined
            })
          : await changduService.pushSeriesListToFeishu({
              config_id: selectedConfigId,
              bitable_name: feishuBitableName.trim() || '常读短剧列表',
              table_name: feishuTableName.trim() || '短剧数据',
              start_page: startPage,
              max_pages: maxPages,
              folder_token: feishuFolderToken.trim() || undefined
            })
      const title = res.mode === 'append' ? '已追加到飞书多维表格' : '已创建飞书多维表格'
      const upsertPart =
        res.mode === 'append' &&
        feishuUpsertByBookId &&
        (res.updated_count != null || res.created_count != null)
          ? `更新 ${res.updated_count ?? 0} 条，新增 ${res.created_count ?? 0} 条；`
          : ''
      toast.success(title, {
        description: `${upsertPart}写入 ${res.record_count ?? 0} 条（列表总计约 ${res.list_total} 条，已抓 ${res.pages_fetched} 页）`
      })
      if (res.app_url) {
        window.open(res.app_url, '_blank', 'noopener,noreferrer')
      }
      setFeishuOpen(false)
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message || (err as { detail?: string })?.detail || '同步失败'
      toast.error(msg)
    } finally {
      setFeishuSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2 items-center text-xl">
            <Clapperboard className="w-5 h-5" />
            常读漫剧列表(实时)
          </CardTitle>
          <CardDescription>
            选择常读 Cookie 配置后加载列表（每页 100 条）；可一键同步到飞书多维表格（需绑定飞书）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">选择常读账号配置 *</Label>
            {loadingConfigs ? (
              <div className="flex justify-center items-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : configs.length === 0 ? (
              <div className="p-4 text-center rounded-md border text-muted-foreground">
                暂无常读配置，请先在配置中心添加常读账号的 Cookie（需包含 adUserId、sessionid 等）
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {configs.map((config) => (
                  <ImageChoiceCard
                    key={config.id}
                    checked={selectedConfigId === config.id}
                    title={config.cookie_name}
                    subtitle={config.realname || undefined}
                    meta={`配置 ID：${config.id}`}
                    onSelect={() => {
                      setSelectedConfigId(config.id)
                      setRows([])
                      setChannels([])
                      setSelectedDistributorId('')
                      setTotal(0)
                      setPageIndex(0)
                      setHasQueried(false)
                      setError('')
                    }}
                  />
                ))}
              </div>
            )}
            {selectedConfig && (
              <p className="text-xs text-muted-foreground">
                当前选择：{selectedConfig.realname || selectedConfig.cookie_name}（配置 ID：
                {selectedConfig.id}）
              </p>
            )}
          </div>

          {selectedConfigId && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">选择常读渠道 *</Label>
              {loadingChannels ? (
                <div className="flex gap-2 items-center text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  正在加载渠道…
                </div>
              ) : channels.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {channels.map((channel) => {
                    const channelKey = selectedChannelKey(channel)
                    const channelTitle =
                      channel.nick_name ||
                      channel.distributor_name ||
                      channel.app_name ||
                      '未命名渠道'
                    return (
                      <ImageChoiceCard
                        key={channelKey}
                        checked={selectedDistributorId === channelKey}
                        title={channelTitle}
                        subtitle={getAppTypeLabel(channel.app_type)}
                        meta={`app_id=${channel.app_id} · channel=${channel.channel || '—'} · distributor_id=${channel.distributor_id}`}
                        onSelect={() => {
                          setSelectedDistributorId(channelKey)
                          setRows([])
                          setTotal(0)
                          setPageIndex(0)
                          setHasQueried(false)
                          setError('')
                        }}
                      />
                    )
                  })}
                </div>
              ) : (
                <div className="p-3 text-sm rounded-md border text-muted-foreground">
                  暂无可用渠道，请确认 Cookie 是否有效或账号是否有可用渠道。
                </div>
              )}
              {selectedChannel && (
                <p className="text-xs text-muted-foreground">
                  应用：{selectedChannel.app_name || '—'}；渠道：
                  {selectedChannel.nick_name || selectedChannel.distributor_name || '—'}； 类型：
                  {getAppTypeLabel(selectedChannel.app_type)}；app_id：{selectedChannel.app_id}
                  ；app_type：{selectedChannel.app_type}
                </p>
              )}
            </div>
          )}

          {selectedConfigId && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">发布状态 </Label>
              <select
                className="px-3 py-2 w-full max-w-xs text-sm rounded-md border bg-background border-input"
                value={selectedPublishStatus}
                onChange={(event) => {
                  setSelectedPublishStatus(event.target.value as 'all' | '1')
                  setRows([])
                  setTotal(0)
                  setPageIndex(0)
                  setHasQueried(false)
                  setError('')
                }}
              >
                <option value="all">全部</option>
                <option value="1">已发布</option>
              </select>
              <p className="text-xs text-muted-foreground">
                选择“已发布”时，请求会追加 publish_status=1。
              </p>
            </div>
          )}

          {selectedConfigId && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">创建时间</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <input
                    type="date"
                    className="flex-1 min-w-0 bg-transparent border-0 p-0 text-sm focus:outline-none focus:ring-0"
                    value={seriesStartTime}
                    max={seriesStartMaxDate}
                    onChange={(event) => handleSeriesStartTimeChange(event.target.value)}
                  />
                  <span className="px-2 text-muted-foreground">-</span>
                  <input
                    type="date"
                    className="flex-1 min-w-0 bg-transparent border-0 p-0 text-sm focus:outline-none focus:ring-0"
                    value={seriesEndTime}
                    min={seriesStartTime}
                    max={seriesEndMaxDate}
                    onChange={(event) => handleSeriesEndTimeChange(event.target.value)}
                  />
                  <Calendar className="ml-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                含首尾最多 {SERIES_DATE_RANGE_MAX_DAYS}{' '}
                天；选开始日期后结束日期自动对齐（不超过今天）。
              </p>
            </div>
          )}

          {selectedConfigId && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">搜索筛选</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select
                  className="px-3 py-2 w-full max-w-xs text-sm rounded-md border bg-background border-input sm:w-44"
                  value={selectedSearchType}
                  onChange={(event) => {
                    setSelectedSearchType(event.target.value as '1' | '2')
                    setRows([])
                    setTotal(0)
                    setPageIndex(0)
                    setHasQueried(false)
                    setError('')
                  }}
                >
                  <option value="2">漫剧名称</option>
                  <option value="1">漫剧ID</option>
                </select>
                <input
                  className="px-3 py-2 w-full max-w-xl text-sm rounded-md border bg-background border-input"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                    setRows([])
                    setTotal(0)
                    setPageIndex(0)
                    setHasQueried(false)
                    setError('')
                  }}
                  placeholder={
                    selectedSearchType === '1'
                      ? '输入漫剧ID，如 7637057900384357438'
                      : '输入漫剧名称，如 以爱为家，不负余生'
                  }
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 items-center">
            {/* <Button
              type="button"
              onClick={() => void loadList(0)}
              disabled={!selectedConfigId || fetching || configs.length === 0}
            >
              {fetching ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  加载中…
                </>
              ) : (
                '加载列表'
              )}
            </Button> */}
            <Button
              type="button"
              variant="secondary"
              onClick={() => void loadListNew(0)}
              disabled={
                !selectedConfigId ||
                fetching ||
                loadingChannels ||
                configs.length === 0 ||
                !selectedDistributorId
              }
            >
              {fetching ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  加载中…
                </>
              ) : (
                '加载列表'
              )}
            </Button>
            {/* <Button
              type="button"
              variant="outline"
              onClick={openFeishuDialog}
              disabled={!selectedConfigId || fetching || configs.length === 0 || feishuSubmitting}
            >
              <Send className="mr-2 w-4 h-4" />
              同步到飞书多维表格
            </Button> */}
            {activeListTab === 'series' && total > 0 && (
              <span className="text-sm text-muted-foreground">
                共 {total} 条，第 {pageIndex + 1} / {totalPages} 页
              </span>
            )}
            {activeListTab === 'promotion' && promotionTotal > 0 && (
              <span className="text-sm text-muted-foreground">
                推广链共 {promotionTotal} 条，第 {promotionPageIndex + 1} / {promotionTotalPages} 页
              </span>
            )}
          </div>

          {error && (
            <div className="p-3 text-sm rounded-md border text-destructive border-destructive/30 bg-destructive/5">
              {error}
            </div>
          )}
          {rows.length > 0 && activeListTab === 'series' && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-3 font-medium text-left min-w-[240px]">短剧名称 / ID</th>
                    <th className="px-3 py-3 font-medium text-left whitespace-nowrap w-[168px]">
                      创建时间
                    </th>
                    <th className="px-3 py-3 font-medium text-left min-w-[160px]">分类</th>
                    <th className="px-3 py-3 font-medium text-left whitespace-nowrap w-[88px]">
                      连载状态
                    </th>
                    <th className="px-3 py-3 font-medium text-left whitespace-nowrap w-[72px]">
                      集数
                    </th>
                    <th className="px-3 py-3 font-medium text-left whitespace-nowrap w-[88px]">
                      性别受众
                    </th>
                    <th className="px-3 py-3 font-medium text-left whitespace-nowrap w-[168px]">
                      预估投放时间
                    </th>
                    <th className="px-3 py-3 font-medium text-left whitespace-nowrap w-[168px]">
                      预估可投时间
                    </th>
                    <th className="px-3 py-3 font-medium text-left whitespace-nowrap w-[120px]">
                      授权状态
                    </th>
                    <th className="sticky right-0 z-20 px-3 py-3 font-medium text-center whitespace-nowrap bg-muted w-[120px] shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.9)]">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const publishStatusTag = getPublishStatusTagMeta(row.publish_status)
                    const deliveryStatusTag = getDeliveryStatusTagMeta(row.delivery_status)
                    const allowOperate = canOperateSeriesRow(row)
                    return (
                      <tr
                        key={row.book_id || `${row.series_name}-${row.create_time}`}
                        className="group border-b border-border/60 last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-3 py-3 align-top">
                          <div className="flex gap-3 items-start min-w-0">
                            <div className="flex-shrink-0 overflow-hidden w-12 h-16 rounded-md border bg-muted">
                              {row.thumb_url ? (
                                <img
                                  src={row.thumb_url}
                                  alt={row.series_name || '短剧封面'}
                                  className="object-cover w-full h-full"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex justify-center items-center w-full h-full text-xs text-muted-foreground">
                                  无图
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium">{row.series_name || '—'}</div>
                              <div className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground break-all">
                                {row.book_id || '—'}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${publishStatusTag.className}`}
                                >
                                  发布：{publishStatusTag.label}
                                </span>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${deliveryStatusTag.className}`}
                                >
                                  投放：{deliveryStatusTag.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top tabular-nums text-muted-foreground whitespace-nowrap">
                          {row.create_time || '—'}
                        </td>
                        <td className="px-3 py-3 align-top text-muted-foreground">
                          {row.category || '—'}
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap text-muted-foreground">
                          {row.creation_status || '—'}
                        </td>
                        <td className="px-3 py-3 align-top tabular-nums text-muted-foreground whitespace-nowrap">
                          {row.episode_amount || '—'}
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap text-muted-foreground">
                          {row.gender || '—'}
                        </td>
                        <td className="px-3 py-3 align-top tabular-nums text-muted-foreground whitespace-nowrap">
                          {row.estimate_publish_time || '—'}
                        </td>
                        <td className="px-3 py-3 align-top tabular-nums text-muted-foreground whitespace-nowrap">
                          {row.publish_time || '—'}
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap text-muted-foreground">
                          {row.permission_status || '—'}
                        </td>
                        <td className="sticky right-0 z-10 px-3 py-3 align-top whitespace-nowrap bg-background shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)] group-hover:bg-muted/20">
                          {allowOperate ? (
                            <div className="flex flex-col gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void openPromotionDialog(row)}
                                disabled={
                                  !selectedChannel || promotionLoading || promotionSubmitting
                                }
                              >
                                <Link2 className="mr-1.5 w-3.5 h-3.5" />
                                获取推广链
                              </Button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeListTab === 'promotion' && promotionRows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-3 font-medium text-left min-w-[220px]">推广链信息</th>
                    <th className="px-3 py-3 font-medium text-left min-w-[240px]">漫剧信息</th>
                    <th className="px-3 py-3 font-medium text-left whitespace-nowrap w-[150px]">
                      面板名称
                    </th>
                    <th className="px-3 py-3 font-medium text-left whitespace-nowrap w-[110px]">
                      起始集数
                    </th>
                    <th className="px-3 py-3 font-medium text-left whitespace-nowrap w-[110px]">
                      档位个数
                    </th>
                    <th className="px-3 py-3 font-medium text-left whitespace-nowrap w-[168px]">
                      创建时间
                    </th>
                    <th className="sticky right-0 z-20 px-3 py-3 font-medium text-left whitespace-nowrap bg-muted w-[120px] shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {promotionRows.map((row) => (
                    <tr
                      key={row.promotion_id || `${row.book_id}-${row.create_time}`}
                      className="group border-b border-border/60 last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-3 py-3 align-top">
                        <div className="font-medium">{row.promotion_name || '—'}</div>
                        <div className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground break-all">
                          {row.promotion_id || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-medium">{row.book_name || '—'}</div>
                        <div className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground break-all">
                          {row.book_id || '—'}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          总集数：{row.episode_amount || '—'}集；发布抖音号：
                          {row.aweme_publish_name || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top whitespace-nowrap text-muted-foreground">
                        {row.panel_name || '—'}
                      </td>
                      <td className="px-3 py-3 align-top tabular-nums text-muted-foreground whitespace-nowrap">
                        {row.start_episode || '—'}
                      </td>
                      <td className="px-3 py-3 align-top tabular-nums text-muted-foreground whitespace-nowrap">
                        {row.product_num || '—'}
                      </td>
                      <td className="px-3 py-3 align-top tabular-nums text-muted-foreground whitespace-nowrap">
                        {row.create_time || '—'}
                      </td>
                      <td className="sticky right-0 z-10 px-3 py-3 align-top whitespace-nowrap bg-background shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)] group-hover:bg-muted/20">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void copyText(row.promotion_url, '推广链接已复制')}
                          disabled={!row.promotion_url}
                        >
                          <Copy className="mr-1.5 w-3.5 h-3.5" />
                          复制链接
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!promotionFetchingList &&
            activeListTab === 'promotion' &&
            promotionHasQueried &&
            promotionRows.length === 0 &&
            !error && <p className="text-sm text-muted-foreground">当前页暂无推广链数据。</p>}

          {!fetching &&
            activeListTab === 'series' &&
            rows.length === 0 &&
            selectedConfigId &&
            !error &&
            !hasQueried && (
              <p className="text-sm text-muted-foreground">点击「加载列表」获取短剧数据。</p>
            )}
          {!fetching && activeListTab === 'series' && hasQueried && rows.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">当前页暂无短剧数据。</p>
          )}

          {activeListTab === 'series' && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2 items-center">
                <Label htmlFor="series-page-size" className="text-sm text-muted-foreground">
                  每页
                </Label>
                <select
                  id="series-page-size"
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                  value={pageSize}
                  onChange={(event) => handlePageSizeChange(event.target.value)}
                  disabled={fetching}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size} 条
                    </option>
                  ))}
                </select>
              </div>
              {total > pageSize && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canPrev || fetching}
                    onClick={() => void loadCurrentModeList(pageIndex - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    上一页
                  </Button>
                  {visiblePageIndexes.map((targetPage, index) => {
                    const prevPage = visiblePageIndexes[index - 1]
                    const showEllipsis = index > 0 && targetPage - prevPage > 1
                    return (
                      <React.Fragment key={targetPage}>
                        {showEllipsis && (
                          <span className="px-1 text-sm text-muted-foreground">…</span>
                        )}
                        <Button
                          type="button"
                          variant={targetPage === pageIndex ? 'default' : 'outline'}
                          size="sm"
                          disabled={fetching || targetPage === pageIndex}
                          onClick={() => void loadCurrentModeList(targetPage)}
                          className="min-w-8 px-2"
                        >
                          {targetPage + 1}
                        </Button>
                      </React.Fragment>
                    )
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canNext || fetching}
                    onClick={() => void loadCurrentModeList(pageIndex + 1)}
                  >
                    下一页
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={promotionOpen} onOpenChange={setPromotionOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[86vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建推广链</DialogTitle>
            <DialogDescription>
              {selectedChannel?.app_type === '22'
                ? '免费漫剧使用广告起始集数创建推广链。'
                : '付费漫剧使用充值模板创建推广链。'}
            </DialogDescription>
          </DialogHeader>
          {promotionRow && (
            <div className="grid gap-4 py-2">
              {selectedChannel?.app_type === '22' && (
                <div className="px-3 py-2 text-sm rounded-md border border-amber-200 bg-amber-50 text-amber-900">
                  广告起始集数不支持自定义，仅可选择预设集数
                </div>
              )}
              <div className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-3 text-sm">
                <span className="text-muted-foreground">
                  {selectedChannel?.app_type === '22' ? '短剧名称' : '漫剧名称'}
                </span>
                <span className="font-medium">{promotionRow.series_name || '—'}</span>
                <span className="text-muted-foreground">
                  {selectedChannel?.app_type === '22' ? '短剧id' : '漫剧id'}
                </span>
                <span className="font-mono text-xs break-all">{promotionRow.book_id}</span>
                <span className="text-muted-foreground">发布状态</span>
                <span>{promotionRow.publish_status || '—'}</span>
                <span className="text-muted-foreground">总集数</span>
                <span>{promotionRow.episode_amount || '—'}集</span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="promotion-name">推广链名称 *</Label>
                <Input
                  id="promotion-name"
                  value={promotionName}
                  onChange={(event) => setPromotionName(event.target.value)}
                  placeholder="请输入推广链名称"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="promotion-template">
                  {selectedChannel?.app_type === '22' ? '广告起始集数 *' : '充值模板选择 *'}
                </Label>
                <select
                  id="promotion-template"
                  className="px-3 py-2 w-full text-sm rounded-md border bg-background border-input"
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  disabled={promotionLoading || promotionTemplates.length === 0}
                >
                  {promotionLoading ? (
                    <option value="">加载中...</option>
                  ) : promotionTemplates.length > 0 ? (
                    promotionTemplates.map((item) => (
                      <option key={item.panel_template_id} value={item.panel_template_id}>
                        {selectedChannel?.app_type === '22'
                          ? `${item.start_episode || '—'}集`
                          : item.panel_name || item.panel_template_id}
                      </option>
                    ))
                  ) : (
                    <option value="">暂无可用模板</option>
                  )}
                </select>
              </div>

              {selectedTemplate && selectedChannel?.app_type !== '22' && (
                <div className="p-3 space-y-2 text-sm rounded-md border bg-muted/20">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">付费起始集数</span>
                    <span>{selectedTemplate.start_episode || '—'}集</span>
                  </div>
                  {(selectedTemplate.product_list || []).map((product) => (
                    <div
                      key={product.segment_number}
                      className="grid grid-cols-4 gap-2 pt-2 border-t border-border/60"
                    >
                      <span>档位{product.segment_number}</span>
                      <span>解锁{product.unlock_episode}集</span>
                      <span>折扣{product.discount != null ? product.discount / 100 : '—'}</span>
                      <span>
                        {product.pay_fee != null ? `${(product.pay_fee / 100).toFixed(2)}元` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {promotionUrl && (
                <div className="p-3 space-y-2 text-sm rounded-md border bg-emerald-50 border-emerald-200">
                  <div className="font-medium text-emerald-900">推广链创建成功</div>
                  <div className="font-mono text-xs break-all text-emerald-950">{promotionUrl}</div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void copyPromotionUrl()}
                  >
                    <Copy className="mr-1.5 w-3.5 h-3.5" />
                    复制推广链接
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPromotionOpen(false)}
              disabled={promotionSubmitting}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void submitPromotionCreate()}
              disabled={promotionLoading || promotionSubmitting || !selectedTemplateId}
            >
              {promotionSubmitting && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={feishuOpen} onOpenChange={setFeishuOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>同步到飞书多维表格</DialogTitle>
            <DialogDescription>
              使用当前账号的飞书授权写入数据。服务端按页重新抓取常读列表（每页 100
              条）。写入已有表时，列名需与首次创建时一致（短剧ID、短剧名称等）。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label>目标</Label>
              <RadioGroup
                value={feishuTarget}
                onValueChange={(v) => setFeishuTarget(v as 'create' | 'append')}
                className="flex flex-col gap-2"
              >
                <label className="flex gap-2 items-center text-sm cursor-pointer">
                  <RadioGroupItem value="create" id="feishu-t-create" />
                  <span>新建多维表格并写入</span>
                </label>
                <label className="flex gap-2 items-center text-sm cursor-pointer">
                  <RadioGroupItem value="append" id="feishu-t-append" />
                  <span>追加到已有数据表</span>
                </label>
              </RadioGroup>
            </div>
            {feishuTarget === 'append' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="feishu-app-token">多维表格 app_token</Label>
                  <Input
                    id="feishu-app-token"
                    value={feishuExistingAppToken}
                    onChange={(e) => setFeishuExistingAppToken(e.target.value)}
                    placeholder="如 bascnxxxxxxxx"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="feishu-table-id">数据表 table_id</Label>
                  <Input
                    id="feishu-table-id"
                    value={feishuExistingTableId}
                    onChange={(e) => setFeishuExistingTableId(e.target.value)}
                    placeholder="如 tblxxxxxxxx"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="feishu-open-url">浏览器打开链接（可选）</Label>
                  <Input
                    id="feishu-open-url"
                    value={feishuExistingBitableUrl}
                    onChange={(e) => setFeishuExistingBitableUrl(e.target.value)}
                    placeholder="从地址栏复制完整链接；企业租户域名时优先填此项"
                  />
                  <p className="text-xs text-muted-foreground">
                    不填则使用 https://www.feishu.cn/base/…?table=…
                    ；若仍打不开请粘贴飞书里复制的链接。
                  </p>
                </div>
                <div className="flex gap-3 items-start rounded-md border border-border/60 bg-muted/20 p-3">
                  <Checkbox
                    id="feishu-upsert"
                    checked={feishuUpsertByBookId}
                    onCheckedChange={(c) => setFeishuUpsertByBookId(c === true)}
                  />
                  <label
                    htmlFor="feishu-upsert"
                    className="text-sm leading-snug cursor-pointer text-muted-foreground"
                  >
                    按「短剧ID」更新已有行（需数据表中存在「短剧ID」列；会先拉取该表全部记录再合并写入）
                  </label>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="feishu-bitable">多维表格名称</Label>
                  <Input
                    id="feishu-bitable"
                    value={feishuBitableName}
                    onChange={(e) => setFeishuBitableName(e.target.value)}
                    placeholder="常读短剧列表"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="feishu-table">数据表名称</Label>
                  <Input
                    id="feishu-table"
                    value={feishuTableName}
                    onChange={(e) => setFeishuTableName(e.target.value)}
                    placeholder="短剧数据"
                  />
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="feishu-start">起始页（0 起）</Label>
                <Input
                  id="feishu-start"
                  type="number"
                  min={0}
                  value={feishuStartPage}
                  onChange={(e) => setFeishuStartPage(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feishu-max">抓取页数（1–50）</Label>
                <Input
                  id="feishu-max"
                  type="number"
                  min={1}
                  max={50}
                  value={feishuMaxPages}
                  onChange={(e) =>
                    setFeishuMaxPages(Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feishu-folder">文件夹 token（可选）</Label>
              <Input
                id="feishu-folder"
                value={feishuFolderToken}
                onChange={(e) => setFeishuFolderToken(e.target.value)}
                placeholder="不填则创建在云空间根目录"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setFeishuOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              disabled={feishuSubmitting}
              onClick={() => void submitFeishuPush()}
            >
              {feishuSubmitting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  提交中…
                </>
              ) : (
                '开始同步'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
