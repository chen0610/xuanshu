import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { Navbar } from '../components/common/Navbar'
import { Loading } from '../components/common'
import { cn } from '../lib/utils'

interface MainLayoutProps {
  children: ReactNode
  wide?: boolean
}

export const MainLayout = ({ children, wide = false }: MainLayoutProps): React.JSX.Element => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <Loading fullScreen message="正在初始化..." />
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/[0.05] to-transparent" />
        <Navbar />
        <motion.main
          className={cn(
            'relative z-10 mx-auto px-4 pb-8 pt-20 sm:px-6 lg:px-8',
            wide ? 'w-full max-w-none 2xl:px-4' : 'max-w-[1600px]'
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  )
}
