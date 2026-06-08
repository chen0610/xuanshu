// 待弃用
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Loader2, Trash2, CheckCircle, XCircle, Search, FileText, X } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Textarea,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  RadioGroup,
  RadioGroupItem
} from '../../components/ui'
import { projectBidService, batchBidModifyService } from '../../services/ocean-engine.service'
import { configService } from '../../services/config.service'

interface ProjectBid {
  id: number
  project_id: string
  project_name: string
  current_bid: number
  new_bid: number | null
  config_id: number
  status: string
  error_message: string | null
  created_at: string
  updated_at: string
}

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

export const BidManagementPage: React.FC = () => {
  const [bids, setBids] = useState<ProjectBid[]>([])
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [projectId, setProjectId] = useState('')
  const [projectName, setProjectName] = useState('')
  const [currentBid, setCurrentBid] = useState('')
  const [newBid, setNewBid] = useState('')
  const [filterConfigId, setFilterConfigId] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [error, setError] = useState('')

  // 新增的出价配置状态
  const [bidMode, setBidMode] = useState<string>('deep_bid') // 出价模式，默认深度出价
  const [isRangeBid, setIsRangeBid] = useState<string>('no') // 是否区间出价，默认否
  const [deepBid, setDeepBid] = useState<string>('') // 深度出价（单个值）
  const [minBid, setMinBid] = useState<string>('') // 最小出价（区间模式）
  const [maxBid, setMaxBid] = useState<string>('') // 最大出价（区间模式）
  const [selectedEngineConfigId, setSelectedEngineConfigId] = useState<number | null>(null) // 选中的引擎账户配置（单选）
  const [adAccountIds, setAdAccountIds] = useState<string>('') // 投放账户ID列表（多行文本）
  const [logs, setLogs] = useState<
    Array<{ message: string; type: 'info' | 'success' | 'error'; timestamp: Date }>
  >([]) // 操作日志
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false) // 日志面板是否展开

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
      if (oceanConfigs.length > 0 && !selectedEngineConfigId) {
        setSelectedEngineConfigId(oceanConfigs[0].id)
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
    }
  }

  const handleCreate = async (): Promise<void> => {
    if (!selectedConfigId || !projectId || !projectName || !currentBid || !newBid) {
      setError('请填写所有必填字段')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      await projectBidService.createProjectBid({
        project_id: projectId,
        project_name: projectName,
        current_bid: parseFloat(currentBid),
        new_bid: parseFloat(newBid),
        config_id: selectedConfigId
      })
      setIsDialogOpen(false)
      resetForm()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = (): void => {
    setProjectId('')
    setProjectName('')
    setCurrentBid('')
    setNewBid('')
    setError('')
    setBidMode('deep_bid')
    setIsRangeBid('no')
    setDeepBid('')
    setMinBid('')
    setMaxBid('')
    setSelectedEngineConfigId(null)
    setAdAccountIds('')
    clearLogs()
  }

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info'): void => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }])
  }

  const clearLogs = (): void => {
    setLogs([])
  }

  const handleBidUpdate = async (): Promise<void> => {
    if (!selectedEngineConfigId) {
      setError('请选择一个引擎账户')
      return
    }

    if (!adAccountIds.trim()) {
      setError('请输入投放账户ID')
      return
    }

    // 验证投放账户ID格式（每行一个）
    const accountIdList = adAccountIds
      .split('\n')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)

    if (accountIdList.length === 0) {
      setError('请输入至少一个投放账户ID')
      return
    }

    // 验证出价参数
    if (isRangeBid === 'yes') {
      if (!minBid || !maxBid) {
        setError('请输入最小出价和最大出价')
        return
      }
      const min = parseFloat(minBid)
      const max = parseFloat(maxBid)
      if (isNaN(min) || isNaN(max) || min >= max) {
        setError('最小出价必须小于最大出价')
        return
      }
    } else {
      if (!deepBid) {
        setError('请输入深度出价')
        return
      }
      const bid = parseFloat(deepBid)
      if (isNaN(bid) || bid <= 0) {
        setError('请输入有效的深度出价')
        return
      }
    }

    setIsSubmitting(true)
    setError('')
    clearLogs()
    setIsLogPanelOpen(true) // 自动展开日志面板
    addLog('开始批量操作...', 'info')
    addLog(`目标账户数: ${accountIdList.length}`, 'info')

    try {
      // Step 1: 获取项目列表
      const projectsResponse = await batchBidModifyService.getAdProjects({
        account_ids: accountIdList,
        selected_cookie_id: selectedEngineConfigId
      })

      if (projectsResponse.code !== 0) {
        throw new Error(projectsResponse.error || projectsResponse.msg || '获取项目列表失败')
      }

      if (projectsResponse.data) {
        addLog(
          `找到项目: 手动 ${projectsResponse.data.manual_count}, 自动 ${projectsResponse.data.auto_count}`,
          'info'
        )
      }

      // Step 2: 批量修改出价
      const modifyPayload: {
        account_ids: string[]
        enable_range_bid: 'yes' | 'no'
        selected_cookie_id: number
        deep_bid_value?: number
        deep_bid_min_value?: number
        deep_bid_max_value?: number
      } = {
        account_ids: accountIdList,
        enable_range_bid: isRangeBid as 'yes' | 'no',
        selected_cookie_id: selectedEngineConfigId
      }

      if (isRangeBid === 'no') {
        modifyPayload.deep_bid_value = parseFloat(deepBid)
      } else {
        modifyPayload.deep_bid_min_value = parseFloat(minBid)
        modifyPayload.deep_bid_max_value = parseFloat(maxBid)
      }

      const modifyResponse = await batchBidModifyService.batchModifyBids(modifyPayload)

      if (modifyResponse.code !== 0) {
        throw new Error(modifyResponse.error || modifyResponse.msg || '批量修改失败')
      }

      if (modifyResponse.data) {
        const { total_success, total_error, total_auto_projects, total_manual_projects } =
          modifyResponse.data
        addLog(`修改完成! 成功: ${total_success}, 失败: ${total_error}`, 'success')

        if (total_auto_projects > 0 || total_manual_projects > 0) {
          addLog(`处理项目: 自动 ${total_auto_projects}, 手动 ${total_manual_projects}`, 'info')
        }

        // 显示账户级别的错误信息
        if (modifyResponse.data.account_results) {
          modifyResponse.data.account_results.forEach((result) => {
            if (result.errors && result.errors.length > 0) {
              addLog(`账户 ${result.account_id}: ${result.errors.join('; ')}`, 'error')
            } else if (result.success_count > 0) {
              addLog(
                `账户 ${result.account_id}: 成功处理 ${result.success_count} 个项目`,
                'success'
              )
            }
          })
        }
      }

      // 不调用resetForm()，保留数据和日志供用户查看
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '修改失败'
      setError(errorMessage)
      addLog(`失败: ${errorMessage}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string): React.ReactNode => {
    const statusMap: Record<string, { icon: React.ReactNode; text: string; className: string }> = {
      pending: {
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        text: '待处理',
        className: 'text-yellow-600'
      },
      processing: {
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        text: '处理中',
        className: 'text-blue-600'
      },
      completed: {
        icon: <CheckCircle className="w-4 h-4" />,
        text: '已完成',
        className: 'text-green-600'
      },
      failed: { icon: <XCircle className="w-4 h-4" />, text: '失败', className: 'text-red-600' }
    }

    const statusInfo = statusMap[status] || { icon: null, text: status, className: 'text-gray-600' }

    return (
      <div className={`flex items-center gap-2 ${statusInfo.className}`}>
        {statusInfo.icon}
        <span className="text-sm font-medium">{statusInfo.text}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">项目出价修改</h1>
          <p className="mt-2 text-muted-foreground">
            批量修改广告项目的出价设置
          </p>
        </div>
      </div> */}

      {/* 出价配置区域 */}
      <Card>
        <CardHeader>
          <CardTitle>项目出价修改</CardTitle>
          <CardDescription>批量修改广告项目的出价设置</CardDescription>
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
                      selectedEngineConfigId === config.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    }`}
                    onClick={() => setSelectedEngineConfigId(config.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex flex-1 gap-2 items-center min-w-0">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                            selectedEngineConfigId === config.id
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground/30'
                          }`}
                        >
                          {selectedEngineConfigId === config.id && (
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
                      {selectedEngineConfigId === config.id && (
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
            <Label htmlFor="adAccountIdsInput" className="text-base font-semibold">
              投放账户ID *
            </Label>
            <Textarea
              id="adAccountIdsInput"
              placeholder="请输入投放账户ID，每行填写一个"
              value={adAccountIds}
              onChange={(e) => setAdAccountIds(e.target.value)}
              disabled={isSubmitting}
              className="min-h-[120px] resize-y"
              rows={5}
            />
            <p className="text-sm text-muted-foreground">每行填写一个投放账户ID，支持多个账户</p>
          </div>

          {/* 出价模式 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">出价模式 *</Label>
            <RadioGroup
              value={bidMode}
              onValueChange={setBidMode}
              disabled={isSubmitting}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="deep_bid" id="deep_bid" />
                <Label htmlFor="deep_bid" className="font-normal cursor-pointer">
                  深度出价
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 是否区间出价 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">是否区间出价 *</Label>
            <RadioGroup
              value={isRangeBid}
              onValueChange={setIsRangeBid}
              disabled={isSubmitting}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="range_no" />
                <Label htmlFor="range_no" className="font-normal cursor-pointer">
                  否
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="range_yes" />
                <Label htmlFor="range_yes" className="font-normal cursor-pointer">
                  是
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 深度出价输入 */}
          {isRangeBid === 'no' ? (
            <div className="grid gap-2">
              <Label htmlFor="deepBid" className="text-base font-semibold">
                深度出价 *
              </Label>
              <Input
                id="deepBid"
                type="number"
                step="0.01"
                min="0"
                placeholder="请输入深度出价"
                value={deepBid}
                onChange={(e) => setDeepBid(e.target.value)}
                disabled={isSubmitting}
                className="h-11"
              />
              <p className="text-sm text-muted-foreground">请输入有效的出价值（单位：元）</p>
            </div>
          ) : (
            <div className="grid gap-4">
              <Label className="text-base font-semibold">深度出价区间 *</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="minBid" className="text-sm font-normal">
                    最小值
                  </Label>
                  <Input
                    id="minBid"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="最小出价"
                    value={minBid}
                    onChange={(e) => setMinBid(e.target.value)}
                    disabled={isSubmitting}
                    className="h-11"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="maxBid" className="text-sm font-normal">
                    最大值
                  </Label>
                  <Input
                    id="maxBid"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="最大出价"
                    value={maxBid}
                    onChange={(e) => setMaxBid(e.target.value)}
                    disabled={isSubmitting}
                    className="h-11"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                最小值必须小于最大值，系统将在该区间内自动调整出价
              </p>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="p-4 text-sm rounded-lg border bg-destructive/10 text-destructive border-destructive/20">
              {error}
            </div>
          )}

          {/* 确定修改按钮 */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleBidUpdate}
              disabled={
                isSubmitting ||
                !selectedEngineConfigId ||
                !adAccountIds.trim() ||
                (isRangeBid === 'no' ? !deepBid : !minBid || !maxBid)
              }
              size="lg"
              className="min-w-[140px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  修改中...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 w-4 h-4" />
                  确定修改
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 创建对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>添加项目出价</DialogTitle>
            <DialogDescription>创建一条项目出价修改记录</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="config">账号配置 *</Label>
              <select
                id="config"
                className="px-3 py-2 w-full rounded-md border bg-background"
                value={selectedConfigId || ''}
                onChange={(e) => setSelectedConfigId(parseInt(e.target.value))}
                disabled={isSubmitting}
              >
                <option value="">请选择账号配置</option>
                {configs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.cookie_name} {config.realname && `(${config.realname})`}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="projectId">项目ID *</Label>
              <Input
                id="projectId"
                placeholder="输入项目ID"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="projectName">项目名称 *</Label>
              <Input
                id="projectName"
                placeholder="输入项目名称"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currentBid">当前出价 *</Label>
              <Input
                id="currentBid"
                type="number"
                step="0.01"
                placeholder="输入当前出价"
                value={currentBid}
                onChange={(e) => setCurrentBid(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newBid">新出价 *</Label>
              <Input
                id="newBid"
                type="number"
                step="0.01"
                placeholder="输入新出价"
                value={newBid}
                onChange={(e) => setNewBid(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            {error && (
              <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false)
                resetForm()
              }}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                isSubmitting ||
                !selectedConfigId ||
                !projectId ||
                !projectName ||
                !currentBid ||
                !newBid
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Plus className="mr-2 w-4 h-4" />
                  确认创建
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                            resetForm()
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
