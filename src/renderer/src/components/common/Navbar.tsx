import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BarChart3,
  ChevronDown,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Settings2,
  Users,
  Waves,
  Workflow
} from 'lucide-react'
import { toast } from 'sonner'
import { authService } from '../../services/auth.service'
import { useAuth } from '../../hooks/useAuth'
import { Button, ThemeSelector, ThemeToggle } from './index'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label
} from '../ui'
import logo from '../../assets/logo.svg'
import type { UserRole } from '../../types/user.types'

type NavItem = {
  path: string
  label: string
  icon: typeof LayoutDashboard
  /** 仅这些角色可见；不填则所有已登录用户可见 */
  roles?: readonly UserRole[]
}

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const handleCheckForUpdates = async (): Promise<void> => {
    if (!window.api?.update) {
      alert('更新功能仅在 Electron 应用中可用')
      return
    }

    setCheckingUpdate(true)
    try {
      await window.api.update.checkForUpdates()
    } catch (error) {
      console.error('Failed to check for updates:', error)
    } finally {
      setTimeout(() => setCheckingUpdate(false), 1000)
    }
  }

  const resetPasswordForm = (): void => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const handlePasswordDialogChange = (open: boolean): void => {
    setPasswordDialogOpen(open)
    if (!open) resetPasswordForm()
  }

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('请完整填写密码信息')
      return
    }
    if (newPassword.length < 6) {
      toast.error('新密码长度至少为 6 个字符')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致')
      return
    }
    if (currentPassword === newPassword) {
      toast.error('新密码不能与当前密码相同')
      return
    }

    setChangingPassword(true)
    try {
      await authService.changePassword({
        current_password: currentPassword,
        new_password: newPassword
      })
      toast.success('密码修改成功，请重新登录')
      handlePasswordDialogChange(false)
      logout()
      navigate('/auth/login', { replace: true })
    } catch (error: any) {
      toast.error(error?.message || '密码修改失败')
    } finally {
      setChangingPassword(false)
    }
  }

  const navItems: NavItem[] = [
    { path: '/dashboard', label: '首页', icon: LayoutDashboard },
    { path: '/ocean-engine', label: '巨量', icon: Waves },
    { path: '/tencent-ads', label: '腾讯', icon: BarChart3 },
    { path: '/changdu', label: '常读', icon: Workflow },
    { path: '/config', label: '配置', icon: Settings2 },
    { path: '/users', label: '用户管理', icon: Users, roles: ['admin', 'manager'] }
  ]

  const visibleNavItems = navItems.filter((item) => {
    if (!item.roles) return true
    const r = user?.role
    return !!r && item.roles.includes(r)
  })

  const isActivePath = (path: string): boolean => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <>
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border/70 bg-background/88 backdrop-blur supports-[backdrop-filter]:bg-background/78">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/dashboard" className="flex-shrink-0">
            <motion.div
              className="flex items-center gap-3"
              whileHover={{ y: -1 }}
              whileTap={{ y: 0 }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-card">
                <img src={logo} alt="玄枢" className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight">玄枢</p>
                <p className="text-xs text-muted-foreground">广告运营工作台</p>
              </div>
            </motion.div>
          </Link>

          {isAuthenticated && (
            <div className="flex min-w-0 flex-1 items-center justify-end gap-4">
              <div className="hidden items-center gap-1 rounded-2xl border border-border/70 bg-card/70 p-1 md:flex">
                {visibleNavItems.map((item) => {
                  const isActive = isActivePath(item.path)
                  const Icon = item.icon

                  return (
                    <Link key={item.path} to={item.path}>
                      <motion.div
                        className={`relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                          isActive
                            ? 'bg-accent text-foreground'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                        }`}
                        whileHover={{ y: -1 }}
                        whileTap={{ y: 0 }}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                        {isActive && (
                          <motion.div
                            layoutId="navbar-indicator"
                            className="absolute inset-0 -z-10 rounded-xl border border-border/70 bg-accent"
                            transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
                          />
                        )}
                      </motion.div>
                    </Link>
                  )
                })}
              </div>

              <div className="flex items-center gap-2 border-l border-border/70 pl-3">
                <ThemeToggle />
                <ThemeSelector />
                {/* <Button
                variant="outline"
                size="sm"
                onClick={handleCheckForUpdates}
                disabled={checkingUpdate}
                className="hidden rounded-xl border-border/70 bg-card/70 px-3 text-muted-foreground hover:bg-accent hover:text-foreground lg:inline-flex"
              >
                {checkingUpdate ? '检查中...' : '检查更新'}
              </Button> */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-11 rounded-2xl border border-transparent px-2 transition-colors duration-200 hover:border-border/70 hover:bg-card"
                    >
                      <div className="flex items-center gap-3 px-1">
                        <div className="hidden flex-col items-end sm:flex">
                          <p className="text-sm font-semibold leading-none">{user?.name}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {user?.role || '普通用户'}
                          </p>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-muted text-xs font-bold text-foreground">
                          <span>{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
                        </div>
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 rounded-2xl border-border/70 bg-popover/95 p-2"
                    sideOffset={8}
                  >
                    <DropdownMenuLabel className="p-2 font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-semibold leading-none">{user?.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="my-2" />
                    <DropdownMenuItem
                      onSelect={() => setPasswordDialogOpen(true)}
                      className="cursor-pointer rounded-xl"
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      <span>修改密码</span>
                    </DropdownMenuItem>
                    {/* <DropdownMenuItem
                    onClick={handleCheckForUpdates}
                    disabled={checkingUpdate}
                    className="cursor-pointer rounded-xl"
                  >
                    <span>{checkingUpdate ? '正在检查更新...' : '检查更新'}</span>
                  </DropdownMenuItem> */}
                    <DropdownMenuItem
                      onClick={logout}
                      className="cursor-pointer rounded-xl text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>退出登录</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </div>
      </nav>

      <Dialog open={passwordDialogOpen} onOpenChange={handlePasswordDialogChange}>
        <DialogContent className="rounded-2xl border-border/70 sm:max-w-[420px]">
          <form onSubmit={handleChangePassword} className="space-y-5">
            <DialogHeader>
              <DialogTitle>修改密码</DialogTitle>
              <DialogDescription>请输入当前密码并设置一个新的登录密码。</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">当前密码</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  disabled={changingPassword}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">新密码</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  disabled={changingPassword}
                />
                <p className="text-xs text-muted-foreground">至少 6 个字符。</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">确认新密码</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  disabled={changingPassword}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handlePasswordDialogChange(false)}
                disabled={changingPassword}
              >
                取消
              </Button>
              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? '保存中...' : '确认修改'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
