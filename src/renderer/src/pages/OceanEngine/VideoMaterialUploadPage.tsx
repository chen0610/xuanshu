import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Upload } from 'lucide-react'
import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem
} from '../../components/ui'
import { cn } from '../../lib/utils'
import { oceanEngineOAuthService } from '../../services/ocean-engine-oauth.service'
import { videoMaterialService } from '../../services/ocean-engine.service'
import type { OceanEngineOAuthToken } from '../../types/ocean-engine-oauth.types'
import { toast } from 'sonner'

/** 与 <label htmlFor> 绑定，避免 Electron 下对 file 执行 programmatic click() 不弹窗 */
const FILE_INPUT_ID = 'oe-video-material-upload-input'
const FOLDER_INPUT_ID = 'oe-video-material-upload-folder'

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mpeg', '.mpg', '.3gp', '.avi', '.m4v'])
const FIXED_UPLOAD_CONCURRENCY = 3
const PROGRESS_UPDATE_INTERVAL_MS = 200

function getFileLowerExtension(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true
  return VIDEO_EXTENSIONS.has(getFileLowerExtension(file.name))
}

function getDisplayPath(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  return rel && rel.length > 0 ? rel : file.name
}

type TaskStatus = 'pending' | 'uploading' | 'success' | 'error'
type UploadTarget = 'advertiser' | 'ebp'

interface UploadTaskItem {
  id: string
  file: File
  /** 来自文件夹选择时为相对路径，便于区分子目录中同名文件 */
  displayPath: string
  status: TaskStatus
  progress: number
  videoId?: string
  materialId?: string
  message?: string
}

/** 固定并发池：同时最多 `concurrency` 个上传任务 */
async function runUploadPool(
  items: UploadTaskItem[],
  concurrency: number,
  worker: (item: UploadTaskItem) => Promise<void>,
  shouldStop?: () => boolean
): Promise<void> {
  if (items.length === 0) return
  const n = Math.max(1, Math.min(concurrency, items.length))
  let cursor = 0
  const runWorker = async (): Promise<void> => {
    while (true) {
      if (shouldStop?.()) return
      const idx = cursor++
      if (idx >= items.length) return
      await worker(items[idx])
    }
  }
  await Promise.all(Array.from({ length: n }, () => runWorker()))
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export const VideoMaterialUploadPage: React.FC = () => {
  const [tokens, setTokens] = useState<OceanEngineOAuthToken[]>([])
  const [loadingTokens, setLoadingTokens] = useState(true)
  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set())
  const [uploadTarget, setUploadTarget] = useState<UploadTarget>('advertiser')
  const [accountId, setAccountId] = useState('')
  const [isAigc, setIsAigc] = useState(false)
  const [tasks, setTasks] = useState<UploadTaskItem[]>([])
  const [batchRunning, setBatchRunning] = useState(false)
  const [uploadPaused, setUploadPaused] = useState(false)
  const uploadPausedRef = useRef(false)
  const lastProgressRef = useRef<Map<string, { progress: number; updatedAt: number }>>(new Map())

  useEffect(() => {
    const load = async (): Promise<void> => {
      setLoadingTokens(true)
      try {
        const res = await oceanEngineOAuthService.getTokens(true)
        setTokens(res.items ?? [])
      } catch {
        toast.error('加载已授权组织账户失败')
      } finally {
        setLoadingTokens(false)
      }
    }
    void load()
  }, [])

  const uniqueOrgTokens = useMemo(() => {
    const grouped = new Map<string, OceanEngineOAuthToken[]>()
    for (const token of tokens) {
      const existing = grouped.get(token.advertiser_id)
      if (existing) existing.push(token)
      else grouped.set(token.advertiser_id, [token])
    }
    return Array.from(grouped.values()).map((group) => {
      const primary = group[0]
      const appCodes = Array.from(new Set(group.map((item) => item.app_code))).sort()
      return {
        advertiser_id: primary.advertiser_id,
        advertiser_name: primary.advertiser_name || primary.advertiser_id,
        appCodes
      }
    })
  }, [tokens])

  const selectOrg = (orgId: string): void => {
    setSelectedOrgIds(new Set([orgId]))
  }

  const clearSelectedOrg = (): void => {
    setSelectedOrgIds(new Set())
  }

  const orgForUpload = Array.from(selectedOrgIds)[0] ?? ''
  const targetName = uploadTarget === 'advertiser' ? '广告主素材库' : '组织素材库'
  const targetAccountLabel = uploadTarget === 'advertiser' ? '广告主 ID' : '组织 ID'
  const targetAccountPlaceholder =
    uploadTarget === 'advertiser' ? '填写目标广告主 ID' : '填写组织 ID'

  const updateTask = (id: string, patch: Partial<UploadTaskItem>): void => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const hasChanged = Object.entries(patch).some(
          ([key, value]) => t[key as keyof UploadTaskItem] !== value
        )
        return hasChanged ? { ...t, ...patch } : t
      })
    )
  }

  const updateTaskProgress = (id: string, progress: number, force = false): void => {
    const currentProgress = Math.max(0, Math.min(100, progress))
    const now = Date.now()
    const last = lastProgressRef.current.get(id)
    if (
      !force &&
      last &&
      last.progress === currentProgress &&
      now - last.updatedAt < PROGRESS_UPDATE_INTERVAL_MS
    ) {
      return
    }
    if (
      !force &&
      last &&
      now - last.updatedAt < PROGRESS_UPDATE_INTERVAL_MS &&
      currentProgress < 100
    ) {
      return
    }
    lastProgressRef.current.set(id, { progress: currentProgress, updatedAt: now })
    updateTask(id, { progress: currentProgress })
  }

  const appendVideoTasks = (files: File[]): void => {
    if (!files.length) return
    const next: UploadTaskItem[] = files.map((file, i) => ({
      id: `${Date.now()}-${i}-${file.name}-${file.size}`,
      file,
      displayPath: getDisplayPath(file),
      status: 'pending',
      progress: 0
    }))
    setTasks((prev) => [...prev, ...next])
    toast.success(`已添加 ${next.length} 个视频文件`)
  }

  const onFilesPicked = (e: React.ChangeEvent<HTMLInputElement>): void => {
    // Array.from 先将 FileList 复制为普通数组，再清空 input
    // Electron(Chromium) 下 e.target.value='' 会就地清空 FileList 对象，
    // 若先清空再读取则 list 为空，导致界面无反应
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    appendVideoTasks(files)
  }

  const onFolderPicked = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const raw = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!raw.length) return
    const videos = raw.filter(isVideoFile)
    const skipped = raw.length - videos.length
    if (!videos.length) {
      toast.error('所选目录下没有符合格式的视频（支持 mp4 / mpeg / mpg / 3gp / avi / m4v）')
      return
    }
    appendVideoTasks(videos)
    if (skipped > 0) {
      toast.message(`已跳过 ${skipped} 个非视频文件`)
    }
  }

  const clearTasks = (): void => {
    if (batchRunning) return
    setTasks([])
    lastProgressRef.current.clear()
  }

  const removeTask = (id: string): void => {
    if (batchRunning) return
    lastProgressRef.current.delete(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const retryFailed = (): void => {
    if (batchRunning) return
    const failed = tasks.filter((t) => t.status === 'error')
    if (failed.length === 0) {
      toast.error('没有失败项可重试')
      return
    }
    for (const task of failed) {
      lastProgressRef.current.delete(task.id)
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.status === 'error'
          ? { ...t, status: 'pending' as TaskStatus, progress: 0, message: undefined }
          : t
      )
    )
    void startBatchUpload(failed.map((t) => t.id))
  }

  const pauseBatchUpload = (): void => {
    if (!batchRunning || uploadPaused) return
    uploadPausedRef.current = true
    setUploadPaused(true)
    toast.message('已暂停，将在当前上传中的任务结束后停止继续上传')
  }

  const startBatchUpload = async (taskIds?: string[]): Promise<void> => {
    const orgId = orgForUpload.trim()
    const account = accountId.trim()
    if (batchRunning) {
      toast.error('当前已有上传任务在进行中')
      return
    }
    if (!orgId) {
      toast.error('请至少选择一个授权来源组织账户')
      return
    }
    if (!account) {
      toast.error(`请填写${targetAccountLabel}`)
      return
    }
    const taskIdSet = taskIds ? new Set(taskIds) : undefined
    const pending = tasks.filter(
      (t) => t.status === 'pending' && (!taskIdSet || taskIdSet.has(t.id))
    )
    if (pending.length === 0) {
      toast.error('没有待上传的文件（请添加文件或重试失败项）')
      return
    }
    const conc = FIXED_UPLOAD_CONCURRENCY
    uploadPausedRef.current = false
    setUploadPaused(false)
    setBatchRunning(true)
    let ok = 0
    try {
      await runUploadPool(
        pending,
        conc,
        async (task) => {
          lastProgressRef.current.delete(task.id)
          updateTask(task.id, { status: 'uploading', progress: 0, message: undefined })
          try {
            const res =
              uploadTarget === 'advertiser'
                ? await videoMaterialService.uploadVideoMaterial(
                    {
                      org_advertiser_id: orgId,
                      advertiser_id: account,
                      file: task.file,
                      is_aigc: isAigc ? true : undefined
                    },
                    {
                      onUploadProgress: (p) => updateTaskProgress(task.id, p)
                    }
                  )
                : await videoMaterialService.uploadEbpVideoMaterial(
                    {
                      org_advertiser_id: orgId,
                      account_id: account,
                      file: task.file,
                      is_aigc: isAigc ? true : undefined
                    },
                    {
                      onUploadProgress: (p) => updateTaskProgress(task.id, p)
                    }
                  )
            if (res.code === 0) {
              ok += 1
              updateTaskProgress(task.id, 100, true)
              updateTask(task.id, {
                status: 'success',
                videoId: res.data?.video_id,
                materialId: res.data?.material_id == null ? undefined : String(res.data.material_id)
              })
            } else {
              lastProgressRef.current.delete(task.id)
              updateTask(task.id, {
                status: 'error',
                message: res.message ?? res.msg ?? `错误码 ${res.code}`
              })
            }
          } catch (err) {
            lastProgressRef.current.delete(task.id)
            updateTask(task.id, {
              status: 'error',
              message: err instanceof Error ? err.message : '上传失败'
            })
          }
        },
        () => uploadPausedRef.current
      )
      toast.success(`本轮结束：成功 ${ok} / ${pending.length}（并发 ${conc}）`)
    } finally {
      uploadPausedRef.current = false
      setUploadPaused(false)
      setBatchRunning(false)
    }
  }

  const successCount = tasks.filter((t) => t.status === 'success').length
  const errorCount = tasks.filter((t) => t.status === 'error').length
  const pendingCount = tasks.filter((t) => t.status === 'pending').length
  const canPauseUpload = batchRunning && !uploadPaused

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <motion.section
        className="relative overflow-hidden rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.58)] sm:p-8"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_58%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-3 items-start">
            <div className="p-3 rounded-2xl border border-border/70 bg-background/70">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">巨量素材上传</h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                支持上传到广告主素材库（2/file/video/ad）或升级版工作台素材库
                （v3.0/tools/ebp/video/upload）；单文件 ≤500MB，可多选文件或选择文件夹并发上传。
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      <Card>
        <CardHeader>
          <CardTitle>授权与目标账户</CardTitle>
          <CardDescription>
            选择一个组织账户作为 Token 来源。当前目标：
            <span className="font-medium text-foreground">{targetName}</span>。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingTokens ? (
            <div className="flex gap-2 items-center text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              加载授权列表…
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label>Token 来源组织</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    选择一个已授权组织账户用于本次上传。
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!orgForUpload}
                  onClick={clearSelectedOrg}
                >
                  清空选择
                </Button>
              </div>
              <RadioGroup
                value={orgForUpload}
                onValueChange={selectOrg}
                className="grid gap-2 sm:grid-cols-2"
              >
                {uniqueOrgTokens.map((item) => (
                  <label
                    key={item.advertiser_id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:ring-1 has-[:checked]:ring-primary"
                  >
                    <RadioGroupItem value={item.advertiser_id} className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.advertiser_name}</span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {item.advertiser_id}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </>
          )}
          <div className="space-y-2">
            <Label>上传目标</Label>
            <RadioGroup
              value={uploadTarget}
              onValueChange={(value) => setUploadTarget(value as UploadTarget)}
              className="grid gap-2 sm:grid-cols-2"
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:ring-1 has-[:checked]:ring-primary">
                <RadioGroupItem value="advertiser" className="mt-0.5" />
                <span>
                  <span className="block font-medium">广告主素材库</span>
                  <span className="block text-xs text-muted-foreground">
                    原巨量素材直传，素材归属广告主
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:ring-1 has-[:checked]:ring-primary">
                <RadioGroupItem value="ebp" className="mt-0.5" />
                <span>
                  <span className="block font-medium">工作台素材库</span>
                  <span className="block text-xs text-muted-foreground">
                    升级版工作台上传，素材归属组织维度
                  </span>
                </span>
              </label>
            </RadioGroup>
          </div>
          <div className="space-y-1">
            <Label>{targetAccountLabel}</Label>
            <Input
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder={targetAccountPlaceholder}
              className="font-mono text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={isAigc} onCheckedChange={(v) => setIsAigc(v === true)} />
            <span>标记为 AIGC 素材（is_aigc）</span>
          </label>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>文件队列</CardTitle>
              <CardDescription>
                可多选文件或选择文件夹（递归子目录）加入队列；点击开始批量上传仅处理「待上传」项。成功{' '}
                {successCount} / 失败 {errorCount} / 待传 {pendingCount}
                {uploadPaused && ' / 已暂停，等待当前上传结束'}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                id={FILE_INPUT_ID}
                type="file"
                multiple
                accept=".mp4,.mpeg,.mpg,.3gp,.avi,.m4v,video/*"
                className="sr-only"
                aria-label="选择本地视频文件"
                tabIndex={-1}
                onChange={(e) => void onFilesPicked(e)}
              />
              {/* webkitdirectory：Chromium 选目录后 FileList 含子目录下全部文件；DOM 属性名小写 */}
              <input
                id={FOLDER_INPUT_ID}
                type="file"
                multiple
                className="sr-only"
                aria-label="选择视频所在文件夹（含子文件夹）"
                tabIndex={-1}
                onChange={(e) => void onFolderPicked(e)}
                {...({ webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
              />
              {batchRunning ? (
                <span
                  className={cn(
                    buttonVariants({ variant: 'secondary', size: 'sm' }),
                    'cursor-not-allowed opacity-50'
                  )}
                >
                  添加文件
                </span>
              ) : (
                <label
                  htmlFor={FILE_INPUT_ID}
                  className={cn(
                    buttonVariants({ variant: 'secondary', size: 'sm' }),
                    'cursor-pointer'
                  )}
                >
                  添加文件
                </label>
              )}
              {batchRunning ? (
                <span
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'cursor-not-allowed opacity-50'
                  )}
                >
                  选择文件夹
                </span>
              ) : (
                <label
                  htmlFor={FOLDER_INPUT_ID}
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'cursor-pointer'
                  )}
                >
                  选择文件夹
                </label>
              )}
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={batchRunning || pendingCount === 0}
                onClick={() => void startBatchUpload()}
              >
                {batchRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    {uploadPaused ? '暂停中…' : '上传中…'}
                  </>
                ) : (
                  '开始批量上传'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canPauseUpload}
                onClick={pauseBatchUpload}
              >
                暂停上传
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={batchRunning || errorCount === 0}
                onClick={retryFailed}
              >
                重试失败项
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={batchRunning}
                onClick={clearTasks}
              >
                清空队列
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              batchRunning ? (
                <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  上传进行中，请稍候再添加文件…
                </div>
              ) : (
                <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground space-y-2">
                  <p>
                    点击{' '}
                    <label
                      htmlFor={FILE_INPUT_ID}
                      className="cursor-pointer text-primary underline-offset-2 hover:underline"
                    >
                      选择视频文件
                    </label>{' '}
                    或{' '}
                    <label
                      htmlFor={FOLDER_INPUT_ID}
                      className="cursor-pointer text-primary underline-offset-2 hover:underline"
                    >
                      选择文件夹
                    </label>
                    （含子文件夹）；支持一次多选；单文件不超过 500MB。
                  </p>
                </div>
              )
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">文件名</th>
                      <th className="px-3 py-2 font-medium w-24">大小</th>
                      <th className="px-3 py-2 font-medium">状态</th>
                      <th className="px-3 py-2 font-medium w-40">进度</th>
                      <th className="px-3 py-2 font-medium">video_id / material_id / 说明</th>
                      <th className="px-3 py-2 w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr key={t.id} className="border-b last:border-0">
                        <td
                          className="px-3 py-2 max-w-[280px] truncate font-mono text-xs"
                          title={t.displayPath}
                        >
                          {t.displayPath}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {formatBytes(t.file.size)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              t.status === 'success'
                                ? 'text-green-600'
                                : t.status === 'error'
                                  ? 'text-destructive'
                                  : t.status === 'uploading'
                                    ? 'text-primary'
                                    : 'text-muted-foreground'
                            }
                          >
                            {t.status === 'pending' && '待上传'}
                            {t.status === 'uploading' && '上传中'}
                            {t.status === 'success' && '成功'}
                            {t.status === 'error' && '失败'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${t.progress}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs break-all">
                          {t.videoId && <span className="font-mono">video_id: {t.videoId}</span>}
                          {t.videoId && t.materialId && (
                            <span className="mx-1 text-muted-foreground">/</span>
                          )}
                          {t.materialId && (
                            <span className="font-mono">material_id: {t.materialId}</span>
                          )}
                          {t.message && <span className="text-destructive">{t.message}</span>}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={batchRunning || t.status === 'uploading'}
                            onClick={() => removeTask(t.id)}
                          >
                            移除
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
