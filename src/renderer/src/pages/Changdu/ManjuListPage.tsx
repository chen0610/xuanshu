import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Film,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  Database,
  X
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
  Textarea,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../components/ui'
import { cn } from '../../lib/utils'
import {
  changduService,
  type ChangduSeriesDatabaseHistorySyncResponse,
  type ChangduSeriesDbItem
} from '../../services/changdu.service'
import { configService } from '../../services/config.service'
import { useAuth } from '../../hooks/useAuth'
import { CustomOceanBatchAppendButton } from './CustomOceanBatchAppendButton'

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 500]
const AWEME_FILTER_STORAGE_KEY = 'changdu.manjuList.awemePublishFilter'
const ADVANCED_FILTER_STORAGE_KEY = 'changdu.manjuList.advancedFilterExpanded'

type AwemeFilterField = 'nick_name' | 'douyin_id'
type PublishStatusFilter = 'all' | '已发布' | '未发布'
type DeliveryStatusFilter = 'all' | '可投放' | '不可投放'

type AwemeFilterTagRule = {
  keyword: string
  tag: string
}

const AWEME_FILTER_LABELS: Record<AwemeFilterField, string> = {
  nick_name: '抖音号昵称',
  douyin_id: '抖音ID'
}

const PUBLISH_STATUS_LABELS: Record<PublishStatusFilter, string> = {
  all: '全部',
  已发布: '已发布',
  未发布: '未发布'
}

const DELIVERY_STATUS_LABELS: Record<DeliveryStatusFilter, string> = {
  all: '全部',
  可投放: '可投放',
  不可投放: '不可投放'
}

function formatDt(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function formatAwemePublisher(row: ChangduSeriesDbItem): string {
  const nickName = row.aweme_publish_nick_name?.trim()
  const douyinId = row.aweme_publish_douyin_id?.trim()
  if (nickName && douyinId) return `${nickName}(${douyinId})`
  return nickName || douyinId || '—'
}

function formatPlayletId(value: string | null | undefined): string {
  const normalized = String(value ?? '').trim()
  if (!normalized || normalized === '0') return '—'
  return normalized
}

function normalizeMultilineFilterInput(value: string): string {
  return value
    .split(/\r?\n/)
    .flatMap((line) =>
      line
        .split(/[,，;]+/)
        .map((part) => part.trim())
        .filter(Boolean)
    )
    .join('\n')
}

function handleNormalizedTextareaPaste(
  event: React.ClipboardEvent<HTMLTextAreaElement>,
  normalize: (value: string) => string,
  setter: (value: string) => void
): void {
  const pastedRaw = event.clipboardData.getData('text')
  if (!pastedRaw) return

  event.preventDefault()
  const textarea = event.currentTarget
  const pasted = normalize(pastedRaw)
  const start = textarea.selectionStart ?? 0
  const end = textarea.selectionEnd ?? 0
  const next = textarea.value.slice(0, start) + pasted + textarea.value.slice(end)
  setter(next)

  const cursorPos = start + pasted.length
  requestAnimationFrame(() => {
    textarea.setSelectionRange(cursorPos, cursorPos)
  })
}

function normalizeAwemeFilterInput(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/[\s，。]+/g, ','))
    .join('\n')
}

function parseAwemeFilterTagRules(value: string): AwemeFilterTagRule[] {
  return value
    .split(/\r?\n/)
    .map((line) => {
      const [keyword = '', tag = ''] = line.split(',', 2)
      return { keyword: keyword.trim(), tag: tag.trim() }
    })
    .filter((rule) => rule.keyword.length > 0 && rule.tag.length > 0)
}

function getAwemePublisherTags(
  row: ChangduSeriesDbItem,
  field: AwemeFilterField,
  rules: AwemeFilterTagRule[]
): string[] {
  const target = (field === 'nick_name' ? row.aweme_publish_nick_name : row.aweme_publish_douyin_id)
    ?.trim()
    .toLowerCase()
  if (!target) return []
  return rules
    .filter((rule) => target.includes(rule.keyword.toLowerCase()))
    .map((rule) => rule.tag)
}

function escapeCsvCell(value: string | number | null | undefined): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

async function downloadCsv(filename: string, rows: string[][]): Promise<void> {
  const csvContent = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')

  if (window.api?.saveFileAndOpenFolder) {
    const result = await window.api.saveFileAndOpenFolder('\ufeff' + csvContent, filename)
    if (result.success || result.canceled) return
  }

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function formatExportTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')
}

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
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

const todayText = (): string => formatDateText(new Date())

const LAST_MONTH_DAYS = 30

const defaultCreateTimeEnd = (): string => todayText()

const defaultCreateTimeStart = (): string => shiftDateText(todayText(), -LAST_MONTH_DAYS)

const COLLECT_DATE_RANGE_MAX_DAYS = 30
const COLLECT_DATE_RANGE_MAX_OFFSET = COLLECT_DATE_RANGE_MAX_DAYS - 1

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
  minDateText(shiftDateText(start, COLLECT_DATE_RANGE_MAX_OFFSET), todayText())

const defaultCollectStartDate = (): string =>
  shiftDateText(todayText(), -COLLECT_DATE_RANGE_MAX_OFFSET)

const applyCollectStartChange = (start: string): { start: string; end: string } => {
  const nextStart = minDateText(start, todayText())
  return {
    start: nextStart,
    end: inclusiveEndFromStart(nextStart)
  }
}

const applyCollectEndChange = (start: string, end: string): { start: string; end: string } => {
  const maxEnd = inclusiveEndFromStart(start)
  let nextEnd = minDateText(end, todayText())
  nextEnd = minDateText(nextEnd, maxEnd)
  nextEnd = maxDateText(nextEnd, start)
  return { start, end: nextEnd }
}

interface ChangduConfigOption {
  id: number
  cookie_name: string
  realname?: string
}

const formatCollectConfigOption = (config: ChangduConfigOption): string => {
  const name = config.cookie_name.trim() || `配置 ${config.id}`
  const realname = config.realname?.trim()
  const realnamePart =
    realname && realname !== name ? ` · ${realname}` : ''
  return `${name}${realnamePart}（配置 ID：${config.id}）`
}

const MANJU_EXPORT_HEADERS = [
  '剧名',
  '剧ID',
  '专辑ID',
  '分类',
  '创建时间',
  '预估投放时间',
  '上次更新时间',
  '连载状态',
  '集数',
  '性别受众',
  '发布抖音号昵称',
  '发布抖音ID',
  '发布抖音号',
  '投放状态',
  '发布状态',
  '权限状态',
  '发布时间'
]

function countMultilineKeywords(value: string): number {
  return normalizeMultilineFilterInput(value).split('\n').filter(Boolean).length
}

type ActiveFilterTag = {
  key: string
  label: string
  onRemove: () => void
}

const FilterSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-3">
    <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
      <span className="h-4 w-0.5 rounded-full bg-primary" aria-hidden />
      {title}
    </h3>
    {children}
  </section>
)

function SegmentedFilter<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
  disabled
}: {
  label: string
  value: T
  options: readonly T[]
  labels: Record<T, string>
  onChange: (next: T) => void
  disabled?: boolean
}): React.ReactElement {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={value === option ? 'default' : 'outline'}
            disabled={disabled}
            onClick={() => onChange(option)}
            className="h-8 px-3"
          >
            {labels[option]}
          </Button>
        ))}
      </div>
    </div>
  )
}

const ActiveFilterTags: React.FC<{ tags: ActiveFilterTag[] }> = ({ tags }) => {
  if (tags.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">已选：</span>
      {tags.map((tag) => (
        <span
          key={tag.key}
          className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2.5 py-0.5 text-xs text-foreground"
        >
          {tag.label}
          <button
            type="button"
            onClick={tag.onRemove}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`清除${tag.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  )
}

function toManjuExportRows(
  items: ChangduSeriesDbItem[],
  awemeField: AwemeFilterField,
  awemeRules: AwemeFilterTagRule[],
  includeRating: boolean
): string[][] {
  return items.map((row) => {
    const baseRow = [
      row.series_name,
      row.book_id,
      formatPlayletId(row.playlet_id),
      row.category,
      row.create_time,
      row.estimate_publish_time,
      formatDt(row.updated_at),
      row.creation_status,
      row.episode_amount,
      row.gender,
      row.aweme_publish_nick_name,
      row.aweme_publish_douyin_id,
      formatAwemePublisher(row),
      row.delivery_status,
      row.publish_status,
      row.permission_status,
      row.publish_time
    ]
    if (!includeRating) return baseRow
    return [...baseRow, getAwemePublisherTags(row, awemeField, awemeRules).join('、')]
  })
}

export const ManjuListPage: React.FC = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [rows, setRows] = useState<ChangduSeriesDbItem[]>([])
  const [loading, setLoading] = useState(false)
  const [exportingAll, setExportingAll] = useState(false)
  const [error, setError] = useState('')

  const [inputBookId, setInputBookId] = useState('')
  const [inputSeriesName, setInputSeriesName] = useState('')
  const [inputCreateTimeStart, setInputCreateTimeStart] = useState(defaultCreateTimeStart)
  const [inputCreateTimeEnd, setInputCreateTimeEnd] = useState(defaultCreateTimeEnd)
  const [inputEstimatePublishTimeStart, setInputEstimatePublishTimeStart] = useState('')
  const [inputEstimatePublishTimeEnd, setInputEstimatePublishTimeEnd] = useState('')
  const [inputAwemePublishValue, setInputAwemePublishValue] = useState(() => {
    try {
      return localStorage.getItem(`${AWEME_FILTER_STORAGE_KEY}.value`) || ''
    } catch {
      return ''
    }
  })
  const [awemeFilterField, setAwemeFilterField] = useState<AwemeFilterField>(() => {
    try {
      return localStorage.getItem(`${AWEME_FILTER_STORAGE_KEY}.field`) === 'nick_name'
        ? 'nick_name'
        : 'douyin_id'
    } catch {
      return 'douyin_id'
    }
  })
  const [filterBookId, setFilterBookId] = useState('')
  const [filterSeriesName, setFilterSeriesName] = useState('')
  const [filterCreateTimeStart, setFilterCreateTimeStart] = useState(defaultCreateTimeStart)
  const [filterCreateTimeEnd, setFilterCreateTimeEnd] = useState(defaultCreateTimeEnd)
  const [filterEstimatePublishTimeStart, setFilterEstimatePublishTimeStart] = useState('')
  const [filterEstimatePublishTimeEnd, setFilterEstimatePublishTimeEnd] = useState('')
  const [publishStatusFilter, setPublishStatusFilter] = useState<PublishStatusFilter>('all')
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<DeliveryStatusFilter>('all')
  const [filterPublishStatus, setFilterPublishStatus] = useState<PublishStatusFilter>('all')
  const [filterDeliveryStatus, setFilterDeliveryStatus] = useState<DeliveryStatusFilter>('all')
  const [filterAwemePublishValue, setFilterAwemePublishValue] = useState(inputAwemePublishValue)
  const [filterAwemeField, setFilterAwemeField] = useState<AwemeFilterField>(awemeFilterField)
  const [advancedFilterExpanded, setAdvancedFilterExpanded] = useState(() => {
    try {
      if (localStorage.getItem(ADVANCED_FILTER_STORAGE_KEY) === '1') return true
    } catch {
      // ignore
    }
    try {
      return Boolean(localStorage.getItem(`${AWEME_FILTER_STORAGE_KEY}.value`)?.trim())
    } catch {
      return false
    }
  })

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pageInput, setPageInput] = useState('1')
  const [sortBy, setSortBy] = useState<'create_time' | 'estimate_publish_time' | 'updated_at'>(
    'create_time'
  )
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [collectOpen, setCollectOpen] = useState(false)
  const [collectSubmitting, setCollectSubmitting] = useState(false)
  const [collectConfigs, setCollectConfigs] = useState<ChangduConfigOption[]>([])
  const [loadingCollectConfigs, setLoadingCollectConfigs] = useState(false)
  const [selectedCollectConfigId, setSelectedCollectConfigId] = useState<number | null>(null)
  const [collectStartTime, setCollectStartTime] = useState(() => defaultCollectStartDate())
  const [collectEndTime, setCollectEndTime] = useState(() => todayText())
  const [collectPublishStatus, setCollectPublishStatus] = useState<'all' | '1'>('all')
  const [collectResult, setCollectResult] = useState<ChangduSeriesDatabaseHistorySyncResponse | null>(
    null
  )
  const selectedCollectConfig =
    collectConfigs.find((item) => item.id === selectedCollectConfigId) || null
  const collectEndMaxDate = parseDateText(collectStartTime)
    ? inclusiveEndFromStart(collectStartTime)
    : todayText()

  const handleCollectStartTimeChange = (value: string): void => {
    if (!parseDateText(value)) return
    const next = applyCollectStartChange(value)
    setCollectStartTime(next.start)
    setCollectEndTime(next.end)
  }

  const handleCollectEndTimeChange = (value: string): void => {
    if (!parseDateText(value)) return
    const next = applyCollectEndChange(collectStartTime, value)
    setCollectStartTime(next.start)
    setCollectEndTime(next.end)
  }

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const res = await changduService.getSeriesDbList({
        page,
        page_size: pageSize,
        book_id: filterBookId || undefined,
        series_name: filterSeriesName || undefined,
        aweme_publish_nick_name:
          filterAwemeField === 'nick_name' ? filterAwemePublishValue || undefined : undefined,
        aweme_publish_douyin_id:
          filterAwemeField === 'douyin_id' ? filterAwemePublishValue || undefined : undefined,
        publish_status: filterPublishStatus === 'all' ? undefined : filterPublishStatus,
        delivery_status: filterDeliveryStatus === 'all' ? undefined : filterDeliveryStatus,
        estimate_publish_time_start: filterEstimatePublishTimeStart || undefined,
        estimate_publish_time_end: filterEstimatePublishTimeEnd || undefined,
        create_time_start: filterCreateTimeStart || undefined,
        create_time_end: filterCreateTimeEnd || undefined,
        sort_by: sortBy,
        sort_order: sortOrder
      })
      setRows(res.items)
      setTotal(res.meta.total)
      setTotalPages(res.meta.total_pages)
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message || (err as { detail?: string })?.detail || '加载失败'
      setError(msg)
      setRows([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [
    page,
    pageSize,
    filterBookId,
    filterSeriesName,
    filterCreateTimeStart,
    filterCreateTimeEnd,
    filterEstimatePublishTimeStart,
    filterEstimatePublishTimeEnd,
    filterAwemePublishValue,
    filterAwemeField,
    filterPublishStatus,
    filterDeliveryStatus,
    sortBy,
    sortOrder
  ])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!collectOpen) return undefined
    let cancelled = false
    ;(async (): Promise<void> => {
      setLoadingCollectConfigs(true)
      try {
        const list = await configService.getConfigsBySource(3)
        if (cancelled) return
        setCollectConfigs(list)
        setSelectedCollectConfigId((prev) => {
          if (prev != null && list.some((item) => item.id === prev)) return prev
          return list[0]?.id ?? null
        })
      } catch (err) {
        console.error(err)
        if (!cancelled) toast.error('加载常读配置失败')
      } finally {
        if (!cancelled) setLoadingCollectConfigs(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [collectOpen])

  const openCollectDialog = (): void => {
    setCollectResult(null)
    setCollectOpen(true)
  }

  const submitHistoryCollect = async (): Promise<void> => {
    if (!selectedCollectConfigId) {
      toast.error('请选择常读账号配置')
      return
    }
    if (!collectStartTime || !collectEndTime) {
      toast.error('请选择采集时间区间')
      return
    }

    setCollectSubmitting(true)
    setCollectResult(null)
    try {
      const res = await changduService.syncSeriesListHistoryToDatabase({
        config_id: selectedCollectConfigId,
        start_time: collectStartTime,
        end_time: collectEndTime,
        publish_status: collectPublishStatus === '1' ? '1' : undefined
      })
      setCollectResult(res)
      toast.success('历史采集完成', { description: res.message })
      if (res.failed_months.length > 0) {
        toast.warning(`有 ${res.failed_months.length} 个月份采集失败`, {
          description: res.failed_months
            .slice(0, 2)
            .map((item) => `${item.month}: ${item.error}`)
            .join('；')
        })
      }
      await load()
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        (err as { detail?: string })?.detail ||
        '历史采集失败'
      toast.error(msg)
    } finally {
      setCollectSubmitting(false)
    }
  }

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  useEffect(() => {
    try {
      localStorage.setItem(`${AWEME_FILTER_STORAGE_KEY}.value`, inputAwemePublishValue)
      localStorage.setItem(`${AWEME_FILTER_STORAGE_KEY}.field`, awemeFilterField)
    } catch {
      // localStorage may be unavailable in restricted environments.
    }
  }, [inputAwemePublishValue, awemeFilterField])

  useEffect(() => {
    try {
      localStorage.setItem(ADVANCED_FILTER_STORAGE_KEY, advancedFilterExpanded ? '1' : '0')
    } catch {
      // ignore
    }
  }, [advancedFilterExpanded])

  const applyFilterPatch = useCallback((patch: {
    bookId?: string
    seriesName?: string
    createTimeStart?: string
    createTimeEnd?: string
    estimatePublishTimeStart?: string
    estimatePublishTimeEnd?: string
    awemePublishValue?: string
    awemeField?: AwemeFilterField
    publishStatus?: PublishStatusFilter
    deliveryStatus?: DeliveryStatusFilter
  }): void => {
    if (patch.bookId !== undefined) {
      setInputBookId(patch.bookId)
      setFilterBookId(patch.bookId)
    }
    if (patch.seriesName !== undefined) {
      setInputSeriesName(patch.seriesName)
      setFilterSeriesName(patch.seriesName)
    }
    if (patch.createTimeStart !== undefined) {
      setInputCreateTimeStart(patch.createTimeStart)
      setFilterCreateTimeStart(patch.createTimeStart)
    }
    if (patch.createTimeEnd !== undefined) {
      setInputCreateTimeEnd(patch.createTimeEnd)
      setFilterCreateTimeEnd(patch.createTimeEnd)
    }
    if (patch.estimatePublishTimeStart !== undefined) {
      setInputEstimatePublishTimeStart(patch.estimatePublishTimeStart)
      setFilterEstimatePublishTimeStart(patch.estimatePublishTimeStart)
    }
    if (patch.estimatePublishTimeEnd !== undefined) {
      setInputEstimatePublishTimeEnd(patch.estimatePublishTimeEnd)
      setFilterEstimatePublishTimeEnd(patch.estimatePublishTimeEnd)
    }
    if (patch.awemePublishValue !== undefined) {
      setInputAwemePublishValue(patch.awemePublishValue)
      setFilterAwemePublishValue(patch.awemePublishValue)
    }
    if (patch.awemeField !== undefined) {
      setAwemeFilterField(patch.awemeField)
      setFilterAwemeField(patch.awemeField)
    }
    if (patch.publishStatus !== undefined) {
      setPublishStatusFilter(patch.publishStatus)
      setFilterPublishStatus(patch.publishStatus)
    }
    if (patch.deliveryStatus !== undefined) {
      setDeliveryStatusFilter(patch.deliveryStatus)
      setFilterDeliveryStatus(patch.deliveryStatus)
    }
    setPage(1)
  }, [])

  const applySearch = (): void => {
    const normalizedBookId = normalizeMultilineFilterInput(inputBookId).trim()
    const normalizedSeriesName = normalizeMultilineFilterInput(inputSeriesName).trim()
    const normalizedAwemePublishValue = normalizeAwemeFilterInput(inputAwemePublishValue).trim()
    setInputBookId(normalizedBookId)
    setInputSeriesName(normalizedSeriesName)
    setInputAwemePublishValue(normalizedAwemePublishValue)
    setFilterBookId(normalizedBookId)
    setFilterSeriesName(normalizedSeriesName)
    setFilterCreateTimeStart(inputCreateTimeStart)
    setFilterCreateTimeEnd(inputCreateTimeEnd)
    setFilterEstimatePublishTimeStart(inputEstimatePublishTimeStart)
    setFilterEstimatePublishTimeEnd(inputEstimatePublishTimeEnd)
    setFilterAwemePublishValue(normalizedAwemePublishValue)
    setFilterAwemeField(awemeFilterField)
    setFilterPublishStatus(publishStatusFilter)
    setFilterDeliveryStatus(deliveryStatusFilter)
    setPage(1)
  }

  const resetFilters = (): void => {
    setInputBookId('')
    setInputSeriesName('')
    setInputCreateTimeStart(defaultCreateTimeStart())
    setInputCreateTimeEnd(defaultCreateTimeEnd())
    setInputEstimatePublishTimeStart('')
    setInputEstimatePublishTimeEnd('')
    setInputAwemePublishValue('')
    setAwemeFilterField('douyin_id')
    setPublishStatusFilter('all')
    setDeliveryStatusFilter('all')
    setFilterBookId('')
    setFilterSeriesName('')
    setFilterCreateTimeStart(defaultCreateTimeStart())
    setFilterCreateTimeEnd(defaultCreateTimeEnd())
    setFilterEstimatePublishTimeStart('')
    setFilterEstimatePublishTimeEnd('')
    setFilterAwemePublishValue('')
    setFilterAwemeField('douyin_id')
    setFilterPublishStatus('all')
    setFilterDeliveryStatus('all')
    setPage(1)
  }

  const handleSortHeaderClick = (
    field: 'create_time' | 'estimate_publish_time' | 'updated_at'
  ): void => {
    setPage(1)
    if (sortBy === field) {
      setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const canPrev = page > 1
  const canNext = totalPages > 0 && page < totalPages
  const awemeFilterTagRules = parseAwemeFilterTagRules(filterAwemePublishValue)
  const includeRatingInExport = filterAwemePublishValue.trim().length > 0
  const exportHeaders = includeRatingInExport ? [...MANJU_EXPORT_HEADERS, '评级'] : MANJU_EXPORT_HEADERS

  const changePageSize = (nextPageSize: number): void => {
    setPageSize(nextPageSize)
    setPage(1)
  }

  const jumpToPage = (): void => {
    const parsed = Number.parseInt(pageInput, 10)
    if (Number.isNaN(parsed)) {
      setPageInput(String(page))
      return
    }
    const maxPage = Math.max(1, totalPages)
    setPage(Math.min(Math.max(1, parsed), maxPage))
  }

  const handleMultilineFilterPaste = (
    event: React.ClipboardEvent<HTMLTextAreaElement>,
    setter: (value: string) => void
  ): void => {
    handleNormalizedTextareaPaste(event, normalizeMultilineFilterInput, setter)
  }

  const handleAwemeFilterPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    handleNormalizedTextareaPaste(event, normalizeAwemeFilterInput, setInputAwemePublishValue)
  }

  const activeFilterTags = useMemo((): ActiveFilterTag[] => {
    const tags: ActiveFilterTag[] = []
    const bookIdCount = countMultilineKeywords(filterBookId)
    if (bookIdCount > 0) {
      tags.push({
        key: 'book_id',
        label: bookIdCount > 1 ? `短剧ID ×${bookIdCount}` : `短剧ID: ${filterBookId.split('\n')[0]}`,
        onRemove: () => applyFilterPatch({ bookId: '' })
      })
    }
    const seriesNameCount = countMultilineKeywords(filterSeriesName)
    if (seriesNameCount > 0) {
      tags.push({
        key: 'series_name',
        label:
          seriesNameCount > 1
            ? `名称 ×${seriesNameCount}`
            : `名称: ${filterSeriesName.split('\n')[0]}`,
        onRemove: () => applyFilterPatch({ seriesName: '' })
      })
    }
    if (filterPublishStatus !== 'all') {
      tags.push({
        key: 'publish_status',
        label: `发布: ${filterPublishStatus}`,
        onRemove: () => applyFilterPatch({ publishStatus: 'all' })
      })
    }
    if (filterDeliveryStatus !== 'all') {
      tags.push({
        key: 'delivery_status',
        label: `投放: ${filterDeliveryStatus}`,
        onRemove: () => applyFilterPatch({ deliveryStatus: 'all' })
      })
    }
    if (
      (filterCreateTimeStart &&
        filterCreateTimeStart !== defaultCreateTimeStart()) ||
      (filterCreateTimeEnd && filterCreateTimeEnd !== defaultCreateTimeEnd())
    ) {
      tags.push({
        key: 'create_time',
        label: `创建 ${filterCreateTimeStart || '…'} ~ ${filterCreateTimeEnd || '…'}`,
        onRemove: () =>
          applyFilterPatch({
            createTimeStart: defaultCreateTimeStart(),
            createTimeEnd: defaultCreateTimeEnd()
          })
      })
    }
    if (filterEstimatePublishTimeStart || filterEstimatePublishTimeEnd) {
      tags.push({
        key: 'estimate_publish_time',
        label: `预估投放 ${filterEstimatePublishTimeStart || '…'} ~ ${filterEstimatePublishTimeEnd || '…'}`,
        onRemove: () =>
          applyFilterPatch({
            estimatePublishTimeStart: '',
            estimatePublishTimeEnd: ''
          })
      })
    }
    const awemeCount = countMultilineKeywords(filterAwemePublishValue)
    if (awemeCount > 0) {
      tags.push({
        key: 'aweme',
        label: `${AWEME_FILTER_LABELS[filterAwemeField]} ×${awemeCount}`,
        onRemove: () => applyFilterPatch({ awemePublishValue: '' })
      })
    }
    return tags
  }, [
    applyFilterPatch,
    filterAwemeField,
    filterAwemePublishValue,
    filterBookId,
    filterCreateTimeEnd,
    filterCreateTimeStart,
    filterDeliveryStatus,
    filterEstimatePublishTimeEnd,
    filterEstimatePublishTimeStart,
    filterPublishStatus,
    filterSeriesName
  ])

  const exportCurrentPage = async (): Promise<void> => {
    await downloadCsv(`漫剧列表_第${page}页_${formatExportTimestamp()}.csv`, [
      exportHeaders,
      ...toManjuExportRows(rows, filterAwemeField, awemeFilterTagRules, includeRatingInExport)
    ])
  }

  const exportAllRows = async (): Promise<void> => {
    setExportingAll(true)
    setError('')
    try {
      const exportPageSize = 500
      const firstPage = await changduService.getSeriesDbList({
        page: 1,
        page_size: exportPageSize,
        book_id: filterBookId || undefined,
        series_name: filterSeriesName || undefined,
        aweme_publish_nick_name:
          filterAwemeField === 'nick_name' ? filterAwemePublishValue || undefined : undefined,
        aweme_publish_douyin_id:
          filterAwemeField === 'douyin_id' ? filterAwemePublishValue || undefined : undefined,
        publish_status: filterPublishStatus === 'all' ? undefined : filterPublishStatus,
        delivery_status: filterDeliveryStatus === 'all' ? undefined : filterDeliveryStatus,
        estimate_publish_time_start: filterEstimatePublishTimeStart || undefined,
        estimate_publish_time_end: filterEstimatePublishTimeEnd || undefined,
        create_time_start: filterCreateTimeStart || undefined,
        create_time_end: filterCreateTimeEnd || undefined,
        sort_by: sortBy,
        sort_order: sortOrder
      })
      const allRows = [...firstPage.items]
      const pages = firstPage.meta.total_pages

      for (let nextPage = 2; nextPage <= pages; nextPage += 1) {
        const res = await changduService.getSeriesDbList({
          page: nextPage,
          page_size: exportPageSize,
          book_id: filterBookId || undefined,
          series_name: filterSeriesName || undefined,
          aweme_publish_nick_name:
            filterAwemeField === 'nick_name' ? filterAwemePublishValue || undefined : undefined,
          aweme_publish_douyin_id:
            filterAwemeField === 'douyin_id' ? filterAwemePublishValue || undefined : undefined,
          publish_status: filterPublishStatus === 'all' ? undefined : filterPublishStatus,
          delivery_status: filterDeliveryStatus === 'all' ? undefined : filterDeliveryStatus,
          estimate_publish_time_start: filterEstimatePublishTimeStart || undefined,
          estimate_publish_time_end: filterEstimatePublishTimeEnd || undefined,
          create_time_start: filterCreateTimeStart || undefined,
          create_time_end: filterCreateTimeEnd || undefined,
          sort_by: sortBy,
          sort_order: sortOrder
        })
        allRows.push(...res.items)
      }

      await downloadCsv(`漫剧列表_全部数据_${formatExportTimestamp()}.csv`, [
        exportHeaders,
        ...toManjuExportRows(allRows, filterAwemeField, awemeFilterTagRules, includeRatingInExport)
      ])
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message || (err as { detail?: string })?.detail || '导出全部数据失败'
      setError(msg)
    } finally {
      setExportingAll(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle className="flex gap-2 items-center text-xl">
                <Film className="w-5 h-5" />
                漫剧列表
              </CardTitle>
              <CardDescription>
                本地已同步短剧数据；点击表头「创建时间」「预估投放时间」「上次更新时间」可切换排序。
              </CardDescription>
            </div>
            {isAdmin && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={openCollectDialog}
                disabled={loading || collectSubmitting}
              >
                <Database className="mr-2 w-4 h-4" />
                历史采集
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-5 rounded-lg border border-border/70 bg-muted/10 p-4">
            <FilterSection title="内容检索">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mj-book-id">短剧 ID（book_id）</Label>
                  <Textarea
                    id="mj-book-id"
                    value={inputBookId}
                    onChange={(e) => setInputBookId(e.target.value)}
                    onPaste={(e) => handleMultilineFilterPaste(e, setInputBookId)}
                    placeholder={'每行一个'}
                    className="min-h-[120px] font-mono text-sm"
                    disabled={loading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) applySearch()
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mj-series-name">短剧名称</Label>
                  <Textarea
                    id="mj-series-name"
                    value={inputSeriesName}
                    onChange={(e) => setInputSeriesName(e.target.value)}
                    onPaste={(e) => handleMultilineFilterPaste(e, setInputSeriesName)}
                    placeholder={'每行一个'}
                    className="min-h-[120px] text-sm"
                    disabled={loading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) applySearch()
                    }}
                  />
                </div>
              </div>
            </FilterSection>

            <FilterSection title="状态与时间">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <SegmentedFilter
                    label="发布状态"
                    value={publishStatusFilter}
                    options={['all', '已发布', '未发布'] as const}
                    labels={PUBLISH_STATUS_LABELS}
                    onChange={setPublishStatusFilter}
                    disabled={loading}
                  />
                  <SegmentedFilter
                    label="投放状态"
                    value={deliveryStatusFilter}
                    options={['all', '可投放', '不可投放'] as const}
                    labels={DELIVERY_STATUS_LABELS}
                    onChange={setDeliveryStatusFilter}
                    disabled={loading}
                  />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <Label>创建时间</Label>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                      <Input
                        type="date"
                        value={inputCreateTimeStart}
                        max={inputCreateTimeEnd || todayText()}
                        onChange={(e) => setInputCreateTimeStart(e.target.value)}
                        disabled={loading}
                        className="min-w-0 w-full"
                      />
                      <span className="shrink-0 text-sm text-muted-foreground">至</span>
                      <Input
                        type="date"
                        value={inputCreateTimeEnd}
                        min={inputCreateTimeStart}
                        max={todayText()}
                        onChange={(e) => setInputCreateTimeEnd(e.target.value)}
                        disabled={loading}
                        className="min-w-0 w-full"
                      />
                    </div>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>预估投放时间</Label>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                      <Input
                        type="date"
                        value={inputEstimatePublishTimeStart}
                        onChange={(e) => setInputEstimatePublishTimeStart(e.target.value)}
                        disabled={loading}
                        className="min-w-0 w-full"
                      />
                      <span className="shrink-0 text-sm text-muted-foreground">至</span>
                      <Input
                        type="date"
                        value={inputEstimatePublishTimeEnd}
                        onChange={(e) => setInputEstimatePublishTimeEnd(e.target.value)}
                        disabled={loading}
                        className="min-w-0 w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </FilterSection>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setAdvancedFilterExpanded((open) => !open)}
                className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-sm font-medium text-foreground hover:bg-muted/60"
              >
                {advancedFilterExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="h-4 w-0.5 rounded-full bg-primary" aria-hidden />
                高级筛选
                {countMultilineKeywords(inputAwemePublishValue) > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
                    抖音号 ×{countMultilineKeywords(inputAwemePublishValue)}
                  </span>
                )}
              </button>

              {advancedFilterExpanded && (
                <div className="space-y-3 rounded-md border border-dashed border-border/70 bg-background/60 p-4">
                  <div className="space-y-2">
                    <Label>匹配字段</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {(['nick_name', 'douyin_id'] as AwemeFilterField[]).map((field) => (
                        <Button
                          key={field}
                          type="button"
                          size="sm"
                          variant={awemeFilterField === field ? 'default' : 'outline'}
                          disabled={loading}
                          onClick={() => setAwemeFilterField(field)}
                          className="h-8 px-3"
                        >
                          {AWEME_FILTER_LABELS[field]}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mj-aweme-publish-value">发布抖音号 / 评级规则</Label>
                    <Textarea
                      id="mj-aweme-publish-value"
                      value={inputAwemePublishValue}
                      onChange={(e) => setInputAwemePublishValue(e.target.value)}
                      onPaste={handleAwemeFilterPaste}
                      placeholder={`每行一组：${AWEME_FILTER_LABELS[awemeFilterField]},标签，例如 Chenke257248,SS级`}
                      className="min-h-[120px] font-mono text-sm"
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      格式为「关键字,标签」；搜索后表格与导出会附加评级列。
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/70 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={applySearch} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      加载中…
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 w-4 h-4" />
                      搜索
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={resetFilters} disabled={loading}>
                  重置
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CustomOceanBatchAppendButton
                  disabled={loading || exportingAll}
                  buttonLabel="批量添加到巨量商品库(自定义)"
                  onCompleted={() => void load()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={exportCurrentPage}
                  disabled={loading || exportingAll || rows.length === 0}
                >
                  <Download className="mr-2 w-4 h-4" />
                  导出本页
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={exportAllRows}
                  disabled={loading || exportingAll || total === 0}
                >
                  {exportingAll ? (
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 w-4 h-4" />
                  )}
                  {exportingAll ? '导出中…' : '导出全部'}
                </Button>
              </div>
            </div>
            <ActiveFilterTags tags={activeFilterTags} />
            {total > 0 && (
              <p className="text-sm text-muted-foreground">
                共 {total} 条，第 {page} / {Math.max(1, totalPages)} 页，每页 {pageSize} 条
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 text-sm rounded-md border text-destructive border-destructive/30 bg-destructive/5">
              {error}
            </div>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-3 font-medium text-left min-w-[220px]">剧名</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap w-[168px]">
                      <button
                        type="button"
                        onClick={() => handleSortHeaderClick('create_time')}
                        className={cn(
                          'inline-flex gap-1 items-center -mx-1 px-1 py-0.5 rounded-md font-medium',
                          'hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                        )}
                      >
                        创建时间
                        {sortBy === 'create_time' &&
                          (sortOrder === 'desc' ? (
                            <ArrowDown className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden />
                          ) : (
                            <ArrowUp className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden />
                          ))}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left whitespace-nowrap w-[168px]">
                      <button
                        type="button"
                        onClick={() => handleSortHeaderClick('estimate_publish_time')}
                        className={cn(
                          'inline-flex gap-1 items-center -mx-1 px-1 py-0.5 rounded-md font-medium',
                          'hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                        )}
                      >
                        预估投放时间
                        {sortBy === 'estimate_publish_time' &&
                          (sortOrder === 'desc' ? (
                            <ArrowDown className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden />
                          ) : (
                            <ArrowUp className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden />
                          ))}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left whitespace-nowrap w-[168px]">
                      <button
                        type="button"
                        onClick={() => handleSortHeaderClick('updated_at')}
                        className={cn(
                          'inline-flex gap-1 items-center -mx-1 px-1 py-0.5 rounded-md font-medium',
                          'hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                        )}
                      >
                        上次更新时间
                        {sortBy === 'updated_at' &&
                          (sortOrder === 'desc' ? (
                            <ArrowDown className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden />
                          ) : (
                            <ArrowUp className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden />
                          ))}
                      </button>
                    </th>
                    <th className="px-3 py-3 font-medium text-left whitespace-nowrap w-[88px]">
                      连载状态
                    </th>
                    <th className="px-3 py-3 font-medium text-left whitespace-nowrap w-[64px]">
                      集数
                    </th>
                    <th className="px-3 py-3 font-medium text-left whitespace-nowrap w-[88px]">
                      性别受众
                    </th>
                    <th className="px-3 py-3 font-medium text-left whitespace-nowrap min-w-[160px]">
                      发布抖音号
                    </th>
                    <th className="px-3 py-3 font-medium text-left whitespace-nowrap w-[100px]">
                      投放
                    </th>
                    <th className="px-3 py-3 font-medium text-left whitespace-nowrap w-[100px]">
                      发布
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const awemePublisherTags = getAwemePublisherTags(
                      row,
                      filterAwemeField,
                      awemeFilterTagRules
                    )
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-border/60 last:border-0 hover:bg-muted/20"
                      >
                      <td className="px-3 py-3 align-top">
                        <div className="font-medium">{row.series_name || '—'}</div>
                        <div className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground break-all">
                          剧ID：{row.book_id || '—'}
                        </div>
                        <div className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground break-all">
                          专辑ID：{formatPlayletId(row.playlet_id)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          分类：{row.category || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top tabular-nums text-muted-foreground whitespace-nowrap">
                        {row.create_time || '—'}
                      </td>
                      <td className="px-3 py-3 align-top tabular-nums text-muted-foreground whitespace-nowrap">
                        {row.estimate_publish_time || '—'}
                      </td>
                      <td className="px-3 py-3 align-top tabular-nums text-muted-foreground whitespace-nowrap">
                        {formatDt(row.updated_at)}
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
                      <td className="px-3 py-3 align-top whitespace-nowrap text-muted-foreground">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span>{formatAwemePublisher(row)}</span>
                          {awemePublisherTags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top whitespace-nowrap">
                        {row.delivery_status || '—'}
                      </td>
                      <td className="px-3 py-3 align-top whitespace-nowrap text-muted-foreground">
                        {row.publish_status || '—'}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && rows.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">暂无数据</p>
          )}

          {total > 0 && (
            <div className="flex flex-wrap gap-3 items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-3">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-muted-foreground">每页显示</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm" disabled={loading}>
                      {pageSize} 条
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <DropdownMenuItem key={option} onClick={() => changePageSize(option)}>
                        {option} 条
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canPrev || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一页
                </Button>
                <div className="flex gap-2 items-center text-sm text-muted-foreground">
                  <span>跳至</span>
                  <Input
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && jumpToPage()}
                    className="h-8 w-16 text-center"
                    inputMode="numeric"
                    disabled={loading}
                  />
                  <span>/ {Math.max(1, totalPages)} 页</span>
                  <Button type="button" variant="outline" size="sm" onClick={jumpToPage} disabled={loading}>
                    确定
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canNext || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
      <Dialog
        open={collectOpen}
        onOpenChange={(open) => {
          if (open) setCollectOpen(true)
        }}
      >
        <DialogContent
          className="sm:max-w-lg max-h-[86vh] overflow-y-auto [&>button.absolute]:hidden"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>历史采集</DialogTitle>
            <DialogDescription>
              按创建时间区间抓取常读漫剧列表并写入本地库（含首尾最多 30 天，需补全历史请多次执行）。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>常读账号配置 *</Label>
              {loadingCollectConfigs ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在加载配置…
                </div>
              ) : collectConfigs.length > 0 ? (
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedCollectConfigId ?? ''}
                  onChange={(event) =>
                    setSelectedCollectConfigId(Number(event.target.value) || null)
                  }
                  disabled={collectSubmitting}
                >
                  {collectConfigs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {formatCollectConfigOption(config)}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-muted-foreground">暂无常读配置，请先在配置中心添加。</p>
              )}
              {selectedCollectConfig && (
                <p className="text-xs text-muted-foreground">
                  当前选择：{selectedCollectConfig.cookie_name}
                  {selectedCollectConfig.realname
                    ? `（${selectedCollectConfig.realname}）`
                    : ''}
                  （配置 ID：{selectedCollectConfig.id}）
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>创建时间 *</Label>
              <div className="flex items-center w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <input
                  type="date"
                  className="flex-1 min-w-0 bg-transparent border-0 p-0 text-sm focus:outline-none focus:ring-0"
                  value={collectStartTime}
                  max={todayText()}
                  onChange={(event) => handleCollectStartTimeChange(event.target.value)}
                  disabled={collectSubmitting}
                />
                <span className="px-2 text-muted-foreground">-</span>
                <input
                  type="date"
                  className="flex-1 min-w-0 bg-transparent border-0 p-0 text-sm focus:outline-none focus:ring-0"
                  value={collectEndTime}
                  min={collectStartTime}
                  max={collectEndMaxDate}
                  onChange={(event) => handleCollectEndTimeChange(event.target.value)}
                  disabled={collectSubmitting}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                含首尾最多 {COLLECT_DATE_RANGE_MAX_DAYS} 天；选择开始日期后结束日期自动对齐（不超过今天）。
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mj-collect-publish-status">发布状态</Label>
              <select
                id="mj-collect-publish-status"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={collectPublishStatus}
                onChange={(event) =>
                  setCollectPublishStatus(event.target.value as 'all' | '1')
                }
                disabled={collectSubmitting}
              >
                <option value="all">全部</option>
                <option value="1">已发布</option>
              </select>
            </div>

            {collectSubmitting && (
              <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在采集 {collectStartTime} ~ {collectEndTime}，请勿关闭窗口…
                </div>
              </div>
            )}

            {collectResult && (
              <div className="rounded-md border bg-muted/20 px-3 py-3 text-sm space-y-2">
                <div className="font-medium">{collectResult.message}</div>
                <div className="text-xs text-muted-foreground">
                  {collectResult.start_time} ~ {collectResult.end_time} · 新增{' '}
                  {collectResult.inserted_count} · 更新 {collectResult.updated_count} · 未变{' '}
                  {collectResult.unchanged_count}
                </div>
                {collectResult.month_summaries.length > 0 && (
                  <div className="max-h-40 space-y-1 overflow-y-auto text-xs">
                    {collectResult.month_summaries.map((item) => (
                      <div key={item.month} className="flex justify-between gap-3">
                        <span>{item.month}</span>
                        <span className="text-muted-foreground">
                          +{item.inserted} / ~{item.updated} / ={item.unchanged}（
                          {item.pages_fetched} 页）
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCollectOpen(false)}
              disabled={collectSubmitting}
            >
              关闭
            </Button>
            <Button
              type="button"
              onClick={() => void submitHistoryCollect()}
              disabled={
                collectSubmitting ||
                loadingCollectConfigs ||
                !selectedCollectConfigId ||
                collectConfigs.length === 0
              }
            >
              {collectSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              开始采集
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </div>
  )
}
