import React, { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ExternalLink,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  XCircle
} from 'lucide-react'
import { Button, Input, Label } from '../../../components/ui'
import {
  oceanEngineBitableAdService,
  type BitableAdTemplateCreateResponse,
  type BitableAdSubmitRequest,
  type ExcelBatchPreviewResponse,
  type ExcelBatchCreateAdsResponse,
  type OceanEngineBatchCreateAdsAccountResult
} from '../../../services/ocean-engine.service'
import { toast } from 'sonner'

/** 日期 YYYY-MM-DD */
function fmtDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * 从整段粘贴文本中提取首个飞书/ Lark 多维表格链接（含 /base/）。
 * 解决：聊天/邮件里带前后说明、Markdown 链接、尾部标点等导致整串无法 new URL 的问题。
 */
function extractFeishuBitableUrl(raw: string): string | null {
  const s = raw.replace(/\uFEFF/g, '').trim()
  if (!s) return null

  const tryParseBase = (candidate: string): string | null => {
    const c = candidate.replace(/[),.;，。；、]+$/g, '').trim()
    try {
      const u = new URL(c)
      if (/\/base\/[A-Za-z0-9]+(?:\/tbl[A-Za-z0-9]+)?/i.test(u.pathname)) {
        return u.href
      }
    } catch {
      /* ignore */
    }
    return null
  }

  const direct = tryParseBase(s)
  if (direct) return direct

  const md = s.match(/\]\((https?:\/\/[^)\s]+)\)/)
  if (md) {
    const m = tryParseBase(md[1])
    if (m) return m
  }

  const chunks = s.match(/https?:\/\/[^\s<>"'()[\]]+/gi)
  if (chunks) {
    for (const h of chunks) {
      const m = tryParseBase(h)
      if (m) return m
    }
  }
  return null
}

/** 从飞书 Bitable URL 中解析 app_token 和 table_id */
/** axios 拦截器 reject 的 ApiError 多为普通对象，需统一取 message */
function getApiErrorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message
    if (typeof m === 'string' && m.length > 0) return m
  }
  if (e instanceof Error) return e.message
  return String(e ?? '未知错误')
}

function parseBitableUrl(url: string): { appToken: string; tableId: string } | null {
  try {
    const parsed = new URL(url.trim())
    const pathMatch = parsed.pathname.match(/\/base\/([A-Za-z0-9]+)(?:\/(tbl[A-Za-z0-9]+))?/)
    if (!pathMatch) return null
    const appToken = pathMatch[1]
    const tableFromPath = pathMatch[2] ?? ''
    const tableFromQuery = parsed.searchParams.get('table') ?? ''
    const hash = parsed.hash.replace(/^#/, '')
    const tableFromHash = hash ? (new URLSearchParams(hash).get('table') ?? '') : ''
    const tableId = tableFromQuery || tableFromPath || tableFromHash
    return { appToken, tableId }
  } catch {
    return null
  }
}

interface BitableImportPanelProps {
  /** 已选授权来源组织 ID 集合（来自步骤①） */
  orgIds: Set<string>
  /** 执行成功后回调 */
  onResult: (res: OceanEngineBatchCreateAdsAccountResult[]) => void
}

type Step = 'idle' | 'checking' | 'checked' | 'executing' | 'done'

export const BitableImportPanel: React.FC<BitableImportPanelProps> = ({ orgIds, onResult }) => {
  // ── 创建模板表 ────────────────────────────────────────────────────────────
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [bitableName, setBitableName] = useState('投放配置表')
  const [withExample, setWithExample] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createdBitable, setCreatedBitable] = useState<BitableAdTemplateCreateResponse | null>(null)

  // ── URL 输入 ──────────────────────────────────────────────────────────────
  const [urlInput, setUrlInput] = useState('')
  const normalizedBitableUrl = useMemo(() => extractFeishuBitableUrl(urlInput), [urlInput])
  const parsed = useMemo(
    () => (normalizedBitableUrl ? parseBitableUrl(normalizedBitableUrl) : null),
    [normalizedBitableUrl]
  )
  const parseError =
    urlInput.trim() && !parsed
      ? '无法解析链接，请确认包含 /base/ 的飞书多维表格链接（可从分享或地址栏复制）'
      : null
  const urlExtractedHint =
    normalizedBitableUrl && urlInput.trim() && normalizedBitableUrl !== urlInput.trim()

  // ── 高级设置 ──────────────────────────────────────────────────────────────
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [videoStartTime] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return fmtDate(d)
  })
  const [videoEndTime] = useState<string>(() => fmtDate(new Date()))
  const [videoStart, setVideoStart] = useState(videoStartTime)
  const [videoEnd, setVideoEnd] = useState(videoEndTime)
  const [materialsPerUnit, setMaterialsPerUnit] = useState('10')

  // ── 流程状态 ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('idle')
  const [previewResult, setPreviewResult] = useState<ExcelBatchPreviewResponse | null>(null)
  const [execResult, setExecResult] = useState<ExcelBatchCreateAdsResponse | null>(null)
  /** 预检/执行业务类 400 提示（与 toast 配合，便于用户对照表格修改） */
  const [flowAlert, setFlowAlert] = useState<{
    variant: 'warning' | 'destructive'
    title: string
    body: string
  } | null>(null)

  const busy = step === 'checking' || step === 'executing'

  // ── 创建模板表 ────────────────────────────────────────────────────────────
  const handleCreateTemplate = async (): Promise<void> => {
    setCreating(true)
    try {
      const res = await oceanEngineBitableAdService.createTemplate({
        bitable_name: bitableName.trim() || '投放配置表',
        with_example: withExample
      })
      setCreatedBitable(res)
      setUrlInput(res.app_url)
      toast.success('模板表创建成功，链接已自动填入下方')
      setShowCreateForm(false)
    } catch (e) {
      toast.error(`创建失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setCreating(false)
    }
  }

  // ── 构建提交请求体 ────────────────────────────────────────────────────────
  const buildRequest = (): BitableAdSubmitRequest => {
    if (!parsed) throw new Error('Bitable URL 未解析')
    return {
      app_token: parsed.appToken,
      table_id: parsed.tableId,
      org_advertiser_ids: Array.from(orgIds),
      materials_per_unit: parseInt(materialsPerUnit, 10) || 10,
      video_start_time: videoStart || undefined,
      video_end_time: videoEnd || undefined
    }
  }

  // ── 预检 ──────────────────────────────────────────────────────────────────
  const handleCheck = async (): Promise<void> => {
    if (orgIds.size === 0) {
      toast.error('请先在步骤①勾选授权来源账户')
      return
    }
    if (!parsed) {
      toast.error('请先填写正确的 Bitable 链接')
      return
    }
    setStep('checking')
    setPreviewResult(null)
    setExecResult(null)
    setFlowAlert(null)
    try {
      const res = await oceanEngineBitableAdService.preview(buildRequest())
      setPreviewResult(res)
      setStep('checked')
      setFlowAlert(null)
      if (res.has_warnings) {
        toast.warning(`预检完成，存在警告，请确认后再执行`)
      } else {
        toast.success(
          `预检通过，共 ${res.total_accounts} 个账户，预计 ${res.total_promotions} 个广告单元`
        )
      }
    } catch (e) {
      const msg = getApiErrorMessage(e)
      const noPreviewRows = msg.includes('未读取到可预检的配置行')
      const parseFormatErr = msg.includes('未读取到有效配置行') && msg.includes('格式错误')
      if (noPreviewRows || parseFormatErr) {
        const title = noPreviewRows ? '当前没有可预检的数据行' : '表格数据格式校验未通过'
        setFlowAlert({ variant: 'warning', title, body: msg })
        toast.warning(title, {
          description: msg.length > 120 ? `${msg.slice(0, 120)}…` : msg,
          duration: 14000
        })
      } else {
        setFlowAlert({ variant: 'destructive', title: '预检失败', body: msg })
        toast.error(`预检失败：${msg}`)
      }
      setStep('idle')
    }
  }

  // ── 执行 ──────────────────────────────────────────────────────────────────
  const handleExecute = async (): Promise<void> => {
    if (orgIds.size === 0) {
      toast.error('请先在步骤①勾选授权来源账户')
      return
    }
    if (!parsed) {
      toast.error('请先填写正确的 Bitable 链接')
      return
    }
    setStep('executing')
    setFlowAlert(null)
    try {
      const res = await oceanEngineBitableAdService.execute(buildRequest())
      setExecResult(res)
      setStep('done')
      onResult(res.account_results)
      const ok = res.account_results.filter((r) => r.success).length
      toast.success(`完成：${ok}/${res.account_results.length} 行执行成功`)
      setFlowAlert(null)
    } catch (e) {
      const msg = getApiErrorMessage(e)
      if (msg.includes('没有状态为「已通过」')) {
        const title = '暂无可执行的行'
        setFlowAlert({ variant: 'warning', title, body: msg })
        toast.warning(title, { description: msg, duration: 12000 })
      } else {
        setFlowAlert({ variant: 'destructive', title: '执行失败', body: msg })
        toast.error(`执行失败：${msg}`)
      }
      setStep('checked')
    }
  }

  // ── 重置 ──────────────────────────────────────────────────────────────────
  const handleReset = (): void => {
    setStep('idle')
    setPreviewResult(null)
    setExecResult(null)
    setFlowAlert(null)
  }

  return (
    <div className="space-y-4">
      {/* ── 创建模板表 ──────────────────────────────────────────────────── */}
      <div className="rounded-md border">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          onClick={() => setShowCreateForm((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            创建投放模板表（新建飞书多维表格）
          </span>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${showCreateForm ? 'rotate-180' : ''}`}
          />
        </button>

        {showCreateForm && (
          <div className="border-t px-4 py-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              在飞书云空间自动创建一张含有所有投放字段的多维表格，创建完成后链接将自动填入下方。
              <br />
              模板含「素材所在账户」列（字段 material_advertiser_id）：不填时从本行投放广告主账户拉取视频素材。
              <br />
              需已完成飞书账号绑定（系统设置 → 飞书绑定）。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">表格名称</Label>
                <Input
                  value={bitableName}
                  onChange={(e) => setBitableName(e.target.value)}
                  placeholder="投放配置表"
                  className="text-sm"
                />
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none pb-2">
                  <input
                    type="checkbox"
                    checked={withExample}
                    onChange={(e) => setWithExample(e.target.checked)}
                    className="rounded"
                  />
                  插入示例数据行
                </label>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={creating}
              onClick={() => void handleCreateTemplate()}
              className="gap-1.5"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  创建中…
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  创建模板表
                </>
              )}
            </Button>

            {createdBitable && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-green-800 truncate flex-1">{createdBitable.app_url}</span>
                <a
                  href={createdBitable.app_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-green-600 hover:text-green-800"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bitable URL 输入 ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">飞书多维表格链接</Label>
        <Input
          value={urlInput}
          onChange={(e) => {
            setUrlInput(e.target.value)
            // URL 变更时重置流程
            if (step !== 'idle') handleReset()
          }}
          placeholder="https://xxx.feishu.cn/base/bascnXXX?table=tblXXX"
          className={`font-mono text-xs ${parseError ? 'border-destructive' : parsed ? 'border-green-400' : ''}`}
        />
        {parseError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {parseError}
          </p>
        )}
        {urlExtractedHint && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 shrink-0 text-green-600" />
            已从粘贴内容中识别链接（含前后文字、Markdown 等）
          </p>
        )}
        {parsed && (
          <p className="text-xs text-green-700 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            app_token: <span className="font-mono">{parsed.appToken}</span>
            {parsed.tableId && (
              <>
                {' '}
                · table_id: <span className="font-mono">{parsed.tableId}</span>
              </>
            )}
            {!parsed.tableId && (
              <span className="text-muted-foreground"> · table 未指定（将用首张表）</span>
            )}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          链接格式：在飞书多维表格中点击「分享」→ 复制链接，或直接粘贴浏览器地址栏 URL。
          <br />
          table_id 可选；若未指定，后端将读取多维表格的第一张数据表。
          <br />
          <span className="text-amber-800/90">预检仅处理 status 为「待提交」或留空的业务行</span>
          （说明行、示例行会自动跳过）。
          <br />
          素材账户列留空时，预检与创建均按本行 advertiser_id 查询视频库。
        </p>
      </div>

      {/* ── 高级设置 ─────────────────────────────────────────────────────── */}
      <div className="rounded-md border">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <span className="font-medium text-xs text-muted-foreground">
            高级设置（单元素材数 / 素材时间范围）
          </span>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
          />
        </button>
        {showAdvanced && (
          <div className="border-t px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">单元素材数（1～30）</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={materialsPerUnit}
                onChange={(e) => setMaterialsPerUnit(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">素材查询起始</Label>
              <Input
                type="date"
                value={videoStart}
                onChange={(e) => setVideoStart(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">素材查询截止</Label>
              <Input
                type="date"
                value={videoEnd}
                onChange={(e) => setVideoEnd(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 操作按钮 ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={busy || !parsed || orgIds.size === 0}
          onClick={() => void handleCheck()}
          className="gap-1.5"
        >
          {step === 'checking' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              预检中…
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              {step === 'checked' ? '重新预检' : '预检配置'}
            </>
          )}
        </Button>

        {(step === 'checked' || step === ('preview' as Step)) && (
          <Button
            type="button"
            disabled={busy || orgIds.size === 0}
            onClick={() => void handleExecute()}
            className="gap-1.5"
          >
            {step === 'executing' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                执行中…
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                执行投放
              </>
            )}
          </Button>
        )}

        {step === 'done' && (
          <Button type="button" variant="outline" onClick={handleReset} className="gap-1.5">
            <RefreshCw className="w-4 h-4" />
            重新操作
          </Button>
        )}

        {orgIds.size === 0 && (
          <p className="text-xs text-destructive">请先在步骤①勾选授权来源账户</p>
        )}
      </div>

      {flowAlert && (
        <div
          className={`rounded-md border px-3 py-2.5 text-sm ${
            flowAlert.variant === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-950'
              : 'border-destructive/30 bg-destructive/5 text-destructive'
          }`}
          role="alert"
        >
          <div className="flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium">{flowAlert.title}</p>
              <p className="text-xs leading-relaxed whitespace-pre-wrap opacity-90">
                {flowAlert.body}
              </p>
              <button
                type="button"
                className="text-xs underline underline-offset-2 hover:opacity-80"
                onClick={() => setFlowAlert(null)}
              >
                关闭提示
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 预检结果 ─────────────────────────────────────────────────────── */}
      {previewResult && (
        <div className="rounded-md border">
          <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
            {previewResult.has_warnings ? (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-600" />
            )}
            <span className="text-sm font-medium">预检结果</span>
            <span className="text-xs text-muted-foreground">
              共 {previewResult.total_accounts} 个账户 · 预计 {previewResult.total_promotions}{' '}
              个广告单元
              {previewResult.has_warnings && ' · 有警告'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="text-left p-2 font-medium w-8">#</th>
                  <th className="text-left p-2 font-medium">广告主 ID</th>
                  <th
                    className="text-left p-2 font-medium max-w-[100px]"
                    title="实际用于拉取视频素材的广告主 ID"
                  >
                    素材账户
                  </th>
                  <th className="text-left p-2 font-medium">模板</th>
                  <th className="text-left p-2 font-medium">漫剧名称</th>
                  <th className="text-left p-2 font-medium">商品 ID</th>
                  <th className="text-left p-2 font-medium">素材/单元</th>
                  <th className="text-left p-2 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {previewResult.rows.map((r) => {
                  const hasWarn = r.warnings.length > 0
                  return (
                    <tr
                      key={r.row_index}
                      className={`border-b last:border-0 ${hasWarn ? 'bg-amber-50/50' : ''}`}
                    >
                      <td className="p-2 text-muted-foreground">{r.row_index + 1}</td>
                      <td className="p-2 font-mono">{r.advertiser_id}</td>
                      <td className="p-2 font-mono text-[11px] max-w-[100px] truncate" title={r.material_advertiser_id}>
                        {r.material_advertiser_id}
                      </td>
                      <td className="p-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            r.template === 'puju'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {r.template === 'puju' ? '端原生-铺剧' : '端原生-测剧'}
                        </span>
                      </td>
                      <td className="p-2 max-w-[160px] truncate" title={r.drama_name}>
                        {r.drama_name}
                      </td>
                      <td className="p-2">
                        {r.product_id ? (
                          <span className="font-mono text-green-700 truncate block max-w-[120px]">
                            {r.product_id}
                          </span>
                        ) : r.product_id_error ? (
                          <span className="text-amber-600" title={r.product_id_error}>
                            ⚠ 未找到
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-2">
                        <span
                          className={
                            r.matched_video_count === 0 ? 'text-amber-600' : 'text-green-700'
                          }
                        >
                          {r.matched_video_count} 个 → {r.promotion_count} 单元
                        </span>
                      </td>
                      <td className="p-2">
                        {hasWarn ? (
                          <span className="text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            有警告
                          </span>
                        ) : (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 shrink-0" />
                            通过
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {previewResult.has_warnings && (
            <div className="border-t px-4 py-3 space-y-1">
              {previewResult.rows
                .filter((r) => r.warnings.length > 0)
                .map((r) => (
                  <p key={r.row_index} className="text-xs text-amber-700">
                    <span className="font-medium">
                      第 {r.row_index + 1} 行（{r.drama_name}）：
                    </span>
                    {r.warnings.join(' / ')}
                  </p>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── 执行结果 ─────────────────────────────────────────────────────── */}
      {execResult && (
        <div className="rounded-md border overflow-x-auto">
          <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium">执行结果</span>
            <span className="text-xs text-muted-foreground">
              成功 {execResult.account_results.filter((r) => r.success).length}/
              {execResult.account_results.length} 行
            </span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left p-2 font-medium">广告主 ID</th>
                <th className="text-left p-2 font-medium">状态</th>
                <th className="text-left p-2 font-medium">项目</th>
                <th className="text-left p-2 font-medium">广告单元</th>
                <th className="text-left p-2 font-medium">说明</th>
              </tr>
            </thead>
            <tbody>
              {execResult.account_results.map((r, idx) => {
                const projectId =
                  r.project.data &&
                  !Array.isArray(r.project.data) &&
                  typeof r.project.data === 'object'
                    ? (r.project.data as Record<string, unknown>).project_id
                    : undefined
                return (
                  <tr key={idx} className="border-b last:border-0 align-top">
                    <td className="p-2 font-mono">{r.advertiser_id}</td>
                    <td className="p-2">
                      {r.success ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          成功
                        </span>
                      ) : (
                        <span className="text-destructive flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          失败
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      <div>code {r.project.code ?? '—'}</div>
                      {projectId !== undefined && (
                        <div className="text-green-600 font-mono">
                          project_id: {String(projectId)}
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      {r.promotions.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="space-y-0.5">
                          {r.promotions.map((p, i) => (
                            <div
                              key={i}
                              className={p.success ? 'text-green-600' : 'text-destructive'}
                            >
                              单元{i + 1} code {p.code ?? '—'}
                              {p.message && (
                                <span className="text-muted-foreground ml-1">({p.message})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-2 max-w-xs break-words text-muted-foreground">
                      {r.message ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
