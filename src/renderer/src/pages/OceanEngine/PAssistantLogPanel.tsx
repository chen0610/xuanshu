import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, FileText, Loader2, X, XCircle } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../../components/ui'
import type { PAssistantLogEntry } from './usePAssistantJobRunner'

interface PAssistantLogPanelProps {
  logs: PAssistantLogEntry[]
  loading: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onClear: () => void
}

export const PAssistantLogPanel: React.FC<PAssistantLogPanelProps> = ({
  logs,
  loading,
  open,
  onOpenChange,
  onClear
}) => {
  if (logs.length === 0 && !loading) {
    return null
  }

  return (
    <>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed right-6 bottom-6 z-50"
      >
        <Button
          onClick={() => onOpenChange(!open)}
          size="lg"
          className="relative p-0 w-14 h-14 rounded-full shadow-lg"
        >
          {loading ? (
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

      {open && (
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
                  {logs.length > 0 && !loading && (
                    <Button variant="ghost" size="sm" onClick={onClear} className="h-8 text-xs">
                      清空
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenChange(false)}
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
                  {logs.length === 0 && loading ? (
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
  )
}
