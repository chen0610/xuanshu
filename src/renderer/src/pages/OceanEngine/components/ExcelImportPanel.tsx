import React, { useCallback, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Upload,
  XCircle
} from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label
} from '../../../components/ui'
import {
  oceanEngineExcelAdService,
  type ExcelAdRowConfig,
  type ExcelBatchCreateAdsRequest,
  type ExcelBatchCreateAdsResponse,
  type ExcelBatchPreviewResponse,
  type ExcelBatchPreviewRow,
  type OceanEngineBatchCreateAdsAccountResult
} from '../../../services/ocean-engine.service'
import { toast } from 'sonner'

// Excel 表头列名（与 excel_template_generator.py 中 COLUMN_DEFS 顺序一致）
const EXPECTED_HEADERS = [
  'advertiser_id',
  'material_advertiser_id',
  'template',
  'drama_name',
  'playlet_url',
  'aweme_id',
  'budget',
  'roi_goal',
  'material_keywords',
  'source',
  'project_name',
  'promo_name',
  'product_platform_id',
  'materials_per_unit'
] as const

type ColumnKey = (typeof EXPECTED_HEADERS)[number]

/** 日期 YYYY-MM-DD */
function fmtDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

interface ExcelImportPanelProps {
  /** 已选授权来源组织 ID 集合（来自步骤①） */
  orgIds: Set<string>
  /** 执行成功后回调（传递结果供外层显示） */
  onResult: (res: OceanEngineBatchCreateAdsAccountResult[]) => void
}

type Step = 'upload' | 'preview' | 'checking' | 'checked' | 'executing' | 'done'

export const ExcelImportPanel: React.FC<ExcelImportPanelProps> = ({ orgIds, onResult }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ExcelAdRowConfig[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])

  // 预检结果
  const [previewResult, setPreviewResult] = useState<ExcelBatchPreviewResponse | null>(null)

  // 素材时间范围
  const [videoStartTime, setVideoStartTime] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return fmtDate(d)
  })
  const [videoEndTime, setVideoEndTime] = useState<string>(() => fmtDate(new Date()))
  const [materialsPerUnit, setMaterialsPerUnit] = useState('10')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // 执行结果
  const [execResult, setExecResult] = useState<ExcelBatchCreateAdsResponse | null>(null)

  // ── Excel 解析 ────────────────────────────────────────────────────────────

  const parseExcel = useCallback((file: File) => {
    setFileName(file.name)
    setParseErrors([])
    setRows([])
    setPreviewResult(null)
    setExecResult(null)
    setStep('upload')

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        // 从第 2 行（index=1）开始读表头，第 3 行是描述行跳过，第 4 行起是数据
        // 但 sheet_to_json 默认用第一行作为 header；这里后端模板第 1 行是说明，第 2 行是表头
        // 所以用 range 指定从第 2 行（row 1, 0-based）开始
        const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
        range.s.r = 1 // 从第 2 行（index 1）开始作为表头
        ws['!ref'] = XLSX.utils.encode_range(range)

        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: '',
          raw: false
        })

        // 跳过第 1 条（描述行）和空行
        const errors: string[] = []
        const parsed: ExcelAdRowConfig[] = []

        for (let i = 0; i < raw.length; i++) {
          const r = raw[i]
          // 描述行检测：advertiser_id 单元格含有中文「投放广告主」说明是描述行，跳过
          const advId = String(r['advertiser_id *'] ?? r['advertiser_id'] ?? '').trim()
          if (
            !advId ||
            advId.includes('投放') ||
            advId.includes('广告主') ||
            advId.includes('ID')
          ) {
            continue
          }

          // 必填字段读取（带 * 后缀兼容）
          const get = (key: ColumnKey): string => {
            const withStar = r[`${key} *`]
            const plain = r[key]
            return String(withStar ?? plain ?? '').trim()
          }

          const template = get('template')
          const dramaName = get('drama_name')
          const playletUrl = get('playlet_url')

          const rowLabel = `第 ${i + 2} 行`

          if (!advId) {
            errors.push(`${rowLabel}: advertiser_id 为空`)
            continue
          }
          if (template !== 'puju' && template !== 'ceju') {
            errors.push(`${rowLabel}: template 必须为 puju 或 ceju（当前值：${template || '空'}）`)
            continue
          }
          if (!dramaName) {
            errors.push(`${rowLabel}: drama_name 为空`)
            continue
          }
          if (!playletUrl) {
            errors.push(`${rowLabel}: playlet_url 为空`)
            continue
          }
          if (!playletUrl.startsWith('aweme://')) {
            errors.push(`${rowLabel}: playlet_url 需以 aweme:// 开头`)
          }

          const budgetRaw = get('budget')
          const roiRaw = get('roi_goal')
          const mpuRaw = get('materials_per_unit')
          const materialAdvRaw = get('material_advertiser_id')

          // 单元素材数校验
          let rowMpu: number | undefined
          if (mpuRaw) {
            const mpuParsed = parseInt(mpuRaw, 10)
            if (isNaN(mpuParsed) || mpuParsed < 1 || mpuParsed > 30) {
              errors.push(
                `第 ${i + 2} 行: materials_per_unit 必须为 1～30 的整数（当前値：${mpuRaw}）`
              )
            } else {
              rowMpu = mpuParsed
            }
          }

          parsed.push({
            advertiser_id: advId,
            material_advertiser_id: materialAdvRaw || undefined,
            template: template as 'puju' | 'ceju',
            drama_name: dramaName,
            playlet_url: playletUrl,
            aweme_id: get('aweme_id') || undefined,
            budget: budgetRaw ? parseInt(budgetRaw, 10) : undefined,
            roi_goal: roiRaw ? parseFloat(roiRaw) : undefined,
            material_keywords: get('material_keywords') || undefined,
            source: get('source') || undefined,
            project_name: get('project_name') || undefined,
            promo_name: get('promo_name') || undefined,
            product_platform_id: get('product_platform_id') || undefined,
            materials_per_unit: rowMpu
          })
        }

        setParseErrors(errors)
        setRows(parsed)
        if (parsed.length > 0) {
          setStep('preview')
          if (errors.length > 0) {
            toast.warning(`解析完成，${parsed.length} 行有效，${errors.length} 行有格式错误`)
          } else {
            toast.success(`解析成功，共 ${parsed.length} 行配置`)
          }
        } else {
          toast.error('未解析到有效数据行，请检查文件格式')
        }
      } catch (err) {
        toast.error(`文件解析失败：${err instanceof Error ? err.message : String(err)}`)
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (file) parseExcel(file)
    e.target.value = ''
  }

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) parseExcel(file)
    },
    [parseExcel]
  )

  // ── 构建请求体 ────────────────────────────────────────────────────────────

  const buildRequest = (rowsOverride?: ExcelAdRowConfig[]): ExcelBatchCreateAdsRequest => ({
    org_advertiser_ids: Array.from(orgIds),
    rows: rowsOverride ?? rows,
    materials_per_unit: parseInt(materialsPerUnit, 10) || 10,
    video_start_time: videoStartTime || undefined,
    video_end_time: videoEndTime || undefined
  })

  // ── 预检 ──────────────────────────────────────────────────────────────────

  const handleCheck = async (): Promise<void> => {
    if (orgIds.size === 0) {
      toast.error('请先在步骤①勾选授权来源账户')
      return
    }
    setStep('checking')
    try {
      const res = await oceanEngineExcelAdService.preview(buildRequest())
      setPreviewResult(res)
      setStep('checked')
      if (res.has_warnings) {
        toast.warning(`预检完成，存在警告，请确认后再执行`)
      } else {
        toast.success(
          `预检通过，共 ${res.total_accounts} 个账户，预计 ${res.total_promotions} 个广告单元`
        )
      }
    } catch (err) {
      toast.error(`预检失败：${err instanceof Error ? err.message : String(err)}`)
      setStep('preview')
    }
  }

  // ── 执行 ──────────────────────────────────────────────────────────────────

  const handleExecute = async (): Promise<void> => {
    if (orgIds.size === 0) {
      toast.error('请先在步骤①勾选授权来源账户')
      return
    }
    setStep('executing')
    try {
      // 将预检结果中的 product_id 回填到 rows 中，避免 execute 重复查询
      const enrichedRows: ExcelAdRowConfig[] = rows.map((row, idx) => {
        const pRow = previewResult?.rows.find((r) => r.row_index === idx)
        return pRow?.product_id ? { ...row, product_id: pRow.product_id } : row
      })
      const res = await oceanEngineExcelAdService.execute(buildRequest(enrichedRows))
      setExecResult(res)
      setStep('done')
      onResult(res.account_results)
      const ok = res.account_results.filter((r) => r.success).length
      toast.success(`完成：${ok}/${res.account_results.length} 行执行成功`)
    } catch (err) {
      toast.error(`执行失败：${err instanceof Error ? err.message : String(err)}`)
      setStep('checked')
    }
  }

  // ── 重置 ──────────────────────────────────────────────────────────────────

  const handleReset = (): void => {
    setStep('upload')
    setFileName('')
    setRows([])
    setParseErrors([])
    setPreviewResult(null)
    setExecResult(null)
  }

  // ── 渲染辅助 ──────────────────────────────────────────────────────────────

  const isChecking = step === 'checking'
  const isExecuting = step === 'executing'
  const busy = isChecking || isExecuting

  return (
    <div className="space-y-4">
      {/* ── 步骤1：上传区 ──────────────────────────────────────────────── */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`relative border-2 border-dashed rounded-lg transition-colors ${
          step === 'upload'
            ? 'border-primary/40 bg-primary/5 hover:border-primary/60 hover:bg-primary/10'
            : 'border-muted bg-muted/30'
        }`}
      >
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <FileSpreadsheet
            className={`w-10 h-10 ${step === 'upload' ? 'text-primary/60' : 'text-muted-foreground/40'}`}
          />
          {step === 'upload' ? (
            <>
              <p className="text-sm text-muted-foreground">
                拖拽 Excel 文件到此处，或
                <button
                  type="button"
                  className="mx-1 text-primary font-medium hover:underline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  点击上传
                </button>
                (.xlsx / .xls)
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  void oceanEngineExcelAdService
                    .downloadTemplate()
                    .catch((e) => toast.error(String(e)))
                }
              >
                <Download className="w-4 h-4" />
                下载模板
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              <span className="font-medium truncate max-w-xs">{fileName}</span>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-primary ml-2"
                onClick={handleReset}
              >
                重新上传
              </button>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* 解析错误 */}
      {parseErrors.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1">
          <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            {parseErrors.length} 行格式错误（已跳过）
          </p>
          {parseErrors.map((e, i) => (
            <p key={i} className="text-xs text-amber-700 pl-4">
              {e}
            </p>
          ))}
        </div>
      )}

      {/* ── 步骤2：解析预览表格 ──────────────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="rounded-md border">
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
            <span className="text-sm font-medium">
              已解析 {rows.length} 行
              {previewResult && (
                <span className="ml-2 text-xs text-muted-foreground">
                  · {previewResult.total_accounts} 个账户 · 预计 {previewResult.total_promotions}{' '}
                  个广告单元
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {(step === 'preview' || step === 'checked') && !busy && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={busy || orgIds.size === 0}
                  onClick={() => void handleCheck()}
                >
                  {isChecking ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  {step === 'checked' ? '重新预检' : '服务端预检'}
                </Button>
              )}
              {isChecking && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  预检中，正在查询商品和素材…
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="text-left p-2 font-medium w-8">#</th>
                  <th className="text-left p-2 font-medium">广告主 ID</th>
                  <th
                    className="text-left p-2 font-medium max-w-[100px]"
                    title="视频素材库归属；留空同左列"
                  >
                    素材账户
                  </th>
                  <th className="text-left p-2 font-medium">模板</th>
                  <th className="text-left p-2 font-medium">漫剧名称</th>
                  <th className="text-left p-2 font-medium">预算</th>
                  <th className="text-left p-2 font-medium">ROI</th>
                  <th className="text-left p-2 font-medium" title="每单元最多视频数；留空=全局设置">
                    素材数/单元
                  </th>
                  {previewResult && (
                    <>
                      <th className="text-left p-2 font-medium">商品 ID</th>
                      <th className="text-left p-2 font-medium">素材数</th>
                      <th className="text-left p-2 font-medium">状态</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const pRow = previewResult?.rows.find((r) => r.row_index === idx)
                  const hasWarning = (pRow?.warnings?.length ?? 0) > 0
                  return (
                    <tr
                      key={idx}
                      className={`border-b last:border-0 ${hasWarning ? 'bg-amber-50/50' : ''}`}
                    >
                      <td className="p-2 text-muted-foreground">{idx + 1}</td>
                      <td className="p-2 font-mono">{row.advertiser_id}</td>
                      <td className="p-2 font-mono text-[11px] max-w-[100px] truncate" title={pRow?.material_advertiser_id ?? row.material_advertiser_id ?? row.advertiser_id}>
                        {pRow?.material_advertiser_id ??
                          (row.material_advertiser_id || row.advertiser_id)}
                      </td>
                      <td className="p-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            row.template === 'puju'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {row.template === 'puju' ? '端原生-铺剧' : '端原生-测剧'}
                        </span>
                      </td>
                      <td className="p-2 max-w-[160px] truncate" title={row.drama_name}>
                        {row.drama_name}
                      </td>
                      <td className="p-2">{row.budget ?? 300}</td>
                      <td className="p-2">
                        {row.template === 'puju' ? (row.roi_goal ?? 0.9) : '—'}
                      </td>
                      <td className="p-2">
                        {row.materials_per_unit ? (
                          <span className="font-medium">{row.materials_per_unit}</span>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">
                            继承{materialsPerUnit}
                          </span>
                        )}
                      </td>
                      {previewResult && (
                        <>
                          <td className="p-2">
                            {pRow?.product_id ? (
                              <span className="font-mono text-green-700 truncate block max-w-[120px]">
                                {pRow.product_id}
                              </span>
                            ) : pRow?.product_id_error ? (
                              <span
                                className="text-amber-600 truncate block max-w-[120px]"
                                title={pRow.product_id_error}
                              >
                                ⚠ 未找到
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-2">
                            {pRow !== undefined ? (
                              <span
                                className={
                                  pRow.matched_video_count === 0
                                    ? 'text-amber-600'
                                    : 'text-green-700'
                                }
                              >
                                {pRow.matched_video_count} 个 → {pRow.promotion_count} 单元
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-2">
                            {pRow ? (
                              hasWarning ? (
                                <span className="text-amber-600 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  有警告
                                </span>
                              ) : (
                                <span className="text-green-600 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 shrink-0" />
                                  通过
                                </span>
                              )
                            ) : null}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 警告详情 */}
          {previewResult?.has_warnings && (
            <div className="border-t px-4 py-3 space-y-2">
              {previewResult.rows
                .filter((r) => r.warnings.length > 0)
                .map((r) => (
                  <div key={r.row_index} className="text-xs text-amber-700">
                    <span className="font-medium">
                      第 {r.row_index + 1} 行（{r.drama_name}）：
                    </span>
                    {r.warnings.join(' / ')}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── 步骤3：高级设置 + 执行按钮 ──────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="space-y-3">
          {/* 时间范围 + 并发 */}
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
                  <Label className="text-xs">单元素材数（1～30，默认10）</Label>
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
                  <Label className="text-xs">素材查询起始日期</Label>
                  <Input
                    type="date"
                    value={videoStartTime}
                    onChange={(e) => setVideoStartTime(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">素材查询截止日期</Label>
                  <Input
                    type="date"
                    value={videoEndTime}
                    onChange={(e) => setVideoEndTime(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* 预检按钮（仅 upload/preview 状态，在顶部也有，此处作为主要入口） */}
            {step === 'preview' && (
              <Button
                type="button"
                variant="outline"
                disabled={busy || orgIds.size === 0}
                onClick={() => void handleCheck()}
                className="gap-1.5"
              >
                <Search className="w-4 h-4" />
                服务端预检（查商品 & 素材）
              </Button>
            )}

            {/* 执行按钮 */}
            {(step === 'checked' || step === 'preview') && (
              <Button
                type="button"
                disabled={busy || orgIds.size === 0}
                onClick={() => void handleExecute()}
                className="gap-1.5"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    执行中…
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    批量创建（{rows.length} 行）
                  </>
                )}
              </Button>
            )}

            {step === 'done' && (
              <Button type="button" variant="outline" onClick={handleReset} className="gap-1.5">
                <RefreshCw className="w-4 h-4" />
                重新导入
              </Button>
            )}

            {orgIds.size === 0 && (
              <p className="text-xs text-destructive">请先在步骤①勾选授权来源账户</p>
            )}
          </div>
        </div>
      )}

      {/* ── 步骤4：执行结果 ───────────────────────────────────────────────── */}
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
                          <CheckCircle className="w-3 h-3" /> 成功
                        </span>
                      ) : (
                        <span className="text-destructive flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> 失败
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
