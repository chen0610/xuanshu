import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  CheckCircle,
  ChevronDown,
  FileSpreadsheet,
  Layers3,
  Loader2,
  Megaphone,
  RefreshCw,
  Sparkles,
  Workflow,
  XCircle
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Label,
  Input,
  Textarea,
  Checkbox
} from '../../components/ui'
import { oceanEngineOAuthService } from '../../services/ocean-engine-oauth.service'
import {
  oceanEngineBatchAdService,
  videoMaterialService,
  dpaProductService,
  type OceanEngineAdTemplateSummary,
  type OceanEngineBatchCreateAdsResponse,
  type VideoMaterialItem,
  type VideoMaterialPageInfo
} from '../../services/ocean-engine.service'
import type { OceanEngineOAuthToken } from '../../types/ocean-engine-oauth.types'
import { toast } from 'sonner'
import { ExcelImportPanel } from './components/ExcelImportPanel'
import { BitableImportPanel } from './components/BitableImportPanel'
import { QuickConfigCard } from './components/QuickConfigCard'
import { TemplateSelectorCard } from './components/TemplateSelectorCard'
import type { OceanEngineBatchCreateAdsAccountResult } from '../../services/ocean-engine.service'

const DEFAULT_PROJECT_PATH = 'v3.0/project/create'
const DEFAULT_PROMOTION_PATH = 'v3.0/promotion/create'

const CITY_LIST = [
  '34',
  '50',
  '35',
  '44',
  '62',
  '45',
  '52',
  '13',
  '42',
  '23',
  '46',
  '41',
  '43',
  '22',
  '32',
  '36',
  '21',
  '15',
  '64',
  '63',
  '51',
  '37',
  '31',
  '61',
  '14',
  '12',
  '65',
  '54',
  '53',
  '33'
] as const

/** 端原生-铺剧模版：优化激活，自定义ROI出价 */
const PUJU_PROJECT_TEMPLATE = {
  name: '',
  landing_type: 'MICRO_GAME',
  marketing_goal: 'VIDEO_AND_IMAGE',
  related_product: {
    product_setting: 'SINGLE',
    product_platform_id: '2053071186167606',
    product_id: ''
  },
  micro_promotion_type: 'AWEME',
  optimize_goal: {
    external_action: 'AD_CONVERT_TYPE_ACTIVE',
    deep_external_action: 'AD_CONVERT_TYPE_LT_ROI'
  },
  delivery_setting: {
    bid_type: 'CUSTOM',
    deep_bid_type: 'ROI_COEFFICIENT',
    schedule_type: 'SCHEDULE_FROM_NOW',
    budget_mode: 'BUDGET_MODE_DAY',
    budget: 300,
    roi_goal: 0.9,
    pricing: 'PRICING_OCPM'
  },
  delivery_range: { inventory_catalog: 'UNIVERSAL_SMART' },
  ad_type: 'ALL',
  delivery_mode: 'PROCEDURAL',
  audience: {
    district: 'REGION',
    region_version: '2.3.2',
    city: CITY_LIST,
    location_type: 'ALL',
    gender: 'NONE',
    platform: [],
    hide_if_converted: 'NO_EXCLUDE'
  }
} as const

/** 端原生-测剧模版：优化付费，UBMax自动出价 */
const CEJU_PROJECT_TEMPLATE = {
  name: '端原生测剧项目',
  landing_type: 'MICRO_GAME',
  marketing_goal: 'VIDEO_AND_IMAGE',
  related_product: {
    product_setting: 'SINGLE',
    product_platform_id: '2054178541160228',
    product_id: ''
  },
  micro_promotion_type: 'AWEME',
  optimize_goal: {
    external_action: 'AD_CONVERT_TYPE_PAY',
    deep_external_action: 'AD_CONVERT_TYPE_PURCHASE_ROI'
  },
  delivery_setting: {
    bid_type: 'NO_BID',
    deep_bid_type: 'ROI_COEFFICIENT',
    schedule_type: 'SCHEDULE_FROM_NOW',
    budget_mode: 'BUDGET_MODE_DAY',
    budget: 300,
    pricing: 'PRICING_OCPM'
  },
  delivery_range: { inventory_catalog: 'UNIVERSAL_SMART' },
  ad_type: 'ALL',
  delivery_mode: 'PROCEDURAL',
  audience: {
    district: 'REGION',
    region_version: '2.3.2',
    city: CITY_LIST,
    location_type: 'ALL',
    gender: 'NONE',
    platform: [],
    hide_if_converted: 'NO_EXCLUDE'
  }
} as const

type TemplateType = 'puju' | 'ceju'

const TEMPLATE_CONFIG: Record<
  TemplateType,
  {
    label: string
    tags: string[]
    project: typeof PUJU_PROJECT_TEMPLATE | typeof CEJU_PROJECT_TEMPLATE
  }
> = {
  puju: {
    label: '端原生铺剧',
    tags: ['优化激活', '自定义ROI出价'],
    project: PUJU_PROJECT_TEMPLATE
  },
  ceju: {
    label: '端原生测剧',
    tags: ['优化付费', 'UBMax自动出价'],
    project: CEJU_PROJECT_TEMPLATE
  }
}

/** 初始化项目 JSON：清空 product_id（由漫剧名称自动查询填入） */
function makeProjectBody(
  tmpl: typeof PUJU_PROJECT_TEMPLATE | typeof CEJU_PROJECT_TEMPLATE
): string {
  const obj = JSON.parse(JSON.stringify(tmpl)) as Record<string, unknown>
  const relProd = obj.related_product as Record<string, unknown>
  if (relProd) relProd.product_id = ''
  return JSON.stringify(obj, null, 2)
}

const DEFAULT_PROJECT_BODY = makeProjectBody(PUJU_PROJECT_TEMPLATE)

/** 端原生付费-创建单元模版参数（UBMax 自动投放） */
const PROMOTION_TEMPLATE = {
  name: '',
  source: '番茄',
  promotion_materials: {
    video_material_list: [
      {
        image_mode: 'CREATIVE_IMAGE_MODE_VIDEO_VERTICAL',
        video_id: 'v28033gi0000d794acnog65lv654oa40',
        video_cover_id: 'tos-cn-p-0051-ce/osfppMN3DCD0pSPEVRFUyESTEIXYIwBrkKAoeA'
      }
    ],
    title_material_list: [
      { title: '口碑炸裂！这才是真正好看的漫剧。' },
      { title: '强烈推荐！近期最值得看的漫剧。' },
      { title: '熬夜也要看完，剧情太精彩了！' },
      { title: '不看后患系列，超好看的热门漫剧。' },
      { title: '这部漫剧太上头，看完根本停不下来！' },
      { title: '一集就沦陷，越看越想看的高分漫剧。' },
      { title: '错过太可惜，这部漫剧火得有道理。' },
      { title: '一集入坑，连刷十集不过瘾。' },
      { title: '全程高能无尿点，这部漫剧值得追。' },
      { title: '刷到别划走，这部漫剧你一定喜欢。' }
    ],
    playlet_series_url_list: [
      'aweme://playlet?playlet_id=7622274529535985698&playlet_purchase_panel_id=7623709336195308563&version=2&advertise_param=eyJkaXN0cmlidXRvcl9pZCI6NzYxODg2OTgzMTY1MTA0MDI4MiwicGxheWxldF9wYWlkX3R5cGUiOjEsImFkdmVydGlzb3JfdHlwZSI6MiwibWVkaWFfaWQiOjE4NDU5NTUwMDA2OTM3NzAsInBsYXlsZXRfcHVyY2hhc2VfcGFuZWxfaWQiOjc2MjM3MDkzMzYxOTUzMDg1NjMsInBlcnNvbmFsX3N0cmF0ZWd5X2lkIjozMDUzMTMzLCJsaW5rX3R5cGUiOjEsInNwdV9pZCI6NzYyMjI3NDAxNTM4MTU1ODMyNCwiY29weXJpZ2h0X2FjY291bnRfaWQiOjB9&hash_res=6d26d050eb9594d420732b3a6045ec53'
    ],
    product_info: {
      titles: ['清诗照长安'],
      image_ids: ['tos-cn-i-sd07hgqsbj/4ef0dac726664955a1ee2c0bf65212e6'],
      selling_points: ['海量精品剧免费看']
    },
    call_to_action_buttons: ['去免费看', '播放全集', '去看剧', '直接观看']
  },
  native_setting: {
    aweme_id: '63279742087'
  }
} as const

// 初始化单元 JSON：source / titles / aweme_id 默认清空，由用户填入后同步
const DEFAULT_PROMOTION_BODY = (() => {
  const obj = JSON.parse(JSON.stringify(PROMOTION_TEMPLATE)) as Record<string, unknown>
  const pm = obj.promotion_materials as Record<string, unknown>
  if (pm) {
    const pi = pm.product_info as Record<string, unknown>
    if (pi) pi.titles = ['']
  }
  const ns = obj.native_setting as Record<string, unknown>
  if (ns) ns.aweme_id = '63279742087'
  return JSON.stringify(obj, null, 2)
})()

/**
 * 从 poster_url 计算 video_cover_id
 * 去除协议头和参数后，按 '/' 切割，取第 2、3 项拼接，第 3 项先用 '~' 切割取第 1 项
 */
function computeVideoCoverId(posterUrl: string): string {
  const withoutProtocol = posterUrl.replace(/^https?:\/\//, '')
  const withoutParams = withoutProtocol.split('?')[0]
  const parts = withoutParams.split('/')
  const second = parts[1] ?? ''
  const thirdRaw = parts[2] ?? ''
  const third = thirdRaw.split('~')[0]
  return `${second}/${third}`
}

/**
 * 根据宽高判断 image_mode
 * width > height → 横版（CREATIVE_IMAGE_MODE_VIDEO）
 * 否则    → 竖版（CREATIVE_IMAGE_MODE_VIDEO_VERTICAL）
 */
function getImageMode(v: { width: number; height: number }): string {
  return v.width > v.height ? 'CREATIVE_IMAGE_MODE_VIDEO' : 'CREATIVE_IMAGE_MODE_VIDEO_VERTICAL'
}

/** 每行一个 ID，去重且保持顺序 */
function parseAccountLines(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim()
    if (s.length === 0 || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

/** 将本地 Date 格式化为 YYYY-MM-DD */
function fmtDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** 素材文件名匹配：按 | 拆分关键字，trim 后去空 */
function parseMaterialKeywordParts(raw: string): string[] {
  return raw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 自动选取用关键字：优先使用输入框（含多关键字）；若解析结果为空则回退漫剧名称
 */
function getEffectiveMaterialKeywords(materialKeywordsInput: string, dramaName: string): string[] {
  const parts = parseMaterialKeywordParts(materialKeywordsInput)
  if (parts.length > 0) return parts
  const d = dramaName.trim()
  return d ? [d] : []
}

/** Fisher-Yates 洗牌随机取前 count 条 */
function pickRandom(pool: string[], count: number): string[] {
  const arr = [...pool]
  const n = Math.min(count, arr.length)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (arr.length - i))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, n)
}

export const BatchAdCreatePage: React.FC = () => {
  const [tokens, setTokens] = useState<OceanEngineOAuthToken[]>([])
  const [loadingTokens, setLoadingTokens] = useState(true)
  const [dramaPool, setDramaPool] = useState<string[]>([])
  const [templateOptions, setTemplateOptions] = useState<OceanEngineAdTemplateSummary[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [accountIdsText, setAccountIdsText] = useState('')
  // 模板选择
  const [templateType, setTemplateType] = useState<TemplateType>('puju')

  // 快捷参数对应项目模版中高频更改的字段
  const [projName, setProjName] = useState(PUJU_PROJECT_TEMPLATE.name)
  const [projBudget, setProjBudget] = useState(
    String(PUJU_PROJECT_TEMPLATE.delivery_setting.budget)
  )
  const [projProductPlatformId, setProjProductPlatformId] = useState(
    PUJU_PROJECT_TEMPLATE.related_product.product_platform_id
  )
  const [projProductId, setProjProductId] = useState('')

  // 快捷参数对应单元模版中高频更改的字段
  const [promoName, setPromoName] = useState(PROMOTION_TEMPLATE.name)
  const [promoAwemeId, setPromoAwemeId] = useState('63279742087')
  const [promoVideoId, setPromoVideoId] = useState('')
  const [promoPlayletUrl, setPromoPlayletUrl] = useState(
    PROMOTION_TEMPLATE.promotion_materials.playlet_series_url_list[0]
  )
  // 漫剧快捷配置
  const [dramaName, setDramaName] = useState('')
  const [roiCoeff, setRoiCoeff] = useState(String(PUJU_PROJECT_TEMPLATE.delivery_setting.roi_goal))

  // 视频素材选取相关状态
  const [showVideoSelector, setShowVideoSelector] = useState(false)
  const [videoAdvertiserId, setVideoAdvertiserId] = useState('')
  const [videoStartTime, setVideoStartTime] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return fmtDate(d)
  })
  const [videoEndTime, setVideoEndTime] = useState<string>(() => fmtDate(new Date()))
  const [videoList, setVideoList] = useState<VideoMaterialItem[]>([])
  const [videoPagination, setVideoPagination] = useState<VideoMaterialPageInfo | null>(null)
  const [videoPage, setVideoPage] = useState(1)
  const [videoPageSize, setVideoPageSize] = useState<20 | 50 | 100>(20)
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoAutoSelecting, setVideoAutoSelecting] = useState(false)
  /** 素材文件名关键字，随漫剧名称同步；可用 | 分隔多个关键字 */
  const [materialKeywordsInput, setMaterialKeywordsInput] = useState('')
  /**
   * 跨分页选中的视频，以 video_id 为 key、完整 VideoMaterialItem 为 value
   * 切换分页时不清除，确认后才清除
   */
  const [selectedVideoMap, setSelectedVideoMap] = useState<Map<string, VideoMaterialItem>>(
    new Map()
  )
  /** 已确认用于本次批量创建的视频素材 */
  const [committedVideos, setCommittedVideos] = useState<VideoMaterialItem[]>([])
  /** 每个广告单元最多包含的视频素材数（默认 10） */
  const [materialsPerUnit, setMaterialsPerUnit] = useState(10)

  const [projectPath, setProjectPath] = useState(DEFAULT_PROJECT_PATH)
  const [promotionPath, setPromotionPath] = useState(DEFAULT_PROMOTION_PATH)
  const [projectJson, setProjectJson] = useState(DEFAULT_PROJECT_BODY)
  const [promotionJson, setPromotionJson] = useState(DEFAULT_PROMOTION_BODY)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<OceanEngineBatchCreateAdsResponse | null>(null)
  const batchJobPollAbortRef = useRef<AbortController | null>(null)

  // 投放模式切换：manual = 现有手动配置，excel = Excel 导入，bitable = 飞书 Bitable
  const [inputMode, setInputMode] = useState<'manual' | 'excel' | 'bitable'>('manual')

  const loadTokens = useCallback(async () => {
    setLoadingTokens(true)
    try {
      const res = await oceanEngineOAuthService.getTokens(true)
      setTokens(res.items ?? [])
    } catch {
      toast.error('加载已授权组织账户失败')
    } finally {
      setLoadingTokens(false)
    }
  }, [])

  useEffect(() => {
    void loadTokens()
  }, [loadTokens])

  useEffect(() => {
    return () => {
      batchJobPollAbortRef.current?.abort()
    }
  }, [])

  // 漫剧名称变更时同步素材关键字输入框（用户仍可在输入框内用 | 自定义多关键字）
  useEffect(() => {
    setMaterialKeywordsInput(dramaName.trim())
  }, [dramaName])

  const effectiveMaterialKeywords = useMemo(
    () => getEffectiveMaterialKeywords(materialKeywordsInput, dramaName),
    [materialKeywordsInput, dramaName]
  )

  const templateCards = useMemo(() => {
    if (templateOptions.length > 0) {
      return templateOptions.map((item) => ({
        code: item.meta.code,
        label: item.meta.label,
        tags: item.meta.tags
      }))
    }
    return (
      Object.entries(TEMPLATE_CONFIG) as [
        string,
        (typeof TEMPLATE_CONFIG)[keyof typeof TEMPLATE_CONFIG]
      ][]
    ).map(([code, cfg]) => ({
      code,
      label: cfg.label,
      tags: cfg.tags
    }))
  }, [templateOptions])

  // 从后端加载漫剧标题池
  useEffect(() => {
    oceanEngineBatchAdService
      .getDramaTitles()
      .then((res) => {
        if (res.code === 0 && res.data?.titles?.length) {
          setDramaPool(res.data.titles)
        }
      })
      .catch(() => {
        // 加载失败时 dramaPool 保持空数组，handleSubmit 内会提示
      })
  }, [])

  useEffect(() => {
    oceanEngineBatchAdService
      .getAdTemplates()
      .then((res) => {
        setTemplateOptions(res.items ?? [])
      })
      .catch(() => {
        toast.error('加载广告模板列表失败')
      })
  }, [])

  const uniqueOrgTokens = useMemo(() => {
    const grouped = new Map<string, OceanEngineOAuthToken[]>()
    for (const token of tokens) {
      const sameOrgTokens = grouped.get(token.advertiser_id)
      if (sameOrgTokens) {
        sameOrgTokens.push(token)
      } else {
        grouped.set(token.advertiser_id, [token])
      }
    }

    return Array.from(grouped.values()).map((group) => {
      const sortedGroup = [...group].sort((a, b) => {
        const aTime = new Date(a.authorized_at).getTime()
        const bTime = new Date(b.authorized_at).getTime()
        return bTime - aTime
      })
      const primary = sortedGroup[0]
      return {
        ...primary,
        appCodes: Array.from(new Set(sortedGroup.map((item) => item.app_code))).sort()
      }
    })
  }, [tokens])

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const [productSearching, setProductSearching] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectAll = (): void => setSelected(new Set(uniqueOrgTokens.map((t) => t.advertiser_id)))
  const clearSelection = (): void => setSelected(new Set())

  /** 切换模版
  /** 切换模版：重置项目 JSON 小快捷参数，商品 ID 清空由漫剧名称自动查询填入 */
  const applyTemplate = useCallback((type: TemplateType): void => {
    const fallback = TEMPLATE_CONFIG[type as keyof typeof TEMPLATE_CONFIG]
    if (!fallback) {
      setTemplateType(type)
      return
    }
    const { project } = fallback
    setTemplateType(type)
    setProjName(project.name)
    setProjBudget(String(project.delivery_setting.budget))
    setProjProductPlatformId(project.related_product.product_platform_id)
    setProjProductId('')
    setProjectJson(makeProjectBody(project))
    if (type === 'puju') setRoiCoeff('0.9')
  }, [])

  /**
   * 公共商品查询调度器
   * 条件：漫剧名称非空 && 投放账户列表第一行非空
   * @param currentName    当前漫剧名称
   * @param currentAccText 当前投放账户列表文本（step ②）
   */
  const scheduleProductSearch = (currentName: string, currentAccText: string): void => {
    setProjProductId('')
    patchProjectJson([{ path: ['related_product', 'product_id'], value: '' }])

    const firstAdvId = parseAccountLines(currentAccText)[0]
    if (!firstAdvId || !currentName.trim()) return

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    const orgId = Array.from(selected)[0]
    const platformId = projProductPlatformId

    searchTimerRef.current = setTimeout(() => {
      if (!orgId) return
      setProductSearching(true)
      dpaProductService
        .queryProducts({
          org_advertiser_id: orgId,
          advertiser_id: firstAdvId,
          product_platform_id: platformId,
          product_name: currentName.trim()
        })
        .then((res) => {
          if (res.code === 0 && res.data?.list?.[0]) {
            console.log('查询商品库商品id成功', res.data.list[0])
            const pid = String(res.data.list[0].product_id)
            setProjProductId(pid)
            patchProjectJson([{ path: ['related_product', 'product_id'], value: pid }])
          }
        })
        .catch(() => {
          // 无匹配结果，用户可手动填写
        })
        .finally(() => {
          setProductSearching(false)
        })
    }, 600)
  }

  /**
   * 漫剧名称变更：同步 JSON + 触发商品查询
   * 查询条件：漫剧名称非空 && 投放账户列表（step ②）第一行非空
   */
  const handleDramaNameChange = (name: string): void => {
    setDramaName(name)
    patchPromotionJson((o) => {
      const pm = (o.promotion_materials ?? {}) as Record<string, unknown>
      const pi = (pm.product_info ?? {}) as Record<string, unknown>
      pi.titles = [name]
      pm.product_info = pi
      o.promotion_materials = pm
    })
    scheduleProductSearch(name, accountIdsText)
  }

  /** 将指定路径的字段写入当前项目 JSON，安静更新不影响其他字段 */
  const patchProjectJson = (updates: Array<{ path: string[]; value: unknown }>): void => {
    setProjectJson((prev) => {
      try {
        const obj = JSON.parse(prev) as Record<string, unknown>
        for (const { path, value } of updates) {
          let target: Record<string, unknown> = obj
          for (let i = 0; i < path.length - 1; i++) {
            const key = path[i]
            if (
              typeof target[key] !== 'object' ||
              target[key] === null ||
              Array.isArray(target[key])
            ) {
              target[key] = {}
            }
            target = target[key] as Record<string, unknown>
          }
          target[path[path.length - 1]] = value
        }
        return JSON.stringify(obj, null, 2)
      } catch {
        return prev // JSON 无效时保持原内容
      }
    })
  }

  /** 将指定路径的字段写入当前单元 JSON */
  const patchPromotionJson = (updater: (obj: Record<string, unknown>) => void): void => {
    setPromotionJson((prev) => {
      try {
        const obj = JSON.parse(prev) as Record<string, unknown>
        updater(obj)
        return JSON.stringify(obj, null, 2)
      } catch {
        return prev
      }
    })
  }

  const fetchVideoMaterials = async (page: number, pageSize = videoPageSize): Promise<void> => {
    const orgId = Array.from(selected)[0]
    const advId = (videoAdvertiserId.trim() || parseAccountLines(accountIdsText)[0] || '').trim()
    if (!orgId) {
      toast.error('请先在步骤①勾选授权来源账户')
      return
    }
    if (!advId) {
      toast.error('请先填写投放广告主 ID（步骤②或下方输入框）')
      return
    }
    setVideoLoading(true)
    try {
      const res = await videoMaterialService.getVideoMaterials({
        org_advertiser_id: orgId,
        advertiser_id: advId,
        page,
        page_size: pageSize,
        start_time: videoStartTime || undefined,
        end_time: videoEndTime || undefined
      })
      if (res.code !== 0) {
        toast.error(res.message || '获取视频素材失败')
        return
      }
      setVideoList(res.data?.list ?? [])
      setVideoPagination(res.data?.page_info ?? null)
      setVideoPage(page)
      // 注意：不重置 selectedVideoMap，保留跨分页勾选结果
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '请求失败')
    } finally {
      setVideoLoading(false)
    }
  }

  /**
   * 自动选取视频：拉取全量素材（page_size=100，含时间区间），
   * 以「素材关键字」解析后的多个关键字分别匹配文件名，命中并集去重后设为已确认素材。
   */
  const autoSelectVideos = async (): Promise<void> => {
    const keywords = effectiveMaterialKeywords
    if (keywords.length === 0) {
      toast.error('请填写素材关键字，或在漫剧快捷配置中填写漫剧名称')
      return
    }
    const orgId = Array.from(selected)[0]
    const advId = (videoAdvertiserId.trim() || parseAccountLines(accountIdsText)[0] || '').trim()
    if (!orgId) {
      toast.error('请先在步骤①勾选授权来源账户')
      return
    }
    if (!advId) {
      toast.error('请先填写投放广告主 ID')
      return
    }

    setVideoAutoSelecting(true)
    try {
      const res = await videoMaterialService.getVideoMaterials({
        org_advertiser_id: orgId,
        advertiser_id: advId,
        page: 1,
        page_size: 100,
        start_time: videoStartTime || undefined,
        end_time: videoEndTime || undefined
      })
      if (res.code !== 0) {
        toast.error(res.message || '获取素材失败')
        return
      }
      const allItems = res.data?.list ?? []
      const matchedMap = new Map<string, VideoMaterialItem>()
      for (const v of allItems) {
        if (keywords.some((kw) => v.filename.includes(kw))) {
          matchedMap.set(v.id, v)
        }
      }
      const matched = Array.from(matchedMap.values())
      if (matched.length === 0) {
        const label = keywords.join('、')
        toast.error(`未找到文件名包含任一关键字（${label}）的素材`)
        return
      }
      setCommittedVideos(matched)
      setPromoVideoId(matched[0].id)
      const chunkCount = Math.ceil(matched.length / materialsPerUnit)
      toast.success(`自动选取 ${matched.length} 个素材 → 将创建 ${chunkCount} 个广告单元`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '请求失败')
    } finally {
      setVideoAutoSelecting(false)
    }
  }

  const toggleVideoItem = (v: VideoMaterialItem): void => {
    setSelectedVideoMap((prev) => {
      const next = new Map(prev)
      if (next.has(v.id)) next.delete(v.id)
      else next.set(v.id, v)
      return next
    })
  }

  const applySelectedVideos = (): void => {
    if (selectedVideoMap.size === 0) {
      toast.error('请先勾选视频')
      return
    }
    const items = Array.from(selectedVideoMap.values())
    setCommittedVideos(items)
    setSelectedVideoMap(new Map()) // 确认后清空选中状态
    setPromoVideoId(items[0].id)
    const chunkCount = Math.ceil(items.length / materialsPerUnit)
    toast.success(`已确认 ${items.length} 个视频，提交时将创建 ${chunkCount} 个广告单元`)
  }

  const handleSubmit = async (): Promise<void> => {
    if (selected.size === 0) {
      toast.error('请先勾选至少一个授权来源账户')
      return
    }

    const accountIds = parseAccountLines(accountIdsText)
    if (accountIds.length === 0) {
      toast.error('请在步骤②中填写至少一个投放账户 ID（每行一个）')
      return
    }

    if (dramaPool.length === 0) {
      toast.error('标题池加载失败，请刷新页面后重试')
      return
    }

    let project: Record<string, unknown>
    let basePromotion: Record<string, unknown>
    try {
      project = JSON.parse(projectJson) as Record<string, unknown>
      basePromotion = JSON.parse(promotionJson) as Record<string, unknown>
      if (
        project === null ||
        typeof project !== 'object' ||
        Array.isArray(project) ||
        basePromotion === null ||
        typeof basePromotion !== 'object' ||
        Array.isArray(basePromotion)
      ) {
        throw new Error('项目与广告的请求体均须为 JSON 对象')
      }
    } catch (e) {
      toast.error(`JSON 无效：${e instanceof Error ? e.message : String(e)}`)
      return
    }

    // 将 committedVideos 按 materialsPerUnit 分组，生成对应数量的单元 body
    let promotions: Record<string, unknown>[]
    if (committedVideos.length > 0) {
      const chunks: VideoMaterialItem[][] = []
      for (let i = 0; i < committedVideos.length; i += materialsPerUnit) {
        chunks.push(committedVideos.slice(i, i + materialsPerUnit))
      }
      promotions = chunks.map((chunk, idx) => {
        const promo = JSON.parse(JSON.stringify(basePromotion)) as Record<string, unknown>
        const pm = (promo.promotion_materials ?? {}) as Record<string, unknown>
        pm.video_material_list = chunk.map((v) => ({
          image_mode: getImageMode(v),
          video_id: v.id,
          video_cover_id: computeVideoCoverId(v.poster_url)
        }))
        pm.title_material_list = pickRandom(dramaPool, 10).map((t) => ({ title: t }))
        promo.promotion_materials = pm
        // 多单元时在名称后附加序号以便区分
        if (chunks.length > 1) {
          promo.name = `${String(promo.name ?? '')}${idx + 1}`
        }
        return promo
      })
    } else {
      const promo = JSON.parse(JSON.stringify(basePromotion)) as Record<string, unknown>
      const pm = (promo.promotion_materials ?? {}) as Record<string, unknown>
      pm.title_material_list = pickRandom(dramaPool, 10).map((t) => ({ title: t }))
      promo.promotion_materials = pm
      promotions = [promo]
    }

    setSubmitting(true)
    setResult(null)
    batchJobPollAbortRef.current?.abort()
    batchJobPollAbortRef.current = new AbortController()
    const pollSignal = batchJobPollAbortRef.current.signal
    try {
      const { job_id } = await oceanEngineBatchAdService.createBatchCreateJob({
        payload: {
          org_advertiser_ids: Array.from(selected),
          advertiser_ids: accountIds,
          project,
          promotions,
          project_path: projectPath.trim() || DEFAULT_PROJECT_PATH,
          promotion_path: promotionPath.trim() || DEFAULT_PROMOTION_PATH
        }
      })
      toast.info(`任务 #${job_id} 已入队，由调度进程执行，请稍候…`)
      const detail = await oceanEngineBatchAdService.pollBatchCreateJobUntilDone(job_id, {
        signal: pollSignal
      })
      if (detail.result) {
        setResult(detail.result)
        const ok = detail.result.account_results.filter((r) => r.success).length
        if (detail.status === 'failed') {
          toast.error(
            detail.error_message ||
              `未成功：0/${detail.result.account_results.length} 个账户成功（详见下方结果）`
          )
        } else if (detail.status === 'partial') {
          toast.success(
            `部分完成：${ok}/${detail.result.account_results.length} 个账户成功（详见下方结果）`
          )
        } else {
          toast.success(`完成：${ok}/${detail.result.account_results.length} 个账户成功`)
        }
      } else if (detail.status === 'failed') {
        toast.error(detail.error_message || '任务执行失败')
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return
      }
      toast.error(e instanceof Error ? e.message : '请求失败')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = selected.size > 0 && parseAccountLines(accountIdsText).length > 0 && !submitting

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <motion.section
        className="relative overflow-hidden rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.58)] sm:p-8"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_58%)]" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Ocean Engine Batch Creation Workspace
            </div>
            <div className="flex gap-3 items-start">
              <div className="p-3 rounded-2xl border border-border/70 bg-background/70">
                <Megaphone className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">广告批量创建</h1>
                <p className="mt-2 text-sm leading-7 text-muted-foreground sm:text-base">
                  统一处理授权来源、广告主账户、项目模板、广告单元和素材注入。我们先把这个页面收成工作台视图，便于高频批量投放场景持续使用。
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                授权来源
              </p>
              <p className="mt-2 text-lg font-semibold">{selected.size}</p>
              <p className="mt-1 text-xs text-muted-foreground">当前已勾选的组织账户</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                广告主账户
              </p>
              <p className="mt-2 text-lg font-semibold">
                {parseAccountLines(accountIdsText).length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">待创建广告的账户数量</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                标题池
              </p>
              <p className="mt-2 text-lg font-semibold">{dramaPool.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">可用于自动注入的标题素材</p>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">当前模式</span>
              <Layers3 className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-2xl">
              {inputMode === 'manual'
                ? '手动配置'
                : inputMode === 'excel'
                  ? 'Excel 导入'
                  : 'Bitable'}
            </CardTitle>
            <CardDescription>不同模式适配不同批量投放工作流。</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">素材状态</span>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-2xl">{committedVideos.length}</CardTitle>
            <CardDescription>当前已确认用于本次投放的素材数量。</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">提交状态</span>
              <Workflow className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-2xl">{submitting ? '执行中' : '待提交'}</CardTitle>
            <CardDescription>
              手动模式提交后先入队，由巨量调度进程定时拉取执行（先建项目、再建广告）。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* 步骤一：勾选广告主 */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap gap-4 justify-between items-start">
          <div>
            <CardTitle>① 授权来源（纵横组织）</CardTitle>
            <CardDescription>
              选择已完成 OAuth 授权的纵横组织账户，其 access_token 将用于调用 Open API。 这里的 ID
              是<strong>组织 ID</strong>，与步骤②的投放广告主 ID 不同。
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadTokens()}>
            <RefreshCw className="w-4 h-4 mr-1" />
            刷新列表
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingTokens ? (
            <div className="flex gap-2 items-center text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              加载中…
            </div>
          ) : tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              暂无已授权组织账户，请前往{' '}
              <Link
                to="/config"
                className="text-primary font-medium underline-offset-2 hover:underline"
              >
                配置管理 → 巨量开放平台 OAuth
              </Link>{' '}
              完成授权。
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 items-center">
                <Button type="button" variant="secondary" size="sm" onClick={selectAll}>
                  全选
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                  清空
                </Button>
                {selected.size > 0 && (
                  <span className="text-sm text-muted-foreground">已选 {selected.size} 个</span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {uniqueOrgTokens.map((t) => (
                  <div
                    key={t.advertiser_id}
                    role="button"
                    tabIndex={0}
                    className={`flex gap-3 items-center p-3 rounded-md border cursor-pointer transition-colors ${
                      selected.has(t.advertiser_id)
                        ? 'border-primary/50 bg-primary/5'
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => toggle(t.advertiser_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggle(t.advertiser_id)
                      }
                    }}
                  >
                    <Checkbox
                      checked={selected.has(t.advertiser_id)}
                      onCheckedChange={() => toggle(t.advertiser_id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="min-w-0 flex-1 text-left">
                      <div className="font-medium truncate">
                        {t.advertiser_name || t.advertiser_id}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {t.appCodes.map((appCode) => (
                          <span
                            key={appCode}
                            className="inline-flex items-center rounded-full border border-border/70 bg-muted px-2 py-0.5 text-[11px] leading-4 text-muted-foreground"
                          >
                            {appCode}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        组织 ID：{t.advertiser_id}
                      </div>
                      <div className="hidden">App Code：{t.appCodes.join(', ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 模式切换 Tab */}
      <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-border/70 bg-card/70 p-2">
        <button
          type="button"
          className={`inline-flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium transition-colors ${
            inputMode === 'manual'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
          onClick={() => setInputMode('manual')}
        >
          <Layers3 className="h-4 w-4" />
          手动配置
        </button>
        <button
          type="button"
          className={`inline-flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium transition-colors ${
            inputMode === 'excel'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
          onClick={() => setInputMode('excel')}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Excel 导入
        </button>
        <button
          type="button"
          className={`inline-flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium transition-colors ${
            inputMode === 'bitable'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
          onClick={() => setInputMode('bitable')}
        >
          <Workflow className="h-4 w-4" />
          飞书 Bitable
        </button>
      </div>

      {/* Excel 导入模式 */}
      {inputMode === 'excel' && (
        <Card>
          <CardHeader>
            <CardTitle>② Excel 导入 — 每行独立配置</CardTitle>
            <CardDescription>
              下载模板填写后上传，每行对应一个广告主的独立投放配置（漫剧名、推广链接、模板等）。
              适用于<strong>不同账户投放不同剧</strong>的场景，无需重复提交。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExcelImportPanel
              orgIds={selected}
              onResult={(accountResults) => {
                setResult({ account_results: accountResults } as OceanEngineBatchCreateAdsResponse)
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* 飞书 Bitable 模式 */}
      {inputMode === 'bitable' && (
        <Card>
          <CardHeader>
            <CardTitle>② 飞书 Bitable — 多维表格投放</CardTitle>
            <CardDescription>
              直接读取飞书多维表格中的投放配置行，无需下载/上传文件。
              可先点击「创建模板表」生成标准格式的多维表格，填写完成后粘贴链接触发预检与执行。 仅{' '}
              <strong>status 为「待提交」或留空</strong>{' '}
              的行会参与预检；预检通过后为「已通过」，执行投放仅处理「已通过」行。
              执行结果将实时回写到多维表格的 status 和 message 列，并通过飞书卡片通知触发者。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BitableImportPanel
              orgIds={selected}
              onResult={(accountResults) => {
                setResult({ account_results: accountResults } as OceanEngineBatchCreateAdsResponse)
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* 手动配置模式 - 步骤② */}
      {inputMode === 'manual' && (
        <Card>
          <CardHeader>
            <CardTitle>② 投放广告主账户 ID</CardTitle>
            <CardDescription>
              填写实际要创建广告的<strong>广告主账户 ID</strong>，每行一个。
              这些是步骤①对应组织下可操作的子广告主 ID，与组织 ID 不同，请勿混淆。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="account-ids">投放账户列表（每行一个）</Label>
              <Textarea
                id="account-ids"
                className="font-mono text-sm min-h-[140px]"
                placeholder="例如：&#10;1234567890&#10;0987654321"
                value={accountIdsText}
                onChange={(e) => {
                  setAccountIdsText(e.target.value)
                  // 投放账户列表变更时，若漫剧名称已填则重新查询商品ID
                  if (dramaName.trim()) scheduleProductSearch(dramaName, e.target.value)
                }}
                spellCheck={false}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 步骤③：配置项目与广告 JSON（仅手动模式） */}
      {inputMode === 'manual' && (
        <Card>
          <CardHeader>
            <CardTitle>③ 配置项目与广告</CardTitle>
            <CardDescription>
              对照{' '}
              <a
                href="https://open.oceanengine.com/doc"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                巨量引擎开放平台文档
              </a>{' '}
              填写请求体字段。项目层级负责定向/预算等策略，广告层级负责素材/出价。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 模版选择 */}
            <TemplateSelectorCard
              items={templateCards}
              selectedCode={templateType}
              onSelect={applyTemplate}
            />

            {/* 漫剧快捷配置：模版选定后填写主要投放参数 */}
            <div className="rounded-md border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium">漫剧快捷配置</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">漫剧名称（product_info.titles[0]）</Label>
                  <Input
                    value={dramaName}
                    onChange={(e) => handleDramaNameChange(e.target.value)}
                    placeholder="输入漫剧名称"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">投放身份（native_setting.aweme_id）</Label>
                  <Textarea
                    className="font-mono text-sm min-h-[72px]"
                    value={promoAwemeId}
                    onChange={(e) => {
                      setPromoAwemeId(e.target.value)
                      patchPromotionJson((o) => {
                        const ns = (o.native_setting ?? {}) as Record<string, unknown>
                        ns.aweme_id = e.target.value.trim()
                        o.native_setting = ns
                      })
                    }}
                    placeholder="63279742087"
                    spellCheck={false}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">落地页链接（playlet_series_url_list[0]）</Label>
                  <Textarea
                    className="font-mono text-xs min-h-[60px]"
                    value={promoPlayletUrl}
                    onChange={(e) => {
                      setPromoPlayletUrl(e.target.value)
                      patchPromotionJson((o) => {
                        const pm = o.promotion_materials as Record<string, unknown>
                        const ul = pm?.playlet_series_url_list as string[]
                        if (ul) ul[0] = e.target.value
                      })
                    }}
                    spellCheck={false}
                  />
                </div>
                {templateType === 'puju' && (
                  <div className="space-y-1">
                    <Label className="text-xs">ROI系数（delivery_setting.roi_goal）</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      value={roiCoeff}
                      onChange={(e) => {
                        setRoiCoeff(e.target.value)
                        const num = parseFloat(e.target.value)
                        if (!isNaN(num)) {
                          patchProjectJson([{ path: ['delivery_setting', 'roi_goal'], value: num }])
                        }
                      }}
                      placeholder="0.9"
                    />
                  </div>
                )}
              </div>
              {/* 视频素材状态 */}
              {/* <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">视频素材：</span>
                {committedVideos.length > 0 ? (
                  <span className="text-green-600 font-medium">
                    已确认 {committedVideos.length} 个 → 提交时创建{' '}
                    {Math.ceil(committedVideos.length / materialsPerUnit)} 个单元
                  </span>
                ) : (
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setShowVideoSelector(true)}
                  >
                    暂未选取，点此展开选择器 →
                  </button>
                )}
              </div> */}
            </div>

            {/* 项目快捷参数 */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-md border bg-muted/30">
              <p className="col-span-2 text-xs text-muted-foreground">
                项目快捷参数（修改后自动同步至 JSON）
              </p>
              <div className="space-y-1">
                <Label className="text-xs">项目名称（name）</Label>
                <Input
                  value={projName}
                  onChange={(e) => {
                    setProjName(e.target.value)
                    patchProjectJson([{ path: ['name'], value: e.target.value }])
                  }}
                  placeholder="输入项目名称"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">日预算（delivery_setting.budget）</Label>
                <Input
                  type="number"
                  min={100}
                  value={projBudget}
                  onChange={(e) => {
                    setProjBudget(e.target.value)
                    const num = parseInt(e.target.value, 10)
                    if (!isNaN(num)) {
                      patchProjectJson([{ path: ['delivery_setting', 'budget'], value: num }])
                    }
                  }}
                  placeholder="300"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">商品平台 ID（product_platform_id）</Label>
                <Input
                  value={projProductPlatformId}
                  onChange={(e) => {
                    setProjProductPlatformId(e.target.value)
                    patchProjectJson([
                      { path: ['related_product', 'product_platform_id'], value: e.target.value }
                    ])
                  }}
                  placeholder="2054178541160228"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  商品 ID（product_id）
                  <span className="ml-1.5 text-muted-foreground font-normal">
                    — 根据漫剧名称自动查询
                  </span>
                </Label>
                <div className="relative">
                  <Input
                    value={projProductId}
                    onChange={(e) => {
                      setProjProductId(e.target.value)
                      patchProjectJson([
                        { path: ['related_product', 'product_id'], value: e.target.value }
                      ])
                    }}
                    placeholder={productSearching ? '查询中…' : '输入漫剧名称后自动填入'}
                    className={productSearching ? 'pr-8' : ''}
                  />
                  {productSearching && (
                    <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>

            {/* 视频素材选取器 */}
            <div className="rounded-md border">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                onClick={() => setShowVideoSelector((v) => !v)}
              >
                <span className="flex items-center gap-2">
                  选取视频素材
                  {selectedVideoMap.size > 0 && (
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      已勾选 {selectedVideoMap.size}
                    </span>
                  )}
                  {committedVideos.length > 0 && (
                    <span className="text-xs bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded">
                      已确认 {committedVideos.length}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                    showVideoSelector ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {showVideoSelector && (
                <div className="border-t p-4 space-y-3">
                  {/* 广告主 ID + 时间区间 */}
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-0 space-y-1">
                      <Label className="text-xs">查询广告主 ID（默认取步骤②第一行）</Label>
                      <Input
                        value={videoAdvertiserId}
                        onChange={(e) => setVideoAdvertiserId(e.target.value)}
                        placeholder={parseAccountLines(accountIdsText)[0] ?? '输入广告主 ID'}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1 shrink-0">
                      <Label className="text-xs">创建时间起</Label>
                      <Input
                        type="date"
                        value={videoStartTime}
                        onChange={(e) => setVideoStartTime(e.target.value)}
                        className="text-xs w-36"
                      />
                    </div>
                    <div className="space-y-1 shrink-0">
                      <Label className="text-xs">创建时间止</Label>
                      <Input
                        type="date"
                        value={videoEndTime}
                        onChange={(e) => setVideoEndTime(e.target.value)}
                        className="text-xs w-36"
                      />
                    </div>
                    <div className="space-y-1 shrink-0">
                      <Label className="text-xs">每页数量</Label>
                      <div className="flex rounded-md border overflow-hidden text-xs">
                        {([20, 50, 100] as const).map((n) => (
                          <button
                            key={n}
                            type="button"
                            className={`px-3 py-1.5 transition-colors ${
                              videoPageSize === n
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted/60'
                            }`}
                            onClick={() => {
                              setVideoPageSize(n)
                              void fetchVideoMaterials(1, n)
                            }}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={videoLoading || videoAutoSelecting}
                      onClick={() => void fetchVideoMaterials(1)}
                    >
                      {videoLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          加载中
                        </>
                      ) : (
                        '拉取视频'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="shrink-0"
                      disabled={
                        videoAutoSelecting || videoLoading || effectiveMaterialKeywords.length === 0
                      }
                      title={
                        effectiveMaterialKeywords.length === 0
                          ? '请填写素材关键字或漫剧名称'
                          : '按素材关键字（可多组，| 分隔）匹配文件名并自动选取'
                      }
                      onClick={() => void autoSelectVideos()}
                    >
                      {videoAutoSelecting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          选取中…
                        </>
                      ) : (
                        '自动选取'
                      )}
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">素材关键字</Label>
                    <Input
                      value={materialKeywordsInput}
                      onChange={(e) => setMaterialKeywordsInput(e.target.value)}
                      placeholder={
                        dramaName.trim()
                          ? `默认与漫剧名称一致，可改为：${dramaName.trim()}|别名`
                          : '填写漫剧名称后自动填入，或使用关键字1|关键字2'
                      }
                      className="text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      随漫剧名称更新；多个关键字用 <span className="font-mono">|</span>{' '}
                      分隔。自动选取时：每个关键字分别匹配文件名，结果合并去重。
                    </p>
                  </div>

                  {/* 视频列表和分页 */}
                  {videoList.length > 0 && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {videoList.map((v) => {
                          const checked = selectedVideoMap.has(v.id)
                          const coverId = computeVideoCoverId(v.poster_url)
                          const isLandscape = v.width > v.height
                          return (
                            <div
                              key={v.id}
                              role="button"
                              tabIndex={0}
                              className={`relative rounded-lg border cursor-pointer overflow-hidden transition-colors ${
                                checked
                                  ? 'border-primary ring-1 ring-primary'
                                  : 'hover:border-primary/50'
                              }`}
                              onClick={() => toggleVideoItem(v)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  toggleVideoItem(v)
                                }
                              }}
                            >
                              {/* 缩略图 */}
                              <div
                                className={`bg-muted relative ${isLandscape ? 'aspect-video' : 'aspect-[9/16]'}`}
                              >
                                <img
                                  src={v.poster_url}
                                  alt={v.filename}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                                {/* 方向标识 */}
                                <span
                                  className={`absolute top-1.5 left-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                    isLandscape
                                      ? 'bg-amber-500/90 text-white'
                                      : 'bg-blue-500/90 text-white'
                                  }`}
                                >
                                  {isLandscape ? '横版' : '竖版'}
                                </span>
                                {checked && (
                                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                    <CheckCircle className="w-8 h-8 text-primary" />
                                  </div>
                                )}
                              </div>
                              {/* 信息 */}
                              <div className="p-2 space-y-1 text-xs">
                                <div className="font-medium truncate" title={v.filename}>
                                  {v.filename}
                                </div>
                                <div className="text-muted-foreground truncate">
                                  {v.width}×{v.height} · {String(v.material_id)}
                                </div>
                                <div
                                  className="text-muted-foreground font-mono truncate"
                                  title={v.id}
                                >
                                  video_id：{v.id}
                                </div>
                                <div
                                  className="text-muted-foreground font-mono truncate break-all"
                                  title={coverId}
                                >
                                  cover：{coverId}
                                </div>
                                <a
                                  href={v.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline block truncate"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  预览视频
                                </a>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* 分页 */}
                      {videoPagination && videoPagination.total_page > 1 && (
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs text-muted-foreground">
                            共 {videoPagination.total_number} 个，第 {videoPage}/
                            {videoPagination.total_page} 页
                          </span>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={videoPage <= 1 || videoLoading}
                              onClick={() => void fetchVideoMaterials(videoPage - 1)}
                            >
                              上一页
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={videoPage >= videoPagination.total_page || videoLoading}
                              onClick={() => void fetchVideoMaterials(videoPage + 1)}
                            >
                              下一页
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* 确认按鈕 */}
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          disabled={selectedVideoMap.size === 0}
                          onClick={applySelectedVideos}
                        >
                          确认选用这些视频（{selectedVideoMap.size}）
                        </Button>
                        {selectedVideoMap.size > 0 && (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                            onClick={() => setSelectedVideoMap(new Map())}
                          >
                            清空选中
                          </button>
                        )}
                        {committedVideos.length > 0 && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            已确认 {committedVideos.length} 个视频 → 将创建{' '}
                            {Math.ceil(committedVideos.length / materialsPerUnit)} 个单元
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          提交时按每 {materialsPerUnit} 个视频自动拆分为多个广告单元
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 单元进阶参数 */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-md border bg-muted/30">
              <p className="col-span-2 text-xs text-muted-foreground">
                单元进阶参数（修改后自动同步至 JSON）
              </p>
              <div className="space-y-1">
                <Label className="text-xs">单元名称（name）</Label>
                <Input
                  value={promoName}
                  onChange={(e) => {
                    setPromoName(e.target.value)
                    patchPromotionJson((o) => {
                      o.name = e.target.value
                    })
                  }}
                  placeholder="输入广告单元名称"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">单元素材数（每单元最多视频数，默认 10）</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={materialsPerUnit}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10)
                    if (!isNaN(v) && v >= 1 && v <= 30) setMaterialsPerUnit(v)
                  }}
                  placeholder="10"
                />
              </div>
            </div>

            {/* 高级设置（折叠） */}
            <div className="rounded-md border">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                <span>高级设置</span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                    showAdvanced ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {showAdvanced && (
                <div className="border-t px-4 py-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="project-path">项目 API 路径</Label>
                      <Input
                        id="project-path"
                        value={projectPath}
                        onChange={(e) => setProjectPath(e.target.value)}
                        placeholder={DEFAULT_PROJECT_PATH}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="promotion-path">广告 API 路径</Label>
                      <Input
                        id="promotion-path"
                        value={promotionPath}
                        onChange={(e) => setPromotionPath(e.target.value)}
                        placeholder={DEFAULT_PROMOTION_PATH}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  排队/执行中…
                </>
              ) : (
                `提交批量创建（${selected.size > 0 ? selected.size + ' 个账户' : '请先选择账户'}）`
              )}
            </Button>

            {/* JSON 预览（请求体可直接编辑） */}
            <div className="space-y-1">
              <Label htmlFor="project-json" className="text-sm font-medium">
                创建项目请求体预览（JSON）
              </Label>
              <Textarea
                id="project-json"
                className="font-mono text-sm min-h-[300px]"
                value={projectJson}
                onChange={(e) => setProjectJson(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="promotion-json" className="text-sm font-medium">
                创建广告请求体预览（JSON）
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  （project_id / advertiser_id 系统自动注入）
                </span>
              </Label>
              <Textarea
                id="promotion-json"
                className="font-mono text-sm min-h-[400px]"
                value={promotionJson}
                onChange={(e) => setPromotionJson(e.target.value)}
                spellCheck={false}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 执行结果（手动模式）*/}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>执行结果</CardTitle>
            <CardDescription>
              每个账户独立执行两步：创建项目 → 创建广告；项目创建失败时跳过广告步骤。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">广告主 ID</th>
                    <th className="text-left p-3 font-medium">状态</th>
                    <th className="text-left p-3 font-medium">项目结果</th>
                    <th className="text-left p-3 font-medium">广告单元结果</th>
                    <th className="text-left p-3 font-medium">说明</th>
                  </tr>
                </thead>
                <tbody>
                  {result.account_results.map((r) => {
                    const projectId =
                      r.project.data &&
                      !Array.isArray(r.project.data) &&
                      typeof r.project.data === 'object'
                        ? (r.project.data as Record<string, unknown>).project_id
                        : undefined
                    return (
                      <tr key={r.advertiser_id} className="border-b last:border-0 align-top">
                        <td className="p-3 font-mono text-xs whitespace-nowrap">
                          {r.advertiser_id}
                        </td>
                        <td className="p-3">
                          {r.success ? (
                            <span className="inline-flex gap-1 items-center text-green-600">
                              <CheckCircle className="w-4 h-4 shrink-0" /> 成功
                            </span>
                          ) : (
                            <span className="inline-flex gap-1 items-center text-destructive">
                              <XCircle className="w-4 h-4 shrink-0" /> 失败
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-xs">
                          <div className="font-mono">code {r.project.code ?? '—'}</div>
                          {projectId !== undefined && (
                            <div className="font-mono text-green-600 mt-0.5">
                              project_id: {String(projectId)}
                            </div>
                          )}
                          <div className="text-muted-foreground mt-1 max-w-[12rem] break-words">
                            {r.project.message ?? ''}
                          </div>
                        </td>
                        <td className="p-3 text-xs">
                          {r.promotions.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="space-y-1">
                              {r.promotions.map((p, i) => (
                                <div
                                  key={i}
                                  className={`font-mono ${
                                    p.success ? 'text-green-600' : 'text-destructive'
                                  }`}
                                >
                                  单元{i + 1} code {p.code ?? '—'}
                                  {p.message && (
                                    <span className="ml-1 text-muted-foreground font-sans">
                                      ({p.message})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3 max-w-md text-xs break-words">{r.message ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                查看完整 JSON
              </summary>
              <pre className="mt-2 p-3 rounded-md bg-muted text-xs overflow-auto max-h-72">
                {JSON.stringify(result.account_results, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
