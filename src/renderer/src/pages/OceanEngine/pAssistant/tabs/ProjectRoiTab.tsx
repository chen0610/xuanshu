import React from 'react'
import { Loader2, Percent, X } from 'lucide-react'
import { Button, Input, Label, RadioGroup, RadioGroupItem, Textarea } from '../../../../components/ui'
import { PAssistantFeaturePanel } from '../../PAssistantFeaturePanel'
import { parseAccountIds } from '../../pAssistantUtils'
import { persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import type { ProjectBudgetModifyResponse } from '../../../../services/ocean-engine.service'

export const ProjectRoiTab: React.FC = () => {
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

  const [roiModifyDimension, setRoiModifyDimension] = usePersistedState<'account' | 'project'>(
    'p-assistant-roi-modify-dimension',
    'account',
    { deserialize: (raw) => (raw === 'project' ? 'project' : 'account') }
  )
  const [roiModifyAccountIds, setRoiModifyAccountIds] = usePersistedState<string>(
    'p-assistant-roi-modify-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [roiModifyProjectIds, setRoiModifyProjectIds] = usePersistedState<string>(
    'p-assistant-roi-modify-project-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [roiModifyValue, setRoiModifyValue] = usePersistedState<string>(
    'p-assistant-roi-modify-value',
    '',
    { shouldPersist: persistNonEmptyString }
  )

  const handleProjectRoiModify = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个引擎账户')
      return
    }

    const roiGoal = parseFloat(roiModifyValue)
    if (isNaN(roiGoal) || roiGoal <= 0) {
      setError('项目ROI系数必须为大于0的数字')
      return
    }

    const targetIds =
      roiModifyDimension === 'account'
        ? parseAccountIds(roiModifyAccountIds)
        : parseAccountIds(roiModifyProjectIds)

    if (targetIds.length === 0) {
      setError(roiModifyDimension === 'account' ? '请输入账户ID列表' : '请输入项目ID列表')
      return
    }

    setLoading(true)
    setError('')
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog(
      `开始批量修改项目ROI（${roiModifyDimension === 'account' ? '账户维度' : '项目维度'}），目标数: ${targetIds.length}`,
      'info'
    )

    try {
      const payload =
        roiModifyDimension === 'account'
          ? {
              dimension: 'account' as const,
              account_ids: targetIds,
              roi_goal: roiGoal,
              selected_cookie_id: selectedConfigId
            }
          : {
              dimension: 'project' as const,
              project_ids: targetIds,
              roi_goal: roiGoal,
              selected_cookie_id: selectedConfigId
            }

      const response = await runPAssistantJob<ProjectBudgetModifyResponse>(
        'project_roi_modify',
        payload as unknown as Record<string, unknown>
      )

      if (response.code !== 0) {
        throw new Error(response.error || response.msg || '修改项目ROI失败')
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
      const errorMessage = err instanceof Error ? err.message : '修改项目ROI失败'
      setError(errorMessage)
      addLog(`失败: ${errorMessage}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PAssistantFeaturePanel
      title="项目ROI修改"
      description="按账户或项目维度批量修改项目ROI系数（巨量 batch_update_roi_bid）"
      icon={<Percent />}
    >
      <div className="space-y-2">
        <Label className="text-base font-semibold">修改维度</Label>
        <RadioGroup
          value={roiModifyDimension}
          onValueChange={(value) => setRoiModifyDimension(value as 'account' | 'project')}
          disabled={loading}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="account" id="roi-dimension-account" />
            <Label htmlFor="roi-dimension-account" className="cursor-pointer">
              账户
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="project" id="roi-dimension-project" />
            <Label htmlFor="roi-dimension-project" className="cursor-pointer">
              项目
            </Label>
          </div>
        </RadioGroup>
      </div>

      {roiModifyDimension === 'account' ? (
        <div className="grid gap-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="roi-modify-account-ids" className="text-base font-semibold">
              账户列表（一行一个）*
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRoiModifyAccountIds('')}
              disabled={loading}
            >
              <X className="mr-2 w-4 h-4" />
              清空列表
            </Button>
          </div>
          <Textarea
            id="roi-modify-account-ids"
            placeholder="请输入账户ID，每行一个"
            value={roiModifyAccountIds}
            onChange={(e) => setRoiModifyAccountIds(e.target.value)}
            disabled={loading}
            className="min-h-[120px] resize-y font-mono text-sm"
            rows={5}
          />
          <p className="text-sm text-muted-foreground">
            已输入 {parseAccountIds(roiModifyAccountIds).length} 个账户
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="roi-modify-project-ids" className="text-base font-semibold">
              项目列表（一行一个）*
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRoiModifyProjectIds('')}
              disabled={loading}
            >
              <X className="mr-2 w-4 h-4" />
              清空列表
            </Button>
          </div>
          <Textarea
            id="roi-modify-project-ids"
            placeholder="请输入项目ID，每行一个"
            value={roiModifyProjectIds}
            onChange={(e) => setRoiModifyProjectIds(e.target.value)}
            disabled={loading}
            className="min-h-[120px] resize-y font-mono text-sm"
            rows={5}
          />
          <p className="text-sm text-muted-foreground">
            已输入 {parseAccountIds(roiModifyProjectIds).length} 个项目
          </p>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="roi-modify-value" className="text-base font-semibold">
          项目ROI系数 *
        </Label>
        <Input
          id="roi-modify-value"
          type="number"
          placeholder="例如 0.9"
          value={roiModifyValue}
          onChange={(e) => setRoiModifyValue(e.target.value)}
          disabled={loading}
          min="0"
          step="0.01"
          className="h-11"
        />
        <p className="text-sm text-muted-foreground">
          对应巨量接口 roi_goal_map，须为大于 0 的数值（如 0.9）
        </p>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button
          onClick={handleProjectRoiModify}
          disabled={
            loading ||
            !selectedConfigId ||
            !roiModifyValue.trim() ||
            (roiModifyDimension === 'account'
              ? !roiModifyAccountIds.trim()
              : !roiModifyProjectIds.trim())
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
              <Percent className="mr-2 w-4 h-4" />
              确认修改
            </>
          )}
        </Button>
      </div>
    </PAssistantFeaturePanel>
  )
}
