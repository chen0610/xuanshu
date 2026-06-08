import React, { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity } from 'lucide-react'
import { Button } from '../../components/ui'
import { pAssistantServiceExtended } from '../../services/ocean-engine.service'
import { PAssistantJobPanel } from './pAssistantJobPanel/PAssistantJobPanel'

export { PAssistantJobPanel } from './pAssistantJobPanel/PAssistantJobPanel'
export type { PAssistantRetryMode } from './pAssistantJobPanel/jobUi'

export const PAssistantJobCenter: React.FC<{
  refreshToken: number
  focusJobId: number | null
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}> = ({ refreshToken, focusJobId, isOpen, onOpen, onClose }) => {
  const [activeCount, setActiveCount] = useState(0)

  const refreshActiveCount = useCallback(async () => {
    try {
      const response = await pAssistantServiceExtended.listJobs({
        page: 1,
        page_size: 20
      })
      const count = response.items.filter(
        (j) => j.status === 'pending' || j.status === 'running'
      ).length
      setActiveCount(count)
    } catch {
      /* ignore badge fetch errors */
    }
  }, [])

  useEffect(() => {
    void refreshActiveCount()
  }, [refreshToken, refreshActiveCount])

  useEffect(() => {
    if (isOpen) return undefined
    const timer = window.setInterval(() => void refreshActiveCount(), 5000)
    return () => window.clearInterval(timer)
  }, [isOpen, refreshActiveCount])

  const showBadge = activeCount > 0

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 top-16 z-40 bg-background/40 backdrop-blur-[1px]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-y-0 right-0 z-50 flex w-[min(1080px,92vw)] flex-col border-l border-border/70 bg-card shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <PAssistantJobPanel
              refreshToken={refreshToken}
              focusJobId={focusJobId}
              onClose={onClose}
              onActiveCountChange={setActiveCount}
            />
          </motion.div>
        </div>
      ) : null}

      <Button
        type="button"
        onClick={isOpen ? onClose : onOpen}
        className="fixed bottom-24 right-0 z-50 min-h-32 w-12 rounded-l-2xl rounded-r-none px-2 py-4 shadow-2xl sm:bottom-28"
      >
        <span className="relative flex flex-col items-center gap-2 [writing-mode:vertical-rl]">
          <Activity className="h-5 w-5 [writing-mode:horizontal-tb]" />
          <span className="tracking-widest">任务记录</span>
          {showBadge ? (
            <span className="absolute -left-1 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground [writing-mode:horizontal-tb]">
              {activeCount > 99 ? '99+' : activeCount}
            </span>
          ) : null}
          {focusJobId && !showBadge ? (
            <span className="rounded-full bg-primary-foreground/20 px-1.5 py-1 text-xs tracking-normal [writing-mode:horizontal-tb]">
              #{focusJobId}
            </span>
          ) : null}
        </span>
      </Button>
    </>
  )
}
