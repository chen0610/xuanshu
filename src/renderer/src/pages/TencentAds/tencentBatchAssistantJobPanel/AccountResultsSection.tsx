import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, XCircle } from 'lucide-react'
import { Button } from '../../../components/ui'
import { copyToClipboard } from '../../../utils/helpers'
import type { AccountResultItem } from './jobUi'
import {
  formatAccountResultErrorMessage,
  formatAccountResultSuccessMessage,
  getAccountResultId,
  isAccountResultFailed
} from './jobUi'

interface AccountResultsSectionProps {
  accountResults: AccountResultItem[]
}

export const AccountResultsSection: React.FC<AccountResultsSectionProps> = ({
  accountResults
}) => {
  const { failedAccounts, successAccounts } = useMemo(() => {
    const failed = accountResults.filter((item) => isAccountResultFailed(item))
    const success = accountResults.filter((item) => !failed.includes(item))
    return { failedAccounts: failed, successAccounts: success }
  }, [accountResults])

  const [expanded, setExpanded] = useState(failedAccounts.length > 0 || accountResults.length <= 8)

  useEffect(() => {
    setExpanded(failedAccounts.length > 0 || accountResults.length <= 8)
  }, [accountResults, failedAccounts.length])

  if (accountResults.length === 0) return null

  const copyAccountIds = (failedOnly: boolean): void => {
    const source = failedOnly ? failedAccounts : successAccounts
    const ids = source.map((item, idx) => getAccountResultId(item, idx)).join('\n')
    if (ids) void copyToClipboard(ids)
  }

  const orderedResults = [...failedAccounts, ...successAccounts]

  return (
    <div className="rounded-lg border border-border/70">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium hover:text-primary"
          onClick={() => setExpanded((value) => !value)}
        >
          <span>
            账户结果 · 成功 {successAccounts.length} / 失败 {failedAccounts.length}
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
        </button>
        <div className="flex shrink-0 flex-wrap gap-1">
          {successAccounts.length > 0 ? (
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyAccountIds(false)}>
              复制成功 ID
            </Button>
          ) : null}
          {failedAccounts.length > 0 ? (
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyAccountIds(true)}>
              复制失败 ID
            </Button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="max-h-72 space-y-1 overflow-y-auto border-t px-2 py-2">
          {orderedResults.map((item, idx) => {
            const id = getAccountResultId(item, idx)
            const isFail = isAccountResultFailed(item)
            return (
              <div
                key={`${id}-${idx}`}
                className={`rounded-md p-2.5 text-sm ${
                  isFail
                    ? 'bg-red-50 dark:bg-red-950/20'
                    : 'bg-green-50 dark:bg-green-950/20'
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <span className="font-mono text-xs break-all">{id}</span>
                  <div className="flex min-w-0 items-start gap-2 sm:max-w-[65%] sm:justify-end">
                    {isFail ? (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    )}
                    <span
                      className={`min-w-0 text-xs leading-5 break-words ${
                        isFail ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {isFail
                        ? formatAccountResultErrorMessage(item)
                        : formatAccountResultSuccessMessage(item)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : failedAccounts.length > 0 ? (
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          {failedAccounts.length} 个账户失败，展开查看详情
        </div>
      ) : null}
    </div>
  )
}
