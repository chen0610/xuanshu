import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

/** 仅 admin / manager 可访问子路由，否则回首页 */
export function RequireAdminOrManager({ children }: { children: ReactNode }): React.JSX.Element {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />
  }

  if (user?.role !== 'admin' && user?.role !== 'manager') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
