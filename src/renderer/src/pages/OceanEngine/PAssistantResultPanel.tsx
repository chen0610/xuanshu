import React, { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle } from 'lucide-react'
import { Button } from '../../components/ui'

interface PAssistantResultItemBase {
  account_id: string | number
  success: boolean
  error?: string
}

interface PAssistantResultPanelProps<T extends PAssistantResultItemBase> {
  title: string
  totalSuccess: number
  totalError: number
  results: T[]
  copyToClipboard: (text: string) => void
  renderSuccessMessage: (result: T) => ReactNode
  renderErrorMessage?: (result: T) => ReactNode
}

export function PAssistantResultPanel<T extends PAssistantResultItemBase>({
  title,
  totalSuccess,
  totalError,
  results,
  copyToClipboard,
  renderSuccessMessage,
  renderErrorMessage = (result) => result.error || '失败'
}: PAssistantResultPanelProps<T>): React.ReactElement {
  const copyResultIds = (success: boolean): void => {
    const ids = results
      .filter((result) => result.success === success)
      .map((result) => result.account_id)
      .join('\n')
    copyToClipboard(ids)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 mt-4 rounded-lg border bg-muted/50"
    >
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold">{title}</h4>
        <div className="flex gap-2 items-center">
          <div className="flex gap-2 text-sm">
            <span className="text-green-600">成功: {totalSuccess}</span>
            <span className="text-red-600">失败: {totalError}</span>
          </div>
          <div className="flex gap-1">
            {totalSuccess > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyResultIds(true)}
                className="text-xs"
              >
                复制成功ID
              </Button>
            )}
            {totalError > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyResultIds(false)}
                className="text-xs"
              >
                复制失败ID
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="overflow-y-auto space-y-1 max-h-60">
        {results.map((result, index) => (
          <div
            key={index}
            className={`flex items-center justify-between p-2 rounded text-sm ${
              result.success ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'
            }`}
          >
            <span className="font-mono">{result.account_id}</span>
            <div className="flex gap-2 items-center">
              {result.success ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-green-600">{renderSuccessMessage(result)}</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-600">{renderErrorMessage(result)}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
