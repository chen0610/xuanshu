import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, ChevronDown, ChevronUp, Loader2, Trash2, XCircle } from 'lucide-react'
import { Button } from '../../../components/ui'
import { usePAssistantContext } from './PAssistantContext'
import type { PAssistantLogEntry } from '../usePAssistantJobRunner'

export const PAssistantBottomPanel: React.FC = () => {
  const { logs, loading, clearLogs, isBottomPanelOpen, setIsBottomPanelOpen } = usePAssistantContext()

  const lastLog = logs[logs.length - 1]

  return (
    <div className="flex-shrink-0 border-t border-border/70 bg-card/95">
      <button
        type="button"
        onClick={() => setIsBottomPanelOpen(!isBottomPanelOpen)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2 text-sm transition-colors hover:bg-accent/40"
      >
        <div className="flex min-w-0 items-center gap-3">
          {loading && <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-primary" />}
          {lastLog ? (
            <span className="truncate text-xs text-muted-foreground">
              <LogIcon type={lastLog.type} />
              {lastLog.message}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">操作日志</span>
          )}
          {logs.length > 0 && (
            <span className="flex-shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {logs.length}
            </span>
          )}
        </div>
        {isBottomPanelOpen ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isBottomPanelOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 280, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/50"
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border/50 px-4 py-1.5">
                <span className="text-xs font-medium text-muted-foreground">操作日志</span>
                {logs.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearLogs} className="h-7 gap-1 text-xs">
                    <Trash2 className="h-3 w-3" />
                    清空
                  </Button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                <LogList logs={logs} loading={loading} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function LogIcon({ type }: { type: PAssistantLogEntry['type'] }) {
  if (type === 'error') return <XCircle className="mr-1.5 inline h-3 w-3 text-destructive" />
  if (type === 'success') return <CheckCircle className="mr-1.5 inline h-3 w-3 text-emerald-500" />
  return null
}

function LogList({ logs, loading }: { logs: PAssistantLogEntry[]; loading: boolean }) {
  if (logs.length === 0 && !loading) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">暂无日志</div>
  }

  return (
    <div className="space-y-1 p-3 text-[13px]">
      {logs.map((log, index) => (
        <div
          key={index}
          className={`flex items-start gap-2 rounded-md px-2.5 py-1.5 ${
            log.type === 'error'
              ? 'bg-destructive/5 text-destructive'
              : log.type === 'success'
                ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                : 'text-muted-foreground'
          }`}
        >
          <span className="flex-shrink-0 pt-0.5 font-mono text-[10px] opacity-50">
            {log.timestamp.toLocaleTimeString()}
          </span>
          <span className="break-words leading-relaxed">{log.message}</span>
        </div>
      ))}
      {loading && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>执行中...</span>
        </div>
      )}
    </div>
  )
}
