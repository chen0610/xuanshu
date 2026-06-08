import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, CheckCircle2, Copy, Loader2, PackagePlus, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea
} from '../../components/ui'
import { configService } from '../../services/config.service'
import { dataAssistantV2Service } from '../../services/ocean-engine.service'
import {
  changduService,
  type ChangduAppendToOceanProductBatchProgressEvent,
  type ChangduAppendToOceanProductBatchResponse,
  type ChangduChannelRow,
  type ChangduOceanProductLibraryItem,
  type ChangduOceanRootOrganizationItem,
  type ChangduPromotionTemplateItem,
  type ChangduSeriesRow
} from '../../services/changdu.service'
import {
  formatBatchAppendRowForCopy,
  getBatchAppendRowKey,
  getSeriesRowKey,
  normalizeBookId,
  normalizeCustomAppendLine,
  parseCustomAppendRows
} from './changdu-ocean-append.utils'

interface ConfigOption {
  id: number
  cookie_name: string
  realname?: string
}

interface OrganizationOption {
  id: string
  name: string
  level: number
  rootId: string
  displayName: string
  keywords: string
}

interface AppendTemplateState {
  bookId: string
  templates: ChangduPromotionTemplateItem[]
  selectedTemplateId: string
  loading: boolean
  error: string
}

interface BatchAppendProgress {
  total: number
  completed: number
  success: number
  failed: number
  skipped: number
  currentName: string
  message: string
  promotionTotal?: number
  promotionCompleted?: number
}

interface CustomOceanBatchAppendButtonProps {
  disabled?: boolean
  buttonLabel?: string
  onCompleted?: () => void
}

const emptyTemplateState = (): AppendTemplateState => ({
  bookId: '',
  templates: [],
  selectedTemplateId: '',
  loading: false,
  error: ''
})

const todayText = (): string => {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const selectedChannelKey = (channel: ChangduChannelRow): string =>
  `${channel.app_type}:${channel.app_id}:${channel.channel}:${channel.distributor_id}`

const getAppTypeLabel = (appType: string): string => {
  if (appType === '21') return '付费漫剧'
  if (appType === '22') return '免费漫剧'
  return `app_type=${appType || '—'}`
}

const DEFAULT_PROMOTION_NAME_TEMPLATE = '{date}-{series_name}-{index}'
const STORAGE_PREFIX = 'changdu.customOceanAppend'
const STORAGE_KEYS = {
  changduConfigId: `${STORAGE_PREFIX}.changduConfigId`,
  channelKey: `${STORAGE_PREFIX}.channelKey`,
  oceanConfigId: `${STORAGE_PREFIX}.oceanConfigId`,
  organizationId: `${STORAGE_PREFIX}.organizationId`,
  libraryPlatformId: `${STORAGE_PREFIX}.libraryPlatformId`,
  copyrightOwner: `${STORAGE_PREFIX}.copyrightOwner`,
  promotionNameTemplate: `${STORAGE_PREFIX}.promotionNameTemplate`
} as const

const readStorage = (key: string): string => {
  try {
    return window.localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

const writeStorage = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore storage errors in restricted environments
  }
}

const readStoredNumber = (key: string): number | null => {
  const value = Number(readStorage(key))
  return Number.isFinite(value) && value > 0 ? value : null
}

const buildPromotionNameFromTemplate = (
  template: string,
  row: ChangduSeriesRow,
  index: number
): string => {
  const fallbackName = row.series_name || row.book_id
  const values: Record<string, string> = {
    date: todayText(),
    series_name: fallbackName,
    book_id: normalizeBookId(row.book_id),
    playlet_id: normalizeBookId(row.playlet_id),
    index: String(index + 1)
  }
  const source = template.trim() || DEFAULT_PROMOTION_NAME_TEMPLATE
  const rendered = source.replace(
    /\{(date|series_name|book_id|playlet_id|index)\}/g,
    (_, key: string) => values[key] || ''
  )
  return rendered.trim() || `${todayText()}-${fallbackName}-${index + 1}`
}

const getTemplateSegmentOneFee = (template: ChangduPromotionTemplateItem): number => {
  const segmentOneProduct = (template.product_list || []).find(
    (product) => Number(product.segment_number) === 1 && product.pay_fee != null
  )
  return segmentOneProduct?.pay_fee ?? Number.POSITIVE_INFINITY
}

const pickPreferredPaidTemplateId = (templates: ChangduPromotionTemplateItem[]): string => {
  if (templates.length === 0) return ''
  const sortedByFee = templates
    .map((template) => ({ template, fee: getTemplateSegmentOneFee(template) }))
    .filter((item) => Number.isFinite(item.fee))
    .sort((a, b) => a.fee - b.fee)

  const preferred = sortedByFee.find((item) => item.fee >= 200 && item.fee <= 500)
  return (preferred || sortedByFee[0])?.template.panel_template_id || templates[0].panel_template_id
}

const pickPreferredLibraryPlatformId = (
  libraries: ChangduOceanProductLibraryItem[],
  appType?: string
): string => {
  if (!libraries.length) return ''
  const keyword = appType === '21' ? '付费' : appType === '22' ? '免费' : ''
  if (!keyword) return libraries[0]?.platformId || ''
  return (
    libraries.find((item) => (item.name || '').includes(keyword))?.platformId ||
    libraries[0]?.platformId ||
    ''
  )
}

const flattenOrganizationTree = (
  node: unknown,
  rootId: string,
  level = 0
): OrganizationOption[] => {
  if (!node || typeof node !== 'object') return []
  const data = node as Record<string, unknown>
  const nodeId = String(data.id || data.ebp_id || '').trim()
  const nodeName = String(data.name || data.ebp_name || data.group_name || nodeId).trim()
  const prefix = level > 0 ? `${'　'.repeat(level)}└ ` : ''
  const children = Array.isArray(data.children) ? data.children : []
  const current = nodeId
    ? [
        {
          id: nodeId,
          name: nodeName || nodeId,
          level,
          rootId,
          displayName: `${prefix}${nodeName || nodeId}（${nodeId}）`,
          keywords: `${nodeName || ''} ${nodeId} ${rootId}`.toLowerCase()
        }
      ]
    : []
  return [
    ...current,
    ...children.flatMap((child) => flattenOrganizationTree(child, rootId, level + 1))
  ]
}

const isTemplateMissing = (state: AppendTemplateState | undefined): boolean => {
  if (!state || state.loading) return false
  if (!normalizeBookId(state.bookId)) return true
  if (state.error) return true
  return state.templates.length === 0
}

const findSelectedTemplate = (
  state: AppendTemplateState | undefined
): ChangduPromotionTemplateItem | undefined =>
  state?.templates.find((item) => item.panel_template_id === state.selectedTemplateId)

const renderTemplatePreview = (template: ChangduPromotionTemplateItem): React.ReactNode => (
  <div className="p-3 space-y-2 text-sm rounded-md border bg-muted/20">
    <div className="flex justify-between">
      <span className="text-muted-foreground">付费起始集数</span>
      <span>{template.start_episode || '—'}集</span>
    </div>
    {(template.product_list || []).map((product) => (
      <div
        key={product.segment_number}
        className="grid grid-cols-4 gap-2 pt-2 border-t border-border/60"
      >
        <span>档位{product.segment_number}</span>
        <span>解锁{product.unlock_episode}集</span>
        <span>折扣{product.discount != null ? product.discount / 100 : '—'}</span>
        <span>{product.pay_fee != null ? `${(product.pay_fee / 100).toFixed(2)}元` : '—'}</span>
      </div>
    ))}
  </div>
)

type StepValue = 1 | 2 | 3 | 4

const ChoiceCard: React.FC<{
  checked: boolean
  title: string
  subtitle?: string
  meta?: string
  onSelect: () => void
}> = ({ checked, title, subtitle, meta, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className={[
      'group relative rounded-lg border px-3 py-2.5 text-left transition-all',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      checked
        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
        : 'border-border bg-card hover:bg-accent/20'
    ].join(' ')}
  >
    <div className="min-w-0 space-y-1">
      <div className="truncate text-sm font-semibold text-foreground">{title}</div>
      {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      {meta && <div className="truncate text-[11px] text-muted-foreground">{meta}</div>}
    </div>
  </button>
)

const StepPill: React.FC<{
  index: StepValue
  label: string
  active: boolean
  done: boolean
  onSelect: () => void
}> = ({ index, label, active, done, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className={[
      'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      active
        ? 'border-primary bg-primary/10 text-primary'
        : done
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
    ].join(' ')}
  >
    {done ? (
      <CheckCircle2 className="h-3.5 w-3.5" />
    ) : (
      <span className="font-semibold">{index}</span>
    )}
    <span>{label}</span>
  </button>
)

const SummaryItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="min-w-0 space-y-0.5">
    <div className="text-[11px] text-muted-foreground">{label}</div>
    <div className="truncate text-sm font-medium">{value}</div>
  </div>
)

export const CustomOceanBatchAppendButton: React.FC<CustomOceanBatchAppendButtonProps> = ({
  disabled = false,
  buttonLabel = '批量添加到巨量商品库(自定义)',
  onCompleted
}) => {
  const [open, setOpen] = useState(false)
  const [activeStep, setActiveStep] = useState<StepValue>(1)
  const [customInput, setCustomInput] = useState('')
  const [customError, setCustomError] = useState('')
  const [rows, setRows] = useState<ChangduSeriesRow[]>([])

  const [changduConfigs, setChangduConfigs] = useState<ConfigOption[]>([])
  const [loadingChangduConfigs, setLoadingChangduConfigs] = useState(false)
  const [selectedChangduConfigId, setSelectedChangduConfigId] = useState<number | null>(() =>
    readStoredNumber(STORAGE_KEYS.changduConfigId)
  )
  const [channels, setChannels] = useState<ChangduChannelRow[]>([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [selectedChannelValue, setSelectedChannelValue] = useState(() =>
    readStorage(STORAGE_KEYS.channelKey)
  )

  const [oceanConfigs, setOceanConfigs] = useState<ConfigOption[]>([])
  const [loadingOceanConfigs, setLoadingOceanConfigs] = useState(false)
  const [selectedOceanConfigId, setSelectedOceanConfigId] = useState<number | null>(() =>
    readStoredNumber(STORAGE_KEYS.oceanConfigId)
  )

  const [organizationSearch, setOrganizationSearch] = useState('')
  const [organizationId, setOrganizationId] = useState(() =>
    readStorage(STORAGE_KEYS.organizationId)
  )
  const [organizationOptions, setOrganizationOptions] = useState<OrganizationOption[]>([])
  const [rootOrganizations, setRootOrganizations] = useState<ChangduOceanRootOrganizationItem[]>([])
  const [organizationLoading, setOrganizationLoading] = useState(false)
  const [organizationError, setOrganizationError] = useState('')

  const [libraries, setLibraries] = useState<ChangduOceanProductLibraryItem[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [selectedLibraryPlatformId, setSelectedLibraryPlatformId] = useState(() =>
    readStorage(STORAGE_KEYS.libraryPlatformId)
  )

  const [appendTemplates, setAppendTemplates] = useState<ChangduPromotionTemplateItem[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateStates, setTemplateStates] = useState<Record<string, AppendTemplateState>>({})
  const [templateLoading, setTemplateLoading] = useState(false)

  const [copyrightOwner, setCopyrightOwner] = useState(
    () => readStorage(STORAGE_KEYS.copyrightOwner) || '番茄'
  )
  const [promotionNameTemplate, setPromotionNameTemplate] = useState(
    () => readStorage(STORAGE_KEYS.promotionNameTemplate) || DEFAULT_PROMOTION_NAME_TEMPLATE
  )
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<BatchAppendProgress | null>(null)
  const [result, setResult] = useState<ChangduAppendToOceanProductBatchResponse | null>(null)
  const autoLoadedLibraryKeysRef = useRef<Set<string>>(new Set())

  const selectedChannel =
    channels.find((item) => selectedChannelKey(item) === selectedChannelValue) || null
  const selectedChangduConfig =
    changduConfigs.find((item) => item.id === selectedChangduConfigId) || null
  const selectedOceanConfig = oceanConfigs.find((item) => item.id === selectedOceanConfigId) || null
  const isPaidBatch = selectedChannel?.app_type === '21'
  const normalizedSearch = organizationSearch.trim().toLowerCase()
  const filteredOrganizations = normalizedSearch
    ? organizationOptions.filter((item) => item.keywords.includes(normalizedSearch))
    : organizationOptions
  const failedItems = result?.items.filter((item) => item.status === 'failed') ?? []
  const selectedOrganization =
    organizationOptions.find((item) => item.id === organizationId) || null
  const selectedLibrary =
    libraries.find((item) => item.platformId === selectedLibraryPlatformId) || null
  const currentStep = activeStep
  const rowMap = useMemo(
    () => Object.fromEntries(rows.map((row) => [getBatchAppendRowKey(row), row])),
    [rows]
  )

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    ;(async (): Promise<void> => {
      setLoadingChangduConfigs(true)
      setLoadingOceanConfigs(true)
      try {
        const [changduList, oceanList] = await Promise.all([
          configService.getConfigsBySource(3),
          configService.getConfigsBySource(1)
        ])
        if (cancelled) return
        setChangduConfigs(changduList)
        setOceanConfigs(oceanList)
        setSelectedChangduConfigId((prev) => {
          if (prev != null && changduList.some((item) => item.id === prev)) return prev
          return changduList[0]?.id ?? null
        })
        setSelectedOceanConfigId((prev) => {
          if (prev != null && oceanList.some((item) => item.id === prev)) return prev
          return oceanList[0]?.id ?? null
        })
      } catch (err) {
        console.error(err)
        if (!cancelled) toast.error('加载配置失败')
      } finally {
        if (!cancelled) {
          setLoadingChangduConfigs(false)
          setLoadingOceanConfigs(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open || !selectedChangduConfigId) return undefined
    let cancelled = false
    ;(async (): Promise<void> => {
      setLoadingChannels(true)
      try {
        const res = await changduService.getChannels(selectedChangduConfigId)
        if (cancelled) return
        setChannels(res.items)
        setSelectedChannelValue((prev) =>
          prev && res.items.some((item) => selectedChannelKey(item) === prev)
            ? prev
            : res.items[0]
              ? selectedChannelKey(res.items[0])
              : ''
        )
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setChannels([])
          setSelectedChannelValue('')
          toast.error('加载常读渠道失败')
        }
      } finally {
        if (!cancelled) setLoadingChannels(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, selectedChangduConfigId])

  useEffect(() => {
    setOrganizationOptions([])
    setRootOrganizations([])
    setLibraries([])
    autoLoadedLibraryKeysRef.current.clear()
    setOrganizationError('')
  }, [selectedOceanConfigId])

  useEffect(() => {
    if (selectedChangduConfigId != null) {
      writeStorage(STORAGE_KEYS.changduConfigId, String(selectedChangduConfigId))
    }
  }, [selectedChangduConfigId])

  useEffect(() => {
    if (selectedChannelValue) writeStorage(STORAGE_KEYS.channelKey, selectedChannelValue)
  }, [selectedChannelValue])

  useEffect(() => {
    if (selectedOceanConfigId != null) {
      writeStorage(STORAGE_KEYS.oceanConfigId, String(selectedOceanConfigId))
    }
  }, [selectedOceanConfigId])

  useEffect(() => {
    if (organizationId) writeStorage(STORAGE_KEYS.organizationId, organizationId)
  }, [organizationId])

  useEffect(() => {
    if (selectedLibraryPlatformId) {
      writeStorage(STORAGE_KEYS.libraryPlatformId, selectedLibraryPlatformId)
    }
  }, [selectedLibraryPlatformId])

  useEffect(() => {
    writeStorage(STORAGE_KEYS.copyrightOwner, copyrightOwner)
  }, [copyrightOwner])

  useEffect(() => {
    writeStorage(STORAGE_KEYS.promotionNameTemplate, promotionNameTemplate)
  }, [promotionNameTemplate])

  useEffect(() => {
    if (!open || !selectedOceanConfigId || organizationOptions.length > 0 || organizationLoading)
      return
    void loadOrganizations()
  }, [open, selectedOceanConfigId, organizationOptions.length, organizationLoading])

  useEffect(() => {
    if (
      !open ||
      !selectedOceanConfigId ||
      !organizationId ||
      libraries.length > 0 ||
      libraryLoading
    )
      return
    const autoLoadKey = `${selectedOceanConfigId}:${organizationId}`
    if (autoLoadedLibraryKeysRef.current.has(autoLoadKey)) return
    autoLoadedLibraryKeysRef.current.add(autoLoadKey)
    void loadLibraries(organizationId)
  }, [open, selectedOceanConfigId, organizationId, libraries.length, libraryLoading])

  const handleInputChange = (value: string): void => {
    setCustomInput(value.split(/\r?\n/).map(normalizeCustomAppendLine).join('\n'))
    setCustomError('')
  }

  const resetRunState = (): void => {
    setRows([])
    setTemplateStates({})
    setAppendTemplates([])
    setSelectedTemplateId('')
    setProgress(null)
    setResult(null)
  }

  const loadBatchTemplates = async (targetRows: ChangduSeriesRow[]): Promise<void> => {
    if (!selectedChangduConfigId || !selectedChannel) return
    const validRows = targetRows.filter((row) => normalizeBookId(row.book_id))
    if (validRows.length === 0) {
      toast.error('没有有效的漫剧 ID 可加载充值模板')
      return
    }

    setTemplateLoading(true)
    setTemplateStates(
      Object.fromEntries(
        validRows.map((row) => [
          getSeriesRowKey(row),
          { ...emptyTemplateState(), bookId: normalizeBookId(row.book_id), loading: true }
        ])
      )
    )
    try {
      const res = await changduService.getPromotionTemplatesBatchStream(
        {
          config_id: selectedChangduConfigId,
          book_ids: validRows.map((row) => normalizeBookId(row.book_id)),
          distributor_id: selectedChannel.distributor_id,
          app_id: selectedChannel.app_id,
          app_type: selectedChannel.app_type as '21' | '22'
        },
        () => undefined
      )
      const updates = validRows.map((row, index) => {
        const item = res.items[index]
        const templates = item?.templates || []
        return [
          getSeriesRowKey(row),
          item?.status === 'success'
            ? {
                bookId: normalizeBookId(item.book_id || row.book_id),
                templates,
                selectedTemplateId: pickPreferredPaidTemplateId(templates),
                loading: false,
                error: ''
              }
            : {
                ...emptyTemplateState(),
                bookId: normalizeBookId(item?.book_id || row.book_id),
                loading: false,
                error: item?.error_message || '加载推广模板失败'
              }
        ] as const
      })
      setTemplateStates(Object.fromEntries(updates))
      if (res.failed > 0)
        toast.warning(`充值模板加载完成：成功 ${res.success} 条，失败 ${res.failed} 条`)
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || '批量加载推广模板失败'
      toast.error(msg)
      setTemplateStates(
        Object.fromEntries(
          validRows.map((row) => [
            getSeriesRowKey(row),
            {
              ...emptyTemplateState(),
              bookId: normalizeBookId(row.book_id),
              loading: false,
              error: msg
            }
          ])
        )
      )
    } finally {
      setTemplateLoading(false)
    }
  }

  const loadSingleTemplate = async (row: ChangduSeriesRow): Promise<void> => {
    if (!selectedChangduConfigId || !selectedChannel) return
    setTemplateLoading(true)
    try {
      const res = await changduService.getPromotionTemplates({
        config_id: selectedChangduConfigId,
        book_id: row.book_id,
        distributor_id: selectedChannel.distributor_id,
        app_id: selectedChannel.app_id,
        app_type: selectedChannel.app_type as '21' | '22'
      })
      setAppendTemplates(res.templates)
      setSelectedTemplateId(res.templates[0]?.panel_template_id || '')
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || '加载推广模板失败')
    } finally {
      setTemplateLoading(false)
    }
  }

  const goConfigure = async (): Promise<void> => {
    if (!selectedChangduConfigId || !selectedChannel) {
      toast.error('请选择常读账号和渠道')
      return
    }
    const parsed = parseCustomAppendRows(customInput)
    if (parsed.errors.length > 0) {
      setCustomError(parsed.errors.slice(0, 3).join('；'))
      return
    }
    if (parsed.rows.length === 0) {
      setCustomError('请至少输入一组短剧名,短剧ID,专辑ID')
      return
    }
    resetRunState()
    setRows(parsed.rows)
    if (selectedChannel.app_type === '21') {
      await loadBatchTemplates(parsed.rows)
    } else {
      await loadSingleTemplate(parsed.rows[0])
    }
    setActiveStep(3)
  }

  const loadOrganizations = async (): Promise<void> => {
    if (!selectedOceanConfigId) {
      toast.error('请选择巨量 Cookie 配置')
      return
    }
    setOrganizationLoading(true)
    setOrganizationError('')
    try {
      const res = await changduService.getOceanRootOrganizations({
        ocean_config_id: selectedOceanConfigId
      })
      setRootOrganizations(res.items)
      const rootOptions = res.items.map((item) => {
        const rootName = item.rootName || item.companyName || item.rootId
        return {
          id: item.rootId,
          name: rootName,
          level: 0,
          rootId: item.rootId,
          displayName: `${rootName}（${item.rootId}）`,
          keywords: `${rootName} ${item.rootId}`.toLowerCase()
        }
      })
      const treeResults = await Promise.all(
        res.items.map(async (item) => {
          const result = await dataAssistantV2Service.getOrganizationTree(
            selectedOceanConfigId,
            item.rootId
          )
          if (result.code === 0 && result.data)
            return flattenOrganizationTree(result.data, item.rootId, 1)
          return [] as OrganizationOption[]
        })
      )
      const merged = rootOptions.concat(treeResults.flat())
      setOrganizationOptions(merged)
      setOrganizationId((prev) => {
        if (prev && merged.some((item) => item.id === prev)) return prev
        return merged[0]?.id || ''
      })
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || '获取组织树失败'
      setOrganizationError(msg)
      setRootOrganizations([])
      setOrganizationOptions([])
      setOrganizationId('')
    } finally {
      setOrganizationLoading(false)
    }
  }

  const loadLibraries = async (organizationIdOverride?: string): Promise<void> => {
    if (!selectedOceanConfigId) {
      toast.error('请选择巨量 Cookie 配置')
      return
    }
    const targetOrganizationId = (organizationIdOverride ?? organizationId).trim()
    if (!targetOrganizationId) {
      toast.error('请选择组织')
      return
    }
    setLibraryLoading(true)
    try {
      const res = await changduService.getOceanProductLibraries({
        ocean_config_id: selectedOceanConfigId,
        organization_id: targetOrganizationId
      })
      setLibraries(res.items)
      setSelectedLibraryPlatformId((prev) => {
        if (prev && res.items.some((item) => item.platformId === prev)) return prev
        return pickPreferredLibraryPlatformId(res.items, selectedChannel?.app_type)
      })
      if (res.items.length === 0) toast.warning('当前组织下未查询到可用商品库')
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || '加载商品库列表失败')
    } finally {
      setLibraryLoading(false)
    }
  }

  const setRowTemplateId = (rowKey: string, templateId: string): void => {
    setTemplateStates((prev) => ({
      ...prev,
      [rowKey]: { ...(prev[rowKey] || emptyTemplateState()), selectedTemplateId: templateId }
    }))
  }

  const isRowSubmittable = (row: ChangduSeriesRow): boolean => {
    if (!normalizeBookId(row.book_id) || !normalizeBookId(row.playlet_id)) return false
    if (!isPaidBatch) return Boolean(selectedTemplateId)
    const state = templateStates[getSeriesRowKey(row)]
    return Boolean(state?.selectedTemplateId) && !isTemplateMissing(state)
  }

  const submit = async (): Promise<void> => {
    if (!selectedChangduConfigId || !selectedChannel || !selectedOceanConfigId) return
    if (!organizationId.trim()) {
      toast.error('请选择组织')
      return
    }
    if (!selectedLibraryPlatformId) {
      toast.error('请选择目标商品库')
      return
    }
    const targetRows = rows.filter(isRowSubmittable)
    if (targetRows.length === 0) {
      toast.error('没有可追加的短剧，请检查短剧ID、专辑ID和模板配置')
      return
    }

    setSubmitting(true)
    setProgress({
      total: targetRows.length,
      completed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      currentName: '批量提交中...',
      message: '正在提交批量任务...'
    })
    try {
      const res = await changduService.appendSeriesBatchToOceanProductLibraryStream(
        {
          changdu_config_id: selectedChangduConfigId,
          ocean_config_id: selectedOceanConfigId,
          organization_id: organizationId.trim(),
          platform_id: selectedLibraryPlatformId,
          distributor_id: selectedChannel.distributor_id,
          copyright_owner: copyrightOwner.trim() || '番茄',
          app_id: selectedChannel.app_id,
          app_type: selectedChannel.app_type as '21' | '22',
          items: targetRows.map((row, index) => ({
            book_id: row.book_id,
            playlet_id: row.playlet_id,
            purchase_panel_template_id: isPaidBatch
              ? templateStates[getSeriesRowKey(row)]?.selectedTemplateId || ''
              : selectedTemplateId,
            promotion_name: buildPromotionNameFromTemplate(promotionNameTemplate, row, index)
          }))
        },
        (event: ChangduAppendToOceanProductBatchProgressEvent) => {
          if (event.type !== 'progress' && event.type !== 'info' && event.type !== 'summary') return
          const data = event.data || {}
          setProgress((prev) => ({
            total: data.total ?? prev?.total ?? targetRows.length,
            completed: data.completed ?? prev?.completed ?? 0,
            success: data.success ?? prev?.success ?? 0,
            failed: data.failed ?? prev?.failed ?? 0,
            skipped: data.skipped ?? prev?.skipped ?? 0,
            currentName: data.current_name ?? prev?.currentName ?? '',
            message: event.message ?? prev?.message ?? '处理中...',
            promotionTotal: data.promotion_total ?? prev?.promotionTotal,
            promotionCompleted: data.promotion_completed ?? prev?.promotionCompleted
          }))
        }
      )
      setResult(res)
      setProgress({
        total: res.total,
        completed: res.total,
        success: res.success,
        failed: res.failed,
        skipped: res.skipped,
        currentName: '',
        message: `批量添加完成：成功 ${res.success} 条，失败 ${res.failed} 条，跳过 ${res.skipped} 条`
      })
      if (res.failed > 0) {
        toast.warning(`批量添加完成：成功 ${res.success} 条，失败 ${res.failed} 条`)
      } else {
        toast.success(`批量添加完成：成功 ${res.success} 条`)
        onCompleted?.()
      }
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || '添加到巨量商品库失败')
    } finally {
      setSubmitting(false)
    }
  }

  const copyFailedRows = async (): Promise<void> => {
    if (failedItems.length === 0) return
    const lines = failedItems.map((item) => {
      const row = rowMap[`${item.book_id || ''}::${item.playlet_id || ''}`]
      return row
        ? formatBatchAppendRowForCopy(row)
        : `${item.promotion_name || ''},${item.book_id || ''},${item.playlet_id || ''}`
    })
    await navigator.clipboard.writeText(lines.join('\n'))
    toast.success(`已复制 ${lines.length} 条失败记录`)
  }

  const closeDialog = (): void => {
    if (submitting || templateLoading) return
    setOpen(false)
  }

  const goNextStep = (): void => {
    setActiveStep((prev) => (prev < 4 ? ((prev + 1) as StepValue) : prev))
  }

  const goPrevStep = (): void => {
    setActiveStep((prev) => (prev > 1 ? ((prev - 1) as StepValue) : prev))
  }

  const canGoNext = activeStep < 4 && !submitting && !templateLoading

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <PackagePlus className="mr-2 w-4 h-4" />
        {buttonLabel}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : closeDialog())}>
        <DialogContent
          className="sm:max-w-[720px] max-h-[86vh] overflow-y-auto [&>button.absolute]:hidden"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>批量添加到巨量商品库(自定义)</DialogTitle>
            <DialogDescription>
              每行一组，格式为「短剧名,短剧ID,专辑ID」。会先创建常读推广链，再写入巨量商品库。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/20 p-3">
              <StepPill
                index={1}
                label="账号渠道"
                active={currentStep === 1}
                done={Boolean(selectedChangduConfig && selectedChannel)}
                onSelect={() => setActiveStep(1)}
              />
              <StepPill
                index={2}
                label="短剧数据"
                active={currentStep === 2}
                done={rows.length > 0}
                onSelect={() => setActiveStep(2)}
              />
              <StepPill
                index={3}
                label="商品库配置"
                active={currentStep === 3}
                done={Boolean(selectedLibraryPlatformId)}
                onSelect={() => setActiveStep(3)}
              />
              <StepPill
                index={4}
                label="确认提交"
                active={currentStep === 4}
                done={Boolean(result)}
                onSelect={() => setActiveStep(4)}
              />
            </div>

            {activeStep === 1 ? (
              <>
                <div className="space-y-3">
                  <Label className="text-base font-semibold">选择常读账号配置 *</Label>
                  {loadingChangduConfigs ? (
                    <div className="flex justify-center items-center p-8">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : changduConfigs.length === 0 ? (
                    <div className="p-4 text-center rounded-md border text-muted-foreground">
                      暂无常读配置，请先在配置中心添加常读账号的 Cookie。
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {changduConfigs.map((config) => (
                        <ChoiceCard
                          key={config.id}
                          checked={selectedChangduConfigId === config.id}
                          title={config.cookie_name}
                          subtitle={config.realname || undefined}
                          meta={`配置 ID：${config.id}`}
                          onSelect={() => {
                            resetRunState()
                            setSelectedChangduConfigId(config.id)
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {selectedChangduConfig ? (
                    <p className="text-xs text-muted-foreground">
                      当前选择：
                      {selectedChangduConfig.realname || selectedChangduConfig.cookie_name}
                      （配置 ID：{selectedChangduConfig.id}）
                    </p>
                  ) : null}
                </div>

                {selectedChangduConfigId ? (
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">选择常读渠道 *</Label>
                    {loadingChannels ? (
                      <div className="flex gap-2 items-center text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        正在加载渠道…
                      </div>
                    ) : channels.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {channels.map((channel) => {
                          const channelKey = selectedChannelKey(channel)
                          const channelTitle =
                            channel.nick_name ||
                            channel.distributor_name ||
                            channel.app_name ||
                            '未命名渠道'
                          return (
                            <ChoiceCard
                              key={channelKey}
                              checked={selectedChannelValue === channelKey}
                              title={channelTitle}
                              subtitle={getAppTypeLabel(channel.app_type)}
                              meta={`app_id=${channel.app_id} · channel=${channel.channel || '—'} · distributor_id=${channel.distributor_id}`}
                              onSelect={() => {
                                resetRunState()
                                setSelectedChannelValue(channelKey)
                              }}
                            />
                          )
                        })}
                      </div>
                    ) : (
                      <div className="p-3 text-sm rounded-md border text-muted-foreground">
                        暂无可用渠道，请确认 Cookie 是否有效或账号是否有可用渠道。
                      </div>
                    )}
                    {selectedChannel ? (
                      <p className="text-xs text-muted-foreground">
                        应用：{selectedChannel.app_name || '—'}；渠道：
                        {selectedChannel.nick_name || selectedChannel.distributor_name || '—'}；
                        类型：
                        {getAppTypeLabel(selectedChannel.app_type)}；app_id：
                        {selectedChannel.app_id}
                        ；app_type：{selectedChannel.app_type}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}

            {activeStep === 2 ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="custom-ocean-append-input">短剧数据 *</Label>
                  <Textarea
                    id="custom-ocean-append-input"
                    value={customInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder={
                      '短剧名,短剧ID,专辑ID\n以爱为家，不负余生,7637057900384357438,123456789'
                    }
                    className="min-h-40 font-mono text-sm"
                    disabled={submitting}
                  />
                  {customError ? <p className="text-xs text-destructive">{customError}</p> : null}
                </div>

                {/* <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void goConfigure()}
                    disabled={
                      !customInput.trim() ||
                      templateLoading ||
                      submitting ||
                      !selectedChangduConfigId ||
                      !selectedChannel
                    }
                  >
                    {templateLoading ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
                    解析短剧并加载模板
                  </Button>
                </div> */}

                {rows.length > 0 ? (
                  <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                    <div className="font-medium">已解析 {rows.length} 条短剧</div>
                    <div className="mt-2 max-h-24 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                      {rows.slice(0, 20).map((row) => (
                        <div key={getSeriesRowKey(row)} className="truncate">
                          {row.series_name || row.book_id}（{row.book_id || '—'} /{' '}
                          {row.playlet_id || '—'}）
                        </div>
                      ))}
                      {rows.length > 20 ? <div>还有 {rows.length - 20} 条…</div> : null}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {activeStep === 3 ? (
              <>
                <div className="space-y-1.5">
                  <Label>巨量 Cookie 配置 *</Label>
                  {loadingOceanConfigs ? (
                    <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> 正在加载巨量 Cookie 配置…
                    </div>
                  ) : oceanConfigs.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {oceanConfigs.map((config) => (
                        <ChoiceCard
                          key={config.id}
                          checked={selectedOceanConfigId === config.id}
                          title={config.realname || config.cookie_name}
                          subtitle={config.cookie_name}
                          meta={`配置 ID：${config.id}`}
                          onSelect={() => setSelectedOceanConfigId(config.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-sm rounded-md border text-muted-foreground">
                      暂无可用巨量配置。
                    </div>
                  )}
                  {selectedOceanConfig ? (
                    <p className="text-xs text-muted-foreground">
                      当前选择：{selectedOceanConfig.realname || selectedOceanConfig.cookie_name}
                      （配置 ID：{selectedOceanConfig.id}）
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label>组织 *</Label>
                    <Input
                      value={organizationSearch}
                      onChange={(e) => setOrganizationSearch(e.target.value)}
                      placeholder="支持按组织名称、组织ID模糊搜索"
                      disabled={submitting}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void loadOrganizations()}
                    disabled={organizationLoading || !selectedOceanConfigId || submitting}
                  >
                    {organizationLoading ? (
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    ) : (
                      <Building2 className="mr-2 w-4 h-4" />
                    )}
                    重新加载组织树
                  </Button>
                </div>
                {organizationError ? (
                  <p className="text-xs text-destructive">{organizationError}</p>
                ) : null}
                {rootOrganizations.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    已加载 {rootOrganizations.length} 个根组织。
                  </p>
                ) : null}

                <div className="space-y-1.5">
                  <Label>选择组织 *</Label>
                  <select
                    className="px-3 py-2 w-full text-sm rounded-md border bg-background border-input"
                    value={organizationId}
                    onChange={(e) => {
                      const value = e.target.value
                      setOrganizationId(value)
                      void loadLibraries(value)
                    }}
                    disabled={organizationLoading || organizationOptions.length === 0 || submitting}
                  >
                    <option value="">请选择组织</option>
                    {filteredOrganizations.map((item) => (
                      <option key={`${item.rootId}-${item.id}-${item.level}`} value={item.id}>
                        {item.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void loadLibraries()}
                    disabled={
                      libraryLoading || !selectedOceanConfigId || !organizationId || submitting
                    }
                  >
                    {libraryLoading ? (
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    ) : (
                      <Building2 className="mr-2 w-4 h-4" />
                    )}
                    重新加载商品库
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label>目标商品库 *</Label>
                  {libraryLoading ? (
                    <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> 正在加载商品库…
                    </div>
                  ) : libraries.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {libraries.map((item) => (
                        <ChoiceCard
                          key={item.platformId}
                          checked={selectedLibraryPlatformId === item.platformId}
                          title={item.name || item.platformId}
                          subtitle={item.advertiserName || `advertiserId=${item.advertiserId}`}
                          meta={`platformId=${item.platformId} · storeType=${item.storeType}`}
                          onSelect={() => setSelectedLibraryPlatformId(item.platformId)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-sm rounded-md border text-muted-foreground">
                      暂无商品库，请先选择组织并加载商品库。
                    </div>
                  )}
                </div>

                {isPaidBatch && rows.length > 0 ? (
                  <div className="space-y-3">
                    <Label>每部剧充值模板 *</Label>
                    {rows.map((row) => {
                      const rowKey = getSeriesRowKey(row)
                      const state = templateStates[rowKey] || emptyTemplateState()
                      const selected = findSelectedTemplate(state)
                      return (
                        <div key={rowKey} className="rounded-md border bg-muted/10 p-3 space-y-2">
                          <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <div className="font-medium">{row.series_name || row.book_id}</div>
                            <div className="font-mono text-xs text-muted-foreground break-all">
                              {row.book_id}
                            </div>
                          </div>
                          {state.loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" /> 正在加载充值模板…
                            </div>
                          ) : isTemplateMissing(state) ? (
                            <div className="text-sm text-destructive">
                              {state.error || '未获取到充值模板'}
                            </div>
                          ) : (
                            <>
                              <select
                                className="px-3 py-2 w-full text-sm rounded-md border bg-background border-input"
                                value={state.selectedTemplateId}
                                onChange={(e) => setRowTemplateId(rowKey, e.target.value)}
                                disabled={submitting}
                              >
                                <option value="">请选择充值模板</option>
                                {state.templates.map((item) => (
                                  <option
                                    key={item.panel_template_id}
                                    value={item.panel_template_id}
                                  >
                                    {item.panel_name || item.panel_template_id}
                                  </option>
                                ))}
                              </select>
                              {selected ? renderTemplatePreview(selected) : null}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : rows.length > 0 ? (
                  <div className="space-y-1.5">
                    <Label>推广模板 *</Label>
                    <select
                      className="px-3 py-2 w-full text-sm rounded-md border bg-background border-input"
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      disabled={templateLoading || submitting}
                    >
                      <option value="">请选择模板</option>
                      {appendTemplates.map((item) => (
                        <option key={item.panel_template_id} value={item.panel_template_id}>
                          {item.panel_name || item.panel_template_id}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="custom-ocean-promotion-name-template">推广链名称模板</Label>
                  <Input
                    id="custom-ocean-promotion-name-template"
                    value={promotionNameTemplate}
                    onChange={(e) => setPromotionNameTemplate(e.target.value)}
                    placeholder={DEFAULT_PROMOTION_NAME_TEMPLATE}
                    disabled={submitting}
                  />
                  {/* <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                {[
                  DEFAULT_PROMOTION_NAME_TEMPLATE,
                  '{series_name}-{date}',
                  '漫剧-{series_name}-{index}',
                  '{book_id}-{series_name}'
                ].map((template) => (
                  <Button
                    key={template}
                    type="button"
                    variant={promotionNameTemplate === template ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setPromotionNameTemplate(template)}
                    disabled={submitting}
                  >
                    {template}
                  </Button>
                ))}
              </div> */}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      可用占位符：{'{date}'} 日期、{'{series_name}'} 短剧名、{'{book_id}'} 短剧ID、
                      {'{playlet_id}'} 专辑ID、{'{index}'} 序号。可在模板中加入固定字符。
                    </p>
                    <p>
                      示例：
                      {rows[0]
                        ? buildPromotionNameFromTemplate(promotionNameTemplate, rows[0], 0)
                        : buildPromotionNameFromTemplate(
                            promotionNameTemplate,
                            {
                              book_id: '7637057900384357438',
                              playlet_id: '123456789',
                              series_name: '以爱为家，不负余生',
                              thumb_url: '',
                              create_time: '',
                              category: '',
                              gender: '',
                              creation_status: '',
                              episode_amount: '',
                              estimate_publish_time: '',
                              publish_time: '',
                              publish_status: '',
                              delivery_status: '',
                              permission_status: ''
                            },
                            0
                          )}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="custom-ocean-copyright-owner">版权方</Label>
                  <Input
                    id="custom-ocean-copyright-owner"
                    value={copyrightOwner}
                    onChange={(e) => setCopyrightOwner(e.target.value)}
                    placeholder="默认番茄"
                    disabled={submitting}
                  />
                </div>
              </>
            ) : null}

            {activeStep === 4 ? (
              <>
                {rows.length > 0 ? (
                  <div className="rounded-lg border bg-primary/5 p-3 text-sm">
                    <div className="mb-3 font-semibold text-foreground">提交前摘要</div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <SummaryItem
                        label="常读账号"
                        value={
                          selectedChangduConfig?.realname ||
                          selectedChangduConfig?.cookie_name ||
                          '未选择'
                        }
                      />
                      <SummaryItem
                        label="常读渠道"
                        value={
                          selectedChannel
                            ? `${selectedChannel.nick_name || selectedChannel.distributor_name || selectedChannel.app_name || '未命名渠道'} / ${getAppTypeLabel(selectedChannel.app_type)}`
                            : '未选择'
                        }
                      />
                      <SummaryItem
                        label="巨量账号"
                        value={
                          selectedOceanConfig?.realname ||
                          selectedOceanConfig?.cookie_name ||
                          '未选择'
                        }
                      />
                      <SummaryItem
                        label="组织"
                        value={selectedOrganization?.displayName || organizationId || '未选择'}
                      />
                      <SummaryItem
                        label="商品库"
                        value={selectedLibrary?.name || selectedLibraryPlatformId || '未选择'}
                      />
                      <SummaryItem label="版权方" value={copyrightOwner.trim() || '番茄'} />
                      <SummaryItem label="已解析" value={`${rows.length} 条`} />
                      <SummaryItem
                        label="可提交"
                        value={`${rows.filter(isRowSubmittable).length} 条`}
                      />
                      <SummaryItem
                        label="名称示例"
                        value={buildPromotionNameFromTemplate(promotionNameTemplate, rows[0], 0)}
                      />
                    </div>
                  </div>
                ) : null}

                {progress ? (
                  <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                    <div className="font-medium">
                      处理进度：{progress.completed} / {progress.total}
                      {progress.promotionTotal
                        ? `（推广链 ${progress.promotionCompleted ?? 0} / ${progress.promotionTotal}）`
                        : ''}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      成功 {progress.success} 条，失败 {progress.failed} 条，跳过 {progress.skipped}{' '}
                      条{progress.currentName ? `，当前：${progress.currentName}` : ''}
                    </div>
                    {progress.message ? (
                      <div className="mt-1 text-xs text-muted-foreground">{progress.message}</div>
                    ) : null}
                  </div>
                ) : null}

                {failedItems.length > 0 ? (
                  <div className="space-y-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
                    <div>仍有 {failedItems.length} 条失败项，可复制失败行后重新导入。</div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => void copyFailedRows()}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> 复制失败行
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={submitting || templateLoading}
            >
              关闭
            </Button>
            {activeStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={goPrevStep}
                disabled={submitting || templateLoading}
              >
                上一步
              </Button>
            ) : null}
            {activeStep === 1 ? (
              <Button type="button" onClick={goNextStep} disabled={!canGoNext}>
                下一步：填写短剧数据
              </Button>
            ) : null}
            {activeStep === 2 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void goConfigure()}
                disabled={
                  !customInput.trim() ||
                  templateLoading ||
                  submitting ||
                  !selectedChangduConfigId ||
                  !selectedChannel
                }
              >
                {templateLoading ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
                下一步：解析短剧并加载模板
              </Button>
            ) : null}
            {activeStep === 3 ? (
              <Button type="button" onClick={() => setActiveStep(4)} disabled={!canGoNext}>
                下一步：确认提交
              </Button>
            ) : null}
            {activeStep === 4 ? (
              <Button
                type="button"
                onClick={() => void submit()}
                disabled={
                  submitting ||
                  templateLoading ||
                  rows.length === 0 ||
                  Boolean(result && result.failed === 0)
                }
              >
                {submitting ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
                确认批量追加
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
