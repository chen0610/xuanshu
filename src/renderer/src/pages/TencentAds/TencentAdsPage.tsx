import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2,
  CheckCircle,
  XCircle,
  FileText,
  X,
  Users,
  Target,
  Settings,
  CreditCard,
  MousePointerClick,
  TrendingUp,
  Activity,
  AlertCircle
} from 'lucide-react'
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
  RadioGroup,
  RadioGroupItem
} from '../../components/ui'
import { configService } from '../../services/config.service'
import { batchBidModifyService } from '../../services/tencent-ads.service'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

export const TencentAdsPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [adAccountIds, setAdAccountIds] = useState<string>('')
  const [bidType, setBidType] = useState<string>('max_conversion') // 出价类型，默认最大转化量投放
  const [controlCost, setControlCost] = useState<string>('') // 控制成本
  const [bidAmount, setBidAmount] = useState<string>('') // 常规修改出价金额（元）
  const [deepBidAmount, setDeepBidAmount] = useState<string>('') // 深度目标出价（元）
  const [activateCost, setActivateCost] = useState<string>('') // 激活成本（元）
  const [retentionCost, setRetentionCost] = useState<string>('') // 次留成本（元）
  const [error, setError] = useState<string>('')
  const [logs, setLogs] = useState<
    Array<{ message: string; type: 'info' | 'success' | 'error'; timestamp: Date }>
  >([])
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false) // 日志面板是否展开

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async (): Promise<void> => {
    setLoading(true)
    try {
      const tencentConfigs = await configService.getConfigsBySource(2)
      setConfigs(tencentConfigs)
      if (tencentConfigs.length > 0 && !selectedConfigId) {
        setSelectedConfigId(tencentConfigs[0].id)
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

  const handleSubmit = async (): Promise<void> => {
    // 验证必填字段
    if (!selectedConfigId) {
      setError('请选择一个账号配置')
      return
    }

    if (!adAccountIds.trim()) {
      setError('请输入广告账户列表')
      return
    }

    // 验证广告账户ID格式（每行一个）
    const accountIdList = adAccountIds
      .split('\n')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)

    if (accountIdList.length === 0) {
      setError('请输入至少一个广告账户ID')
      return
    }

    // 根据出价类型验证不同的必填字段
    if (bidType === 'max_conversion') {
      if (!controlCost || parseFloat(controlCost) <= 0) {
        setError('请输入有效的控制成本')
        return
      }
    } else if (bidType === 'normal_bid_modify') {
      // 至少需要输入一个出价（出价金额或深度目标出价）
      if (
        (!bidAmount || parseFloat(bidAmount) <= 0) &&
        (!deepBidAmount || parseFloat(deepBidAmount) <= 0)
      ) {
        setError('请至少输入一个出价（出价金额或深度目标出价）')
        return
      }
    } else if (bidType === 'smart_target') {
      // 智投投放目标暂时不需要额外参数
    }

    setIsSubmitting(true)
    setError('')
    clearLogs()
    setIsLogPanelOpen(true) // 自动展开日志面板

    try {
      addLog(`开始批量修改出价，账户数: ${accountIdList.length}`, 'info')

      if (bidType === 'normal_bid_modify') {
        // 常规修改出价流程
        addLog(`出价类型: 常规修改出价`, 'info')
        if (bidAmount) {
          addLog(`出价金额: ${bidAmount}元`, 'info')
        }
        if (deepBidAmount) {
          addLog(`深度目标出价: ${deepBidAmount}元`, 'info')
        }

        // 调用常规修改出价API（内部会先获取广告列表，然后修改出价）
        const modifyResponse = await batchBidModifyService.normalBidModify({
          account_ids: accountIdList,
          selected_cookie_id: selectedConfigId,
          bid_amount: bidAmount ? parseFloat(bidAmount) * 100 : undefined, // 转换为分，为空时不传
          deep_conversion_behavior_bid: deepBidAmount ? parseFloat(deepBidAmount) : undefined
        })

        if (modifyResponse.code !== 0) {
          throw new Error(modifyResponse.error || modifyResponse.msg || '常规修改出价失败')
        }

        if (modifyResponse.data) {
          const { total_success, total_error, task_ids, account_results } = modifyResponse.data
          addLog(
            `修改完成！成功: ${total_success}, 失败: ${total_error}`,
            total_error === 0 ? 'success' : 'info'
          )

          if (task_ids && task_ids.length > 0) {
            addLog(`任务ID: ${task_ids.join(', ')}`, 'info')
          }

          // 显示账户级别的结果
          account_results?.forEach((result) => {
            if (result.success_count > 0) {
              addLog(`账户 ${result.account_id}: 成功 ${result.success_count} 个`, 'success')
            }
            if (result.error_count > 0) {
              result.errors.forEach((err) => {
                addLog(`账户 ${result.account_id}: ${err}`, 'error')
              })
            }
          })
        }
      } else if (bidType === 'smart_target') {
        // 智投投放目标流程
        addLog(`出价类型: 智投投放目标`, 'info')
        if (activateCost) {
          addLog(`激活成本: ${activateCost}元`, 'info')
        }
        if (retentionCost) {
          addLog(`次留成本: ${retentionCost}元`, 'info')
        }
        if (!activateCost && !retentionCost) {
          setError('请至少输入一个成本值（激活成本或次留成本）')
          return
        }

        // 调用智投投放目标修改API（内部会先获取项目列表，然后修改投放目标）
        const modifyResponse = await batchBidModifyService.smartTargetModify({
          account_ids: accountIdList,
          selected_cookie_id: selectedConfigId,
          activate_cost: activateCost ? parseFloat(activateCost) : undefined,
          retention_cost: retentionCost ? parseFloat(retentionCost) : undefined
        })

        if (modifyResponse.code !== 0) {
          throw new Error(modifyResponse.error || modifyResponse.msg || '智投投放目标修改失败')
        }

        if (modifyResponse.data) {
          const { total_success, total_error, task_ids, account_results } = modifyResponse.data
          addLog(
            `修改完成！成功: ${total_success}, 失败: ${total_error}`,
            total_error === 0 ? 'success' : 'info'
          )

          if (task_ids && task_ids.length > 0) {
            addLog(`任务ID: ${task_ids.join(', ')}`, 'info')
          }

          // 显示账户级别的结果
          account_results?.forEach((result) => {
            if (result.success_count > 0) {
              addLog(`账户 ${result.account_id}: 成功 ${result.success_count} 个`, 'success')
            }
            if (result.error_count > 0) {
              result.errors.forEach((err) => {
                addLog(`账户 ${result.account_id}: ${err}`, 'error')
              })
            }
          })
        }
      } else {
        // 最大转化量投放流程（原有逻辑）
        addLog(`出价类型: 最大转化量投放，控制成本: ${controlCost}元`, 'info')

        // 调用后端API进行修改
        const modifyPayload = {
          account_ids: accountIdList,
          bid_type: 'max_conversion' as const,
          selected_cookie_id: selectedConfigId,
          control_cost: parseFloat(controlCost)
        }

        addLog('正在获取广告组列表...', 'info')
        const projectsResponse = await batchBidModifyService.getAdProjects({
          account_ids: accountIdList,
          selected_cookie_id: selectedConfigId
        })

        if (projectsResponse.code !== 0) {
          throw new Error(projectsResponse.error || projectsResponse.msg || '获取广告组列表失败')
        }

        const totalCount = projectsResponse.data?.total_count || 0
        addLog(`找到 ${totalCount} 个广告组`, 'info')

        addLog('开始批量修改出价...', 'info')
        const modifyResponse = await batchBidModifyService.batchModifyBids(modifyPayload)

        if (modifyResponse.code !== 0) {
          throw new Error(modifyResponse.error || modifyResponse.msg || '批量修改失败')
        }

        if (modifyResponse.data) {
          const { total_success, total_error, account_results } = modifyResponse.data
          addLog(
            `修改完成！成功: ${total_success}, 失败: ${total_error}`,
            total_error === 0 ? 'success' : 'info'
          )

          // 显示账户级别的结果
          account_results?.forEach((result) => {
            if (result.success_count > 0) {
              addLog(`账户 ${result.account_id}: 成功 ${result.success_count} 个`, 'success')
            }
            if (result.error_count > 0) {
              result.errors.forEach((err) => {
                addLog(`账户 ${result.account_id}: ${err}`, 'error')
              })
            }
          })
        }
      }

      // 不调用resetForm()，保留数据和日志供用户查看
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '修改失败，请稍后重试'
      setError(errorMessage)
      addLog(`错误: ${errorMessage}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = (): void => {
    setAdAccountIds('')
    setControlCost('')
    setBidAmount('')
    setDeepBidAmount('')
    setActivateCost('')
    setRetentionCost('')
    setError('')
    clearLogs()
    setIsLogPanelOpen(false)
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">广告出价修改</h1>
        <p className="text-muted-foreground">批量修改腾讯广告的出价设置，支持多账户同时操作。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：配置与账户 */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5 text-primary" />
                账号配置
              </CardTitle>
              <CardDescription>选择用于操作的腾讯广告账号</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              {loading ? (
                <div className="flex justify-center items-center p-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : configs.length === 0 ? (
                <div className="p-8 text-center rounded-lg border-2 border-dashed text-muted-foreground bg-muted/30">
                  <AlertCircle className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>暂无可用账户配置</p>
                  <p className="text-xs mt-1">请先在配置中心添加腾讯账号的Cookie配置</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {configs.map((config) => (
                    <motion.div
                      key={config.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`p-3 border rounded-lg cursor-pointer transition-all relative overflow-hidden ${
                        selectedConfigId === config.id
                          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                          : 'border-border hover:border-primary/50 hover:bg-accent/50'
                      }`}
                      onClick={() => setSelectedConfigId(config.id)}
                    >
                      {selectedConfigId === config.id && (
                        <div className="absolute top-0 right-0 p-1 bg-primary rounded-bl-lg">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            selectedConfigId === config.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {config.cookie_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-sm">{config.cookie_name}</div>
                          {config.realname && (
                            <div className="text-xs truncate text-muted-foreground">
                              {config.realname}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    △ 备用cookie可用数量越多，修改速度越快
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：操作表单 */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="w-5 h-5 text-primary" />
                目标账户
              </CardTitle>
              <CardDescription>输入需要批量修改的广告账户ID</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Textarea
                  id="adAccountIds"
                  placeholder="请输入广告账户ID，每行填写一个&#10;例如：&#10;123456789&#10;987654321"
                  value={adAccountIds}
                  onChange={(e) => setAdAccountIds(e.target.value)}
                  disabled={isSubmitting}
                  className="min-h-[150px] font-mono resize-y bg-muted/20 focus:bg-background transition-colors"
                />
                <div className="absolute bottom-3 right-3 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded border">
                  已输入: {adAccountIds.split('\n').filter((line) => line.trim()).length} 个
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="w-5 h-5 text-primary" />
                投放策略
              </CardTitle>
              <CardDescription>选择出价模式并设置相关参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* 出价类型选择 */}
              <div className="space-y-4">
                <Label className="text-base font-medium">选择出价模式</Label>
                <RadioGroup
                  value={bidType}
                  onValueChange={setBidType}
                  disabled={isSubmitting}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                  {[
                    {
                      id: 'max_conversion',
                      icon: <TrendingUp className="w-5 h-5" />,
                      title: '最大转化量',
                      desc: '自动优化出价'
                    },
                    {
                      id: 'normal_bid_modify',
                      icon: <MousePointerClick className="w-5 h-5" />,
                      title: '常规修改',
                      desc: '修改指定出价'
                    },
                    {
                      id: 'smart_target',
                      icon: <Activity className="w-5 h-5" />,
                      title: '智投目标',
                      desc: '优化投放目标'
                    }
                  ].map((item) => (
                    <label
                      key={item.id}
                      className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-accent/50 ${
                        bidType === item.id
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-muted bg-transparent'
                      }`}
                    >
                      <RadioGroupItem value={item.id} id={item.id} className="sr-only" />
                      <div
                        className={`p-2 rounded-full mb-3 ${
                          bidType === item.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {item.icon}
                      </div>
                      <span className="font-semibold text-sm mb-1">{item.title}</span>
                      <span className="text-xs text-muted-foreground text-center">{item.desc}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {/* 动态参数区域 */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={bidType}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6 pt-4 border-t"
                >
                  {bidType === 'max_conversion' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="controlCost" className="text-base font-medium">
                          控制成本
                        </Label>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                          必填
                        </span>
                      </div>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="controlCost"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="请输入期望的平均转化成本"
                          value={controlCost}
                          onChange={(e) => setControlCost(e.target.value)}
                          disabled={isSubmitting}
                          className="pl-9 h-12 text-lg"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          元
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        系统将在此成本范围内进行优化
                      </p>
                    </div>
                  )}

                  {bidType === 'normal_bid_modify' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label htmlFor="bidAmount" className="font-medium">
                          出价金额
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
                            ¥
                          </span>
                          <Input
                            id="bidAmount"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="常规出价"
                            value={bidAmount}
                            onChange={(e) => setBidAmount(e.target.value)}
                            disabled={isSubmitting}
                            className="pl-7"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">为空时不修改</p>
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="deepBidAmount" className="font-medium">
                          深度目标出价
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
                            ¥
                          </span>
                          <Input
                            id="deepBidAmount"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="深度出价"
                            value={deepBidAmount}
                            onChange={(e) => setDeepBidAmount(e.target.value)}
                            disabled={isSubmitting}
                            className="pl-7"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">为空时不修改</p>
                      </div>
                      <div className="col-span-full text-xs text-muted-foreground bg-muted/30 p-3 rounded border">
                        <p>
                          提示：系统将先获取广告列表（按消耗降序），然后批量修改。至少填写一项。
                        </p>
                      </div>
                    </div>
                  )}

                  {bidType === 'smart_target' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label htmlFor="activateCost" className="font-medium">
                          激活成本
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
                            ¥
                          </span>
                          <Input
                            id="activateCost"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="目标成本"
                            value={activateCost}
                            onChange={(e) => setActivateCost(e.target.value)}
                            disabled={isSubmitting}
                            className="pl-7"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">为空时不修改</p>
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="retentionCost" className="font-medium">
                          次留成本
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
                            ¥
                          </span>
                          <Input
                            id="retentionCost"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="目标成本"
                            value={retentionCost}
                            onChange={(e) => setRetentionCost(e.target.value)}
                            disabled={isSubmitting}
                            className="pl-7"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">为空时不修改</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* 错误提示 */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 text-sm rounded-lg border bg-destructive/10 text-destructive border-destructive/20 flex items-center gap-2">
                      <XCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 提交按钮 */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={
                    isSubmitting ||
                    !selectedConfigId ||
                    !adAccountIds.trim() ||
                    (bidType === 'max_conversion' &&
                      (!controlCost || parseFloat(controlCost) <= 0)) ||
                    (bidType === 'normal_bid_modify' &&
                      (!bidAmount || parseFloat(bidAmount) <= 0) &&
                      (!deepBidAmount || parseFloat(deepBidAmount) <= 0)) ||
                    (bidType === 'smart_target' && !activateCost && !retentionCost)
                  }
                  size="lg"
                  className="min-w-[160px] shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      正在执行...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 w-4 h-4" />
                      开始批量修改
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 浮动操作日志按钮和面板 */}
      <AnimatePresence>
        {(logs.length > 0 || isSubmitting) && (
          <>
            {/* 浮动按钮 */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="fixed right-8 bottom-8 z-50"
            >
              <Button
                onClick={() => setIsLogPanelOpen(!isLogPanelOpen)}
                size="lg"
                className="relative p-0 w-16 h-16 rounded-full shadow-xl hover:shadow-2xl transition-all hover:scale-110"
              >
                {isSubmitting ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : (
                  <FileText className="w-7 h-7" />
                )}
                {logs.length > 0 && (
                  <span className="flex absolute -top-1 -right-1 justify-center items-center min-w-[20px] h-5 px-1.5 text-xs rounded-full bg-destructive text-destructive-foreground ring-2 ring-background">
                    {logs.length > 99 ? '99+' : logs.length}
                  </span>
                )}
              </Button>
            </motion.div>

            {/* 日志面板 */}
            {isLogPanelOpen && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                className="fixed bottom-28 right-8 z-50 w-[500px] max-w-[calc(100vw-4rem)]"
              >
                <Card className="border shadow-2xl overflow-hidden backdrop-blur-sm bg-background/95">
                  <CardHeader className="py-3 px-4 border-b bg-muted/20">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-primary/10 rounded-md">
                          <Activity className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">操作日志</CardTitle>
                          <CardDescription className="text-xs">
                            实时监控任务执行状态
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {logs.length > 0 && !isSubmitting && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              resetForm()
                              setIsLogPanelOpen(false)
                            }}
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="清空并关闭"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsLogPanelOpen(false)}
                          className="h-8 w-8"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[500px] overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-muted">
                      {logs.length === 0 && isSubmitting ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                          <Loader2 className="w-8 h-8 animate-spin opacity-50" />
                          <span className="text-sm">正在处理中，请稍候...</span>
                        </div>
                      ) : (
                        logs.map((log, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 }}
                            className={`group flex items-start gap-3 p-3 rounded-lg border text-sm transition-colors ${
                              log.type === 'error'
                                ? 'bg-destructive/5 border-destructive/20 text-destructive'
                                : log.type === 'success'
                                  ? 'bg-green-500/5 border-green-500/20 text-green-700 dark:text-green-400'
                                  : 'bg-card border-border hover:bg-accent/50'
                            }`}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              {log.type === 'error' ? (
                                <XCircle className="w-4 h-4" />
                              ) : log.type === 'success' ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2 mb-1">
                                <span
                                  className={`font-medium ${
                                    log.type === 'error'
                                      ? 'text-destructive'
                                      : log.type === 'success'
                                        ? 'text-green-700 dark:text-green-400'
                                        : 'text-foreground'
                                  }`}
                                >
                                  {log.type === 'error'
                                    ? '执行失败'
                                    : log.type === 'success'
                                      ? '执行成功'
                                      : '系统消息'}
                                </span>
                                <span className="text-[10px] font-mono opacity-50 whitespace-nowrap">
                                  {log.timestamp.toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="opacity-90 leading-relaxed break-words">
                                {log.message}
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
