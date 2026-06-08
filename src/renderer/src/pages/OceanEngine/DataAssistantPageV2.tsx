import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2,
  Trash2,
  Plus,
  Download,
  XCircle,
  Calendar,
  Edit,
  Search,
  X,
  FileText,
  CheckCircle,
  BarChart3,
  GripVertical,
  Send,
  Camera,
  ChevronDown,
  ChevronRight,
  Save,
  RefreshCw
} from 'lucide-react'
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
  DialogFooter
} from '../../components/ui'
import {
  dataAssistantV2Service,
  dataAssistantV2ConfigService,
  type TagInfo,
  type TagGroup,
  type DataStatisticsResponse,
  type DataAssistantConfig
} from '../../services/ocean-engine.service'
import { configService } from '../../services/config.service'
import { feishuService } from '../../services/feishu.service'
import { toast } from 'sonner'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

export const DataAssistantPageV2: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [activeConfigId, setActiveConfigId] = useState<number | null>(null)
  const [availableTagsMap, setAvailableTagsMap] = useState<Record<number, TagInfo[]>>({})
  const [tagGroupsMap, setTagGroupsMap] = useState<Record<number, TagGroup[]>>({})
  const [additionalTagGroupsMap, setAdditionalTagGroupsMap] = useState<Record<number, TagInfo[]>>(
    {}
  )
  const [queryDate, setQueryDate] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [loadingTags, setLoadingTags] = useState<Record<number, boolean>>({})
  const [statisticsDataMap, setStatisticsDataMap] = useState<
    Record<number, DataStatisticsResponse | null>
  >({})
  const [error, setError] = useState('')
  const [dateError, setDateError] = useState('')
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [logs, setLogs] = useState<
    Array<{ message: string; type: 'info' | 'success' | 'error'; timestamp: Date }>
  >([])
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false)
  const [isStatisticsDialogOpen, setIsStatisticsDialogOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [isSendingToFeishu, setIsSendingToFeishu] = useState(false)
  const [isSendingToFeishuSheet, setIsSendingToFeishuSheet] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null)
  const [editingGroupNameValue, setEditingGroupNameValue] = useState('')
  const [isAccountDetailsCollapsed, setIsAccountDetailsCollapsed] = useState(true)
  const [useKeywordGrouping, setUseKeywordGrouping] = useState(true)
  const [keywordText, setKeywordText] = useState('纯短剧\n纯激励')
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [isLoadingConfig, setIsLoadingConfig] = useState(false)
  const [notification, setNotification] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)
  // 快速组合标签的三个选择组
  const [quickTagSelector1, setQuickTagSelector1] = useState<Record<number, TagInfo[]>>({}) // 投手
  const [quickTagSelector2, setQuickTagSelector2] = useState<Record<number, TagInfo[]>>({}) // 投放类型
  const [quickTagSelector3, setQuickTagSelector3] = useState<Record<number, TagInfo[]>>({}) // 出价类型
  const [quickSelectorSearchTerm1, setQuickSelectorSearchTerm1] = useState<Record<number, string>>(
    {}
  )
  const [quickSelectorSearchTerm2, setQuickSelectorSearchTerm2] = useState<Record<number, string>>(
    {}
  )
  const [quickSelectorSearchTerm3, setQuickSelectorSearchTerm3] = useState<Record<number, string>>(
    {}
  )
  // 组织树相关状态
  const [organizationTree, setOrganizationTree] = useState<any>(null)
  const [selectedOrgNodes, setSelectedOrgNodes] = useState<Array<{ id: string; name: string }>>([])
  const [loadingOrgTree, setLoadingOrgTree] = useState(false)
  const [orgTreeError, setOrgTreeError] = useState('')
  const [ebpId, setEbpId] = useState<string>('1853254961360906')

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  // 按关键字和标签组汇总数据的辅助函数
  const processTagGroupAggregation = (
    stats: Array<{ id: number; data: DataStatisticsResponse | null }>
  ) => {
    // 检查是否启用了关键字分组
    const hasKeywordGrouping = stats.some(({ data }) =>
      data?.data?.group_results?.some((g) => g.keyword || g.group_name.includes(' - '))
    )

    // 按关键字和标签组汇总数据
    const keywordGroupAggregation: Record<
      string,
      Record<
        string,
        {
          accounts: string[]
          tagList: string
          totalCost: number
          totalActive: number
          yesterdayCost: number
          yesterdayActive: number
          yesterdayRetentionCount: number
          history7dCost: number
          history7dNextDayRetention: number
          history7d7dRetention: number
          count: number
        }
      >
    > = {}

    stats.forEach(({ id, data }) => {
      const configName = configs.find((c) => c.id === id)?.cookie_name || `账户${id}`
      const { group_results } = data!.data!

      if (!group_results || !Array.isArray(group_results)) {
        return { result: [], hasKeywordGrouping: false }
      }

      group_results.forEach((group) => {
        let originalGroupName: string
        let keyword: string | undefined

        if (group.keyword) {
          const match = group.group_name.match(/^(.+?) - (.+)$/)
          if (match) {
            originalGroupName = match[1]
            keyword = group.keyword
          } else {
            originalGroupName = group.group_name
            keyword = group.keyword
          }
        } else if (group.group_name.includes(' - ')) {
          const parts = group.group_name.split(' - ')
          originalGroupName = parts[0]
          keyword = parts[1]
        } else {
          originalGroupName = group.group_name
          keyword = undefined
        }

        const keywordKey = keyword || '__no_keyword__'
        const groupNameKey = originalGroupName

        if (!keywordGroupAggregation[keywordKey]) {
          keywordGroupAggregation[keywordKey] = {}
        }

        if (!keywordGroupAggregation[keywordKey][groupNameKey]) {
          keywordGroupAggregation[keywordKey][groupNameKey] = {
            accounts: [],
            tagList: group.tags
              ? group.tags.map((t: any) => t.value).join(', ')
              : group.ebp_id
                ? `组织节点: ${group.ebp_id}`
                : group.group_name || '',
            totalCost: 0,
            totalActive: 0,
            yesterdayCost: 0,
            yesterdayActive: 0,
            yesterdayRetentionCount: 0,
            history7dCost: 0,
            history7dActive: 0,
            history7dNextDayOpenCnt: 0,
            history7dRetention7dCnt: 0,
            history7dNextDayRetention: 0,
            history7d7dRetention: 0,
            count: 0
          }
        }

        const agg = keywordGroupAggregation[keywordKey][groupNameKey]
        if (!agg.accounts.includes(configName)) {
          agg.accounts.push(configName)
        }
        agg.totalCost += group.filter_data.total_cost
        agg.totalActive += group.filter_data.total_active || 0
        agg.yesterdayCost += group.filter_data.yesterday_cost || 0
        agg.yesterdayActive += group.filter_data.yesterday_active || 0

        const yesterdayRetention = (group.filter_data.yesterday_next_day_retention || 0) / 100
        const yesterdayActive = group.filter_data.yesterday_active || 0
        agg.yesterdayRetentionCount += yesterdayRetention * yesterdayActive

        // 累加历史七日的数值字段
        agg.history7dCost += group.filter_data.history_7d_cost || 0
        agg.history7dActive += group.filter_data.history_7d_active || 0
        agg.history7dNextDayOpenCnt +=
          group.filter_data.history_7d_attribution_next_day_open_cnt || 0
        agg.history7dRetention7dCnt +=
          group.filter_data.history_7d_attribution_retention_7d_cnt || 0
        agg.count++
      })
    })

    // 转换为数组，按关键字和标签组名称排序
    const result: Array<{
      keyword?: string
      key: string
      accounts: string[]
      tagList: string
      totalCost: number
      totalActive: number
      yesterdayCost: number
      yesterdayActive: number
      yesterdayRetentionCount: number
      history7dCost: number
      history7dActive: number
      history7dNextDayOpenCnt: number
      history7dRetention7dCnt: number
      history7dNextDayRetention: number
      history7d7dRetention: number
      count: number
      activeCost: number
      yesterdayActiveCost: number
      yesterdayNextRetention: number
      history7dActiveCost: number
      avgHistory7dNextDayRetention: number
      avgHistory7d7dRetention: number
      allocationRatio: number
    }> = []

    const sortedKeywords = Object.keys(keywordGroupAggregation).sort()

    // 先收集所有数据，按投手分组计算分母
    const allEntries: Array<{
      keyword: string
      groupNameKey: string
      keyPart1: string
      keyPart2: string
      keyPart3: string
      value: (typeof keywordGroupAggregation)[string][string]
    }> = []

    sortedKeywords.forEach((keyword) => {
      const groups = keywordGroupAggregation[keyword]
      const groupEntries = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))

      groupEntries.forEach(([groupNameKey, value]) => {
        const parts = groupNameKey.split('-')
        allEntries.push({
          keyword,
          groupNameKey,
          keyPart1: parts[0]?.trim() || groupNameKey,
          keyPart2: parts[1]?.trim() || '总消耗',
          keyPart3: parts[2]?.trim() || '',
          value
        })
      })
    })

    // 按投手分组，计算每个投手组的总消耗行激活数（作为分母）
    const keyPart1Denominators = new Map<string, number>()
    allEntries.forEach((entry) => {
      // 如果出价方式包含"总消耗"，则将其激活数作为该投手的分母
      if (entry.keyPart2.includes('总消耗')) {
        keyPart1Denominators.set(entry.keyPart1, entry.value.totalActive)
      }
    })

    // 构建结果数组
    allEntries.forEach((entry) => {
      const denominator = keyPart1Denominators.get(entry.keyPart1) || 0
      const allocationRatio =
        entry.keyPart2 == ''
          ? 100
          : denominator > 0
            ? (entry.value.totalActive / denominator) * 100
            : 0

      // 计算历史七日成本和留存率（使用累加后的数值）
      const history7dActiveCost =
        entry.value.history7dRetention7dCnt > 0
          ? entry.value.history7dCost / entry.value.history7dRetention7dCnt
          : 0
      const history7dNextDayRetention =
        entry.value.history7dActive > 0
          ? (entry.value.history7dNextDayOpenCnt / entry.value.history7dActive) * 100
          : 0
      const history7d7dRetention =
        entry.value.history7dActive > 0
          ? (entry.value.history7dRetention7dCnt / entry.value.history7dActive) * 100
          : 0

      result.push({
        keyword: entry.keyword === '__no_keyword__' ? undefined : entry.keyword,
        key: entry.groupNameKey,
        ...entry.value,
        activeCost:
          entry.value.totalActive > 0 ? entry.value.totalCost / entry.value.totalActive : 0,
        yesterdayActiveCost:
          entry.value.yesterdayActive > 0
            ? entry.value.yesterdayCost / entry.value.yesterdayActive
            : 0,
        yesterdayNextRetention:
          entry.value.yesterdayActive > 0
            ? (entry.value.yesterdayRetentionCount / entry.value.yesterdayActive) * 100
            : 0,
        history7dActiveCost,
        avgHistory7dNextDayRetention: history7dNextDayRetention,
        avgHistory7d7dRetention: history7d7dRetention,
        allocationRatio
      })
    })

    return { result, hasKeywordGrouping }
  }

  useEffect(() => {
    loadConfigs()
    // 设置默认日期为今天
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    setQueryDate(`${year}-${month}-${day}`)
  }, [])

  // 加载缓存的选中账户
  useEffect(() => {
    const cached = localStorage.getItem('data-assistant-selected-config-id')
    if (cached) {
      try {
        const id = JSON.parse(cached)
        if (typeof id === 'number') {
          setSelectedConfigId(id)
          setActiveConfigId(id)
        }
      } catch (e) {
        console.error('Failed to load cached selected config id:', e)
      }
    }
  }, [])

  // 自动保存选中账户
  useEffect(() => {
    if (selectedConfigId !== null) {
      localStorage.setItem('data-assistant-selected-config-id', JSON.stringify(selectedConfigId))
    }
  }, [selectedConfigId])

  useEffect(() => {
    if (selectedConfigId !== null) {
      const configId = selectedConfigId
      if (!availableTagsMap[configId]) {
        loadTags(configId)
      }
      if (!tagGroupsMap[configId]) {
        loadTagGroupsForConfig(configId)
      }
      // 加载数据助手配置
      loadDataAssistantConfig(configId)
    }
  }, [selectedConfigId])

  // 当选中账户且EBP ID存在时，自动加载组织树
  useEffect(() => {
    if (selectedConfigId !== null && ebpId) {
      loadOrganizationTree(selectedConfigId, ebpId)
    }
  }, [selectedConfigId, ebpId])

  useEffect(() => {
    // 加载缓存的标签组映射
    const cached = localStorage.getItem('data-assistant-tag-groups-map')
    if (cached) {
      try {
        const groupsMap = JSON.parse(cached)
        if (groupsMap && typeof groupsMap === 'object') {
          setTagGroupsMap(groupsMap)
        }
      } catch (e) {
        console.error('Failed to load cached tag groups:', e)
      }
    }

    // 加载缓存的统计数据映射
    const cachedStats = localStorage.getItem('data-assistant-statistics-map')
    if (cachedStats) {
      try {
        const statsMap = JSON.parse(cachedStats)
        if (statsMap && typeof statsMap === 'object') {
          setStatisticsDataMap(statsMap)
        }
      } catch (e) {
        console.error('Failed to load cached statistics:', e)
      }
    }
  }, [])

  // 自动保存标签组映射到localStorage
  useEffect(() => {
    if (Object.keys(tagGroupsMap).length > 0) {
      localStorage.setItem('data-assistant-tag-groups-map', JSON.stringify(tagGroupsMap))
    }
  }, [tagGroupsMap])

  // 自动保存配置到数据库（延迟保存，避免频繁请求）
  useEffect(() => {
    if (selectedConfigId === null || !activeConfigId) return

    const saveTimer = setTimeout(() => {
      // 只保存当前活动账户的配置
      saveDataAssistantConfig(activeConfigId).catch(console.error)
    }, 2000) // 延迟2秒保存，避免频繁请求

    return () => clearTimeout(saveTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tagGroupsMap,
    additionalTagGroupsMap,
    useKeywordGrouping,
    keywordText,
    activeConfigId,
    selectedConfigId
  ])

  // 自动保存统计数据映射到localStorage
  useEffect(() => {
    const hasData = Object.values(statisticsDataMap).some((data) => data !== null)
    if (hasData) {
      localStorage.setItem('data-assistant-statistics-map', JSON.stringify(statisticsDataMap))
    }
  }, [statisticsDataMap])

  const loadConfigs = async (): Promise<void> => {
    try {
      const allConfigs = await configService.getConfigsBySource(1)
      // 只显示名称中包含"-升级版"的账户
      const oceanConfigs = allConfigs.filter(
        (config) => config.cookie_name?.includes('-升级版') || config.realname?.includes('-升级版')
      )
      setConfigs(oceanConfigs)
      if (oceanConfigs.length > 0 && selectedConfigId === null) {
        setSelectedConfigId(oceanConfigs[0].id)
        setActiveConfigId(oceanConfigs[0].id)
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
      setError('加载配置失败')
    }
  }

  const loadTagGroupsForConfig = (configId: number): void => {
    const cachedGroups = tagGroupsMap[configId]
    if (!cachedGroups || cachedGroups.length === 0) {
      // 如果没有缓存，为该配置创建默认的标签组
      const defaultGroup: TagGroup = {
        id: `group_${Date.now()}`,
        name: `标签组 1`,
        tags: []
      }
      setTagGroupsMap((prev) => ({
        ...prev,
        [configId]: [defaultGroup]
      }))
    }
  }

  // 加载组织树
  const loadOrganizationTree = async (configId: number, ebpIdValue: string): Promise<void> => {
    if (!ebpIdValue) {
      setOrgTreeError('请先输入EBP ID')
      return
    }
    setLoadingOrgTree(true)
    setOrgTreeError('')
    try {
      const result = await dataAssistantV2Service.getOrganizationTree(configId, ebpIdValue)
      if (result.code === 0 && result.data) {
        setOrganizationTree(result.data)
      } else {
        setOrgTreeError(result.msg || result.error || '获取组织树失败')
      }
    } catch (err: any) {
      console.error('Failed to load organization tree:', err)
      setOrgTreeError(err.message || '获取组织树失败')
    } finally {
      setLoadingOrgTree(false)
    }
  }

  // 递归处理组织树数据，提取所有children节点
  const processOrgTreeData = (node: any): Array<{ id: string; name: string; children?: any[] }> => {
    const result: Array<{ id: string; name: string; children?: any[] }> = []
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child: any) => {
        result.push({
          id: child.id,
          name: child.name,
          children: child.children
        })
        // 递归处理子节点
        if (child.children && child.children.length > 0) {
          result.push(...processOrgTreeData(child))
        }
      })
    }
    return result
  }

  // 切换组织节点选择
  const toggleOrgNodeSelection = (node: { id: string; name: string }): void => {
    setSelectedOrgNodes((prev) => {
      const exists = prev.find((n) => n.id === node.id)
      if (exists) {
        return prev.filter((n) => n.id !== node.id)
      } else {
        return [...prev, node]
      }
    })
  }

  // 渲染组织树节点
  const renderOrgTreeNode = (node: any, level: number = 0): React.ReactNode => {
    const isSelected = selectedOrgNodes.some((n) => n.id === node.id)
    const hasChildren = node.children && node.children.length > 0

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent cursor-pointer ${
            isSelected ? 'bg-primary/10' : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => toggleOrgNodeSelection({ id: node.id, name: node.name })}
        >
          <div
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
              isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
            }`}
          >
            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>
          <span className="text-sm flex-1">{node.name}</span>
        </div>
        {hasChildren && (
          <div className="ml-4">
            {node.children.map((child: any) => renderOrgTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const loadDataAssistantConfig = async (configId: number): Promise<void> => {
    setIsLoadingConfig(true)
    try {
      const config = await dataAssistantV2ConfigService.getConfig(configId)
      // 加载关键字分组设置
      setUseKeywordGrouping(config.use_keyword_grouping)
      setKeywordText(config.keyword_text || '纯短剧\n纯激励')

      // 加载标签组配置
      const configIdStr = String(configId)
      if (config.tag_groups && config.tag_groups[configIdStr]) {
        setTagGroupsMap((prev) => ({
          ...prev,
          [configId]: config.tag_groups[configIdStr]
        }))
      }

      // 加载附加标签组配置
      if (config.additional_tag_groups) {
        setAdditionalTagGroupsMap((prev) => ({
          ...prev,
          [configId]: config.additional_tag_groups || []
        }))
      }
    } catch (err: any) {
      console.error('Failed to load data assistant config:', err)
      // 如果配置不存在，使用默认值
      if (err.response?.status === 404) {
        // 配置不存在，使用默认值
        setUseKeywordGrouping(false)
        setKeywordText('纯短剧\n纯激励')
      }
    } finally {
      setIsLoadingConfig(false)
    }
  }

  const saveDataAssistantConfig = async (configId: number): Promise<void> => {
    setIsSavingConfig(true)
    try {
      // 清理和验证标签组数据
      const tagGroups = (tagGroupsMap[configId] || [])
        .map((group) => ({
          id: String(group.id || `group_${Date.now()}`),
          name: String(group.name || '未命名标签组'),
          tags: (group.tags || [])
            .map((tag) => ({
              id: String(tag.id || ''),
              value: String(tag.value || '')
            }))
            .filter((tag) => tag.id && tag.value) // 过滤掉无效的标签
        }))
        .filter((group) => group.id && group.name) // 过滤掉无效的标签组

      const configData = {
        use_keyword_grouping: useKeywordGrouping,
        keyword_text: keywordText || null,
        tag_groups: {
          [String(configId)]: tagGroups
        },
        additional_tag_groups:
          (additionalTagGroupsMap[configId] || [])
            .map((tag) => ({
              id: String(tag.id || ''),
              value: String(tag.value || '')
            }))
            .filter((tag) => tag.id && tag.value) || null
      }

      await dataAssistantV2ConfigService.updateConfig(configId, configData)
      // addLog(`配置已保存`, 'success')
    } catch (err: any) {
      console.error('Failed to save data assistant config:', err)
      let errorMsg = '保存配置失败'
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          // Pydantic验证错误
          const errors = err.response.data.detail
            .map((e: any) => {
              const field = e.loc?.join('.') || 'unknown'
              return `${field}: ${e.msg}`
            })
            .join('; ')
          errorMsg = `验证失败: ${errors}`
        } else {
          errorMsg = err.response.data.detail
        }
      } else if (err.message) {
        errorMsg = err.message
      }
      addLog(`保存配置失败: ${errorMsg}`, 'error')
      setError(errorMsg)
    } finally {
      setIsSavingConfig(false)
    }
  }

  const saveAllConfigs = async (): Promise<void> => {
    setIsSavingConfig(true)
    try {
      // 验证标签组名称不能为空
      if (selectedConfigId !== null) {
        const configId = selectedConfigId
        const tagGroups = tagGroupsMap[configId] || []
        const emptyNameGroups = tagGroups.filter((group) => !group.name.trim())
        if (emptyNameGroups.length > 0) {
          const config = configs.find((c) => c.id === configId)
          const configName = config?.cookie_name || `账户${configId}`
          const errorMsg = `账户 "${configName}" 中存在标签组名称为空的标签组，请为所有标签组设置名称后再保存`
          setError(errorMsg)
          toast.error('配置验证失败', {
            description: errorMsg
          })
          return
        }
      }

      if (selectedConfigId !== null) {
        const configId = selectedConfigId
        // 清理和验证标签组数据
        const tagGroups = (tagGroupsMap[configId] || [])
          .map((group) => ({
            id: String(group.id || `group_${Date.now()}`),
            name: String(group.name || '').trim(),
            tags: (group.tags || [])
              .map((tag) => ({
                id: String(tag.id || ''),
                value: String(tag.value || '')
              }))
              .filter((tag) => tag.id && tag.value) // 过滤掉无效的标签
          }))
          .filter((group) => group.id && group.name.trim()) // 过滤掉无效的标签组和空名称的标签组

        const configData = {
          use_keyword_grouping: useKeywordGrouping,
          keyword_text: keywordText || null,
          tag_groups: {
            [String(configId)]: tagGroups
          },
          additional_tag_groups:
            (additionalTagGroupsMap[configId] || [])
              .map((tag) => ({
                id: String(tag.id || ''),
                value: String(tag.value || '')
              }))
              .filter((tag) => tag.id && tag.value) || null
        }
        await dataAssistantV2ConfigService.updateConfig(configId, configData)
      }
      // addLog(`所有配置已保存`, 'success')
      toast.success('配置保存成功', {
        description: `已保存数据助手配置`
      })
    } catch (err: any) {
      console.error('Failed to save all configs:', err)
      let errorMsg = '保存配置失败'
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          // Pydantic验证错误
          const errors = err.response.data.detail
            .map((e: any) => {
              const field = e.loc?.join('.') || 'unknown'
              return `${field}: ${e.msg}`
            })
            .join('; ')
          errorMsg = `验证失败: ${errors}`
        } else {
          errorMsg = err.response.data.detail
        }
      } else if (err.message) {
        errorMsg = err.message
      }
      addLog(`保存配置失败: ${errorMsg}`, 'error')
      setError(errorMsg)
      toast.error('配置保存失败', {
        description: errorMsg
      })
    } finally {
      setIsSavingConfig(false)
    }
  }

  const loadTags = async (configId: number): Promise<void> => {
    setLoadingTags((prev) => ({ ...prev, [configId]: true }))
    try {
      const response = await dataAssistantV2Service.getAccountTags(configId)
      if (response.code === 0 && response.data?.tags) {
        setAvailableTagsMap((prev) => ({ ...prev, [configId]: response.data.tags }))
      } else {
        addLog(`账户 ${configId} 获取标签失败: ${response.msg || response.error}`, 'error')
      }
    } catch (err: any) {
      console.error('Failed to load tags:', err)
      addLog(`账户 ${configId} 获取标签失败: ${err.response?.data?.detail || '未知错误'}`, 'error')
    } finally {
      setLoadingTags((prev) => ({ ...prev, [configId]: false }))
    }
  }

  const validateDate = (date: string): boolean => {
    if (!date) {
      setDateError('请输入查询日期')
      return false
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      setDateError('日期格式错误，请使用YYYY-MM-DD格式，例如：1990-08-08')
      return false
    }

    const [year, month, day] = date.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)

    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() !== month - 1 ||
      dateObj.getDate() !== day
    ) {
      setDateError('请输入有效的日期')
      return false
    }

    if (year < 2020 || year > 2030) {
      setDateError('请输入合理的年份（2020-2030年）')
      return false
    }

    setDateError('')
    return true
  }

  const addTagGroup = (selectedTags: TagInfo[] = []): void => {
    if (!activeConfigId || !activeGroupId) return

    const orgNode = selectedOrgNodes.find((n) => n.id === activeGroupId)
    if (!orgNode) return

    const currentGroups = tagGroupsMap[activeConfigId] || []
    const groupId = `group_${Date.now()}`
    const newGroup: TagGroup = {
      id: groupId,
      name: orgNode.name, // 使用组织节点名称作为标签组名称
      tags: selectedTags
    }
    setTagGroupsMap((prev) => ({
      ...prev,
      [activeConfigId]: [...currentGroups, newGroup]
    }))
    setActiveGroupId(groupId)
  }

  const removeTagGroup = (groupId: string): void => {
    if (!activeConfigId) return

    const currentGroups = tagGroupsMap[activeConfigId] || []
    if (currentGroups.length <= 1) {
      alert('至少需要保留一个标签组！')
      return
    }
    setTagGroupsMap((prev) => ({
      ...prev,
      [activeConfigId]: currentGroups.filter((g) => g.id !== groupId)
    }))
  }

  const handleDragStart = (e: React.DragEvent, index: number): void => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragEnd = (): void => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number): void => {
    e.preventDefault()

    if (!activeConfigId || dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }

    const currentGroups = tagGroupsMap[activeConfigId] || []
    const newGroups = [...currentGroups]
    const draggedItem = newGroups[dragIndex]

    // 移除拖拽的项
    newGroups.splice(dragIndex, 1)
    // 插入到新位置
    newGroups.splice(dropIndex, 0, draggedItem)

    setTagGroupsMap((prev) => ({
      ...prev,
      [activeConfigId]: newGroups
    }))

    setDragIndex(null)
    setDragOverIndex(null)
  }

  const updateGroupTags = (groupId: string, tags: TagInfo[]): void => {
    if (!activeConfigId) return

    const currentGroups = tagGroupsMap[activeConfigId] || []
    setTagGroupsMap((prev) => ({
      ...prev,
      [activeConfigId]: currentGroups.map((g) => (g.id === groupId ? { ...g, tags } : g))
    }))
  }

  const updateGroupName = (groupId: string, name: string): void => {
    if (!activeConfigId) return

    const currentGroups = tagGroupsMap[activeConfigId] || []
    setTagGroupsMap((prev) => ({
      ...prev,
      [activeConfigId]: currentGroups.map((g) =>
        g.id === groupId ? { ...g, name: name.trim() || g.name } : g
      )
    }))
  }

  const startEditingGroupName = (groupId: string): void => {
    const currentGroups = tagGroupsMap[activeConfigId || 0] || []
    const group = currentGroups.find((g) => g.id === groupId)
    if (group) {
      setEditingGroupName(groupId)
      setEditingGroupNameValue(group.name)
    }
  }

  const confirmEditingGroupName = (): void => {
    if (editingGroupName && editingGroupNameValue.trim()) {
      updateGroupName(editingGroupName, editingGroupNameValue.trim())
    }
    setEditingGroupName(null)
    setEditingGroupNameValue('')
  }

  const cancelEditingGroupName = (): void => {
    setEditingGroupName(null)
    setEditingGroupNameValue('')
  }

  const toggleTagInGroup = (groupId: string, tag: TagInfo): void => {
    if (!activeConfigId) return

    const currentGroups = tagGroupsMap[activeConfigId] || []
    const group = currentGroups.find((g) => g.id === groupId)
    if (!group) return

    const isSelected = group.tags.some((t) => t.id === tag.id)
    if (isSelected) {
      updateGroupTags(
        groupId,
        group.tags.filter((t) => t.id !== tag.id)
      )
    } else {
      updateGroupTags(groupId, [...group.tags, tag])
    }
  }

  const toggleSelectAll = (groupId: string): void => {
    if (!activeConfigId) return

    const currentGroups = tagGroupsMap[activeConfigId] || []
    const group = currentGroups.find((g) => g.id === groupId)
    if (!group) return

    const availableTags = availableTagsMap[activeConfigId] || []
    const allSelected = availableTags.every((tag) => group.tags.some((t) => t.id === tag.id))

    if (allSelected) {
      updateGroupTags(groupId, [])
    } else {
      updateGroupTags(groupId, availableTags)
    }
  }

  // 快速组合标签：根据三个选择组自动生成标签组（交替模式：单独→组合→单独→组合）
  const generateQuickTagGroups = (configId: number): void => {
    const selector1 = quickTagSelector1[configId] || [] // 投手
    const selector2 = quickTagSelector2[configId] || [] // 投放类型
    const selector3 = quickTagSelector3[configId] || [] // 出价类型

    if (selector1.length === 0) {
      toast.error('请至少选择一个投手标签')
      return
    }

    const newGroups: TagGroup[] = []
    let counter = 0
    const baseTime = Date.now()

    // 交替模式生成：投手单独标签、投手+投放类型+出价类型、投手单独标签、投手+投放类型+出价类型...
    selector1.forEach((tag1) => {
      // 先添加投手单独标签
      const soloGroupId = `group_${baseTime}_${counter++}_${Math.random().toString(36).substr(2, 9)}`
      newGroups.push({
        id: soloGroupId,
        name: tag1.value,
        tags: [tag1]
      })

      // 如果第二组和第三组都有标签，添加组合标签组
      if (selector2.length > 0 && selector3.length > 0) {
        selector2.forEach((tag2) => {
          selector3.forEach((tag3) => {
            const comboGroupId = `group_${baseTime}_${counter++}_${Math.random().toString(36).substr(2, 9)}`
            newGroups.push({
              id: comboGroupId,
              name: `${tag1.value}-${tag2.value}-${tag3.value}`,
              tags: [tag1, tag2, tag3]
            })
          })
        })
      }
      // 如果只有第二组有标签
      else if (selector2.length > 0) {
        selector2.forEach((tag2) => {
          const comboGroupId = `group_${baseTime}_${counter++}_${Math.random().toString(36).substr(2, 9)}`
          newGroups.push({
            id: comboGroupId,
            name: `${tag1.value}-${tag2.value}`,
            tags: [tag1, tag2]
          })
        })
      }
      // 如果只有第三组有标签
      else if (selector3.length > 0) {
        selector3.forEach((tag3) => {
          const comboGroupId = `group_${baseTime}_${counter++}_${Math.random().toString(36).substr(2, 9)}`
          newGroups.push({
            id: comboGroupId,
            name: `${tag1.value}-${tag3.value}`,
            tags: [tag1, tag3]
          })
        })
      }
    })

    // 更新标签组映射（替换现有标签组）
    setTagGroupsMap((prev) => ({
      ...prev,
      [configId]: newGroups
    }))

    toast.success(`成功生成 ${newGroups.length} 个标签组`)
  }

  // 一键清空标签组
  const clearAllTagGroups = (configId: number): void => {
    if (!configId) return

    if (confirm('确定要清空当前账户的所有标签组吗？此操作不可恢复。')) {
      setTagGroupsMap((prev) => ({
        ...prev,
        [configId]: []
      }))
      toast.success('已清空所有标签组')
    }
  }

  // 切换快速选择器中的标签
  const toggleQuickSelectorTag = (
    configId: number,
    selectorIndex: 1 | 2 | 3,
    tag: TagInfo
  ): void => {
    if (selectorIndex === 1) {
      setQuickTagSelector1((prev) => {
        const current = prev[configId] || []
        const isSelected = current.some((t) => t.id === tag.id)
        return {
          ...prev,
          [configId]: isSelected ? current.filter((t) => t.id !== tag.id) : [...current, tag]
        }
      })
    } else if (selectorIndex === 2) {
      setQuickTagSelector2((prev) => {
        const current = prev[configId] || []
        const isSelected = current.some((t) => t.id === tag.id)
        return {
          ...prev,
          [configId]: isSelected ? current.filter((t) => t.id !== tag.id) : [...current, tag]
        }
      })
    } else if (selectorIndex === 3) {
      setQuickTagSelector3((prev) => {
        const current = prev[configId] || []
        const isSelected = current.some((t) => t.id === tag.id)
        return {
          ...prev,
          [configId]: isSelected ? current.filter((t) => t.id !== tag.id) : [...current, tag]
        }
      })
    }
  }

  const getSelectedTagGroups = (configId: number): TagGroup[] => {
    const currentGroups = tagGroupsMap[configId] || []
    return currentGroups.filter((group) => group.tags.length > 0 && group.name.trim())
  }

  const toggleConfigSelection = (configId: number): void => {
    // 单选逻辑：如果已选中则取消，否则选中
    if (selectedConfigId === configId) {
      setSelectedConfigId(null)
      setActiveConfigId(null)
    } else {
      setSelectedConfigId(configId)
      setActiveConfigId(configId)
    }
  }

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info'): void => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }])
  }

  const clearLogs = (): void => {
    setLogs([])
  }

  const handleFetchData = async (): Promise<void> => {
    if (!validateDate(queryDate)) {
      return
    }

    if (selectedConfigId === null) {
      setError('请选择一个引擎账户')
      return
    }

    // 验证是否选择了组织树节点
    if (selectedOrgNodes.length === 0) {
      setError('请至少选择一个组织树节点')
      return
    }

    // 缓存标签组映射
    localStorage.setItem('data-assistant-tag-groups-map', JSON.stringify(tagGroupsMap))

    setLoading(true)
    setError('')
    // 清除所有选中配置的统计数据
    setStatisticsDataMap({})
    clearLogs()
    setIsLogPanelOpen(true)

    addLog('开始拉取数据...', 'info')
    addLog(`查询日期: ${queryDate}`, 'info')
    const configName =
      configs.find((c) => c.id === selectedConfigId)?.cookie_name || `账户${selectedConfigId}`
    addLog(`选中账户: ${configName}`, 'info')

    try {
      // 拉取账户的数据
      const configId = selectedConfigId
      const selectedGroups = getSelectedTagGroups(configId)
      addLog(`[${configName}] 开始拉取数据...`, 'info')

      const requestData = {
        config_id: configId,
        query_date: queryDate.trim(),
        ebp_ids: selectedOrgNodes.map((node) => node.id), // 传递组织树节点id作为ebpid
        ebp_names: selectedOrgNodes.map((node) => node.name), // 传递组织树节点名称
        use_keyword_grouping: useKeywordGrouping,
        keyword_text: useKeywordGrouping ? keywordText : null
      }

      try {
        const response = await dataAssistantV2Service.getDataStatistics(requestData)
        if (response.code === 0) {
          addLog(`[${configName}] 数据拉取成功！`, 'success')
          if (response.data) {
            addLog(
              `[${configName}] 总消耗: ${response.data.total_data.total_cost.toFixed(2)}`,
              'info'
            )
          }
          setStatisticsDataMap({
            [configId]: {
              ...response,
              recordTime: new Date().toISOString()
            }
          })
          addLog(`✓ 成功拉取数据`, 'success')
        } else {
          const errorMsg = response.msg || response.error || '获取数据失败'
          addLog(`[${configName}] 失败: ${errorMsg}`, 'error')
          setStatisticsDataMap({ [configId]: null })
        }
      } catch (err: any) {
        let errorMsg = '获取数据失败'
        if (err.response?.status === 422) {
          const details = err.response?.data?.detail || []
          if (Array.isArray(details)) {
            const errorMessages = details
              .map((d: any) => {
                const field = d.loc?.join('.') || 'unknown'
                return `${field}: ${d.msg}`
              })
              .join('; ')
            errorMsg = `请求参数验证失败: ${errorMessages}`
          } else {
            errorMsg = err.response?.data?.detail || '请求参数验证失败'
          }
        } else {
          errorMsg = err.response?.data?.detail || err.message || '获取数据失败'
        }
        addLog(`[${configName}] 失败: ${errorMsg}`, 'error')
        setStatisticsDataMap({ [configId]: null })
      }
    } catch (err: any) {
      console.error('Failed to fetch statistics:', err)
      const errorMsg = err.message || '获取数据失败'
      setError(errorMsg)
      addLog(`失败: ${errorMsg}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const generateImage = async (): Promise<void> => {
    if (selectedConfigId === null) {
      addLog('请先选择账户', 'error')
      return
    }
    const data = statisticsDataMap[selectedConfigId]
    if (!data?.data) {
      addLog('暂无统计数据，请先拉取数据', 'error')
      return
    }

    setIsGeneratingImage(true)
    addLog('开始生成统计汇总图片...', 'info')

    try {
      const statisticsData = data.data
      const blob = await dataAssistantV2Service.exportStatisticsImage(statisticsData)
      const url = URL.createObjectURL(blob)
      setGeneratedImageUrl(url)
      addLog('图片生成成功', 'success')
    } catch (error) {
      console.error('生成图片失败:', error)
      addLog(`图片生成失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const closeImagePreview = (): void => {
    if (generatedImageUrl) {
      URL.revokeObjectURL(generatedImageUrl)
      setGeneratedImageUrl(null)
    }
  }

  // const generateTagGroupImage = async (): Promise<void> => {
  //   const element = document.getElementById('tag-group-summary')
  //   if (!element) {
  //     addLog('未找到标签组汇总元素', 'error')
  //     return
  //   }

  //   setIsGeneratingImage(true)
  //   addLog('开始生成标签组汇总图片...', 'info')

  //   try {
  //     // 动态导入 html2canvas
  //     const html2canvas = (await import('html2canvas')).default

  //     // 配置 html2canvas 选项
  //     const canvas = await html2canvas(element, {
  //       backgroundColor: '#ffffff',
  //       scale: 2, // 提高分辨率
  //       useCORS: true,
  //       allowTaint: true,
  //       width: element.scrollWidth,
  //       height: element.scrollHeight,
  //       windowWidth: element.scrollWidth,
  //       windowHeight: element.scrollHeight,
  //       onclone: (clonedDoc) => {
  //         // 确保克隆的元素样式正确
  //         const clonedElement = clonedDoc.getElementById('tag-group-summary')
  //         if (clonedElement) {
  //           clonedElement.style.width = element.scrollWidth + 'px'
  //           clonedElement.style.height = element.scrollHeight + 'px'
  //         }
  //       }
  //     })

  //     // 将 canvas 转换为 blob
  //     canvas.toBlob((blob) => {
  //       if (!blob) {
  //         addLog('图片生成失败', 'error')
  //         return
  //       }

  //       // 创建下载链接
  //       const url = URL.createObjectURL(blob)
  //       const link = document.createElement('a')
  //       link.href = url

  //       // 生成文件名
  //       const now = new Date()
  //       const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`
  //       const filename = `标签组汇总_${timestamp}.png`

  //       link.download = filename
  //       document.body.appendChild(link)
  //       link.click()
  //       document.body.removeChild(link)
  //       URL.revokeObjectURL(url)

  //       addLog(`图片已保存: ${filename}`, 'success')
  //     }, 'image/png', 0.95)
  //   } catch (error) {
  //     console.error('生成图片失败:', error)
  //     addLog(`图片生成失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
  //   } finally {
  //     setIsGeneratingImage(false)
  //   }
  // }

  // const sendToFeishu = async (): Promise<void> => {
  //   const validStats = selectedConfigIds
  //     .map((id) => ({ id, data: statisticsDataMap[id] }))
  //     .filter((item) => item.data?.data)

  //   if (validStats.length === 0) return

  //   setIsSendingToFeishu(true)
  //   addLog('开始发送数据到飞书多维表格...', 'info')

  //   try {
  //     // 获取查询日期（从第一个有效数据中获取）
  //     const query_date = validStats[0].data!.data!.query_date

  //     // 定义字段
  //     // 检查是否启用了关键字分组
  //     const hasKeywordGroupingForExport = validStats.some(({ data }) =>
  //       data?.data?.group_results?.some(g => g.keyword || g.group_name.includes(' - '))
  //     )

  //     const fields = [
  //       // { field_name: '账户名称', field_type: 'text' },
  //       ...(hasKeywordGroupingForExport ? [{ field_name: '关键字', field_type: 'text' }] : []),
  //       { field_name: '投手', field_type: 'text' },
  //       { field_name: '出价方式', field_type: 'text' },
  //       // { field_name: '标签列表', field_type: 'text' },
  //       { field_name: '总消耗(元)', field_type: 'number' },
  //       { field_name: '激活成本(元)', field_type: 'number' },
  //       { field_name: '昨日消耗(元)', field_type: 'number' },
  //       { field_name: '昨日激活成本(元)', field_type: 'number' },
  //       { field_name: '昨日次留率(%)', field_type: 'number' },
  //       { field_name: '次留率(%)', field_type: 'number' },
  //       { field_name: '激活数', field_type: 'number' },
  //       { field_name: '七留率(%)', field_type: 'number' },
  //       { field_name: '历史七日消耗(元)', field_type: 'number' },
  //       { field_name: '历史七日成本(元)', field_type: 'number' },
  //       { field_name: '历史七日次留率(%)', field_type: 'number' },
  //       { field_name: '历史七日7留率(%)', field_type: 'number' }
  //     ]

  //     // 构建记录数据 - 只包含汇总数据和总计
  //     const records: Record<string, any>[] = []
  //     let totalCost = 0
  //     let totalActiveCost = 0
  //     let totalActive = 0
  //     let totalNextRetention = 0
  //     let total7dRetention = 0
  //     let recordCount = 0

  //     // 计算总计数据
  //     let totalHistory7dCost = 0
  //     let totalHistory7dNextDayRetention = 0
  //     let totalHistory7d7dRetention = 0
  //     validStats.forEach(({ data }) => {
  //       const { total_data } = data!.data!
  //       totalCost += total_data.total_cost
  //       totalActive += total_data.total_active || 0
  //       totalNextRetention += total_data.next_day_retention
  //       total7dRetention += total_data.retention_7d
  //       totalHistory7dCost += total_data.history_7d_cost || 0
  //       totalHistory7dNextDayRetention += total_data.history_7d_next_day_retention || 0
  //       totalHistory7d7dRetention += total_data.history_7d_retention_7d || 0
  //       recordCount++
  //     })
  //     if(totalActive > 0){
  //       totalActiveCost = totalCost / totalActive
  //     }

  //     // 计算总计的昨日数据
  //     let totalYesterdayCost = 0
  //     let totalYesterdayActive = 0
  //     let totalYesterdayRetentionCount = 0
  //     validStats.forEach(({ data }) => {
  //       const { total_data } = data!.data!
  //       totalYesterdayCost += total_data.yesterday_cost || 0
  //       totalYesterdayActive += total_data.yesterday_active || 0
  //       const yesterdayRetention = (total_data.yesterday_next_day_retention || 0) / 100
  //       const yesterdayActive = total_data.yesterday_active || 0
  //       totalYesterdayRetentionCount += yesterdayRetention * yesterdayActive
  //     })

  //     const totalYesterdayActiveCost = totalYesterdayActive > 0
  //       ? totalYesterdayCost / totalYesterdayActive
  //       : 0

  //     const totalYesterdayNextRetention = totalYesterdayActive > 0
  //       ? (totalYesterdayRetentionCount / totalYesterdayActive) * 100
  //       : 0

  //     // 按标签组汇总数据
  //     if (validStats.length > 1) {
  //       const { result: tagGroupAggregationArray, hasKeywordGrouping } = processTagGroupAggregation(validStats)

  //       // 添加标签组汇总数据
  //       tagGroupAggregationArray.forEach((agg) => {
  //         // 将标签组名称按 "-" 分割为两部分
  //         const parts = agg.key.split('-')
  //         const keyPart1 = parts[0]?.trim() || agg.key
  //         const keyPart2 = parts[1]?.trim() || '-'

  //         const record: Record<string, any> = {
  //           // '账户名称': `${agg.accounts.join(', ')} (${agg.accounts.length})`,
  //           '投手': keyPart1,
  //           '出价方式': keyPart2,
  //           // '标签列表': agg.tagList,
  //           '总消耗(元)': parseFloat(agg.totalCost.toFixed(2)),
  //           '激活成本(元)': parseFloat(agg.activeCost.toFixed(2)),
  //           '昨日消耗(元)': parseFloat(agg.yesterdayCost.toFixed(2)),
  //           '昨日激活成本(元)': parseFloat(agg.yesterdayActiveCost.toFixed(2)),
  //           '昨日次留率(%)': parseFloat(agg.yesterdayNextRetention.toFixed(2)),
  //           '次留率(%)': parseFloat(agg.avgNextRetention.toFixed(2)),
  //           '激活数': agg.totalActive,
  //           '七留率(%)': parseFloat(agg.avgRetention7d.toFixed(2)),
  //           '历史七日消耗(元)': parseFloat(agg.history7dCost.toFixed(2)),
  //           '历史七日成本(元)': parseFloat(agg.history7dActiveCost.toFixed(2)),
  //           '历史七日次留率(%)': parseFloat(agg.avgHistory7dNextDayRetention.toFixed(2)),
  //           '历史七日7留率(%)': parseFloat(agg.avgHistory7d7dRetention.toFixed(2))
  //         }
  //         if (hasKeywordGrouping && agg.keyword) {
  //           record['关键字'] = agg.keyword
  //         }
  //         records.push(record)
  //       })
  //     }

  //     // 添加总计行
  //     const totalRecord: Record<string, any> = {
  //       '投手': '总计',
  //       '出价方式': '-',
  //       // '标签组(2)': '-',
  //       // '标签列表': `${validStats.length}个账户`,
  //       '总消耗(元)': parseFloat(totalCost.toFixed(2)),
  //       '激活成本(元)': parseFloat(totalActiveCost.toFixed(2)),
  //       '昨日消耗(元)': parseFloat(totalYesterdayCost.toFixed(2)),
  //       '昨日激活成本(元)': parseFloat(totalYesterdayActiveCost.toFixed(2)),
  //       '昨日次留率(%)': parseFloat(totalYesterdayNextRetention.toFixed(2)),
  //       '次留率(%)': parseFloat((totalNextRetention / recordCount).toFixed(2)),
  //       '激活数': totalActive,
  //       '七留率(%)': parseFloat((total7dRetention / recordCount).toFixed(2)),
  //       '历史七日消耗(元)': parseFloat(totalHistory7dCost.toFixed(2)),
  //       '历史七日成本(元)': parseFloat((totalActive > 0 ? totalHistory7dCost / totalActive : 0).toFixed(2)),
  //       '历史七日次留率(%)': parseFloat((totalHistory7dNextDayRetention / recordCount).toFixed(2)),
  //       '历史七日7留率(%)': parseFloat((totalHistory7d7dRetention / recordCount).toFixed(2))
  //     }
  //     if (hasKeywordGroupingForExport) {
  //       totalRecord['关键字'] = ''
  //     }
  //     records.push(totalRecord)

  //     // 调用飞书 API
  //     const accountNames = validStats.map(
  //       ({ id }) => configs.find((c) => c.id === id)?.cookie_name || `账户${id}`
  //     )
  //     const bitableName =
  //       validStats.length === 1
  //         ? `巨量数据统计_${accountNames[0]}_${query_date}`
  //         : `巨量数据统计_多账户_${query_date}`
  //     const tableName = '数据统计表'

  //     addLog('正在创建多维表格...', 'info')
  //     const response = await feishuService.createBitableWithData({
  //       bitable_name: bitableName,
  //       table_name: tableName,
  //       fields,
  //       records,
  //       default_view_name: '表格视图'
  //     })

  //     addLog(`成功创建多维表格: ${response.message}`, 'success')
  //     addLog(`记录数: ${response.record_count}`, 'info')
  //     addLog(`访问链接: ${response.app_url}`, 'info')

  //     // 打开多维表格链接
  //     if (response.app_url) {
  //       if ((window as any).api?.openExternal) {
  //         await (window as any).api.openExternal(response.app_url)
  //       } else {
  //         window.open(response.app_url, '_blank')
  //       }
  //     }
  //   } catch (err: any) {
  //     console.error('Failed to send to Feishu:', err)
  //     let errorMsg = '发送到飞书失败'

  //     if (err.response?.status === 404) {
  //       errorMsg = '请先绑定飞书账号'
  //     } else if (err.response?.data?.detail) {
  //       errorMsg = err.response.data.detail
  //     } else if (err.message) {
  //       errorMsg = err.message
  //     }

  //     addLog(`失败: ${errorMsg}`, 'error')
  //     setError(errorMsg)
  //   } finally {
  //     setIsSendingToFeishu(false)
  //   }
  // }

  const sendSummaryToFeishuSheet = async (): Promise<void> => {
    if (selectedConfigId === null) return
    const validStats = [{ id: selectedConfigId, data: statisticsDataMap[selectedConfigId] }].filter(
      (item) => item.data?.data
    )

    if (validStats.length === 0) return

    setIsSendingToFeishuSheet(true)
    addLog('开始发送汇总数据到飞书表格...', 'info')

    try {
      // 获取统计数据（从/data-assistant-v2/statistics获取的数据）
      const statisticsData = validStats[0].data!.data!

      addLog('正在发送数据到后端处理...', 'info')

      // 调用后端接口，将数据处理和发送到飞书的逻辑交给后端
      const response = await dataAssistantV2Service.sendStatisticsToFeishuV2(
        statisticsData,
        selectedConfigId
      )

      addLog(`成功创建飞书表格: ${response.message}`, 'success')
      if (response.row_count !== undefined) {
        addLog(`数据行数: ${response.row_count}`, 'info')
      }
      if (response.spreadsheet_url) {
        addLog(`访问链接: ${response.spreadsheet_url}`, 'info')
      }

      // 打开表格链接
      if (response.spreadsheet_url) {
        if ((window as any).api?.openExternal) {
          await (window as any).api.openExternal(response.spreadsheet_url)
        } else {
          window.open(response.spreadsheet_url, '_blank')
        }
      }
    } catch (err: any) {
      console.error('Failed to send to Feishu Sheet:', err)
      let errorMsg = '发送到飞书表格失败'

      if (err.response?.status === 404) {
        errorMsg = '请先绑定飞书账号'
      } else if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail
      } else if (err.message) {
        errorMsg = err.message
      }

      addLog(`失败: ${errorMsg}`, 'error')
      setError(errorMsg)
    } finally {
      setIsSendingToFeishuSheet(false)
    }
  }

  // const exportToCSV = async (): Promise<void> => {
  //   const validStats = selectedConfigIds
  //     .map((id) => ({ id, data: statisticsDataMap[id] }))
  //     .filter((item) => item.data?.data)

  //   if (validStats.length === 0) return

  //   // 获取查询日期（从第一个有效数据中获取）
  //   const query_date = validStats[0].data!.data!.query_date

  //   const headers = [
  //     '账户名称',
  //     '标签组名称',
  //     '标签列表',
  //     '总消耗(元)',
  //     '激活数',
  //     '激活成本(元)',
  //     '昨日消耗(元)',
  //     '昨日激活成本(元)',
  //     '昨日次留率(%)',
  //     // '次留率(%)',
  //     // '七留率(%)',
  //     '历史七日消耗(元)',
  //     '历史七日成本(元)',
  //     '历史七日次留率(%)',
  //     '历史七日7留率(%)'
  //   ]

  //   const rows: string[][] = []
  //   let totalCost = 0
  //   let totalActiveCost = 0
  //   let totalActive = 0
  //   let recordCount = 0

  //   // 添加每个账户的数据
  //   validStats.forEach(({ id, data }) => {
  //     const configName = configs.find((c) => c.id === id)?.cookie_name || `账户${id}`
  //     const { total_data, group_results } = data!.data!

  //     // 添加该账户的每个标签组数据
  //     group_results.forEach((group) => {
  //       rows.push([
  //         configName,
  //         group.group_name,
  //         group.tags.map((t) => t.value).join('; '),
  //         group.filter_data.total_cost.toFixed(2),
  //         (group.filter_data.total_active || 0).toString(),
  //         group.filter_data.active_cost.toFixed(2),
  //         (group.filter_data.yesterday_cost || 0).toFixed(2),
  //         (group.filter_data.yesterday_active_cost || 0).toFixed(2),
  //         (group.filter_data.yesterday_next_day_retention || 0).toFixed(2),
  //         // group.filter_data.next_day_retention.toFixed(2),
  //         // group.filter_data.retention_7d.toFixed(2),
  //         (group.filter_data.history_7d_cost || 0).toFixed(2),
  //         (group.filter_data.history_7d_active_cost || 0).toFixed(2),
  //         (group.filter_data.history_7d_next_day_retention || 0).toFixed(2),
  //         (group.filter_data.history_7d_retention_7d || 0).toFixed(2)
  //       ])
  //     })

  //     // 添加该账户的小计
  //     rows.push([
  //       configName,
  //       '小计',
  //       '该账户全部数据',
  //       total_data.total_cost.toFixed(2),
  //       (total_data.total_active || 0).toString(),
  //       total_data.active_cost.toFixed(2),
  //       (total_data.yesterday_cost || 0).toFixed(2),
  //       (total_data.yesterday_active_cost || 0).toFixed(2),
  //       (total_data.yesterday_next_day_retention || 0).toFixed(2),
  //       // total_data.next_day_retention.toFixed(2),
  //       // total_data.retention_7d.toFixed(2),
  //       (total_data.history_7d_cost || 0).toFixed(2),
  //       (total_data.history_7d_active_cost || 0).toFixed(2),
  //       (total_data.history_7d_next_day_retention || 0).toFixed(2),
  //       (total_data.history_7d_retention_7d || 0).toFixed(2)
  //     ])

  //     // 累加到总计
  //     totalCost += total_data.total_cost
  //     totalActiveCost += total_data.active_cost
  //     totalActive += total_data.total_active || 0
  //     recordCount++
  //   })

  //   // 添加总计行（多账户时计算平均留存率）
  //   let totalYesterdayCost = 0
  //   let totalYesterdayActive = 0
  //   let totalYesterdayRetentionCount = 0  // 昨日次留数 = 昨日次留率 * 昨日激活数
  //   let totalHistory7dCost = 0
  //   let totalHistory7dActive = 0
  //   let totalHistory7dNextDayOpenCnt = 0
  //   let totalHistory7dRetention7dCnt = 0
  //   validStats.forEach(({ data }) => {
  //     const { total_data } = data!.data!
  //     totalYesterdayCost += total_data.yesterday_cost || 0
  //     totalYesterdayActive += total_data.yesterday_active || 0
  //     // 累加昨日次留数 = 昨日次留率(%) * 昨日激活数 / 100
  //     const yesterdayRetention = (total_data.yesterday_next_day_retention || 0) / 100
  //     const yesterdayActive = total_data.yesterday_active || 0
  //     totalYesterdayRetentionCount += yesterdayRetention * yesterdayActive
  //     totalHistory7dCost += total_data.history_7d_cost || 0
  //     totalHistory7dActive += total_data.history_7d_active || 0
  //     totalHistory7dNextDayOpenCnt += total_data.history_7d_attribution_next_day_open_cnt || 0
  //     totalHistory7dRetention7dCnt += total_data.history_7d_attribution_retention_7d_cnt || 0
  //   })

  //   // 计算总计的昨日激活成本 = 昨日总消耗 / 昨日总激活数
  //   const totalYesterdayActiveCost = totalYesterdayActive > 0
  //     ? totalYesterdayCost / totalYesterdayActive
  //     : 0

  //   // 计算总计的昨日次留率 = 昨日总次留数 / 昨日总激活数 * 100
  //   const totalYesterdayNextRetention = totalYesterdayActive > 0
  //     ? (totalYesterdayRetentionCount / totalYesterdayActive) * 100
  //     : 0

  //   // 按标签组汇总数据（使用与汇总表格相同的逻辑）
  //   let hasKeywordGroupingForCSV = false
  //   if (validStats.length > 1) {
  //     const { result: tagGroupAggregationArray, hasKeywordGrouping } = processTagGroupAggregation(validStats)
  //     hasKeywordGroupingForCSV = hasKeywordGrouping

  //     // 添加标签组汇总区块
  //     if (tagGroupAggregationArray.length > 0) {
  //       rows.push([])
  //       rows.push(['汇总数据'])

  //       // 根据是否有关键字分组设置表头
  //       const summaryHeaders = [
  //         ...(hasKeywordGrouping ? ['关键字'] : []),
  //         '投手',
  //         '投放类型',
  //         '出价类型',
  //         '总消耗',
  //         '激活数',
  //         '激活成本',
  //         '投放占比',
  //         '昨日消耗',
  //         '昨日激活成本',
  //         '昨日次留率',
  //         '历史七日消耗',
  //         '历史七日成本',
  //         '历史七日次留率',
  //         '历史七日7留率'
  //       ]
  //       rows.push(summaryHeaders)

  //       tagGroupAggregationArray.forEach((agg) => {
  //         // 将标签组名称按 "-" 分割为三部分
  //         const parts = agg.key.split('-')
  //         const keyPart1 = parts[0]?.trim() || agg.key
  //         const keyPart2 = parts[1]?.trim() || '总消耗'
  //         const keyPart3 = parts[2]?.trim() || ' '

  //         const row = [
  //           keyPart1,
  //           keyPart2,
  //           keyPart3,
  //           agg.totalCost.toFixed(2),
  //           agg.totalActive.toString(),
  //           agg.activeCost.toFixed(2),
  //           agg.allocationRatio.toFixed(2) + '%',
  //           agg.yesterdayCost.toFixed(2),
  //           agg.yesterdayActiveCost.toFixed(2),
  //           agg.yesterdayNextRetention.toFixed(2) + '%',
  //           agg.history7dCost.toFixed(2),
  //           agg.history7dActiveCost.toFixed(2),
  //           agg.avgHistory7dNextDayRetention.toFixed(2) + '%',
  //           agg.avgHistory7d7dRetention.toFixed(2) + '%'
  //         ]
  //         // 如果有关键字分组，在标签组名称前插入关键字
  //         if (hasKeywordGrouping) {
  //           row.splice(0, 0, agg.keyword || '')
  //         }
  //         rows.push(row)
  //       })
  //     }

  //     // 添加总计行
  //     rows.push([])
  //     rows.push(['总计'])
  //     const totalRow = [
  //       '总计',
  //       '-',
  //       totalCost.toFixed(2),
  //       totalActive.toString(),
  //       totalActiveCost.toFixed(2),
  //       '-', // 投放占比总计行不计算
  //       totalYesterdayCost.toFixed(2),
  //       totalYesterdayActiveCost.toFixed(2),
  //       totalYesterdayNextRetention.toFixed(2),
  //       totalHistory7dCost.toFixed(2),
  //       (totalHistory7dRetention7dCnt > 0 ? totalHistory7dCost / totalHistory7dRetention7dCnt : 0).toFixed(2),
  //       (totalHistory7dActive > 0 ? (totalHistory7dNextDayOpenCnt / totalHistory7dActive) * 100 : 0).toFixed(2),
  //       (totalHistory7dActive > 0 ? (totalHistory7dRetention7dCnt / totalHistory7dActive) * 100 : 0).toFixed(2)
  //     ]
  //     // 如果有关键字分组，在总计行前插入空关键字列
  //     if (hasKeywordGroupingForCSV) {
  //       totalRow.splice(0, 0, '')
  //     }
  //     rows.push(totalRow)
  //   }

  //   // 构建CSV内容
  //   let csvContent = ''
  //   csvContent += `查询日期:,${query_date}\n`
  //   csvContent += `导出时间:,${new Date().toLocaleString('zh-CN')}\n`
  //   csvContent += `账户数量:,${validStats.length}\n`
  //   csvContent += '\n'
  //   csvContent += headers.join(',') + '\n'

  //   rows.forEach((row) => {
  //     const escapedRow = row.map((field) => {
  //       const fieldStr = String(field)
  //       if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
  //         return '"' + fieldStr.replace(/"/g, '""') + '"'
  //       }
  //       return fieldStr
  //     })
  //     csvContent += escapedRow.join(',') + '\n'
  //   })

  //   // 使用Electron API保存文件并打开文件夹，导出名称精确到秒
  //   const now = new Date();
  //   const pad = (n: number) => n.toString().padStart(2, '0');
  //   const timestamp = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  //   const filename = `巨量数据统计_${query_date.replace(/-/g, '')}_${timestamp}.csv`;

  //   if (window.api?.saveFileAndOpenFolder) {
  //     try {
  //       const result = await window.api.saveFileAndOpenFolder(csvContent, filename)
  //       if (result.success) {
  //         addLog(`文件已保存: ${result.filePath}`, 'success')
  //       } else if (result.canceled) {
  //         addLog('已取消保存', 'info')
  //       }
  //     } catch (error) {
  //       console.error('Failed to save file:', error)
  //       addLog(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
  //       // 降级到浏览器下载方式
  //       const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  //       const link = document.createElement('a')
  //       const url = URL.createObjectURL(blob)
  //       link.setAttribute('href', url)
  //       link.setAttribute('download', filename)
  //       link.style.visibility = 'hidden'
  //       document.body.appendChild(link)
  //       link.click()
  //       document.body.removeChild(link)
  //       URL.revokeObjectURL(url)
  //     }
  //   } else {
  //     // 浏览器环境，使用传统下载方式
  //     const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  //     const link = document.createElement('a')
  //     const url = URL.createObjectURL(blob)
  //     link.setAttribute('href', url)
  //     link.setAttribute('download', filename)
  //     link.style.visibility = 'hidden'
  //     document.body.appendChild(link)
  //     link.click()
  //     document.body.removeChild(link)
  //     URL.revokeObjectURL(url)
  //   }
  // }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">数据助手(升级版)</h1>
        <p className="mt-2 text-muted-foreground">巨量引擎升级版统计广告数据</p>
      </div>

      {/* 配置选择 */}
      <Card>
        <CardHeader>
          <CardTitle>选择引擎账户 *</CardTitle>
          <CardDescription>选择要拉取数据的账户（仅显示包含"-升级版"的账户）</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {configs.length === 0 ? (
                <div className="col-span-full p-3 text-center rounded-md border text-muted-foreground">
                  暂无可用账户配置
                </div>
              ) : (
                configs.map((config) => {
                  const isSelected = selectedConfigId === config.id
                  return (
                    <motion.div
                      key={config.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 border rounded-md cursor-pointer transition-all ${
                        isSelected
                          ? 'shadow-sm border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-accent/50'
                      }`}
                      onClick={() => toggleConfigSelection(config.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex flex-1 gap-2 items-center min-w-0">
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                              isSelected
                                ? 'border-primary bg-primary'
                                : 'border-muted-foreground/30'
                            }`}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{config.cookie_name}</div>
                            {config.realname && (
                              <div className="text-xs truncate text-muted-foreground">
                                {config.realname}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 组织树选择面板 */}
      {selectedConfigId !== null && (
        <Card>
          <CardHeader>
            <CardTitle>选择组织</CardTitle>
            <CardDescription>选择要筛选的组织节点（可多选）</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="请输入EBP ID"
                  id="ebp-id-input"
                  className="flex-1"
                  value={ebpId}
                  onChange={(e) => {
                    const newEbpId = e.target.value.trim()
                    setEbpId(newEbpId)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const newEbpId = (e.target as HTMLInputElement).value.trim()
                      if (newEbpId && selectedConfigId !== null) {
                        setEbpId(newEbpId)
                        loadOrganizationTree(selectedConfigId, newEbpId)
                      }
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    if (ebpId && selectedConfigId !== null) {
                      loadOrganizationTree(selectedConfigId, ebpId)
                    }
                  }}
                  disabled={loadingOrgTree || !ebpId || selectedConfigId === null}
                >
                  {loadingOrgTree ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      加载中...
                    </>
                  ) : (
                    '加载组织树'
                  )}
                </Button>
              </div>
              {orgTreeError && <div className="text-sm text-red-500">{orgTreeError}</div>}
              {organizationTree && (
                <div className="border rounded-md p-4 max-h-[400px] overflow-y-auto">
                  {organizationTree.children && organizationTree.children.length > 0 ? (
                    organizationTree.children.map((child: any) => renderOrgTreeNode(child))
                  ) : (
                    <div className="text-sm text-muted-foreground">暂无组织数据</div>
                  )}
                </div>
              )}
              {selectedOrgNodes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedOrgNodes.map((node) => (
                    <div
                      key={node.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-md text-sm"
                    >
                      {node.name}
                      <button
                        onClick={() => toggleOrgNodeSelection(node)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 查询配置：日期与关键字 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>查询配置</CardTitle>
          <CardDescription>设置查询日期及关键字自动分组</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 左侧：日期选择 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-primary" />
                <Label htmlFor="query-date" className="font-semibold text-sm">
                  查询日期
                </Label>
              </div>
              <div className="flex flex-col gap-2">
                <Input
                  id="query-date"
                  type="date"
                  value={queryDate}
                  onChange={(e) => {
                    setQueryDate(e.target.value)
                    setDateError('')
                  }}
                  onBlur={() => validateDate(queryDate)}
                  className={`h-10 ${dateError ? 'border-red-500 ring-red-500/20' : 'focus:ring-primary/20'}`}
                />
                {dateError && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-red-500 flex items-center gap-1"
                  >
                    <XCircle className="w-3 h-3" />
                    {dateError}
                  </motion.p>
                )}
                <p className="text-[10px] text-muted-foreground italic">
                  * 默认查询当日数据，建议选择正确日期以保证数据准确
                </p>
              </div>
            </div>

            {/* 右侧：关键字分组设置 */}
            <div className="space-y-3 border-l pl-8 md:block hidden">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <Label
                    htmlFor="keyword-grouping"
                    className="font-semibold text-sm cursor-pointer"
                  >
                    关键字分组
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="keyword-grouping"
                    checked={useKeywordGrouping}
                    onChange={(e) => setUseKeywordGrouping(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-muted-foreground">
                    {useKeywordGrouping ? '已启用' : '未启用'}
                  </span>
                </div>
              </div>

              <div
                className={`transition-all duration-300 overflow-hidden ${useKeywordGrouping ? 'opacity-100 max-h-40' : 'opacity-40 max-h-40 pointer-events-none'}`}
              >
                <textarea
                  id="keyword-text"
                  value={keywordText}
                  onChange={(e) => setKeywordText(e.target.value)}
                  disabled={!useKeywordGrouping}
                  placeholder="请输入关键字，每行一个。例如：\n游戏\n工具"
                  className="w-full h-24 px-3 py-2 text-sm border rounded-md resize-none focus-visible:ring-1 focus-visible:ring-primary outline-none bg-background/50"
                  rows={4}
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  系统将根据标签名称中是否包含以上关键字，自动对标签进行归类。
                </p>
              </div>
            </div>

            {/* 移动端显示的关键字分组设置（无边框） */}
            <div className="space-y-3 md:hidden block">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <Label htmlFor="keyword-grouping-mobile" className="font-semibold text-sm">
                    关键字自动分组
                  </Label>
                </div>
                <input
                  type="checkbox"
                  id="keyword-grouping-mobile"
                  checked={useKeywordGrouping}
                  onChange={(e) => setUseKeywordGrouping(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary"
                />
              </div>
              {useKeywordGrouping && (
                <div className="space-y-2">
                  <textarea
                    value={keywordText}
                    onChange={(e) => setKeywordText(e.target.value)}
                    placeholder="请输入关键字，每行一个"
                    className="w-full h-24 px-3 py-2 text-sm border rounded-md resize-none"
                    rows={4}
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 标签选择弹窗 */}
      <Dialog open={!!activeGroupId} onOpenChange={(open) => !open && setActiveGroupId(null)}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {activeGroupId === 'additional_tags' ? (
                '选择附加统计标签'
              ) : (
                <>
                  管理标签 -{' '}
                  {activeConfigId &&
                    (tagGroupsMap[activeConfigId] || []).find((g) => g.id === activeGroupId)?.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {activeGroupId === 'additional_tags'
                ? '选择用于附加统计的标签，这些标签将单独统计并显示在总计前面'
                : '选择要包含在标签组中的标签'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col flex-1 space-y-4 min-h-0">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索标签..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            <div className="flex items-center pb-2 space-x-2 border-b">
              <label className="flex items-center p-1 space-x-2 rounded cursor-pointer hover:bg-accent">
                <input
                  type="checkbox"
                  checked={
                    activeGroupId === 'additional_tags'
                      ? activeConfigId &&
                        (availableTagsMap[activeConfigId] || []).every((tag) =>
                          (additionalTagGroupsMap[activeConfigId] || []).some(
                            (t) => t.id === tag.id
                          )
                        )
                      : activeGroupId && activeConfigId
                        ? (availableTagsMap[activeConfigId] || []).every((tag) =>
                            (tagGroupsMap[activeConfigId] || [])
                              .find((g) => g.id === activeGroupId)
                              ?.tags.some((t) => t.id === tag.id)
                          )
                        : false
                  }
                  onChange={() => {
                    if (activeGroupId === 'additional_tags') {
                      if (activeConfigId) {
                        const allTags = availableTagsMap[activeConfigId] || []
                        const currentTags = additionalTagGroupsMap[activeConfigId] || []
                        const allSelected = allTags.every((tag) =>
                          currentTags.some((t) => t.id === tag.id)
                        )
                        if (allSelected) {
                          setAdditionalTagGroupsMap((prev) => ({
                            ...prev,
                            [activeConfigId]: []
                          }))
                        } else {
                          setAdditionalTagGroupsMap((prev) => ({
                            ...prev,
                            [activeConfigId]: allTags
                          }))
                        }
                      }
                    } else {
                      activeGroupId && toggleSelectAll(activeGroupId)
                    }
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">
                  全选 ({activeConfigId ? (availableTagsMap[activeConfigId] || []).length : 0})
                </span>
              </label>
              <span className="ml-auto text-sm text-muted-foreground">
                已选:{' '}
                {activeGroupId === 'additional_tags'
                  ? activeConfigId
                    ? (additionalTagGroupsMap[activeConfigId] || []).length
                    : 0
                  : activeGroupId && activeConfigId
                    ? (tagGroupsMap[activeConfigId] || []).find((g) => g.id === activeGroupId)?.tags
                        .length
                    : 0}
              </span>
            </div>

            <div className="overflow-y-auto flex-1 pr-2">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                {activeConfigId &&
                  (availableTagsMap[activeConfigId] || [])
                    .filter((tag) => tag.value.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((tag) => {
                      const isSelected =
                        activeGroupId === 'additional_tags'
                          ? (additionalTagGroupsMap[activeConfigId] || []).some(
                              (t) => t.id === tag.id
                            )
                          : (tagGroupsMap[activeConfigId] || [])
                              .find((g) => g.id === activeGroupId)
                              ?.tags.some((t) => t.id === tag.id) || false
                      return (
                        <label
                          key={tag.id}
                          className={`flex items-center space-x-2 cursor-pointer border rounded p-2 hover:bg-accent transition-colors ${isSelected ? 'bg-accent/50 border-primary/50' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected || false}
                            onChange={() => {
                              if (activeGroupId === 'additional_tags') {
                                if (activeConfigId) {
                                  const currentTags = additionalTagGroupsMap[activeConfigId] || []
                                  const isTagSelected = currentTags.some((t) => t.id === tag.id)
                                  if (isTagSelected) {
                                    setAdditionalTagGroupsMap((prev) => ({
                                      ...prev,
                                      [activeConfigId]: currentTags.filter((t) => t.id !== tag.id)
                                    }))
                                  } else {
                                    setAdditionalTagGroupsMap((prev) => ({
                                      ...prev,
                                      [activeConfigId]: [...currentTags, tag]
                                    }))
                                  }
                                }
                              } else {
                                activeGroupId && toggleTagInGroup(activeGroupId, tag)
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="text-sm truncate" title={tag.value}>
                            {tag.value}
                          </span>
                        </label>
                      )
                    })}
              </div>
              {activeConfigId &&
                (availableTagsMap[activeConfigId] || []).filter((tag) =>
                  tag.value.toLowerCase().includes(searchTerm.toLowerCase())
                ).length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">未找到匹配的标签</div>
                )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setActiveGroupId(null)}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 操作按钮 */}
      <div className="flex gap-4 justify-end items-center mt-8 sticky bottom-0 bg-background/80 backdrop-blur-md p-6 border rounded-xl shadow-lg z-10 mx-1">
        <div className="flex-1 hidden md:block">
          {selectedOrgNodes.length > 0 && (
            <p className="text-sm text-muted-foreground">
              已选择的组织:{' '}
              <span className="font-semibold text-primary">
                {selectedOrgNodes.length === 1
                  ? selectedOrgNodes[0].name
                  : `${selectedOrgNodes.length}个组织节点 (${selectedOrgNodes.map((n) => n.name).join(', ')})`}
              </span>
            </p>
          )}
        </div>

        <div className="flex gap-3">
          {Object.values(statisticsDataMap).some((data) => data?.data) && (
            <Button
              onClick={() => setIsStatisticsDialogOpen(true)}
              variant="outline"
              className="border-primary/20 hover:bg-primary/5"
            >
              <BarChart3 className="mr-2 w-4 h-4 text-primary" />
              查看统计结果
            </Button>
          )}

          {/* <Button
            onClick={saveAllConfigs}
            disabled={isSavingConfig || selectedConfigId === null}
            variant="outline"
            className="hover:bg-accent border-border transition-colors"
          >
            {isSavingConfig ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="mr-2 w-4 h-4 text-muted-foreground" />
                保存设置
              </>
            )}
          </Button> */}

          <Button
            onClick={handleFetchData}
            disabled={loading || selectedConfigId === null}
            size="lg"
            className="shadow-md hover:shadow-lg transition-all px-8"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                数据加载中...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 w-4 h-4" />
                拉取数据
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {/* {error && (
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center text-red-500">
              <XCircle className="mr-2 w-5 h-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )} */}

      {/* 数据统计信息 */}
      {Object.keys(statisticsDataMap).length > 0 &&
        Object.values(statisticsDataMap).some((data) => data?.data) && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm font-medium">数据统计已完成</p>
                {selectedConfigId !== null &&
                  statisticsDataMap[selectedConfigId]?.data &&
                  (() => {
                    const configId = selectedConfigId
                    const data = statisticsDataMap[configId]
                    const config = configs.find((c) => c.id === configId)
                    return (
                      <div
                        key={configId}
                        className="p-3 rounded-md border bg-muted/30 border-border/50"
                      >
                        <p className="text-xs font-medium">
                          {config?.cookie_name || `账户${configId}`}
                          {data?.recordTime && (
                            <span className="ml-2 text-muted-foreground">
                              ({new Date(data.recordTime).toLocaleString('zh-CN')})
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          查询日期: {data!.data!.query_date} | 标签组:{' '}
                          {data!.data!.group_results.length} | 总消耗:
                          {data!.data!.total_data.total_cost.toFixed(2)}
                        </p>
                      </div>
                    )
                  })()}
              </div>
            </CardContent>
          </Card>
        )}

      {/* 统计数据面板 Dialog */}
      <Dialog open={isStatisticsDialogOpen} onOpenChange={setIsStatisticsDialogOpen}>
        <DialogContent
          id="statistics-dialog-content"
          className="max-w-6xl max-h-[90vh] flex flex-col"
        >
          <DialogHeader>
            <div className="flex justify-between items-center">
              <div>
                <DialogTitle>数据统计汇总</DialogTitle>
                <DialogDescription>
                  {(() => {
                    if (selectedConfigId === null) return '暂无数据'
                    const data = statisticsDataMap[selectedConfigId]
                    if (!data?.data) return '暂无数据'
                    const query_date = data.data.query_date
                    return `查询日期: ${query_date}`
                  })()}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                {Object.values(statisticsDataMap).some((data) => data?.data) && (
                  <>
                    {/* <Button
                      onClick={sendToFeishu}
                      variant="default"
                      size="sm"
                      disabled={isSendingToFeishu}
                    >
                      {isSendingToFeishu ? (
                        <>
                          <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                          发送中...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 w-4 h-4" />
                          发送到飞书多维表格
                        </>
                      )}
                    </Button> */}
                    <Button
                      onClick={sendSummaryToFeishuSheet}
                      variant="default"
                      size="sm"
                      disabled={isSendingToFeishuSheet}
                    >
                      {isSendingToFeishuSheet ? (
                        <>
                          <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                          发送中...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 w-4 h-4" />
                          发送到飞书表格
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={generateImage}
                      variant="outline"
                      size="sm"
                      disabled={isGeneratingImage}
                    >
                      {isGeneratingImage ? (
                        <>
                          <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Camera className="mr-2 w-4 h-4" />
                          生成图片
                        </>
                      )}
                    </Button>
                    {/* <Button onClick={exportToCSV} variant="outline" size="sm">
                      <Download className="mr-2 w-4 h-4" />
                      导出CSV
                    </Button> */}
                  </>
                )}
              </div>
            </div>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            {(() => {
              if (selectedConfigId === null) return null
              const data = statisticsDataMap[selectedConfigId]
              if (!data?.data) return null
              const validStats = [{ id: selectedConfigId, data }]

              if (validStats.length === 0) {
                return <div className="py-8 text-center text-muted-foreground">暂无数据</div>
              }

              // 如果没有数据，显示提示
              if (
                !validStats[0]?.data?.data?.group_results ||
                validStats[0].data.data.group_results.length === 0
              ) {
                return <div className="py-8 text-center text-muted-foreground">暂无数据</div>
              }

              // 按项目分组数据，然后在项目内按关键字分组
              interface ProjectGroupData {
                projectName: string
                keywordGroups: Map<
                  string | undefined,
                  {
                    keyword: string | undefined
                    groups: Array<{
                      ebpName: string
                      ebpId: string
                      filter_data: any
                    }>
                  }
                >
              }

              const projectGroupMap = new Map<string, ProjectGroupData>()

              validStats.forEach(({ id, data }) => {
                const { group_results } = data!.data!

                if (!group_results || !Array.isArray(group_results)) {
                  return
                }

                group_results.forEach((group) => {
                  const projectName = (group as any).project_name || '其他'
                  const keyword = group.keyword || undefined
                  const ebpName = group.ebp_name || group.ebp_id || group.group_name || '未知'
                  const ebpId = group.ebp_id || group.group_name || 'unknown'

                  // 获取或创建项目组
                  if (!projectGroupMap.has(projectName)) {
                    projectGroupMap.set(projectName, {
                      projectName,
                      keywordGroups: new Map()
                    })
                  }

                  const projectGroup = projectGroupMap.get(projectName)!

                  // 获取或创建关键字组
                  if (!projectGroup.keywordGroups.has(keyword)) {
                    projectGroup.keywordGroups.set(keyword, {
                      keyword,
                      groups: []
                    })
                  }

                  projectGroup.keywordGroups.get(keyword)!.groups.push({
                    ebpName,
                    ebpId,
                    filter_data: group.filter_data
                  })
                })
              })

              // 转换为数组并排序（项目顺序：红果、番茄小说、番茄畅听、漫剧、游戏、其他）
              const projectOrder = ['红果', '番茄小说', '番茄畅听', '漫剧', '游戏', '其他']
              const projectGroups = Array.from(projectGroupMap.entries()).sort((a, b) => {
                const indexA = projectOrder.indexOf(a[0])
                const indexB = projectOrder.indexOf(b[0])
                const finalIndexA = indexA === -1 ? projectOrder.length : indexA
                const finalIndexB = indexB === -1 ? projectOrder.length : indexB
                return finalIndexA - finalIndexB
              })

              return (
                <div className="overflow-x-auto space-y-4">
                  {projectGroups.map(([projectName, projectGroup]) => {
                    // 将关键字组转换为数组并排序（关键字为 undefined 的放在最后）
                    const keywordGroups = Array.from(projectGroup.keywordGroups.entries()).sort(
                      (a, b) => {
                        if (a[0] === undefined) return 1
                        if (b[0] === undefined) return -1
                        return (a[0] || '').localeCompare(b[0] || '')
                      }
                    )

                    return (
                      <div key={projectName} className="rounded-lg border">
                        <div className="p-3 border-b bg-primary/10">
                          <h3 className="text-lg font-bold text-primary">项目: {projectName}</h3>
                        </div>
                        <div className="space-y-3 p-4">
                          {keywordGroups.map(([keyword, { groups }]) => {
                            // 计算该关键字组的小计
                            const subtotal = groups.reduce(
                              (acc, { filter_data }) => {
                                acc.total_cost += filter_data.total_cost || 0
                                acc.total_active += filter_data.total_active || 0
                                acc.yesterday_cost += filter_data.yesterday_cost || 0
                                acc.yesterday_active += filter_data.yesterday_active || 0
                                acc.history_7d_cost += filter_data.history_7d_cost || 0
                                acc.history_7d_active += filter_data.history_7d_active || 0
                                acc.history_7d_attribution_next_day_open_cnt +=
                                  filter_data.history_7d_attribution_next_day_open_cnt || 0
                                acc.history_7d_attribution_retention_7d_cnt +=
                                  filter_data.history_7d_attribution_retention_7d_cnt || 0
                                return acc
                              },
                              {
                                total_cost: 0,
                                total_active: 0,
                                yesterday_cost: 0,
                                yesterday_active: 0,
                                history_7d_cost: 0,
                                history_7d_active: 0,
                                history_7d_attribution_next_day_open_cnt: 0,
                                history_7d_attribution_retention_7d_cnt: 0
                              }
                            )

                            // 计算激活成本
                            const active_cost =
                              subtotal.total_active > 0
                                ? subtotal.total_cost / subtotal.total_active
                                : 0
                            const yesterday_active_cost =
                              subtotal.yesterday_active > 0
                                ? subtotal.yesterday_cost / subtotal.yesterday_active
                                : 0
                            const history_7d_active_cost =
                              subtotal.history_7d_attribution_retention_7d_cnt > 0
                                ? subtotal.history_7d_cost /
                                  subtotal.history_7d_attribution_retention_7d_cnt
                                : 0

                            // 计算留存率
                            const yesterday_next_day_retention =
                              subtotal.yesterday_active > 0
                                ? (groups.reduce((sum, { filter_data }) => {
                                    const retention =
                                      (filter_data.yesterday_next_day_retention || 0) / 100
                                    const active = filter_data.yesterday_active || 0
                                    return sum + retention * active
                                  }, 0) /
                                    subtotal.yesterday_active) *
                                  100
                                : 0
                            const history_7d_next_day_retention =
                              subtotal.history_7d_active > 0
                                ? (subtotal.history_7d_attribution_next_day_open_cnt /
                                    subtotal.history_7d_active) *
                                  100
                                : 0
                            const history_7d_retention_7d =
                              subtotal.history_7d_active > 0
                                ? (subtotal.history_7d_attribution_retention_7d_cnt /
                                    subtotal.history_7d_active) *
                                  100
                                : 0

                            // 判断是否为红果项目，只有红果项目才显示历史七日相关列
                            const isHongguoProject = projectName === '红果'

                            return (
                              <div key={keyword || '__no_keyword__'} className="rounded-lg border">
                                <div className="p-3 border-b bg-muted/50">
                                  <h4 className="font-bold">
                                    {keyword ? `关键字: ${keyword}` : ''}
                                  </h4>
                                </div>
                                <div className="p-4">
                                  <table className="w-full text-sm border-collapse">
                                    <thead>
                                      <tr className="bg-muted">
                                        <th className="p-2 text-left border">团队</th>
                                        <th className="p-2 text-right border">总消耗</th>
                                        <th className="p-2 text-right border">激活数</th>
                                        <th className="p-2 text-right border">激活成本</th>
                                        <th className="p-2 text-right border">昨日消耗</th>
                                        <th className="p-2 text-right border">昨日激活成本</th>
                                        <th className="p-2 text-right border">昨日次留率</th>
                                        {isHongguoProject && (
                                          <>
                                            <th className="p-2 text-right border">历史七日消耗</th>
                                            <th className="p-2 text-right border">历史七日成本</th>
                                            <th className="p-2 text-right border">
                                              历史七日次留率
                                            </th>
                                            <th className="p-2 text-right border">历史七日7留率</th>
                                          </>
                                        )}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {groups.map(({ ebpName, ebpId, filter_data }, idx) => (
                                        <tr key={`${ebpId}-${idx}`}>
                                          <td className="p-2 border">
                                            <div className="font-medium">{ebpName}</div>
                                          </td>
                                          <td className="p-2 text-right border">
                                            {filter_data.total_cost.toFixed(2)}
                                          </td>
                                          <td className="p-2 text-right text-orange-600 border">
                                            {filter_data.total_active || 0}
                                          </td>
                                          <td className="p-2 text-right text-blue-600 border">
                                            {filter_data.active_cost.toFixed(2)}
                                          </td>
                                          <td className="p-2 text-right text-amber-600 border">
                                            {(filter_data.yesterday_cost || 0).toFixed(2)}
                                          </td>
                                          <td className="p-2 text-right text-amber-600 border">
                                            {(filter_data.yesterday_active_cost || 0).toFixed(2)}
                                          </td>
                                          <td className="p-2 text-right text-amber-600 border">
                                            {(
                                              filter_data.yesterday_next_day_retention || 0
                                            ).toFixed(2)}
                                            %
                                          </td>
                                          {isHongguoProject && (
                                            <>
                                              <td className="p-2 text-right text-indigo-600 border">
                                                {(filter_data.history_7d_cost || 0).toFixed(2)}
                                              </td>
                                              <td className="p-2 text-right text-indigo-600 border">
                                                {(filter_data.history_7d_active_cost || 0).toFixed(
                                                  2
                                                )}
                                              </td>
                                              <td className="p-2 text-right text-indigo-600 border">
                                                {(
                                                  filter_data.history_7d_next_day_retention || 0
                                                ).toFixed(2)}
                                                %
                                              </td>
                                              <td className="p-2 text-right text-indigo-600 border">
                                                {(filter_data.history_7d_retention_7d || 0).toFixed(
                                                  2
                                                )}
                                                %
                                              </td>
                                            </>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsStatisticsDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 生成图片预览 Dialog */}
      <Dialog open={!!generatedImageUrl} onOpenChange={(open) => !open && closeImagePreview()}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>数据统计汇总图片</DialogTitle>
            <DialogDescription>
              后端生成的统计报表预览，可右键保存或使用下方按钮下载
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto flex justify-center bg-muted/30 rounded-lg p-4">
            {generatedImageUrl && (
              <img
                src={generatedImageUrl}
                alt="数据统计汇总"
                className="max-w-full h-auto object-contain"
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (generatedImageUrl) {
                  const link = document.createElement('a')
                  link.href = generatedImageUrl
                  link.download = `数据统计汇总_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.png`
                  link.click()
                }
              }}
            >
              <Download className="mr-2 w-4 h-4" />
              下载图片
            </Button>
            <Button onClick={closeImagePreview}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 浮动操作日志按钮和面板 */}
      {(logs.length > 0 || loading) && (
        <>
          {/* 浮动按钮 */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="fixed right-6 bottom-6 z-50"
          >
            <Button
              onClick={() => setIsLogPanelOpen(!isLogPanelOpen)}
              size="lg"
              className="relative p-0 w-14 h-14 rounded-full shadow-lg"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <FileText className="w-6 h-6" />
              )}
              {logs.length > 0 && (
                <span className="flex absolute -top-1 -right-1 justify-center items-center w-5 h-5 text-xs rounded-full bg-destructive text-destructive-foreground">
                  {logs.length}
                </span>
              )}
            </Button>
          </motion.div>

          {/* 日志面板 */}
          {isLogPanelOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)]"
            >
              <Card className="border-2 shadow-2xl">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg">操作日志</CardTitle>
                      <CardDescription className="text-xs">
                        查看数据拉取的执行过程和结果
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {logs.length > 0 && !loading && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            clearLogs()
                            setIsLogPanelOpen(false)
                          }}
                          className="h-8 text-xs"
                        >
                          清空
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsLogPanelOpen(false)}
                        className="p-0 w-8 h-8"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="rounded-lg border bg-muted/30 max-h-[500px] overflow-y-auto">
                    <div className="p-3 space-y-2 text-sm">
                      {logs.length === 0 && loading ? (
                        <div className="flex gap-2 items-center p-4 text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>正在执行操作...</span>
                        </div>
                      ) : (
                        logs.map((log, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`flex items-start gap-3 p-3 rounded-md ${
                              log.type === 'error'
                                ? 'bg-destructive/10 text-destructive border border-destructive/20'
                                : log.type === 'success'
                                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                                  : 'bg-muted/50 text-muted-foreground border border-border'
                            }`}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              {log.type === 'error' ? (
                                <XCircle className="w-4 h-4" />
                              ) : log.type === 'success' ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <Loader2 className="w-4 h-4" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex gap-2 items-center mb-1">
                                <span className="font-mono text-xs opacity-70">
                                  {log.timestamp.toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="leading-relaxed break-words">{log.message}</div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
