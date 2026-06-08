import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '../lib/utils'
import { useAuth } from '../hooks/useAuth'
import { Button } from './ui'
import { oceanEngineAppService } from '../services/ocean-engine-app.service'
import { oceanEngineOAuthService } from '../services/ocean-engine-oauth.service'
import type { OceanEngineApp } from '../types/ocean-engine-app.types'
import type {
  OceanEngineAuthorizedAccount,
  OceanEngineOAuthToken
} from '../types/ocean-engine-oauth.types'

function formatExpiry(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  if (diffMs <= 0) return '已过期'
  const days = Math.floor(diffMs / 86400000)
  if (days > 0) return `${days} 天后过期`
  const hours = Math.floor(diffMs / 3600000)
  return `${hours} 小时后过期`
}

function TokenRow({
  token,
  onRevoke,
  onRefresh,
  readOnlyActions = false,
  showGrantOwner = false
}: {
  token: OceanEngineOAuthToken
  onRevoke: (advertiserId: string, appCode: string) => Promise<void>
  onRefresh: (advertiserId: string, appCode: string) => Promise<void>
  /** 普通用户仅可查看团队管理员的授权，不可刷新/撤销 */
  readOnlyActions?: boolean
  /** 管理员列表中展示授权归属用户 id */
  showGrantOwner?: boolean
}) {
  const [revoking, setRevoking] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const handleRevoke = async () => {
    if (
      !window.confirm(
        `确认撤销广告主 ${token.advertiser_name || token.advertiser_id} 在 ${token.app_code} 下的授权吗？`
      )
    )
      return
    setRevoking(true)
    try {
      await onRevoke(token.advertiser_id, token.app_code)
    } finally {
      setRevoking(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await onRefresh(token.advertiser_id, token.app_code)
    } finally {
      setRefreshing(false)
    }
  }

  const isExpired = token.is_token_expired
  const isRefreshExpired = token.is_refresh_token_expired

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:border-border transition-colors group">
      <div className="shrink-0">
        {isExpired ? (
          <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-foreground truncate">
            {token.advertiser_name || token.advertiser_id}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
            {token.advertiser_id}
          </span>
          <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
            {token.app_code}
          </span>
          {showGrantOwner && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
              用户 #{token.user_id}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {isRefreshExpired ? (
            <span className="text-[11px] text-rose-500 font-medium">
              refresh_token 已过期，需要重新授权
            </span>
          ) : isExpired ? (
            <span className="text-[11px] text-amber-600">access_token 已过期，可刷新</span>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              {formatExpiry(token.token_expires_at)}
            </span>
          )}
        </div>
      </div>

      {!readOnlyActions && (
        <div className="flex items-center gap-1 shrink-0">
          {!isRefreshExpired && (
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 cursor-pointer text-muted-foreground hover:text-primary hover:bg-primary/10"
              onClick={handleRefresh}
              disabled={refreshing || revoking}
              title="刷新 access_token"
            >
              {refreshing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 cursor-pointer text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
            onClick={handleRevoke}
            disabled={revoking || refreshing}
            title="撤销授权"
          >
            {revoking ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

function AuthorizedAccountRow({
  account,
  onRevoke,
  onRefresh
}: {
  account: OceanEngineAuthorizedAccount
  onRevoke: (advertiserId: string, appCode: string) => Promise<void>
  onRefresh: (advertiserId: string, appCode: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const isExpired = account.is_token_expired
  const isRefreshExpired = account.is_refresh_token_expired

  const handleRevoke = async () => {
    if (
      !window.confirm(
        `确认撤销广告主 ${account.advertiser_name || account.advertiser_id} 在 ${account.app_code} 下的授权吗？这会影响 ${account.access_users.length} 个使用用户。`
      )
    )
      return
    setRevoking(true)
    try {
      await onRevoke(account.advertiser_id, account.app_code)
    } finally {
      setRevoking(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await onRefresh(account.advertiser_id, account.app_code)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card transition-colors hover:border-border">
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={expanded ? '收起使用用户' : '展开使用用户'}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <div className="shrink-0">
          {isExpired ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {account.advertiser_name || account.advertiser_id}
            </span>
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {account.advertiser_id}
            </span>
            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
              {account.app_code}
            </span>
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {account.access_users.length} 个使用用户
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {isRefreshExpired ? (
              <span className="text-[11px] font-medium text-rose-500">
                refresh_token 已过期，需要重新授权
              </span>
            ) : isExpired ? (
              <span className="text-[11px] text-amber-600">access_token 已过期，可刷新</span>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                {formatExpiry(account.token_expires_at)}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              最近授权用户 #{account.grant_owner_user_id}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!isRefreshExpired && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 cursor-pointer text-muted-foreground hover:bg-primary/10 hover:text-primary"
              onClick={handleRefresh}
              disabled={refreshing || revoking}
              title="刷新 access_token"
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 cursor-pointer text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
            onClick={handleRevoke}
            disabled={revoking || refreshing}
            title="撤销授权"
          >
            {revoking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/50 bg-muted/20 px-3 py-2">
          <div className="space-y-1.5">
            {account.access_users.map((accessUser) => (
              <div
                key={`${account.grant_id}-${accessUser.user_id}`}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-background/70 px-2.5 py-1.5 text-[11px]"
              >
                <span className="font-medium text-foreground">使用用户 #{accessUser.user_id}</span>
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                  {accessUser.permission}
                </span>
                {accessUser.granted_by_user_id && (
                  <span className="text-muted-foreground">
                    授权来源 #{accessUser.granted_by_user_id}
                  </span>
                )}
                <span className="ml-auto text-muted-foreground">
                  {accessUser.is_active ? '可用' : '已停用'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export interface OceanEngineOAuthCardProps {
  /** 嵌入外层 Card 时使用：隐藏重复标题与外层容器样式 */
  embedded?: boolean
}

export const OceanEngineOAuthCard: React.FC<OceanEngineOAuthCardProps> = ({ embedded = false }) => {
  const { user } = useAuth()
  const canStartOAuth = user?.role === 'admin' || user?.role === 'manager'
  const isAdminViewer = user?.role === 'admin'
  const grantsReadOnly = user?.role === 'user'

  const [tokens, setTokens] = useState<OceanEngineOAuthToken[]>([])
  const [authorizedAccounts, setAuthorizedAccounts] = useState<OceanEngineAuthorizedAccount[]>([])
  const [apps, setApps] = useState<OceanEngineApp[]>([])
  const [selectedAppCode, setSelectedAppCode] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTokens = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isAdminViewer) {
        const res = await oceanEngineOAuthService.getAuthorizedAccounts(true)
        setAuthorizedAccounts(res.items)
        setTokens([])
      } else {
        const res = await oceanEngineOAuthService.getTokens(true)
        setTokens(res.items)
        setAuthorizedAccounts([])
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || '加载授权信息失败')
    } finally {
      setLoading(false)
    }
  }, [isAdminViewer])

  const loadApps = useCallback(async () => {
    try {
      const res = await oceanEngineAppService.listApps(true)
      setApps(res.items)
      if (!selectedAppCode && res.items.length > 0) {
        setSelectedAppCode(res.items[0].app_code)
      }
    } catch (err) {
      console.error('Failed to load OceanEngine apps', err)
    }
  }, [selectedAppCode])

  useEffect(() => {
    void loadTokens()
    void loadApps()
  }, [loadTokens, loadApps])

  /** 切换「授权使用的 App」时只展示该 App 下的授权记录 */
  const tokensForSelectedApp = useMemo(() => {
    if (!selectedAppCode) return tokens
    return tokens.filter((t) => t.app_code === selectedAppCode)
  }, [tokens, selectedAppCode])

  const accountsForSelectedApp = useMemo(() => {
    if (!selectedAppCode) return authorizedAccounts
    return authorizedAccounts.filter((item) => item.app_code === selectedAppCode)
  }, [authorizedAccounts, selectedAppCode])

  const visibleRecordCount = isAdminViewer
    ? accountsForSelectedApp.length
    : tokensForSelectedApp.length
  const hasAnyRecord = isAdminViewer ? authorizedAccounts.length > 0 : tokens.length > 0

  const handleStartAuth = async () => {
    setAuthLoading(true)
    setError(null)
    try {
      const result = await oceanEngineOAuthService.startAuthFlow(selectedAppCode || undefined)
      if (result.success) {
        if (result.message) toast.success(result.message)
        await loadTokens()
      }
    } catch (err: any) {
      const msg = err?.message || '授权失败，请重试'
      setError(msg)
      toast.error(msg)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleRevoke = async (advertiserId: string, appCode: string) => {
    try {
      await oceanEngineOAuthService.revokeToken(advertiserId, appCode)
      toast.success('已撤销授权')
      setTokens((prev) =>
        prev.filter((t) => !(t.advertiser_id === advertiserId && t.app_code === appCode))
      )
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || '撤销失败')
    }
  }

  const handleRefresh = async (advertiserId: string, appCode: string) => {
    try {
      const res = await oceanEngineOAuthService.refreshToken(advertiserId, appCode)
      toast.success(`${advertiserId} / ${appCode} Token 刷新成功`)
      setTokens((prev) =>
        prev.map((t) =>
          t.advertiser_id === advertiserId && t.app_code === res.app_code
            ? { ...t, token_expires_at: res.token_expires_at, is_token_expired: false }
            : t
        )
      )
      setAuthorizedAccounts((prev) =>
        prev.map((a) =>
          a.advertiser_id === advertiserId && a.app_code === res.app_code
            ? { ...a, token_expires_at: res.token_expires_at, is_token_expired: false }
            : a
        )
      )
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || '刷新失败')
    }
  }

  return (
    <div
      className={cn(
        'space-y-5',
        embedded ? 'p-0 border-0 bg-transparent shadow-none' : 'rounded-2xl border bg-card p-6'
      )}
    >
      {!embedded && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base text-foreground">开放平台授权</h3>
              <p className="text-xs text-muted-foreground">
                {isAdminViewer
                  ? '查看全站用户的 OAuth 授权；管理员与团队管理员可发起授权'
                  : canStartOAuth
                    ? '管理您名下巨量引擎 Open API 的 OAuth 授权'
                    : '查看您所属团队管理员的 OAuth 授权（仅管理员/团队管理员可发起授权）'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 shrink-0 cursor-pointer text-muted-foreground hover:text-primary"
            onClick={() => {
              void loadTokens()
              void loadApps()
            }}
            disabled={loading}
            title="刷新列表"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      )}

      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-foreground">授权记录</span>
            {!loading && (
              <span className="inline-flex items-center rounded-full border border-border/80 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {visibleRecordCount} 条
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 cursor-pointer gap-1.5 px-3 text-xs font-medium"
            onClick={() => {
              void loadTokens()
              void loadApps()
            }}
            disabled={loading}
            title="刷新列表"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 dark:bg-rose-900/20 dark:border-rose-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-medium">{error}</span>
        </div>
      )}

      {apps.length > 0 ? (
        <div className="space-y-2">
          <label htmlFor="ocean-oauth-app" className="text-xs font-medium text-muted-foreground">
            授权使用的 App
          </label>
          <select
            id="ocean-oauth-app"
            value={selectedAppCode}
            onChange={(e) => setSelectedAppCode(e.target.value)}
            className="w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {apps.map((app) => (
              <option key={app.app_code} value={app.app_code}>
                {app.app_code} / {app.app_id}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : visibleRecordCount === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-background/80 shadow-sm">
            <KeyRound className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            {hasAnyRecord ? '当前 App 下暂无授权' : '暂无 OAuth 授权'}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {grantsReadOnly && !user?.parent_user_id
              ? '您的账号未绑定团队管理员，无法展示团队授权。请联系管理员配置上级用户。'
              : hasAnyRecord
                ? canStartOAuth
                  ? '可切换上方 App 查看其他应用下的授权，或点击下方完成本 App 授权'
                  : '可切换上方 App 筛选应用；如需新增授权请联系团队管理员或管理员'
                : canStartOAuth
                  ? '完成下方授权后，即可调用巨量开放平台 API'
                  : '团队管理员完成授权后，即可在本环境调用巨量开放平台 API'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {isAdminViewer
            ? accountsForSelectedApp.map((account) => (
                <AuthorizedAccountRow
                  key={`${account.grant_id}-${account.app_code}`}
                  account={account}
                  onRevoke={handleRevoke}
                  onRefresh={handleRefresh}
                />
              ))
            : tokensForSelectedApp.map((token) => (
                <TokenRow
                  key={token.id}
                  token={token}
                  onRevoke={handleRevoke}
                  onRefresh={handleRefresh}
                  readOnlyActions={grantsReadOnly}
                  showGrantOwner={false}
                />
              ))}
        </div>
      )}

      {canStartOAuth ? (
        <Button
          onClick={() => void handleStartAuth()}
          disabled={authLoading}
          className="w-full h-10 cursor-pointer font-semibold shadow-sm transition-colors"
          variant={visibleRecordCount > 0 ? 'outline' : 'default'}
        >
          {authLoading ? (
            <>
              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              等待授权...
            </>
          ) : (
            <>
              <ExternalLink className="mr-2 w-4 h-4" />
              {visibleRecordCount > 0 ? '添加 / 重新授权' : '去巨量引擎授权'}
            </>
          )}
        </Button>
      ) : (
        <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-center text-xs leading-relaxed text-muted-foreground">
          添加或重新授权仅面向管理员与团队管理员。普通用户可使用上方列表查看团队管理员的授权状态。
        </p>
      )}

      {visibleRecordCount > 0 && (
        <p className="text-center text-[11px] text-muted-foreground">
          access_token 有效期 24 小时，refresh_token 有效期 30 天；系统会定期自动续期
        </p>
      )}
    </div>
  )
}

export default OceanEngineOAuthCard
