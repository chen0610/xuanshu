import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Loader2,
  PackageSearch,
  Search,
  Send,
  Upload,
  X
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Label,
  Input,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea
} from '../../components/ui'
import { configService } from '../../services/config.service'
import {
  changduService,
  type ChangduChannelRow,
  type ChangduMaterialRow
} from '../../services/changdu.service'
import { toast } from 'sonner'
import {
  useVideoDownloadPanel,
  VideoDownloadPanel
} from '../OceanEngine/components/VideoDownloadPanel'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

interface ChoiceCardProps {
  checked: boolean
  title: string
  subtitle?: string
  meta?: string
  onSelect: () => void
}

const PAGE_SIZE_OPTIONS = [50, 100, 300, 500] as const
const DEFAULT_PAGE_SIZE = 100
const DOWNLOAD_LINK_BATCH_SIZE = 50
const DOWNLOAD_CONCURRENCY = 3
const STORAGE_KEYS = {
  configId: 'changdu-material-manage:selected-config-id',
  channelKey: 'changdu-material-manage:selected-channel-key',
  downloadDir: 'changdu-material-manage:download-dir'
}

const CHANNEL_TYPE_OPTIONS = [
  { value: 1, label: '巨量引擎' },
  { value: 2, label: '腾讯广告' },
  { value: 3, label: '百度营销' }
] as const

const AUDIT_STATUS_OPTIONS = [
  { value: 1, label: '未审核' },
  { value: 2, label: '审核中' },
  { value: 3, label: '审核通过' },
  { value: 4, label: '审核不通过' },
  { value: 5, label: '送审中' }
] as const

const PUSH_STATUS_OPTIONS = [
  { value: 1, label: '未推送' },
  { value: 2, label: '推送中' },
  { value: 3, label: '推送成功' },
  { value: 4, label: '推送失败' }
] as const

const MATERIAL_SUBMIT_PLATFORM_OPTIONS = [
  { value: 1, label: '巨量引擎' },
  { value: 2, label: '腾讯广告' }
] as const

type MaterialSubmitPlatform = (typeof MATERIAL_SUBMIT_PLATFORM_OPTIONS)[number]['value']

const ChoiceCard: React.FC<ChoiceCardProps> = ({ checked, title, subtitle, meta, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className={[
      'group relative rounded-lg border px-3 py-2.5 text-left transition-all',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      'hover:border-primary/40 hover:shadow-sm',
      checked
        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
        : 'border-border bg-card hover:bg-accent/20'
    ].join(' ')}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="truncate text-sm font-semibold text-foreground">{title}</div>
        {subtitle ? <div className="truncate text-xs text-muted-foreground">{subtitle}</div> : null}
        {meta ? <div className="truncate text-[11px] text-muted-foreground">{meta}</div> : null}
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

const selectedChannelKey = (channel: ChangduChannelRow): string =>
  `${channel.app_type}:${channel.app_id}:${channel.channel}:${channel.distributor_id}`

const getAppTypeLabel = (appType: string): string => {
  if (appType === '21') return '付费漫剧'
  if (appType === '22') return '免费漫剧'
  return `app_type=${appType || '—'}`
}

const formatDateText = (date: Date): string => {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const toStartTimestamp = (dateText: string): number | undefined => {
  if (!dateText) return undefined
  const date = new Date(`${dateText}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : Math.floor(date.getTime() / 1000)
}

const toEndTimestamp = (dateText: string): number | undefined => {
  if (!dateText) return undefined
  const date = new Date(`${dateText}T23:59:59`)
  return Number.isNaN(date.getTime()) ? undefined : Math.floor(date.getTime() / 1000)
}

const toTimestamp = (dateText: string, timeText: string): number | undefined => {
  if (!dateText) return undefined
  const normalizedTime = timeText || '00:00:00'
  const date = new Date(`${dateText}T${normalizedTime}`)
  return Number.isNaN(date.getTime()) ? undefined : Math.floor(date.getTime() / 1000)
}

const getChannelTypeLabel = (value: number): string =>
  CHANNEL_TYPE_OPTIONS.find((item) => item.value === value)?.label || `渠道 ${value}`

const getPreviewUrl = (row: ChangduMaterialRow): string =>
  row.media_info_list?.[0]?.preview_url || ''

const getDeliveryAppText = (row: ChangduMaterialRow): string =>
  (row.delivery_app_info_list || [])
    .map((item) => item.app_name || item.app_id)
    .filter(Boolean)
    .join('、') || '—'

const getMaterialTaskTitle = (row: ChangduMaterialRow): string =>
  row.material_name || row.media_info_list?.[0]?.filename || row.material_id || 'changdu-material'

const loadStoredDownloadDir = (): string => {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.downloadDir)?.trim() || ''
  } catch {
    return ''
  }
}

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const buildDownloadTasks = (
  links: Array<{ material_id: string; play_url: string; filename: string }>,
  selectedMap: Map<string, ChangduMaterialRow>
): Array<{
  id: string
  materialId: string
  videoId: string
  title?: string
  filename?: string
  url: string
}> =>
  links
    .filter((item) => item.material_id && item.play_url)
    .map((item) => {
      const row = selectedMap.get(item.material_id)
      return {
        id: `changdu:${item.material_id}`,
        materialId: item.material_id,
        videoId: row?.media_info_list?.[0]?.vid || item.material_id,
        title: row ? getMaterialTaskTitle(row) : item.filename,
        filename: item.filename,
        url: item.play_url
      }
    })

const getAuditStatusLabel = (status?: number): string => {
  if (status === 1) return '未审核'
  if (status === 2) return '审核中'
  if (status === 3) return '审核通过'
  if (status === 4) return '审核不通过'
  if (status === 5) return '送审中'
  return status == null ? '—' : `状态 ${status}`
}

const getPushStatusLabel = (status?: number): string => {
  if (status === 1) return '未推送'
  if (status === 2) return '推送中'
  if (status === 3) return '推送成功'
  if (status === 4) return '推送失败'
  return status == null ? '—' : `状态 ${status}`
}

const getStatusClassName = (status?: number): string => {
  if (status === 3) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 4) return 'border-rose-200 bg-rose-50 text-rose-700'
  if (status === 2) return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

const renderChannelStatusList = (
  row: ChangduMaterialRow,
  getLabel: (status?: number) => string,
  statusKey: 'audit_status' | 'push_status'
): React.ReactNode => {
  const list = row.channel_info_list || []
  if (list.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex flex-col gap-1.5">
      {list.map((item, index) => {
        const status = item[statusKey]
        return (
          <div
            key={`${item.channel_id || index}-${statusKey}`}
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="text-xs text-muted-foreground">
              {getChannelTypeLabel(Number(item.channel_type))}
            </span>
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStatusClassName(status)}`}
            >
              {getLabel(status)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const MaterialTableRow = React.memo(
  ({
    row,
    isSelected,
    onToggle
  }: {
    row: ChangduMaterialRow
    isSelected: boolean
    onToggle: (row: ChangduMaterialRow) => void
  }) => {
    const previewUrl = getPreviewUrl(row)
    return (
      <tr
        key={row.material_id || `${row.material_name}-${row.create_time}`}
        className="border-b border-border/60 last:border-0 hover:bg-muted/20"
      >
        <td className="px-3 py-3 align-top">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggle(row)}
            aria-label={`选择素材 ${row.material_name || row.material_id}`}
          />
        </td>
        <td className="px-3 py-3 align-top">
          <div className="flex min-w-0 items-start gap-3">
            <div className="h-24 w-[54px] flex-shrink-0 overflow-hidden rounded-md border bg-muted">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={row.material_name || '素材预览'}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  无预览
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="font-medium break-all">{row.material_name || '—'}</div>
              <div className="mt-1 font-mono text-xs tabular-nums text-muted-foreground break-all">
                {row.material_id || '—'}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                格式：{row.media_info_list?.[0]?.format || '—'}；VID：
                {row.media_info_list?.[0]?.vid || '—'}
              </div>
            </div>
          </div>
        </td>
        <td className="px-3 py-3 align-top">
          <div className="flex flex-wrap gap-1.5">
            {(row.channel_type_list || []).length > 0 ? (
              row.channel_type_list.map((type) => (
                <span
                  key={type}
                  className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700"
                >
                  {getChannelTypeLabel(type)}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </td>
        <td className="px-3 py-3 align-top text-muted-foreground">{getDeliveryAppText(row)}</td>
        <td className="px-3 py-3 align-top">
          {renderChannelStatusList(row, getAuditStatusLabel, 'audit_status')}
        </td>
        <td className="px-3 py-3 align-top">
          {renderChannelStatusList(row, getPushStatusLabel, 'push_status')}
        </td>
        <td className="px-3 py-3 align-top">
          <div>{row.creator_nick_name || '—'}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {row.creator_email || row.creator || '—'}
          </div>
        </td>
        <td className="whitespace-nowrap px-3 py-3 align-top tabular-nums text-muted-foreground">
          {row.create_time || '—'}
        </td>
      </tr>
    )
  }
)

MaterialTableRow.displayName = 'MaterialTableRow'

export const MaterialManagePage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(false)
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [channels, setChannels] = useState<ChangduChannelRow[]>([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [selectedChannelValue, setSelectedChannelValue] = useState('')
  const [rows, setRows] = useState<ChangduMaterialRow[]>([])
  const [total, setTotal] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [channelTypes, setChannelTypes] = useState<number[]>([])
  const [auditStatuses, setAuditStatuses] = useState<number[]>([])
  const [pushStatuses, setPushStatuses] = useState<number[]>([])
  const [materialName, setMaterialName] = useState('')
  const [fetching, setFetching] = useState(false)
  const [hasQueried, setHasQueried] = useState(false)
  const [error, setError] = useState('')
  const selectedRowsMapRef = useRef<Map<string, ChangduMaterialRow>>(new Map())
  const [selectedCount, setSelectedCount] = useState(0)
  const [selectedSelectionVersion, setSelectedSelectionVersion] = useState(0)
  const [downloadDir, setDownloadDir] = useState(loadStoredDownloadDir)
  const [pickingDownloadDir, setPickingDownloadDir] = useState(false)
  const [startingDownload, setStartingDownload] = useState(false)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [submitStartDate, setSubmitStartDate] = useState('')
  const [submitEndDate, setSubmitEndDate] = useState('')
  const [submitStartTime, setSubmitStartTime] = useState('00:00:00')
  const [submitEndTime, setSubmitEndTime] = useState('23:59:59')
  const [submitPlatforms, setSubmitPlatforms] = useState<MaterialSubmitPlatform[]>([1, 2])
  const [submittingMaterials, setSubmittingMaterials] = useState(false)
  const [pushDialogOpen, setPushDialogOpen] = useState(false)
  const [pushMaterialName, setPushMaterialName] = useState('')
  const [pushStartDate, setPushStartDate] = useState('')
  const [pushEndDate, setPushEndDate] = useState('')
  const [pushStartTime, setPushStartTime] = useState('00:00:00')
  const [pushEndTime, setPushEndTime] = useState('23:59:59')
  const [pushPlatform, setPushPlatform] = useState<MaterialSubmitPlatform>(1)
  const [pushAdvertisingAccountText, setPushAdvertisingAccountText] = useState('')
  const [pushPreviewTotal, setPushPreviewTotal] = useState<number | null>(null)
  const [previewingPushCount, setPreviewingPushCount] = useState(false)
  const [pushingMaterials, setPushingMaterials] = useState(false)
  const lastDownloadTasksRef = useRef<
    Array<{
      id: string
      materialId: string
      videoId: string
      title?: string
      filename?: string
      url: string
    }>
  >([])
  const {
    batch: downloadBatch,
    visible: downloadPanelVisible,
    minimized: downloadPanelMinimized,
    setVisible: setDownloadPanelVisible,
    setMinimized: setDownloadPanelMinimized,
    refreshState: refreshDownloadState
  } = useVideoDownloadPanel()

  useEffect(() => {
    let cancelled = false
    ;(async (): Promise<void> => {
      setLoadingConfigs(true)
      try {
        const list = await configService.getConfigsBySource(3)
        if (cancelled) return
        setConfigs(list)
        const rememberedConfigId = Number(window.localStorage.getItem(STORAGE_KEYS.configId) || '')
        setSelectedConfigId((prev) => {
          if (prev != null && list.some((item) => item.id === prev)) return prev
          if (
            Number.isFinite(rememberedConfigId) &&
            list.some((item) => item.id === rememberedConfigId)
          ) {
            return rememberedConfigId
          }
          return list[0]?.id ?? null
        })
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
      setSelectedChannelValue('')
      return undefined
    }
    ;(async (): Promise<void> => {
      setLoadingChannels(true)
      try {
        const res = await changduService.getChannels(selectedConfigId)
        if (cancelled) return
        setChannels(res.items)
        const rememberedChannelKey = window.localStorage.getItem(STORAGE_KEYS.channelKey)
        setSelectedChannelValue((prev) => {
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
          setSelectedChannelValue('')
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
    if (selectedConfigId != null)
      window.localStorage.setItem(STORAGE_KEYS.configId, String(selectedConfigId))
  }, [selectedConfigId])

  useEffect(() => {
    if (selectedChannelValue)
      window.localStorage.setItem(STORAGE_KEYS.channelKey, selectedChannelValue)
  }, [selectedChannelValue])

  const selectedConfig = configs.find((item) => item.id === selectedConfigId) || null
  const selectedChannel = channels.find((item) => selectedChannelKey(item) === selectedChannelValue)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const canPrev = pageIndex > 0
  const canNext = pageIndex + 1 < totalPages
  const today = useMemo(() => formatDateText(new Date()), [])
  const currentPageSelectableIds = useMemo(
    () => rows.map((row) => row.material_id).filter(Boolean),
    [rows]
  )
  const selectedMaterialIdSet = useMemo(
    () => new Set(selectedRowsMapRef.current.keys()),
    [selectedSelectionVersion]
  )
  const currentPageSelectedCount = useMemo(
    () => currentPageSelectableIds.filter((id) => selectedMaterialIdSet.has(id)).length,
    [currentPageSelectableIds, selectedMaterialIdSet]
  )
  const isCurrentPageAllSelected =
    currentPageSelectableIds.length > 0 &&
    currentPageSelectedCount === currentPageSelectableIds.length
  const downloadTaskSummary = useMemo(() => {
    if (!downloadBatch) return null
    const active = downloadBatch.tasks.filter(
      (task) => task.status === 'pending' || task.status === 'downloading'
    ).length
    const completed = downloadBatch.tasks.filter((task) => task.status === 'completed').length
    return { active, completed, total: downloadBatch.tasks.length, status: downloadBatch.status }
  }, [downloadBatch])
  const downloadPanelHidden = Boolean(
    downloadBatch && (!downloadPanelVisible || downloadPanelMinimized)
  )

  const resetList = (): void => {
    setRows([])
    setTotal(0)
    setPageIndex(0)
    setHasQueried(false)
    selectedRowsMapRef.current = new Map()
    setSelectedCount(0)
    setSelectedSelectionVersion((prev) => prev + 1)
    setError('')
  }

  const loadList = async (page: number): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个常读账号配置')
      return
    }
    if (!selectedChannelValue) {
      setError('请先选择常读渠道')
      return
    }
    const startTime = toStartTimestamp(startDate)
    const endTime = toEndTimestamp(endDate)
    if (startTime && endTime && startTime > endTime) {
      setError('开始时间不能晚于结束时间')
      return
    }
    setFetching(true)
    setError('')
    try {
      const res = await changduService.getMaterialManageList({
        config_id: selectedConfigId,
        page_index: page,
        page_size: pageSize,
        start_time: startTime,
        end_time: endTime,
        channel_type_list: channelTypes.length > 0 ? channelTypes.join(',') : undefined,
        audit_status_list: auditStatuses.length > 0 ? auditStatuses.join(',') : undefined,
        push_status_list: pushStatuses.length > 0 ? pushStatuses.join(',') : undefined,
        material_name: materialName.trim() || undefined
      })
      setRows(res.items)
      setTotal(res.total)
      setPageIndex(page)
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        (err as { detail?: string })?.detail ||
        '获取素材管理列表失败'
      setError(msg)
      setRows([])
      setTotal(0)
    } finally {
      setHasQueried(true)
      setFetching(false)
    }
  }

  const toggleRowSelection = useCallback((row: ChangduMaterialRow): void => {
    if (!row.material_id) return
    const selectedRowsMap = selectedRowsMapRef.current
    if (selectedRowsMap.has(row.material_id)) {
      selectedRowsMap.delete(row.material_id)
    } else {
      selectedRowsMap.set(row.material_id, row)
    }
    setSelectedCount(selectedRowsMap.size)
    setSelectedSelectionVersion((prev) => prev + 1)
  }, [])

  const toggleCurrentPageSelection = (): void => {
    const selectedRowsMap = selectedRowsMapRef.current
    if (isCurrentPageAllSelected) {
      currentPageSelectableIds.forEach((id) => selectedRowsMap.delete(id))
    } else {
      rows.forEach((row) => {
        if (row.material_id) selectedRowsMap.set(row.material_id, row)
      })
    }
    setSelectedCount(selectedRowsMap.size)
    setSelectedSelectionVersion((prev) => prev + 1)
  }

  const pickDownloadDir = async (): Promise<string | null> => {
    if (!window.api?.selectFolder) {
      toast.error('当前环境不支持选择下载目录')
      return null
    }
    setPickingDownloadDir(true)
    try {
      const result = await window.api.selectFolder()
      if (result.canceled || !result.folderPath) return null
      setDownloadDir(result.folderPath)
      window.localStorage.setItem(STORAGE_KEYS.downloadDir, result.folderPath)
      toast.success('下载目录已设置')
      return result.folderPath
    } finally {
      setPickingDownloadDir(false)
    }
  }

  const ensureDownloadDir = async (): Promise<string | null> => {
    const current = downloadDir.trim()
    if (current) return current
    toast.message('请先选择素材保存目录')
    return pickDownloadDir()
  }

  const startOrAppendDownloadTasks = async (
    tasks: Array<{
      id: string
      materialId: string
      videoId: string
      title?: string
      filename?: string
      url: string
    }>,
    saveDir: string,
    isFirstBatch: boolean
  ): Promise<boolean> => {
    if (isFirstBatch) {
      const result = await window.api.videoDownload.start({
        saveDir,
        tasks,
        concurrency: DOWNLOAD_CONCURRENCY
      })
      if (!result.ok) {
        toast.error('error' in result ? result.error : '启动下载失败')
        return false
      }
      setDownloadPanelVisible(true)
      setDownloadPanelMinimized(false)
      return true
    }

    const appendDownload = window.api.videoDownload.append
    if (typeof appendDownload !== 'function') {
      toast.error('下载追加能力未加载，请重启应用后再使用多批次下载')
      return false
    }
    const result = await appendDownload({ tasks })
    if (!result.ok) {
      toast.error(result.error || '追加下载任务失败')
      return false
    }
    return true
  }

  const handleBatchDownload = async (): Promise<void> => {
    if (!selectedConfigId) {
      toast.error('请先选择常读账号配置')
      return
    }
    if (selectedCount === 0) {
      toast.error('请先选择要下载的素材')
      return
    }
    if (!window.api?.videoDownload) {
      toast.error('当前环境不支持批量下载')
      return
    }
    const saveDir = await ensureDownloadDir()
    if (!saveDir) return

    const selectedRowsMap = selectedRowsMapRef.current
    const selectedMaterialIds = Array.from(selectedRowsMap.keys())
    const batches = chunkArray(selectedMaterialIds, DOWNLOAD_LINK_BATCH_SIZE)
    setStartingDownload(true)
    lastDownloadTasksRef.current = []
    let started = false
    let queuedCount = 0
    let failedCount = 0
    try {
      for (const batchIds of batches) {
        const response = await changduService.getMaterialDownloadLinks({
          config_id: selectedConfigId,
          material_ids: batchIds
        })
        failedCount += response.failed?.length || 0
        const tasks = buildDownloadTasks(response.items || [], selectedRowsMap)
        if (tasks.length === 0) continue
        const ok = await startOrAppendDownloadTasks(tasks, saveDir, !started)
        if (!ok) return
        started = true
        queuedCount += tasks.length
        lastDownloadTasksRef.current = [...lastDownloadTasksRef.current, ...tasks]
        await refreshDownloadState()
      }

      if (!started) {
        toast.error('未能获取到可下载的素材链接')
        return
      }
      toast.success(
        `已开始下载 ${queuedCount} 个素材${failedCount ? `，${failedCount} 个链接获取失败` : ''}`
      )
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
          ?.detail ||
        (err as { message?: string })?.message ||
        '批量下载失败'
      toast.error(msg)
    } finally {
      setStartingDownload(false)
    }
  }

  const handleRetryFailedDownloads = async (): Promise<void> => {
    if (!selectedConfigId || !window.api?.videoDownload) return
    const failedIds = new Set(
      (downloadBatch?.tasks || []).filter((task) => task.status === 'failed').map((task) => task.id)
    )
    const failedMaterialIds = lastDownloadTasksRef.current
      .filter((task) => failedIds.has(task.id))
      .map((task) => task.materialId)
    if (failedMaterialIds.length === 0) return

    try {
      const response = await changduService.getMaterialDownloadLinks({
        config_id: selectedConfigId,
        material_ids: failedMaterialIds
      })
      const refreshedMap = new Map((response.items || []).map((item) => [item.material_id, item]))
      const tasks = lastDownloadTasksRef.current
        .filter((task) => failedMaterialIds.includes(task.materialId))
        .map((task) => {
          const refreshed = refreshedMap.get(task.materialId)
          return refreshed?.play_url
            ? { ...task, url: refreshed.play_url, filename: refreshed.filename || task.filename }
            : null
        })
        .filter(Boolean) as Array<{
        id: string
        materialId: string
        videoId: string
        title?: string
        filename?: string
        url: string
      }>
      if (tasks.length === 0) {
        toast.error('未能刷新失败项的下载链接')
        return
      }
      const result = await window.api.videoDownload.retryFailed({ tasks })
      if (!result.ok) {
        toast.error(result.error || '重试失败')
        return
      }
      lastDownloadTasksRef.current = lastDownloadTasksRef.current.map(
        (task) => tasks.find((item) => item.id === task.id) || task
      )
      toast.success(`已重新排队 ${tasks.length} 个失败任务`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
          ?.detail ||
        (err as { message?: string })?.message ||
        '重试失败'
      toast.error(msg)
    }
  }

  const handleClearCompletedDownloads = async (): Promise<void> => {
    const result = await window.api?.videoDownload?.clearCompleted?.()
    if (!result) {
      toast.error('当前环境不支持清空已完成记录')
      return
    }
    if (!result.ok) {
      toast.error(result.error || '清空失败')
      return
    }
    const removed = result.removed || 0
    const activeIds = new Set(
      (downloadBatch?.tasks || [])
        .filter((task) => task.status !== 'completed')
        .map((task) => task.id)
    )
    lastDownloadTasksRef.current = lastDownloadTasksRef.current.filter((task) =>
      activeIds.has(task.id)
    )
    await refreshDownloadState()
    toast.success(`已清空 ${removed} 条已完成记录`)
  }

  const toggleSubmitPlatform = (value: MaterialSubmitPlatform): void => {
    setSubmitPlatforms((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    )
  }

  const handleOpenSubmitDialog = (): void => {
    setSubmitStartDate(startDate || today)
    setSubmitEndDate(endDate || today)
    setSubmitStartTime('00:00:00')
    setSubmitEndTime('23:59:59')
    setSubmitPlatforms((prev) => (prev.length > 0 ? prev : [1, 2]))
    setSubmitDialogOpen(true)
  }

  const handleSubmitMaterials = async (): Promise<void> => {
    if (!selectedConfigId) {
      toast.error('请先选择常读账号配置')
      return
    }
    const startTime = toTimestamp(submitStartDate, submitStartTime)
    const endTime = toTimestamp(submitEndDate, submitEndTime)
    if (!startTime || !endTime) {
      toast.error('请选择创建时间范围')
      return
    }
    if (startTime > endTime) {
      toast.error('开始时间不能晚于结束时间')
      return
    }
    if (submitPlatforms.length === 0) {
      toast.error('请选择至少一个媒体渠道')
      return
    }

    setSubmittingMaterials(true)
    try {
      const response = await changduService.submitMaterialManageBatch({
        config_id: selectedConfigId,
        start_time: startTime,
        end_time: endTime,
        platforms: submitPlatforms
      })
      toast.success(`批量送审完成，成功 ${response.success_material_id_list.length} 个素材`)
      setSubmitDialogOpen(false)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
          ?.detail ||
        (err as { message?: string })?.message ||
        '批量送审失败'
      toast.error(msg)
    } finally {
      setSubmittingMaterials(false)
    }
  }

  const handleOpenPushDialog = (): void => {
    setPushStartDate(startDate || today)
    setPushEndDate(endDate || today)
    setPushStartTime('00:00:00')
    setPushEndTime('23:59:59')
    setPushMaterialName(materialName.trim())
    setPushAdvertisingAccountText((prev) => prev.trim() || selectedChannel?.channel?.trim() || '')
    setPushPreviewTotal(null)
    setPushDialogOpen(true)
  }

  const handlePreviewPushCount = async (): Promise<void> => {
    if (!selectedConfigId) {
      toast.error('请先选择常读账号配置')
      return
    }
    const startTime = toTimestamp(pushStartDate, pushStartTime)
    const endTime = toTimestamp(pushEndDate, pushEndTime)
    if (!startTime || !endTime) {
      toast.error('请选择创建时间范围')
      return
    }
    if (startTime > endTime) {
      toast.error('开始时间不能晚于结束时间')
      return
    }

    setPreviewingPushCount(true)
    try {
      const response = await changduService.previewMaterialPushCount({
        config_id: selectedConfigId,
        start_time: startTime,
        end_time: endTime,
        platform: pushPlatform,
        material_name: pushMaterialName.trim() || undefined
      })
      setPushPreviewTotal(response.total)
      toast.success(`当前筛选条件下共有 ${response.total} 个可推送素材`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
          ?.detail ||
        (err as { message?: string })?.message ||
        '获取推送素材数量失败'
      toast.error(msg)
    } finally {
      setPreviewingPushCount(false)
    }
  }

  const handlePushMaterials = async (): Promise<void> => {
    if (!selectedConfigId) {
      toast.error('请先选择常读账号配置')
      return
    }
    const startTime = toTimestamp(pushStartDate, pushStartTime)
    const endTime = toTimestamp(pushEndDate, pushEndTime)
    if (!startTime || !endTime) {
      toast.error('请选择创建时间范围')
      return
    }
    if (startTime > endTime) {
      toast.error('开始时间不能晚于结束时间')
      return
    }
    const advertisingAccounts = pushAdvertisingAccountText
      .split(/[\s,，]+/)
      .map((item) => item.trim())
      .filter(Boolean)
    if (advertisingAccounts.length === 0) {
      toast.error('请填写至少一个账户 ID')
      return
    }

    setPushingMaterials(true)
    try {
      const response = await changduService.pushMaterialManageBatch({
        config_id: selectedConfigId,
        start_time: startTime,
        end_time: endTime,
        platform: pushPlatform,
        advertising_account: advertisingAccounts,
        audit_status_list: [3],
        material_name: pushMaterialName.trim() || undefined
      })
      const failedCount = response.auth_failed_account_ids.length
      toast.success(`批量推送完成${failedCount ? `，${failedCount} 个账户授权失败` : ''}`)
      setPushDialogOpen(false)
      setPushPreviewTotal(null)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
          ?.detail ||
        (err as { message?: string })?.message ||
        '批量推送失败'
      toast.error(msg)
    } finally {
      setPushingMaterials(false)
    }
  }

  const toggleChannelType = (value: number): void => {
    setChannelTypes((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    )
    resetList()
  }

  const toggleAuditStatus = (value: number): void => {
    setAuditStatuses((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    )
    resetList()
  }

  const togglePushStatus = (value: number): void => {
    setPushStatuses((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    )
    resetList()
  }

  const handlePageSizeChange = (value: string): void => {
    const nextPageSize = Number(value)
    if (!PAGE_SIZE_OPTIONS.includes(nextPageSize as (typeof PAGE_SIZE_OPTIONS)[number])) return
    setPageSize(nextPageSize)
    resetList()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <PackageSearch className="h-5 w-5" />
            常读素材管理
          </CardTitle>
          <CardDescription>
            选择常读账号和渠道后查询素材管理列表，支持时间、媒体渠道、素材名称和分页筛选。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">选择常读账号配置 *</Label>
            {loadingConfigs ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : configs.length === 0 ? (
              <div className="rounded-md border p-4 text-center text-muted-foreground">
                暂无常读配置，请先在配置中心添加常读账号的 Cookie。
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {configs.map((config) => (
                  <ChoiceCard
                    key={config.id}
                    checked={selectedConfigId === config.id}
                    title={config.cookie_name}
                    subtitle={config.realname || undefined}
                    meta={`配置 ID：${config.id}`}
                    onSelect={() => {
                      setSelectedConfigId(config.id)
                      setChannels([])
                      setSelectedChannelValue('')
                      resetList()
                    }}
                  />
                ))}
              </div>
            )}
            {selectedConfig ? (
              <p className="text-xs text-muted-foreground">
                当前选择：{selectedConfig.realname || selectedConfig.cookie_name}（配置 ID：
                {selectedConfig.id}）
              </p>
            ) : null}
          </div>

          {selectedConfigId ? (
            <div className="space-y-2">
              <Label className="text-base font-semibold">选择常读渠道 *</Label>
              {loadingChannels ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
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
                      <ChoiceCard
                        key={channelKey}
                        checked={selectedChannelValue === channelKey}
                        title={channelTitle}
                        subtitle={getAppTypeLabel(channel.app_type)}
                        meta={`app_id=${channel.app_id} · channel=${channel.channel || '—'} · distributor_id=${channel.distributor_id}`}
                        onSelect={() => {
                          setSelectedChannelValue(channelKey)
                          resetList()
                        }}
                      />
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                  暂无可用渠道，请确认 Cookie 是否有效或账号是否有可用渠道。
                </div>
              )}
              {selectedChannel ? (
                <p className="text-xs text-muted-foreground">
                  应用：{selectedChannel.app_name || '—'}；渠道：
                  {selectedChannel.nick_name || selectedChannel.distributor_name || '—'}；类型：
                  {getAppTypeLabel(selectedChannel.app_type)}；app_id：{selectedChannel.app_id}
                  ；app_type：{selectedChannel.app_type}
                </p>
              ) : null}
            </div>
          ) : null}

          {selectedConfigId ? (
            <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/10 p-4 lg:grid-cols-3 xl:grid-cols-[1.1fr_1fr_1fr]">
              <div className="space-y-2">
                <Label className="text-sm font-medium">创建时间</Label>
                <div className="flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <input
                    type="date"
                    className="min-w-0 flex-1 bg-transparent p-0 text-sm focus:outline-none"
                    value={startDate}
                    max={endDate || today}
                    onChange={(event) => {
                      setStartDate(event.target.value)
                      resetList()
                    }}
                  />
                  <span className="px-2 text-muted-foreground">-</span>
                  <input
                    type="date"
                    className="min-w-0 flex-1 bg-transparent p-0 text-sm focus:outline-none"
                    value={endDate}
                    min={startDate || undefined}
                    max={today}
                    onChange={(event) => {
                      setEndDate(event.target.value)
                      resetList()
                    }}
                  />
                  <Calendar className="ml-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">媒体渠道</Label>
                <div className="flex flex-wrap gap-3 rounded-md border border-input bg-background px-3 py-2">
                  {CHANNEL_TYPE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={channelTypes.includes(option.value)}
                        onCheckedChange={() => toggleChannelType(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">审核状态</Label>
                <div className="flex flex-wrap gap-3 rounded-md border border-input bg-background px-3 py-2">
                  {AUDIT_STATUS_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={auditStatuses.includes(option.value)}
                        onCheckedChange={() => toggleAuditStatus(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">推送状态</Label>
                <div className="flex flex-wrap gap-3 rounded-md border border-input bg-background px-3 py-2">
                  {PUSH_STATUS_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={pushStatuses.includes(option.value)}
                        onCheckedChange={() => togglePushStatus(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="changdu-material-name" className="text-sm font-medium">
                  素材名称
                </Label>
                <Input
                  id="changdu-material-name"
                  value={materialName}
                  onChange={(event) => {
                    setMaterialName(event.target.value)
                    resetList()
                  }}
                  placeholder="输入素材名称关键词"
                />
              </div>

              <Button
                className="self-end lg:col-span-3 xl:col-span-1"
                type="button"
                onClick={() => void loadList(0)}
                disabled={!selectedConfigId || !selectedChannelValue || fetching || loadingChannels}
              >
                {fetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                查询
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
            <div className="flex flex-wrap items-center gap-3">
              <Label className="text-sm text-muted-foreground">每页条数</Label>
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={pageSize}
                onChange={(event) => handlePageSizeChange(event.target.value)}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} 条
                  </option>
                ))}
              </select>
              {total > 0 ? (
                <span className="text-sm text-muted-foreground">
                  共 {total} 条，第 {pageIndex + 1} / {totalPages} 页
                </span>
              ) : null}
              {selectedCount > 0 ? (
                <span className="text-sm font-medium text-primary">
                  已选 {selectedCount} 个素材
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenSubmitDialog}
                disabled={!selectedConfigId || submittingMaterials}
              >
                {submittingMaterials ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                批量送审
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenPushDialog}
                disabled={!selectedConfigId || pushingMaterials}
              >
                {pushingMaterials ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                批量推送
              </Button>
              {selectedCount > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void pickDownloadDir()}
                  disabled={pickingDownloadDir}
                >
                  {pickingDownloadDir ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FolderOpen className="mr-2 h-4 w-4" />
                  )}
                  {downloadDir ? '更改目录' : '下载目录'}
                </Button>
              ) : null}
              {downloadTaskSummary ? (
                <Button
                  type="button"
                  variant={downloadPanelHidden ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setDownloadPanelVisible(true)
                    setDownloadPanelMinimized(false)
                  }}
                >
                  下载进度 {downloadTaskSummary.completed}/{downloadTaskSummary.total}
                </Button>
              ) : null}
              {selectedCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    selectedRowsMapRef.current = new Map()
                    setSelectedCount(0)
                    setSelectedSelectionVersion((prev) => prev + 1)
                  }}
                  disabled={startingDownload}
                >
                  <X className="mr-2 h-4 w-4" />
                  清空选择
                </Button>
              ) : null}
              {selectedCount > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleBatchDownload()}
                  disabled={startingDownload}
                >
                  {startingDownload ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  批量下载
                </Button>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="w-12 px-3 py-3 text-left font-medium">
                      <Checkbox
                        checked={isCurrentPageAllSelected}
                        onCheckedChange={toggleCurrentPageSelection}
                        aria-label="选择当前页素材"
                      />
                    </th>
                    <th className="min-w-[300px] px-3 py-3 text-left font-medium">素材信息</th>
                    <th className="min-w-[160px] px-3 py-3 text-left font-medium">媒体渠道</th>
                    <th className="min-w-[160px] px-3 py-3 text-left font-medium">投放应用</th>
                    <th className="min-w-[180px] px-3 py-3 text-left font-medium">审核状态</th>
                    <th className="min-w-[180px] px-3 py-3 text-left font-medium">推送状态</th>
                    <th className="min-w-[200px] px-3 py-3 text-left font-medium">创建人</th>
                    <th className="w-[168px] whitespace-nowrap px-3 py-3 text-left font-medium">
                      创建时间
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <MaterialTableRow
                      key={row.material_id || `${row.material_name}-${row.create_time}`}
                      row={row}
                      isSelected={Boolean(
                        row.material_id && selectedMaterialIdSet.has(row.material_id)
                      )}
                      onToggle={toggleRowSelection}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : hasQueried && !fetching ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              当前筛选条件下暂无素材数据。
            </div>
          ) : null}

          {hasQueried && totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadList(pageIndex - 1)}
                disabled={!canPrev || fetching}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                上一页
              </Button>
              <Input
                className="h-9 w-24 text-center"
                type="number"
                min={1}
                max={totalPages}
                value={pageIndex + 1}
                onChange={(event) => {
                  const page =
                    Math.min(totalPages, Math.max(1, Number(event.target.value) || 1)) - 1
                  if (page !== pageIndex) void loadList(page)
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadList(pageIndex + 1)}
                disabled={!canNext || fetching}
              >
                下一页
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={submitDialogOpen}
        onOpenChange={(open) => !submittingMaterials && setSubmitDialogOpen(open)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>常读素材批量送审</DialogTitle>
            <DialogDescription>
              按创建时间筛选未审核素材，并提交到所选媒体渠道审核。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              <div className="font-medium text-foreground">当前送审范围</div>
              <div className="mt-2 grid gap-1.5 text-muted-foreground">
                <div>
                  常读账号配置：{selectedConfig?.cookie_name || '—'}
                  {selectedConfig?.realname ? (
                    <span className="ml-1">（{selectedConfig.realname}）</span>
                  ) : null}
                  {selectedConfig ? (
                    <span className="ml-1">配置 ID：{selectedConfig.id}</span>
                  ) : null}
                </div>
                <div>
                  常读渠道：
                  {selectedChannel?.nick_name ||
                    selectedChannel?.distributor_name ||
                    selectedChannel?.app_name ||
                    '—'}
                  {selectedChannel ? (
                    <span className="ml-1">
                      （distributor_id：{selectedChannel.distributor_id || '—'}）
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">创建时间 *</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <input
                    type="date"
                    className="min-w-0 flex-1 bg-transparent p-0 text-sm focus:outline-none"
                    value={submitStartDate}
                    max={submitEndDate || today}
                    onChange={(event) => setSubmitStartDate(event.target.value)}
                  />
                  <input
                    type="time"
                    step="1"
                    className="ml-2 w-[92px] bg-transparent p-0 text-sm focus:outline-none"
                    value={submitStartTime}
                    onChange={(event) => setSubmitStartTime(event.target.value)}
                  />
                </div>
                <div className="flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <input
                    type="date"
                    className="min-w-0 flex-1 bg-transparent p-0 text-sm focus:outline-none"
                    value={submitEndDate}
                    min={submitStartDate || undefined}
                    max={today}
                    onChange={(event) => setSubmitEndDate(event.target.value)}
                  />
                  <input
                    type="time"
                    step="1"
                    className="ml-2 w-[92px] bg-transparent p-0 text-sm focus:outline-none"
                    value={submitEndTime}
                    onChange={(event) => setSubmitEndTime(event.target.value)}
                  />
                  <Calendar className="ml-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">媒体渠道 *</Label>
              <div className="flex flex-wrap gap-3 rounded-md border border-input bg-background px-3 py-2">
                {MATERIAL_SUBMIT_PLATFORM_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={submitPlatforms.includes(option.value)}
                      onCheckedChange={() => toggleSubmitPlatform(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                仅送审审核状态为未审核的素材；巨量引擎对应 platform=1，腾讯广告对应 platform=2。
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubmitDialogOpen(false)}
              disabled={submittingMaterials}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmitMaterials()}
              disabled={submittingMaterials}
            >
              {submittingMaterials ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              确认送审
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pushDialogOpen}
        onOpenChange={(open) => !pushingMaterials && setPushDialogOpen(open)}
      >
        <DialogContent className="flex max-h-[90vh] max-w-xl flex-col overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-3">
            <DialogTitle>常读素材批量推送</DialogTitle>
            <DialogDescription>
              按素材关键字、审核状态、创建时间和单个媒体渠道批量推送素材。
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-2">
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              <div className="font-medium text-foreground">当前推送范围</div>
              <div className="mt-2 grid gap-1.5 text-muted-foreground">
                <div>
                  常读账号配置：{selectedConfig?.cookie_name || '—'}
                  {selectedConfig?.realname ? (
                    <span className="ml-1">（{selectedConfig.realname}）</span>
                  ) : null}
                  {selectedConfig ? (
                    <span className="ml-1">配置 ID：{selectedConfig.id}</span>
                  ) : null}
                </div>
                <div>
                  常读渠道：
                  {selectedChannel?.nick_name ||
                    selectedChannel?.distributor_name ||
                    selectedChannel?.app_name ||
                    '—'}
                  {selectedChannel ? (
                    <span className="ml-1">
                      （distributor_id：{selectedChannel.distributor_id || '—'}；广告账户：
                      {selectedChannel.channel || '—'}）
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="changdu-material-push-name" className="text-sm font-medium">
                素材关键字
              </Label>
              <Input
                id="changdu-material-push-name"
                value={pushMaterialName}
                onChange={(event) => {
                  setPushMaterialName(event.target.value)
                  setPushPreviewTotal(null)
                }}
                placeholder="可选，输入 material_name 关键词"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">审核状态</Label>
              <div className="rounded-md border border-input bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                审核通过
              </div>
              <p className="text-xs text-muted-foreground">
                批量推送固定使用 audit_status_list=[3]。
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">创建时间 *</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <input
                    type="date"
                    className="min-w-0 flex-1 bg-transparent p-0 text-sm focus:outline-none"
                    value={pushStartDate}
                    max={pushEndDate || today}
                    onChange={(event) => {
                      setPushStartDate(event.target.value)
                      setPushPreviewTotal(null)
                    }}
                  />
                  <input
                    type="time"
                    step="1"
                    className="ml-2 w-[92px] bg-transparent p-0 text-sm focus:outline-none"
                    value={pushStartTime}
                    onChange={(event) => {
                      setPushStartTime(event.target.value)
                      setPushPreviewTotal(null)
                    }}
                  />
                </div>
                <div className="flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <input
                    type="date"
                    className="min-w-0 flex-1 bg-transparent p-0 text-sm focus:outline-none"
                    value={pushEndDate}
                    min={pushStartDate || undefined}
                    max={today}
                    onChange={(event) => {
                      setPushEndDate(event.target.value)
                      setPushPreviewTotal(null)
                    }}
                  />
                  <input
                    type="time"
                    step="1"
                    className="ml-2 w-[92px] bg-transparent p-0 text-sm focus:outline-none"
                    value={pushEndTime}
                    onChange={(event) => {
                      setPushEndTime(event.target.value)
                      setPushPreviewTotal(null)
                    }}
                  />
                  <Calendar className="ml-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">媒体渠道 *</Label>
              <div className="flex flex-wrap gap-3 rounded-md border border-input bg-background px-3 py-2">
                {MATERIAL_SUBMIT_PLATFORM_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      className="h-4 w-4 accent-primary"
                      checked={pushPlatform === option.value}
                      onChange={() => {
                        setPushPlatform(option.value)
                        setPushPreviewTotal(null)
                      }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                批量推送一次仅支持一个媒体渠道；请求中固定 material_type_list=[2]。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="changdu-material-push-accounts" className="text-sm font-medium">
                账户 ID *
              </Label>
              <Textarea
                id="changdu-material-push-accounts"
                value={pushAdvertisingAccountText}
                onChange={(event) => setPushAdvertisingAccountText(event.target.value)}
                placeholder="每行一个账户 ID，也支持用逗号或空格分隔"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                对应请求参数 advertising_account，默认带入当前常读渠道的广告账户 ID。
              </p>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">素材数量预览</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    根据当前素材关键字、审核通过、创建时间和媒体渠道获取可推送素材总数。
                  </div>
                  <div className="mt-2 rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700">
                    注意：单次推送仅支持最多 5000 个素材；超过时请更改创建时间段，分时段推送。
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handlePreviewPushCount()}
                  disabled={previewingPushCount || pushingMaterials}
                >
                  {previewingPushCount ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  预览数量
                </Button>
              </div>
              {pushPreviewTotal !== null ? (
                <div
                  className={[
                    'mt-3 rounded-md border px-3 py-2 text-sm',
                    pushPreviewTotal > 5000
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-primary/20 bg-primary/5'
                  ].join(' ')}
                >
                  当前条件共 <span className="font-semibold">{pushPreviewTotal}</span> 个可推送素材
                  {pushPreviewTotal > 5000 ? (
                    <div className="mt-1 text-xs font-medium">
                      已超过 5000 个素材上限，请缩短创建时间范围后再分时段推送。
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className="border-t bg-background px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPushDialogOpen(false)}
              disabled={pushingMaterials}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void handlePushMaterials()}
              disabled={pushingMaterials}
            >
              {pushingMaterials ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              确认推送
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VideoDownloadPanel
        batch={downloadBatch}
        visible={downloadPanelVisible}
        minimized={downloadPanelMinimized}
        onMinimizeToggle={() => setDownloadPanelMinimized(!downloadPanelMinimized)}
        onClose={() => setDownloadPanelVisible(false)}
        onPause={() => void window.api?.videoDownload?.pause()}
        onResume={() => void window.api?.videoDownload?.resume()}
        onCancel={() => void window.api?.videoDownload?.cancel()}
        onRetryFailed={() => void handleRetryFailedDownloads()}
        onClearCompleted={() => void handleClearCompletedDownloads()}
        onOpenFolder={() => void window.api?.videoDownload?.openFolder()}
      />
    </div>
  )
}
