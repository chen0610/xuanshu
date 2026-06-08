import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  FolderTree,
  Loader2,
  RefreshCw,
  Search,
  X
} from 'lucide-react'
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
import { configService } from '../../services/config.service'
import {
  dataAssistantV2Service,
  videoAnalysisService,
  buildVideoUrlKey,
  type VideoAnalysisItem,
  type VideoAnalysisPlayInfoBatchResult
} from '../../services/ocean-engine.service'
import type { Config } from '../../types/config.types'
import { authService } from '../../services/auth.service'
import { toast } from 'sonner'
import {
  useVideoDownloadPanel,
  VideoDownloadPanel
} from './components/VideoDownloadPanel'

interface OrgNodeSelection {
  id: string
  name: string
}

interface RememberedSelection {
  configId: number | null
  ebpId: string
  orgNodes: OrgNodeSelection[]
}

const DEFAULT_EBP_ID = '1853254961360906'
const SELECTION_STORAGE_KEY = 'ocean-engine-video-analysis-selection'
const DOWNLOAD_DIR_STORAGE_KEY = 'ocean-engine-video-download-dir'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9090'

function loadDownloadDir(): string {
  try {
    return window.localStorage.getItem(DOWNLOAD_DIR_STORAGE_KEY)?.trim() || ''
  } catch {
    return ''
  }
}

function persistDownloadDir(dir: string): void {
  window.localStorage.setItem(DOWNLOAD_DIR_STORAGE_KEY, dir)
}

function getVideoItemKey(item: VideoAnalysisItem): string | null {
  if (!item.ebp_id || !item.vid || !item.material_id) return null
  return buildVideoUrlKey(item.ebp_id, item.vid, item.material_id)
}

function parseMaterialIds(raw: string): string[] {
  return raw
    .split(/[,，\s\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getDefaultDateRange(): { startTime: string; endTime: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 6)
  return { startTime: formatDate(start), endTime: formatDate(end) }
}

function normalizeRememberedOrgNodes(value: unknown): OrgNodeSelection[] {
  if (!Array.isArray(value)) return []
  return value
    .map((node) => ({
      id: String((node as OrgNodeSelection)?.id || '').trim(),
      name: String((node as OrgNodeSelection)?.name || (node as OrgNodeSelection)?.id || '').trim()
    }))
    .filter(
      (node, index, nodes) => node.id && nodes.findIndex((item) => item.id === node.id) === index
    )
}

function loadRememberedSelection(): RememberedSelection {
  try {
    const raw = window.localStorage.getItem(SELECTION_STORAGE_KEY)
    if (!raw) return { configId: null, ebpId: DEFAULT_EBP_ID, orgNodes: [] }
    const parsed = JSON.parse(raw) as Partial<RememberedSelection>
    return {
      configId: typeof parsed.configId === 'number' ? parsed.configId : null,
      ebpId:
        typeof parsed.ebpId === 'string' && parsed.ebpId.trim() ? parsed.ebpId : DEFAULT_EBP_ID,
      orgNodes: normalizeRememberedOrgNodes(parsed.orgNodes)
    }
  } catch {
    return { configId: null, ebpId: DEFAULT_EBP_ID, orgNodes: [] }
  }
}

function normalizeCoverUrl(url?: string): string {
  if (!url) return ''
  const trimmed = url.trim()
  if (trimmed.startsWith('http://')) {
    return `https://${trimmed.slice(7)}`
  }
  return trimmed
}

const COVER_HEIGHT_CLASS = 'h-20'
const COVER_WIDTH_CLASS = 'w-[45px]'

async function copyText(text: string, successMessage: string): Promise<void> {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    toast.success(successMessage)
  } catch {
    toast.error('复制失败')
  }
}

async function openExternalUrl(url: string): Promise<void> {
  if (!url) return
  try {
    if (window.api?.openExternal) {
      await window.api.openExternal(url)
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  } catch {
    toast.error('打开链接失败')
  }
}

function CopyableText({
  value,
  successMessage,
  className = '',
  block = false
}: {
  value: string
  successMessage: string
  className?: string
  block?: boolean
}): React.ReactElement {
  return (
    <button
      type="button"
      className={`group ${block ? 'flex w-full' : 'inline-flex max-w-full'} items-center gap-1 text-left transition-colors hover:text-primary ${className}`}
      title="点击复制"
      onClick={() => void copyText(value, successMessage)}
    >
      <span className={block ? 'break-all' : 'truncate'}>{value}</span>
      <Copy className="h-3 w-3 flex-shrink-0 opacity-40 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

function CopyableField({
  label,
  value,
  successMessage,
  className = ''
}: {
  label: string
  value: string
  successMessage: string
  className?: string
}): React.ReactElement {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <CopyableText
        value={value}
        successMessage={successMessage}
        className={className}
        block
      />
    </div>
  )
}

function VideoUrlActions({
  videoUrl,
  loading,
  error
}: {
  videoUrl?: string
  loading?: boolean
  error?: string
}): React.ReactElement {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        获取中
      </span>
    )
  }

  if (error) {
    return <span className="text-xs text-destructive">失败</span>
  }

  if (!videoUrl) {
    return <span className="text-muted-foreground">--</span>
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => void copyText(videoUrl, '视频 URL 已复制')}
      >
        <Copy className="h-3.5 w-3.5" />
        复制
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => void openExternalUrl(videoUrl)}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        打开
      </Button>
    </div>
  )
}

function VideoCoverThumbnail({
  coverUrl,
  materialId
}: {
  coverUrl?: string
  materialId?: string
}): React.ReactElement {
  const [failed, setFailed] = useState(false)
  const src = normalizeCoverUrl(coverUrl)
  const coverClassName = `${COVER_HEIGHT_CLASS} ${COVER_WIDTH_CLASS} aspect-[9/16] rounded object-cover`

  if (!src || failed) {
    return (
      <div
        className={`flex ${COVER_HEIGHT_CLASS} ${COVER_WIDTH_CLASS} aspect-[9/16] items-center justify-center rounded bg-muted text-[10px] leading-tight text-muted-foreground`}
      >
        无封面
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={materialId || 'cover'}
      className={coverClassName}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}

export const VideoAnalysisPage: React.FC = () => {
  const rememberedSelection = useMemo(loadRememberedSelection, [])
  const defaultDateRange = useMemo(getDefaultDateRange, [])

  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(
    rememberedSelection.configId
  )
  const [ebpId, setEbpId] = useState(rememberedSelection.ebpId)
  const [organizationTree, setOrganizationTree] = useState<any>(null)
  const [selectedOrgNodes, setSelectedOrgNodes] = useState<OrgNodeSelection[]>(
    rememberedSelection.orgNodes
  )
  const [loadingOrgTree, setLoadingOrgTree] = useState(false)
  const [orgTreeError, setOrgTreeError] = useState('')
  const [startTime, setStartTime] = useState(defaultDateRange.startTime)
  const [endTime, setEndTime] = useState(defaultDateRange.endTime)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [pageInput, setPageInput] = useState('1')
  const [materialIdFilter, setMaterialIdFilter] = useState('')
  const [loadingList, setLoadingList] = useState(false)
  const [items, setItems] = useState<VideoAnalysisItem[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [totalMetrics, setTotalMetrics] = useState<Record<string, string>>({})
  const [listError, setListError] = useState('')
  const [videoUrlMap, setVideoUrlMap] = useState<Record<string, VideoAnalysisPlayInfoBatchResult>>(
    {}
  )
  const [loadingVideoUrls, setLoadingVideoUrls] = useState(false)
  const [selectedItemsMap, setSelectedItemsMap] = useState<Map<string, VideoAnalysisItem>>(
    () => new Map()
  )
  const [startingDownload, setStartingDownload] = useState(false)
  const [downloadDir, setDownloadDir] = useState(loadDownloadDir)
  const [pickingDownloadDir, setPickingDownloadDir] = useState(false)
  const lastDownloadTasksRef = useRef<
    Array<{
      id: string
      materialId: string
      videoId: string
      title?: string
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

  const selectedConfig = useMemo(
    () => configs.find((config) => config.id === selectedConfigId),
    [configs, selectedConfigId]
  )

  useEffect(() => {
    void loadConfigs()
  }, [])

  useEffect(() => {
    window.localStorage.setItem(
      SELECTION_STORAGE_KEY,
      JSON.stringify({ configId: selectedConfigId, ebpId, orgNodes: selectedOrgNodes })
    )
  }, [ebpId, selectedConfigId, selectedOrgNodes])

  useEffect(() => {
    setItems([])
    setTotal(0)
    setHasMore(false)
    setTotalMetrics({})
    setVideoUrlMap({})
    setSelectedItemsMap(new Map())
    setPage(1)
    setPageInput('1')
  }, [selectedConfigId, selectedOrgNodes, startTime, endTime])

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  const fetchVideoUrls = async (
    configId: number,
    listItems: VideoAnalysisItem[]
  ): Promise<void> => {
    const batchItems = listItems
      .filter((item) => item.ebp_id && item.vid && item.material_id)
      .map((item) => ({
        ebp_id: item.ebp_id as string,
        video_id: item.vid as string,
        material_id: item.material_id as string
      }))

    if (batchItems.length === 0) {
      setVideoUrlMap({})
      return
    }

    setLoadingVideoUrls(true)
    try {
      const response = await videoAnalysisService.getVideoPlayInfoBatch({
        config_id: configId,
        items: batchItems
      })
      if (response.code === 0 && response.data?.results) {
        setVideoUrlMap(response.data.results)
      } else {
        setVideoUrlMap({})
      }
    } catch (err) {
      console.error('Failed to fetch video urls:', err)
      setVideoUrlMap({})
    } finally {
      setLoadingVideoUrls(false)
    }
  }

  const loadConfigs = async (): Promise<void> => {
    try {
      const availableConfigs = await configService.getConfigsBySource(1)
      setConfigs(availableConfigs)
      if (availableConfigs.length > 0) {
        const rememberedConfigExists = availableConfigs.some(
          (config) => config.id === rememberedSelection.configId
        )
        setSelectedConfigId(
          rememberedConfigExists ? rememberedSelection.configId : availableConfigs[0].id
        )
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
      toast.error('加载 Cookie 账户失败')
    }
  }

  const loadOrganizationTree = async (): Promise<void> => {
    if (!selectedConfigId) {
      setOrgTreeError('请先选择 Cookie 账户')
      return
    }
    if (!ebpId.trim()) {
      setOrgTreeError('请先输入根 EBP ID')
      return
    }

    setLoadingOrgTree(true)
    setOrgTreeError('')
    try {
      const result = await dataAssistantV2Service.getOrganizationTree(
        selectedConfigId,
        ebpId.trim()
      )
      if (result.code === 0 && result.data) {
        setOrganizationTree(result.data)
      } else {
        setOrganizationTree(null)
        setOrgTreeError(result.msg || result.error || '获取组织树失败')
      }
    } catch (err: any) {
      setOrganizationTree(null)
      setOrgTreeError(err?.response?.data?.detail || err?.message || '获取组织树失败')
    } finally {
      setLoadingOrgTree(false)
    }
  }

  useEffect(() => {
    if (!selectedConfigId || !ebpId.trim()) return
    setOrganizationTree(null)
    void loadOrganizationTree()
  }, [selectedConfigId])

  const toggleOrgNodeSelection = (node: OrgNodeSelection): void => {
    setSelectedOrgNodes((prev) => {
      const exists = prev.some((item) => item.id === node.id)
      return exists ? prev.filter((item) => item.id !== node.id) : [...prev, node]
    })
  }

  const renderOrgTreeNode = (node: any, level = 0): React.ReactNode => {
    const nodeId = String(node.id || node.ebp_id || '')
    const nodeName = String(node.name || node.ebp_name || node.group_name || nodeId)
    const isSelected = selectedOrgNodes.some((item) => item.id === nodeId)
    const children = Array.isArray(node.children) ? node.children : []

    return (
      <div key={nodeId || `${nodeName}-${level}`} className="select-none">
        <button
          type="button"
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent ${
            isSelected ? 'bg-primary/10 text-primary' : ''
          }`}
          style={{ paddingLeft: `${level * 18 + 8}px` }}
          onClick={() => nodeId && toggleOrgNodeSelection({ id: nodeId, name: nodeName })}
        >
          <span
            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 ${
              isSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-muted-foreground/30'
            }`}
          >
            {isSelected && <Check className="h-3 w-3" />}
          </span>
          <span className="flex-1 truncate text-sm">{nodeName}</span>
          <span className="text-xs text-muted-foreground">{nodeId}</span>
        </button>
        {children.length > 0 && (
          <div>{children.map((child: any) => renderOrgTreeNode(child, level + 1))}</div>
        )}
      </div>
    )
  }

  const fetchList = async (targetPage = page): Promise<void> => {
    if (!selectedConfigId) {
      toast.error('请先选择 Cookie 账户')
      return
    }
    if (selectedOrgNodes.length === 0) {
      toast.error('请至少选择一个组织节点')
      return
    }
    if (!startTime || !endTime) {
      toast.error('请选择统计时间范围')
      return
    }
    if (new Date(endTime) < new Date(startTime)) {
      toast.error('结束日期不能早于开始日期')
      return
    }

    setLoadingList(true)
    setListError('')
    try {
      const materialIds = parseMaterialIds(materialIdFilter)
      const response = await videoAnalysisService.getVideoList({
        config_id: selectedConfigId,
        ebp_ids: selectedOrgNodes.map((node) => node.id),
        start_time: startTime,
        end_time: endTime,
        page: targetPage,
        limit: pageSize,
        order_field: 'stat_cost',
        order_type: 2,
        ...(materialIds.length > 0 ? { material_ids: materialIds } : {})
      })

      if (response.code !== 0 || !response.data) {
        throw new Error(response.msg || response.error || '查询失败')
      }

      setItems(response.data.items || [])
      setTotal(response.data.total || 0)
      setHasMore(Boolean(response.data.has_more))
      setTotalMetrics(response.data.total_metrics || {})
      setPage(targetPage)
      void fetchVideoUrls(selectedConfigId, response.data.items || [])
    } catch (err: any) {
      const message = err?.response?.data?.detail || err?.message || '查询失败'
      setListError(message)
      setItems([])
      setTotal(0)
      setHasMore(false)
      setVideoUrlMap({})
      toast.error(message)
    } finally {
      setLoadingList(false)
    }
  }

  const handleSearch = (): void => {
    void fetchList(1)
  }

  const handlePageSizeChange = (nextPageSize: number): void => {
    setPageSize(nextPageSize)
    setPage(1)
    setPageInput('1')
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const jumpToPage = (): void => {
    const parsed = Number.parseInt(pageInput, 10)
    if (Number.isNaN(parsed)) {
      setPageInput(String(page))
      return
    }
    const maxPage = Math.max(1, totalPages)
    void fetchList(Math.min(Math.max(1, parsed), maxPage))
  }

  const selectedCount = selectedItemsMap.size
  const selectablePageItems = useMemo(
    () => items.filter((item) => Boolean(getVideoItemKey(item))),
    [items]
  )
  const allPageSelected =
    selectablePageItems.length > 0 &&
    selectablePageItems.every((item) => {
      const key = getVideoItemKey(item)
      return key ? selectedItemsMap.has(key) : false
    })

  const downloadTaskSummary = useMemo(() => {
    if (!downloadBatch) return null
    const tasks = downloadBatch.tasks
    const completed = tasks.filter((task) => task.status === 'completed').length
    const active = tasks.filter(
      (task) => task.status === 'pending' || task.status === 'downloading'
    ).length
    return {
      total: tasks.length,
      completed,
      active,
      status: downloadBatch.status
    }
  }, [downloadBatch])

  const downloadPanelHidden = Boolean(
    downloadBatch && (!downloadPanelVisible || downloadPanelMinimized)
  )

  const openDownloadPanel = (): void => {
    setDownloadPanelVisible(true)
    setDownloadPanelMinimized(false)
  }

  const toggleItemSelection = (item: VideoAnalysisItem): void => {
    const key = getVideoItemKey(item)
    if (!key) return
    setSelectedItemsMap((prev) => {
      const next = new Map(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.set(key, item)
      }
      return next
    })
  }

  const togglePageSelection = (): void => {
    if (allPageSelected) {
      setSelectedItemsMap((prev) => {
        const next = new Map(prev)
        items.forEach((item) => {
          const key = getVideoItemKey(item)
          if (key) next.delete(key)
        })
        return next
      })
      return
    }

    setSelectedItemsMap((prev) => {
      const next = new Map(prev)
      items.forEach((item) => {
        const key = getVideoItemKey(item)
        if (key) next.set(key, item)
      })
      return next
    })
  }

  const clearSelectedItems = (): void => {
    setSelectedItemsMap(new Map())
  }

  const pickDownloadDir = async (): Promise<string | null> => {
    if (!window.api?.selectFolder) {
      toast.error('当前环境不支持选择目录')
      return null
    }
    setPickingDownloadDir(true)
    try {
      const result = await window.api.selectFolder()
      if (result.canceled || !result.folderPath) {
        return null
      }
      setDownloadDir(result.folderPath)
      persistDownloadDir(result.folderPath)
      toast.success('下载目录已设置')
      return result.folderPath
    } finally {
      setPickingDownloadDir(false)
    }
  }

  const ensureDownloadDir = async (): Promise<string | null> => {
    const current = downloadDir.trim()
    if (current) return current
    toast.message('请先选择视频保存目录')
    return pickDownloadDir()
  }

  const handleBatchDownload = async (): Promise<void> => {
    if (!selectedConfigId) {
      toast.error('请先选择 Cookie 账户')
      return
    }
    if (selectedItemsMap.size === 0) {
      toast.error('请先选择要下载的素材')
      return
    }
    if (!window.api?.videoDownload) {
      toast.error('当前环境不支持批量下载')
      return
    }

    const authToken = authService.getToken()
    if (!authToken) {
      toast.error('登录状态失效，请重新登录后再下载')
      return
    }

    const saveDir = await ensureDownloadDir()
    if (!saveDir) return

    const selectedItems = Array.from(selectedItemsMap.values())
    setStartingDownload(true)
    try {
      const batchItems = selectedItems
        .filter((item) => item.ebp_id && item.vid && item.material_id)
        .map((item) => ({
          ebp_id: item.ebp_id as string,
          video_id: item.vid as string,
          material_id: item.material_id as string
        }))

      if (batchItems.length === 0) {
        toast.error('所选素材缺少必要字段，无法下载')
        return
      }

      const response = await videoAnalysisService.getVideoPlayInfoBatch({
        config_id: selectedConfigId,
        items: batchItems
      })

      if (response.code !== 0 || !response.data?.results) {
        throw new Error(response.msg || response.error || '获取视频地址失败')
      }

      const tasks = selectedItems
        .map((item) => {
          const key = getVideoItemKey(item)
          if (!key) return null
          const playInfo = response.data?.results?.[key]
          if (!playInfo?.video_url) {
            return null
          }
          return {
            id: key,
            materialId: item.material_id as string,
            videoId: item.vid as string,
            title: item.video_title,
            url: playInfo.video_url
          }
        })
        .filter(Boolean) as Array<{
        id: string
        materialId: string
        videoId: string
        title?: string
        url: string
      }>

      if (tasks.length === 0) {
        toast.error('未能获取到可下载的视频地址')
        return
      }

      const startResult = await window.api.videoDownload.start({
        saveDir,
        tasks,
        concurrency: 3,
        proxyConfig: {
          apiBaseUrl: API_BASE_URL,
          authToken,
          configId: selectedConfigId
        }
      })

      if (!startResult.ok) {
        toast.error('error' in startResult ? startResult.error : '启动下载失败')
        return
      }

      lastDownloadTasksRef.current = tasks
      setDownloadPanelVisible(true)
      setDownloadPanelMinimized(false)
      await refreshDownloadState()
      toast.success(`已开始下载 ${tasks.length} 个视频`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || '批量下载失败')
    } finally {
      setStartingDownload(false)
    }
  }

  const handleRetryFailedDownloads = async (): Promise<void> => {
    if (!selectedConfigId || !window.api?.videoDownload) return
    const failedIds = new Set(
      (downloadBatch?.tasks || [])
        .filter((task) => task.status === 'failed')
        .map((task) => task.id)
    )
    if (failedIds.size === 0) return

    try {
      const retryItems = lastDownloadTasksRef.current
        .filter((task) => failedIds.has(task.id))
        .map((task) => {
          const [ebpId, videoId, materialId] = task.id.split(':')
          return {
            ebp_id: ebpId,
            video_id: videoId,
            material_id: materialId
          }
        })

      const response = await videoAnalysisService.getVideoPlayInfoBatch({
        config_id: selectedConfigId,
        items: retryItems
      })

      if (response.code !== 0 || !response.data?.results) {
        throw new Error(response.msg || response.error || '刷新视频地址失败')
      }

      const tasks = lastDownloadTasksRef.current
        .filter((task) => failedIds.has(task.id))
        .map((task) => {
          const playInfo = response.data?.results?.[task.id]
          return playInfo?.video_url ? { ...task, url: playInfo.video_url } : null
        })
        .filter(Boolean) as Array<{
        id: string
        materialId: string
        videoId: string
        title?: string
        url: string
      }>

      if (tasks.length === 0) {
        toast.error('未能刷新失败项的视频地址')
        return
      }

      const result = await window.api.videoDownload.retryFailed({ tasks })
      if (!result.ok) {
        toast.error(result.error || '重试失败')
        return
      }
      lastDownloadTasksRef.current = lastDownloadTasksRef.current.map((task) => {
        const refreshed = tasks.find((item) => item.id === task.id)
        return refreshed || task
      })
      toast.success(`已重新排队 ${tasks.length} 个失败任务`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || '重试失败')
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
    const activeIds = new Set((downloadBatch?.tasks || []).filter((task) => task.status !== 'completed').map((task) => task.id))
    lastDownloadTasksRef.current = lastDownloadTasksRef.current.filter((task) => activeIds.has(task.id))
    await refreshDownloadState()
    toast.success(`已清空 ${result.removed || 0} 条已完成记录`)
  }

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.58)]"
      >
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_58%)]" />
        <div className="relative flex flex-col gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Clapperboard className="h-3.5 w-3.5 text-primary" />
            Video Analysis
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">视频分析</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              选择 Cookie 账户和组织节点，按时间范围拉取视频素材消耗与互动数据。
            </p>
          </div>
        </div>
      </motion.section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-primary" />
            数据范围
          </CardTitle>
          <CardDescription>
            选择 Cookie 账户、根 EBP 和组织节点，已选内容会自动记住。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1.1fr)_minmax(180px,0.9fr)_auto]">
            <div className="space-y-1.5">
              <Label>Cookie 账户</Label>
              <select
                value={selectedConfigId ?? ''}
                onChange={(event) => setSelectedConfigId(Number(event.target.value) || null)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {configs.length === 0 ? (
                  <option value="">暂无可用账户配置</option>
                ) : (
                  configs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.cookie_name}
                      {config.realname ? ` / ${config.realname}` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>根 EBP ID</Label>
              <Input
                value={ebpId}
                onChange={(event) => setEbpId(event.target.value.trim())}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void loadOrganizationTree()
                }}
                placeholder="请输入根 EBP ID"
              />
            </div>
            <div className="flex items-end">
              <Button
                size="icon"
                className="w-full lg:w-10"
                onClick={() => void loadOrganizationTree()}
                disabled={loadingOrgTree || !selectedConfigId}
                title="刷新组织树"
                aria-label="刷新组织树"
              >
                {loadingOrgTree ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span>当前：</span>
            <span className="font-medium text-foreground">
              {selectedConfig?.cookie_name || '未选择账户'}
            </span>
            <span className="text-muted-foreground/60">/</span>
            <span>
              {selectedOrgNodes.length > 0
                ? `已选 ${selectedOrgNodes.length} 个组织节点`
                : '未选择组织节点'}
            </span>
            {selectedOrgNodes.map((node) => (
              <span
                key={node.id}
                className="inline-flex max-w-[180px] items-center gap-1.5 rounded-full bg-primary/10 px-2 py-1 font-medium text-primary"
              >
                <span className="truncate">{node.name}</span>
                <button
                  type="button"
                  className="rounded-full hover:bg-primary/15"
                  aria-label={`移除 ${node.name}`}
                  onClick={() => toggleOrgNodeSelection(node)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          {orgTreeError && <div className="text-sm text-destructive">{orgTreeError}</div>}
          {organizationTree && (
            <div className="max-h-[260px] overflow-y-auto rounded-xl border p-2">
              {Array.isArray(organizationTree.children) && organizationTree.children.length > 0 ? (
                organizationTree.children.map((child: any) => renderOrgTreeNode(child))
              ) : (
                <div className="p-2 text-sm text-muted-foreground">暂无组织数据</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>查询条件</CardTitle>
          <CardDescription>
            默认近 7 天（含今天），可按消耗降序查看视频素材表现；支持按素材 ID 精确筛选（可多填）。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                开始日期
              </Label>
              <Input
                type="date"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                结束日期
              </Label>
              <Input
                type="date"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>素材 ID</Label>
              <Input
                value={materialIdFilter}
                onChange={(event) => setMaterialIdFilter(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleSearch()
                }}
                placeholder="多个 ID 用逗号或换行分隔"
              />
            </div>
            <div className="space-y-2">
              <Label>每页</Label>
              <select
                value={pageSize}
                onChange={(event) => handlePageSizeChange(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
            </div>
            <div className="flex items-end xl:col-span-2">
              <Button className="w-full" onClick={handleSearch} disabled={loadingList}>
                {loadingList ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    查询中...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    查询
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>视频素材列表</CardTitle>
              <CardDescription>
                共 {total.toLocaleString()} 条
                {Object.keys(totalMetrics).length > 0 && (
                  <span className="ml-2">
                    汇总消耗 {totalMetrics.stat_cost || '--'} / 展示 {totalMetrics.show_cnt || '--'}{' '}
                    / 点击 {totalMetrics.click_cnt || '--'} / CTR {totalMetrics.ctr || '--'}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {downloadTaskSummary && (
                <Button
                  variant={downloadPanelHidden ? 'default' : 'outline'}
                  size="sm"
                  onClick={openDownloadPanel}
                  title="打开批量下载进度面板"
                >
                  {downloadTaskSummary.active > 0 ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-1.5 h-4 w-4" />
                  )}
                  下载任务
                  <span className="ml-1.5 rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-normal">
                    {downloadTaskSummary.completed}/{downloadTaskSummary.total}
                  </span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchList(page)}
                disabled={loadingList || selectedOrgNodes.length === 0}
              >
                {loadingList ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {selectedCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed bg-muted/20 px-3 py-2.5">
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="shrink-0 text-xs text-muted-foreground">下载目录</span>
              <span
                className={`min-w-0 flex-1 truncate font-mono text-xs ${
                  downloadDir ? 'text-foreground' : 'text-muted-foreground'
                }`}
                title={downloadDir || undefined}
              >
                {downloadDir || '未选择 — 批量下载前请先指定保存位置'}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pickingDownloadDir}
                onClick={() => void pickDownloadDir()}
              >
                {pickingDownloadDir ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                )}
                {downloadDir ? '更改目录' : '选择目录'}
              </Button>
              <span className="hidden h-4 w-px bg-border sm:block" />
              <span className="text-xs text-muted-foreground">已选 {selectedCount} 条</span>
              <Button variant="outline" size="sm" onClick={clearSelectedItems}>
                清空选择
              </Button>
              <Button
                size="sm"
                onClick={() => void handleBatchDownload()}
                disabled={startingDownload || pickingDownloadDir}
                title={downloadDir ? undefined : '请先选择下载目录'}
              >
                {startingDownload ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                批量下载
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {listError && <div className="mb-4 text-sm text-destructive">{listError}</div>}

          {loadingList && items.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              加载中...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
              暂无数据，请选择组织节点并点击查询
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-3 py-2.5 font-medium">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input"
                          checked={allPageSelected}
                          onChange={togglePageSelection}
                          aria-label="本页全选"
                        />
                       
                      </label>
                    </th>
                    <th className="px-3 py-2.5 font-medium">封面</th>
                    <th className="px-3 py-2.5 font-medium">素材 ID</th>
                    <th className="px-3 py-2.5 font-medium">时长</th>
                    <th className="px-3 py-2.5 font-medium">创建时间</th>
                    <th className="px-3 py-2.5 font-medium text-right">消耗</th>
                    <th className="px-3 py-2.5 font-medium text-right">展示</th>
                    <th className="px-3 py-2.5 font-medium text-right">点击</th>
                    <th className="px-3 py-2.5 font-medium text-right">点击率</th>
                    <th className="px-3 py-2.5 font-medium">广告主 ID</th>
                    <th className="px-3 py-2.5 font-medium">视频 URL</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const itemKey = getVideoItemKey(item)
                    const isSelected = itemKey ? selectedItemsMap.has(itemKey) : false
                    return (
                    <tr
                      key={`${item.material_id || item.vid}-${index}`}
                      className="border-b last:border-b-0 hover:bg-muted/20"
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input"
                          checked={isSelected}
                          disabled={!itemKey}
                          aria-label={`选择素材 ${item.material_id || item.vid || ''}`}
                          onChange={() => toggleItemSelection(item)}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <VideoCoverThumbnail
                          coverUrl={item.video_cover_url}
                          materialId={item.material_id}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex min-w-[160px] flex-col gap-2">
                          {item.material_id ? (
                            <CopyableField
                              label="素材 ID"
                              value={item.material_id}
                              successMessage="素材 ID 已复制"
                              className="font-medium"
                            />
                          ) : (
                            <span>--</span>
                          )}
                          {item.vid && (
                            <CopyableField
                              label="VID"
                              value={item.vid}
                              successMessage="VID 已复制"
                              className="text-xs text-muted-foreground"
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">{item.video_duration || '--'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {item.video_sync_time || '--'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">{item.stat_cost || '--'}</td>
                      <td className="px-3 py-2.5 text-right">{item.show_cnt || '--'}</td>
                      <td className="px-3 py-2.5 text-right">{item.click_cnt || '--'}</td>
                      <td className="px-3 py-2.5 text-right">{item.ctr || '--'}</td>
                      <td className="px-3 py-2.5">
                        {item.max_advertiser_id ? (
                          <CopyableText
                            value={item.max_advertiser_id}
                            successMessage="广告主 ID 已复制"
                            className="font-mono text-xs"
                            block
                          />
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {(() => {
                          if (!item.ebp_id || !item.vid || !item.material_id) {
                            return <span className="text-muted-foreground">--</span>
                          }
                          const urlKey = buildVideoUrlKey(
                            item.ebp_id,
                            item.vid,
                            item.material_id
                          )
                          const urlResult = videoUrlMap[urlKey]
                          return (
                            <VideoUrlActions
                              loading={loadingVideoUrls && !urlResult}
                              videoUrl={urlResult?.video_url}
                              error={urlResult?.error}
                            />
                          )
                        })()}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {items.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                共 {total.toLocaleString()} 条，第 {page} / {totalPages} 页，本页 {items.length} 条
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loadingList}
                  onClick={() => void fetchList(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一页
                </Button>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>跳至</span>
                  <Input
                    value={pageInput}
                    onChange={(event) =>
                      setPageInput(event.target.value.replace(/[^0-9]/g, ''))
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') jumpToPage()
                    }}
                    className="h-8 w-16 text-center"
                    inputMode="numeric"
                    disabled={loadingList}
                  />
                  <span>/ {totalPages} 页</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={jumpToPage}
                    disabled={loadingList}
                  >
                    确定
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loadingList}
                  onClick={() => void fetchList(page + 1)}
                >
                  下一页
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <VideoDownloadPanel
        batch={downloadBatch}
        visible={downloadPanelVisible}
        minimized={downloadPanelMinimized}
        onMinimizeToggle={() => setDownloadPanelMinimized((prev) => !prev)}
        onClose={() => setDownloadPanelVisible(false)}
        onPause={() => void window.api?.videoDownload?.pause()}
        onResume={() => void window.api?.videoDownload?.resume()}
        onCancel={() => void window.api?.videoDownload?.cancel()}
        onRetryFailed={() => void handleRetryFailedDownloads()}
        onClearCompleted={() => void handleClearCompletedDownloads()}
        onOpenFolder={() =>
          void window.api?.videoDownload?.openFolder().then((result) => {
            if (!result.ok && result.error) toast.error(result.error)
          })
        }
      />
    </div>
  )
}
