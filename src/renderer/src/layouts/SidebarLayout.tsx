import { ReactNode, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'
import { BaseSidebar } from '../components/common/BaseSidebar'
import type { SidebarConfig } from '../config/sidebar'

interface SidebarLayoutProps {
  config: SidebarConfig
  children: ReactNode
}

export const SidebarLayout = ({ config, children }: SidebarLayoutProps): React.JSX.Element => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem(config.storageKey)
    return saved ? JSON.parse(saved) : false
  })

  useEffect(() => {
    localStorage.setItem(config.storageKey, JSON.stringify(isCollapsed))
  }, [isCollapsed, config.storageKey])

  return (
    <div className={cn('relative flex min-h-screen', config.themeClass)}>
      <BaseSidebar
        config={config}
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
      />
      <main
        className={cn(
          'flex-1 overflow-auto transition-all duration-300',
          isCollapsed ? 'ml-[76px]' : 'ml-[272px]'
        )}
      >
        <motion.div
          className="p-6 lg:p-8"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}
