import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { motion } from 'framer-motion'
import { SquaresBackground, ThemeToggle } from '../components/common'
import logo from '../assets/logo.svg'

interface AuthLayoutProps {
  children: ReactNode
}

export const AuthLayout = ({ children }: AuthLayoutProps) => {
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="flex overflow-hidden relative justify-center items-center p-4 min-h-screen bg-background">
      {/* Squares 动态背景 */}
      <SquaresBackground
        direction="diagonal"
        speed={0.8}
        squareSize={40}
        borderColor="rgba(156, 163, 175, 0.2)"
        hoverFillColor="rgba(59, 130, 246, 0.1)"
        className="pointer-events-none"
      />

      {/* 背景装饰 */}
      <div className="overflow-hidden absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-20 left-20 w-64 h-64 rounded-full blur-3xl bg-primary/20"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div
          className="absolute right-20 bottom-20 w-96 h-96 rounded-full blur-3xl bg-purple-500/20"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 5, repeat: Infinity }}
        />
      </div>

      {/* Logo */}
      <motion.div
        className="flex absolute top-8 left-8 gap-3 items-center"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
      >
        <img src={logo} alt="玄枢" className="w-10 h-10" />
        <span className="text-xl font-bold">玄枢</span>
      </motion.div>

      {/* Theme Toggle */}
      <motion.div
        className="absolute top-8 right-8"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
      >
        <ThemeToggle />
      </motion.div>

      {/* Content */}
      <motion.div
        className="relative z-10 w-full"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
    </div>
  )
}
