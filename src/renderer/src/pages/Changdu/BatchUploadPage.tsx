import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  CheckCircle,
  FileVideo,
  Loader2,
  Sparkles,
  Upload,
  X,
  XCircle
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Label
} from '../../components/ui'
import { configService } from '../../services/config.service'
import { changduService } from '../../services/changdu.service'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

export const ChangduBatchUploadPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<
    Array<{ message: string; type: 'info' | 'success' | 'error'; timestamp: Date }>
  >([])
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async (): Promise<void> => {
    setLoading(true)
    try {
      const changduConfigs = await configService.getConfigsBySource(3)
      setConfigs(changduConfigs)
      if (changduConfigs.length > 0 && !selectedConfigId) {
        setSelectedConfigId(changduConfigs[0].id)
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
      setError('加载配置失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info'): void => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }])
  }

  const clearLogs = (): void => {
    setLogs([])
  }

  const handleSelectFiles = async (): Promise<void> => {
    if (!window.api?.selectVideoFiles) {
      addLog('文件选择仅在 Electron 应用中可用', 'error')
      return
    }
    try {
      const result = await window.api.selectVideoFiles()
      if (!result.canceled && result.filePaths?.length) {
        setSelectedFiles(result.filePaths)
        addLog(`已选择 ${result.filePaths.length} 个视频`, 'info')
      }
    } catch (err) {
      addLog(`选择文件失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error')
    }
  }

  const handleRemoveFile = (index: number): void => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个常读账号配置')
      return
    }

    if (selectedFiles.length === 0) {
      setError('请选择要上传的视频文件')
      return
    }

    setIsSubmitting(true)
    setError('')
    clearLogs()
    setIsLogPanelOpen(true)

    try {
      addLog(`开始批量上传，共 ${selectedFiles.length} 个视频`, 'info')
      addLog(`使用配置 ID: ${selectedConfigId}`, 'info')

      const response = await changduService.batchUpload({
        config_id: selectedConfigId,
        file_paths: selectedFiles
      })

      addLog(response.message, 'success')
      response.files.forEach((f) => addLog(`  - ${f}`, 'info'))
    } catch (err: unknown) {
      const errorMessage =
        (err as { message?: string })?.message ||
        (err as { detail?: string })?.detail ||
        '上传失败，请稍后重试'
      setError(errorMessage)
      addLog(`错误: ${errorMessage}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Changdu Upload Workspace
              </div>
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-3 text-2xl sm:text-3xl">
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  常读批量视频上传
                </CardTitle>
                <CardDescription className="max-w-2xl">
                  选择常读账号与视频文件后，系统会通过自动化流程完成上传。这个页面现在被整理成更稳定的上传工作台视图。
                </CardDescription>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  账号配置
                </p>
                <p className="mt-2 text-lg font-semibold">{configs.length}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  待上传文件
                </p>
                <p className="mt-2 text-lg font-semibold">{selectedFiles.length}</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">上传配置</CardTitle>
          <CardDescription>选择账号、挑选文件并查看执行日志。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 账号配置选择 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">选择常读账号配置 *</Label>
            {loading ? (
              <div className="flex justify-center items-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : configs.length === 0 ? (
              <div className="p-4 text-center rounded-md border text-muted-foreground">
                暂无常读配置，请先在配置中心添加常读账号的 Cookie
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                {configs.map((config) => (
                  <motion.div
                    key={config.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`rounded-2xl border p-4 cursor-pointer transition-all ${
                      selectedConfigId === config.id
                        ? 'border-primary/40 bg-primary/5 shadow-sm'
                        : 'border-border/70 bg-background/70 hover:border-primary/30 hover:bg-accent/30'
                    }`}
                    onClick={() => setSelectedConfigId(config.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex flex-1 gap-3 items-center min-w-0">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                            selectedConfigId === config.id
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground/30'
                          }`}
                        >
                          {selectedConfigId === config.id && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{config.cookie_name}</div>
                          {config.realname && (
                            <div className="text-sm truncate text-muted-foreground">
                              {config.realname}
                            </div>
                          )}
                        </div>
                      </div>
                      {selectedConfigId === config.id && (
                        <CheckCircle className="flex-shrink-0 ml-2 w-5 h-5 text-primary" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* 选择视频文件 */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">选择要上传的视频 *</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSelectFiles}
                disabled={!window.api?.selectVideoFiles}
              >
                <FileVideo className="mr-2 w-4 h-4" />
                选择视频文件
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              支持格式: .mp4, .mpeg, .3gp, .avi, .m4v，单个文件需小于 500MB
            </p>
            {selectedFiles.length > 0 && (
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-2xl border border-border/70 bg-background/70 p-3">
                {selectedFiles.map((path, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 py-1 text-sm font-mono truncate"
                  >
                    <span className="flex-1 truncate" title={path}>
                      {path.split(/[/\\]/).pop()}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 shrink-0"
                      onClick={() => handleRemoveFile(idx)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="flex gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || configs.length === 0 || selectedFiles.length === 0}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                上传中...
              </>
            ) : (
              <>
                <Upload className="mr-2 w-4 h-4" />
                开始批量上传
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 日志面板 */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setIsLogPanelOpen(!isLogPanelOpen)}
        >
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            执行日志
          </CardTitle>
          <CardDescription>{isLogPanelOpen ? '点击收起' : '点击展开'}</CardDescription>
        </CardHeader>
        {isLogPanelOpen && (
          <CardContent>
            <div className="max-h-64 overflow-y-auto rounded-2xl border border-border/70 bg-muted/30 p-3 font-mono text-sm">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">暂无日志</p>
              ) : (
                logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`py-0.5 ${
                      log.type === 'error'
                        ? 'text-destructive'
                        : log.type === 'success'
                          ? 'text-emerald-600'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {log.message}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
