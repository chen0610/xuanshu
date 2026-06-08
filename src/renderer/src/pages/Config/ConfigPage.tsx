import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Trash2,
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  HelpCircle,
  Minus,
  Edit,
  Chromium,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Copy,
  ExternalLink,
  ShieldCheck,
  Settings2,
  QrCode
} from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  RadioGroup,
  RadioGroupItem,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Switch
} from '../../components/ui'
import { configService } from '../../services/config.service'
import type { OpenLoginWindowOptions } from '../../types/config.types'
import { FeishuBindingCard } from '../../components/FeishuBindingCard'
import { OceanEngineOAuthCard } from '../../components/OceanEngineOAuthCard'
import { QRCodeCanvas } from 'qrcode.react'

interface CookieConfig {
  id: number
  name: string
  cookie: string
  backup_cookies: string[]
  backup_statuses: boolean[]
  realname?: string
  type: 'ocean' | 'tencent' | 'changdu'
  status: boolean
  createdAt: number
}

interface MobileAccessState {
  enabled: boolean
  url?: string
  secretKey?: string
}

/** 去除空项与完全相同的 Cookie 字符串（保留首次出现顺序） */
function dedupeCookies(cookies: string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const item of cookies) {
    const value = item.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    unique.push(value)
  }
  return unique
}

const ConfigCard: React.FC<{
  config: CookieConfig
  onEdit: (config: CookieConfig) => void
  onDelete: (id: number) => void
  loading: boolean
  onMobileAccess?: (config: CookieConfig) => void
  showMobileAccess?: boolean
}> = ({ config, onEdit, onDelete, loading, onMobileAccess, showMobileAccess }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCopying, setIsCopying] = useState(false)

  const handleCopy = (text: string): void => {
    navigator.clipboard.writeText(text)
    setIsCopying(true)
    setTimeout(() => setIsCopying(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="relative p-4 rounded-xl border transition-all group bg-card hover:border-primary/50 hover:shadow-md border-border/60"
    >
      <div className="flex gap-4 justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex gap-3 items-center mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-base font-bold truncate text-foreground">{config.name}</span>
                {config.realname && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-muted text-muted-foreground uppercase tracking-wider">
                    {config.realname}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2 items-center shrink-0">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  config.status
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-rose-500/10 text-rose-600'
                }`}
              >
                <div className="flex relative w-2 h-2">
                  {config.status && (
                    <span className="inline-flex absolute w-full h-full bg-emerald-400 rounded-full opacity-75 animate-ping"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${config.status ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  ></span>
                </div>
                {config.status ? '在线' : '失效'}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex relative gap-2 items-center p-2 rounded-lg border border-transparent transition-all group/cookie bg-muted/30 hover:border-border/50">
              <code className="flex-1 font-mono text-xs truncate text-muted-foreground">
                {config.cookie.substring(0, 45)}...
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 opacity-0 transition-opacity group-hover/cookie:opacity-100"
                onClick={() => handleCopy(config.cookie)}
              >
                {isCopying ? (
                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </Button>
            </div>

            {config.backup_cookies.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  {isExpanded ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  更多 Cookie ({config.backup_cookies.length})
                </button>

                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 space-y-1.5 pl-2 border-l-2 border-muted"
                  >
                    {config.backup_cookies.map((cookie, idx) => (
                      <div
                        key={idx}
                        className="flex gap-2 items-center p-1.5 rounded-md bg-muted/20 text-[11px] text-muted-foreground group/backup"
                      >
                        <span className="opacity-60 shrink-0">#{idx + 1}</span>
                        <code className="flex-1 font-mono truncate">
                          {cookie.substring(0, 30)}...
                        </code>
                        <div
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            config.backup_statuses[idx]
                              ? 'bg-emerald-500/10 text-emerald-700'
                              : 'bg-rose-500/10 text-rose-700'
                          }`}
                        >
                          {config.backup_statuses[idx] ? '可用' : '失效'}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {showMobileAccess && onMobileAccess && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onMobileAccess(config)}
              className="w-8 h-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
              disabled={loading}
              title="移动端扫码授权"
            >
              <QrCode className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(config)}
            className="w-8 h-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
            disabled={loading}
          >
            <Edit className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

const ConfigSection: React.FC<{
  title: string
  type: 'ocean' | 'tencent' | 'changdu'
  configs: CookieConfig[]
  onAdd: (name: string, cookie: string, backupCookies: string[]) => Promise<number>
  onEdit: (id: number, name: string, cookie: string, backupCookies: string[]) => Promise<void>
  onDelete: (id: number) => void
  loading: boolean
  onMobileAccess?: (config: CookieConfig) => void
  showMobileAccess?: boolean
  description?: string
  className?: string
}> = ({
  title,
  type,
  configs,
  onAdd,
  onEdit,
  onDelete,
  loading,
  onMobileAccess,
  showMobileAccess,
  description,
  className
}) => {
  const [nameValue, setNameValue] = useState('')
  const [allCookies, setAllCookies] = useState<string[]>([''])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingConfigId, setEditingConfigId] = useState<number | null>(null)
  const [isEditingInvalidConfig, setIsEditingInvalidConfig] = useState(false) // 是否正在编辑失效账号
  const [backupLoginIndex, setBackupLoginIndex] = useState<number | null>(null) // 正在登录的Cookie索引
  // 批量登录相关状态
  const [isMultiLoginMode, setIsMultiLoginMode] = useState(false)
  const [multiLoginCount, setMultiLoginCount] = useState(3)
  const [isMultiLoginLoading, setIsMultiLoginLoading] = useState(false)
  const [collectedCount, setCollectedCount] = useState(0) // 已自动收集的Cookie数量
  const [remainingWindows, setRemainingWindows] = useState(0) // 剩余未关闭的窗口数
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [rememberLoginCredentials, setRememberLoginCredentials] = useState(false)
  const MIN_COOKIE_COUNT = type === 'changdu' ? 1 : 8
  const MAX_ACCOUNT_CONFIGS = type === 'ocean' || type === 'tencent' ? 10 : 5

  const resetLoginCredentialFields = (): void => {
    setLoginEmail('')
    setLoginPassword('')
    setRememberLoginCredentials(false)
  }

  const loadLoginCredentialsForConfig = (configId: number): void => {
    if (type !== 'ocean') return
    void window.api.getLoginCredentials(type, configId).then((res) => {
      if (res.hasStored && res.email) {
        setLoginEmail(res.email)
        setLoginPassword(res.password ?? '')
        setRememberLoginCredentials(true)
      } else {
        resetLoginCredentialFields()
      }
    })
  }

  const buildLoginOptions = (): OpenLoginWindowOptions | undefined => {
    const email = loginEmail.trim()
    if (!email || !loginPassword) return undefined
    return {
      email,
      password: loginPassword,
      remember: rememberLoginCredentials,
      configId: editingConfigId ?? undefined
    }
  }

  const persistLoginCredentialsAfterSave = async (configId: number): Promise<void> => {
    if (type !== 'ocean' || !window.api?.openLoginWindow) return
    const email = loginEmail.trim()
    await window.api.openLoginWindow(type, {
      configId,
      persistOnly: true,
      remember: rememberLoginCredentials,
      ...(rememberLoginCredentials && email && loginPassword
        ? { email, password: loginPassword }
        : {})
    })
  }

  const handleClearLoginCredentials = async (): Promise<void> => {
    if (editingConfigId) {
      await window.api.clearLoginCredentials(type, editingConfigId)
    }
    resetLoginCredentialFields()
  }

  // 监听自动收集的Cookie事件
  useEffect(() => {
    if (!isMultiLoginMode) return

    // 监听Cookie自动收集事件
    const unsubscribeCookie = window.api.onMultiLoginCookieCollected((data) => {
      if (data.success && data.cookies) {
        setAllCookies((current) => {
          const newCookies = [...current]
          const emptyIndex = newCookies.findIndex((c) => !c || !c.trim())
          if (emptyIndex !== -1 && emptyIndex < 11) {
            newCookies[emptyIndex] = data.cookies
          } else if (newCookies.length < 11) {
            newCookies.push(data.cookies)
          }
          return newCookies.slice(0, 11)
        })
        setCollectedCount((prev) => prev + 1)
      }
    })

    // 监听窗口关闭事件
    const unsubscribeClosed = window.api.onMultiLoginWindowClosed((_data) => {
      setRemainingWindows((prev) => {
        const newRemaining = prev - 1
        // 所有窗口都关闭后，退出批量模式
        if (newRemaining <= 0) {
          setTimeout(() => {
            setIsMultiLoginMode(false)
          }, 1000)
        }
        return newRemaining
      })
    })

    return () => {
      unsubscribeCookie()
      unsubscribeClosed()
    }
  }, [isMultiLoginMode])

  const handleAddCookie = (): void => {
    if (allCookies.length < 11) {
      setAllCookies([...allCookies, ''])
    }
  }

  const handleRemoveCookie = (index: number): void => {
    if (allCookies.length <= 1) return
    setAllCookies(allCookies.filter((_, i) => i !== index))
  }

  const handleCookieChange = (index: number, value: string): void => {
    const newCookies = [...allCookies]
    newCookies[index] = value
    setAllCookies(newCookies)
  }

  const handleCookieBrowserLogin = async (index: number): Promise<void> => {
    setBackupLoginIndex(index)
    setError('')
    try {
      const result = await window.api.openLoginWindow(type, buildLoginOptions())

      if (result.success && result.cookies) {
        setAllCookies((prev) => {
          const next = [...prev]
          if (index >= next.length) {
            while (next.length <= index) next.push('')
          }
          next[index] = result.cookies
          return next
        })
        setError('')
      } else if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      console.error('Browser login failed:', err)
      setError('打开登录窗口失败，请重试')
    } finally {
      setBackupLoginIndex(null)
    }
  }

  // 批量打开多个登录窗口获取多个备用Cookie（自动填入模式）
  const handleMultiBrowserLogin = async (): Promise<void> => {
    const currentTotal = dedupeCookies(allCookies).length
    const MAX_COOKIES = 11

    // 检查是否已满
    if (currentTotal >= MAX_COOKIES) {
      setError(`当前Cookie数量已达上限（${MAX_COOKIES}个），请先删除部分Cookie后再批量获取`)
      return
    }

    // 计算可用的Cookie槽位
    const availableSlots = MAX_COOKIES - currentTotal

    // 调整批量获取数量
    let adjustedCount = multiLoginCount
    if (multiLoginCount > availableSlots) {
      adjustedCount = availableSlots
      console.log(
        `批量获取数量已调整：${multiLoginCount} -> ${adjustedCount}（剩余槽位${availableSlots}个）`
      )
    }

    if (adjustedCount < 1) {
      setError(`当前Cookie数量已达上限（${MAX_COOKIES}个），请先删除部分Cookie后再批量获取`)
      return
    }

    setIsMultiLoginLoading(true)
    setError('')
    setIsMultiLoginMode(true)
    setCollectedCount(0)
    setRemainingWindows(adjustedCount)

    try {
      // 打开多个登录窗口（自动填入模式）
      const openResult = await window.api.openMultiLoginWindowsAuto(
        type,
        adjustedCount,
        buildLoginOptions()
      )

      if (!openResult.success) {
        setError(openResult.error || '打开登录窗口失败')
        setIsMultiLoginMode(false)
        return
      }

      // 显示提示信息（如果数量被调整，显示调整后的信息）
      if (adjustedCount !== multiLoginCount) {
        setError(
          `当前Cookie数量${currentTotal}个，已自动调整打开${adjustedCount}个窗口（上限${MAX_COOKIES}个），登录成功后将自动填入Cookie`
        )
      } else {
        setError(`已打开 ${adjustedCount} 个登录窗口，登录成功后将自动填入Cookie`)
      }
    } catch (err) {
      console.error('Multi browser login failed:', err)
      setError('打开多窗口登录失败，请重试')
      setIsMultiLoginMode(false)
    } finally {
      setIsMultiLoginLoading(false)
    }
  }

  // 取消批量登录，关闭所有窗口
  const handleCancelMultiLogin = async (): Promise<void> => {
    setIsMultiLoginLoading(true)
    try {
      await window.api.closeMultiLoginWindows()
      setIsMultiLoginMode(false)
      setError('')
    } catch (err) {
      console.error('Cancel multi login failed:', err)
    } finally {
      setIsMultiLoginLoading(false)
    }
  }

  const handleSubmit = async (): Promise<void> => {
    if (!nameValue.trim()) {
      setError('请输入Cookie名称')
      return
    }

    const filledCookieCount = allCookies.filter((c) => c && c.trim()).length
    const dedupedCookies = dedupeCookies(allCookies)
    const duplicateCount = filledCookieCount - dedupedCookies.length
    const mainCookieVal = dedupedCookies[0] || ''
    const backupCookiesVal = dedupedCookies.slice(1)

    if (!mainCookieVal) {
      setError('至少需要填写 1 个 Cookie')
      return
    }

    const uniqueCookieCount = dedupedCookies.length
    const duplicateHint =
      duplicateCount > 0 ? `，已去除 ${duplicateCount} 个重复项` : ''

    const cookieCountValid =
      type === 'changdu' ? uniqueCookieCount >= 1 : uniqueCookieCount > MIN_COOKIE_COUNT
    if (!cookieCountValid) {
      setError(
        type === 'changdu'
          ? `保存需要至少 1 个有效 Cookie（当前 ${uniqueCookieCount} 个）${duplicateHint}`
          : `Cookie 去重后需大于 8 个才能保存（当前 ${uniqueCookieCount} 个，至少 9 个）${duplicateHint}`
      )
      return
    }

    // 检查账号数量限制（只在添加模式下检查）
    if (!editingConfigId && filteredConfigs.length >= MAX_ACCOUNT_CONFIGS) {
      setError(`${title}最多只能添加${MAX_ACCOUNT_CONFIGS}个账号`)
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      let savedConfigId = editingConfigId
      if (editingConfigId) {
        await onEdit(
          editingConfigId,
          nameValue.trim(),
          mainCookieVal.trim(),
          backupCookiesVal.map((c) => c.trim())
        )
      } else {
        savedConfigId = await onAdd(
          nameValue.trim(),
          mainCookieVal.trim(),
          backupCookiesVal.map((c) => c.trim())
        )
      }
      if (savedConfigId) {
        await persistLoginCredentialsAfterSave(savedConfigId)
      }
      setNameValue('')
      setAllCookies([''])
      setEditingConfigId(null)
      setIsEditingInvalidConfig(false)
      resetLoginCredentialFields()
      setIsDialogOpen(false)
    } catch (err: unknown) {
      console.error('Failed to save config:', err)
      // 优先提取后端返回的 message 字段，如果没有则使用 detail，最后使用默认消息
      const errorMessage =
        (err as { message?: string })?.message ||
        (err as { detail?: string })?.detail ||
        'Cookie验证失败，请检查Cookie是否有效'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenDialog = (): void => {
    setIsDialogOpen(true)
    setError('')
    setNameValue('')
    setAllCookies([''])
    setEditingConfigId(null)
    setIsEditingInvalidConfig(false)
    setBackupLoginIndex(null)
    resetLoginCredentialFields()
  }

  const handleEdit = (config: CookieConfig): void => {
    setIsDialogOpen(true)
    setError('')
    setNameValue(config.name)
    setEditingConfigId(config.id)
    loadLoginCredentialsForConfig(config.id)

    // 如果账号失效，清空Cookie数据，只保留名称，并显示登录方式选择
    if (!config.status) {
      setAllCookies([''])
      setIsEditingInvalidConfig(true)
    } else {
      setAllCookies(
        type === 'changdu' ? [config.cookie] : [config.cookie, ...config.backup_cookies]
      )
      setIsEditingInvalidConfig(false)
    }
  }

  const handleCloseDialog = (): void => {
    if (!isSubmitting && backupLoginIndex === null) {
      setIsDialogOpen(false)
      setError('')
      setNameValue('')
      setAllCookies([''])
      setEditingConfigId(null)
      setIsEditingInvalidConfig(false)
      setBackupLoginIndex(null)
      resetLoginCredentialFields()
    }
  }

  const filteredConfigs = configs.filter((c) => c.type === type)
  const filledCookieCount = allCookies.filter((c) => c && c.trim()).length
  const dedupedCookiesPreview = dedupeCookies(allCookies)
  const uniqueCookieCount = dedupedCookiesPreview.length
  const duplicateCookieCount = filledCookieCount - uniqueCookieCount
  const isCookieCountEnough =
    type === 'changdu' ? uniqueCookieCount >= 1 : uniqueCookieCount > MIN_COOKIE_COUNT

  return (
    <div className={cn('flex flex-col space-y-6 h-full', className)}>
      <div className="flex flex-col gap-4 justify-between sm:flex-row sm:items-start">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {description || `管理${title}账号的登录凭据及备用 Cookie`}
          </p>
        </div>
        <Button
          onClick={handleOpenDialog}
          size="sm"
          className="h-9 shadow-sm"
          disabled={filteredConfigs.length >= MAX_ACCOUNT_CONFIGS}
        >
          <Plus className="mr-2 w-4 h-4" />
          添加账号
          {filteredConfigs.length >= MAX_ACCOUNT_CONFIGS && <span className="ml-1 text-xs">(已达上限)</span>}
        </Button>
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseDialog()
        }}
      >
        {/* ... (keep dialog content as is, just fix some spacing if needed) */}
        <DialogContent
          className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="overflow-y-auto p-6">
            <DialogHeader className="mb-6">
              <DialogTitle className="flex gap-2 items-center text-2xl font-bold">
                <ShieldCheck className="w-6 h-6 text-primary" />
                {editingConfigId ? '编辑' : '添加'}
                {title}配置
              </DialogTitle>
              <DialogDescription className="text-sm">
                系统将自动验证 Cookie 有效性并获取账号信息。
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {type === 'ocean' && (
                <div className="p-4 space-y-4 rounded-xl border bg-muted/30 border-muted/50">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">浏览器登录助手</Label>
                    <p className="text-xs text-muted-foreground">
                      打开登录弹窗时自动填入并点击登录；无滑块时将自动完成并回填 Cookie，有滑块时需手动验证。凭据按当前配置账号分别加密保存在本机，不会上传到服务器。
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`${type}-login-email`} className="text-xs text-muted-foreground">
                        登录邮箱
                      </Label>
                      <Input
                        id={`${type}-login-email`}
                        type="email"
                        placeholder="name@example.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        disabled={isSubmitting || backupLoginIndex !== null || isMultiLoginLoading}
                        className="h-9"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${type}-login-password`} className="text-xs text-muted-foreground">
                        登录密码
                      </Label>
                      <Input
                        id={`${type}-login-password`}
                        type="password"
                        placeholder="打开弹窗时自动填入"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        disabled={isSubmitting || backupLoginIndex !== null || isMultiLoginLoading}
                        className="h-9"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-between items-center">
                    <div className="flex gap-2 items-center">
                      <Switch
                        id={`${type}-remember-login`}
                        checked={rememberLoginCredentials}
                        onCheckedChange={setRememberLoginCredentials}
                        disabled={isSubmitting || backupLoginIndex !== null || isMultiLoginLoading}
                      />
                      <Label htmlFor={`${type}-remember-login`} className="text-xs cursor-pointer">
                        记住登录账号（本机加密）
                      </Label>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground"
                      onClick={() => void handleClearLoginCredentials()}
                      disabled={isSubmitting || backupLoginIndex !== null || isMultiLoginLoading}
                    >
                      清除本机登录信息
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor={`${type}-name`} className="text-sm font-medium">
                  Cookie 名称 <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id={`${type}-name`}
                  placeholder="例如：主账号-运营01"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  disabled={isSubmitting || backupLoginIndex !== null}
                  className="h-10 transition-all focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-medium">Cookie设置</Label>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                    去重 {uniqueCookieCount} / {type === 'changdu' ? 1 : 11}
                  </span>
                </div>
                <p
                  className={cn(
                    'text-xs',
                    isCookieCountEnough ? 'text-muted-foreground' : 'text-rose-500'
                  )}
                >
                  {type === 'changdu'
                    ? `保存要求：1 个 Cookie 即可（去重后 ${uniqueCookieCount} 个）`
                    : `保存要求：去重后 Cookie 需大于 8 个（当前 ${uniqueCookieCount} 个，至少 9 个），数量越多系统执行越快`}
                </p>
                {type !== 'changdu' && duplicateCookieCount > 0 && (
                  <p className="text-xs text-amber-600">
                    检测到 {duplicateCookieCount} 个重复 Cookie，保存时将自动去重且不计入数量
                  </p>
                )}
                {type !== 'changdu' && (
                  <p className="text-xs text-muted-foreground">
                    说明：所有 Cookie 必须来自同一个账号的同一套登录凭据
                  </p>
                )}

                <div className="space-y-3">
                  {(type === 'changdu' ? allCookies.slice(0, 1) : allCookies).map(
                    (cookie, index) => (
                      <div
                        key={index}
                        className="flex flex-col gap-2 p-3 rounded-xl border transition-all group/item bg-muted/20 border-muted/30 hover:bg-muted/40"
                      >
                        <div className="flex gap-2">
                          <Input
                            placeholder={`Cookie ${index + 1}`}
                            value={cookie}
                            onChange={(e) => handleCookieChange(index, e.target.value)}
                            disabled={isSubmitting || backupLoginIndex !== null}
                            className="flex-1 h-9 font-mono text-xs bg-background"
                          />
                          <div className="flex gap-1.5">
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              onClick={() => handleCookieBrowserLogin(index)}
                              disabled={isSubmitting || backupLoginIndex !== null}
                              className="w-9 h-9 shadow-sm"
                              title="从浏览器获取"
                            >
                              {backupLoginIndex === index ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Chromium className="w-4 h-4" />
                              )}
                            </Button>
                            {type !== 'changdu' && (
                              <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                onClick={() => handleRemoveCookie(index)}
                                disabled={
                                  isSubmitting ||
                                  backupLoginIndex !== null ||
                                  allCookies.length <= 1
                                }
                                className="w-9 h-9 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                              >
                                <Minus className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {cookie && (
                          <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-600">
                            <CheckCircle className="w-3 h-3" /> 已填充凭据
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {type !== 'changdu' && allCookies.length < 11 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddCookie}
                      disabled={isSubmitting || backupLoginIndex !== null || isMultiLoginLoading}
                      className="w-full h-10 border-2 border-dashed transition-all hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary"
                    >
                      <Plus className="mr-2 w-4 h-4" />
                      添加 Cookie
                    </Button>
                  )}

                  {/* 批量获取 Cookie - 常读只需1个cookie，不显示 */}
                  {type !== 'changdu' && (
                    <div className="pt-4 mt-4 border-t border-muted">
                      <div className="flex justify-between items-center mb-3">
                        <Label className="text-sm font-medium text-primary">批量获取 Cookie</Label>
                        <span className="text-xs text-muted-foreground">同时打开多个登录窗口</span>
                      </div>

                      {!isMultiLoginMode ? (
                        <div className="flex gap-2">
                          <select
                            value={multiLoginCount}
                            onChange={(e) => setMultiLoginCount(parseInt(e.target.value))}
                            disabled={isMultiLoginLoading}
                            className="px-3 py-2 h-10 text-sm rounded-md border bg-background"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                              <option key={num} value={num}>
                                {num} 个窗口
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleMultiBrowserLogin}
                            disabled={
                              isSubmitting || backupLoginIndex !== null || isMultiLoginLoading
                            }
                            className="flex-1 h-10 shadow-sm"
                          >
                            {isMultiLoginLoading ? (
                              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                            ) : (
                              <ExternalLink className="mr-2 w-4 h-4" />
                            )}
                            批量打开登录窗口
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* 实时进度显示 */}
                          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-emerald-700">
                                自动收集中...
                              </span>
                              <span className="text-xs text-emerald-600">
                                已收集 {collectedCount} / {multiLoginCount}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-emerald-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 transition-all duration-300"
                                style={{ width: `${(collectedCount / multiLoginCount) * 100}%` }}
                              />
                            </div>
                            {remainingWindows > 0 && (
                              <p className="mt-2 text-xs text-emerald-600">
                                剩余 {remainingWindows} 个窗口等待登录...
                              </p>
                            )}
                            {remainingWindows === 0 && collectedCount > 0 && (
                              <p className="mt-2 text-xs text-emerald-600 font-medium">
                                ✓ 所有窗口已关闭，Cookie已自动填入
                              </p>
                            )}
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancelMultiLogin}
                            disabled={isMultiLoginLoading}
                            className="w-full h-10"
                          >
                            取消批量登录
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex gap-3 items-center p-4 text-rose-600 bg-rose-50 rounded-xl border border-rose-100 animate-in fade-in slide-in-from-top-2">
                  <XCircle className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-medium">{error}</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-6 border-t bg-muted/30 border-muted">
            <Button
              variant="ghost"
              onClick={handleCloseDialog}
              disabled={isSubmitting || backupLoginIndex !== null}
              className="h-10"
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !nameValue.trim() ||
                !isCookieCountEnough ||
                isSubmitting ||
                backupLoginIndex !== null
              }
              className="h-10 px-8 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" /> 处理中...
                </>
              ) : (
                <>{editingConfigId ? '保存修改' : '立即添加'}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label className="flex gap-2 items-center text-sm font-semibold text-muted-foreground">
            已配置账号
            <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-muted text-[10px] font-bold">
              {filteredConfigs.length}
            </span>
          </Label>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {loading ? (
            <div className="flex flex-col col-span-full justify-center items-center py-20 space-y-4">
              <div className="flex relative justify-center items-center">
                <div className="absolute w-12 h-12 rounded-full border-4 animate-ping border-primary/20"></div>
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
              <p className="text-sm font-medium animate-pulse text-muted-foreground">
                正在同步云端配置...
              </p>
            </div>
          ) : filteredConfigs.length === 0 ? (
            <div className="flex flex-col col-span-full justify-center items-center py-16 rounded-2xl border-2 border-dashed border-muted/60 bg-muted/5">
              <div className="flex justify-center items-center mb-4 w-16 h-16 rounded-full bg-muted/50">
                <Plus className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <h3 className="mb-1 text-base font-bold text-muted-foreground">暂无{title}配置</h3>
              <p className="text-sm text-muted-foreground/60 mb-6 text-center max-w-[240px]">
                点击上方“添加账号”按钮，
                <br />
                开启自动化的投放管理旅程
              </p>
              <Button
                onClick={handleOpenDialog}
                variant="outline"
                size="sm"
                className="px-6 rounded-full"
              >
                现在开始
              </Button>
            </div>
          ) : (
            filteredConfigs.map((config) => (
              <ConfigCard
                key={config.id}
                config={config}
                onEdit={handleEdit}
                onDelete={onDelete}
                loading={loading}
                onMobileAccess={onMobileAccess}
                showMobileAccess={showMobileAccess}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export const ConfigPage: React.FC = () => {
  const [configs, setConfigs] = useState<CookieConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [configToDelete, setConfigToDelete] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<string>('ocean')
  const [activeOceanConfigTab, setActiveOceanConfigTab] = useState<string>('ocean-cookie')
  const [mobileDialogOpen, setMobileDialogOpen] = useState(false)
  const [mobileConfig, setMobileConfig] = useState<CookieConfig | null>(null)
  const [mobileAccessMap, setMobileAccessMap] = useState<Record<number, MobileAccessState>>({})
  const [mobileActionLoading, setMobileActionLoading] = useState(false)
  const [mobileError, setMobileError] = useState('')
  const [mobileCopied, setMobileCopied] = useState(false)

  // 获取当前用户
  const getCurrentUser = (): { id: number } | null => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        return JSON.parse(userStr)
      } catch (e) {
        console.error('Failed to parse user', e)
      }
    }
    return null
  }

  // 检查是否应该显示飞书绑定Tab（账户ID为1或2时显示）
  const shouldShowFeishuTab = (): boolean => {
    const user = getCurrentUser()
    return user !== null && (user.id === 1 || user.id === 2)
  }

  // 加载配置
  const loadConfigs = async (): Promise<void> => {
    setLoading(true)
    try {
      const [oceanConfigs, tencentConfigs, changduConfigs] = await Promise.all([
        configService.getConfigsBySourceAll(1), // 巨量
        configService.getConfigsBySourceAll(2), // 腾讯
        configService.getConfigsBySourceAll(3) // 常读
      ])

      const allConfigs: CookieConfig[] = [
        ...oceanConfigs.map((c) => ({
          id: c.id,
          name: c.cookie_name,
          cookie: c.cookie,
          backup_cookies: c.backup_cookies || [],
          backup_statuses: c.backup_statuses || [],
          realname: c.realname,
          type: 'ocean' as const,
          status: c.status,
          createdAt: Date.now()
        })),
        ...tencentConfigs.map((c) => ({
          id: c.id,
          name: c.cookie_name,
          cookie: c.cookie,
          backup_cookies: c.backup_cookies || [],
          backup_statuses: c.backup_statuses || [],
          realname: c.realname,
          type: 'tencent' as const,
          status: c.status,
          createdAt: Date.now()
        })),
        ...changduConfigs.map((c) => ({
          id: c.id,
          name: c.cookie_name,
          cookie: c.cookie,
          backup_cookies: c.backup_cookies || [],
          backup_statuses: c.backup_statuses || [],
          realname: c.realname,
          type: 'changdu' as const,
          status: c.status,
          createdAt: Date.now()
        }))
      ]

      setConfigs(allConfigs)
    } catch (error) {
      console.error('Failed to load configs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfigs()
  }, [])

  const handleAdd =
    (type: 'ocean' | 'tencent' | 'changdu') =>
    async (name: string, cookie: string, backupCookies: string[]): Promise<number> => {
      const user = getCurrentUser()
      if (!user) {
        console.error('User not found')
        throw new Error('User not found')
      }

      try {
        const newConfig = await configService.createConfig({
          cookie_name: name,
          cookie: cookie,
          backup_cookies: backupCookies.length > 0 ? backupCookies : undefined,
          user_id: user.id,
          source: type === 'ocean' ? 1 : type === 'tencent' ? 2 : 3,
          status: true
        })

        const cookieConfig: CookieConfig = {
          id: newConfig.id,
          name: newConfig.cookie_name,
          cookie: newConfig.cookie,
          backup_cookies: newConfig.backup_cookies || [],
          backup_statuses: newConfig.backup_statuses || [],
          realname: newConfig.realname,
          type: type,
          status: newConfig.status,
          createdAt: Date.now()
        }

        setConfigs([...configs, cookieConfig])
        return newConfig.id
      } catch (error) {
        console.error('Failed to add config:', error)
        throw error
      }
    }

  const handleEdit =
    (type: 'ocean' | 'tencent' | 'changdu') =>
    async (id: number, name: string, cookie: string, backupCookies: string[]) => {
      try {
        const updatedConfig = await configService.updateConfig(id, {
          cookie_name: name,
          cookie: cookie,
          backup_cookies: backupCookies.length > 0 ? backupCookies : undefined
        })

        const cookieConfig: CookieConfig = {
          id: updatedConfig.id,
          name: updatedConfig.cookie_name,
          cookie: updatedConfig.cookie,
          backup_cookies: updatedConfig.backup_cookies || [],
          backup_statuses: updatedConfig.backup_statuses || [],
          realname: updatedConfig.realname,
          type: type,
          status: updatedConfig.status,
          createdAt: Date.now()
        }

        setConfigs(configs.map((c) => (c.id === id ? cookieConfig : c)))
      } catch (error) {
        console.error('Failed to update config:', error)
        throw error
      }
    }

  const handleDelete = async (id: number): Promise<void> => {
    try {
      await configService.deleteConfig(id)
      setConfigs(configs.filter((c) => c.id !== id))
    } catch (error) {
      console.error('Failed to delete config:', error)
    }
  }

  const handleConfirmDelete = async (): Promise<void> => {
    if (configToDelete !== null) {
      await handleDelete(configToDelete)
      setDeleteDialogOpen(false)
      setConfigToDelete(null)
    }
  }

  const handleCancelDelete = (): void => {
    setDeleteDialogOpen(false)
    setConfigToDelete(null)
  }

  const handleHelpClick = async (): Promise<void> => {
    try {
      await window.api.openExternal(
        'https://ai.feishu.cn/wiki/JPDDw4INuiCcoNkVENGctNbOnVc?from=from_copylink'
      )
    } catch (error) {
      console.error('Failed to open help link:', error)
    }
  }

  const handleOpenMobileAccess = (config: CookieConfig): void => {
    setMobileConfig(config)
    setMobileDialogOpen(true)
    setMobileError('')
    setMobileCopied(false)
  }

  const handleCloseMobileAccess = (): void => {
    if (!mobileActionLoading) {
      setMobileDialogOpen(false)
      setMobileConfig(null)
      setMobileError('')
      setMobileCopied(false)
    }
  }

  const handleToggleMobileAccess = async (enable: boolean): Promise<void> => {
    if (!mobileConfig || mobileActionLoading) return
    setMobileActionLoading(true)
    setMobileError('')
    try {
      const result = await configService.toggleMobileAccess(mobileConfig.id, enable)
      setMobileAccessMap((prev) => ({
        ...prev,
        [mobileConfig.id]: {
          enabled: result.enabled,
          url: result.url ?? undefined,
          secretKey: result.secret_key ?? undefined
        }
      }))
    } catch (err: unknown) {
      const errorMessage =
        (err as { message?: string })?.message ||
        (err as { detail?: string })?.detail ||
        '操作失败，请稍后重试'
      setMobileError(errorMessage)
    } finally {
      setMobileActionLoading(false)
    }
  }

  const handleCopyMobileUrl = async (url: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url)
      setMobileCopied(true)
      setTimeout(() => setMobileCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy url:', error)
      setMobileError('复制失败，请手动复制链接')
    }
  }
  const currentMobileState = mobileConfig ? mobileAccessMap[mobileConfig.id] : undefined
  const mobileEnabled = currentMobileState?.enabled ?? false
  const mobileUrl = currentMobileState?.url ?? ''

  return (
    <div className="mx-auto max-w-[1280px] space-y-8 px-6 py-8">
      <Card className="overflow-hidden">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Credential Control Center
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-border/70 bg-background/70 p-3 text-primary">
                  <Settings2 className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">配置中心</h1>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground sm:text-base">
                    统一管理巨量、腾讯、常读以及飞书集成所需的账号凭据与授权信息。
                  </p>
                </div>
                <button
                  onClick={handleHelpClick}
                  className="rounded-full p-1.5 text-muted-foreground transition-all hover:bg-primary/5 hover:text-primary active:scale-95"
                  title="查看配置指南"
                >
                  <HelpCircle className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  巨量
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {configs.filter((c) => c.type === 'ocean').length}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  腾讯
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {configs.filter((c) => c.type === 'tencent').length}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  常读
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {configs.filter((c) => c.type === 'changdu').length}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className={cn(
          'space-y-8 w-full',
          activeTab === 'ocean'
            ? 'theme-ocean'
            : activeTab === 'tencent'
              ? 'theme-tencent'
              : activeTab === 'changdu'
                ? 'theme-ocean'
                : ''
        )}
      >
        <div className="flex justify-between items-center pb-1 border-b">
          <TabsList className="gap-8 p-0 h-auto bg-transparent">
            <TabsTrigger
              value="ocean"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 text-base font-bold transition-all"
            >
              巨量助手
            </TabsTrigger>
            <TabsTrigger
              value="tencent"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 text-base font-bold transition-all"
            >
              腾讯助手
            </TabsTrigger>
            <TabsTrigger
              value="changdu"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 text-base font-bold transition-all"
            >
              常读助手
            </TabsTrigger>
            {shouldShowFeishuTab() && (
              <TabsTrigger
                value="integrations"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 text-base font-bold transition-all"
              >
                飞书绑定
              </TabsTrigger>
            )}
          </TabsList>

          <Button
            variant="ghost"
            size="sm"
            onClick={loadConfigs}
            disabled={loading}
            className="gap-2 transition-colors text-muted-foreground hover:text-primary"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新数据
          </Button>
        </div>

        <TabsContent
          value="ocean"
          className="mt-0 duration-300 outline-none animate-in fade-in slide-in-from-left-4 theme-ocean"
        >
          <div className="space-y-6">
            <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                    <Settings2 className="h-3.5 w-3.5" />
                    巨量助手配置
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">巨量助手配置</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Cookie 用于自动化登录态任务，开放平台授权用于官方 Open API 调用。
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-border/80 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                    Cookie 账号：{configs.filter((c) => c.type === 'ocean').length}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                    授权配置
                  </span>
                </div>
              </div>
            </div>

            <Tabs
              value={activeOceanConfigTab}
              onValueChange={setActiveOceanConfigTab}
              className="grid gap-6 lg:grid-cols-[220px_1fr]"
            >
              <TabsList className="flex h-auto flex-row items-stretch justify-start gap-2 overflow-x-auto rounded-2xl border border-border/60 bg-card p-2 shadow-sm lg:flex-col lg:overflow-visible">
                <TabsTrigger
                  value="ocean-cookie"
                  className="min-w-[160px] justify-start gap-2 rounded-xl px-4 py-3 text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm lg:w-full"
                >
                  <Chromium className="h-4 w-4" />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-sm font-semibold">Cookie 配置</span>
                    <span className="text-[11px] font-normal opacity-75">登录态凭据</span>
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="ocean-auth"
                  className="min-w-[160px] justify-start gap-2 rounded-xl px-4 py-3 text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm lg:w-full"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-sm font-semibold">授权配置</span>
                    <span className="text-[11px] font-normal opacity-75">Open API OAuth</span>
                  </span>
                </TabsTrigger>
              </TabsList>

              <div className="min-w-0">
                <TabsContent value="ocean-cookie" className="m-0 outline-none">
                  <Card className="overflow-hidden border-border/60 shadow-sm">
                    <CardContent className="p-5 sm:p-6">
                      <ConfigSection
                        title="Cookie 配置"
                        description="用于批量创建、自动化投放等需要登录态的任务；同一账号建议维护 9 个以上不重复 Cookie（去重后大于 8 个）。"
                        type="ocean"
                        configs={configs}
                        onAdd={handleAdd('ocean')}
                        onEdit={handleEdit('ocean')}
                        onDelete={(id) => {
                          setConfigToDelete(id)
                          setDeleteDialogOpen(true)
                        }}
                        loading={loading}
                        onMobileAccess={handleOpenMobileAccess}
                        showMobileAccess={false}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="ocean-auth" className="m-0 outline-none">
                  <Card className="overflow-hidden border-border/60 shadow-sm">
                    <CardHeader className="space-y-3 border-b border-border/60 bg-muted/15 pb-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            OAuth 2.0
                          </div>
                          <CardTitle className="text-xl font-bold tracking-tight">授权配置</CardTitle>
                          <CardDescription className="text-sm leading-relaxed">
                            用于报表、资产、广告主等官方 Open API 能力；Token 到期可在此刷新或重新授权。
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-5 sm:p-6">
                      <OceanEngineOAuthCard embedded />
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent
          value="tencent"
          className="mt-0 duration-300 outline-none animate-in fade-in slide-in-from-left-4 theme-tencent"
        >
          <ConfigSection
            title="腾讯助手"
            type="tencent"
            configs={configs}
            onAdd={handleAdd('tencent')}
            onEdit={handleEdit('tencent')}
            onDelete={(id) => {
              setConfigToDelete(id)
              setDeleteDialogOpen(true)
            }}
            loading={loading}
            onMobileAccess={handleOpenMobileAccess}
            showMobileAccess={true}
          />
        </TabsContent>

        <TabsContent
          value="changdu"
          className="mt-0 duration-300 outline-none animate-in fade-in slide-in-from-left-4 theme-ocean"
        >
          <ConfigSection
            title="常读助手"
            type="changdu"
            configs={configs}
            onAdd={handleAdd('changdu')}
            onEdit={handleEdit('changdu')}
            onDelete={(id) => {
              setConfigToDelete(id)
              setDeleteDialogOpen(true)
            }}
            loading={loading}
            showMobileAccess={false}
          />
        </TabsContent>

        {shouldShowFeishuTab() && (
          <TabsContent
            value="integrations"
            className="mt-0 duration-300 outline-none animate-in fade-in slide-in-from-left-4"
          >
            <div className="space-y-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold tracking-tight text-foreground">飞书绑定</h2>
                <p className="text-sm text-muted-foreground">
                  用于推送数据到飞书，以及接收机器人通知
                </p>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FeishuBindingCard />
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* 移动端扫码授权弹窗 */}
      <Dialog
        open={mobileDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseMobileAccess()
        }}
      >
        <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-6 space-y-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">移动端扫码授权</DialogTitle>
              <DialogDescription className="text-sm">
                开启后生成二维码链接，可在手机浏览器中更新 Cookie。
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {mobileConfig?.name || '未选择账号'}
                </div>
                <div className="text-xs text-muted-foreground">
                  配置ID：{mobileConfig?.id ?? '--'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {mobileEnabled ? '已开启' : '未开启'}
                </span>
                <Switch
                  checked={mobileEnabled}
                  onCheckedChange={(checked) => handleToggleMobileAccess(checked)}
                  disabled={mobileActionLoading || !mobileConfig}
                />
              </div>
            </div>

            {mobileEnabled && mobileUrl ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="p-3 bg-white rounded-xl border">
                    <QRCodeCanvas value={mobileUrl} size={180} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input value={mobileUrl} readOnly className="text-xs font-mono bg-background" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCopyMobileUrl(mobileUrl)}
                    className="shrink-0"
                  >
                    {mobileCopied ? '已复制' : '复制'}
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.api.openExternal(mobileUrl)}
                  className="w-full"
                >
                  <ExternalLink className="mr-2 w-4 h-4" /> 在浏览器打开
                </Button>

                <p className="text-xs text-muted-foreground">关闭后重新开启可刷新链接。</p>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                开启移动端授权后，将自动生成二维码与访问链接。
              </div>
            )}

            {mobileError && (
              <div className="flex gap-3 items-center p-3 text-rose-600 bg-rose-50 rounded-xl border border-rose-100">
                <XCircle className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{mobileError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 border-t bg-muted/30 border-muted">
            <Button
              variant="ghost"
              onClick={handleCloseMobileAccess}
              disabled={mobileActionLoading}
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-6">
            <div className="flex gap-4 items-center mb-4">
              <div className="p-3 text-rose-600 bg-rose-50 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">确认删除配置？</DialogTitle>
                <DialogDescription className="mt-1">
                  该操作不可撤销，删除后该账号的所有自动化任务将停止。
                </DialogDescription>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 border-t bg-muted/30 border-muted">
            <Button variant="ghost" onClick={handleCancelDelete} className="h-10">
              暂不删除
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              className="px-6 h-10 font-bold"
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
