import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

interface LoadingProps {
  message?: string
  fullScreen?: boolean
}

export const Loading = ({ message = 'Loading...', fullScreen = false }: LoadingProps) => {
  const content = (
    <div className="flex flex-col items-center justify-center gap-6">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <motion.p
        className="text-muted-foreground uppercase tracking-widest"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {message}
      </motion.p>
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center">
        {content}
      </div>
    )
  }

  return <div className="py-12">{content}</div>
}
