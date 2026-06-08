import React from 'react'
import { motion } from 'framer-motion'
import { Loader2, TrendingUp, X } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea
} from '../../../../components/ui'
import { persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import type { AdBoostResponse } from '../../../../services/ocean-engine.service'

const formatDateTimeLocal = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export const ProjectBoostTab: React.FC = () => {
  const {
    selectedConfigId,
    loading,
    setLoading,
    error,
    setError,
    addLog,
    clearLogs,
    setIsBottomPanelOpen,
    runPAssistantJob
  } = usePAssistantContext()

  const [projectBoostAccountIds, setProjectBoostAccountIds] = usePersistedState<string>(
    'p-assistant-project-boost-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [projectBudget, setProjectBudget] = usePersistedState(
    'p-assistant-project-budget',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [projectEndTime, setProjectEndTime] = usePersistedState(
    'p-assistant-project-end-time',
    '',
    { shouldPersist: persistNonEmptyString }
  )

  const handleProjectBoost = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个引擎账户')
      return
    }

    const accountIdList = projectBoostAccountIds
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

    setLoading(true)
    setError('')
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog('开始项目起量...', 'info')
    addLog(`目标账户数: ${accountIdList.length}`, 'info')

    try {
      const response = await runPAssistantJob<AdBoostResponse>('project_boost', {
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
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <Card className="border-2 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            项目起量工具
          </CardTitle>
          <CardDescription>批量对账户下的项目进行起量操作</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 投放账户ID输入 */}
          <div className="grid gap-2">
            <div className="flex justify-between items-center">
              <Label
                htmlFor="project-boost-account-ids-input"
                className="text-base font-semibold"
              >
                账户列表（一行一个）*
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProjectBoostAccountIds('')}
                disabled={loading}
              >
                <X className="mr-2 w-4 h-4" />
                清空列表
              </Button>
            </div>
            <Textarea
              id="project-boost-account-ids-input"
              placeholder="请输入投放账户ID，每行填写一个"
              value={projectBoostAccountIds}
              onChange={(e) => setProjectBoostAccountIds(e.target.value)}
              disabled={loading}
              className="min-h-[120px] resize-y font-mono text-sm"
              rows={5}
            />
            <p className="text-sm text-muted-foreground">
              每行填写一个投放账户ID，支持多个账户
            </p>
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
              disabled={loading}
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
              disabled={loading}
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
                loading ||
                !selectedConfigId ||
                !projectBoostAccountIds.trim() ||
                !projectBudget ||
                !projectEndTime
              }
              size="lg"
              className="min-w-[140px]"
            >
              {loading ? (
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
    </motion.div>
  )
}
