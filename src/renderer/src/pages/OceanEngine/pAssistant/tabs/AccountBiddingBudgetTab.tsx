import React from 'react'
import { motion } from 'framer-motion'
import { Loader2, Wallet, X } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Textarea,
  RadioGroup,
  RadioGroupItem,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from '../../../../components/ui'
import { parseAccountIds } from '../../pAssistantUtils'
import { persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import type { ProjectBudgetModifyResponse } from '../../../../services/ocean-engine.service'

export const AccountBiddingBudgetTab: React.FC = () => {
  const { selectedConfigId, loading, setLoading, setError, addLog, clearLogs, setIsBottomPanelOpen, runPAssistantJob } =
    usePAssistantContext()

  const [accountBiddingBudgetAccountIds, setAccountBiddingBudgetAccountIds] = usePersistedState(
    'p-assistant-account-bidding-budget-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [accountBiddingBudgetMode, setAccountBiddingBudgetMode] = usePersistedState<
    'unlimited' | 'specified'
  >('p-assistant-account-bidding-budget-mode', 'specified', {
    deserialize: (raw) => (raw === 'unlimited' ? 'unlimited' : 'specified')
  })
  const [accountBiddingBudgetAmount, setAccountBiddingBudgetAmount] = usePersistedState(
    'p-assistant-account-bidding-budget-amount',
    '',
    { shouldPersist: persistNonEmptyString }
  )

  const handleAccountBiddingBudgetModify = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个引擎账户')
      return
    }

    const targetIds = parseAccountIds(accountBiddingBudgetAccountIds)
    if (targetIds.length === 0) {
      setError('请输入账户ID列表')
      return
    }

    if (accountBiddingBudgetMode === 'specified') {
      const amount = parseFloat(accountBiddingBudgetAmount)
      if (isNaN(amount) || amount < 1) {
        setError('指定预算必须为大于等于1元的数字')
        return
      }
    }

    setLoading(true)
    setError('')
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog(`开始批量修改账户竞价日预算，目标账户数: ${targetIds.length}`, 'info')

    try {
      const payload =
        accountBiddingBudgetMode === 'unlimited'
          ? {
              account_ids: targetIds,
              budget_mode: 'unlimited' as const,
              selected_cookie_id: selectedConfigId
            }
          : {
              account_ids: targetIds,
              budget_mode: 'specified' as const,
              budget: parseFloat(accountBiddingBudgetAmount),
              selected_cookie_id: selectedConfigId
            }

      const response = await runPAssistantJob<ProjectBudgetModifyResponse>(
        'account_bidding_budget_modify',
        payload as unknown as Record<string, unknown>
      )

      if (response.code !== 0) {
        throw new Error(response.error || response.msg || '修改账户预算失败')
      }

      if (response.data) {
        const { total_success, total_error, account_results } = response.data
        addLog(
          `修改完成！成功: ${total_success}, 失败: ${total_error}`,
          total_error === 0 ? 'success' : 'info'
        )

        account_results?.forEach((result) => {
          if (result.success_count > 0) {
            addLog(`账户 ${result.account_id}: 竞价日预算已更新`, 'success')
          }
          if (result.error_count > 0) {
            addLog(`账户 ${result.account_id}: 失败 ${result.error_count} 次`, 'error')
            result.errors.forEach((err) => {
              addLog(`  - ${err}`, 'error')
            })
          }
          if (result.success_count === 0 && result.error_count === 0) {
            addLog(`账户 ${result.account_id}: 无结果`, 'info')
          }
        })
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '修改账户预算失败'
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
              <Wallet className="w-4 h-4 text-primary" />
            </div>
            账户预算修改
          </CardTitle>
          <CardDescription>
            批量修改账户竞价日预算（对应巨量账户管理 update_budget，type=1）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-base font-semibold">预算类型</Label>
            <RadioGroup
              value={accountBiddingBudgetMode}
              onValueChange={(value) =>
                setAccountBiddingBudgetMode(value as 'unlimited' | 'specified')
              }
              disabled={loading}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="unlimited" id="acc-budget-unlimited" />
                <Label htmlFor="acc-budget-unlimited" className="cursor-pointer">
                  不限预算
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="specified" id="acc-budget-specified" />
                <Label htmlFor="acc-budget-specified" className="cursor-pointer">
                  指定预算
                </Label>
              </div>
            </RadioGroup>
          </div>

          {accountBiddingBudgetMode === 'specified' ? (
            <div className="grid gap-2">
              <Label
                htmlFor="account-bidding-budget-amount"
                className="text-base font-semibold"
              >
                预算金额（元）*
              </Label>
              <Input
                id="account-bidding-budget-amount"
                type="number"
                placeholder="请输入预算金额..."
                value={accountBiddingBudgetAmount}
                onChange={(e) => setAccountBiddingBudgetAmount(e.target.value)}
                disabled={loading}
                min="1"
                step="1"
                className="h-11"
              />
              <p className="text-sm text-muted-foreground">指定预算须为大于等于 1 元</p>
            </div>
          ) : null}

          <div className="grid gap-2">
            <div className="flex justify-between items-center">
              <Label
                htmlFor="account-bidding-budget-account-ids"
                className="text-base font-semibold"
              >
                账户列表（一行一个）*
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAccountBiddingBudgetAccountIds('')}
                disabled={loading}
              >
                <X className="mr-2 w-4 h-4" />
                清空列表
              </Button>
            </div>
            <Textarea
              id="account-bidding-budget-account-ids"
              placeholder="请输入账户ID，每行一个"
              value={accountBiddingBudgetAccountIds}
              onChange={(e) => setAccountBiddingBudgetAccountIds(e.target.value)}
              disabled={loading}
              className="min-h-[120px] resize-y font-mono text-sm"
              rows={5}
            />
            <p className="text-sm text-muted-foreground">
              已输入 {parseAccountIds(accountBiddingBudgetAccountIds).length} 个账户
            </p>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleAccountBiddingBudgetModify}
              disabled={
                loading ||
                !selectedConfigId ||
                !accountBiddingBudgetAccountIds.trim() ||
                (accountBiddingBudgetMode === 'specified' &&
                  (!accountBiddingBudgetAmount.trim() ||
                    isNaN(parseFloat(accountBiddingBudgetAmount)) ||
                    parseFloat(accountBiddingBudgetAmount) < 1))
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
                  <Wallet className="mr-2 w-4 h-4" />
                  确认修改
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
