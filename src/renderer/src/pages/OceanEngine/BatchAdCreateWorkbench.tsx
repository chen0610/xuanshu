import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Copy as CopyIcon,
  Eye,
  FileSpreadsheet,
  Layers3,
  ListChecks,
  Loader2,
  Megaphone,
  PartyPopper,
  RefreshCw,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  Wand2,
  X
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Checkbox,
  Input,
  Label,
  Textarea,
  RadioGroup,
  RadioGroupItem,
  Switch
} from '../../components/ui'
import { oceanEngineOAuthService } from '../../services/ocean-engine-oauth.service'
import {
  oceanEngineBatchAdService,
  dpaProductService,
  awemeAuthService,
  pAssistantServiceExtended,
  videoMaterialService,
  type GetDramaTitlesResponse,
  type OceanEngineAdTemplateDetail,
  type OceanEngineAdTemplateSummary,
  type OceanEngineCustomAdTemplate,
  type OceanEngineTemplateValidationError,
  type OceanEngineBatchCreateAdsAccountResult,
  type OceanEngineBatchCreateAdsRequest,
  type BatchCreateJobEnqueueRequest,
  type PromotionProjectSearchItem,
  type AwemeAuthItem,
  type VideoMaterialFetchMode,
  type VideoMaterialItem,
  type VideoMaterialPageInfo,
  type DpaProductLibraryItem,
  type OceanEngineWebProjectDynamicParamConfigItem,
  type OceanEngineWebProjectDynamicParamOverride
} from '../../services/ocean-engine.service'
import { configService } from '../../services/config.service'
import type { Config } from '../../types/config.types'
import type { OceanEngineOAuthToken } from '../../types/ocean-engine-oauth.types'
import { CreateResultCard } from './components/CreateResultCard'
import {
  QuickConfigCard,
  type ProjectMode,
  type VideoMaterialDistributionMode
} from './components/QuickConfigCard'
import { TemplateSelectorCard } from './components/TemplateSelectorCard'
import { ExcelImportPanel } from './components/ExcelImportPanel'
import { BitableImportPanel } from './components/BitableImportPanel'
import {
  VideoSelectorCard,
  type VideoMaterialPageSize
} from './components/VideoSelectorCard'
import { ProductMainImageUploader } from './components/ProductMainImageUploader'
import {
  WebProjectDynamicParamsPanel,
  type WebProjectDynamicParamFormItem
} from './components/WebProjectDynamicParamsPanel'
import {
  buildCustomTemplatePayload,
  createCustomTemplateFormState,
  CustomTemplateConfigurator,
  CUSTOM_TEMPLATE_CODE,
  type CustomTemplateFormState
} from './components/CustomTemplateConfigurator'
import {
  clearBatchAdEmbedDraft,
  loadBatchAdEmbedDraft,
  saveBatchAdEmbedDraft,
  type BatchAdCustomTitleMode,
  type BatchAdEmbedDraftV1
} from './batch-ad-create-embed-draft'
import {
  datetimeLocalToNaiveIso,
  defaultScheduledDatetimeLocal,
  formatScheduledAtDisplay,
  validateScheduledDatetimeLocal
} from './batch-ad-create-schedule'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'

type InputMode = 'manual' | 'excel' | 'bitable'
type SelectedTemplateCode = string | null
/** Stepper 路径：setup 是顶部准备（OAuth/Cookie/模板/创建方式），execute 是 Excel/Bitable 的上传执行步 */
type ManualStepKey = 'setup' | 'accounts' | 'project' | 'unit' | 'material' | 'submit' | 'execute'

interface ManualStepItem {
  key: ManualStepKey
  title: string
  description: string
  done: boolean
  disabled?: boolean
}

/** 预检错误负责的 step，用于 Inspector 错误点击跳转 */
interface ManualPreflightError {
  message: string
  stepKey: ManualStepKey
}

function parseAccountLines(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

const TITLE_MATERIALS_PER_UNIT = 10

function parseTitleLines(text: string): string[] {
  const out: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim()
    if (s) out.push(s)
  }
  return out
}

function fmtDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function getImageMode(v: { width: number; height: number }): string {
  return v.width > v.height ? 'CREATIVE_IMAGE_MODE_VIDEO' : 'CREATIVE_IMAGE_MODE_VIDEO_VERTICAL'
}

function parseWebProjectDynamicParamPasteRows(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n+$/, '')
  if (!normalized.trim()) return []
  return normalized
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.split('\t').map((cell) => cell.trim()))
}
function computeVideoCoverId(posterUrl: string): string {
  const withoutProtocol = posterUrl.replace(/^https?:\/\//, '')
  const withoutParams = withoutProtocol.split('?')[0]
  const parts = withoutParams.split('/')
  const second = parts[1] ?? ''
  const thirdRaw = parts[2] ?? ''
  const third = thirdRaw.split('~')[0]
  return `${second}/${third}`
}

function pickRandom(pool: string[], count: number): string[] {
  const arr = [...pool]
  const n = Math.min(count, arr.length)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (arr.length - i))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, n)
}

function buildTitleMaterialList(pool: string[], mode: BatchAdCustomTitleMode): { title: string }[] {
  if (pool.length === 0) return []
  const count = Math.min(TITLE_MATERIALS_PER_UNIT, pool.length)
  const effectiveMode = pool.length < TITLE_MATERIALS_PER_UNIT ? 'uniform' : mode
  const titles =
    effectiveMode === 'uniform' ? pool.slice(0, count) : pickRandom(pool, count)
  return titles.map((title) => ({ title }))
}

function chunkVideosByUnit(
  videos: VideoMaterialItem[],
  materialCountPerUnit: number
): VideoMaterialItem[][] {
  if (videos.length === 0) return []
  const chunks: VideoMaterialItem[][] = []
  for (let i = 0; i < videos.length; i += materialCountPerUnit) {
    chunks.push(videos.slice(i, i + materialCountPerUnit))
  }
  return chunks
}

function shuffleVideos(videos: VideoMaterialItem[]): VideoMaterialItem[] {
  const arr = [...videos]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function buildCycledVideoChunksByUnit(
  videos: VideoMaterialItem[],
  materialCountPerUnit: number,
  targetChunkCount: number | null
): VideoMaterialItem[][] {
  const naturalChunks = chunkVideosByUnit(videos, materialCountPerUnit)
  if (targetChunkCount == null || targetChunkCount <= naturalChunks.length || videos.length === 0) {
    return naturalChunks
  }

  const chunkSize = Math.min(materialCountPerUnit, videos.length)
  const chunks: VideoMaterialItem[][] = []
  let offset = 0
  for (let i = 0; i < targetChunkCount; i += 1) {
    const chunk: VideoMaterialItem[] = []
    for (let j = 0; j < chunkSize; j += 1) {
      chunk.push(videos[(offset + j) % videos.length])
    }
    chunks.push(chunk)
    offset = (offset + chunkSize) % videos.length
  }
  return chunks
}

function splitVideosByAccount(
  videos: VideoMaterialItem[],
  accountCount: number
): VideoMaterialItem[][] {
  const safeAccountCount = Math.max(1, accountCount)
  const baseCount = Math.floor(videos.length / safeAccountCount)
  const remainder = videos.length % safeAccountCount
  const chunks: VideoMaterialItem[][] = []
  let offset = 0
  for (let i = 0; i < safeAccountCount; i += 1) {
    const size = baseCount + (i < remainder ? 1 : 0)
    chunks.push(videos.slice(offset, offset + size))
    offset += size
  }
  return chunks
}

function buildTargetUnitChunksByAccount(
  videos: VideoMaterialItem[],
  accountCount: number,
  materialCountPerUnit: number,
  targetUnitCount: number | null
): VideoMaterialItem[][][] {
  const safeAccountCount = Math.max(1, accountCount)
  const naturalUnitCount = Math.ceil(videos.length / Math.max(1, materialCountPerUnit))
  const totalUnitCount =
    targetUnitCount == null
      ? naturalUnitCount
      : safeAccountCount * Math.max(0, targetUnitCount)
  const result = Array.from({ length: safeAccountCount }, () => [] as VideoMaterialItem[][])
  if (videos.length === 0 || totalUnitCount === 0) {
    return result
  }

  const chunkSize = Math.min(materialCountPerUnit, videos.length)
  const fullChunksPerRound = Math.max(1, Math.floor(videos.length / chunkSize))
  let shuffled = shuffleVideos(videos)
  let offset = 0

  for (let unitIndex = 0; unitIndex < totalUnitCount; unitIndex += 1) {
    if (offset + chunkSize > fullChunksPerRound * chunkSize) {
      shuffled = shuffleVideos(videos)
      offset = 0
    }

    const accountIndex = unitIndex % safeAccountCount
    result[accountIndex].push(shuffled.slice(offset, offset + chunkSize))
    offset += chunkSize
  }

  return result
}

function parseMaterialKeywordParts(raw: string): string[] {
  return raw
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parsePipeList(raw: string): string[] {
  return raw
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
}

function joinPipeList(items: string[]): string {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .join('|')
}

function stringifyPipeList(value: unknown): string {
  return Array.isArray(value)
    ? value
        .map((item) => String(item ?? '').trim())
        .filter(Boolean)
        .join('|')
    : ''
}

function getPromotionMaterialTextDefaults(promotion: unknown): {
  sellingPoints: string
  callToActionButtons: string
} {
  if (!promotion || typeof promotion !== 'object') {
    return { sellingPoints: '', callToActionButtons: '' }
  }
  const p = promotion as Record<string, any>
  return {
    sellingPoints: stringifyPipeList(p.promotion_materials?.product_info?.selling_points),
    callToActionButtons: stringifyPipeList(p.promotion_materials?.call_to_action_buttons)
  }
}

/** 项目/单元名称占位符；提交生成广告时替换为实际值 */
export const BATCH_AD_NAME_PLACEHOLDER_TEMPLATE = '[来源]-[投放模板]-[剧名]-[日期]-[随机数]'

/** 自定义模板单元名称占位符；提交创建单元时替换为实际项目名、日期和单元序号 */
const CUSTOM_UNIT_NAME_PLACEHOLDER_TEMPLATE = '[项目名称]-[日期]-[自增数字]'

const NAME_PLACEHOLDER_MARKERS = ['[来源]', '[投放模板]', '[剧名]', '[日期]', '[随机数]'] as const
const CUSTOM_UNIT_NAME_PLACEHOLDER_MARKERS = ['[项目名称]', '[日期]', '[自增数字]'] as const

const BATCH_AD_NAME_RAND_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

function needsBatchAdNamePlaceholderExpand(s: string): boolean {
  return NAME_PLACEHOLDER_MARKERS.some((m) => s.includes(m))
}

function needsCustomUnitNamePlaceholderExpand(s: string): boolean {
  return CUSTOM_UNIT_NAME_PLACEHOLDER_MARKERS.some((m) => s.includes(m))
}

function expandCustomUnitNamePlaceholders(
  raw: string,
  parts: {
    projectName: string
    dateStr: string
    unitIndex: number
  }
): string {
  return raw
    .replaceAll('[项目名称]', parts.projectName || '项目名称')
    .replaceAll('[日期]', parts.dateStr)
    .replaceAll('[自增数字]', String(parts.unitIndex))
}

function randBatchAdNameSuffix4(): string {
  let out = ''
  for (let i = 0; i < 4; i += 1) {
    out += BATCH_AD_NAME_RAND_CHARS[Math.floor(Math.random() * BATCH_AD_NAME_RAND_CHARS.length)]
  }
  return out
}

/** 与名称占位符一致：本地 MMDD，如 0430 */
function getMarketingObjectiveByLandingType(landingType: string | null): string | null {
  if (landingType === '3' || landingType === 'APP') return '应用'
  if (landingType === '16' || landingType === 'MICRO_GAME') return '小程序'
  return null
}

function isAppLandingType(landingType: string | null): boolean {
  return landingType === '3' || landingType === 'APP'
}

function formatBatchAdNamePlaceholderDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}${day}`
}

function formatBatchAdDashedDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}-${day}`
}

function buildCustomTemplateDefaultUnitName(): string {
  return CUSTOM_UNIT_NAME_PLACEHOLDER_TEMPLATE
}

function appendOrReplaceUnitIndex(name: string, index: number): string {
  const baseName = name.trim()
  if (!baseName) return String(index)
  if (/-\d+$/.test(baseName)) return baseName.replace(/-\d+$/, `-${index}`)
  return `${baseName}-${index}`
}

function expandBatchAdNamePlaceholders(
  raw: string,
  parts: {
    source: string
    templateDisplay: string
    dramaName: string
    dateStr: string
    randomPart: string
  }
): string {
  return raw
    .replaceAll('[来源]', parts.source)
    .replaceAll('[投放模板]', parts.templateDisplay)
    .replaceAll('[剧名]', parts.dramaName)
    .replaceAll('[日期]', parts.dateStr)
    .replaceAll('[随机数]', parts.randomPart)
}

function buildBatchAdDefaultName(
  source: string,
  templateDisplay: string,
  dramaName: string,
  randomPart: string,
  date = new Date()
): string {
  return expandBatchAdNamePlaceholders(BATCH_AD_NAME_PLACEHOLDER_TEMPLATE, {
    source: source.trim() || '番茄',
    templateDisplay,
    dramaName,
    dateStr: formatBatchAdNamePlaceholderDate(date),
    randomPart
  })
}

function getBatchAdTemplateDisplayLabel(
  selectedTemplateCode: SelectedTemplateCode,
  customBaseTemplateCode: string,
  templateOptions: OceanEngineAdTemplateSummary[]
): string {
  if (!selectedTemplateCode) return '未选择模板'
  if (selectedTemplateCode === CUSTOM_TEMPLATE_CODE) {
    const base = templateOptions.find((t) => t.meta.code === customBaseTemplateCode)
    return (base?.meta.label || customBaseTemplateCode || '自定义').trim()
  }
  const t = templateOptions.find((x) => x.meta.code === selectedTemplateCode)
  return (t?.meta.label || selectedTemplateCode).trim()
}

interface ManualPreflightResult {
  ok: boolean
  /** 带 stepKey 的错误清单，能被 Inspector 作为快捷跳转使用 */
  errors: ManualPreflightError[]
}

interface TagInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  helper: string
  maxItems?: number
}

const TagInput: React.FC<TagInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  helper,
  maxItems = 10
}) => {
  const [inputValue, setInputValue] = useState('')
  const tags = useMemo(() => parsePipeList(value), [value])

  const commitInput = (): void => {
    const next = inputValue.trim()
    if (!next || tags.includes(next) || tags.length >= maxItems) {
      setInputValue('')
      return
    }
    onChange(joinPipeList([...tags, next]))
    setInputValue('')
  }

  const removeTag = (target: string): void => {
    onChange(joinPipeList(tags.filter((tag) => tag !== target)))
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="min-h-[72px] rounded-md border border-input bg-background px-2 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-foreground"
            >
              {tag}
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeTag(tag)}
                aria-label={`删除${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {tags.length < maxItems && (
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitInput()
                } else if (event.key === 'Backspace' && !inputValue && tags.length > 0) {
                  removeTag(tags[tags.length - 1])
                }
              }}
              onBlur={commitInput}
              placeholder={tags.length === 0 ? placeholder : ''}
              className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
            />
          )}
        </div>
      </div>
      <p className="text-[11px] leading-4 text-muted-foreground">
        {helper} 当前 {tags.length}/{maxItems}。
      </p>
    </div>
  )
}

interface AwemeOption {
  awemeId: string
  awemeName: string
  authType?: string | null
  authStatus?: string | null
}

function toAwemeOption(item: AwemeAuthItem): AwemeOption | null {
  const awemeId = String(item.aweme_id ?? '').trim()
  if (!awemeId) return null
  return {
    awemeId,
    awemeName: String(item.aweme_name ?? '').trim(),
    authType: item.auth_type ?? null,
    authStatus: item.auth_status ?? null
  }
}

function dedupeAwemeOptions(items: AwemeAuthItem[]): AwemeOption[] {
  const seen = new Set<string>()
  const options: AwemeOption[] = []
  for (const item of items) {
    const option = toAwemeOption(item)
    if (!option || seen.has(option.awemeId)) continue
    seen.add(option.awemeId)
    options.push(option)
  }
  return options
}

function getAwemeDisplayName(option: AwemeOption): string {
  return option.awemeName ? `${option.awemeName}（${option.awemeId}）` : option.awemeId
}

interface LastProductSelection {
  productPlatformId: string
  productId: string
}

const BATCH_AD_LAST_PRODUCT_SELECTION_KEY = 'ocean-engine-batch-ad-last-product-selection'
const BATCH_AD_LAST_PROJECT_BUDGET_KEY = 'ocean-engine-batch-ad-last-project-budget'

function loadBatchAdLastProjectBudget(): string {
  try {
    return String(localStorage.getItem(BATCH_AD_LAST_PROJECT_BUDGET_KEY) ?? '').trim()
  } catch {
    return ''
  }
}

function saveBatchAdLastProjectBudget(value: string): void {
  const budget = value.trim()
  if (!budget) return
  try {
    localStorage.setItem(BATCH_AD_LAST_PROJECT_BUDGET_KEY, budget)
  } catch {
    return
  }
}

function loadBatchAdLastProductSelection(): LastProductSelection {
  try {
    const raw = localStorage.getItem(BATCH_AD_LAST_PRODUCT_SELECTION_KEY)
    if (!raw) return { productPlatformId: '', productId: '' }
    const parsed = JSON.parse(raw) as Partial<LastProductSelection>
    return {
      productPlatformId: String(parsed.productPlatformId ?? '').trim(),
      productId: String(parsed.productId ?? '').trim()
    }
  } catch {
    return { productPlatformId: '', productId: '' }
  }
}

function saveBatchAdLastProductSelection(selection: LastProductSelection): void {
  const productPlatformId = selection.productPlatformId.trim()
  const productId = selection.productId.trim()
  if (!productPlatformId && !productId) return
  try {
    localStorage.setItem(
      BATCH_AD_LAST_PRODUCT_SELECTION_KEY,
      JSON.stringify({ productPlatformId, productId })
    )
  } catch {
    return
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('产品主图预览生成失败'))
    reader.readAsDataURL(file)
  })
}

export interface BatchAdCreateWorkbenchProps {
  /** 嵌入 Hub 弹层时精简顶栏 */
  embedMode?: boolean
  /** 手动入队成功回调（由列表页关闭弹层并刷新） */
  onManualJobEnqueued?: (jobId: number) => void
  /** 从任务详情载入的快照；提交时使用该请求体（可改组织与广告主） */
  reuseBatchRequest?: OceanEngineBatchCreateAdsRequest | null
  reuseSourceJobId?: number | null
  resubmitTargetJobId?: number | null
  /** 用户清除复用时通知 Hub 同步清空 */
  onReuseDraftClear?: () => void
}

function pickString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function pickScalarString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function normalizeProductInfoTitle(value: unknown): string {
  const title = pickString(value)
  return title ? title.slice(0, 20) : ''
}

function firstPromotionFromBatchRequest(
  req: OceanEngineBatchCreateAdsRequest
): Record<string, unknown> | null {
  const byAdvertiser = req.promotions_by_advertiser
  if (byAdvertiser) {
    for (const list of Object.values(byAdvertiser)) {
      if (Array.isArray(list) && list[0]) return list[0]
    }
  }
  return req.promotions[0] ?? null
}

function inferDramaNameFromBatchRequest(req: OceanEngineBatchCreateAdsRequest): string {
  const snap = pickString(req.draft_drama_name)
  if (snap) return snap
  const promotion = firstPromotionFromBatchRequest(req) as Record<string, any> | null
  const title = promotion?.promotion_materials?.product_info?.titles?.[0]
  if (typeof title === 'string' && title.trim()) return title.trim()
  const projectName = pickString(req.project?.name)
  return projectName
}

function inferVideoDistributionModeFromBatchRequest(
  req: OceanEngineBatchCreateAdsRequest
): VideoMaterialDistributionMode {
  if (req.draft_video_distribution_mode === 'average') return 'average'
  if (req.draft_video_distribution_mode === 'full') return 'full'
  return req.promotions_by_advertiser ? 'average' : 'full'
}

function inferVideoSnapshotsFromBatchRequest(
  req: OceanEngineBatchCreateAdsRequest
): VideoMaterialItem[] {
  if (Array.isArray(req.draft_committed_videos) && req.draft_committed_videos.length > 0) {
    return req.draft_committed_videos
  }
  const promotions = req.promotions_by_advertiser
    ? Object.values(req.promotions_by_advertiser).flat()
    : req.promotions
  const seen = new Set<string>()
  const videos: VideoMaterialItem[] = []
  for (const promotion of promotions) {
    const list = (promotion as Record<string, any>)?.promotion_materials?.video_material_list
    if (!Array.isArray(list)) continue
    for (const item of list) {
      const id = pickString(item?.video_id)
      if (!id || seen.has(id)) continue
      seen.add(id)
      videos.push({
        id,
        filename: id,
        material_id: 0,
        poster_url: '',
        url: '',
        duration: 0,
        width: String(item?.image_mode ?? '').includes('VERTICAL') ? 720 : 1280,
        height: String(item?.image_mode ?? '').includes('VERTICAL') ? 1280 : 720,
        create_time: '',
        format: '',
        size: 0,
        video_cover_id: pickString(item?.video_cover_id)
      })
    }
  }
  return videos
}

function inferMaterialsPerUnitFromBatchRequest(
  req: OceanEngineBatchCreateAdsRequest
): number | null {
  const draft = req.draft_materials_per_unit
  if (draft != null && draft >= 1 && draft <= 30) {
    return draft
  }
  /** 旧任务无快照字段时，从各单元视频数反推（可能小于用户当时设置值） */
  const promotions = req.promotions_by_advertiser
    ? Object.values(req.promotions_by_advertiser).flat()
    : req.promotions
  const maxCount = promotions.reduce((currentMax, promotion) => {
    const list = (promotion as Record<string, any>)?.promotion_materials?.video_material_list
    return Array.isArray(list) ? Math.max(currentMax, list.length) : currentMax
  }, 0)
  if (maxCount < 1) return null
  return Math.min(maxCount, 30)
}

function inferAverageTargetPromotionCountFromBatchRequest(
  req: OceanEngineBatchCreateAdsRequest
): string {
  const draft = req.draft_average_target_promotion_count_per_advertiser
  return draft != null && draft >= 1 ? String(draft) : ''
}

function parseAverageTargetPromotionCount(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const value = Number.parseInt(trimmed, 10)
  return value >= 1 ? value : null
}

function inferCustomTitleFieldsFromBatchRequest(req: OceanEngineBatchCreateAdsRequest): {
  enabled: boolean
  titlesText: string
  mode: BatchAdCustomTitleMode
} {
  if (req.draft_custom_title_enabled != null) {
    return {
      enabled: Boolean(req.draft_custom_title_enabled),
      titlesText: req.draft_custom_titles_text ?? '',
      mode: req.draft_custom_title_mode === 'uniform' ? 'uniform' : 'random'
    }
  }
  return { enabled: false, titlesText: '', mode: 'random' }
}

function inferReuseEditableFields(req: OceanEngineBatchCreateAdsRequest): {
  projectName: string
  projectBudget: string
  projectCpaBid: string
  productPlatformId: string
  productId: string
  roiGoal: string
  materialsPerUnit: number | null
  averageTargetPromotionCountText: string
  dramaName: string
  playletUrl: string
  productMainImageId: string
  productSellingPoints: string
  callToActionButtons: string
  promotionName: string
  source: string
  awemeId: string
  customTitleEnabled: boolean
  customTitlesText: string
  customTitleMode: BatchAdCustomTitleMode
} {
  const promotion = firstPromotionFromBatchRequest(req) as Record<string, any> | null
  const materials = promotion?.promotion_materials
  const productInfo = materials?.product_info
  const project = req.project as Record<string, any>
  const customTitleFields = inferCustomTitleFieldsFromBatchRequest(req)
  return {
    projectName: pickString(project?.name),
    projectBudget: pickScalarString(project?.delivery_setting?.budget),
    projectCpaBid: pickScalarString(project?.delivery_setting?.cpa_bid),
    productPlatformId: pickString(project?.related_product?.product_platform_id),
    productId: pickString(project?.related_product?.product_id),
    roiGoal: pickScalarString(project?.delivery_setting?.roi_goal),
    materialsPerUnit: inferMaterialsPerUnitFromBatchRequest(req),
    averageTargetPromotionCountText: inferAverageTargetPromotionCountFromBatchRequest(req),
    dramaName: inferDramaNameFromBatchRequest(req),
    playletUrl: pickString(materials?.playlet_series_url_list?.[0]),
    productMainImageId: pickString(productInfo?.image_ids?.[0]),
    productSellingPoints: stringifyPipeList(productInfo?.selling_points),
    callToActionButtons: stringifyPipeList(materials?.call_to_action_buttons),
    promotionName: pickString(promotion?.name),
    source: pickString(promotion?.source),
    awemeId: pickString(promotion?.native_setting?.aweme_id),
    customTitleEnabled: customTitleFields.enabled,
    customTitlesText: customTitleFields.titlesText,
    customTitleMode: customTitleFields.mode
  }
}

export const BatchAdCreateWorkbench: React.FC<BatchAdCreateWorkbenchProps> = ({
  embedMode = false,
  onManualJobEnqueued,
  reuseBatchRequest = null,
  reuseSourceJobId = null,
  resubmitTargetJobId = null,
  onReuseDraftClear
}) => {
  const [tokens, setTokens] = useState<OceanEngineOAuthToken[]>([])
  const [loadingTokens, setLoadingTokens] = useState(true)
  const [templateOptions, setTemplateOptions] = useState<OceanEngineAdTemplateSummary[]>([])
  const [customTemplateOptions, setCustomTemplateOptions] = useState<OceanEngineCustomAdTemplate[]>([])
  const [selectedCustomTemplate, setSelectedCustomTemplate] =
    useState<OceanEngineCustomAdTemplate | null>(null)
  const [customTemplateSaving, setCustomTemplateSaving] = useState(false)
  const [customTemplateValidating, setCustomTemplateValidating] = useState(false)
  const [customTemplateValidationErrors, setCustomTemplateValidationErrors] = useState<
    OceanEngineTemplateValidationError[]
  >([])
  const [selectedTemplateDetail, setSelectedTemplateDetail] =
    useState<OceanEngineAdTemplateDetail | null>(null)
  const [customBaseTemplateCode, setCustomBaseTemplateCode] = useState('')
  const [customBaseTemplateDetail, setCustomBaseTemplateDetail] =
    useState<OceanEngineAdTemplateDetail | null>(null)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [cookieConfigs, setCookieConfigs] = useState<Config[]>([])
  const [selectedCookieConfigId, setSelectedCookieConfigId] = useState<number | null>(null)
  const [projectMode, setProjectMode] = useState<ProjectMode>('new')
  const [webProjectPayloadText, setWebProjectPayloadText] = useState('')
  const [webProjectName, setWebProjectName] = useState('')
  const [webProjectDynamicParamConfig, setWebProjectDynamicParamConfig] = useState<
    OceanEngineWebProjectDynamicParamConfigItem[]
  >([])
  const [webProjectDynamicParams, setWebProjectDynamicParams] = useState<WebProjectDynamicParamFormItem[]>([])
  const [webProjectDynamicParamPasteText, setWebProjectDynamicParamPasteText] = useState('')
  const [webProjectDynamicParamPasteColumnByKey, setWebProjectDynamicParamPasteColumnByKey] = useState<
    Record<string, number>
  >({})
  const [webProjectCreateLoading, setWebProjectCreateLoading] = useState(false)
  const [webProjectBatchCreateLoading, setWebProjectBatchCreateLoading] = useState(false)
  const [fetchedProjects, setFetchedProjects] = useState<PromotionProjectSearchItem[]>([])
  const [selectedProjectIdByAccount, setSelectedProjectIdByAccount] = useState<Map<string, string>>(
    () => new Map()
  )
  const [searchingProjects, setSearchingProjects] = useState(false)
  const [existingProjectKeyword, setExistingProjectKeyword] = useState('')
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<SelectedTemplateCode>(null)
  const selectedTemplateCodeRef = useRef(selectedTemplateCode)
  const [inputMode, setInputMode] = useState<InputMode>(() => (embedMode ? 'manual' : 'excel'))
  const [activeManualStep, setActiveManualStep] = useState<ManualStepKey>('setup')
  const [latestResults, setLatestResults] = useState<OceanEngineBatchCreateAdsAccountResult[]>([])
  /** 手动提交入队成功后的结果屏（在 Hub 弹窗内原地展示，不立即关闭） */
  const [successJobId, setSuccessJobId] = useState<number | null>(null)
  /** 提交时快照下的账户数 / 预计单元数，用于结果屏摘要 */
  const [successJobMeta, setSuccessJobMeta] = useState<{
    advertiserCount: number
    promotionCount: number
    templateLabel: string
    scheduledAt?: string | null
  } | null>(null)
  const [accountIdsText, setAccountIdsText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [executeMode, setExecuteMode] = useState<'immediate' | 'scheduled'>('immediate')
  const [scheduledStartTime, setScheduledStartTime] = useState(defaultScheduledDatetimeLocal)
  const batchJobPollAbortRef = useRef<AbortController | null>(null)
  const [dramaName, setDramaName] = useState('')
  const [promoSource, setPromoSource] = useState('')
  const [promoAwemeId, setPromoAwemeId] = useState('63279742087')
  const [promoPlayletUrl, setPromoPlayletUrl] = useState('')
  const [roiCoeff, setRoiCoeff] = useState('0.9')
  const [projCpaBid, setProjCpaBid] = useState('20')
  const lastProductSelectionRef = useRef<LastProductSelection>(loadBatchAdLastProductSelection())
  const [projName, setProjName] = useState('')
  const [projBudget, setProjBudget] = useState(() => loadBatchAdLastProjectBudget() || '300')
  const [projProductPlatformId, setProjProductPlatformId] = useState(
    () => lastProductSelectionRef.current.productPlatformId
  )
  const [projProductId, setProjProductId] = useState(
    () => lastProductSelectionRef.current.productId
  )
  const [productSearching, setProductSearching] = useState(false)
  const [promoName, setPromoName] = useState('')
  const [awemeOptions, setAwemeOptions] = useState<AwemeOption[]>([])
  const [awemeLoading, setAwemeLoading] = useState(false)
  const [awemeSourceAdvertiserId, setAwemeSourceAdvertiserId] = useState('')
  const [materialsPerUnit, setMaterialsPerUnit] = useState(10)
  const [averageTargetPromotionCountText, setAverageTargetPromotionCountText] = useState('')
  const [dramaPool, setDramaPool] = useState<string[]>([])
  const [materialKeywords, setMaterialKeywords] = useState('')
  const [videoDistributionMode, setVideoDistributionMode] =
    useState<VideoMaterialDistributionMode>('full')
  const [showVideoSelector, setShowVideoSelector] = useState(false)
  const [videoFetchMode, setVideoFetchMode] = useState<VideoMaterialFetchMode>('cookie')
  const [videoAdvertiserId, setVideoAdvertiserId] = useState('')
  const [videoStartTime, setVideoStartTime] = useState('')
  const [videoEndTime, setVideoEndTime] = useState('')
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoList, setVideoList] = useState<VideoMaterialItem[]>([])
  const [videoPageInfo, setVideoPageInfo] = useState<VideoMaterialPageInfo | null>(null)
  const [videoPage, setVideoPage] = useState(1)
  const [videoPageSize, setVideoPageSize] = useState<VideoMaterialPageSize>(100)
  const [committedVideos, setCommittedVideos] = useState<VideoMaterialItem[]>([])
  const [productMainImageId, setProductMainImageId] = useState('')
  const [productMainImagePreviewUrl, setProductMainImagePreviewUrl] = useState('')
  const [productMainImageUploading, setProductMainImageUploading] = useState(false)
  const [productSellingPoints, setProductSellingPoints] = useState('')
  const [callToActionButtons, setCallToActionButtons] = useState('')
  const [customTitleEnabled, setCustomTitleEnabled] = useState(false)
  const [customTitlesText, setCustomTitlesText] = useState('')
  const [customTitleMode, setCustomTitleMode] = useState<BatchAdCustomTitleMode>('random')
  const [productPlatformLibraries, setProductPlatformLibraries] = useState<DpaProductLibraryItem[]>(
    []
  )
  const [productPlatformLibrariesLoading, setProductPlatformLibrariesLoading] = useState(false)
  const [showMissingProductPlatformOption, setShowMissingProductPlatformOption] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copiedTaskDramaRef = useRef('')
  const autoVideoFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoVideoFetchSeqRef = useRef(0)
  const initializedCustomBaseRef = useRef('')
  const lastAutoCustomUnitNameRef = useRef('')
  const resetNameToPlaceholderOnTemplateDetailRef = useRef(false)
  const skipEmbedTemplateDetailApplyRef = useRef(false)
  const embedDraftLoadedRef = useRef(false)
  const embedDraftReadyForPersistRef = useRef(false)
  const persistEmbedDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const allowEmbedDraftPersistRef = useRef(false)
  const [customTemplateForm, setCustomTemplateForm] = useState<CustomTemplateFormState>(() =>
    createCustomTemplateFormState(null)
  )
  /** 非 null 时手动提交走历史快照，模板表单仅作参考 */
  const [reusedSubmitBody, setReusedSubmitBody] = useState<OceanEngineBatchCreateAdsRequest | null>(
    null
  )
  /** 递增后强制重新跑模板详情 effect（解决重置后仍为 puju 时不刷新表单项的问题） */
  const [workbenchResetSeq, setWorkbenchResetSeq] = useState(0)

  const selectedOrgIds = useMemo(
    () => new Set(selectedOrgId ? [selectedOrgId] : []),
    [selectedOrgId]
  )

  useEffect(() => {
    selectedTemplateCodeRef.current = selectedTemplateCode
  }, [selectedTemplateCode])

  const manualAdvertiserIds = useMemo(() => parseAccountLines(accountIdsText), [accountIdsText])

  const selectedProjectIdSig = useMemo(
    () =>
      JSON.stringify(
        [...selectedProjectIdByAccount.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      ),
    [selectedProjectIdByAccount]
  )

  const updateProjProductPlatformId = (value: string): void => {
    const nextSelection = {
      productPlatformId: value.trim(),
      productId: projProductId.trim()
    }
    lastProductSelectionRef.current = nextSelection
    setProjProductPlatformId(value)
    saveBatchAdLastProductSelection(nextSelection)
  }

  const updateProjProductId = (value: string): void => {
    const nextSelection = {
      productPlatformId: projProductPlatformId.trim(),
      productId: value.trim()
    }
    lastProductSelectionRef.current = nextSelection
    setProjProductId(value)
    saveBatchAdLastProductSelection(nextSelection)
  }

  const updateProjBudget = (value: string): void => {
    setProjBudget(value)
    saveBatchAdLastProjectBudget(value)
  }

  const persistCustomProductSelection = (form: CustomTemplateFormState): void => {
    const productPlatformId = form.project.productPlatformId.trim()
    const productId = form.project.productId.trim()
    if (!productPlatformId && !productId) return
    const nextSelection = { productPlatformId, productId }
    lastProductSelectionRef.current = nextSelection
    saveBatchAdLastProductSelection(nextSelection)
  }

  const handleCustomTemplateFormChange = (next: CustomTemplateFormState): void => {
    setCustomTemplateForm(next)
    persistCustomProductSelection(next)
    saveBatchAdLastProjectBudget(next.project.budget)
  }

  const resetCopiedTaskNamesToInitialFormat = (nextDramaName: string): void => {
    const dramaTrim = nextDramaName.trim()
    if (!reuseBatchRequest || !dramaTrim || dramaTrim === copiedTaskDramaRef.current) return

    const templateDisplay = getBatchAdTemplateDisplayLabel(
      selectedTemplateCode,
      customBaseTemplateCode,
      templateOptions
    )
    const source =
      selectedTemplateCode === CUSTOM_TEMPLATE_CODE
        ? customTemplateForm.unit.source
        : promoSource

    setProjName(BATCH_AD_NAME_PLACEHOLDER_TEMPLATE)
    setPromoName(BATCH_AD_NAME_PLACEHOLDER_TEMPLATE)
    setCustomTemplateForm((prev) => ({
      ...prev,
      project: {
        ...prev.project,
        name: BATCH_AD_NAME_PLACEHOLDER_TEMPLATE
      },
      unit: {
        ...prev.unit,
        name: BATCH_AD_NAME_PLACEHOLDER_TEMPLATE
      }
    }))
    setReusedSubmitBody((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      const projectName = buildBatchAdDefaultName(
        source,
        templateDisplay,
        dramaTrim,
        randBatchAdNameSuffix4()
      )
      const unitName = buildBatchAdDefaultName(
        source,
        templateDisplay,
        dramaTrim,
        randBatchAdNameSuffix4()
      )

      if (next.project && Object.keys(next.project).length > 0) {
        next.project = { ...next.project, name: projectName }
      }
      next.promotions = next.promotions.map((promotion) => ({ ...promotion, name: unitName }))
      if (next.promotions_by_advertiser) {
        next.promotions_by_advertiser = Object.fromEntries(
          Object.entries(next.promotions_by_advertiser).map(([advertiserId, promotions]) => [
            advertiserId,
            promotions.map((promotion) => ({ ...promotion, name: unitName }))
          ])
        )
      }
      return next
    })
  }

  const handleDramaNameChange = (nextDramaName: string): void => {
    if (nextDramaName !== dramaName) {
      setPromoPlayletUrl('')
    }
    setDramaName(nextDramaName)
    resetCopiedTaskNamesToInitialFormat(nextDramaName)
  }

  const handleCustomTemplateDramaNameChange = (next: CustomTemplateFormState): void => {
    const shouldClearPlayletUrl = next.unit.dramaName !== customTemplateForm.unit.dramaName
    const nextForm = shouldClearPlayletUrl
      ? {
          ...next,
          unit: {
            ...next.unit,
            playletUrl: ''
          }
        }
      : next
    handleCustomTemplateFormChange(nextForm)
    resetCopiedTaskNamesToInitialFormat(nextForm.unit.dramaName)
  }

  const applyReuseEditableFields = (req: OceanEngineBatchCreateAdsRequest): void => {
    const fields = inferReuseEditableFields(req)
    copiedTaskDramaRef.current = fields.dramaName.trim()
    setDramaName(fields.dramaName)
    setPromoPlayletUrl(fields.playletUrl)
    setProductMainImageId(fields.productMainImageId)
    setProductSellingPoints(fields.productSellingPoints)
    setCallToActionButtons(fields.callToActionButtons)
    if (fields.projectName) setProjName(fields.projectName)
    if (fields.projectBudget) updateProjBudget(fields.projectBudget)
    if (fields.projectCpaBid) setProjCpaBid(fields.projectCpaBid)
    if (fields.productPlatformId) setProjProductPlatformId(fields.productPlatformId)
    if (fields.productId) setProjProductId(fields.productId)
    if (fields.roiGoal) setRoiCoeff(fields.roiGoal)
    if (fields.materialsPerUnit != null) setMaterialsPerUnit(fields.materialsPerUnit)
    setAverageTargetPromotionCountText(fields.averageTargetPromotionCountText)
    if (fields.promotionName) setPromoName(fields.promotionName)
    if (fields.source) setPromoSource(fields.source)
    if (fields.awemeId) setPromoAwemeId(fields.awemeId)
    setCustomTitleEnabled(fields.customTitleEnabled)
    setCustomTitlesText(fields.customTitlesText)
    setCustomTitleMode(fields.customTitleMode)
    setProductMainImagePreviewUrl('')
    setCustomTemplateForm((prev) => ({
      project: {
        ...prev.project,
        name: fields.projectName || prev.project.name,
        budget: fields.projectBudget || prev.project.budget,
        productPlatformId: fields.productPlatformId || prev.project.productPlatformId,
        productId: fields.productId || prev.project.productId,
        roiGoal: fields.roiGoal || prev.project.roiGoal
      },
      unit: {
        ...prev.unit,
        name: fields.promotionName || prev.unit.name,
        source: fields.source || prev.unit.source,
        awemeId: fields.awemeId || prev.unit.awemeId,
        playletUrl: fields.playletUrl || prev.unit.playletUrl,
        dramaName: fields.dramaName || prev.unit.dramaName,
        materialsPerUnit:
          fields.materialsPerUnit != null
            ? String(fields.materialsPerUnit)
            : prev.unit.materialsPerUnit
      }
    }))
  }

  const clearReusedSubmit = (): void => {
    if (reusedSubmitBody) {
      applyReuseEditableFields(reusedSubmitBody)
    }
    if (autoVideoFetchTimerRef.current) {
      clearTimeout(autoVideoFetchTimerRef.current)
      autoVideoFetchTimerRef.current = null
    }
    autoVideoFetchSeqRef.current += 1
    setReusedSubmitBody(null)
    onReuseDraftClear?.()
  }

  useEffect(() => {
    if (!reuseBatchRequest) {
      setReusedSubmitBody(null)
      return
    }
    setReusedSubmitBody(null)
    setSelectedOrgId(reuseBatchRequest.org_advertiser_ids[0] ?? null)
    setSelectedCookieConfigId(reuseBatchRequest.selected_cookie_config_id ?? null)
    if (reuseBatchRequest.draft_selected_template_code) {
      setSelectedTemplateCode(reuseBatchRequest.draft_selected_template_code)
    }
    if (reuseBatchRequest.draft_custom_base_template_code) {
      setCustomBaseTemplateCode(reuseBatchRequest.draft_custom_base_template_code)
    }
    const ap = reuseBatchRequest.advertiser_project_ids
    const projectMap =
      ap && typeof ap === 'object' && Object.keys(ap as Record<string, string>).length > 0
        ? new Map(Object.entries(ap as Record<string, string>))
        : new Map<string, string>()
    const restoredWebProjectPayloadText = stringifyWebProjectPayload(
      reuseBatchRequest.draft_web_project_payload
    )
    const restoredWebProjectPayloadName = pickString(reuseBatchRequest.draft_web_project_payload?.name)
    if (reuseBatchRequest.draft_project_mode === 'web' && restoredWebProjectPayloadText) {
      setProjectMode('web')
      setWebProjectPayloadText(restoredWebProjectPayloadText)
      setWebProjectName(
        pickString(reuseBatchRequest.draft_web_project_name) || restoredWebProjectPayloadName
      )
      setSelectedProjectIdByAccount(projectMap)
    } else if (projectMap.size > 0) {
      setProjectMode('existing')
      setWebProjectPayloadText('')
      setWebProjectName('')
      setSelectedProjectIdByAccount(projectMap)
    } else {
      setProjectMode('new')
      setWebProjectPayloadText('')
      setWebProjectName('')
      setSelectedProjectIdByAccount(new Map())
    }
    setAccountIdsText(reuseBatchRequest.advertiser_ids.join('\n'))
    applyReuseEditableFields(reuseBatchRequest)
    setVideoAdvertiserId(pickString(reuseBatchRequest.draft_video_advertiser_id))
    setVideoDistributionMode(inferVideoDistributionModeFromBatchRequest(reuseBatchRequest))
    setCommittedVideos(inferVideoSnapshotsFromBatchRequest(reuseBatchRequest))
    setInputMode('manual')
    setActiveManualStep('setup')
    toast.success(
      resubmitTargetJobId != null
        ? `已载入暂停任务 #${resubmitTargetJobId}，编辑后将在原任务上重新提交`
        : reuseSourceJobId != null
          ? `已复制任务 #${reuseSourceJobId} 到自定义编辑模式，可调整后提交`
          : '已复制历史任务配置到自定义编辑模式，可调整后提交'
    )
  }, [reuseBatchRequest, reuseSourceJobId, resubmitTargetJobId])

  useEffect(() => {
    allowEmbedDraftPersistRef.current = embedMode && !reuseBatchRequest && !reusedSubmitBody
  }, [embedMode, reuseBatchRequest, reusedSubmitBody])

  useEffect(() => {
    if (!embedMode) return
    if (reuseBatchRequest) {
      embedDraftLoadedRef.current = true
      embedDraftReadyForPersistRef.current = true
      return
    }
    if (embedDraftLoadedRef.current) return
    embedDraftLoadedRef.current = true
    const draft = loadBatchAdEmbedDraft()
    if (!draft) {
      embedDraftReadyForPersistRef.current = true
      return
    }
    skipEmbedTemplateDetailApplyRef.current = true
    initializedCustomBaseRef.current = draft.customBaseTemplateCode
    setSelectedOrgId(draft.selectedOrgId)
    setSelectedCookieConfigId(draft.selectedCookieConfigId)
    setProjectMode(draft.projectMode)
    setWebProjectPayloadText(draft.webProjectPayloadText ?? '')
    setWebProjectName(draft.webProjectName ?? '')
    setWebProjectDynamicParams(draft.webProjectDynamicParams ?? [])
    setSelectedProjectIdByAccount(new Map(draft.selectedProjectIdByAccount))
    setSelectedTemplateCode(draft.selectedTemplateCode)
    setCustomBaseTemplateCode(draft.customBaseTemplateCode)
    setActiveManualStep(draft.activeManualStep)
    if (draft.inputMode) setInputMode(draft.inputMode)
    setAccountIdsText(draft.accountIdsText)
    setDramaName(draft.dramaName)
    setPromoAwemeId(draft.promoAwemeId)
    setPromoSource(draft.promoSource ?? '')
    setPromoPlayletUrl(draft.promoPlayletUrl)
    setRoiCoeff(draft.roiCoeff)
    setProjCpaBid(draft.projCpaBid ?? '20')
    setProjName(draft.projName)
    setProjBudget(draft.projBudget)
    setProjProductPlatformId(draft.projProductPlatformId)
    setProjProductId(draft.projProductId)
    setPromoName(draft.promoName)
    setMaterialsPerUnit(draft.materialsPerUnit)
    setAverageTargetPromotionCountText(draft.averageTargetPromotionCountText ?? '')
    setMaterialKeywords(draft.materialKeywords)
    setVideoDistributionMode(draft.videoDistributionMode ?? 'full')
    setVideoFetchMode(draft.videoFetchMode)
    setVideoAdvertiserId(draft.videoAdvertiserId)
    setVideoStartTime(draft.videoStartTime)
    setVideoEndTime(draft.videoEndTime)
    setCommittedVideos(draft.committedVideos)
    setProductMainImageId(draft.productMainImageId)
    setProductMainImagePreviewUrl(draft.productMainImagePreviewUrl ?? '')
    setProductSellingPoints(draft.productSellingPoints ?? '')
    setCallToActionButtons(draft.callToActionButtons ?? '')
    setCustomTitleEnabled(draft.customTitleEnabled ?? false)
    setCustomTitlesText(draft.customTitlesText ?? '')
    setCustomTitleMode(draft.customTitleMode ?? 'random')
    setCustomTemplateForm(draft.customTemplateForm)
    embedDraftReadyForPersistRef.current = true
  }, [embedMode, reuseBatchRequest])

  useEffect(() => {
    if (!allowEmbedDraftPersistRef.current || !embedDraftReadyForPersistRef.current) {
      return undefined
    }
    const draft: BatchAdEmbedDraftV1 = {
      v: 2,
      selectedOrgId,
      selectedCookieConfigId,
      projectMode,
      webProjectPayloadText,
      webProjectName,
      webProjectDynamicParams,
      selectedProjectIdByAccount: [...selectedProjectIdByAccount.entries()] as [string, string][],
      selectedTemplateCode,
      customBaseTemplateCode,
      activeManualStep,
      inputMode,
      accountIdsText,
      dramaName,
      promoAwemeId,
      promoSource,
      promoPlayletUrl,
      roiCoeff,
      projCpaBid,
      projName,
      projBudget,
      projProductPlatformId,
      projProductId,
      promoName,
      materialsPerUnit,
      averageTargetPromotionCountText,
      materialKeywords,
      videoDistributionMode,
      videoFetchMode,
      videoAdvertiserId,
      videoStartTime,
      videoEndTime,
      committedVideos,
      productMainImageId,
      productMainImagePreviewUrl,
      productSellingPoints,
      callToActionButtons,
      customTitleEnabled,
      customTitlesText,
      customTitleMode,
      customTemplateForm
    }
    if (persistEmbedDraftTimerRef.current) clearTimeout(persistEmbedDraftTimerRef.current)
    persistEmbedDraftTimerRef.current = setTimeout(() => {
      saveBatchAdEmbedDraft(draft)
    }, 450)
    return () => {
      if (persistEmbedDraftTimerRef.current) {
        clearTimeout(persistEmbedDraftTimerRef.current)
        persistEmbedDraftTimerRef.current = null
      }
    }
  }, [
    accountIdsText,
    activeManualStep,
    averageTargetPromotionCountText,
    committedVideos,
    customBaseTemplateCode,
    customTemplateForm,
    dramaName,
    embedMode,
    inputMode,
    materialKeywords,
    materialsPerUnit,
    videoDistributionMode,
    productMainImageId,
    productMainImagePreviewUrl,
    productSellingPoints,
    callToActionButtons,
    customTitleEnabled,
    customTitleMode,
    customTitlesText,
    projCpaBid,
    projBudget,
    projName,
    projProductId,
    projProductPlatformId,
    projectMode,
    promoAwemeId,
    promoSource,
    promoName,
    promoPlayletUrl,
    roiCoeff,
    selectedCookieConfigId,
    selectedOrgId,
    selectedProjectIdSig,
    selectedTemplateCode,
    videoAdvertiserId,
    videoEndTime,
    videoFetchMode,
    videoStartTime,
    webProjectDynamicParams,
    webProjectName,
    webProjectPayloadText
  ])

  useEffect(() => {
    const loadWebProjectDynamicParamConfig = async (): Promise<void> => {
      try {
        const res = await oceanEngineBatchAdService.getWebProjectDynamicParamConfig()
        setWebProjectDynamicParamConfig(res.items ?? [])
      } catch {
        setWebProjectDynamicParamConfig([])
      }
    }
    void loadWebProjectDynamicParamConfig()
  }, [])

  useEffect(() => {
    const loadTokens = async (): Promise<void> => {
      setLoadingTokens(true)
      try {
        const res = await oceanEngineOAuthService.getTokens(true)
        setTokens(res.items ?? [])
      } catch {
        toast.error('加载已授权组织账户失败')
      } finally {
        setLoadingTokens(false)
      }
    }
    void loadTokens()
  }, [])

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const list = await configService.getConfigsBySource(1)
        setCookieConfigs(list ?? [])
      } catch {
        toast.error('加载 Cookie 账户配置失败')
      }
    }
    void load()
  }, [])

  useEffect(() => {
    const advertiserId = manualAdvertiserIds[0]?.trim()

    if (!selectedOrgId || !advertiserId) {
      setProductPlatformLibraries([])
      setShowMissingProductPlatformOption(false)
      setProductPlatformLibrariesLoading(false)
      return undefined
    }
    let cancelled = false
    setProductPlatformLibraries([])
    setShowMissingProductPlatformOption(false)
    setProductPlatformLibrariesLoading(true)
    dpaProductService
      .listProductLibraries({
        org_advertiser_id: selectedOrgId,
        selected_cookie_id: selectedCookieConfigId ?? undefined,
        advertiser_id: advertiserId
      })
      .then((res) => {
        if (cancelled) return
        if (res.code === 0 && res.data?.list?.length) {
          const libs = res.data.list
          const firstProductPlatformId = libs[0]?.product_platform_id
          const productPlatformIds = new Set(libs.map((item) => item.product_platform_id))
          setProductPlatformLibraries(libs)
          setShowMissingProductPlatformOption(false)
          if (firstProductPlatformId) {
            setProjProductPlatformId((prev) => {
              const current = prev.trim()
              const remembered = lastProductSelectionRef.current.productPlatformId
              if (current && productPlatformIds.has(current)) return prev
              if (remembered && productPlatformIds.has(remembered)) return remembered
              return firstProductPlatformId
            })
            setCustomTemplateForm((prev) => {
              const currentProductPlatformId = prev.project.productPlatformId.trim()
              if (productPlatformIds.has(currentProductPlatformId)) return prev
              return {
                ...prev,
                project: {
                  ...prev.project,
                  productPlatformId: firstProductPlatformId
                }
              }
            })
          }
        } else {
          setProductPlatformLibraries([])
          setShowMissingProductPlatformOption(selectedCookieConfigId != null)
          if (res.code !== 0 && res.message) {
            toast.error(res.message)
          }
        }
      })
      .catch(() => {
        if (cancelled) return
        setProductPlatformLibraries([])
        setShowMissingProductPlatformOption(selectedCookieConfigId != null)
        toast.error('拉取商品库列表失败')
      })
      .finally(() => {
        if (!cancelled) setProductPlatformLibrariesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedOrgId, selectedCookieConfigId, manualAdvertiserIds])

  useEffect(() => {
    return () => {
      batchJobPollAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    oceanEngineBatchAdService
      .getAdTemplates()
      .then((res) => {
        const items = res.items ?? []
        setTemplateOptions(items)
        if (items.length > 0 && !customBaseTemplateCode) {
          setCustomBaseTemplateCode(items[0].meta.code)
        }
        if (
          selectedTemplateCode &&
          selectedTemplateCode !== CUSTOM_TEMPLATE_CODE &&
          !items.some((item) => item.meta.code === selectedTemplateCode)
        ) {
          setSelectedTemplateCode(null)
        }
      })
      .catch(() => {
        toast.error('加载广告模板列表失败')
      })
  }, [customBaseTemplateCode, selectedTemplateCode])

  const refreshCustomTemplateOptions = React.useCallback(async (): Promise<void> => {
    try {
      const res = await oceanEngineBatchAdService.getCustomAdTemplates()
      setCustomTemplateOptions(res.items ?? [])
    } catch {
      toast.error('加载我的自定义模板失败')
    }
  }, [])

  useEffect(() => {
    void refreshCustomTemplateOptions()
  }, [refreshCustomTemplateOptions])

  useEffect(() => {
    if (selectedTemplateCode === CUSTOM_TEMPLATE_CODE) return
    setSelectedCustomTemplate(null)
  }, [selectedTemplateCode])

  useEffect(() => {
    if (!selectedCustomTemplate) return
    setCustomTemplateForm((prev) =>
      createCustomTemplateFormState({
        meta: {
          code: `custom-${selectedCustomTemplate.id}`,
          label: selectedCustomTemplate.name,
          tags: selectedCustomTemplate.tags,
          enabled: selectedCustomTemplate.enabled
        },
        rules: {
          default_product_platform_id: String(
            selectedCustomTemplate.project_template?.related_product?.product_platform_id ?? ''
          ),
          supports_roi_goal: true,
          supports_cpa_bid: true,
          requires_product_id: Boolean(selectedCustomTemplate.project_template?.related_product),
          requires_playlet_url: true,
          requires_aweme_id: true,
          requires_video_materials: Boolean(
            selectedCustomTemplate.rules?.requires_video_materials ?? true
          ),
          materials_split_mode: String(
            selectedCustomTemplate.rules?.materials_split_mode ?? 'by_count'
          ),
          materials_per_unit_default: Number(
            selectedCustomTemplate.rules?.materials_per_unit_default ??
              (Number.parseInt(prev.unit.materialsPerUnit, 10) || 10)
          )
        },
        project_template: selectedCustomTemplate.project_template,
        unit_template: selectedCustomTemplate.promotion_template
      })
    )
    setCustomBaseTemplateDetail(null)
    setCustomTemplateValidationErrors([])
  }, [selectedCustomTemplate])

  useEffect(() => {
    if (!selectedCustomTemplate) return
    const stillExists = customTemplateOptions.some((item) => item.id === selectedCustomTemplate.id)
    if (!stillExists) setSelectedCustomTemplate(null)
  }, [customTemplateOptions, selectedCustomTemplate])

  useEffect(() => {
    setCustomTemplateValidationErrors([])
  }, [customTemplateForm])

  useEffect(() => {
    oceanEngineBatchAdService
      .getDramaTitles()
      .then((res: GetDramaTitlesResponse) => {
        if (res.code === 0 && res.data?.titles?.length) {
          setDramaPool(res.data.titles)
        }
      })
      .catch(() => {
        toast.error('加载标题池失败')
      })
  }, [])

  const refreshAwemeOptions = React.useCallback(async (): Promise<void> => {
    const orgId = selectedOrgId
    const advertiserId = manualAdvertiserIds[0]

    if (orgId == null || !advertiserId) {
      setAwemeOptions([])
      setAwemeSourceAdvertiserId('')
      setAwemeLoading(false)
      toast.error('请先选择 OAuth 授权组织并填写至少一个广告主账户')
      return
    }

    setAwemeLoading(true)
    setAwemeSourceAdvertiserId(advertiserId)

    try {
      const res = await awemeAuthService.getAwemeAuthList({
        org_advertiser_id: orgId,
        advertiser_id: advertiserId,
        page_size: 100
      })
      const options = dedupeAwemeOptions(res.data?.list ?? [])
      setAwemeOptions(options)
      const firstAwemeId = options[0]?.awemeId
      if (!firstAwemeId) return
      setPromoAwemeId((prev) => {
        const ids = new Set(options.map((o) => o.awemeId))
        const t = prev.trim()
        if (t && ids.has(t)) return prev
        return firstAwemeId
      })
      setCustomTemplateForm((prev) => {
        const ids = new Set(options.map((o) => o.awemeId))
        const cur = prev.unit.awemeId.trim()
        if (cur && ids.has(cur)) return prev
        return {
          ...prev,
          unit: {
            ...prev.unit,
            awemeId: firstAwemeId
          }
        }
      })
    } catch {
      setAwemeOptions([])
      toast.error('拉取抖音授权关系失败')
    } finally {
      setAwemeLoading(false)
    }
  }, [manualAdvertiserIds, selectedOrgId])

  useEffect(() => {
    const orgId = selectedOrgId
    const advertiserId = manualAdvertiserIds[0]

    if (orgId == null || !advertiserId) {
      setAwemeOptions([])
      setAwemeSourceAdvertiserId('')
      setAwemeLoading(false)
      return
    }

    void refreshAwemeOptions()
  }, [refreshAwemeOptions, manualAdvertiserIds, selectedOrgId])

  const effectiveDramaName =
    selectedTemplateCode === CUSTOM_TEMPLATE_CODE ? customTemplateForm.unit.dramaName : dramaName

  const selectedExistingProjectName = useMemo(() => {
    for (const accountId of manualAdvertiserIds) {
      const projectId = selectedProjectIdByAccount.get(accountId)
      if (!projectId) continue
      const project = fetchedProjects.find(
        (item) => item.advertiser_id === accountId && item.project_id === projectId
      )
      if (project?.project_name?.trim()) return project.project_name.trim()
    }
    return ''
  }, [fetchedProjects, manualAdvertiserIds, selectedProjectIdByAccount])

  const selectedExistingProjectLandingType = useMemo(() => {
    for (const accountId of manualAdvertiserIds) {
      const projectId = selectedProjectIdByAccount.get(accountId)
      if (!projectId) continue
      const project = fetchedProjects.find(
        (item) => item.advertiser_id === accountId && item.project_id === projectId
      )
      const landingType = project?.landing_type == null ? '' : String(project.landing_type).trim()
      if (landingType) return landingType
    }
    return null
  }, [fetchedProjects, manualAdvertiserIds, selectedProjectIdByAccount])

  const customTemplateDefaultUnitName = useMemo(() => buildCustomTemplateDefaultUnitName(), [])

  useEffect(() => {
    if (selectedTemplateCode !== CUSTOM_TEMPLATE_CODE) return
    const currentName = customTemplateForm.unit.name.trim()
    const lastAutoName = lastAutoCustomUnitNameRef.current
    if (lastAutoName && currentName && currentName !== lastAutoName) return
    if (currentName === customTemplateDefaultUnitName) return
    setCustomTemplateForm((prev) => ({
      ...prev,
      unit: {
        ...prev.unit,
        name: customTemplateDefaultUnitName
      }
    }))
    lastAutoCustomUnitNameRef.current = customTemplateDefaultUnitName
  }, [customTemplateDefaultUnitName, customTemplateForm.unit.name, selectedTemplateCode])

  const effectiveProductPlatformId =
    selectedTemplateCode === CUSTOM_TEMPLATE_CODE
      ? customTemplateForm.project.productPlatformId
      : projProductPlatformId

  useEffect(() => {
    const orgId = selectedOrgId
    const advertiserId = parseAccountLines(accountIdsText)[0]
    const drama = effectiveDramaName.trim()

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
      searchTimerRef.current = null
    }

    if (orgId == null || !advertiserId || !drama || !effectiveProductPlatformId.trim()) {
      setProductSearching(false)
      return undefined
    }

    searchTimerRef.current = setTimeout(() => {
      setProductSearching(true)
      dpaProductService
        .queryProducts({
          org_advertiser_id: orgId,
          advertiser_id: advertiserId,
          product_platform_id: effectiveProductPlatformId.trim(),
          product_name: drama
        })
        .then((res) => {
          const first = res.data?.list?.[0]
          if (res.code === 0 && first?.product_id != null) {
            const nextProductId = String(first.product_id)
            if (selectedTemplateCode === CUSTOM_TEMPLATE_CODE) {
              setCustomTemplateForm((prev) => {
                const next = {
                  ...prev,
                  project: {
                    ...prev.project,
                    productId: nextProductId
                  }
                }
                persistCustomProductSelection(next)
                return next
              })
            } else {
              updateProjProductId(nextProductId)
            }
          } else if (selectedTemplateCode !== CUSTOM_TEMPLATE_CODE) {
            setProjProductId((prev) => prev || '')
          }
        })
        .catch(() => {
          if (selectedTemplateCode !== CUSTOM_TEMPLATE_CODE) {
            setProjProductId((prev) => prev || '')
          }
        })
        .finally(() => {
          setProductSearching(false)
        })
    }, 600)

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
        searchTimerRef.current = null
      }
    }
  }, [
    accountIdsText,
    effectiveDramaName,
    effectiveProductPlatformId,
    selectedOrgId,
    selectedTemplateCode
  ])

  useEffect(() => {
    if (!selectedTemplateCode || selectedTemplateCode === CUSTOM_TEMPLATE_CODE) {
      setSelectedTemplateDetail(null)
      skipEmbedTemplateDetailApplyRef.current = false
      return
    }
    const templateCode = selectedTemplateCode
    setSelectedTemplateDetail(null)
    oceanEngineBatchAdService
      .getAdTemplateDetail(templateCode)
      .then((detail) => {
        if (detail.meta.code !== templateCode || selectedTemplateCodeRef.current !== templateCode) return
        setSelectedTemplateDetail(detail)
        if (reuseBatchRequest && !resetNameToPlaceholderOnTemplateDetailRef.current) {
          return
        }
        if (skipEmbedTemplateDetailApplyRef.current && embedMode) {
          skipEmbedTemplateDetailApplyRef.current = false
          return
        }
        const shouldUsePlaceholderTemplate =
          embedMode || resetNameToPlaceholderOnTemplateDetailRef.current
        if (shouldUsePlaceholderTemplate) {
          setProjName(BATCH_AD_NAME_PLACEHOLDER_TEMPLATE)
          setPromoName(BATCH_AD_NAME_PLACEHOLDER_TEMPLATE)
        } else {
          setProjName(String(detail.project_template.name ?? ''))
          setPromoName(String(detail.unit_template.name ?? ''))
        }
        resetNameToPlaceholderOnTemplateDetailRef.current = false
        setProjBudget((prev) => {
          if (reuseBatchRequest) return prev
          const rememberedProjectBudget = loadBatchAdLastProjectBudget()
          return (
            rememberedProjectBudget || String(detail.project_template?.delivery_setting?.budget ?? 300)
          )
        })
        setPromoSource(String(detail.unit_template?.source ?? '番茄'))
        const rememberedProductPlatformId = lastProductSelectionRef.current.productPlatformId
        const templateProductPlatformId = String(detail.rules.default_product_platform_id ?? '')
        setProjProductPlatformId(
          (prev) => prev.trim() || rememberedProductPlatformId || templateProductPlatformId
        )
        const templateAwemeId = String(
          detail.unit_template?.native_setting?.aweme_id ?? '63279742087'
        )
        setPromoAwemeId((prev) => prev.trim() || templateAwemeId)
        setMaterialsPerUnit(detail.rules.materials_per_unit_default ?? 10)
        const textDefaults = getPromotionMaterialTextDefaults(detail.unit_template)
        setProductSellingPoints(textDefaults.sellingPoints)
        setCallToActionButtons(textDefaults.callToActionButtons)
        setRoiCoeff(
          detail.rules.supports_roi_goal
            ? String(detail.project_template?.delivery_setting?.roi_goal ?? 0.9)
            : '0.9'
        )
        setProjCpaBid(String(detail.project_template?.delivery_setting?.cpa_bid ?? 20))
      })
      .catch(() => {
        toast.error('加载模板详情失败')
      })
    // dramaName 不入依赖：仅随模板加载用当时快照生成一次，避免输入剧名时重复请求详情接口
  }, [selectedTemplateCode, embedMode, reuseBatchRequest, workbenchResetSeq])

  useEffect(() => {
    if (!customBaseTemplateCode) return
    oceanEngineBatchAdService
      .getAdTemplateDetail(customBaseTemplateCode)
      .then((detail) => {
        setCustomBaseTemplateDetail(detail)
      })
      .catch(() => {
        toast.error('加载自定义模板基础详情失败')
      })
  }, [customBaseTemplateCode])

  useEffect(() => {
    if (!customBaseTemplateDetail) return
    if (initializedCustomBaseRef.current === customBaseTemplateCode) return
    const base = createCustomTemplateFormState(customBaseTemplateDetail)
    if (embedMode && !reuseBatchRequest) {
      base.project.name = BATCH_AD_NAME_PLACEHOLDER_TEMPLATE
      base.unit.name = BATCH_AD_NAME_PLACEHOLDER_TEMPLATE
    }
    const currentAwemeId =
      selectedTemplateCode === CUSTOM_TEMPLATE_CODE ? customTemplateForm.unit.awemeId : promoAwemeId
    if (currentAwemeId.trim()) {
      base.unit.awemeId = currentAwemeId.trim()
    }
    if (promoPlayletUrl.trim()) {
      base.unit.playletUrl = promoPlayletUrl.trim()
    }
    const currentDramaName =
      selectedTemplateCode === CUSTOM_TEMPLATE_CODE ? customTemplateForm.unit.dramaName : dramaName
    if (currentDramaName.trim()) {
      base.unit.dramaName = currentDramaName.trim()
    }
    if (promoName.trim()) {
      base.unit.name = promoName.trim()
    }
    const rememberedProductPlatformId = lastProductSelectionRef.current.productPlatformId
    const rememberedProductId = lastProductSelectionRef.current.productId
    if (rememberedProductPlatformId) {
      base.project.productPlatformId = rememberedProductPlatformId
    }
    if (rememberedProductId) {
      base.project.productId = rememberedProductId
    }
    const textDefaults = getPromotionMaterialTextDefaults(customBaseTemplateDetail.unit_template)
    setProductSellingPoints(textDefaults.sellingPoints)
    setCallToActionButtons(textDefaults.callToActionButtons)
    setCustomTemplateForm(base)
    initializedCustomBaseRef.current = customBaseTemplateCode
  }, [
    customBaseTemplateCode,
    customBaseTemplateDetail,
    customTemplateForm.unit.awemeId,
    embedMode,
    promoAwemeId,
    promoName,
    promoPlayletUrl,
    reuseBatchRequest,
    selectedTemplateCode
  ])

  const uniqueOrgTokens = useMemo(() => {
    const grouped = new Map<string, OceanEngineOAuthToken[]>()
    for (const token of tokens) {
      if (!token.is_active || token.is_refresh_token_expired) continue
      const existing = grouped.get(token.advertiser_id)
      if (existing) {
        existing.push(token)
      } else {
        grouped.set(token.advertiser_id, [token])
      }
    }

    return Array.from(grouped.values()).map((group) => {
      const primary = group[0]
      const appCodes = Array.from(new Set(group.map((item) => item.app_code))).sort()
      return {
        advertiser_id: primary.advertiser_id,
        advertiser_name: primary.advertiser_name || primary.advertiser_id,
        appCodes
      }
    })
  }, [tokens])

  const templateCards = useMemo(
    () => [
      ...templateOptions.map((item) => ({
        code: item.meta.code,
        label: item.meta.label,
        tags: item.meta.tags
      })),
      {
        code: CUSTOM_TEMPLATE_CODE,
        label: '自定义模板',
        tags: ['自由 JSON', '可保存', '严格校验']
      },
      ...customTemplateOptions.map((item) => ({
        code: `custom:${item.id}`,
        label: item.name,
        tags: item.tags.length > 0 ? ['我的模板', ...item.tags] : ['我的模板']
      }))
    ],
    [customTemplateOptions, templateOptions]
  )

  const selectedTemplate = useMemo(
    () => templateOptions.find((item) => item.meta.code === selectedTemplateCode) ?? null,
    [selectedTemplateCode, templateOptions]
  )

  const selectedTemplateDetailMatchesSelection =
    selectedTemplateCode !== CUSTOM_TEMPLATE_CODE &&
    selectedTemplateDetail?.meta?.code === selectedTemplateCode

  const handleTemplateSelect = (code: string): void => {
    const currentSelectorCode = selectedCustomTemplate
      ? `custom:${selectedCustomTemplate.id}`
      : selectedTemplateCode
    if (code === currentSelectorCode) return
    setProjName(BATCH_AD_NAME_PLACEHOLDER_TEMPLATE)
    setPromoName(BATCH_AD_NAME_PLACEHOLDER_TEMPLATE)
    resetNameToPlaceholderOnTemplateDetailRef.current = true
    if (code !== CUSTOM_TEMPLATE_CODE) {
      setSelectedCustomTemplate(null)
      setSelectedTemplateDetail(null)
    }
    if (code.startsWith('custom:')) {
      const templateId = Number.parseInt(code.slice('custom:'.length), 10)
      const customTemplate = customTemplateOptions.find((item) => item.id === templateId) ?? null
      if (!customTemplate) {
        toast.error('未找到该自定义模板，请刷新后重试')
        return
      }
      setSelectedCustomTemplate(customTemplate)
      if (projectMode === 'new') {
        setProjectMode('web')
      }
      setSelectedTemplateCode(CUSTOM_TEMPLATE_CODE)
      return
    }
    if (code === CUSTOM_TEMPLATE_CODE) {
      setSelectedCustomTemplate(null)
      if (projectMode === 'new') {
        setProjectMode('web')
      }
      const nextBaseCode =
        selectedTemplateCode && selectedTemplateCode !== CUSTOM_TEMPLATE_CODE
          ? selectedTemplateCode
          : customBaseTemplateCode || templateOptions[0]?.meta.code || ''
      if (nextBaseCode) {
        setCustomBaseTemplateCode(nextBaseCode)
        initializedCustomBaseRef.current = ''
      }
    }
    setSelectedTemplateCode(code)
  }

  const handleProjectModeChange = (mode: ProjectMode): void => {
    setProjectMode(mode)
    if (mode === 'new') {
      setFetchedProjects([])
      setSelectedProjectIdByAccount(new Map())
    }
  }

  useEffect(() => {
    if (selectedTemplateCode === CUSTOM_TEMPLATE_CODE && projectMode === 'new') {
      setProjectMode('web')
    }
  }, [projectMode, selectedTemplateCode])

  const parseWebProjectPayloadText = (): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(webProjectPayloadText)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null
      }
      return parsed as Record<string, unknown>
    } catch {
      return null
    }
  }

  const parsedWebProjectPayload = useMemo(
    () => parseWebProjectPayloadText(),
    [webProjectPayloadText]
  )

  const webProjectLandingType = useMemo(() => {
    const value = parsedWebProjectPayload?.landing_type
    if (value == null) return null
    return String(value).trim()
  }, [parsedWebProjectPayload])

  const webProjectMarketingObjective = getMarketingObjectiveByLandingType(webProjectLandingType)
  const effectiveLandingType =
    projectMode === 'existing'
      ? selectedExistingProjectLandingType
      : projectMode === 'web'
        ? webProjectLandingType
        : null
  const effectiveMarketingObjective = getMarketingObjectiveByLandingType(effectiveLandingType)
  const isAppMarketingObjective = isAppLandingType(effectiveLandingType)
  const webProjectAppProductTitle = useMemo(() => {
    if (!isAppMarketingObjective) return ''
    return (
      normalizeProductInfoTitle(parsedWebProjectPayload?.app_name) ||
      normalizeProductInfoTitle(projectMode === 'existing' ? selectedExistingProjectName : webProjectName) ||
      '应用推广'
    )
  }, [isAppMarketingObjective, parsedWebProjectPayload, projectMode, selectedExistingProjectName, webProjectName])

  const parseWebProjectAccountFieldLines = (text: string): string[] =>
    text.replace(/(?:\r?\n)+$/, '').split(/\r?\n/).map((line) => line.trim())

  const validateWebProjectAccountFieldLines = (label: string, text: string): string[] | null => {
    const lines = parseWebProjectAccountFieldLines(text)
    if (lines.length !== manualAdvertiserIds.length) {
      toast.error(`${label}行数必须与广告主账户 ID 数量一致`)
      return null
    }
    if (lines.some((line) => !line)) {
      toast.error(`${label}不能包含空行，请按广告主账户 ID 顺序逐行填写`)
      return null
    }
    return lines
  }

  const availableWebProjectDynamicParams = useMemo(() => {
    if (!parsedWebProjectPayload) return []
    const added = new Set(webProjectDynamicParams.map((item) => item.key))
    return webProjectDynamicParamConfig.filter(
      (item) => Object.prototype.hasOwnProperty.call(parsedWebProjectPayload, item.key) && !added.has(item.key)
    )
  }, [parsedWebProjectPayload, webProjectDynamicParamConfig, webProjectDynamicParams])

  const webProjectDynamicParamConfigByKey = useMemo(
    () => new Map(webProjectDynamicParamConfig.map((item) => [item.key, item])),
    [webProjectDynamicParamConfig]
  )

  const nonUniformWebProjectDynamicParams = useMemo(
    () => webProjectDynamicParams.filter((item) => !item.uniform),
    [webProjectDynamicParams]
  )

  const hasWebProjectNameDynamicParam = useMemo(
    () => webProjectDynamicParams.some((item) => item.key === 'name'),
    [webProjectDynamicParams]
  )

  const webProjectNameRequired = !hasWebProjectNameDynamicParam

  const nonUniformWebProjectDynamicParamLabels = useMemo(
    () =>
      nonUniformWebProjectDynamicParams.map((item) => {
        const config = webProjectDynamicParamConfigByKey.get(item.key)
        return config?.label ?? item.key
      }),
    [nonUniformWebProjectDynamicParams, webProjectDynamicParamConfigByKey]
  )

  const webProjectDynamicParamPasteRows = useMemo(
    () => parseWebProjectDynamicParamPasteRows(webProjectDynamicParamPasteText),
    [webProjectDynamicParamPasteText]
  )

  const webProjectDynamicParamPasteColumnCount = useMemo(
    () => Math.max(0, ...webProjectDynamicParamPasteRows.map((row) => row.length)),
    [webProjectDynamicParamPasteRows]
  )

  useEffect(() => {
    if (nonUniformWebProjectDynamicParams.length === 0 || webProjectDynamicParamPasteColumnCount === 0) return
    setWebProjectDynamicParamPasteColumnByKey((prev) => {
      const next: Record<string, number> = {}
      nonUniformWebProjectDynamicParams.forEach((item, index) => {
        const current = prev[item.key]
        next[item.key] = current != null && current < webProjectDynamicParamPasteColumnCount ? current : index
      })
      return next
    })
  }, [nonUniformWebProjectDynamicParams, webProjectDynamicParamPasteColumnCount])

  const updateWebProjectDynamicParamPasteColumn = (key: string, columnIndex: number): void => {
    setWebProjectDynamicParamPasteColumnByKey((prev) => ({ ...prev, [key]: columnIndex }))
  }

  const applyWebProjectDynamicParamPaste = (): void => {
    if (nonUniformWebProjectDynamicParams.length === 0) {
      toast.error('请先添加动态参数，并关闭需要批量录入字段的“统一值”')
      return
    }

    const rows = webProjectDynamicParamPasteRows
    if (rows.length === 0) {
      toast.error('请先粘贴从表格复制的多列数据')
      return
    }

    if (rows.length !== manualAdvertiserIds.length) {
      toast.error(`粘贴数据行数为 ${rows.length}，需与广告主账户 ID 数量 ${manualAdvertiserIds.length} 一致`)
      return
    }

    const expectedColumnCount = nonUniformWebProjectDynamicParams.length
    if (webProjectDynamicParamPasteColumnCount < expectedColumnCount) {
      toast.error(`粘贴数据只有 ${webProjectDynamicParamPasteColumnCount} 列，至少需要 ${expectedColumnCount} 列`)
      return
    }

    const selectedColumns = nonUniformWebProjectDynamicParams.map(
      (item, index) => webProjectDynamicParamPasteColumnByKey[item.key] ?? index
    )
    const invalidColumnIndex = selectedColumns.findIndex(
      (columnIndex) => columnIndex < 0 || columnIndex >= webProjectDynamicParamPasteColumnCount
    )
    if (invalidColumnIndex >= 0) {
      toast.error(`${nonUniformWebProjectDynamicParamLabels[invalidColumnIndex]} 选择的列不存在`)
      return
    }

    if (new Set(selectedColumns).size !== selectedColumns.length) {
      toast.error('不同动态参数不能选择同一列')
      return
    }

    const emptyCellRowIndex = rows.findIndex((row) => selectedColumns.some((columnIndex) => !row[columnIndex]?.trim()))
    if (emptyCellRowIndex >= 0) {
      toast.error(`第 ${emptyCellRowIndex + 1} 行选中列存在空单元格，请补齐后再录入`)
      return
    }

    const valuesTextByKey = new Map(
      nonUniformWebProjectDynamicParams.map((item, index) => {
        const columnIndex = selectedColumns[index]
        return [item.key, rows.map((row) => row[columnIndex].trim()).join('\n')]
      })
    )
    setWebProjectDynamicParams((prev) =>
      prev.map((item) => {
        const valuesText = valuesTextByKey.get(item.key)
        return valuesText == null ? item : { ...item, valuesText }
      })
    )
    setSelectedProjectIdByAccount(new Map())
    toast.success(`已从粘贴数据中提取 ${expectedColumnCount} 列并填入动态参数`)
  }

  const addWebProjectDynamicParam = (key: string): void => {
    const config = webProjectDynamicParamConfigByKey.get(key)
    if (!config || webProjectDynamicParams.some((item) => item.key === key)) return
    setWebProjectDynamicParams((prev) => [
      ...prev,
      { key, uniform: config.default_uniform, value: '', valuesText: '' }
    ])
    setSelectedProjectIdByAccount(new Map())
  }

  const updateWebProjectDynamicParam = (
    key: string,
    patch: Partial<WebProjectDynamicParamFormItem>
  ): void => {
    setWebProjectDynamicParams((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))
    setSelectedProjectIdByAccount(new Map())
  }

  const removeWebProjectDynamicParam = (key: string): void => {
    setWebProjectDynamicParams((prev) => prev.filter((item) => item.key !== key))
    setSelectedProjectIdByAccount(new Map())
  }

  const moveWebProjectDynamicParam = (fromKey: string, toKey: string): void => {
    if (fromKey === toKey) return
    setWebProjectDynamicParams((prev) => {
      const fromIndex = prev.findIndex((item) => item.key === fromKey)
      const toIndex = prev.findIndex((item) => item.key === toKey)
      if (fromIndex < 0 || toIndex < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
    setSelectedProjectIdByAccount(new Map())
  }

  const buildWebProjectDynamicParamOverrides = (): OceanEngineWebProjectDynamicParamOverride[] | null => {
    const overrides: OceanEngineWebProjectDynamicParamOverride[] = []
    for (const item of webProjectDynamicParams) {
      const config = webProjectDynamicParamConfigByKey.get(item.key)
      const label = config?.label ?? item.key
      if (!parsedWebProjectPayload || !Object.prototype.hasOwnProperty.call(parsedWebProjectPayload, item.key)) {
        toast.error(`${label} 不存在于当前项目数据包，不能动态覆盖`)
        return null
      }
      if (item.uniform) {
        const value = item.value.trim()
        if (!value) {
          toast.error(`${label}统一值不能为空`)
          return null
        }
        overrides.push({ key: item.key, uniform: true, value, values: [] })
      } else {
        const values = validateWebProjectAccountFieldLines(label, item.valuesText)
        if (!values) return null
        overrides.push({ key: item.key, uniform: false, value: '', values })
      }
    }
    return overrides
  }

  const stringifyWebProjectPayload = (payload?: Record<string, unknown> | null): string => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return ''
    return JSON.stringify(payload, null, 2)
  }

  const buildWebProjectNamePrefix = (): string => {
    const templateDisplay = getBatchAdTemplateDisplayLabel(
      selectedTemplateCode,
      customBaseTemplateCode,
      templateOptions
    )
    const source =
      selectedTemplateCode === CUSTOM_TEMPLATE_CODE
        ? customTemplateForm.unit.source
        : promoSource
    const currentDramaName =
      (selectedTemplateCode === CUSTOM_TEMPLATE_CODE ? customTemplateForm.unit.dramaName : dramaName).trim() ||
      '未命名剧名'
    const dateStr = formatBatchAdNamePlaceholderDate(new Date())
    return `${(source || '番茄').trim() || '番茄'}-${templateDisplay}-${currentDramaName}-${dateStr}`
  }

  const fillWebProjectNameInitialFormat = (): void => {
    setWebProjectName(buildWebProjectNamePrefix())
    setSelectedProjectIdByAccount(new Map())
  }

  const openWebProjectCreateWindow = async (): Promise<void> => {
    const advertiserId = manualAdvertiserIds[0]
    const cookie = cookieConfigs.find((item) => item.id === selectedCookieConfigId)?.cookie ?? ''
    if (!advertiserId) {
      toast.error('请先在广告主账户中填写至少一行账户 ID')
      return
    }
    if (!cookie) {
      toast.error('请先在 Step 1 选择 Cookie 账号')
      return
    }

    setWebProjectCreateLoading(true)
    try {
      const result = await window.api.openOceanEngineProjectCreateWindow({ advertiserId, cookie })
      if (!result.success) {
        toast.error(('error' in result && result.error) || '网页新建窗口已关闭')
        return
      }
      setWebProjectPayloadText(JSON.stringify(result.params, null, 2))
      setWebProjectName((prev) => prev.trim() || buildWebProjectNamePrefix())
      setSelectedProjectIdByAccount(new Map())
      toast.success('已捕获项目创建请求参数，并填入项目数据包')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '打开网页新建窗口失败')
    } finally {
      setWebProjectCreateLoading(false)
    }
  }

  const batchCreateWebProjects = async (): Promise<void> => {
    if (selectedCookieConfigId == null) {
      toast.error('请先在 Step 1 选择 Cookie 账号')
      return
    }
    if (manualAdvertiserIds.length === 0) {
      toast.error('请先填写广告主账户 ID')
      return
    }

    const projectPayload = parsedWebProjectPayload
    if (!projectPayload) {
      toast.error('项目数据包不是有效 JSON 对象')
      return
    }

    const projectName = webProjectName.trim()
    if (webProjectNameRequired && !projectName) {
      toast.error('请先填写网页项目名称，或点击“填入初始格式”')
      return
    }

    const dynamicParamOverrides = buildWebProjectDynamicParamOverrides()
    if (!dynamicParamOverrides) return

    setWebProjectBatchCreateLoading(true)
    try {
      const result = await oceanEngineBatchAdService.batchCreateWebProjects({
        selected_cookie_config_id: selectedCookieConfigId,
        advertiser_ids: manualAdvertiserIds,
        project_payload: projectPayload,
        project_name: projectName,
        dynamic_param_overrides: dynamicParamOverrides
      })
      const next = new Map(selectedProjectIdByAccount)
      Object.entries(result.advertiser_project_ids).forEach(([advertiserId, projectId]) => {
        next.set(advertiserId, projectId)
      })
      setSelectedProjectIdByAccount(next)
      const successCount = Object.keys(result.advertiser_project_ids).length
      if (successCount === manualAdvertiserIds.length) {
        toast.success(`批量新建项目完成：${successCount}/${manualAdvertiserIds.length}`)
      } else {
        const failed = result.results.filter((item) => !item.success)
        toast.error(
          failed[0]?.message || `批量新建项目部分失败：${successCount}/${manualAdvertiserIds.length}`
        )
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '批量新建项目失败')
    } finally {
      setWebProjectBatchCreateLoading(false)
    }
  }

  const renderWebProjectPanel = (): React.ReactNode => {
    const firstAdvertiserId = manualAdvertiserIds[0] ?? ''
    const createdProjectCount = manualAdvertiserIds.filter((aid) => selectedProjectIdByAccount.get(aid)).length
    const allWebProjectsCreated =
      manualAdvertiserIds.length > 0 && createdProjectCount === manualAdvertiserIds.length
    return (
      <div className="space-y-3 rounded-xl border bg-background/60 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">网页新建项目</p>
            <p className="text-xs leading-5 text-muted-foreground">
              使用首个广告账户 {firstAdvertiserId || '（未填写）'} 作为 aadvid，注入 Step 1 Cookie 后打开巨量网页。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void openWebProjectCreateWindow()}
            disabled={webProjectCreateLoading || !firstAdvertiserId || !selectedCookieConfigId}
            className="shrink-0"
          >
            {webProjectCreateLoading ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-1 h-4 w-4" />
            )}
            打开网页新建项目
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="web-project-payload" className="text-xs">
            项目数据包
          </Label>
          <Textarea
            id="web-project-payload"
            className="min-h-[180px] resize-y font-mono text-xs"
            value={webProjectPayloadText}
            onChange={(e) => {
              setWebProjectPayloadText(e.target.value)
              setSelectedProjectIdByAccount(new Map())
            }}
            placeholder="网页中提交项目创建后，会自动捕获 /v2/project/create 的 POST 请求参数并填入这里"
            spellCheck={false}
          />
          <p className="text-[11px] leading-4 text-muted-foreground">
            获取数据包并确认项目名称后，点击批量新建项目；成功后回填项目 ID 并按已有项目逻辑继续创建单元。
          </p>
          {webProjectLandingType && (
            <div className="rounded-lg border bg-muted/20 p-3 text-xs">
              <span className="text-muted-foreground">当前营销目的：</span>
              <span className="font-medium text-foreground">
                {webProjectMarketingObjective ?? `未识别（landing_type=${webProjectLandingType}）`}
              </span>
            </div>
          )}
          <WebProjectDynamicParamsPanel
            payload={parsedWebProjectPayload}
            accountIds={manualAdvertiserIds}
            configs={webProjectDynamicParamConfig}
            availableParams={availableWebProjectDynamicParams}
            value={webProjectDynamicParams}
            pasteText={webProjectDynamicParamPasteText}
            pasteRows={webProjectDynamicParamPasteRows}
            pasteColumnCount={webProjectDynamicParamPasteColumnCount}
            pasteColumnByKey={webProjectDynamicParamPasteColumnByKey}
            onAddParam={addWebProjectDynamicParam}
            onUpdateParam={updateWebProjectDynamicParam}
            onRemoveParam={removeWebProjectDynamicParam}
            onMoveParam={moveWebProjectDynamicParam}
            onPasteTextChange={setWebProjectDynamicParamPasteText}
            onPasteColumnChange={updateWebProjectDynamicParamPasteColumn}
            onApplyPaste={applyWebProjectDynamicParamPaste}
          />
        </div>
        {webProjectNameRequired && (
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="web-project-name" className="text-xs">
                  网页项目名称
                </Label>
                <Input
                  id="web-project-name"
                  value={webProjectName}
                  onChange={(e) => {
                    setWebProjectName(e.target.value)
                    setSelectedProjectIdByAccount(new Map())
                  }}
                  placeholder="例如：番茄-普通短剧-剧名-0604"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={fillWebProjectNameInitialFormat}
                className="shrink-0"
              >
                填入初始格式
              </Button>
            </div>
            <p className="text-[11px] leading-4 text-muted-foreground">
              批量创建时会按此名称覆盖数据包中的 name，并为每个项目追加 -0x四位随机数-日期，最终格式类似「来源-投放模板-剧名-日期-0x1234-06/06」。
            </p>
          </div>
        )}
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">批量新建项目</p>
            <p className="text-xs text-muted-foreground">
              已获取项目 ID：{createdProjectCount}/{manualAdvertiserIds.length || 0}
              {allWebProjectsCreated ? '，预检可继续' : '，需全部成功后才能进入下一步'}
            </p>
          </div>
          <Button
            type="button"
            onClick={() => void batchCreateWebProjects()}
            disabled={
              webProjectBatchCreateLoading ||
              !webProjectPayloadText.trim() ||
              (webProjectNameRequired && !webProjectName.trim()) ||
              manualAdvertiserIds.length === 0 ||
              selectedCookieConfigId == null
            }
            className="shrink-0"
          >
            {webProjectBatchCreateLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            批量新建项目
          </Button>
        </div>
      </div>
    )
  }

  const effectiveMaterialKeywords = useMemo(() => {
    const parts = parseMaterialKeywordParts(materialKeywords)
    return parts
  }, [dramaName, materialKeywords])

  const filteredVideoList = useMemo(() => {
    if (effectiveMaterialKeywords.length === 0) {
      return videoList
    }
    return videoList.filter((item) =>
      effectiveMaterialKeywords.some((keyword) => item.filename.includes(keyword))
    )
  }, [effectiveMaterialKeywords, videoList])

  const productMainImageReady = productMainImageId.trim().length > 0

  const manualPreflight = useMemo<ManualPreflightResult>(() => {
    const errors: ManualPreflightError[] = []
    const push = (message: string, stepKey: ManualStepKey): void => {
      errors.push({ message, stepKey })
    }
    const advertiserIds = parseAccountLines(accountIdsText)

    if (reusedSubmitBody) {
      if (selectedOrgId == null) push('请先选择 OAuth 授权组织账户', 'setup')
      if (selectedCookieConfigId == null) push('请选择 Cookie 账号', 'setup')
      if (advertiserIds.length === 0) push('请填写至少一个广告主账户 ID', 'accounts')
      return { ok: errors.length === 0, errors }
    }

    if (selectedOrgId == null) push('请先选择 OAuth 授权组织账户', 'setup')
    if (selectedCookieConfigId == null) push('请选择 Cookie 账号', 'setup')
    if (advertiserIds.length === 0) push('请填写至少一个广告主账户 ID', 'accounts')
    if (committedVideos.length === 0) push('请至少选择并确认一个视频素材', 'material')
    if (!productMainImageReady) push('请上传并设置产品主图', 'material')

    if (projectMode === 'web') {
      if (!webProjectPayloadText.trim()) {
        push('请先通过网页新建捕获项目数据包', 'project')
      }
      if (webProjectNameRequired && !webProjectName.trim()) {
        push('请填写网页项目名称，或点击填入初始格式', 'project')
      }
      for (const aid of advertiserIds) {
        if (!selectedProjectIdByAccount.get(aid)) {
          push(`请先为广告主 ${aid} 批量新建项目并获取项目 ID`, 'project')
        }
      }
    }

    if (projectMode === 'existing') {
      for (const aid of advertiserIds) {
        if (!selectedProjectIdByAccount.get(aid)) {
          push(`请为广告主 ${aid} 勾选一个已有项目`, 'project')
        }
      }
    }

    if (!selectedTemplateCode) {
      push('请选择投放模板', 'setup')
    } else if (selectedTemplateCode === CUSTOM_TEMPLATE_CODE) {
      if (!selectedCustomTemplate && !customBaseTemplateDetail) {
        push('自定义模板详情尚未加载完成', 'setup')
      } else {
        if (projectMode === 'new' && !customTemplateForm.project.name.trim()) {
          push('项目名称不能为空', 'project')
        }
        if (!customTemplateForm.unit.name.trim()) push('单元名称不能为空', 'unit')
        if (!customTemplateForm.unit.awemeId.trim()) push('投放身份（抖音号） 不能为空', 'unit')
        if (!customTemplateForm.unit.dramaName.trim()) push('产品名称不能为空', 'unit')
      }
    } else {
      if (!selectedTemplateDetailMatchesSelection) {
        push('模板详情尚未加载完成', 'setup')
      } else {
        const templateProjectName = String(selectedTemplateDetail.project_template?.name ?? '')
        const templatePromoName = String(selectedTemplateDetail.unit_template?.name ?? '')
        const templateAwemeId = String(
          selectedTemplateDetail.unit_template?.native_setting?.aweme_id ?? ''
        )
        const requiresProduct = Boolean(selectedTemplateDetail.project_template?.related_product)

        if (projectMode === 'new' && !(projName.trim() || templateProjectName.trim())) {
          push('项目名称不能为空', 'project')
        }
        if (!(promoName.trim() || templatePromoName.trim())) push('单元名称不能为空', 'unit')
        if (!(promoAwemeId.trim() || templateAwemeId.trim())) {
          push('投放身份（抖音号） 不能为空', 'unit')
        }
        if (!isAppMarketingObjective && !dramaName.trim()) push('剧名不能为空', 'project')
        if (projectMode === 'new' && requiresProduct && !projProductPlatformId.trim()) {
          push('商品平台 ID 不能为空', 'project')
        }
        if (projectMode === 'new' && requiresProduct && !projProductId.trim()) push('商品 ID 不能为空', 'project')
      }
    }

    if (customTitleEnabled && parseTitleLines(customTitlesText).length === 0) {
      push('已开启标题自定义，请至少输入一条标题', 'unit')
    }

    return { ok: errors.length === 0, errors }
  }, [
    accountIdsText,
    committedVideos.length,
    customTitleEnabled,
    customTitlesText,
    customBaseTemplateDetail,
    selectedCustomTemplate,
    customTemplateForm.project.name,
    customTemplateForm.unit.awemeId,
    customTemplateForm.unit.dramaName,
    customTemplateForm.unit.name,
    dramaName,
    projName,
    projProductId,
    projProductPlatformId,
    productMainImageReady,
    isAppMarketingObjective,
    projectMode,
    promoAwemeId,
    promoName,
    selectedCookieConfigId,
    selectedOrgId,
    selectedProjectIdByAccount,
    selectedTemplateCode,
    selectedTemplateDetail,
    selectedTemplateDetailMatchesSelection,
    reusedSubmitBody,
    webProjectName,
    webProjectNameRequired,
    webProjectPayloadText
  ])

  const manualSteps = useMemo<ManualStepItem[]>(() => {
    const authReady = selectedOrgId != null && selectedCookieConfigId != null
    const setupReady =
      authReady &&
      (selectedTemplateCode
        ? selectedTemplateCode === CUSTOM_TEMPLATE_CODE
          ? selectedCustomTemplate != null || customBaseTemplateDetail != null
          : selectedTemplateDetailMatchesSelection
        : false)
    const accountReady = authReady && manualAdvertiserIds.length > 0

    const setupStep: ManualStepItem = {
      key: 'setup',
      title: '准备',
      description: setupReady
        ? `授权与模板已就绪 · ${
            inputMode === 'manual'
              ? '手动配置'
              : inputMode === 'excel'
                ? 'Excel 导入'
                : '飞书 Bitable'
          }`
        : '选择 OAuth、Cookie、模板与创建方式',
      done: setupReady
    }

    if (reusedSubmitBody) {
      const projectCount = reusedSubmitBody.advertiser_project_ids
        ? Object.keys(reusedSubmitBody.advertiser_project_ids).length
        : reusedSubmitBody.project && Object.keys(reusedSubmitBody.project).length > 0
          ? 1
          : 0
      const promotionCount =
        Object.values(reusedSubmitBody.promotions_by_advertiser ?? {}).reduce(
          (total, list) => total + (Array.isArray(list) ? list.length : 0),
          0
        ) || reusedSubmitBody.promotions.length
      return [
        setupStep,
        {
          key: 'accounts',
          title: '广告主账户',
          description: accountReady
            ? `已识别 ${manualAdvertiserIds.length} 个广告主`
            : '填写广告主账户 ID',
          done: accountReady
        },
        {
          key: 'project',
          title: '项目配置',
          description:
            reusedSubmitBody.advertiser_project_ids && projectCount > 0
              ? `复用快照：${projectCount} 个已有项目映射`
              : '复用快照：沿用历史项目配置',
          done: true
        },
        {
          key: 'unit',
          title: '单元配置',
          description: `复用快照：${promotionCount} 个广告单元配置`,
          done: true
        },
        {
          key: 'material',
          title: '视频素材',
          description: '复用快照：素材配置随广告单元一并沿用',
          done: true
        },
        {
          key: 'submit',
          title: '预检提交',
          description: manualPreflight.ok ? '复用快照可提交' : '仍有必填项未完成',
          done: manualPreflight.ok
        }
      ]
    }

    if (inputMode !== 'manual') {
      return [
        setupStep,
        {
          key: 'execute',
          title: inputMode === 'excel' ? 'Excel 导入并执行' : 'Bitable 导入并执行',
          description: setupReady ? '在当前面板完成导入并提交' : '请先在「准备」中选择授权与模板',
          done: false
        }
      ]
    }

    const existingProjectReady =
      selectedCookieConfigId != null &&
      effectiveDramaName.trim().length > 0 &&
      manualAdvertiserIds.length > 0 &&
      manualAdvertiserIds.every((aid) => Boolean(selectedProjectIdByAccount.get(aid)))
    const webProjectReady =
      webProjectPayloadText.trim().length > 0 &&
      (!webProjectNameRequired || webProjectName.trim().length > 0) &&
      manualAdvertiserIds.length > 0 &&
      manualAdvertiserIds.every((aid) => Boolean(selectedProjectIdByAccount.get(aid)))
    const templateProjectName = String(selectedTemplateDetail?.project_template?.name ?? '')
    const requiresProduct = Boolean(selectedTemplateDetail?.project_template?.related_product)
    const normalProjectReady =
      selectedTemplateCode === CUSTOM_TEMPLATE_CODE
        ? customBaseTemplateDetail != null &&
          (projectMode !== 'new' || customTemplateForm.project.name.trim().length > 0)
        : selectedTemplateDetailMatchesSelection &&
          (projectMode !== 'new' || Boolean(projName.trim() || templateProjectName.trim())) &&
          (!requiresProduct ||
            (projProductPlatformId.trim().length > 0 && projProductId.trim().length > 0))
    const projectReady =
      accountReady &&
      (projectMode === 'existing'
        ? existingProjectReady
        : projectMode === 'web'
          ? webProjectReady
          : normalProjectReady)

    const templatePromoName = String(selectedTemplateDetail?.unit_template?.name ?? '')
    const templateAwemeId = String(
      selectedTemplateDetail?.unit_template?.native_setting?.aweme_id ?? ''
    )
    const unitReady =
      selectedTemplateCode === CUSTOM_TEMPLATE_CODE
        ? customBaseTemplateDetail != null &&
          customTemplateForm.unit.name.trim().length > 0 &&
          customTemplateForm.unit.awemeId.trim().length > 0 &&
          customTemplateForm.unit.dramaName.trim().length > 0
        : selectedTemplateDetailMatchesSelection &&
          Boolean(promoName.trim() || templatePromoName.trim()) &&
          Boolean(promoAwemeId.trim() || templateAwemeId.trim()) &&
          (isAppMarketingObjective || dramaName.trim().length > 0)
    const materialReady = productMainImageReady && committedVideos.length > 0

    return [
      setupStep,
      {
        key: 'accounts',
        title: '广告主账户',
        description:
          authReady && manualAdvertiserIds.length > 0
            ? `已识别 ${manualAdvertiserIds.length} 个广告主`
            : '填写广告主账户 ID',
        done: accountReady
      },
      {
        key: 'project',
        title: '项目配置',
        description:
          projectMode === 'existing'
            ? '选择已有项目'
            : projectMode === 'web'
              ? '网页新建项目并采集数据包'
              : '配置新建项目',
        done: projectReady
      },
      {
        key: 'unit',
        title: '单元配置',
        description: unitReady
          ? '单元名称与投放身份已就绪'
          : '配置单元名称、投放身份与产品素材信息',
        done: unitReady
      },
      {
        key: 'material',
        title: '视频素材',
        description:
          committedVideos.length > 0 && productMainImageReady
            ? `已确认 ${committedVideos.length} 个素材，产品主图已设置`
            : '选择视频素材并上传产品主图',
        done: materialReady
      },
      {
        key: 'submit',
        title: '预检提交',
        description: manualPreflight.ok
          ? '全部检查通过'
          : `${manualPreflight.errors.length} 项待完善`,
        done: manualPreflight.ok
      }
    ]
  }, [
    committedVideos.length,
    customBaseTemplateDetail,
    customTemplateForm.project.name,
    customTemplateForm.unit.awemeId,
    customTemplateForm.unit.dramaName,
    customTemplateForm.unit.name,
    dramaName,
    effectiveDramaName,
    inputMode,
    isAppMarketingObjective,
    manualAdvertiserIds,
    manualPreflight.errors.length,
    manualPreflight.ok,
    productMainImageReady,
    projectMode,
    promoAwemeId,
    promoName,
    projName,
    projProductId,
    projProductPlatformId,
    reusedSubmitBody,
    selectedCookieConfigId,
    selectedOrgId,
    selectedProjectIdByAccount,
    selectedTemplateCode,
    selectedTemplateDetail,
    selectedTemplateDetailMatchesSelection,
    webProjectName,
    webProjectNameRequired,
    webProjectPayloadText
  ])

  /** Stepper 路径与可跳转判定集中管理 */
  const stepKeys = useMemo<ManualStepKey[]>(() => manualSteps.map((s) => s.key), [manualSteps])
  const stepIndex = useMemo(() => stepKeys.indexOf(activeManualStep), [stepKeys, activeManualStep])
  const goToStep = (key: ManualStepKey): void => {
    if (stepKeys.includes(key)) setActiveManualStep(key)
    else setActiveManualStep('setup')
  }
  const goPrevStep = (): void => {
    if (stepIndex > 0) setActiveManualStep(stepKeys[stepIndex - 1])
  }
  const goNextStep = (): void => {
    if (stepIndex >= 0 && stepIndex < stepKeys.length - 1) {
      setActiveManualStep(stepKeys[stepIndex + 1])
    }
  }
  /** 当 Stepper 路径变化后，如果当前 step 已不在路径中，回退到 setup */
  useEffect(() => {
    if (!stepKeys.includes(activeManualStep)) {
      setActiveManualStep('setup')
    }
  }, [stepKeys, activeManualStep])

  const canLeaveManualAccountStep =
    selectedOrgId != null && selectedCookieConfigId != null && manualAdvertiserIds.length > 0
  const currentInputModeLabel =
    inputMode === 'manual' ? '手动配置' : inputMode === 'excel' ? 'Excel 导入' : '飞书 Bitable'
  const selectedTemplateLabel =
    selectedCustomTemplate?.name ??
    selectedTemplate?.meta.label ??
    (selectedTemplateCode === CUSTOM_TEMPLATE_CODE ? '自定义模板' : selectedTemplateCode || '未选择')
  const effectiveMaterialsPerUnit =
    selectedTemplateCode === CUSTOM_TEMPLATE_CODE
      ? Number.parseInt(customTemplateForm.unit.materialsPerUnit, 10) || 10
      : selectedTemplateCode
        ? materialsPerUnit
        : 10
  const averageTargetPromotionCount = parseAverageTargetPromotionCount(
    averageTargetPromotionCountText
  )
  const parsedCustomTitles = useMemo(
    () => parseTitleLines(customTitlesText),
    [customTitlesText]
  )
  const effectiveCustomTitleCount = Math.min(
    TITLE_MATERIALS_PER_UNIT,
    parsedCustomTitles.length || TITLE_MATERIALS_PER_UNIT
  )
  const basePromotionCount =
    committedVideos.length > 0 ? Math.ceil(committedVideos.length / effectiveMaterialsPerUnit) : 1
  const averagePromotionCount = useMemo(() => {
    if (averageTargetPromotionCount != null) {
      return (manualAdvertiserIds.length || 1) * averageTargetPromotionCount
    }
    return committedVideos.length > 0
      ? Math.ceil(committedVideos.length / effectiveMaterialsPerUnit)
      : manualAdvertiserIds.length || 1
  }, [
    averageTargetPromotionCount,
    committedVideos.length,
    effectiveMaterialsPerUnit,
    manualAdvertiserIds.length
  ])
  const expectedPromotionCount =
    manualAdvertiserIds.length > 0
      ? videoDistributionMode === 'average'
        ? averagePromotionCount
        : manualAdvertiserIds.length * basePromotionCount
      : basePromotionCount
  const updateEffectiveMaterialsPerUnit = (value: string): void => {
    const next = Number.parseInt(value, 10)
    if (Number.isNaN(next) || next < 1 || next > 30) return
    if (selectedTemplateCode === CUSTOM_TEMPLATE_CODE) {
      setCustomTemplateForm((prev) => ({
        ...prev,
        unit: {
          ...prev.unit,
          materialsPerUnit: String(next)
        }
      }))
      return
    }
    setMaterialsPerUnit(next)
  }
  const handleAwemeIdChange = (nextAwemeId: string): void => {
    setPromoAwemeId(nextAwemeId)
    setCustomTemplateForm((prev) => ({
      ...prev,
      unit: {
        ...prev.unit,
        awemeId: nextAwemeId
      }
    }))
  }

  const resetWorkbenchToInitialConfig = (): void => {
    onReuseDraftClear?.()
    batchJobPollAbortRef.current?.abort()
    batchJobPollAbortRef.current = null
    clearBatchAdEmbedDraft()
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
      searchTimerRef.current = null
    }
    if (autoVideoFetchTimerRef.current) {
      clearTimeout(autoVideoFetchTimerRef.current)
      autoVideoFetchTimerRef.current = null
    }
    autoVideoFetchSeqRef.current += 1
    initializedCustomBaseRef.current = ''
    skipEmbedTemplateDetailApplyRef.current = false
    embedDraftReadyForPersistRef.current = true

    setReusedSubmitBody(null)
    setSubmitting(false)
    setSelectedOrgId(null)
    setSelectedCookieConfigId(null)
    setProjectMode('new')
    setWebProjectPayloadText('')
    setWebProjectName('')
    setFetchedProjects([])
    setSelectedProjectIdByAccount(new Map())
    setSearchingProjects(false)

    setSelectedTemplateCode(null)
    setCustomBaseTemplateCode('')
    setCustomBaseTemplateDetail(null)
    setSelectedTemplateDetail(null)

    setInputMode(embedMode ? 'manual' : 'excel')
    setActiveManualStep('setup')
    setLatestResults([])
    setSuccessJobId(null)
    setSuccessJobMeta(null)
    setAccountIdsText('')

    setDramaName('')
    setPromoSource('')
    setPromoAwemeId('63279742087')
    setPromoPlayletUrl('')
    setRoiCoeff('0.9')
    setProjCpaBid('20')
    setProjName('')
    setProjBudget(loadBatchAdLastProjectBudget() || '300')
    setProjProductPlatformId(lastProductSelectionRef.current.productPlatformId)
    setProjProductId(lastProductSelectionRef.current.productId)
    setProductSearching(false)
    setPromoName('')
    setAwemeOptions([])
    setAwemeLoading(false)
    setAwemeSourceAdvertiserId('')
    setMaterialsPerUnit(10)
    setAverageTargetPromotionCountText('')

    setMaterialKeywords('')
    setVideoDistributionMode('full')
    setShowVideoSelector(false)
    setVideoFetchMode('cookie')
    setVideoAdvertiserId('')
    setVideoStartTime('')
    setVideoEndTime('')
    setVideoLoading(false)
    setVideoList([])
    setVideoPageInfo(null)
    setVideoPage(1)
    setCommittedVideos([])

    setProductMainImageId('')
    setProductMainImagePreviewUrl('')
    setProductMainImageUploading(false)
    setProductSellingPoints('')
    setCallToActionButtons('')
    setCustomTitleEnabled(false)
    setCustomTitlesText('')
    setCustomTitleMode('random')
    setProductPlatformLibraries([])
    setProductPlatformLibrariesLoading(false)
    setExistingProjectKeyword('')

    setCustomTemplateForm(createCustomTemplateFormState(null))
    setWorkbenchResetSeq((s) => s + 1)
    toast.success('已重置为初始配置')
  }

  const handleFetchExistingProjects = async (): Promise<void> => {
    if (selectedCookieConfigId == null) {
      toast.error('请先选择 Cookie 账号')
      return
    }
    const accounts = parseAccountLines(accountIdsText)
    if (accounts.length === 0) {
      toast.error('请先填写广告主账户 ID')
      return
    }
    const kw = existingProjectKeyword.trim() || (!isAppMarketingObjective ? effectiveDramaName.trim() : '')
    if (!kw) {
      toast.error('请先填写项目搜索关键词')
      return
    }
    setSearchingProjects(true)
    try {
      const res = await pAssistantServiceExtended.searchPromotionProjects({
        selected_cookie_id: selectedCookieConfigId,
        account_ids: accounts,
        keyword: kw
      })
      if (res.code !== 0) {
        toast.error(res.msg || '查询失败')
        return
      }
      const items = res.items ?? []
      const firstProjectByAccount = new Map<string, string>()
      for (const item of items) {
        if (!firstProjectByAccount.has(item.advertiser_id)) {
          firstProjectByAccount.set(item.advertiser_id, item.project_id)
        }
      }
      setFetchedProjects(items)
      setSelectedProjectIdByAccount(firstProjectByAccount)
      if (res.account_errors?.length) {
        toast.info(
          `部分账户请求失败：${res.account_errors
            .map((e) => `${e.account_id ?? '?'}: ${e.error}`)
            .join('；')}`
        )
      }
      toast.success(
        `共拉取 ${items.length} 条项目，已默认选中 ${firstProjectByAccount.size} 个账户的首个项目`
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '拉取项目失败')
    } finally {
      setSearchingProjects(false)
    }
  }

  const toggleProjectPick = (advertiserId: string, projectId: string, checked: boolean): void => {
    setSelectedProjectIdByAccount((prev) => {
      const next = new Map(prev)
      const cur = next.get(advertiserId)
      if (checked) {
        next.set(advertiserId, projectId)
      } else if (cur === projectId) {
        next.delete(advertiserId)
      }
      return next
    })
  }

  const renderExistingProjectPanel = (): React.JSX.Element => (
    <div className="space-y-2 rounded-md border border-dashed border-primary/25 bg-background/50 p-3 text-sm">
      <div className="space-y-2">
        <div className="grid gap-1.5 sm:max-w-md">
          <Label htmlFor="existing-project-keyword" className="text-xs">
            项目搜索关键词
          </Label>
          <Input
            id="existing-project-keyword"
            value={existingProjectKeyword}
            onChange={(e) => setExistingProjectKeyword(e.target.value)}
            placeholder={
              isAppMarketingObjective
                ? '请输入应用名、项目名等关键词'
                : effectiveDramaName.trim() || '默认使用当前漫剧名称，可手动覆盖'
            }
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void handleFetchExistingProjects()}
            disabled={searchingProjects}
          >
            {searchingProjects ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
            拉取项目
          </Button>
        </div>
      </div>
      {selectedExistingProjectLandingType && (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs">
          <span className="text-muted-foreground">当前营销目的：</span>
          <span className="font-medium">
            {effectiveMarketingObjective ?? `未识别（landing_type=${selectedExistingProjectLandingType}）`}
          </span>
        </div>
      )}
      {fetchedProjects.length > 0 && (
        <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2 font-medium">广告主 ID</th>
                <th className="p-2 font-medium">项目 ID</th>
                <th className="p-2 font-medium">项目名</th>
                <th className="p-2 font-medium">营销目的</th>
                <th className="p-2 font-medium w-12">选</th>
              </tr>
            </thead>
            <tbody>
              {fetchedProjects.map((row) => {
                const picked = selectedProjectIdByAccount.get(row.advertiser_id) === row.project_id
                const rowLandingType = row.landing_type == null ? null : String(row.landing_type).trim() || null
                const rowMarketingObjective = getMarketingObjectiveByLandingType(rowLandingType)
                return (
                  <tr
                    key={`${row.advertiser_id}-${row.project_id}`}
                    className="border-t border-border/60"
                  >
                    <td className="p-2 font-mono align-top">{row.advertiser_id}</td>
                    <td className="p-2 font-mono align-top">{row.project_id}</td>
                    <td
                      className="p-2 max-w-[220px] break-words align-top"
                      title={row.project_name}
                    >
                      {row.project_name || '—'}
                    </td>
                    <td className="p-2 align-top">
                      {rowLandingType
                        ? rowMarketingObjective ?? `未识别（landing_type=${rowLandingType}）`
                        : '—'}
                    </td>
                    <td className="p-2 align-top">
                      <Checkbox
                        checked={picked}
                        onCheckedChange={(c) =>
                          toggleProjectPick(row.advertiser_id, row.project_id, c === true)
                        }
                      />
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

  const fetchVideoMaterials = async (page = 1, pageSize = videoPageSize): Promise<VideoMaterialItem[]> => {
    const keyword = materialKeywords.trim()
    return fetchVideoMaterialsWithKeyword(page, keyword, {
      showWarnings: true,
      autoSelect: false,
      pageSize
    })
  }

  const fetchVideoMaterialsWithKeyword = async (
    page = 1,
    keyword: string,
    options: { showWarnings: boolean; autoSelect: boolean; pageSize?: VideoMaterialPageSize }
  ): Promise<VideoMaterialItem[]> => {
    const orgId = selectedOrgId
    const advertiserId = (
      videoAdvertiserId.trim() ||
      parseAccountLines(accountIdsText)[0] ||
      ''
    ).trim()
    const warn = (message: string): void => {
      if (options.showWarnings) toast.error(message)
    }
    if (videoFetchMode === 'api' && orgId == null) {
      warn('请先选择授权来源账户')
      return []
    }
    if (videoFetchMode === 'cookie' && selectedCookieConfigId == null) {
      warn('请先选择 Cookie 账号')
      return []
    }
    if (!advertiserId) {
      warn('请先填写广告主账户 ID')
      return []
    }
    const requestPageSize = options.pageSize ?? videoPageSize
    setVideoLoading(true)
    try {
      const res =
        videoFetchMode === 'cookie'
          ? await videoMaterialService.getVideoMaterialsByCookie({
              selected_cookie_id: selectedCookieConfigId!,
              advertiser_id: advertiserId,
              page,
              page_size: requestPageSize,
              keyword: keyword || undefined,
              start_time: videoStartTime || undefined,
              end_time: videoEndTime || undefined
            })
          : await videoMaterialService.getVideoMaterials({
              org_advertiser_id: orgId!,
              advertiser_id: advertiserId,
              page,
              page_size: requestPageSize,
              start_time: videoStartTime || undefined,
              end_time: videoEndTime || undefined
            })
      const nextVideos = res.data?.list ?? []
      setVideoList(nextVideos)
      setVideoPageInfo(res.data?.page_info ?? null)
      setVideoPage(page)
      if (options.autoSelect) {
        setCommittedVideos(nextVideos)
      }
      return nextVideos
    } catch (error) {
      warn(error instanceof Error ? error.message : '拉取视频失败')
      return []
    } finally {
      setVideoLoading(false)
    }
  }

  useEffect(() => {
    if (!reuseBatchRequest || successJobId != null) return undefined

    const nextDrama = effectiveDramaName.trim()
    if (!nextDrama || nextDrama === copiedTaskDramaRef.current) return undefined

    if (autoVideoFetchTimerRef.current) {
      clearTimeout(autoVideoFetchTimerRef.current)
      autoVideoFetchTimerRef.current = null
    }

    setCommittedVideos([])
    setVideoList([])
    setVideoPageInfo(null)
    setVideoPage(1)
    setMaterialKeywords(nextDrama)
    setShowVideoSelector(true)

    const seq = autoVideoFetchSeqRef.current + 1
    autoVideoFetchSeqRef.current = seq
    autoVideoFetchTimerRef.current = setTimeout(() => {
      if (autoVideoFetchSeqRef.current !== seq) return
      void fetchVideoMaterialsWithKeyword(1, nextDrama, { showWarnings: false, autoSelect: true })
    }, 450)

    return () => {
      if (autoVideoFetchTimerRef.current) {
        clearTimeout(autoVideoFetchTimerRef.current)
        autoVideoFetchTimerRef.current = null
      }
    }
  }, [
    accountIdsText,
    effectiveDramaName,
    reuseBatchRequest,
    selectedCookieConfigId,
    selectedOrgId,
    successJobId,
    videoAdvertiserId,
    videoEndTime,
    videoFetchMode,
    videoStartTime
  ])

  const handleVideoPageSizeChange = (nextPageSize: VideoMaterialPageSize): void => {
    setVideoPageSize(nextPageSize)
    void fetchVideoMaterials(1, nextPageSize)
  }

  const toggleVideoItem = (item: VideoMaterialItem): void => {
    setCommittedVideos((prev) => {
      if (prev.some((video) => video.id === item.id)) {
        return prev.filter((video) => video.id !== item.id)
      }
      return [...prev, item]
    })
  }

  const toggleVideoPage = (items: VideoMaterialItem[], shouldSelect: boolean): void => {
    setCommittedVideos((prev) => {
      const pageIds = new Set(items.map((item) => item.id))
      if (!shouldSelect) {
        return prev.filter((video) => !pageIds.has(video.id))
      }
      const next = [...prev]
      const existing = new Set(next.map((video) => video.id))
      for (const item of items) {
        if (!existing.has(item.id)) {
          next.push(item)
          existing.add(item.id)
        }
      }
      return next
    })
  }

  const clearSelectedVideos = (): void => {
    setCommittedVideos([])
  }

  const handleProductMainImageUpload = async (file: File): Promise<void> => {
    const orgId = selectedOrgId
    const firstAdvertiserId = manualAdvertiserIds[0]
    if (!orgId || !firstAdvertiserId) {
      toast.error('请先选择授权组织并填写至少一个广告主账户')
      return
    }
    setProductMainImageUploading(true)
    try {
      const res = await videoMaterialService.uploadImageMaterial({
        org_advertiser_id: orgId,
        advertiser_id: firstAdvertiserId,
        file,
        filename: file.name
      })
      if (res.code !== 0) {
        throw new Error(res.message || res.msg || '上传产品主图失败')
      }
      const imageId = res.data?.id || res.data?.image_id || ''
      if (!imageId) {
        throw new Error('上传成功但未返回 image_id')
      }
      setProductMainImageId(imageId)
      setProductMainImagePreviewUrl(res.data?.url || (await readFileAsDataUrl(file)))
      toast.success(
        manualAdvertiserIds.length > 1
          ? `已使用首个账户 ${firstAdvertiserId} 上传，其他账户将共用同一 image_id`
          : '产品主图已上传并设置'
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传失败')
    } finally {
      setProductMainImageUploading(false)
    }
  }

  const clearProductMainImage = (): void => {
    setProductMainImageId('')
    setProductMainImagePreviewUrl('')
  }

  const validateCurrentCustomTemplate = async (): Promise<boolean> => {
    if (selectedTemplateCode !== CUSTOM_TEMPLATE_CODE) return true
    const baseForCustom = selectedCustomTemplate
      ? {
          meta: {
            code: `custom-${selectedCustomTemplate.id}`,
            label: selectedCustomTemplate.name,
            tags: selectedCustomTemplate.tags,
            enabled: selectedCustomTemplate.enabled
          },
          rules: {
            default_product_platform_id: String(
              selectedCustomTemplate.project_template?.related_product?.product_platform_id ?? ''
            ),
            supports_roi_goal: true,
            supports_cpa_bid: true,
            requires_product_id: Boolean(selectedCustomTemplate.project_template?.related_product),
            requires_playlet_url: true,
            requires_aweme_id: true,
            requires_video_materials: Boolean(selectedCustomTemplate.rules?.requires_video_materials ?? true),
            materials_split_mode: String(selectedCustomTemplate.rules?.materials_split_mode ?? 'by_count'),
            materials_per_unit_default: Number(selectedCustomTemplate.rules?.materials_per_unit_default ?? 10)
          },
          project_template: selectedCustomTemplate.project_template,
          unit_template: selectedCustomTemplate.promotion_template
        }
      : customBaseTemplateDetail
    const customPayload = buildCustomTemplatePayload(customTemplateForm, baseForCustom)
    setCustomTemplateValidating(true)
    try {
      const result = await oceanEngineBatchAdService.validateCustomAdTemplate({
        project_template: customPayload.project,
        promotion_template: customPayload.promotion
      })
      setCustomTemplateValidationErrors(result.errors)
      if (!result.valid) {
        toast.error(result.errors[0]?.message ?? '自定义模板参数校验未通过')
        return false
      }
      toast.success('自定义模板参数校验通过')
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '自定义模板参数校验失败')
      return false
    } finally {
      setCustomTemplateValidating(false)
    }
  }

  const saveCurrentCustomTemplate = async (mode: 'create' | 'update'): Promise<void> => {
    const baseForCustom = selectedCustomTemplate
      ? {
          meta: {
            code: `custom-${selectedCustomTemplate.id}`,
            label: selectedCustomTemplate.name,
            tags: selectedCustomTemplate.tags,
            enabled: selectedCustomTemplate.enabled
          },
          rules: {
            default_product_platform_id: String(
              selectedCustomTemplate.project_template?.related_product?.product_platform_id ?? ''
            ),
            supports_roi_goal: true,
            supports_cpa_bid: true,
            requires_product_id: Boolean(selectedCustomTemplate.project_template?.related_product),
            requires_playlet_url: true,
            requires_aweme_id: true,
            requires_video_materials: Boolean(selectedCustomTemplate.rules?.requires_video_materials ?? true),
            materials_split_mode: String(selectedCustomTemplate.rules?.materials_split_mode ?? 'by_count'),
            materials_per_unit_default: Number(selectedCustomTemplate.rules?.materials_per_unit_default ?? 10)
          },
          project_template: selectedCustomTemplate.project_template,
          unit_template: selectedCustomTemplate.promotion_template
        }
      : customBaseTemplateDetail
    const customPayload = buildCustomTemplatePayload(customTemplateForm, baseForCustom)
    const fallbackName = customTemplateForm.project.name.trim() || customTemplateForm.unit.name.trim()
    const inputName =
      mode === 'update' && selectedCustomTemplate
        ? selectedCustomTemplate.name
        : window.prompt('请输入模板名称', fallbackName || '我的自定义模板')
    const name = inputName?.trim()
    if (!name) return
    setCustomTemplateSaving(true)
    try {
      const payload = {
        name,
        description: selectedCustomTemplate?.description ?? '',
        tags: selectedCustomTemplate?.tags ?? [],
        project_template: customPayload.project,
        promotion_template: customPayload.promotion,
        rules: {
          materials_split_mode: 'by_count',
          materials_per_unit_default: customPayload.materialsPerUnit,
          requires_video_materials: true
        },
        enabled: true
      }
      const saved =
        mode === 'update' && selectedCustomTemplate
          ? await oceanEngineBatchAdService.updateCustomAdTemplate(selectedCustomTemplate.id, payload)
          : await oceanEngineBatchAdService.createCustomAdTemplate(payload)
      setSelectedCustomTemplate(saved)
      await refreshCustomTemplateOptions()
      toast.success(mode === 'update' ? '自定义模板已更新' : '自定义模板已保存')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存自定义模板失败')
    } finally {
      setCustomTemplateSaving(false)
    }
  }

  const deleteCurrentCustomTemplate = async (): Promise<void> => {
    if (!selectedCustomTemplate) return
    if (!window.confirm(`确认删除自定义模板「${selectedCustomTemplate.name}」？`)) return
    setCustomTemplateSaving(true)
    try {
      await oceanEngineBatchAdService.deleteCustomAdTemplate(selectedCustomTemplate.id)
      setSelectedCustomTemplate(null)
      await refreshCustomTemplateOptions()
      toast.success('自定义模板已删除')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除自定义模板失败')
    } finally {
      setCustomTemplateSaving(false)
    }
  }

  const handleManualSubmit = async (): Promise<void> => {
    const advertiserIds = parseAccountLines(accountIdsText)
    if (!manualPreflight.ok) {
      toast.error(manualPreflight.errors[0]?.message ?? '手动模式预检未通过')
      return
    }

    if (executeMode === 'scheduled' && resubmitTargetJobId == null) {
      const scheduleErr = validateScheduledDatetimeLocal(scheduledStartTime)
      if (scheduleErr) {
        toast.error(scheduleErr)
        return
      }
    }

    const scheduledAtIso =
      executeMode === 'scheduled' && resubmitTargetJobId == null
        ? datetimeLocalToNaiveIso(scheduledStartTime)
        : undefined

    const buildEnqueueBody = (
      payload: OceanEngineBatchCreateAdsRequest
    ): BatchCreateJobEnqueueRequest => ({
      payload,
      scheduled_at: scheduledAtIso
    })

    const notifyJobCreated = (
      jobId: number,
      meta: {
        advertiserCount: number
        promotionCount: number
        templateLabel: string
      }
    ): void => {
      if (scheduledAtIso) {
        toast.success(
          `任务 #${jobId} 已预约，将于 ${formatScheduledAtDisplay(scheduledAtIso)} 开始创建`
        )
      } else if (resubmitTargetJobId != null) {
        toast.success(`任务 #${jobId} 已重新提交`)
      } else {
        toast.success(`任务 #${jobId} 已入队`)
      }
      clearBatchAdEmbedDraft()
      setSuccessJobId(jobId)
      setSuccessJobMeta({ ...meta, scheduledAt: scheduledAtIso ?? null })
    }

    if (!selectedTemplateCode) {
      toast.error('请先选择投放模板')
      setActiveManualStep('setup')
      return
    }

    if (selectedTemplateCode === CUSTOM_TEMPLATE_CODE && !(await validateCurrentCustomTemplate())) {
      return
    }

    if (reusedSubmitBody) {
      const nextDramaName = effectiveDramaName.trim() || reusedSubmitBody.draft_drama_name
      const shouldUseCurrentVideos = nextDramaName !== copiedTaskDramaRef.current
      const currentWebProjectPayload =
        projectMode === 'web'
          ? parseWebProjectPayloadText() ?? reusedSubmitBody.draft_web_project_payload ?? null
          : null
      const body: OceanEngineBatchCreateAdsRequest = {
        ...reusedSubmitBody,
        org_advertiser_ids: selectedOrgId ? [selectedOrgId] : [],
        advertiser_ids: advertiserIds,
        project_path: reusedSubmitBody.project_path ?? 'v3.0/project/create',
        promotion_path: reusedSubmitBody.promotion_path ?? 'v3.0/promotion/create',
        selected_cookie_config_id: selectedCookieConfigId,
        draft_drama_name: nextDramaName,
        draft_selected_template_code: reusedSubmitBody.draft_selected_template_code ?? null,
        draft_custom_base_template_code: reusedSubmitBody.draft_custom_base_template_code ?? null,
        draft_project_mode: projectMode,
        draft_web_project_payload: currentWebProjectPayload,
        draft_web_project_name: projectMode === 'web' ? webProjectName.trim() || null : null,
        draft_video_advertiser_id:
          videoAdvertiserId.trim() || reusedSubmitBody.draft_video_advertiser_id,
        draft_video_distribution_mode: videoDistributionMode,
        draft_average_target_promotion_count_per_advertiser: averageTargetPromotionCount,
        draft_materials_per_unit: effectiveMaterialsPerUnit,
        draft_committed_videos: shouldUseCurrentVideos
          ? committedVideos
          : committedVideos.length > 0
            ? committedVideos
            : reusedSubmitBody.draft_committed_videos,
        draft_custom_title_enabled: customTitleEnabled,
        draft_custom_titles_text: customTitlesText,
        draft_custom_title_mode: customTitleMode
      }
      setSubmitting(true)
      batchJobPollAbortRef.current?.abort()
      batchJobPollAbortRef.current = new AbortController()
      const pollSignal = batchJobPollAbortRef.current.signal
      try {
        const { job_id } = resubmitTargetJobId != null
          ? await oceanEngineBatchAdService.resubmitBatchCreateJob(resubmitTargetJobId, body)
          : await oceanEngineBatchAdService.createBatchCreateJob(buildEnqueueBody(body))
        if (onManualJobEnqueued) {
          notifyJobCreated(job_id, {
            advertiserCount: advertiserIds.length,
            promotionCount: Array.isArray(body.promotions) ? body.promotions.length : 1,
            templateLabel:
              resubmitTargetJobId != null
                ? `编辑任务 #${resubmitTargetJobId}`
                : `复用任务 #${reuseSourceJobId ?? '?'}`
          })
          return
        }
        if (scheduledAtIso) {
          notifyJobCreated(job_id, {
            advertiserCount: advertiserIds.length,
            promotionCount: Array.isArray(body.promotions) ? body.promotions.length : 1,
            templateLabel:
              resubmitTargetJobId != null
                ? `编辑任务 #${resubmitTargetJobId}`
                : `复用任务 #${reuseSourceJobId ?? '?'}`
          })
          return
        }
        toast.info(`任务 #${job_id} 已入队，等待调度执行…`)
        const detail = await oceanEngineBatchAdService.pollBatchCreateJobUntilDone(job_id, {
          signal: pollSignal
        })
        if (detail.result) {
          setLatestResults(detail.result.account_results)
          const ok = detail.result.account_results.filter((item) => item.success).length
          if (detail.status === 'failed') {
            toast.error(
              detail.error_message ||
                `未成功：0/${detail.result.account_results.length} 个账户成功（见下方结果）`
            )
          } else if (detail.status === 'partial') {
            toast.success(
              `部分完成：${ok}/${detail.result.account_results.length} 个账户成功（见下方结果）`
            )
          } else {
            toast.success(`提交完成：${ok}/${detail.result.account_results.length} 个账户成功`)
          }
        } else if (detail.status === 'failed') {
          toast.error(detail.error_message || '任务失败')
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        toast.error(error instanceof Error ? error.message : '提交失败')
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (selectedTemplateCode !== CUSTOM_TEMPLATE_CODE && !selectedTemplateDetailMatchesSelection) {
      toast.error('模板详情尚未加载完成，请稍后再提交')
      return
    }

    const buildProjectAndPromotion = (): {
      project: Record<string, any>
      promotion: Record<string, any>
      materialCountPerUnit: number
      currentDramaName: string
    } => {
      const dateStr = formatBatchAdNamePlaceholderDate(new Date())
      const tplDisplay = getBatchAdTemplateDisplayLabel(
        selectedTemplateCode,
        customBaseTemplateCode,
        templateOptions
      )
      const randProject = randBatchAdNameSuffix4()
      const randUnit = randBatchAdNameSuffix4()

      if (selectedTemplateCode === CUSTOM_TEMPLATE_CODE) {
        const baseForCustom = selectedCustomTemplate
          ? {
              meta: {
                code: `custom-${selectedCustomTemplate.id}`,
                label: selectedCustomTemplate.name,
                tags: selectedCustomTemplate.tags,
                enabled: selectedCustomTemplate.enabled
              },
              rules: {
                default_product_platform_id: String(
                  selectedCustomTemplate.project_template?.related_product?.product_platform_id ?? ''
                ),
                supports_roi_goal: true,
                supports_cpa_bid: true,
                requires_product_id: Boolean(selectedCustomTemplate.project_template?.related_product),
                requires_playlet_url: true,
                requires_aweme_id: true,
                requires_video_materials: Boolean(
                  selectedCustomTemplate.rules?.requires_video_materials ?? true
                ),
                materials_split_mode: String(
                  selectedCustomTemplate.rules?.materials_split_mode ?? 'by_count'
                ),
                materials_per_unit_default: Number(
                  selectedCustomTemplate.rules?.materials_per_unit_default ?? 10
                )
              },
              project_template: selectedCustomTemplate.project_template,
              unit_template: selectedCustomTemplate.promotion_template
            }
          : customBaseTemplateDetail
        const customPayload = buildCustomTemplatePayload(customTemplateForm, baseForCustom)
        const project = structuredClone(customPayload.project) as Record<string, any>
        const promotion = structuredClone(customPayload.promotion) as Record<string, any>
        const currentDramaName = customPayload.dramaName
        const source = customTemplateForm.unit.source.trim() || '番茄'
        const dramaTrim = currentDramaName.trim()
        const pNm = String(project.name ?? '')
        const uNm = String(promotion.name ?? '')
        if (needsBatchAdNamePlaceholderExpand(pNm)) {
          project.name = expandBatchAdNamePlaceholders(pNm, {
            source,
            templateDisplay: tplDisplay,
            dramaName: dramaTrim,
            dateStr,
            randomPart: randProject
          })
        }
        if (needsBatchAdNamePlaceholderExpand(uNm)) {
          promotion.name = expandBatchAdNamePlaceholders(uNm, {
            source,
            templateDisplay: tplDisplay,
            dramaName: dramaTrim,
            dateStr,
            randomPart: randUnit
          })
        }
        if (productMainImageId.trim()) {
          const materials = (promotion.promotion_materials ?? {}) as Record<string, any>
          const productInfo = (materials.product_info ?? {}) as Record<string, any>
          const sellingPoints = parsePipeList(productSellingPoints)
          const actionButtons = parsePipeList(callToActionButtons)
          productInfo.image_ids = [productMainImageId.trim()]
          if (sellingPoints.length > 0) {
            productInfo.selling_points = sellingPoints
          }
          if (actionButtons.length > 0) {
            materials.call_to_action_buttons = actionButtons
          }
          materials.product_info = productInfo
          promotion.promotion_materials = materials
        }
        if (isAppMarketingObjective && promotion.promotion_materials?.product_info) {
          const productInfo = promotion.promotion_materials.product_info as Record<string, any>
          const currentTitle = normalizeProductInfoTitle(productInfo.titles?.[0])
          productInfo.titles = [currentTitle || webProjectAppProductTitle]
        }
        if (isAppMarketingObjective) {
          delete promotion.source
          delete promotion.promotion_materials?.playlet_series_url_list
        }
        return {
          project,
          promotion,
          materialCountPerUnit: customPayload.materialsPerUnit,
          currentDramaName
        }
      }

      const detail = selectedTemplateDetail!
      const project = structuredClone(detail.project_template) as Record<string, any>
      const promotion = structuredClone(detail.unit_template) as Record<string, any>
      const currentDramaName = dramaName.trim()

      project.name = projName.trim() || project.name
      if (project.delivery_setting) {
        if (projBudget.trim()) {
          const budget = parseInt(projBudget, 10)
          if (!Number.isNaN(budget)) {
            project.delivery_setting.budget = budget
          }
        }
        if (detail.rules.supports_roi_goal && roiCoeff.trim()) {
          const roi = parseFloat(roiCoeff)
          if (!Number.isNaN(roi)) {
            project.delivery_setting.roi_goal = roi
          }
        }
        if (detail.rules.supports_cpa_bid && projCpaBid.trim()) {
          const cpaBid = parseFloat(projCpaBid)
          if (!Number.isNaN(cpaBid)) {
            project.delivery_setting.cpa_bid = cpaBid
          }
        }
      }
      if (project.related_product) {
        project.related_product.product_platform_id =
          projProductPlatformId.trim() || project.related_product.product_platform_id
        project.related_product.product_id = projProductId.trim()
      }

      promotion.name = promoName.trim() || promotion.name
      promotion.source = promoSource.trim() || promotion.source || '番茄'
      if (promotion.native_setting) {
        promotion.native_setting.aweme_id = promoAwemeId.trim()
      }
      if (promotion.promotion_materials) {
        const sellingPoints = parsePipeList(productSellingPoints)
        const actionButtons = parsePipeList(callToActionButtons)
        promotion.promotion_materials.playlet_series_url_list = [promoPlayletUrl.trim()]
        if (actionButtons.length > 0) {
          promotion.promotion_materials.call_to_action_buttons = actionButtons
        }
        if (promotion.promotion_materials.product_info) {
          promotion.promotion_materials.product_info.titles = [currentDramaName]
          if (sellingPoints.length > 0) {
            promotion.promotion_materials.product_info.selling_points = sellingPoints
          }
          if (productMainImageId.trim()) {
            promotion.promotion_materials.product_info.image_ids = [productMainImageId.trim()]
          }
        }
      }

      const source = String(promotion.source || '番茄').trim() || '番茄'
      const pNm = String(project.name ?? '')
      const uNm = String(promotion.name ?? '')
      if (needsBatchAdNamePlaceholderExpand(pNm)) {
        project.name = expandBatchAdNamePlaceholders(pNm, {
          source,
          templateDisplay: tplDisplay,
          dramaName: currentDramaName,
          dateStr,
          randomPart: randProject
        })
      }
      if (needsBatchAdNamePlaceholderExpand(uNm)) {
        promotion.name = expandBatchAdNamePlaceholders(uNm, {
          source,
          templateDisplay: tplDisplay,
          dramaName: currentDramaName,
          dateStr,
          randomPart: randUnit
        })
      }
      if (isAppMarketingObjective) {
        delete promotion.source
        delete promotion.promotion_materials?.playlet_series_url_list
      }

      return {
        project,
        promotion,
        materialCountPerUnit: materialsPerUnit,
        currentDramaName
      }
    }

    const buildPromotionPayloadsFromChunks = (
      promotion: Record<string, any>,
      chunks: VideoMaterialItem[][],
      unitProjectName: string
    ): Record<string, unknown>[] => {
      const customTitles = customTitleEnabled ? parseTitleLines(customTitlesText) : []
      const useCustomTitles = customTitleEnabled && customTitles.length > 0
      const sharedCustomTitles =
        useCustomTitles &&
        (customTitles.length < TITLE_MATERIALS_PER_UNIT || customTitleMode === 'uniform')
          ? buildTitleMaterialList(customTitles, 'uniform')
          : null

      const effectiveChunks = chunks.length > 0 ? chunks : [[]]
      return effectiveChunks.map((chunk, idx) => {
        const promo = structuredClone(promotion)
        const rawPromoName = String(promo.name ?? '')
        if (needsCustomUnitNamePlaceholderExpand(rawPromoName)) {
          promo.name = expandCustomUnitNamePlaceholders(rawPromoName, {
            projectName: unitProjectName,
            dateStr: formatBatchAdDashedDate(new Date()),
            unitIndex: idx + 1
          })
        }
        if (promo.promotion_materials) {
          promo.promotion_materials.video_material_list = chunk.map((item) => {
            const coverId = item.video_cover_id || computeVideoCoverId(item.poster_url)
            return {
              image_mode: getImageMode(item),
              video_id: item.id,
              ...(coverId && coverId !== '/' ? { video_cover_id: coverId } : {})
            }
          })
          if (useCustomTitles) {
            promo.promotion_materials.title_material_list =
              sharedCustomTitles ?? buildTitleMaterialList(customTitles, customTitleMode)
          } else {
            promo.promotion_materials.title_material_list = pickRandom(dramaPool, 10).map(
              (title) => ({ title })
            )
          }
        }
        if (chunks.length > 1 && !needsCustomUnitNamePlaceholderExpand(rawPromoName)) {
          promo.name = appendOrReplaceUnitIndex(String(promo.name ?? ''), idx + 1)
        }
        return promo
      })
    }

    const buildPromotionPayloads = (
      promotion: Record<string, any>,
      videos: VideoMaterialItem[],
      materialCountPerUnit: number,
      targetPromotionCount: number | null,
      unitProjectName: string
    ): Record<string, unknown>[] => {
      if (videos.length === 0) {
        return buildPromotionPayloadsFromChunks(promotion, [], unitProjectName)
      }
      const chunks = buildCycledVideoChunksByUnit(videos, materialCountPerUnit, targetPromotionCount)
      return buildPromotionPayloadsFromChunks(promotion, chunks, unitProjectName)
    }

    const built = buildProjectAndPromotion()
    let project = built.project
    const unitProjectName =
      projectMode === 'web'
        ? webProjectName.trim() || String(built.project.name ?? '').trim()
        : projectMode === 'existing'
          ? selectedExistingProjectName || String(built.project.name ?? '').trim()
          : String(built.project.name ?? '').trim()
    if (projectMode === 'existing' || projectMode === 'web') {
      project = {}
    }
    const { promotion, materialCountPerUnit } = built
    const promotions = buildPromotionPayloads(
      promotion,
      committedVideos,
      materialCountPerUnit,
      null,
      unitProjectName
    )
    const webProjectPayloadForDraft = projectMode === 'web' ? parseWebProjectPayloadText() : null
    if (projectMode === 'web' && !webProjectPayloadForDraft) {
      toast.error('项目数据包不是有效 JSON 对象')
      return
    }
    const unitChunksByAdvertiser =
      videoDistributionMode === 'average'
        ? buildTargetUnitChunksByAccount(
            committedVideos,
            advertiserIds.length,
            materialCountPerUnit,
            averageTargetPromotionCount
          )
        : null
    const promotionsByAdvertiser =
      videoDistributionMode === 'average'
        ? Object.fromEntries(
            unitChunksByAdvertiser.map((chunks, index) => [
              advertiserIds[index],
              chunks.length > 0
                ? buildPromotionPayloadsFromChunks(promotion, chunks, unitProjectName)
                : []
            ])
          )
        : undefined

    setSubmitting(true)
    batchJobPollAbortRef.current?.abort()
    batchJobPollAbortRef.current = new AbortController()
    const pollSignal = batchJobPollAbortRef.current.signal
    try {
      const jobPayload: OceanEngineBatchCreateAdsRequest = {
        org_advertiser_ids: selectedOrgId ? [selectedOrgId] : [],
        advertiser_ids: advertiserIds,
        project,
        promotions,
        project_path: 'v3.0/project/create',
        promotion_path: 'v3.0/promotion/create',
        selected_cookie_config_id: selectedCookieConfigId,
        draft_drama_name: built.currentDramaName,
        draft_selected_template_code: selectedTemplateCode,
        draft_project_mode: projectMode,
        draft_web_project_payload: webProjectPayloadForDraft,
        draft_web_project_name: projectMode === 'web' ? webProjectName.trim() || null : null,
        draft_custom_base_template_code:
          selectedTemplateCode === CUSTOM_TEMPLATE_CODE && !selectedCustomTemplate
            ? customBaseTemplateCode || null
            : null,
        draft_custom_template_id:
          selectedTemplateCode === CUSTOM_TEMPLATE_CODE ? selectedCustomTemplate?.id ?? null : null,
        draft_video_advertiser_id: videoAdvertiserId.trim() || null,
        draft_video_distribution_mode: videoDistributionMode,
        draft_average_target_promotion_count_per_advertiser: averageTargetPromotionCount,
        draft_materials_per_unit: materialCountPerUnit,
        draft_committed_videos: committedVideos,
        draft_custom_title_enabled: customTitleEnabled,
        draft_custom_titles_text: customTitlesText,
        draft_custom_title_mode: customTitleMode
      }
      if (promotionsByAdvertiser) {
        jobPayload.promotions_by_advertiser = promotionsByAdvertiser
      }
      if (projectMode === 'existing' || projectMode === 'web') {
        jobPayload.advertiser_project_ids = Object.fromEntries(selectedProjectIdByAccount)
      }
      const { job_id } = resubmitTargetJobId != null
        ? await oceanEngineBatchAdService.resubmitBatchCreateJob(resubmitTargetJobId, jobPayload)
        : await oceanEngineBatchAdService.createBatchCreateJob(buildEnqueueBody(jobPayload))
      if (onManualJobEnqueued) {
        notifyJobCreated(job_id, {
          advertiserCount: advertiserIds.length,
          promotionCount: expectedPromotionCount,
          templateLabel:
            resubmitTargetJobId != null
              ? `编辑任务 #${resubmitTargetJobId}`
              : selectedTemplateLabel
        })
        return
      }
      if (scheduledAtIso) {
        notifyJobCreated(job_id, {
          advertiserCount: advertiserIds.length,
          promotionCount: expectedPromotionCount,
          templateLabel:
            resubmitTargetJobId != null
              ? `编辑任务 #${resubmitTargetJobId}`
              : selectedTemplateLabel
        })
        return
      }
      toast.info(`任务 #${job_id} 已入队，等待调度执行…`)
      const detail = await oceanEngineBatchAdService.pollBatchCreateJobUntilDone(job_id, {
        signal: pollSignal
      })
      if (detail.result) {
        setLatestResults(detail.result.account_results)
        const ok = detail.result.account_results.filter((item) => item.success).length
        if (detail.status === 'failed') {
          toast.error(
            detail.error_message ||
              `未成功：0/${detail.result.account_results.length} 个账户成功（见下方结果）`
          )
        } else if (detail.status === 'partial') {
          toast.success(
            `部分完成：${ok}/${detail.result.account_results.length} 个账户成功（见下方结果）`
          )
        } else {
          toast.success(`提交完成：${ok}/${detail.result.account_results.length} 个账户成功`)
        }
      } else if (detail.status === 'failed') {
        toast.error(detail.error_message || '任务失败')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      toast.error(error instanceof Error ? error.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  /** 子面板：OAuth 选择 */
  const renderOauthRadio = (): React.ReactNode => (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>OAuth 授权组织账户</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">用于 Open API 调用</p>
        </div>
        <span
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-semibold',
            selectedOrgId
              ? 'border-emerald-700 bg-emerald-700 text-white'
              : 'border-amber-700 bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
          )}
        >
          {selectedOrgId ? '已选择' : '必填'}
        </span>
      </div>
      {loadingTokens ? (
        <div className="flex gap-2 items-center text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          加载中…
        </div>
      ) : (
        <RadioGroup
          value={selectedOrgId ?? ''}
          onValueChange={(v) => setSelectedOrgId(v || null)}
          className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"
        >
          {uniqueOrgTokens.map((item) => {
            const id = `org-radio-${item.advertiser_id}`
            return (
              <label
                key={item.advertiser_id}
                htmlFor={id}
                className={cn(
                  'flex gap-2 items-center rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer',
                  selectedOrgId === item.advertiser_id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                    : 'hover:bg-muted/50'
                )}
              >
                <RadioGroupItem value={item.advertiser_id} id={id} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{item.advertiser_name}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    组织 ID：{item.advertiser_id}
                  </div>
                </div>
              </label>
            )
          })}
        </RadioGroup>
      )}
    </div>
  )

  /** 子面板：Cookie 选择 */
  const renderCookieRadio = (): React.ReactNode => (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>Cookie 账号</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">用于后台项目查询和多 Cookie 调度</p>
        </div>
        <span
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-semibold',
            selectedCookieConfigId != null
              ? 'border-emerald-700 bg-emerald-700 text-white'
              : 'border-amber-700 bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
          )}
        >
          {selectedCookieConfigId != null ? '已选择' : '必填'}
        </span>
      </div>
      <RadioGroup
        value={selectedCookieConfigId == null ? '' : String(selectedCookieConfigId)}
        onValueChange={(v) => setSelectedCookieConfigId(v ? parseInt(v, 10) : null)}
        className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"
      >
        {cookieConfigs.map((config) => {
          const id = `cookie-config-radio-${config.id}`
          const active = selectedCookieConfigId === config.id
          return (
            <label
              key={config.id}
              htmlFor={id}
              className={cn(
                'flex gap-2 items-center rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer',
                active ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'hover:bg-muted/50'
              )}
            >
              <RadioGroupItem value={String(config.id)} id={id} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{config.cookie_name}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {config.realname ? `用户名：${config.realname}` : `配置 ID：${config.id}`}
                </div>
              </div>
            </label>
          )
        })}
      </RadioGroup>
      {cookieConfigs.length === 0 && (
        <div className="rounded-xl border border-dashed border-amber-400 bg-amber-100/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
          暂无 Cookie 账号配置，请先在配置页添加巨量引擎账号 Cookie。
        </div>
      )}
    </div>
  )

  /** 子面板：入口模式 Tabs */
  const renderInputModeTabs = (): React.ReactNode => (
    <div className="grid gap-2 md:grid-cols-3">
      {(
        [
          {
            key: 'manual' as InputMode,
            label: '手动配置',
            desc: '适合少量账户逐项确认',
            icon: Layers3
          },
          {
            key: 'excel' as InputMode,
            label: 'Excel 导入',
            desc: '适合批量表格一次导入',
            icon: FileSpreadsheet
          },
          {
            key: 'bitable' as InputMode,
            label: '飞书 Bitable',
            desc: '适合多人协同填写预检',
            icon: ClipboardCheck
          }
        ] as const
      ).map((item) => {
        const Icon = item.icon
        const active = inputMode === item.key
        const disabled = reusedSubmitBody != null && item.key !== 'manual'
        return (
          <button
            key={item.key}
            type="button"
            disabled={disabled}
            className={cn(
              'flex min-h-[64px] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
              active
                ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                : 'border-border/70 hover:bg-muted/50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => setInputMode(item.key)}
          >
            <Icon
              className={cn('h-5 w-5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{item.desc}</span>
            </span>
          </button>
        )
      })}
    </div>
  )

  /** 顶部 Stepper */
  const renderStepper = (): React.ReactNode => (
    <Card className="border-border/70 bg-card/95">
      <CardContent className="px-4 py-3">
        <ol className="grid gap-1 rounded-xl border border-border/70 bg-muted/25 p-1 md:grid-cols-3 xl:grid-cols-6">
          {manualSteps.map((step, idx) => {
            const isCurrent = step.key === activeManualStep
            const reachable = step.key === 'setup' || step.done || canLeaveManualAccountStep
            return (
              <li key={step.key} className="min-w-0">
                <button
                  type="button"
                  disabled={!reachable && !isCurrent}
                  onClick={() => goToStep(step.key)}
                  className={cn(
                    'flex h-full min-h-[56px] w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-[background-color,box-shadow,color]',
                    isCurrent
                      ? 'bg-foreground text-background shadow-sm'
                      : step.done
                        ? 'bg-background text-foreground shadow-sm hover:bg-background'
                        : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                    !reachable && !isCurrent && 'cursor-not-allowed opacity-55'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                      isCurrent
                        ? 'border-background bg-background text-foreground'
                        : step.done
                          ? 'border-emerald-700 bg-emerald-700 text-white'
                          : 'border-border bg-muted/40 text-muted-foreground'
                    )}
                  >
                    {step.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span
                      className={cn(
                        'block text-[10px] font-semibold uppercase',
                        isCurrent ? 'text-background/80' : 'text-muted-foreground'
                      )}
                    >
                      Step {idx + 1}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-semibold">
                      {step.title}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          {manualSteps[Math.max(0, stepIndex)]?.description ?? ''}
        </p>
      </CardContent>
    </Card>
  )

  /** Inspector：右侧配置摘要与预检 */
  const renderInspector = (): React.ReactNode => (
    <aside className="space-y-3 xl:sticky xl:top-2 xl:self-start">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            配置摘要
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">OAuth</span>
            <span
              className={cn(
                'font-medium truncate max-w-[180px]',
                selectedOrgId ? 'text-foreground' : 'text-amber-700 dark:text-amber-400'
              )}
              title={selectedOrgId ?? ''}
            >
              {selectedOrgId
                ? uniqueOrgTokens.find((t) => t.advertiser_id === selectedOrgId)?.advertiser_name ||
                  selectedOrgId
                : '未选择'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Cookie</span>
            <span
              className={cn(
                'font-medium truncate max-w-[180px]',
                selectedCookieConfigId != null
                  ? 'text-foreground'
                  : 'text-amber-700 dark:text-amber-400'
              )}
            >
              {selectedCookieConfigId != null
                ? cookieConfigs.find((c) => c.id === selectedCookieConfigId)?.cookie_name ||
                  `#${selectedCookieConfigId}`
                : '未选择'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">模板</span>
            <span className="font-medium truncate max-w-[180px]" title={selectedTemplateLabel}>
              {selectedTemplateLabel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">创建方式</span>
            <span className="font-medium">{currentInputModeLabel}</span>
          </div>
          <div className="border-t border-border/50 pt-2 flex items-center justify-between">
            <span className="text-muted-foreground">广告主账户</span>
            <span className="font-medium tabular-nums">{manualAdvertiserIds.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">视频素材</span>
            <span className="font-medium tabular-nums">{committedVideos.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">预计单元数</span>
            <span className="font-medium tabular-nums">{expectedPromotionCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">产品主图</span>
            <span
              className={cn(
                'font-medium',
                productMainImageReady
                  ? 'text-emerald-800 dark:text-emerald-300'
                  : 'text-amber-800 dark:text-amber-200'
              )}
            >
              {productMainImageReady ? '已上传' : '未上传'}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {manualPreflight.ok ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-200" />
            )}
            预检
            <span
              className={cn(
                'ml-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                manualPreflight.ok
                  ? 'border-emerald-700 bg-emerald-700 text-white'
                  : 'border-amber-700 bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
              )}
            >
              {manualPreflight.ok ? '通过' : `${manualPreflight.errors.length} 项`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs">
          {manualPreflight.ok ? (
            <p className="text-muted-foreground">全部必填项已完成，可进入提交。</p>
          ) : (
            <ul className="space-y-1">
              {manualPreflight.errors.map((err, i) => (
                <li key={`${err.message}-${i}`}>
                  <button
                    type="button"
                    onClick={() => goToStep(err.stepKey)}
                    className="group w-full text-left flex items-start gap-2 rounded-md px-2 py-1 hover:bg-muted/60"
                  >
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <span className="flex-1 leading-snug">{err.message}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 mt-0.5 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </aside>
  )

  /** 提交成功后的结果屏 */
  const renderSuccessScreen = (): React.ReactNode => (
    <Card className="overflow-hidden">
      <CardHeader className="text-center pb-3">
        <div className="mx-auto mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-white dark:bg-emerald-400 dark:text-emerald-950">
          <PartyPopper className="h-7 w-7" />
        </div>
        <CardTitle className="text-xl">
          任务 #{successJobId}{' '}
          {successJobMeta?.scheduledAt
            ? '已预约'
            : resubmitTargetJobId != null
              ? '已重新提交'
              : '已入队'}
        </CardTitle>
        <CardDescription>
          {successJobMeta?.scheduledAt
            ? `将于 ${formatScheduledAtDisplay(successJobMeta.scheduledAt)} 开始创建（北京时间）。调度进程到点后会自动执行，可在任务列表查看进度。`
            : '后台调度进程会按队列顺序执行项目与单元创建，可在列表中实时查看进度。'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {successJobMeta && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border bg-muted/30 p-3 text-center">
              <div className="text-xs text-muted-foreground">广告主账户</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {successJobMeta.advertiserCount}
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3 text-center">
              <div className="text-xs text-muted-foreground">预计单元</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {successJobMeta.promotionCount}
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3 text-center">
              <div className="text-xs text-muted-foreground">模板来源</div>
              <div
                className="mt-1 text-sm font-medium truncate"
                title={successJobMeta.templateLabel}
              >
                {successJobMeta.templateLabel}
              </div>
            </div>
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          <Button
            type="button"
            onClick={() => {
              if (successJobId != null) onManualJobEnqueued?.(successJobId)
            }}
          >
            <Eye className="h-4 w-4 mr-1" />
            查看任务详情
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSuccessJobId(null)
              setSuccessJobMeta(null)
              resetWorkbenchToInitialConfig()
            }}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            再创建一条
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSuccessJobId(null)
              setSuccessJobMeta(null)
              setActiveManualStep('setup')
            }}
          >
            <CopyIcon className="h-4 w-4 mr-1" />
            复制为新任务
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {!embedMode ? (
        <motion.section
          className="relative overflow-hidden rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.58)] sm:p-8"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_58%)]" />
          <div className="relative flex flex-col gap-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Ocean Engine Batch Creation Workbench
            </div>
            <div className="flex gap-3 items-start">
              <div className="p-3 rounded-2xl border border-border/70 bg-background/70">
                <Megaphone className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  广告批量创建工作台
                </h1>
                <p className="mt-2 text-sm leading-7 text-muted-foreground sm:text-base">
                  按阶段完成：准备 → 账户 → 项目 → 单元 → 素材 → 提交；Excel / Bitable
                  选项仅保留准备与执行两步。
                </p>
              </div>
            </div>
          </div>
        </motion.section>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
          <span>
            按步骤完成提交：<strong className="text-foreground">手动</strong>
            提交后进入任务队列，
            <strong className="text-foreground">Excel / Bitable</strong>
            为同步执行。
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => resetWorkbenchToInitialConfig()}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            重置配置
          </Button>
        </div>
      )}

      {reusedSubmitBody && successJobId == null && (
        <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <RotateCcw className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {resubmitTargetJobId != null ? '编辑暂停任务' : '复用任务'}
                  {reuseSourceJobId != null ? (
                    <span className="font-mono"> #{reuseSourceJobId}</span>
                  ) : null}
                  {resubmitTargetJobId != null ? ' · 原任务重新提交' : ' · 重新提交'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {resubmitTargetJobId != null
                    ? '将更新当前任务的项目与单元配置，提交后本任务重新进入排队中。'
                    : '将沿用历史快照的项目与单元配置；修改漫剧名称后，项目名称和单元名称会按初始格式重新生成。'}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={clearReusedSubmit}
            >
              切换为自定义编辑
            </Button>
          </div>
          <div className="grid gap-2 rounded-xl border bg-background/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="reuse-drama-name" className="text-xs">
                漫剧名称
              </Label>
              <Input
                id="reuse-drama-name"
                value={dramaName}
                onChange={(e) => handleDramaNameChange(e.target.value)}
                placeholder="修改后自动按新剧名重拉视频素材"
              />
              <p className="text-[11px] leading-4 text-muted-foreground">
                复制任务时修改漫剧名称，会清空当前视频素材，并按新剧名重新生成项目名称、单元名称与素材。
              </p>
            </div>
            {videoLoading ? (
              <span className="inline-flex items-center text-xs text-muted-foreground">
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                正在拉取素材…
              </span>
            ) : null}
          </div>
        </div>
      )}

      {successJobId != null ? (
        renderSuccessScreen()
      ) : (
        <>
          {renderStepper()}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0 space-y-4">
              {activeManualStep === 'setup' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Step 1 · 准备：授权 · 模板 </CardTitle>
                    <CardDescription>
                      选择 OAuth 授权组织与 Cookie 账号，再确定使用的投放模板。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-4 lg:grid-cols-2">
                      {renderOauthRadio()}
                      {renderCookieRadio()}
                    </div>
                    <div className="space-y-2 border-t border-border/60 pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <Label>投放模板</Label>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            模板列表来自后端模板中心
                          </p>
                        </div>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                          {selectedTemplateLabel}
                        </span>
                      </div>
                      <TemplateSelectorCard
                        items={templateCards}
                        selectedCode={
                          selectedCustomTemplate ? `custom:${selectedCustomTemplate.id}` : selectedTemplateCode
                        }
                        onSelect={handleTemplateSelect}
                        compact
                      />
                      {selectedTemplateCode === CUSTOM_TEMPLATE_CODE ? (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                          自定义模板可保存为用户私有模板；已保存模板会直接复用完整参数，不再依赖系统模板继承。
                        </div>
                      ) : (
                        selectedTemplate && (
                          <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                            默认商品平台 ID：{selectedTemplate.rules.default_product_platform_id}
                            {' · '}
                            {selectedTemplate.rules.supports_roi_goal
                              ? '支持 ROI 系数'
                              : '不支持 ROI 系数'}
                          </div>
                        )
                      )}
                    </div>
                    {/* {!reusedSubmitBody && (
                      <div className="space-y-2 border-t border-border/60 pt-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <Label>创建方式</Label>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              手动适合精细配置；Excel / Bitable 适合批量导入。
                            </p>
                          </div>
                        </div>
                        {renderInputModeTabs()}
                      </div>
                    )} */}
                  </CardContent>
                </Card>
              )}

              {activeManualStep === 'accounts' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Step 2 · 广告主账户</CardTitle>
                    <CardDescription>
                      每行一个广告主 ID，提交时会自动去重；当前已识别{' '}
                      <strong className="text-foreground">{manualAdvertiserIds.length}</strong> 个。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="manual-account-ids">广告主账户 ID</Label>
                      <Textarea
                        id="manual-account-ids"
                        className="font-mono text-sm min-h-[180px]"
                        value={accountIdsText}
                        onChange={(e) => setAccountIdsText(e.target.value)}
                        placeholder={'例如：\n1234567890\n0987654321'}
                        spellCheck={false}
                      />
                      {manualAdvertiserIds.length === 0 ? (
                        <p className="text-xs text-amber-900 dark:text-amber-400">
                          请先填写至少一个广告主账户 ID。
                        </p>
                      ) : selectedOrgId == null || selectedCookieConfigId == null ? (
                        <p className="text-xs text-amber-900 dark:text-amber-400">
                          请先在「准备」中完成 OAuth 与 Cookie 选择。
                        </p>
                      ) : (
                        <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                          已识别 {manualAdvertiserIds.length} 个广告主账户。
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeManualStep === 'project' && reusedSubmitBody && (
                <Card>
                  <CardHeader>
                    <CardTitle>Step 3 · 项目配置</CardTitle>
                    <CardDescription>
                      复用模式会沿用历史任务快照中的项目创建参数或已有项目映射。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border bg-muted/30 p-3">
                        <div className="text-xs text-muted-foreground">项目创建方式</div>
                        <div className="mt-1 font-medium">
                          {reusedSubmitBody.draft_project_mode === 'web'
                            ? '网页新建快照'
                            : reusedSubmitBody.advertiser_project_ids
                              ? '复用已有项目映射'
                              : '新建项目快照'}
                        </div>
                      </div>
                      <div className="rounded-xl border bg-muted/30 p-3">
                        <div className="text-xs text-muted-foreground">漫剧名称</div>
                        <div className="mt-1 font-medium break-words">
                          {inferDramaNameFromBatchRequest(reusedSubmitBody) || '—'}
                        </div>
                      </div>
                      <div className="rounded-xl border bg-muted/30 p-3 sm:col-span-2">
                        <div className="text-xs text-muted-foreground">项目接口</div>
                        <div className="mt-1 font-mono text-xs">
                          {reusedSubmitBody.project_path ?? 'v3.0/project/create'}
                        </div>
                      </div>
                      {reusedSubmitBody.draft_project_mode === 'web' && (
                        <div className="rounded-xl border bg-muted/30 p-3 sm:col-span-2">
                          <div className="text-xs text-muted-foreground">网页项目名称</div>
                          <div className="mt-1 text-xs text-foreground break-words">
                            {reusedSubmitBody.draft_web_project_name || '未记录'}
                          </div>
                        </div>
                      )}
                      {reusedSubmitBody.draft_project_mode === 'web' && (
                        <div className="rounded-xl border bg-muted/30 p-3 sm:col-span-2">
                          <div className="text-xs text-muted-foreground">网页新建项目数据包</div>
                          <div className="mt-1 font-mono text-xs text-foreground">
                            {reusedSubmitBody.draft_web_project_payload ? '已保留' : '未记录'}
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      复制模式下，参数来自原任务快照；若已修改漫剧名称，项目名称会按初始格式重新生成。
                    </p>
                  </CardContent>
                </Card>
              )}

              {activeManualStep === 'project' && !reusedSubmitBody && (
                <Card>
                  <CardHeader>
                    <CardTitle>Step 3 · 项目配置</CardTitle>
                    <CardDescription>
                      选择新建项目或复用已有项目。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedTemplateCode && selectedTemplateCode !== CUSTOM_TEMPLATE_CODE && (
                      <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
                        <div className="space-y-2">
                          <Label htmlFor="manual-drama-name" className="text-xs">
                            漫剧名称
                          </Label>
                          <Input
                            id="manual-drama-name"
                            value={dramaName}
                            onChange={(e) => handleDramaNameChange(e.target.value)}
                            placeholder="输入漫剧名称"
                          />
                          <p className="text-[11px] leading-4 text-muted-foreground">
                            用作商品 ID 查询与「已有项目」按剧名搜索的关键字。
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="manual-promo-source" className="text-xs">
                            来源
                          </Label>
                          <Input
                            id="manual-promo-source"
                            value={promoSource}
                            onChange={(e) => setPromoSource(e.target.value)}
                            placeholder="默认使用模板 source 字段"
                          />
                          <p className="text-[11px] leading-4 text-muted-foreground">
                            对应 promotion.source，用于创建广告与名称占位符中的「来源」。
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedTemplateCode === CUSTOM_TEMPLATE_CODE ? (
                      <div className="space-y-4">
                        <div className="rounded-2xl border bg-muted/30 p-4 space-y-3">
                          <div className="space-y-2">
                            <Label className="text-xs">项目来源</Label>
                            <RadioGroup
                              className="grid gap-2 md:grid-cols-2"
                              value={projectMode === 'new' ? 'web' : projectMode}
                              onValueChange={(v) => handleProjectModeChange(v as ProjectMode)}
                            >
                              <label
                                htmlFor="ct-pm-ex"
                                className={cn(
                                  'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors',
                                  projectMode === 'existing'
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                                    : 'hover:bg-background/80'
                                )}
                              >
                                <RadioGroupItem value="existing" id="ct-pm-ex" className="mt-0.5" />
                                <span>
                                  <span className="block text-sm font-medium">已有项目</span>
                                  <span className="mt-0.5 block text-xs text-muted-foreground">
                                    按剧名拉取后为每个广告主选择项目
                                  </span>
                                </span>
                              </label>
                              <label
                                htmlFor="ct-pm-web"
                                className={cn(
                                  'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors',
                                  projectMode === 'web'
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                                    : 'hover:bg-background/80'
                                )}
                              >
                                <RadioGroupItem value="web" id="ct-pm-web" className="mt-0.5" />
                                <span>
                                  <span className="block text-sm font-medium">网页新建</span>
                                  <span className="mt-0.5 block text-xs text-muted-foreground">
                                    使用网页捕获的数据包创建项目并回填 project_id
                                  </span>
                                </span>
                              </label>
                            </RadioGroup>
                          </div>
                          {projectMode === 'existing' && renderExistingProjectPanel()}
                          {projectMode === 'web' && renderWebProjectPanel()}
                        </div>
                        <CustomTemplateConfigurator
                          templateOptions={templateOptions}
                          baseTemplateCode={customBaseTemplateCode}
                          onBaseTemplateCodeChange={(value) => {
                            initializedCustomBaseRef.current = ''
                            setCustomBaseTemplateCode(value)
                          }}
                          baseTemplateDetail={customBaseTemplateDetail}
                          value={customTemplateForm}
                          onChange={handleCustomTemplateDramaNameChange}
                          productSearching={productSearching}
                          committedVideosCount={committedVideos.length}
                          onOpenVideoSelector={() => setActiveManualStep('material')}
                          sectionScope="project"
                          projectConfigMode="web"
                          awemeOptions={awemeOptions}
                          awemeLoading={awemeLoading}
                          awemeSourceAdvertiserId={awemeSourceAdvertiserId}
                          onRefreshAwemeOptions={() => void refreshAwemeOptions()}
                          selectedCustomTemplate={selectedCustomTemplate}
                          onSelectCustomTemplate={setSelectedCustomTemplate}
                          onCreateNewCustomTemplate={() => {
                            setSelectedCustomTemplate(null)
                            if (customBaseTemplateCode) initializedCustomBaseRef.current = ''
                          }}
                          customTemplateOptions={customTemplateOptions}
                          onSaveCustomTemplate={(mode) => void saveCurrentCustomTemplate(mode)}
                          onDeleteCustomTemplate={() => void deleteCurrentCustomTemplate()}
                          onValidateCustomTemplate={() => void validateCurrentCustomTemplate()}
                          customTemplateSaving={customTemplateSaving}
                          customTemplateValidating={customTemplateValidating}
                          validationErrors={customTemplateValidationErrors}
                          productPlatformLibraries={productPlatformLibraries}
                          productPlatformLibrariesLoading={productPlatformLibrariesLoading}
                          showMissingProductPlatformOption={showMissingProductPlatformOption}
                        />
                      </div>
                    ) : (
                      <QuickConfigCard
                        templateType={selectedTemplateCode}
                        dramaName={dramaName}
                        onDramaNameChange={handleDramaNameChange}
                        promoAwemeId={promoAwemeId}
                        onPromoAwemeIdChange={handleAwemeIdChange}
                        promoPlayletUrl={promoPlayletUrl}
                        onPromoPlayletUrlChange={setPromoPlayletUrl}
                        roiCoeff={roiCoeff}
                        onRoiCoeffChange={setRoiCoeff}
                        supportsRoiGoal={Boolean(selectedTemplate?.rules.supports_roi_goal)}
                        cpaBid={projCpaBid}
                        onCpaBidChange={setProjCpaBid}
                        supportsCpaBid={Boolean(selectedTemplate?.rules.supports_cpa_bid)}
                        committedVideosCount={committedVideos.length}
                        materialsPerUnit={materialsPerUnit}
                        onOpenVideoSelector={() => setActiveManualStep('material')}
                        projName={projName}
                        onProjNameChange={setProjName}
                        projBudget={projBudget}
                        onProjBudgetChange={updateProjBudget}
                        projProductPlatformId={projProductPlatformId}
                        onProjProductPlatformIdChange={updateProjProductPlatformId}
                        projProductId={projProductId}
                        onProjProductIdChange={updateProjProductId}
                        productSearching={productSearching}
                        promoName={promoName}
                        onPromoNameChange={setPromoName}
                        onMaterialsPerUnitChange={(value) => {
                          const next = parseInt(value, 10)
                          if (!Number.isNaN(next) && next >= 1 && next <= 30) {
                            setMaterialsPerUnit(next)
                          }
                        }}
                        projectMode={projectMode}
                        onProjectModeChange={handleProjectModeChange}
                        existingProjectBlock={
                          projectMode === 'existing' ? renderExistingProjectPanel() : undefined
                        }
                        webProjectBlock={projectMode === 'web' ? renderWebProjectPanel() : undefined}
                        sections={['project']}
                        namePlaceholderTemplate={BATCH_AD_NAME_PLACEHOLDER_TEMPLATE}
                        awemeOptions={awemeOptions}
                        awemeLoading={awemeLoading}
                        awemeSourceAdvertiserId={awemeSourceAdvertiserId}
                        onRefreshAwemeOptions={() => void refreshAwemeOptions()}
                        productPlatformLibraries={productPlatformLibraries}
                        productPlatformLibrariesLoading={productPlatformLibrariesLoading}
                        showMissingProductPlatformOption={showMissingProductPlatformOption}
                      />
                    )}
                  </CardContent>
                </Card>
              )}

              {activeManualStep === 'unit' && reusedSubmitBody && (
                <Card>
                  <CardHeader>
                    <CardTitle>Step 4 · 单元配置</CardTitle>
                    <CardDescription>复用历史任务快照中的广告单元配置。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border bg-muted/30 p-3">
                        <div className="text-xs text-muted-foreground">广告单元数量</div>
                        <div className="mt-1 font-semibold tabular-nums">
                          {Object.values(reusedSubmitBody.promotions_by_advertiser ?? {}).reduce(
                            (total, list) => total + (Array.isArray(list) ? list.length : 0),
                            0
                          ) || reusedSubmitBody.promotions.length}
                        </div>
                      </div>
                      <div className="rounded-xl border bg-muted/30 p-3">
                        <div className="text-xs text-muted-foreground">首个单元名称</div>
                        <div className="mt-1 font-medium break-words">
                          {pickString(firstPromotionFromBatchRequest(reusedSubmitBody)?.name) ||
                            '—'}
                        </div>
                      </div>
                      <div className="rounded-xl border bg-muted/30 p-3 sm:col-span-2">
                        <div className="text-xs text-muted-foreground">单元接口</div>
                        <div className="mt-1 font-mono text-xs">
                          {reusedSubmitBody.promotion_path ?? 'v3.0/promotion/create'}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      单元名称会在修改漫剧名称后按初始格式重新生成；投放身份与素材参数仍按原快照提交。
                    </p>
                  </CardContent>
                </Card>
              )}

              {activeManualStep === 'unit' && !reusedSubmitBody && (
                <Card>
                  <CardHeader>
                    <CardTitle>Step 4 · 单元配置</CardTitle>
                    <CardDescription>
                      完成单元名称、投放身份与产品素材信息；下一步单独选择视频素材。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedTemplateCode === CUSTOM_TEMPLATE_CODE ? (
                      <>
                      <CustomTemplateConfigurator
                        templateOptions={templateOptions}
                        baseTemplateCode={customBaseTemplateCode}
                        onBaseTemplateCodeChange={(value) => {
                          initializedCustomBaseRef.current = ''
                          setCustomBaseTemplateCode(value)
                        }}
                        baseTemplateDetail={customBaseTemplateDetail}
                        value={customTemplateForm}
                        onChange={handleCustomTemplateDramaNameChange}
                        productSearching={productSearching}
                        committedVideosCount={committedVideos.length}
                        onOpenVideoSelector={() => setActiveManualStep('material')}
                        sectionScope="unit"
                        projectConfigMode="web"
                        hidePlayletPromotionFields={isAppMarketingObjective}
                        hideProductNameField
                        awemeOptions={awemeOptions}
                        awemeLoading={awemeLoading}
                        awemeSourceAdvertiserId={awemeSourceAdvertiserId}
                        onRefreshAwemeOptions={() => void refreshAwemeOptions()}
                        selectedCustomTemplate={selectedCustomTemplate}
                        onSelectCustomTemplate={setSelectedCustomTemplate}
                        onCreateNewCustomTemplate={() => {
                          setSelectedCustomTemplate(null)
                          if (customBaseTemplateCode) initializedCustomBaseRef.current = ''
                        }}
                        customTemplateOptions={customTemplateOptions}
                        onSaveCustomTemplate={(mode) => void saveCurrentCustomTemplate(mode)}
                        onDeleteCustomTemplate={() => void deleteCurrentCustomTemplate()}
                        onValidateCustomTemplate={() => void validateCurrentCustomTemplate()}
                        customTemplateSaving={customTemplateSaving}
                        customTemplateValidating={customTemplateValidating}
                        validationErrors={customTemplateValidationErrors}
                      />
                      <div className="grid grid-cols-1 gap-3 rounded-2xl border bg-muted/30 p-4 md:grid-cols-2">
                        <div className="space-y-1 md:col-span-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label htmlFor="batch-ad-custom-unit-name" className="text-xs">
                              单元名称
                            </Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                lastAutoCustomUnitNameRef.current = customTemplateDefaultUnitName
                                handleCustomTemplateFormChange({
                                  ...customTemplateForm,
                                  unit: {
                                    ...customTemplateForm.unit,
                                    name: customTemplateDefaultUnitName
                                  }
                                })
                              }}
                            >
                              <Wand2 className="mr-1 h-3.5 w-3.5" />
                              填入初始格式
                            </Button>
                          </div>
                          <Input
                            id="batch-ad-custom-unit-name"
                            value={customTemplateForm.unit.name}
                            onChange={(event) =>
                              handleCustomTemplateFormChange({
                                ...customTemplateForm,
                                unit: {
                                  ...customTemplateForm.unit,
                                  name: event.target.value
                                }
                              })
                            }
                            placeholder="输入广告单元名称"
                          />
                        </div>
                      </div>
                      </>
                    ) : (
                      <QuickConfigCard
                        templateType={selectedTemplateCode}
                        dramaName={dramaName}
                        onDramaNameChange={handleDramaNameChange}
                        promoAwemeId={promoAwemeId}
                        onPromoAwemeIdChange={handleAwemeIdChange}
                        promoPlayletUrl={promoPlayletUrl}
                        onPromoPlayletUrlChange={setPromoPlayletUrl}
                        roiCoeff={roiCoeff}
                        onRoiCoeffChange={setRoiCoeff}
                        supportsRoiGoal={Boolean(selectedTemplate?.rules.supports_roi_goal)}
                        cpaBid={projCpaBid}
                        onCpaBidChange={setProjCpaBid}
                        supportsCpaBid={Boolean(selectedTemplate?.rules.supports_cpa_bid)}
                        committedVideosCount={committedVideos.length}
                        materialsPerUnit={materialsPerUnit}
                        onOpenVideoSelector={() => setActiveManualStep('material')}
                        projName={projName}
                        onProjNameChange={setProjName}
                        projBudget={projBudget}
                        onProjBudgetChange={updateProjBudget}
                        projProductPlatformId={projProductPlatformId}
                        onProjProductPlatformIdChange={updateProjProductPlatformId}
                        projProductId={projProductId}
                        onProjProductIdChange={updateProjProductId}
                        productSearching={productSearching}
                        promoName={promoName}
                        onPromoNameChange={setPromoName}
                        onMaterialsPerUnitChange={(value) => {
                          const next = parseInt(value, 10)
                          if (!Number.isNaN(next) && next >= 1 && next <= 30) {
                            setMaterialsPerUnit(next)
                          }
                        }}
                        projectMode={projectMode}
                        onProjectModeChange={handleProjectModeChange}
                        existingProjectBlock={undefined}
                        sections={['campaign', 'unit']}
                        showDramaNameInCampaign={false}
                        hidePlayletPromotionFields={isAppMarketingObjective}
                        namePlaceholderTemplate={BATCH_AD_NAME_PLACEHOLDER_TEMPLATE}
                        awemeOptions={awemeOptions}
                        awemeLoading={awemeLoading}
                        awemeSourceAdvertiserId={awemeSourceAdvertiserId}
                        onRefreshAwemeOptions={() => void refreshAwemeOptions()}
                      />
                    )}

                    <div className="space-y-4 rounded-2xl border bg-muted/30 p-4">
                      <div className="space-y-1">
                        <Label htmlFor="batch-ad-unit-product-name" className="text-sm">
                          产品名称
                        </Label>
                        <Input
                          id="batch-ad-unit-product-name"
                          value={
                            selectedTemplateCode === CUSTOM_TEMPLATE_CODE
                              ? customTemplateForm.unit.dramaName
                              : dramaName
                          }
                          onChange={(event) => {
                            const nextValue = event.target.value
                            if (selectedTemplateCode === CUSTOM_TEMPLATE_CODE) {
                              handleCustomTemplateDramaNameChange({
                                ...customTemplateForm,
                                unit: {
                                  ...customTemplateForm.unit,
                                  dramaName: nextValue
                                }
                              })
                              return
                            }
                            handleDramaNameChange(nextValue)
                          }}
                          placeholder="输入产品名称"
                        />
                        <p className="text-[11px] leading-4 text-muted-foreground">
                          用于商品/素材匹配、已有项目搜索以及写入 product_info.titles。
                        </p>
                      </div>

                      <ProductMainImageUploader
                        imageId={productMainImageId}
                        previewUrl={productMainImagePreviewUrl}
                        uploading={productMainImageUploading}
                        disabled={selectedOrgId == null || manualAdvertiserIds.length === 0}
                        onUpload={handleProductMainImageUpload}
                        onClear={clearProductMainImage}
                      />

                      <div className="grid gap-3 md:grid-cols-2">
                        <TagInput
                          label="产品卖点（product_info.selling_points）"
                          value={productSellingPoints}
                          onChange={setProductSellingPoints}
                          placeholder="输入产品卖点后按回车"
                          helper="默认取模板 selling_points；提交时写入产品卖点。"
                        />
                        <TagInput
                          label="行动号召（call_to_action_buttons）"
                          value={callToActionButtons}
                          onChange={setCallToActionButtons}
                          placeholder="输入行动号召后按回车"
                          helper="默认取模板 call_to_action_buttons；提交时写入行动号召。"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <Label htmlFor="batch-ad-custom-title-enabled" className="text-sm">
                            标题自定义
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            关闭时从标题池随机抽取；开启后使用下方自定义标题写入 title_material_list。
                          </p>
                        </div>
                        <Switch
                          id="batch-ad-custom-title-enabled"
                          checked={customTitleEnabled}
                          onCheckedChange={setCustomTitleEnabled}
                        />
                      </div>

                      {customTitleEnabled && (
                        <div className="space-y-3 border-t pt-3">
                          <div className="space-y-2">
                            <Label htmlFor="batch-ad-custom-titles" className="text-xs">
                              自定义标题（一行一条）
                            </Label>
                            <Textarea
                              id="batch-ad-custom-titles"
                              value={customTitlesText}
                              onChange={(e) => setCustomTitlesText(e.target.value)}
                              placeholder={'口碑炸裂！这才是真正好看的漫剧。\n强烈推荐！近期最值得看的漫剧。'}
                              rows={6}
                              className="min-h-[140px] resize-y font-mono text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                              已输入 {parsedCustomTitles.length} 条；每单元最多使用{' '}
                              {effectiveCustomTitleCount} 条。
                              {parsedCustomTitles.length > 0 &&
                              parsedCustomTitles.length < TITLE_MATERIALS_PER_UNIT
                                ? ' 不足 10 条时将自动按统一模式分配给所有单元。'
                                : ''}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs">标题分配模式</Label>
                            <RadioGroup
                              value={customTitleMode}
                              onValueChange={(value) =>
                                setCustomTitleMode(value as BatchAdCustomTitleMode)
                              }
                              className="grid gap-2 md:grid-cols-2"
                            >
                              <label
                                htmlFor="batch-ad-title-mode-random"
                                className={cn(
                                  'flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-3 transition-colors',
                                  customTitleMode === 'random'
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                                    : 'hover:bg-background/80'
                                )}
                              >
                                <RadioGroupItem
                                  value="random"
                                  id="batch-ad-title-mode-random"
                                  className="mt-0.5"
                                />
                                <span>
                                  <span className="block text-sm font-medium">随机</span>
                                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                                    每个单元独立随机抽取 10 条，同一单元内不重复
                                  </span>
                                </span>
                              </label>
                              <label
                                htmlFor="batch-ad-title-mode-uniform"
                                className={cn(
                                  'flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-3 transition-colors',
                                  customTitleMode === 'uniform'
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                                    : 'hover:bg-background/80'
                                )}
                              >
                                <RadioGroupItem
                                  value="uniform"
                                  id="batch-ad-title-mode-uniform"
                                  className="mt-0.5"
                                />
                                <span>
                                  <span className="block text-sm font-medium">统一</span>
                                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                                    取前 10 行，所有单元共用同一套标题
                                  </span>
                                </span>
                              </label>
                            </RadioGroup>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                      当前每单元最多使用{' '}
                      <span className="font-semibold text-foreground">
                        {effectiveMaterialsPerUnit}
                      </span>{' '}
                      个视频素材
                      {committedVideos.length > 0 ? (
                        <>
                          ，已确认{' '}
                          <span className="font-semibold text-foreground">
                            {committedVideos.length}
                          </span>{' '}
                          个素材，预计共创建{' '}
                          <span className="font-semibold text-foreground">
                            {expectedPromotionCount}
                          </span>{' '}
                          个单元
                          {videoDistributionMode === 'average'
                            ? '，素材会先平均分给账户'
                            : '，每个账户都会铺全部素材'}
                          。
                        </>
                      ) : (
                        '；下一步选择视频素材后会自动计算预计单元数。'
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeManualStep === 'material' && reusedSubmitBody && (
                <Card>
                  <CardHeader>
                    <CardTitle>Step 5 · 视频素材</CardTitle>
                    <CardDescription>复用历史任务快照中的视频素材与产品素材配置。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border bg-muted/30 p-3">
                        <div className="text-xs text-muted-foreground">复用视频素材</div>
                        <div className="mt-1 font-semibold tabular-nums">
                          {inferVideoSnapshotsFromBatchRequest(reusedSubmitBody).length}
                        </div>
                      </div>
                      <div className="rounded-xl border bg-muted/30 p-3">
                        <div className="text-xs text-muted-foreground">素材来源</div>
                        <div className="mt-1 font-medium">已包含在广告单元快照中</div>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      复制任务会直接复用原请求体内的素材列表、标题素材与产品素材信息；如需重新选择视频或产品主图，请切换为自定义编辑后重新配置。
                    </p>
                  </CardContent>
                </Card>
              )}

              {activeManualStep === 'material' && !reusedSubmitBody && (
                <Card>
                  <CardHeader>
                    <CardTitle>Step 5 · 视频素材</CardTitle>
                    <CardDescription>
                      选择并确认视频素材；已选素材会按 Step 4
                      的「每单元素材数」与下方分配方式拆分到单元。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 rounded-2xl border bg-muted/30 p-4">
                      <Label className="text-xs">分配方式</Label>
                      <div className="grid gap-2 md:grid-cols-2">
                        <button
                          type="button"
                          className={cn(
                            'rounded-xl border px-3 py-3 text-left transition-colors',
                            videoDistributionMode === 'full'
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                              : 'hover:bg-background/80'
                          )}
                          onClick={() => setVideoDistributionMode('full')}
                        >
                          <span className="block text-sm font-medium">全铺</span>
                          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                            每个账户都使用全部已选素材，并按每 {effectiveMaterialsPerUnit}{' '}
                            个视频创建一个单元
                          </span>
                        </button>
                        <button
                          type="button"
                          className={cn(
                            'rounded-xl border px-3 py-3 text-left transition-colors',
                            videoDistributionMode === 'average'
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                              : 'hover:bg-background/80'
                          )}
                          onClick={() => setVideoDistributionMode('average')}
                        >
                          <span className="block text-sm font-medium">按单元均分</span>
                          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                            先按每 {effectiveMaterialsPerUnit} 个视频组成单元，再随机轮询分配到账户
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-2xl border bg-muted/30 p-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="batch-ad-materials-per-unit" className="text-xs">
                          每单元素材数
                        </Label>
                        <Input
                          id="batch-ad-materials-per-unit"
                          type="number"
                          min={1}
                          max={30}
                          value={effectiveMaterialsPerUnit}
                          onChange={(event) => updateEffectiveMaterialsPerUnit(event.target.value)}
                          placeholder="10"
                        />
                      </div>
                      <div className="flex items-end text-xs leading-5 text-muted-foreground">
                        控制每个广告单元最多放入多少个视频素材，按单元均分和全铺都会使用该值拆分单元。
                      </div>
                    </div>

                    {videoDistributionMode === 'average' && (
                      <div className="grid gap-2 rounded-2xl border bg-muted/30 p-4 sm:grid-cols-[minmax(0,240px)_1fr] sm:items-center">
                        <div>
                          <Label htmlFor="batch-ad-average-target-promotion-count" className="text-xs">
                            指定每项目目标单元数
                          </Label>
                          <Input
                            id="batch-ad-average-target-promotion-count"
                            type="number"
                            min={1}
                            value={averageTargetPromotionCountText}
                            onChange={(event) => {
                              const next = event.target.value.trim()
                              if (/^\d*$/.test(next)) setAverageTargetPromotionCountText(next)
                            }}
                            placeholder="不填则按素材数自动计算"
                            className="mt-1"
                          />
                        </div>
                        <p className="text-xs leading-5 text-muted-foreground">
                          按单元均分会先按「每单元素材数」生成素材单元，再随机轮询分配给账户；填写后，会持续重新打散素材并补齐到每个账户的目标单元数。
                        </p>
                      </div>
                    )}

                    <div className="rounded-2xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                      已确认素材{' '}
                      <span className="font-semibold text-foreground">
                        {committedVideos.length}
                      </span>{' '}
                      个；
                      {videoDistributionMode === 'full'
                        ? '每个账户都按'
                        : '按单元随机轮询分配，并按'}{' '}
                      <span className="font-semibold text-foreground">
                        {effectiveMaterialsPerUnit}
                      </span>{' '}
                      个视频创建单元，预计共创建{' '}
                      <span className="font-semibold text-foreground">
                        {expectedPromotionCount}
                      </span>{' '}
                      个单元
                      {videoDistributionMode === 'average'
                        ? averageTargetPromotionCount != null
                          ? `，每个账户 ${averageTargetPromotionCount} 个单元，不足时重新打散素材继续补齐`
                          : '，按素材单元随机轮询分配给账户'
                        : ''}
                      。
                    </div>

                    <VideoSelectorCard
                      open={showVideoSelector}
                      onToggle={() => setShowVideoSelector((prev) => !prev)}
                      mode={videoFetchMode}
                      onModeChange={setVideoFetchMode}
                      cookieReady={selectedCookieConfigId != null}
                      oauthReady={selectedOrgId != null}
                      advertiserId={videoAdvertiserId}
                      onAdvertiserIdChange={setVideoAdvertiserId}
                      startDate={videoStartTime}
                      onStartDateChange={setVideoStartTime}
                      endDate={videoEndTime}
                      onEndDateChange={setVideoEndTime}
                      loading={videoLoading}
                      onFetch={fetchVideoMaterials}
                      materialsPerUnit={effectiveMaterialsPerUnit}
                      distributionMode={videoDistributionMode}
                      materialKeywords={materialKeywords}
                      onMaterialKeywordsChange={setMaterialKeywords}
                      items={filteredVideoList}
                      selectedIds={new Set(committedVideos.map((item) => item.id))}
                      onToggleItem={toggleVideoItem}
                      onTogglePage={toggleVideoPage}
                      onClearSelected={clearSelectedVideos}
                      committedCount={committedVideos.length}
                      pageInfo={videoPageInfo}
                      page={videoPage}
                      pageSize={videoPageSize}
                      onPageSizeChange={handleVideoPageSizeChange}
                    />
                  </CardContent>
                </Card>
              )}

              {activeManualStep === 'submit' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Step 6 · 预检并提交</CardTitle>
                    <CardDescription>
                      提交后先进入任务队列，由巨量调度进程定时执行项目与单元创建。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs font-semibold',
                          manualPreflight.ok
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-amber-700 bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
                        )}
                      >
                        {manualPreflight.ok
                          ? '预检通过'
                          : `预检未通过：${manualPreflight.errors.length} 项`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        将提交 {manualAdvertiserIds.length} 个广告主 · 预计 {expectedPromotionCount}{' '}
                        个单元
                      </span>
                    </div>
                    {manualPreflight.ok ? (
                      <div className="rounded-xl border border-emerald-700/35 bg-background px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-400/40 dark:text-emerald-200">
                        配置已满足提交条件。点击下方按钮入队。
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-300 bg-amber-100/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100">
                        <p className="font-medium">请先完善以下内容（点击可跳转）：</p>
                        <ul className="mt-2 space-y-1">
                          {manualPreflight.errors.map((error, i) => (
                            <li key={`${error.message}-${i}`}>
                              <button
                                type="button"
                                onClick={() => goToStep(error.stepKey)}
                                className="text-left underline decoration-dotted underline-offset-2 hover:text-foreground"
                              >
                                {error.message}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {resubmitTargetJobId == null && (
                      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                        <Label className="text-sm font-medium">执行方式</Label>
                        <RadioGroup
                          value={executeMode}
                          onValueChange={(v) => setExecuteMode(v as 'immediate' | 'scheduled')}
                          className="flex flex-col gap-2 sm:flex-row sm:gap-6"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="immediate" id="batch-create-immediate" />
                            <Label htmlFor="batch-create-immediate" className="cursor-pointer font-normal">
                              立即创建
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="scheduled" id="batch-create-scheduled" />
                            <Label htmlFor="batch-create-scheduled" className="cursor-pointer font-normal">
                              定时创建
                            </Label>
                          </div>
                        </RadioGroup>
                        {executeMode === 'scheduled' && (
                          <div className="grid gap-2 max-w-md">
                            <Label htmlFor="batch-create-scheduled-at" className="text-sm">
                              计划开始时间（北京时间）
                            </Label>
                            <Input
                              id="batch-create-scheduled-at"
                              type="datetime-local"
                              value={scheduledStartTime}
                              onChange={(e) => setScheduledStartTime(e.target.value)}
                              disabled={submitting}
                            />
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              须至少 2 分钟后；调度进程约每分钟轮询一次，实际开始时间可能略有延迟。预约后可在任务列表暂停或查看进度，无需保持窗口打开。
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    <Button
                      type="button"
                      onClick={() => void handleManualSubmit()}
                      disabled={submitting || !manualPreflight.ok}
                      className="min-w-[160px]"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          排队/执行中…
                        </>
                      ) : executeMode === 'scheduled' && resubmitTargetJobId == null ? (
                        '预约创建任务'
                      ) : (
                        '提交并创建任务'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {activeManualStep === 'execute' && inputMode === 'excel' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Step 2 · Excel 导入并执行</CardTitle>
                    <CardDescription>
                      适合批量导入多广告主、多剧配置。执行结果会在下方「执行结果」区查看。
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ExcelImportPanel orgIds={selectedOrgIds} onResult={setLatestResults} />
                  </CardContent>
                </Card>
              )}

              {activeManualStep === 'execute' && inputMode === 'bitable' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Step 2 · 飞书 Bitable 导入并执行</CardTitle>
                    <CardDescription>
                      适合协同填写和在线预检。结果同样会同步到下方「执行结果」。
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BitableImportPanel orgIds={selectedOrgIds} onResult={setLatestResults} />
                  </CardContent>
                </Card>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/40 px-4 py-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={goPrevStep}
                  disabled={stepIndex <= 0}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" /> 上一步
                </Button>
                <span className="text-xs text-muted-foreground">
                  第 {Math.max(1, stepIndex + 1)} / {stepKeys.length} 步
                </span>
                {activeManualStep !== 'submit' && activeManualStep !== 'execute' && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={goNextStep}
                    disabled={
                      stepIndex < 0 ||
                      stepIndex >= stepKeys.length - 1 ||
                      (activeManualStep === 'setup' && !manualSteps[0]?.done) ||
                      (activeManualStep === 'accounts' && !canLeaveManualAccountStep)
                    }
                  >
                    下一步 <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>

            {renderInspector()}
          </div>

          <CreateResultCard results={latestResults} />
        </>
      )}
    </div>
  )
}
