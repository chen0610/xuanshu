import React from 'react'
import { Loader2, TrendingUp, X } from 'lucide-react'
import { Button, Input, Label, RadioGroup, RadioGroupItem, Textarea } from '../../../../components/ui'
import { PAssistantFeaturePanel } from '../../PAssistantFeaturePanel'
import { parseAccountIds } from '../../pAssistantUtils'
import { persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import type { ProjectBudgetModifyResponse } from '../../../../services/ocean-engine.service'

export const ProjectBudgetTab: React.FC = () => {
  const {
    selectedConfigId,
    loading,
    setLoading,
    setError,
    addLog,
    clearLogs,
    setIsBottomPanelOpen,
    runPAssistantJob
  } = usePAssistantContext()

  const [budgetModifyDimension, setBudgetModifyDimension] = usePersistedState<'account' | 'project'>(
    'p-assistant-budget-modify-dimension',
    'account',
    { deserialize: (raw) => (raw === 'project' ? 'project' : 'account') }
  )
  const [budgetModifyAccountIds, setBudgetModifyAccountIds] = usePersistedState<string>(
    'p-assistant-budget-modify-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [budgetModifyProjectIds, setBudgetModifyProjectIds] = usePersistedState<string>(
    'p-assistant-budget-modify-project-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [budgetModifyAmount, setBudgetModifyAmount] = usePersistedState<string>(
    'p-assistant-budget-modify-amount',
    '',
    { shouldPersist: persistNonEmptyString }
  )

  const handleProjectBudgetModify = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个引擎账户')
      return
    }

    const budgetValue = parseFloat(budgetModifyAmount)
    if (isNaN(budgetValue) || budgetValue < 300) {
      setError('预算必须大于等于300元')
      return
    }

    const targetIds =
      budgetModifyDimension === 'account'
        ? parseAccountIds(budgetModifyAccountIds)
        : parseAccountIds(budgetModifyProjectIds)

    if (targetIds.length === 0) {
      setError(budgetModifyDimension === 'account' ? '请输入账户ID列表' : '请输入项目ID列表')
      return
    }

    setLoading(true)
    setError('')
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog(
      `开始批量修改预算（${budgetModifyDimension === 'account' ? '账户维度' : '项目维度'}），目标数: ${targetIds.length}`,
      'info'
    )

    try {
      const payload =
        budgetModifyDimension === 'account'
          ? {
              dimension: 'account' as const,
              account_ids: targetIds,
              budget: budgetValue,
              selected_cookie_id: selectedConfigId
            }
          : {
              dimension: 'project' as const,
              project_ids: targetIds,
              budget: budgetValue,
              selected_cookie_id: selectedConfigId
            }

      const response = await runPAssistantJob<ProjectBudgetModifyResponse>(
        'project_budget_modify',
        payload as unknown as Record<string, unknown>
      )

      if (response.code !== 0) {
        throw new Error(response.error || response.msg || '修改预算失败')
      }

      if (response.data) {
        const { total_success, total_error, account_results } = response.data
        addLog(
          `修改完成！成功: ${total_success}, 失败: ${total_error}`,
          total_error === 0 ? 'success' : 'info'
        )

        account_results?.forEach((result) => {
          if (result.error_count > 0) {
            addLog(`账户 ${result.account_id}: 失败 ${result.error_count} 个项目`, 'error')
            result.errors.forEach((err) => {
              addLog(`  - ${err}`, 'error')
            })
          }
          if (result.success_count === 0 && result.error_count === 0) {
            addLog(`账户 ${result.account_id}: 未找到可修改的项目`, 'info')
          }
        })
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '修改预算失败'
      setError(errorMessage)
      addLog(`失败: ${errorMessage}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PAssistantFeaturePanel
      title="项目预算修改"
      description="按账户或项目维度批量修改预算"
      icon={<TrendingUp />}
    >
      <div className="space-y-2">
        <Label className="text-base font-semibold">修改维度</Label>
        <RadioGroup
          value={budgetModifyDimension}
          onValueChange={(value) => setBudgetModifyDimension(value as 'account' | 'project')}
          disabled={loading}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="account" id="budget-dimension-account" />
            <Label htmlFor="budget-dimension-account" className="cursor-pointer">
              账户
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="project" id="budget-dimension-project" />
            <Label htmlFor="budget-dimension-project" className="cursor-pointer">
              项目
            </Label>
          </div>
        </RadioGroup>
      </div>

      {budgetModifyDimension === 'account' ? (
        <div className="grid gap-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="budget-modify-account-ids" className="text-base font-semibold">
              账户列表（一行一个）*
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBudgetModifyAccountIds('')}
              disabled={loading}
            >
              <X className="mr-2 w-4 h-4" />
              清空列表
            </Button>
          </div>
          <Textarea
            id="budget-modify-account-ids"
            placeholder="请输入账户ID，每行一个"
            value={budgetModifyAccountIds}
            onChange={(e) => setBudgetModifyAccountIds(e.target.value)}
            disabled={loading}
            className="min-h-[120px] resize-y font-mono text-sm"
            rows={5}
          />
          <p className="text-sm text-muted-foreground">
            已输入 {parseAccountIds(budgetModifyAccountIds).length} 个账户
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="budget-modify-project-ids" className="text-base font-semibold">
              项目列表（一行一个）*
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBudgetModifyProjectIds('')}
              disabled={loading}
            >
              <X className="mr-2 w-4 h-4" />
              清空列表
            </Button>
          </div>
          <Textarea
            id="budget-modify-project-ids"
            placeholder="请输入项目ID，每行一个"
            value={budgetModifyProjectIds}
            onChange={(e) => setBudgetModifyProjectIds(e.target.value)}
            disabled={loading}
            className="min-h-[120px] resize-y font-mono text-sm"
            rows={5}
          />
          <p className="text-sm text-muted-foreground">
            已输入 {parseAccountIds(budgetModifyProjectIds).length} 个项目
          </p>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="budget-modify-amount" className="text-base font-semibold">
          预算金额（元）*
        </Label>
        <Input
          id="budget-modify-amount"
          type="number"
          placeholder="请输入预算金额..."
          value={budgetModifyAmount}
          onChange={(e) => setBudgetModifyAmount(e.target.value)}
          disabled={loading}
          min="300"
          step="1"
          className="h-11"
        />
        <p className="text-sm text-muted-foreground">预算必须大于等于300元</p>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button
          onClick={handleProjectBudgetModify}
          disabled={
            loading ||
            !selectedConfigId ||
            !budgetModifyAmount.trim() ||
            (budgetModifyDimension === 'account'
              ? !budgetModifyAccountIds.trim()
              : !budgetModifyProjectIds.trim())
          }
          size="lg"
          className="min-w-[140px]"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              修改中...
            </>
          ) : (
            <>
              <TrendingUp className="mr-2 w-4 h-4" />
              确认修改
            </>
          )}
        </Button>
      </div>
    </PAssistantFeaturePanel>
  )
}
