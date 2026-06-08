import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle, Loader2, Tag, XCircle } from 'lucide-react'
import {
  Button,
  Label,
  Textarea,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from '../../../../components/ui'
import { parseAccountIds } from '../../pAssistantUtils'
import { persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import type { AccountNameModifyResponse } from '../../../../services/ocean-engine.service'

const parseAccountNames = (value: string): string[] =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

export const AccountNameModifyTab: React.FC = () => {
  const { selectedConfigId, loading, setLoading, setError, addLog, clearLogs, setIsBottomPanelOpen, runPAssistantJob } =
    usePAssistantContext()

  const [accountNameModifyAccountIds, setAccountNameModifyAccountIds] = usePersistedState<string>(
    'p-assistant-account-name-modify-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [accountNameModifyNames, setAccountNameModifyNames] = usePersistedState<string>(
    'p-assistant-account-name-modify-names',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [accountNameModifyResults, setAccountNameModifyResults] =
    useState<AccountNameModifyResponse | null>(null)

  const handleAccountNameModifySubmit = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个引擎账户')
      return
    }

    const accountIdList = parseAccountIds(accountNameModifyAccountIds)
    const accountNames = parseAccountNames(accountNameModifyNames)
    if (accountIdList.length === 0) {
      setError('请输入账户ID列表')
      return
    }
    if (accountNames.length === 0) {
      setError('请输入账户名称列表')
      return
    }
    if (accountIdList.length !== accountNames.length) {
      setError(
        `账户列表和账户名称数量必须一致：当前账户 ${accountIdList.length} 个，名称 ${accountNames.length} 个`
      )
      return
    }

    setLoading(true)
    setError('')
    setAccountNameModifyResults(null)
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog(`开始批量修改账户名称，共 ${accountIdList.length} 个账户`, 'info')

    try {
      const response = await runPAssistantJob<AccountNameModifyResponse>('account_name_modify', {
        selected_cookie_id: selectedConfigId,
        account_ids: accountIdList,
        account_names: accountNames
      })
      setAccountNameModifyResults(response)

      if (response.code !== 0) {
        throw new Error(response.error || response.msg || '账户名称修改失败')
      }

      if (response.data) {
        addLog(
          `账户名称修改完成：成功 ${response.data.total_success}，失败 ${response.data.total_error}`,
          response.data.total_error === 0 ? 'success' : 'info'
        )
        response.data.results
          .filter((item) => !item.success)
          .slice(0, 20)
          .forEach((item) => {
            addLog(`账户 ${item.account_id}: ${item.error || '修改失败'}`, 'error')
          })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '账户名称修改失败'
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
              <Tag className="w-4 h-4 text-primary" />
            </div>
            账户名称修改
          </CardTitle>
          <CardDescription>
            按行一一对应批量修改巨量账户名称，使用当前 Cookie 配置的多 Cookie 模式执行
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor="account-name-modify-account-ids"
                className="text-base font-semibold"
              >
                账户列表（一行一个） *
              </Label>
              <Textarea
                id="account-name-modify-account-ids"
                placeholder="请输入账户ID，每行一个..."
                value={accountNameModifyAccountIds}
                onChange={(e) => setAccountNameModifyAccountIds(e.target.value)}
                disabled={loading}
                className="min-h-[180px] resize-y font-mono"
                rows={8}
              />
              <p className="text-sm text-muted-foreground">
                已输入 {parseAccountIds(accountNameModifyAccountIds).length} 个账户
              </p>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="account-name-modify-names"
                className="text-base font-semibold"
              >
                账户名称（一行一个） *
              </Label>
              <Textarea
                id="account-name-modify-names"
                placeholder="请输入新账户名称，每行一个，需与左侧账户逐行对应..."
                value={accountNameModifyNames}
                onChange={(e) => setAccountNameModifyNames(e.target.value)}
                disabled={loading}
                className="min-h-[180px] resize-y"
                rows={8}
              />
              <p className="text-sm text-muted-foreground">
                已输入 {parseAccountNames(accountNameModifyNames).length} 个名称
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleAccountNameModifySubmit}
              disabled={
                loading ||
                !selectedConfigId ||
                !accountNameModifyAccountIds.trim() ||
                !accountNameModifyNames.trim()
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
                  <ArrowRight className="mr-2 w-4 h-4" />
                  确定修改
                </>
              )}
            </Button>
          </div>

          {accountNameModifyResults?.data && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 mt-4 rounded-lg border bg-muted/50"
            >
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">修改结果</h4>
                <div className="flex gap-3 text-sm">
                  <span className="text-green-600">
                    成功: {accountNameModifyResults.data.total_success}
                  </span>
                  <span className="text-red-600">
                    失败: {accountNameModifyResults.data.total_error}
                  </span>
                </div>
              </div>
              <div className="overflow-y-auto space-y-1 max-h-60">
                {accountNameModifyResults.data.results.map((item) => (
                  <div
                    key={item.account_id}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      item.success
                        ? 'bg-green-50 dark:bg-green-950/20'
                        : 'bg-red-50 dark:bg-red-950/20'
                    }`}
                  >
                    <span className="font-mono">{item.account_id}</span>
                    <div className="flex gap-2 items-center min-w-0">
                      {item.success ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-green-600 truncate">
                            已修改为：{item.account_name}
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-red-600 truncate">
                            {item.error || '修改失败'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
