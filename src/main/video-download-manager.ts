import { createWriteStream, existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import type { BrowserWindow } from 'electron'

export type VideoDownloadTaskStatus =
  | 'pending'
  | 'downloading'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface VideoDownloadTaskInput {
  id: string
  materialId: string
  videoId: string
  title?: string
  filename?: string
  url: string
}

export interface VideoDownloadTaskState {
  id: string
  materialId: string
  videoId: string
  filename: string
  status: VideoDownloadTaskStatus
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
  proxyConfig?: VideoDownloadProxyConfig
}

const DEFAULT_CONCURRENCY = 3
const MAX_FILENAME_LENGTH = 120
const VIDEO_DOWNLOAD_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const VIDEO_DOWNLOAD_REFERERS = [
  'https://business.oceanengine.com/',
  'https://ad.oceanengine.com/',
  'https://www.oceanengine.com/'
]
const DOWNLOAD_STATE_EMIT_INTERVAL_MS = 250

export interface VideoDownloadProxyConfig {
  apiBaseUrl: string
  authToken: string
  configId: number
}

function buildCdnDownloadHeaders(referer: string): Record<string, string> {
  return {
    'User-Agent': VIDEO_DOWNLOAD_USER_AGENT,
    Referer: referer,
    Accept: '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9'
  }
}

function buildProxyDownloadRequest(
  sourceUrl: string,
  proxy: VideoDownloadProxyConfig
): { url: string; headers: Record<string, string> } {
  const query = new URLSearchParams({
    config_id: String(proxy.configId),
    url: sourceUrl
  })
  const baseUrl = proxy.apiBaseUrl.replace(/\/$/, '')
  return {
    url: `${baseUrl}/api/v1/ocean-engine/video-analysis/proxy-download?${query.toString()}`,
    headers: {
      Authorization: `Bearer ${proxy.authToken}`,
      Accept: '*/*'
    }
  }
}

async function fetchVideoResponse(
  sourceUrl: string,
  signal: AbortSignal,
  proxy?: VideoDownloadProxyConfig
): Promise<Response> {
  if (proxy?.authToken) {
    const request = buildProxyDownloadRequest(sourceUrl, proxy)
    const response = await fetch(request.url, {
      signal,
      headers: request.headers
    })
    if (response.ok) return response
    let detail = `HTTP ${response.status}`
    try {
      const text = await response.text()
      if (text) detail = text.slice(0, 240)
    } catch {
      // ignore
    }
    throw new Error(detail)
  }

  let lastStatus = 0
  for (const referer of VIDEO_DOWNLOAD_REFERERS) {
    const response = await fetch(sourceUrl, {
      signal,
      headers: buildCdnDownloadHeaders(referer),
      redirect: 'follow'
    })
    if (response.ok) return response
    lastStatus = response.status
    if (response.status !== 403) {
      throw new Error(`HTTP ${response.status}`)
    }
  }
  throw new Error(`HTTP ${lastStatus || 403}`)
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\r\n]/g, '_').trim()
  return cleaned.slice(0, MAX_FILENAME_LENGTH) || 'video'
}

function buildBaseFilename(task: VideoDownloadTaskInput): string {
  if (task.filename?.trim()) {
    return sanitizeFilename(task.filename)
  }
  const titlePart = task.title ? sanitizeFilename(task.title) : sanitizeFilename(task.videoId)
  return `${task.materialId}_${titlePart}.mp4`
}

function resolveUniqueFilePath(saveDir: string, filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  const hasExtension = dotIndex > 0 && dotIndex < filename.length - 1
  const base = hasExtension ? filename.slice(0, dotIndex) : filename
  const ext = hasExtension ? filename.slice(dotIndex) : '.mp4'
  let candidate = join(saveDir, filename)
  if (!existsSync(candidate)) return candidate

  for (let index = 1; index < 1000; index += 1) {
    candidate = join(saveDir, `${base}_${index}${ext}`)
    if (!existsSync(candidate)) return candidate
  }
  return join(saveDir, `${base}_${Date.now()}${ext}`)
}

class VideoDownloadManager {
  private mainWindow: BrowserWindow | null = null
  private batch: VideoDownloadBatchState | null = null
  private paused = false
  private cancelled = false
  private activeControllers = new Map<string, AbortController>()
  private taskInputs = new Map<string, VideoDownloadTaskInput>()
  private runningCount = 0
  private emitTimer: NodeJS.Timeout | null = null

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  getState(): VideoDownloadBatchState | null {
    return this.batch ? { ...this.batch, tasks: [...this.batch.tasks] } : null
  }

  private emitState(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    this.mainWindow.webContents.send('video-download:state-changed', this.getState())
  }

  private emitStateThrottled(): void {
    if (this.emitTimer) return
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null
      this.emitState()
    }, DOWNLOAD_STATE_EMIT_INTERVAL_MS)
  }

  private updateTask(
    taskId: string,
    patch: Partial<VideoDownloadTaskState>,
    options?: { throttle?: boolean }
  ): void {
    if (!this.batch) return
    const index = this.batch.tasks.findIndex((task) => task.id === taskId)
    if (index < 0) return
    this.batch.tasks[index] = { ...this.batch.tasks[index], ...patch }
    if (options?.throttle) {
      this.emitStateThrottled()
    } else {
      this.emitState()
    }
  }

  private refreshBatchStatus(): void {
    if (!this.batch) return
    const tasks = this.batch.tasks
    const hasActive = tasks.some(
      (task) => task.status === 'pending' || task.status === 'downloading'
    )
    if (this.cancelled) {
      this.batch.status = 'cancelled'
    } else if (this.paused && hasActive) {
      this.batch.status = 'paused'
    } else if (!hasActive) {
      this.batch.status = 'completed'
    } else {
      this.batch.status = 'running'
    }
    this.emitState()
  }

  async startBatch(payload: {
    saveDir: string
    tasks: VideoDownloadTaskInput[]
    concurrency?: number
    proxyConfig?: VideoDownloadProxyConfig
  }): Promise<{ ok: true; batchId: string } | { ok: false; error: string }> {
    const saveDir = payload.saveDir?.trim()
    if (!saveDir) {
      return { ok: false, error: '保存目录不能为空' }
    }
    if (!payload.tasks?.length) {
      return { ok: false, error: '没有可下载的任务' }
    }

    const hasRunning = this.batch?.tasks.some(
      (task) => task.status === 'pending' || task.status === 'downloading'
    )
    if (hasRunning) {
      return { ok: false, error: '已有下载任务进行中，请先取消或等待完成' }
    }

    await mkdir(saveDir, { recursive: true })

    this.paused = false
    this.cancelled = false
    this.activeControllers.clear()
    this.taskInputs = new Map(payload.tasks.map((task) => [task.id, task]))
    this.runningCount = 0

    const batchId = `batch-${Date.now()}`
    this.batch = {
      batchId,
      saveDir,
      status: 'running',
      concurrency: Math.min(Math.max(payload.concurrency || DEFAULT_CONCURRENCY, 1), 8),
      startedAt: Date.now(),
      proxyConfig: payload.proxyConfig,
      tasks: payload.tasks.map((task) => ({
        id: task.id,
        materialId: task.materialId,
        videoId: task.videoId,
        filename: buildBaseFilename(task),
        status: 'pending',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0
      }))
    }
    this.emitState()

    void this.runQueue(payload.tasks)
    return { ok: true, batchId }
  }

  appendTasks(payload: { tasks: VideoDownloadTaskInput[] }): { ok: boolean; error?: string } {
    if (!this.batch) return { ok: false, error: '当前没有下载任务' }
    if (!payload.tasks?.length) return { ok: false, error: '没有可追加的任务' }

    const existingIds = new Set(this.batch.tasks.map((task) => task.id))
    const tasks = payload.tasks.filter((task) => task.id && task.url && !existingIds.has(task.id))
    if (tasks.length === 0) return { ok: false, error: '没有新的下载任务' }

    this.batch.tasks.push(
      ...tasks.map((task) => ({
        id: task.id,
        materialId: task.materialId,
        videoId: task.videoId,
        filename: buildBaseFilename(task),
        status: 'pending' as const,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0
      }))
    )
    tasks.forEach((task) => this.taskInputs.set(task.id, task))
    this.cancelled = false
    if (this.batch.status === 'completed') {
      this.batch.status = 'running'
    }
    this.emitState()
    void this.runQueue(tasks)
    return { ok: true }
  }

  clearCompleted(): { ok: boolean; error?: string; removed?: number } {
    if (!this.batch) return { ok: false, error: '当前没有下载任务' }
    const completedIds = new Set(
      this.batch.tasks.filter((task) => task.status === 'completed').map((task) => task.id)
    )
    if (completedIds.size === 0) return { ok: false, error: '没有已完成的下载记录' }

    this.batch.tasks = this.batch.tasks.filter((task) => !completedIds.has(task.id))
    completedIds.forEach((id) => this.taskInputs.delete(id))
    this.refreshBatchStatus()
    return { ok: true, removed: completedIds.size }
  }

  pause(): { ok: boolean; error?: string } {
    if (!this.batch) return { ok: false, error: '当前没有下载任务' }
    this.paused = true
    this.refreshBatchStatus()
    return { ok: true }
  }

  resume(): { ok: boolean; error?: string } {
    if (!this.batch) return { ok: false, error: '当前没有下载任务' }
    this.paused = false
    this.refreshBatchStatus()
    void this.pumpQueue()
    return { ok: true }
  }

  cancel(): { ok: boolean; error?: string } {
    if (!this.batch) return { ok: false, error: '当前没有下载任务' }
    this.cancelled = true
    this.paused = false
    for (const controller of this.activeControllers.values()) {
      controller.abort()
    }
    this.activeControllers.clear()
    for (const task of this.batch.tasks) {
      if (task.status === 'pending') {
        task.status = 'cancelled'
        task.progress = 0
      } else if (task.status === 'downloading') {
        task.status = 'cancelled'
      }
    }
    this.refreshBatchStatus()
    return { ok: true }
  }

  retryFailed(payload: { tasks: VideoDownloadTaskInput[] }): { ok: boolean; error?: string } {
    if (!this.batch) return { ok: false, error: '当前没有下载任务' }
    if (!payload.tasks.length) return { ok: false, error: '没有可重试的任务' }

    const taskMap = new Map(payload.tasks.map((task) => [task.id, task]))
    payload.tasks.forEach((task) => this.taskInputs.set(task.id, task))
    for (const task of this.batch.tasks) {
      if (task.status !== 'failed') continue
      const input = taskMap.get(task.id)
      if (!input?.url) continue
      task.status = 'pending'
      task.progress = 0
      task.downloadedBytes = 0
      task.totalBytes = 0
      task.error = undefined
      task.filePath = undefined
      task.filename = buildBaseFilename(input)
    }

    this.cancelled = false
    this.paused = false
    this.refreshBatchStatus()
    void this.runQueue(payload.tasks)
    return { ok: true }
  }

  private async runQueue(inputs?: VideoDownloadTaskInput[]): Promise<void> {
    inputs?.forEach((task) => this.taskInputs.set(task.id, task))
    await this.pumpQueue()
    this.refreshBatchStatus()
  }

  private async pumpQueue(): Promise<void> {
    if (!this.batch || this.cancelled) return

    while (!this.paused && !this.cancelled && this.runningCount < this.batch.concurrency) {
      const nextTask = this.batch.tasks.find((task) => task.status === 'pending')
      if (!nextTask) break

      const input = this.taskInputs.get(nextTask.id)
      if (!input?.url) {
        this.updateTask(nextTask.id, {
          status: 'failed',
          error: '缺少下载地址'
        })
        continue
      }

      this.runningCount += 1
      void this.downloadOne(nextTask.id, input).finally(() => {
        this.runningCount -= 1
        void this.pumpQueue()
        this.refreshBatchStatus()
      })
    }
  }

  private async downloadOne(taskId: string, input: VideoDownloadTaskInput): Promise<void> {
    if (!this.batch || this.cancelled) return

    const controller = new AbortController()
    this.activeControllers.set(taskId, controller)

    const filePath = resolveUniqueFilePath(this.batch.saveDir, buildBaseFilename(input))
    this.updateTask(taskId, {
      status: 'downloading',
      filename: filePath.split(/[\\/]/).pop() || buildBaseFilename(input),
      filePath,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      error: undefined
    })

    try {
      const response = await fetchVideoResponse(
        input.url,
        controller.signal,
        this.batch?.proxyConfig
      )
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const totalBytes = Number(response.headers.get('content-length') || 0)
      if (totalBytes > 0) {
        this.updateTask(taskId, { totalBytes })
      }

      const body = response.body
      if (!body) {
        throw new Error('响应体为空')
      }

      const nodeStream = Readable.fromWeb(body as import('stream/web').ReadableStream)
      const fileStream = createWriteStream(filePath)
      let downloadedBytes = 0

      nodeStream.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length
        const progress =
          totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0
        this.updateTask(
          taskId,
          {
            downloadedBytes,
            totalBytes: totalBytes || downloadedBytes,
            progress
          },
          { throttle: true }
        )
      })

      await pipeline(nodeStream, fileStream)

      if (this.cancelled) {
        this.updateTask(taskId, { status: 'cancelled' })
        return
      }

      this.updateTask(taskId, {
        status: 'completed',
        progress: 100,
        downloadedBytes,
        totalBytes: totalBytes || downloadedBytes,
        filePath
      })
    } catch (error) {
      if (controller.signal.aborted || this.cancelled) {
        this.updateTask(taskId, { status: 'cancelled' })
      } else {
        const message = error instanceof Error ? error.message : String(error)
        this.updateTask(taskId, { status: 'failed', error: message })
      }
    } finally {
      this.activeControllers.delete(taskId)
    }
  }
}

export const videoDownloadManager = new VideoDownloadManager()
