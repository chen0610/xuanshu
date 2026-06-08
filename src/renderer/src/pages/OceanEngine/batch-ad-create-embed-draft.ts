import type { CustomTemplateFormState } from './components/CustomTemplateConfigurator'
import type { VideoMaterialFetchMode, VideoMaterialItem } from '../../services/ocean-engine.service'

export type BatchAdVideoDistributionMode = 'full' | 'average'
export type BatchAdCustomTitleMode = 'random' | 'uniform'
/** v2 起新增 setup（前置准备）/ execute（excel/bitable 执行步），保持原有 4 步可用 */
export type BatchAdManualStepKey =
  | 'setup'
  | 'accounts'
  | 'project'
  | 'unit'
  | 'material'
  | 'submit'
  | 'execute'
export type BatchAdInputMode = 'manual' | 'excel' | 'bitable'

const STORAGE_KEY = 'ocean-engine:batch-ad-create-embed-draft'

export interface BatchAdWebProjectDynamicParamFormItem {
  key: string
  uniform: boolean
  value: string
  valuesText: string
}

/** 当前最新 draft schema 版本，结构变化时递增并保留迁移逻辑 */
export const BATCH_AD_EMBED_DRAFT_VERSION = 3 as const

export interface BatchAdEmbedDraftV1 {
  v: 1 | 2 | 3
  selectedOrgId: string | null
  selectedCookieConfigId: number | null
  projectMode: 'new' | 'existing' | 'web'
  webProjectPayloadText?: string
  webProjectName?: string
  webProjectDynamicParams?: BatchAdWebProjectDynamicParamFormItem[]
  webProjectDownloadUrlsText?: string
  webProjectTrackUrlsText?: string
  webProjectActionTrackUrlsText?: string
  webProjectEffectiveFramesText?: string
  selectedProjectIdByAccount: [string, string][]
  selectedTemplateCode: string | null
  customBaseTemplateCode: string
  activeManualStep: BatchAdManualStepKey
  /** v2 起持久化创建方式，避免重新打开 Hub 后回退到默认 manual */
  inputMode?: BatchAdInputMode
  accountIdsText: string
  dramaName: string
  promoAwemeId: string
  promoPlayletUrl: string
  promoSource?: string
  roiCoeff: string
  projCpaBid?: string
  projName: string
  projBudget: string
  projProductPlatformId: string
  projProductId: string
  promoName: string
  materialsPerUnit: number
  materialKeywords: string
  averageTargetPromotionCountText?: string
  videoDistributionMode?: BatchAdVideoDistributionMode
  videoFetchMode: VideoMaterialFetchMode
  videoAdvertiserId: string
  videoStartTime: string
  videoEndTime: string
  committedVideos: VideoMaterialItem[]
  productMainImageId: string
  productMainImagePreviewUrl?: string
  productSellingPoints?: string
  callToActionButtons?: string
  customTitleEnabled?: boolean
  customTitlesText?: string
  customTitleMode?: BatchAdCustomTitleMode
  customTemplateForm: CustomTemplateFormState
}

/** v1 → v2 迁移：把不再合法的 step key 收敛到 setup */
function migrateDraft(parsed: BatchAdEmbedDraftV1): BatchAdEmbedDraftV1 {
  const valid: BatchAdManualStepKey[] = [
    'setup',
    'accounts',
    'project',
    'unit',
    'material',
    'submit',
    'execute'
  ]
  const next: BatchAdEmbedDraftV1 = { ...parsed, v: BATCH_AD_EMBED_DRAFT_VERSION }
  if (!valid.includes(next.activeManualStep)) {
    next.activeManualStep = 'setup'
  }
  next.projCpaBid = next.projCpaBid ?? '20'
  return next
}

export function loadBatchAdEmbedDraft(): BatchAdEmbedDraftV1 | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const v = (parsed as BatchAdEmbedDraftV1).v
    if (v === 1 || v === 2 || v === 3) {
      return migrateDraft(parsed as BatchAdEmbedDraftV1)
    }
  } catch {
    /* ignore */
  }
  return null
}

export function saveBatchAdEmbedDraft(draft: BatchAdEmbedDraftV1): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, v: BATCH_AD_EMBED_DRAFT_VERSION }))
  } catch {
    /* ignore */
  }
}

export function clearBatchAdEmbedDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
