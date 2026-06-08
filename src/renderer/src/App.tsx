import { useEffect, type ReactNode } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './hooks/useAuth'
import { useThemeStore } from './stores/theme.store'
import { useUpdateStore } from './stores/update.store'
import { MainLayout } from './layouts/MainLayout'
import { AuthLayout } from './layouts/AuthLayout'
import { SidebarLayout } from './layouts/SidebarLayout'
import { LoginPage } from './pages/Auth/LoginPage'
import { RegisterPage } from './pages/Auth/RegisterPage'
import { RequireAdminOrManager } from './components/common/RequireAdminOrManager'
import { canUseOceanEngineBatchAdCreate } from './lib/ocean-engine-permissions'
import { FeishuCallback } from './pages/FeishuCallback'
import { OceanEngineOAuthCallback } from './pages/OceanEngineOAuthCallback'
import { UpdateDialog } from './components/UpdateDialog'
import { Toaster } from 'sonner'
import {
  sidebarModules,
  standaloneRoutes,
  type RouteGuard,
  type SidebarModuleRoutes
} from './config/routes'

// 创建 QueryClient 实例
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000 // 5 minutes
    }
  }
})

// ─── 权限守卫组件 ────────────────────────────────────────

function ChangduAdminRoute({ children }: { children: ReactNode }): React.JSX.Element {
  const { user } = useAuth()
  if (user?.role !== 'admin') {
    return <Navigate to="/changdu/manju-list" replace />
  }
  return <>{children}</>
}

function ChangduRootRedirect(): React.JSX.Element {
  const { user } = useAuth()
  const to = user?.role === 'admin' ? '/changdu/batch-upload' : '/changdu/manju-list'
  return <Navigate to={to} replace />
}

function OceanEngineBatchAdCreateRoute({ children }: { children: ReactNode }): React.JSX.Element {
  const { user } = useAuth()
  if (!canUseOceanEngineBatchAdCreate(user)) {
    return <Navigate to="/ocean-engine" replace />
  }
  return <>{children}</>
}

/** 根据 guard 类型包装子元素 */
function wrapGuard(guard: RouteGuard | undefined, children: ReactNode): ReactNode {
  switch (guard) {
    case 'admin-or-manager':
      return <RequireAdminOrManager>{children}</RequireAdminOrManager>
    case 'changdu-admin':
      return <ChangduAdminRoute>{children}</ChangduAdminRoute>
    case 'ocean-batch-ad-create':
      return <OceanEngineBatchAdCreateRoute>{children}</OceanEngineBatchAdCreateRoute>
    default:
      return children
  }
}

// ─── 路由渲染工具 ────────────────────────────────────────

/** 渲染带侧边栏的模块路由 */
function renderSidebarModuleRoutes(module: SidebarModuleRoutes): React.JSX.Element[] {
  return module.routes.map((route) => {
    const fullPath =
      route.subPath === '' ? module.basePath : `${module.basePath}/${route.subPath}`

    const content = wrapGuard(
      route.guard,
      <SidebarLayout config={module.sidebarConfig}>{route.element}</SidebarLayout>
    )

    return (
      <Route
        key={fullPath}
        path={fullPath}
        element={<MainLayout wide={route.wide}>{content}</MainLayout>}
      />
    )
  })
}

// ─── 主路由 ──────────────────────────────────────────────

function AppRoutes(): React.JSX.Element {
  const { checkAuth } = useAuth()
  const { theme, colorScheme } = useThemeStore()
  const { setStatus, setUpdateInfo, setProgress, setError, setDialogOpen } = useUpdateStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // 监听更新事件
  useEffect(() => {
    if (!window.api?.update) return undefined

    const unsubscribers: (() => void)[] = []

    unsubscribers.push(
      window.api.update.onUpdateChecking((meta: unknown) => {
        const { manual } = (meta ?? {}) as { manual?: boolean }
        setStatus('checking')
        if (manual) setDialogOpen(true)
      })
    )

    unsubscribers.push(
      window.api.update.onUpdateAvailable((info: unknown) => {
        const { silent, ...updateInfo } = info as {
          version: string
          releaseNotes?: string
          releaseDate?: string
          silent?: boolean
        }
        setStatus('downloading')
        setUpdateInfo(updateInfo)
        if (!silent) setDialogOpen(true)
      })
    )

    unsubscribers.push(
      window.api.update.onUpdateNotAvailable((meta: unknown) => {
        const { manual } = (meta ?? {}) as { manual?: boolean }
        setStatus('not-available')
        if (manual) setDialogOpen(true)
      })
    )

    unsubscribers.push(
      window.api.update.onDownloadProgress((progressData: unknown) => {
        const progress = progressData as {
          percent: number
          bytesPerSecond: number
          transferred: number
          total: number
        }
        setStatus('downloading')
        setProgress(progress)
      })
    )

    unsubscribers.push(
      window.api.update.onUpdateDownloaded((info: unknown) => {
        const { silent, ...updateInfo } = info as {
          version: string
          releaseNotes?: string
          releaseDate?: string
          silent?: boolean
        }
        setStatus('downloaded')
        setUpdateInfo(updateInfo)
        if (!silent) setDialogOpen(true)
      })
    )

    unsubscribers.push(
      window.api.update.onUpdateError((errorData: unknown) => {
        const error = errorData as { message: string; manual?: boolean }
        setError(error.message)
        if (error.manual) setDialogOpen(true)
      })
    )

    unsubscribers.push(
      window.api.update.onUpdateShowDialog(() => {
        setDialogOpen(true)
      })
    )

    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  }, [setStatus, setUpdateInfo, setProgress, setError, setDialogOpen])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme, colorScheme])

  return (
    <Routes>
      {/* 认证路由 */}
      <Route
        path="/auth/login"
        element={
          <AuthLayout>
            <LoginPage />
          </AuthLayout>
        }
      />
      <Route
        path="/auth/register"
        element={
          <AuthLayout>
            <RegisterPage />
          </AuthLayout>
        }
      />

      {/* 独立页面路由（无侧边栏） */}
      {standaloneRoutes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={<MainLayout>{wrapGuard(route.guard, route.element)}</MainLayout>}
        />
      ))}

      {/* 侧边栏模块路由 */}
      {sidebarModules.flatMap(renderSidebarModuleRoutes)}

      {/* 常读助手根路径重定向 */}
      <Route
        path="/changdu"
        element={
          <MainLayout>
            <ChangduRootRedirect />
          </MainLayout>
        }
      />

      {/* OAuth 回调 */}
      <Route path="/feishu/callback" element={<FeishuCallback />} />
      <Route path="/ocean-engine-oauth/callback" element={<OceanEngineOAuthCallback />} />

      {/* 默认重定向 */}
      <Route path="/" element={<Navigate to="/config" replace />} />
      <Route path="*" element={<Navigate to="/config" replace />} />
    </Routes>
  )
}

function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AppRoutes />
        <UpdateDialog />
        <Toaster position="top-right" richColors />
      </HashRouter>
    </QueryClientProvider>
  )
}

export default App
