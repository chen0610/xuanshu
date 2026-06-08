import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2, FolderX, X, FileText, XCircle, CheckCircle, AlertTriangle } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Label,
  Textarea
} from '../../components/ui'
import { emptyProjectCleanupService } from '../../services/ocean-engine.service'
import { configService } from '../../services/config.service'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

interface LogEntry {
  message: string
  type: 'info' | 'success' | 'error'
  timestamp: Date
}

export const EmptyProjectCleanupPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [accountIds, setAccountIds] = useState('')
  const [isCleaning, setIsCleaning] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async (): Promise<void> => {
    try {
      const oceanConfigs = await configService.getConfigsBySource(1)
      setConfigs(oceanConfigs)
      if (oceanConfigs.length > 0 && !selectedConfigId) {
        setSelectedConfigId(oceanConfigs[0].id)
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
      addLog('加载配置失败', 'error')
    }
  }

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info'): void => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }])
    setIsLogPanelOpen(true) // 自动展开日志面板
  }

  const clearLogs = (): void => {
    setLogs([])
  }

  const handleCleanup = async (): Promise<void> => {
    if (!selectedConfigId) {
      addLog('请选择Cookie配置', 'error')
      return
    }

    // 验证账户ID列表
    const accountIdList = accountIds
      .split('\n')
      .map((id) => id.trim())
      .filter((id) => id && /^\d+$/.test(id))

    if (accountIdList.length === 0) {
      addLog('请输入至少一个账户ID', 'error')
      return
    }

    setIsCleaning(true)
    clearLogs()
    setIsLogPanelOpen(true) // 自动展开日志面板
    addLog(`开始清理空项目，账户数量: ${accountIdList.length}`, 'info')

    try {
      const response = await emptyProjectCleanupService.cleanup({
        account_ids: accountIdList,
        selected_cookie_id: selectedConfigId
      })

      if (response.code !== 0) {
        throw new Error(response.error || response.msg || '清理失败')
      }

      if (response.data) {
        const { results, summary } = response.data

        // 记录每个账户的处理结果
        results.forEach((result) => {
          if (result.success) {
            addLog(
              `账户 ${result.account_id}: 找到 ${result.project_count} 个空项目，已删除 ${result.deleted_count} 个${result.task_id ? ` (任务ID: ${result.task_id})` : ''}`,
              'success'
            )
          } else {
            addLog(`账户 ${result.account_id}: 处理失败 - ${result.error || '未知错误'}`, 'error')
          }
        })

        // 记录汇总信息
        addLog(
          `清理完成！总计: ${summary.total_accounts} 个账户，找到 ${summary.total_project_count} 个空项目，删除 ${summary.total_deleted_count} 个`,
          'success'
        )
      } else {
        addLog('清理完成', 'success')
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '清理失败'
      addLog(`清理失败: ${errorMessage}`, 'error')
    } finally {
      setIsCleaning(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">空项目清理</h1>
        <p className="text-muted-foreground">
          扫描账户项目与广告，识别无未删除广告的空项目并同步删除（支持多Cookie）
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 左侧：配置区域 */}
        <Card>
          <CardHeader>
            <CardTitle>基本配置</CardTitle>
            <CardDescription>输入需要清理空项目的账户ID列表</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="config">Cookie配置</Label>
              <select
                id="config"
                className="px-3 py-2 w-full rounded-md border bg-background"
                value={selectedConfigId?.toString() || ''}
                onChange={(e) => setSelectedConfigId(parseInt(e.target.value, 10))}
              >
                <option value="">请选择Cookie配置</option>
                {configs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.cookie_name} {config.realname ? `(${config.realname})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountIds">账户ID列表（每行一个）</Label>
              <Textarea
                id="accountIds"
                value={accountIds}
                onChange={(e) => setAccountIds(e.target.value)}
                placeholder="请输入账户ID，每行一个&#10;例如：&#10;123456789&#10;987654321"
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground">
                每行输入一个账户ID，系统将清理这些账户中的空项目
              </p>
            </div>

            <Button
              onClick={handleCleanup}
              disabled={isCleaning || !accountIds.trim() || !selectedConfigId}
              className="w-full"
              size="lg"
            >
              {isCleaning ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  清理中...
                </>
              ) : (
                <>
                  <FolderX className="mr-2 w-4 h-4" />
                  开始清理
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 右侧：说明区域 */}
        <Card>
          <CardHeader>
            <CardTitle>使用说明</CardTitle>
            <CardDescription>了解空项目清理功能的使用方法</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <h3 className="mb-2 text-sm font-semibold">功能说明</h3>
                <p className="text-sm text-muted-foreground">
                  通过项目列表与广告列表比对识别空项目，直接同步删除，不再依赖巨量清理助手的异步任务。
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted">
                <h3 className="mb-2 text-sm font-semibold">使用步骤</h3>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>在左侧文本框中输入账户ID，每行一个</li>
                  <li>点击"开始清理"按钮执行清理操作</li>
                  <li>查看操作日志了解清理进度和结果</li>
                </ol>
              </div>

              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex gap-2 items-start">
                  <AlertTriangle className="flex-shrink-0 mt-0.5 w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                      注意事项
                    </h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      清理操作不可逆，请确认账户ID无误后再执行清理操作。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 浮动操作日志按钮和面板 */}
      {(logs.length > 0 || isCleaning) && (
        <>
          {/* 浮动按钮 */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="fixed right-6 bottom-6 z-50"
          >
            <Button
              onClick={() => setIsLogPanelOpen(!isLogPanelOpen)}
              size="lg"
              className="relative p-0 w-14 h-14 rounded-full shadow-lg"
            >
              {isCleaning ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <FileText className="w-6 h-6" />
              )}
              {logs.length > 0 && (
                <span className="flex absolute -top-1 -right-1 justify-center items-center w-5 h-5 text-xs rounded-full bg-destructive text-destructive-foreground">
                  {logs.length}
                </span>
              )}
            </Button>
          </motion.div>

          {/* 日志面板 */}
          {isLogPanelOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)]"
            >
              <Card className="border-2 shadow-2xl">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg">操作日志</CardTitle>
                      <CardDescription className="text-xs">
                        查看空项目清理操作的执行过程和结果
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {logs.length > 0 && !isCleaning && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearLogs}
                          className="h-8 text-xs"
                        >
                          清空
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsLogPanelOpen(false)}
                        className="p-0 w-8 h-8"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="rounded-lg border bg-muted/30 max-h-[500px] overflow-y-auto">
                    <div className="p-3 space-y-2 text-sm">
                      {logs.length === 0 && isCleaning ? (
                        <div className="flex gap-2 items-center p-4 text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>正在执行操作...</span>
                        </div>
                      ) : (
                        logs.map((log, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`flex items-start gap-3 p-3 rounded-md ${
                              log.type === 'error'
                                ? 'bg-destructive/10 text-destructive border border-destructive/20'
                                : log.type === 'success'
                                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                                  : 'bg-muted/50 text-muted-foreground border border-border'
                            }`}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              {log.type === 'error' ? (
                                <XCircle className="w-4 h-4" />
                              ) : log.type === 'success' ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <Loader2 className="w-4 h-4" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex gap-2 items-center mb-1">
                                <span className="font-mono text-xs opacity-70">
                                  {log.timestamp.toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="leading-relaxed break-words">{log.message}</div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
