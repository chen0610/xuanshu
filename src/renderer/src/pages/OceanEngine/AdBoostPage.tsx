// 弃用
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2, TrendingUp, X, FileText, XCircle, CheckCircle, Trash2 } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Label,
  Textarea
} from '../../components/ui'
import { adBoostService } from '../../services/ocean-engine.service'
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

export const AdBoostPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)

  // 项目起量相关状态
  const [accountIds, setAccountIds] = useState('')
  const [projectBudget, setProjectBudget] = useState('')
  const [projectEndTime, setProjectEndTime] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadConfigs()
    // 从localStorage加载数据
    loadFromLocalStorage()
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

  const loadFromLocalStorage = (): void => {
    try {
      const savedAccountIds = localStorage.getItem('ad-boost-account-ids')
      const savedProjectBudget = localStorage.getItem('ad-boost-project-budget')
      const savedProjectEndTime = localStorage.getItem('ad-boost-project-end-time')

      if (savedAccountIds) setAccountIds(savedAccountIds)
      if (savedProjectBudget) setProjectBudget(savedProjectBudget)
      if (savedProjectEndTime) setProjectEndTime(savedProjectEndTime)
    } catch (err) {
      console.error('Failed to load from localStorage:', err)
    }
  }

  const saveToLocalStorage = (): void => {
    try {
      localStorage.setItem('ad-boost-account-ids', accountIds)
      localStorage.setItem('ad-boost-project-budget', projectBudget)
      localStorage.setItem('ad-boost-project-end-time', projectEndTime)
    } catch (err) {
      console.error('Failed to save to localStorage:', err)
    }
  }

  useEffect(() => {
    saveToLocalStorage()
  }, [accountIds, projectBudget, projectEndTime])

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info'): void => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }])
    setIsLogPanelOpen(true)
  }

  const clearLogs = (): void => {
    setLogs([])
  }

  const handleProjectBoost = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个引擎账户')
      return
    }

    const accountIdList = accountIds
      .split('\n')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)

    if (accountIdList.length === 0) {
      setError('请输入投放账户ID')
      return
    }

    const budget = parseInt(projectBudget)
    if (isNaN(budget) || budget < 100) {
      setError('预算必须大于等于100元')
      return
    }

    if (!projectEndTime) {
      setError('请选择起量结束时间')
      return
    }

    const endTimestamp = Math.floor(new Date(projectEndTime).getTime() / 1000)
    const currentTimestamp = Math.floor(Date.now() / 1000)
    if (endTimestamp <= currentTimestamp) {
      setError('结束时间必须大于当前时间')
      return
    }

    const accountCount = accountIdList.length
    const confirmMessage = `确定要为 ${accountCount} 个账户起量吗？\n预算: ${budget}元\n结束时间: ${new Date(projectEndTime).toLocaleString()}`

    if (!window.confirm(confirmMessage)) {
      return
    }

    setIsSubmitting(true)
    setError('')
    clearLogs()
    setIsLogPanelOpen(true)
    addLog('开始项目起量...', 'info')
    addLog(`目标账户数: ${accountIdList.length}`, 'info')

    try {
      const response = await adBoostService.projectBoost({
        account_ids: accountIdList,
        selected_cookie_id: selectedConfigId,
        budget,
        end_time: endTimestamp
      })

      if (response.code !== 0) {
        throw new Error(response.error || response.msg || '项目起量失败')
      }

      if (response.data) {
        const { total_success, total_error, account_results } = response.data
        addLog(
          `起量完成！成功: ${total_success}, 失败: ${total_error}`,
          total_error === 0 ? 'success' : 'info'
        )

        account_results?.forEach((result) => {
          if (result.success_count > 0) {
            addLog(`账户 ${result.account_id}: 成功起量 ${result.success_count} 个项目`, 'success')
          }
          if (result.error_count > 0) {
            addLog(`账户 ${result.account_id}: 失败 ${result.error_count} 个项目`, 'error')
            result.errors.forEach((error) => {
              addLog(`  - ${error}`, 'error')
            })
          }
        })
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : '项目起量失败'
      setError(errorMessage)
      addLog(`失败: ${errorMessage}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const clearAccountIds = (): void => {
    setAccountIds('')
    addLog('已清空账户列表', 'info')
  }

  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  return (
    <div className="space-y-6">
      {/* 项目起量配置区域 */}
      <Card>
        <CardHeader>
          <CardTitle>项目起量工具</CardTitle>
          <CardDescription>批量对账户下的项目进行起量操作</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 引擎账户列表 */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">选择引擎账户 *</Label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {configs.length === 0 ? (
                <div className="col-span-full p-3 text-center rounded-md border text-muted-foreground">
                  暂无可用账户配置
                </div>
              ) : (
                configs.map((config) => (
                  <motion.div
                    key={config.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 border rounded-md cursor-pointer transition-all ${
                      selectedConfigId === config.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    }`}
                    onClick={() => setSelectedConfigId(config.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex flex-1 gap-2 items-center min-w-0">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                            selectedConfigId === config.id
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground/30'
                          }`}
                        >
                          {selectedConfigId === config.id && (
                            <div className="w-1.5 h-1.5 bg-white rounded-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{config.cookie_name}</div>
                          {config.realname && (
                            <div className="text-xs truncate text-muted-foreground">
                              {config.realname}
                            </div>
                          )}
                        </div>
                      </div>
                      {selectedConfigId === config.id && (
                        <CheckCircle className="flex-shrink-0 ml-2 w-4 h-4 text-primary" />
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* 投放账户ID输入 */}
          <div className="grid gap-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="account-ids-input" className="text-base font-semibold">
                投放账户ID *
              </Label>
              <Button variant="outline" size="sm" onClick={clearAccountIds} disabled={isSubmitting}>
                <Trash2 className="mr-2 w-4 h-4" />
                清空列表
              </Button>
            </div>
            <Textarea
              id="account-ids-input"
              placeholder="请输入投放账户ID，每行填写一个"
              value={accountIds}
              onChange={(e) => setAccountIds(e.target.value)}
              disabled={isSubmitting}
              className="min-h-[120px] resize-y font-mono text-sm"
              rows={5}
            />
            <p className="text-sm text-muted-foreground">每行填写一个投放账户ID，支持多个账户</p>
          </div>

          {/* 起量预算 */}
          <div className="grid gap-2">
            <Label htmlFor="project-budget" className="text-base font-semibold">
              起量预算（元）*
            </Label>
            <Input
              id="project-budget"
              type="number"
              placeholder="请输入预算金额..."
              value={projectBudget}
              onChange={(e) => setProjectBudget(e.target.value)}
              disabled={isSubmitting}
              min="100"
              step="1"
              className="h-11"
            />
            <p className="text-sm text-muted-foreground">预算必须大于等于100元</p>
          </div>

          {/* 起量结束时间 */}
          <div className="grid gap-2">
            <Label htmlFor="project-end-time" className="text-base font-semibold">
              起量结束时间 *
            </Label>
            <Input
              id="project-end-time"
              type="datetime-local"
              value={projectEndTime}
              onChange={(e) => setProjectEndTime(e.target.value)}
              disabled={isSubmitting}
              min={formatDateTimeLocal(new Date())}
              className="h-11"
            />
            <p className="text-sm text-muted-foreground">结束时间必须大于当前时间</p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-4 text-sm rounded-lg border bg-destructive/10 text-destructive border-destructive/20">
              {error}
            </div>
          )}

          {/* 确定起量按钮 */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleProjectBoost}
              disabled={
                isSubmitting ||
                !selectedConfigId ||
                !accountIds.trim() ||
                !projectBudget ||
                !projectEndTime
              }
              size="lg"
              className="min-w-[140px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  起量中...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 w-4 h-4" />
                  立即起量
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 浮动操作日志按钮和面板 */}
      {(logs.length > 0 || isSubmitting) && (
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
              {isSubmitting ? (
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
                        查看批量操作的执行过程和结果
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {logs.length > 0 && !isSubmitting && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            clearLogs()
                            setIsLogPanelOpen(false)
                          }}
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
                      {logs.length === 0 && isSubmitting ? (
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
