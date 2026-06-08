import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  FolderOpen,
  GripHorizontal,
  Loader2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  X,
  XCircle
} from 'lucide-react'
import { Button, Progress } from '../../../components/ui'

export interface VideoDownloadTaskState {
  id: string
  materialId: string
  videoId: string
  filename: string
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled'
  progress: number
  downloadedBytes: number
  totalBytes: number
  error?: string
  filePath?: string
}

export interface VideoDownloadBatchState {
  batchId: string
  saveDir: string
  status: 'running' | 'paused' | 'completed' | 'cancelled'
  concurrency: number
  tasks: VideoDownloadTaskState[]
  startedAt: number
}

const PANEL_STORAGE_KEY = 'ocean-engine-video-download-panel-pos'
const MAX_RENDERED_TASKS = 50

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

function loadPanelPosition(): { x: number; y: number } {
  if (typeof window === 'undefined') {
    return { x: 24, y: 24 }
  }
  try {
    const raw = window.localStorage.getItem(PANEL_STORAGE_KEY)
    if (!raw) {
      return {
        x: Math.max(24, window.innerWidth - 380),
        y: Math.max(24, window.innerHeight - 420)
      }
    }
    const parsed = JSON.parse(raw) as { x?: number; y?: number }
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return { x: parsed.x, y: parsed.y }
    }
  } catch {
    // ignore
  }
  return {
    x: Math.max(24, window.innerWidth - 380),
    y: Math.max(24, window.innerHeight - 420)
  }
}

function useDraggablePanel(): {
  position: { x: number; y: number }
  handleDragStart: (event: React.MouseEvent<HTMLDivElement>) => void
} {
  const [position, setPosition] = useState(loadPanelPosition)
  const dragStateRef = useRef<{ offsetX: number; offsetY: number } | null>(null)

  const handleDragStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    dragStateRef.current = {
      offsetX: event.clientX - position.x,
      offsetY: event.clientY - position.y
    }

    const handleMove = (moveEvent: MouseEvent): void => {
      if (!dragStateRef.current) return
      const nextX = Math.max(
        8,
        Math.min(window.innerWidth - 320, moveEvent.clientX - dragStateRef.current.offsetX)
      )
      const nextY = Math.max(
        8,
        Math.min(window.innerHeight - 120, moveEvent.clientY - dragStateRef.current.offsetY)
      )
      setPosition({ x: nextX, y: nextY })
    }

    const handleUp = (): void => {
      dragStateRef.current = null
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      setPosition((latest) => {
        window.localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(latest))
        return latest
      })
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [position.x, position.y])

  return { position, handleDragStart }
}

export const VideoDownloadPanel: React.FC<{
  batch: VideoDownloadBatchState | null
  visible: boolean
  minimized: boolean
  onMinimizeToggle: () => void
  onClose: () => void
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  onRetryFailed: () => void
  onClearCompleted: () => void
  onOpenFolder: () => void
}> = ({
  batch,
  visible,
  minimized,
  onMinimizeToggle,
  onClose,
  onPause,
  onResume,
  onCancel,
  onRetryFailed,
  onClearCompleted,
  onOpenFolder
}) => {
  const { position, handleDragStart } = useDraggablePanel()

  const stats = useMemo(() => {
    const tasks = batch?.tasks || []
    let completed = 0
    let failed = 0
    let active = 0
    let totalBytes = 0
    let downloadedBytes = 0
    let progressSum = 0

    for (const task of tasks) {
      if (task.status === 'completed') {
        completed += 1
        progressSum += 100
      } else if (task.status === 'failed') {
        failed += 1
      } else if (task.status === 'downloading' || task.status === 'pending') {
        active += 1
        progressSum += task.progress
      }
      totalBytes += task.totalBytes || 0
      downloadedBytes += task.downloadedBytes || 0
    }

    const overallProgress = tasks.length > 0 ? Math.round(progressSum / tasks.length) : 0
    return {
      completed,
      failed,
      active,
      totalBytes,
      downloadedBytes,
      overallProgress,
      total: tasks.length
    }
  }, [batch])

  const visibleTasks = useMemo(() => {
    const tasks = batch?.tasks || []
    const prioritizedTasks = [
      ...tasks.filter((task) => task.status === 'downloading'),
      ...tasks.filter((task) => task.status === 'failed'),
      ...tasks.filter((task) => task.status === 'pending'),
      ...tasks.filter((task) => task.status === 'completed').slice(-MAX_RENDERED_TASKS)
    ]
    return prioritizedTasks.slice(0, MAX_RENDERED_TASKS)
  }, [batch])

  const hiddenTaskCount = Math.max(0, stats.total - visibleTasks.length)

  if (!visible || !batch) return null

  const isRunning = batch.status === 'running'
  const isPaused = batch.status === 'paused'
  const canRetry = stats.failed > 0 && !isRunning
  const canClearCompleted = stats.completed > 0

  return (
    <div
      className="fixed z-50 w-[360px] overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className="flex cursor-move items-center justify-between border-b bg-muted/40 px-3 py-2"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <GripHorizontal className="h-4 w-4 text-muted-foreground" />
          批量下载
          <span className="text-xs font-normal text-muted-foreground">
            {stats.completed}/{stats.total}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onMinimizeToggle}
            title={minimized ? '展开' : '最小化'}
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            title="关闭面板"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!minimized && (
        <div className="space-y-3 p-3">
          <div
            className="flex items-center gap-2 rounded-lg border bg-muted/15 px-2 py-1.5 text-[11px] text-muted-foreground"
            title={batch.saveDir}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate font-mono">{batch.saveDir}</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {isRunning && '下载中'}
                {isPaused && '已暂停'}
                {batch.status === 'completed' && '已完成'}
                {batch.status === 'cancelled' && '已取消'}
              </span>
              <span>{stats.overallProgress}%</span>
            </div>
            <Progress value={stats.overallProgress} className="h-2" />
            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span>成功 {stats.completed}</span>
              <span>失败 {stats.failed}</span>
              <span>进行中 {stats.active}</span>
              {stats.totalBytes > 0 && (
                <span>
                  {formatBytes(stats.downloadedBytes)} / {formatBytes(stats.totalBytes)}
                </span>
              )}
            </div>
          </div>

          <div className="max-h-[220px] space-y-1.5 overflow-y-auto rounded-lg border p-2">
            {visibleTasks.map((task) => (
              <div key={task.id} className="rounded-md bg-muted/20 px-2 py-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{task.filename}</div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {task.materialId}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {task.status === 'downloading' && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    )}
                    {task.status === 'completed' && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    )}
                    {task.status === 'failed' && (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                  </div>
                </div>
                {(task.status === 'downloading' || task.status === 'pending') && (
                  <Progress value={task.progress} className="mt-1.5 h-1" />
                )}
                {task.error && (
                  <div className="mt-1 truncate text-[10px] text-destructive">{task.error}</div>
                )}
              </div>
            ))}
            {hiddenTaskCount > 0 && (
              <div className="rounded-md bg-muted/10 px-2 py-1.5 text-center text-[11px] text-muted-foreground">
                已折叠 {hiddenTaskCount} 条任务，优先显示下载中、失败和待下载任务
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {isRunning && (
              <Button type="button" variant="outline" size="sm" onClick={onPause}>
                <Pause className="mr-1 h-3.5 w-3.5" />
                暂停
              </Button>
            )}
            {isPaused && (
              <Button type="button" variant="outline" size="sm" onClick={onResume}>
                <Play className="mr-1 h-3.5 w-3.5" />
                继续
              </Button>
            )}
            {(isRunning || isPaused) && (
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                取消
              </Button>
            )}
            {canRetry && (
              <Button type="button" variant="outline" size="sm" onClick={onRetryFailed}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                重试失败
              </Button>
            )}
            {canClearCompleted && (
              <Button type="button" variant="outline" size="sm" onClick={onClearCompleted}>
                清空已完成
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={onOpenFolder}>
              <FolderOpen className="mr-1 h-3.5 w-3.5" />
              打开目录
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function useVideoDownloadPanel(): {
  batch: VideoDownloadBatchState | null
  visible: boolean
  minimized: boolean
  setVisible: (value: boolean) => void
  setMinimized: React.Dispatch<React.SetStateAction<boolean>>
  refreshState: () => Promise<void>
} {
  const [batch, setBatch] = useState<VideoDownloadBatchState | null>(null)
  const [visible, setVisible] = useState(false)
  const [minimized, setMinimized] = useState(false)

  const refreshState = useCallback(async (): Promise<void> => {
    if (!window.api?.videoDownload?.getState) return
    const state = await window.api.videoDownload.getState()
    setBatch(state)
    if (state) setVisible(true)
  }, [])

  useEffect(() => {
    void refreshState()
    const unsubscribe = window.api?.videoDownload?.onStateChanged?.((state) => {
      setBatch(state)
      if (state) setVisible(true)
    })
    return () => unsubscribe?.()
  }, [refreshState])

  return {
    batch,
    visible,
    minimized,
    setVisible,
    setMinimized,
    refreshState
  }
}
