import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle, Copy, ImagePlus, Loader2, RefreshCw, X } from 'lucide-react'
import {
  Button,
  Label,
  Textarea,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from '../../../../components/ui'
import { AccountAvatarCropDialog } from '../../AccountAvatarCropDialog'
import { parseAccountIds } from '../../pAssistantUtils'
import { persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import { oceanEngineOAuthService } from '../../../../services/ocean-engine-oauth.service'
import type { OceanEngineOAuthToken } from '../../../../types/ocean-engine-oauth.types'
import type { AccountAvatarBatchResponse } from '../../../../services/ocean-engine.service'

/** 审核中不可改头像，重试/复制失败列表时排除 */
const AVATAR_NON_RETRYABLE_ERROR_MARK = '审核中的头像不允许修改'

const isAvatarNonRetryableFailure = (error?: string | null): boolean =>
  Boolean(error?.includes(AVATAR_NON_RETRYABLE_ERROR_MARK))

export const AccountAvatarTab: React.FC = () => {
  const { selectedConfigId, loading, setLoading, setError, addLog, clearLogs, setIsBottomPanelOpen, runPAssistantJob } =
    usePAssistantContext()

  const [avatarAccountIds, setAvatarAccountIds] = usePersistedState(
    'p-assistant-avatar-account-ids',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [avatarCropOpen, setAvatarCropOpen] = useState(false)
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null)
  const [avatarImageDataUrl, setAvatarImageDataUrl] = useState<string | null>(null)
  const [avatarBatchResults, setAvatarBatchResults] = useState<AccountAvatarBatchResponse | null>(
    null
  )

  /** 开放平台 OAuth 授权组织（纵横组织 advertiser_id） */
  const [avatarOAuthTokens, setAvatarOAuthTokens] = useState<OceanEngineOAuthToken[]>([])
  const [loadingAvatarOAuthTokens, setLoadingAvatarOAuthTokens] = useState(false)
  const [selectedAvatarOAuthOrgId, setSelectedAvatarOAuthOrgId] = useState<string | null>(null)

  const avatarOAuthUniqueOrgs = useMemo(() => {
    const m = new Map<
      string,
      { advertiser_id: string; advertiser_name: string; app_codes: string[] }
    >()
    for (const t of avatarOAuthTokens) {
      const id = String(t.advertiser_id || '').trim()
      if (!id) continue
      const existing = m.get(id)
      if (!existing) {
        m.set(id, {
          advertiser_id: id,
          advertiser_name: (t.advertiser_name || id).trim(),
          app_codes: t.app_code ? [String(t.app_code)] : []
        })
      } else if (t.app_code && !existing.app_codes.includes(String(t.app_code))) {
        existing.app_codes.push(String(t.app_code))
      }
    }
    return Array.from(m.values()).sort((a, b) => a.advertiser_name.localeCompare(b.advertiser_name))
  }, [avatarOAuthTokens])

  const loadAvatarOAuthTokens = useCallback(async (): Promise<void> => {
    setLoadingAvatarOAuthTokens(true)
    try {
      const res = await oceanEngineOAuthService.getTokens(true)
      const items = res.items ?? []
      setAvatarOAuthTokens(items)
      const ids = new Set(items.map((t) => String(t.advertiser_id || '').trim()).filter(Boolean))
      const saved = localStorage.getItem('p-assistant-avatar-oauth-org-id')?.trim()
      setSelectedAvatarOAuthOrgId((prev) => {
        const p = prev?.trim()
        if (p && ids.has(p)) return p
        if (saved && ids.has(saved)) return saved
        return null
      })
    } catch {
      setError('加载已授权组织账户失败，请检查网络或重新登录')
    } finally {
      setLoadingAvatarOAuthTokens(false)
    }
  }, [])

  useEffect(() => {
    void loadAvatarOAuthTokens()
  }, [loadAvatarOAuthTokens])

  useEffect(() => {
    if (selectedAvatarOAuthOrgId) {
      localStorage.setItem('p-assistant-avatar-oauth-org-id', selectedAvatarOAuthOrgId)
    }
  }, [selectedAvatarOAuthOrgId])

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text).then(
      () => addLog('已复制到剪贴板', 'success'),
      () => addLog('复制失败', 'error')
    )
  }

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件（jpg/png/webp 等）')
      return
    }
    if (avatarCropSrc?.startsWith('blob:')) {
      URL.revokeObjectURL(avatarCropSrc)
    }
    const url = URL.createObjectURL(file)
    setAvatarCropSrc(url)
    setAvatarCropOpen(true)
  }

  const handleBatchSetAccountAvatar = async (): Promise<void> => {
    const orgId = selectedAvatarOAuthOrgId?.trim()
    if (!orgId) {
      setError('请在上方「配置选择」中选择开放平台授权的组织账户（组织 ID）')
      return
    }
    const accountIdList = parseAccountIds(avatarAccountIds)
    if (accountIdList.length === 0) {
      setError('请输入至少一个账户ID')
      return
    }
    if (!avatarImageDataUrl) {
      setError('请先选择图片并完成裁剪')
      return
    }

    setLoading(true)
    setError('')
    setAvatarBatchResults(null)
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog(`开始批量设置头像，共 ${accountIdList.length} 个账户`, 'info')

    try {
      const result = await runPAssistantJob<AccountAvatarBatchResponse>('account_avatar_batch', {
        account_ids: accountIdList,
        image_base64: avatarImageDataUrl,
        oauth_token_source_advertiser_id: orgId
      })
      setAvatarBatchResults(result)
      if (result.code !== 0) {
        addLog(result.error || result.msg || '批量设置头像失败', 'error')
        return
      }
      if (result.data) {
        addLog(
          `头像设置完成：成功 ${result.data.total_success}，失败 ${result.data.total_error}`,
          result.data.total_error === 0 ? 'success' : 'info'
        )
        result.data.results.forEach((r) => {
          if (r.success) {
            addLog(`账户 ${r.account_id}: 已更新头像`, 'success')
          } else {
            addLog(`账户 ${r.account_id}: ${r.error || '失败'}`, 'error')
          }
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '批量设置头像失败'
      setError(msg)
      addLog(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        <Card className="border-2 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <ImagePlus className="w-4 h-4 text-primary" />
              </div>
              设置账户头像
            </CardTitle>
            <CardDescription>
              选择图片后在弹窗中裁剪为正方形，导出为 300×300 PNG；服务端通过巨量 Marketing
              Open API 依次调用 <span className="font-mono text-xs">avatar/upload</span> 与{' '}
              <span className="font-mono text-xs">avatar/submit</span>
              。请在上方选择授权组织，列表中的目标账户需在该组织授权范围内。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* OAuth 组织选择 */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 justify-between items-center">
                <Label className="text-base font-semibold">选择授权组织账户（组织 ID）*</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingAvatarOAuthTokens}
                  onClick={() => void loadAvatarOAuthTokens()}
                >
                  <RefreshCw
                    className={`mr-2 w-4 h-4 ${loadingAvatarOAuthTokens ? 'animate-spin' : ''}`}
                  />
                  刷新列表
                </Button>
              </div>
              {loadingAvatarOAuthTokens ? (
                <div className="flex gap-2 items-center p-4 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  加载已授权组织…
                </div>
              ) : avatarOAuthUniqueOrgs.length === 0 ? (
                <div className="p-4 text-center rounded-lg border-2 border-dashed bg-muted/30 text-muted-foreground text-sm">
                  暂无已授权组织账户。请由管理员或团队管理员在巨量开放平台完成
                  OAuth；普通用户需已绑定上级，方可使用团队管理员的授权组织列表。
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {avatarOAuthUniqueOrgs.map((org, index) => (
                    <motion.div
                      key={org.advertiser_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + index * 0.05 }}
                      className={`group relative p-4 border-2 rounded-lg cursor-pointer transition-all duration-300 ${
                        selectedAvatarOAuthOrgId === org.advertiser_id
                          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-accent/50 hover:shadow-md'
                      }`}
                      onClick={() => setSelectedAvatarOAuthOrgId(org.advertiser_id)}
                    >
                      {selectedAvatarOAuthOrgId === org.advertiser_id && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/50 rounded-t-lg" />
                      )}
                      <div className="flex justify-between items-center">
                        <div className="flex flex-1 gap-3 items-center min-w-0">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                              selectedAvatarOAuthOrgId === org.advertiser_id
                                ? 'border-primary bg-primary shadow-md'
                                : 'border-muted-foreground/30 group-hover:border-primary/50'
                            }`}
                          >
                            {selectedAvatarOAuthOrgId === org.advertiser_id && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-2 h-2 bg-white rounded-full"
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">
                              {org.advertiser_name}
                            </div>
                            <div className="text-xs font-mono truncate text-muted-foreground mt-0.5">
                              ID: {org.advertiser_id}
                            </div>
                            {org.app_codes.length > 0 && (
                              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                App: {org.app_codes.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                        {selectedAvatarOAuthOrgId === org.advertiser_id && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200 }}
                          >
                            <CheckCircle className="flex-shrink-0 ml-2 w-5 h-5 text-primary" />
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label
                  htmlFor="p-assistant-avatar-account-ids"
                  className="text-base font-semibold"
                >
                  账户列表（一行一个）*
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAvatarAccountIds('')}
                  disabled={loading}
                >
                  <X className="mr-2 w-4 h-4" />
                  清空列表
                </Button>
              </div>
              <Textarea
                id="p-assistant-avatar-account-ids"
                placeholder="请输入需要设置头像的账户ID，每行一个..."
                value={avatarAccountIds}
                onChange={(e) => setAvatarAccountIds(e.target.value)}
                disabled={loading}
                className="min-h-[120px] resize-y font-mono text-sm"
                rows={5}
              />
              <p className="text-sm text-muted-foreground">
                已输入 {parseAccountIds(avatarAccountIds).length} 个账户
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="space-y-2">
                <Label>头像图片 *</Label>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    id="p-assistant-avatar-file"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading}
                    onClick={() =>
                      document.getElementById('p-assistant-avatar-file')?.click()
                    }
                  >
                    <ImagePlus className="mr-2 w-4 h-4" />
                    选择并裁剪图片
                  </Button>
                  {avatarImageDataUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={loading}
                      onClick={() => setAvatarImageDataUrl(null)}
                    >
                      清除已选图片
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  裁剪后为 300×300 PNG，与巨量上传参数 width、height 一致。
                </p>
              </div>
              {avatarImageDataUrl && (
                <div className="flex gap-3 items-center p-3 rounded-lg border bg-muted/30">
                  <span className="text-sm text-muted-foreground">预览</span>
                  <img
                    src={avatarImageDataUrl}
                    alt="头像预览"
                    className="object-cover w-[72px] h-[72px] rounded-md border"
                    width={72}
                    height={72}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2 border-t">
              <Button
                type="button"
                onClick={() => void handleBatchSetAccountAvatar()}
                disabled={
                  loading ||
                  !selectedAvatarOAuthOrgId?.trim() ||
                  !avatarAccountIds.trim() ||
                  !avatarImageDataUrl
                }
                size="lg"
                className="min-w-[160px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    提交中…
                  </>
                ) : (
                  <>
                    <ArrowRight className="mr-2 w-4 h-4" />
                    批量应用头像
                  </>
                )}
              </Button>
            </div>
            {avatarBatchResults && avatarBatchResults.data && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg border bg-muted/50"
              >
                <div className="flex flex-wrap gap-2 justify-between items-center mb-2">
                  <h4 className="font-semibold">执行结果</h4>
                  <div className="flex flex-wrap gap-2 items-center text-sm">
                    <span className="text-green-600">
                      成功: {avatarBatchResults.data.total_success}
                    </span>
                    <span className="text-red-600">
                      失败: {avatarBatchResults.data.total_error}
                    </span>
                    {avatarBatchResults.data.total_error > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          const failedIds = avatarBatchResults.data!.results
                            .filter(
                              (item) =>
                                !item.success && !isAvatarNonRetryableFailure(item.error)
                            )
                            .map((item) => item.account_id)
                            .join('\n')
                          if (failedIds) {
                            copyToClipboard(failedIds)
                          }
                        }}
                      >
                        <Copy className="mr-1 w-3.5 h-3.5" />
                        复制失败账号
                      </Button>
                    )}
                  </div>
                </div>
                <div className="overflow-y-auto space-y-1 max-h-56">
                  {avatarBatchResults.data.results.map((r) => (
                    <div
                      key={r.account_id}
                      className={`flex justify-between items-center p-2 rounded text-sm ${
                        r.success
                          ? 'bg-green-50 dark:bg-green-950/20'
                          : 'bg-red-50 dark:bg-red-950/20'
                      }`}
                    >
                      <span className="font-mono">{r.account_id}</span>
                      {r.success ? (
                        <span className="text-green-600">成功</span>
                      ) : (
                        <span className="text-red-600 truncate max-w-[60%]" title={r.error}>
                          {r.error || '失败'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
      <AccountAvatarCropDialog
        open={avatarCropOpen}
        imageSrc={avatarCropSrc}
        onOpenChange={(open) => {
          setAvatarCropOpen(open)
          if (!open && avatarCropSrc?.startsWith('blob:')) {
            URL.revokeObjectURL(avatarCropSrc)
            setAvatarCropSrc(null)
          }
        }}
        onConfirm={async (blob) => {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          setAvatarImageDataUrl(dataUrl)
          if (avatarCropSrc?.startsWith('blob:')) {
            URL.revokeObjectURL(avatarCropSrc)
          }
          setAvatarCropSrc(null)
        }}
      />
    </>
  )
}
