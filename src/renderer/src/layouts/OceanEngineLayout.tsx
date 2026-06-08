import { ReactNode, useState, useEffect } from 'react'
import { OceanEngineSidebar } from '../components/common/OceanEngineSidebar'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'

interface OceanEngineLayoutProps {
  children: ReactNode
}

const STORAGE_KEY = 'ocean-engine-sidebar-collapsed'

export const OceanEngineLayout = ({ children }: OceanEngineLayoutProps): React.JSX.Element => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : false
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(isCollapsed))
  }, [isCollapsed])

  const handleToggle = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div className="relative flex min-h-screen theme-ocean">
      <OceanEngineSidebar isCollapsed={isCollapsed} onToggle={handleToggle} />
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
