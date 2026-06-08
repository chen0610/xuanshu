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
  dataAssistantService,
  dataAssistantConfigService,
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

export const DataAssistantPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigIds, setSelectedConfigIds] = useState<number[]>([])
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
  const [useKeywordGrouping, setUseKeywordGrouping] = useState(false)
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

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  // 按关键字和标签组汇总数据的辅助函数（优先使用后端聚合结果）
  const processTagGroupAggregation = (
    stats: Array<{ id: number; data: DataStatisticsResponse | null }>
  ) => {
    // 如果后端返回了 aggregated_results，使用后端的聚合结果再进行跨账户聚合
    const hasBackendAggregation = stats.some(
      ({ data }) => data?.data?.aggregated_results && data.data.aggregated_results.length > 0
    )

    if (hasBackendAggregation) {
      return processBackendAggregatedResults(stats)
    }

    // 否则使用旧的前端聚合逻辑
    return processLegacyTagGroupAggregation(stats)
  }

  // 处理后端返回的聚合结果
  const processBackendAggregatedResults = (
    stats: Array<{ id: number; data: DataStatisticsResponse | null }>
  ) => {
    // 检查是否启用了关键字分组
    const hasKeywordGrouping = stats.some(({ data }) =>
      data?.data?.aggregated_results?.some((g: any) => g.keyword)
    )

    // 按关键字和标签组汇总数据
    const keywordGroupAggregation: Record<
      string,
      Record<
        string,
        {
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
          count: number
        }
      >
    > = {}

    stats.forEach(({ data }) => {
      const aggregatedResults = data?.data?.aggregated_results || []

      aggregatedResults.forEach((agg: any) => {
        const keyword = agg.keyword
        const groupNameKey = agg.key
        const keywordKey = keyword || '__no_keyword__'

        if (!keywordGroupAggregation[keywordKey]) {
          keywordGroupAggregation[keywordKey] = {}
        }

        if (!keywordGroupAggregation[keywordKey][groupNameKey]) {
          keywordGroupAggregation[keywordKey][groupNameKey] = {
            tagList: agg.tag_list || '',
            totalCost: 0,
            totalActive: 0,
            yesterdayCost: 0,
            yesterdayActive: 0,
            yesterdayRetentionCount: 0,
            history7dCost: 0,
            history7dActive: 0,
            history7dNextDayOpenCnt: 0,
            history7dRetention7dCnt: 0,
            count: 0
          }
        }

        const aggEntry = keywordGroupAggregation[keywordKey][groupNameKey]
        aggEntry.totalCost += agg.total_cost || 0
        aggEntry.totalActive += agg.total_active || 0
        aggEntry.yesterdayCost += agg.yesterday_cost || 0
        aggEntry.yesterdayActive += agg.yesterday_active || 0
        aggEntry.yesterdayRetentionCount += agg.yesterday_retention_count || 0
        aggEntry.history7dCost += agg.history_7d_cost || 0
        aggEntry.history7dActive += agg.history_7d_active || 0
        aggEntry.history7dNextDayOpenCnt += agg.history_7d_next_day_open_cnt || 0
        aggEntry.history7dRetention7dCnt += agg.history_7d_retention_7d_cnt || 0
        aggEntry.count += 1
      })
    })

    // 转换为数组，按关键字和标签组名称排序
    const result: Array<{
      keyword?: string
      key: string
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
      activeCost: number
      yesterdayActiveCost: number
      yesterdayNextRetention: number
      history7dActiveCost: number
      avgHistory7dNextDayRetention: number
      avgHistory7d7dRetention: number
      allocationRatio: number
      count: number
    }> = []

    const sortedKeywords = Object.keys(keywordGroupAggregation).sort()
    const allEntries: Array<{
      keyword: string
      groupNameKey: string
      keyPart1: string
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
          value
        })
      })
    })

    // 按投手分组，计算每个投手组的总消耗行激活数（作为分母）
    const keyPart1Denominators = new Map<string, number>()
    allEntries.forEach((entry) => {
      const parts = entry.groupNameKey.split('-')
      const keyPart2 = parts[1]?.trim() || '总消耗'
      if (keyPart2.includes('总消耗')) {
        keyPart1Denominators.set(entry.keyPart1, entry.value.totalActive)
      }
    })

    // 构建结果数组
    allEntries.forEach((entry) => {
      const denominator = keyPart1Denominators.get(entry.keyPart1) || 0
      const parts = entry.groupNameKey.split('-')
      const keyPart2 = parts[1]?.trim() || ''
      const allocationRatio =
        keyPart2 == '' ? 100 : denominator > 0 ? (entry.value.totalActive / denominator) * 100 : 0

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
        tagList: entry.value.tagList,
        totalCost: entry.value.totalCost,
        totalActive: entry.value.totalActive,
        yesterdayCost: entry.value.yesterdayCost,
        yesterdayActive: entry.value.yesterdayActive,
        yesterdayRetentionCount: entry.value.yesterdayRetentionCount,
        history7dCost: entry.value.history7dCost,
        history7dActive: entry.value.history7dActive,
        history7dNextDayOpenCnt: entry.value.history7dNextDayOpenCnt,
        history7dRetention7dCnt: entry.value.history7dRetention7dCnt,
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
        allocationRatio,
        count: entry.value.count
      })
    })

    return { result, hasKeywordGrouping }
  }

  // 旧的前端聚合逻辑（保留作为备用）
  const processLegacyTagGroupAggregation = (
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
            tagList: group.tags.map((t) => t.value).join(', '),
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
    const cached = localStorage.getItem('data-assistant-selected-config-ids')
    if (cached) {
      try {
        const ids = JSON.parse(cached)
        if (Array.isArray(ids)) {
          setSelectedConfigIds(ids)
        }
      } catch (e) {
        console.error('Failed to load cached selected config ids:', e)
      }
    }
  }, [])

  // 自动保存选中账户
  useEffect(() => {
    if (selectedConfigIds.length > 0) {
      localStorage.setItem('data-assistant-selected-config-ids', JSON.stringify(selectedConfigIds))
    }
  }, [selectedConfigIds])

  useEffect(() => {
    selectedConfigIds.forEach((configId) => {
      if (!availableTagsMap[configId]) {
        loadTags(configId)
      }
      if (!tagGroupsMap[configId]) {
        loadTagGroupsForConfig(configId)
      }
      // 加载数据助手配置
      loadDataAssistantConfig(configId)
    })
  }, [selectedConfigIds])

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
    if (selectedConfigIds.length === 0 || !activeConfigId) return

    const saveTimer = setTimeout(() => {
      // 只保存当前活动账户的配置
      saveDataAssistantConfig(activeConfigId).catch(console.error)
    }, 2000) // 延迟2秒保存，避免频繁请求

    return () => clearTimeout(saveTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagGroupsMap, additionalTagGroupsMap, useKeywordGrouping, keywordText, activeConfigId])

  // 自动保存统计数据映射到localStorage
  useEffect(() => {
    const hasData = Object.values(statisticsDataMap).some((data) => data !== null)
    if (hasData) {
      localStorage.setItem('data-assistant-statistics-map', JSON.stringify(statisticsDataMap))
    }
  }, [statisticsDataMap])

  const loadConfigs = async (): Promise<void> => {
    try {
      const oceanConfigs = await configService.getConfigsBySource(1)
      setConfigs(oceanConfigs)
      if (oceanConfigs.length > 0 && selectedConfigIds.length === 0) {
        setSelectedConfigIds([oceanConfigs[0].id])
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

  const loadDataAssistantConfig = async (configId: number): Promise<void> => {
    setIsLoadingConfig(true)
    try {
      const config = await dataAssistantConfigService.getConfig(configId)
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

      await dataAssistantConfigService.updateConfig(configId, configData)
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
      for (const configId of selectedConfigIds) {
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

      const promises = selectedConfigIds.map(async (configId) => {
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
        return dataAssistantConfigService.updateConfig(configId, configData)
      })

      await Promise.all(promises)
      // addLog(`所有配置已保存`, 'success')
      toast.success('配置保存成功', {
        description: `已为 ${selectedConfigIds.length} 个账户保存数据助手配置`
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
      const response = await dataAssistantService.getAccountTags(configId)
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
    if (!activeConfigId) return

    const currentGroups = tagGroupsMap[activeConfigId] || []
    const groupId = `group_${Date.now()}`
    const newGroup: TagGroup = {
      id: groupId,
      name: '', // 默认空名称，提示用户输入
      tags: selectedTags
    }
    setTagGroupsMap((prev) => ({
      ...prev,
      [activeConfigId]: [...currentGroups, newGroup]
    }))
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
    setSelectedConfigIds((prev) => {
      if (prev.includes(configId)) {
        const newIds = prev.filter((id) => id !== configId)
        // 如果取消选择的是当前活动账户，切换到第一个选中的账户
        if (activeConfigId === configId && newIds.length > 0) {
          setActiveConfigId(newIds[0])
        }
        return newIds
      } else {
        // 如果是第一个选中的账户，设置为活动账户
        if (prev.length === 0) {
          setActiveConfigId(configId)
        }
        return [...prev, configId]
      }
    })
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

    if (selectedConfigIds.length === 0) {
      setError('请至少选择一个引擎账户')
      return
    }

    // 验证每个账户至少有一个标签组且标签组名称不为空
    const invalidConfigs = selectedConfigIds.filter((configId) => {
      const groups = getSelectedTagGroups(configId)
      return groups.length === 0 || groups.some((group) => !group.name.trim())
    })

    if (invalidConfigs.length > 0) {
      const configNames = invalidConfigs
        .map((id) => {
          const config = configs.find((c) => c.id === id)
          const groups = getSelectedTagGroups(id)
          const hasEmptyName = groups.some((group) => !group.name.trim())
          const hasNoGroups = groups.length === 0
          return `${config?.cookie_name || `账户${id}`}${hasNoGroups ? '(无标签组)' : hasEmptyName ? '(标签组名称为空)' : ''}`
        })
        .join(', ')
      setError(`以下账户存在问题: ${configNames}`)
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
    addLog(`选中账户数量: ${selectedConfigIds.length}`, 'info')

    try {
      // 使用多账户请求模式：将所有账户合并在一个请求中
      addLog(`开始合并请求所有账户数据...`, 'info')

      // 构建 tag_groups_map 和 additional_tag_groups_map
      const tagGroupsMap: Record<string, any[]> = {}
      const additionalTagGroupsMapForRequest: Record<string, any[]> = {}

      selectedConfigIds.forEach((configId) => {
        const selectedGroups = getSelectedTagGroups(configId)
        const configName = configs.find((c) => c.id === configId)?.cookie_name || `账户${configId}`
        addLog(`[${configName}] 标签组数量: ${selectedGroups.length}`, 'info')

        // 添加到 tag_groups_map
        tagGroupsMap[String(configId)] = selectedGroups
          .map((group) => ({
            id: group.id,
            name: group.name,
            tags: group.tags.filter((tag) => tag.id && tag.value)
          }))
          .filter((group) => group.tags.length > 0)

        // 添加到 additional_tag_groups_map
        const additionalTags = (additionalTagGroupsMap[configId] || [])
          .map((tag) => ({
            id: String(tag.id || ''),
            value: String(tag.value || '')
          }))
          .filter((tag) => tag.id && tag.value)

        if (additionalTags.length > 0) {
          additionalTagGroupsMapForRequest[String(configId)] = additionalTags
        }
      })

      // 构建多账户请求数据
      const requestData = {
        config_ids: selectedConfigIds,
        query_date: queryDate.trim(),
        tag_groups_map: tagGroupsMap,
        additional_tag_groups_map:
          Object.keys(additionalTagGroupsMapForRequest).length > 0
            ? additionalTagGroupsMapForRequest
            : null,
        use_keyword_grouping: useKeywordGrouping,
        keyword_text: useKeywordGrouping ? keywordText : null
      }

      try {
        const response = await dataAssistantService.getDataStatistics(requestData)
        if (response.code === 0) {
          addLog(`所有账户数据拉取成功！`, 'success')
          if (response.data) {
            addLog(`合并后总消耗: ${response.data.total_data.total_cost.toFixed(2)}`, 'info')
          }

          // 为每个账户设置各自的数据（使用 account_data_map）
          const newStatisticsDataMap: Record<number, DataStatisticsResponse | null> = {}
          const accountDataMap = response.data?.account_data_map || {}

          selectedConfigIds.forEach((configId) => {
            const accountData = accountDataMap[String(configId)]
            const configName =
              configs.find((c) => c.id === configId)?.cookie_name || `账户${configId}`

            if (accountData) {
              // 该账户有数据
              newStatisticsDataMap[configId] = {
                code: 0,
                data: accountData,
                msg: 'success',
                recordTime: new Date().toISOString()
              }
              addLog(`[${configName}] 数据拉取成功`, 'success')
            } else {
              // 该账户失败或没有数据
              newStatisticsDataMap[configId] = null
              addLog(`[${configName}] 数据拉取失败`, 'error')
            }
          })
          setStatisticsDataMap(newStatisticsDataMap)
        } else {
          const errorMsg = response.msg || response.error || '获取数据失败'
          addLog(`失败: ${errorMsg}`, 'error')
          // 为所有账户设置 null
          const newStatisticsDataMap: Record<number, DataStatisticsResponse | null> = {}
          selectedConfigIds.forEach((configId) => {
            newStatisticsDataMap[configId] = null
          })
          setStatisticsDataMap(newStatisticsDataMap)
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
        addLog(`失败: ${errorMsg}`, 'error')
        // 为所有账户设置 null
        const newStatisticsDataMap: Record<number, DataStatisticsResponse | null> = {}
        selectedConfigIds.forEach((configId) => {
          newStatisticsDataMap[configId] = null
        })
        setStatisticsDataMap(newStatisticsDataMap)
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
    // 使用第一个有数据的选中账户
    const firstConfigWithData = selectedConfigIds.find((id) => statisticsDataMap[id]?.data)
    if (!firstConfigWithData) {
      addLog('暂无统计数据，请先拉取数据', 'error')
      return
    }
    const data = statisticsDataMap[firstConfigWithData]
    if (!data?.data) {
      addLog('暂无统计数据，请先拉取数据', 'error')
      return
    }

    setIsGeneratingImage(true)
    addLog('开始生成统计汇总图片...', 'info')

    try {
      // 确保传递完整的统计数据：多账户时 account_data_map 存的是内层 data，单账户时 data 即统计数据
      const raw = data.data
      const statisticsData =
        raw?.data && (raw.data?.group_results || raw.data?.aggregated_results) ? raw.data : raw
      // 调试：检查传给 export-image 的数据（排查 total_cost 为空时使用）
      const td = statisticsData?.total_data || {}
      const gr = statisticsData?.group_results || []
      const ar = statisticsData?.aggregated_results || []
      console.log('[generateImage] 发送数据:', {
        total_cost: td.total_cost,
        group_results_len: gr.length,
        aggregated_len: ar.length,
        first_filter_data_total_cost: gr[0]?.filter_data?.total_cost,
        first_agg_total_cost: ar[0]?.total_cost
      })
      const blob = await dataAssistantService.exportStatisticsImage(statisticsData)
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

  const sendSummaryToFeishuSheet = async (): Promise<void> => {
    const validStats = selectedConfigIds
      .map((id) => ({ id, data: statisticsDataMap[id] }))
      .filter((item) => item.data?.data)

    if (validStats.length === 0) return

    setIsSendingToFeishuSheet(true)
    addLog('开始发送汇总数据到飞书表格...', 'info')

    try {
      // 获取查询日期（从第一个有效数据中获取）
      const query_date = validStats[0].data!.data!.query_date

      // 准备表头
      // 检查是否启用了关键字分组
      const hasKeywordGroupingForSheet = validStats.some(({ data }) =>
        data?.data?.group_results?.some((g) => g.keyword || g.group_name.includes(' - '))
      )

      const headers = [
        // '账户名称',
        ...(hasKeywordGroupingForSheet ? ['关键字'] : []),
        '投手',
        '投放类型',
        '出价类型',
        '总消耗',
        '激活数',
        '激活成本',
        '投放占比',
        '昨日消耗',
        '昨日激活成本',
        '昨日次留率',
        '历史七日消耗',
        '历史七日成本',
        '历史七日次留率',
        '历史七日7留率'
      ]

      // 准备数据行
      const rows: string[][] = []
      let totalCost = 0
      let totalActiveCost = 0
      let totalActive = 0
      let recordCount = 0

      // 计算总计数据
      let totalHistory7dCost = 0
      let totalHistory7dActive = 0
      let totalHistory7dNextDayOpenCnt = 0
      let totalHistory7dRetention7dCnt = 0
      validStats.forEach(({ data }) => {
        const { total_data } = data!.data!
        totalCost += total_data.total_cost
        totalActive += total_data.total_active || 0
        totalHistory7dCost += total_data.history_7d_cost || 0
        totalHistory7dActive += total_data.history_7d_active || 0
        totalHistory7dNextDayOpenCnt += total_data.history_7d_attribution_next_day_open_cnt || 0
        totalHistory7dRetention7dCnt += total_data.history_7d_attribution_retention_7d_cnt || 0
        recordCount++
      })
      if (totalActive > 0) {
        totalActiveCost = totalCost / totalActive
      }

      // 计算总计的昨日数据
      let totalYesterdayCost = 0
      let totalYesterdayActive = 0
      let totalYesterdayRetentionCount = 0
      validStats.forEach(({ data }) => {
        const { total_data } = data!.data!
        totalYesterdayCost += total_data.yesterday_cost || 0
        totalYesterdayActive += total_data.yesterday_active || 0
        const yesterdayRetention = (total_data.yesterday_next_day_retention || 0) / 100
        const yesterdayActive = total_data.yesterday_active || 0
        totalYesterdayRetentionCount += yesterdayRetention * yesterdayActive
      })

      const totalYesterdayActiveCost =
        totalYesterdayActive > 0 ? totalYesterdayCost / totalYesterdayActive : 0

      const totalYesterdayNextRetention =
        totalYesterdayActive > 0 ? (totalYesterdayRetentionCount / totalYesterdayActive) * 100 : 0

      // 按标签组汇总数据（仅当多账户时）
      if (validStats.length > 1) {
        const { result: tagGroupAggregationArray, hasKeywordGrouping } =
          processTagGroupAggregation(validStats)

        // 添加标签组汇总数据行
        tagGroupAggregationArray.forEach((agg) => {
          // 将标签组名称按 "-" 分割为三部分
          const parts = agg.key.split('-')
          const keyPart1 = parts[0]?.trim() || agg.key
          const keyPart2 = parts[1]?.trim() || '总消耗'
          const keyPart3 = parts[2]?.trim() || ' '
          const history7dActiveCost =
            agg.history7dActive > 0 ? agg.history7dCost / agg.history7dActive : 0
          const history7dNextDayRetention =
            agg.history7dActive > 0 ? (agg.history7dNextDayOpenCnt / agg.history7dActive) * 100 : 0
          const history7d7dRetention =
            agg.history7dActive > 0 ? (agg.history7dRetention7dCnt / agg.history7dActive) * 100 : 0
          const row = [
            // `${agg.accounts.join(', ')} (${agg.accounts.length})`,
            keyPart1,
            keyPart2,
            keyPart3,
            agg.totalCost.toFixed(2),
            agg.totalActive.toString(),
            agg.activeCost.toFixed(2),
            agg.allocationRatio.toFixed(2) + '%',
            agg.yesterdayCost.toFixed(2),
            agg.yesterdayActiveCost.toFixed(2),
            agg.yesterdayNextRetention.toFixed(2) + '%',
            agg.history7dCost.toFixed(2),
            history7dActiveCost.toFixed(2),
            history7dNextDayRetention.toFixed(2) + '%',
            history7d7dRetention.toFixed(2) + '%'
          ]
          if (hasKeywordGroupingForSheet && agg.keyword) {
            row.splice(1, 0, agg.keyword) // 在标签组名称前插入关键字
          }
          rows.push(row)
        })
      }

      // 添加附加统计结果（在总计行前面）
      if (validStats.length > 1) {
        // 收集所有账户的附加统计结果
        const additionalResultsMap: Record<
          string,
          {
            tagValue: string
            totalCost: number
            totalActive: number
            yesterdayCost: number
            yesterdayActive: number
            yesterdayNextDayRetention: number
            history7dCost: number
            history7dActive: number
            history7dNextDayOpenCnt: number
            history7dRetention7dCnt: number
            history7dActiveCost: number
            history7dNextDayRetention: number
            history7dRetention7d: number
            count: number
          }
        > = {}

        validStats.forEach(({ data }) => {
          const additionalResults = data?.data?.additional_results || []
          additionalResults.forEach((result) => {
            const tagValue = result.group_name || result.tags[0]?.value || ''
            if (!additionalResultsMap[tagValue]) {
              additionalResultsMap[tagValue] = {
                tagValue,
                totalCost: 0,
                totalActive: 0,
                yesterdayCost: 0,
                yesterdayActive: 0,
                yesterdayNextDayRetention: 0,
                history7dCost: 0,
                history7dActive: 0,
                history7dNextDayOpenCnt: 0,
                history7dRetention7dCnt: 0,
                history7dActiveCost: 0,
                history7dNextDayRetention: 0,
                history7dRetention7d: 0,
                count: 0
              }
            }
            const agg = additionalResultsMap[tagValue]
            agg.totalCost += result.filter_data.total_cost || 0
            agg.totalActive += result.filter_data.total_active || 0
            agg.yesterdayCost += result.filter_data.yesterday_cost || 0
            agg.yesterdayActive += result.filter_data.yesterday_active || 0
            agg.yesterdayNextDayRetention +=
              ((result.filter_data.yesterday_next_day_retention || 0) *
                (result.filter_data.yesterday_active || 0)) /
              100
            agg.history7dCost += result.filter_data.history_7d_cost || 0
            agg.history7dActive += result.filter_data.history_7d_active || 0
            agg.history7dNextDayOpenCnt +=
              result.filter_data.history_7d_attribution_next_day_open_cnt || 0
            agg.history7dRetention7dCnt +=
              result.filter_data.history_7d_attribution_retention_7d_cnt || 0
            agg.count++
          })
        })

        // 计算历史七日成本和留存率
        Object.values(additionalResultsMap).forEach((agg) => {
          if (agg.history7dActive > 0) {
            agg.history7dActiveCost = agg.history7dCost / agg.history7dActive
            agg.history7dNextDayRetention =
              (agg.history7dNextDayOpenCnt / agg.history7dActive) * 100
            agg.history7dRetention7d = (agg.history7dRetention7dCnt / agg.history7dActive) * 100
          }
        })

        // 添加附加统计结果行
        Object.values(additionalResultsMap).forEach((agg) => {
          const activeCost = agg.totalActive > 0 ? agg.totalCost / agg.totalActive : 0
          const yesterdayActiveCost =
            agg.yesterdayActive > 0 ? agg.yesterdayCost / agg.yesterdayActive : 0
          const yesterdayNextRetention =
            agg.yesterdayActive > 0
              ? (agg.yesterdayNextDayRetention / agg.yesterdayActive) * 100
              : 0
          const history7dActiveCost =
            agg.history7dActive > 0 ? agg.history7dCost / agg.history7dActive : 0
          const history7dNextDayRetention =
            agg.history7dActive > 0 ? (agg.history7dNextDayOpenCnt / agg.history7dActive) * 100 : 0
          const history7d7dRetention =
            agg.history7dActive > 0 ? (agg.history7dRetention7dCnt / agg.history7dActive) * 100 : 0
          const row = [
            agg.tagValue, // 标签名称
            '-', // 投放类型
            '-', // 出价类型
            agg.totalCost.toFixed(2),
            agg.totalActive.toString(),
            activeCost.toFixed(2),
            '-', // 投放占比
            agg.yesterdayCost.toFixed(2),
            yesterdayActiveCost.toFixed(2),
            yesterdayNextRetention.toFixed(2) + '%',
            agg.history7dCost.toFixed(2),
            history7dActiveCost.toFixed(2),
            history7dNextDayRetention.toFixed(2) + '%',
            history7d7dRetention.toFixed(2) + '%'
          ]
          if (hasKeywordGroupingForSheet) {
            row.splice(1, 0, '') // 在标签名称前插入空关键字
          }
          rows.push(row)
        })
      }

      // 添加总计行
      const totalRow = [
        '总计',
        '-',
        '-',
        totalCost.toFixed(2),
        totalActive.toString(),
        totalActiveCost.toFixed(2),
        '-', // 投放占比总计行不计算
        totalYesterdayCost.toFixed(2),
        totalYesterdayActiveCost.toFixed(2),
        totalYesterdayNextRetention.toFixed(2) + '%',
        totalHistory7dCost.toFixed(2),
        (totalHistory7dActive > 0 ? totalHistory7dCost / totalHistory7dActive : 0).toFixed(2),
        (totalHistory7dActive > 0
          ? (totalHistory7dNextDayOpenCnt / totalHistory7dActive) * 100
          : 0
        ).toFixed(2) + '%',
        (totalHistory7dActive > 0
          ? (totalHistory7dRetention7dCnt / totalHistory7dActive) * 100
          : 0
        ).toFixed(2) + '%'
      ]
      if (hasKeywordGroupingForSheet) {
        totalRow.splice(1, 0, '') // 在标签组名称前插入空关键字
      }
      rows.push(totalRow)

      // 调用飞书 Sheet API
      const accountNames = validStats.map(
        ({ id }) => configs.find((c) => c.id === id)?.cookie_name || `账户${id}`
      )
      // 标题获取当前时间的整点，标题格式为2025/12/18/9:00/-时报
      // 如果查询日期小于今天，则使用日报格式
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const queryDateObj = new Date(query_date)
      const queryDateOnly = new Date(
        queryDateObj.getFullYear(),
        queryDateObj.getMonth(),
        queryDateObj.getDate()
      )

      let sheetTitle: string
      if (queryDateOnly < today) {
        // 查询日期小于今天，使用日报格式
        sheetTitle = `${query_date}-日报`
      } else {
        // 查询日期是今天或未来，使用时报格式
        const hour = now.getHours()
        sheetTitle = `${query_date}/${hour}:00/-时报`
      }

      addLog('正在创建飞书表格...', 'info')
      const response = await feishuService.createSheetWithDataPersonal({
        title: sheetTitle,
        headers,
        rows,
        color_type: 'gray'
      })

      addLog(`成功创建飞书表格: ${response.message}`, 'success')
      addLog(`数据行数: ${response.row_count}`, 'info')
      addLog(`访问链接: ${response.spreadsheet_url}`, 'info')

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
        <h1 className="text-3xl font-bold">数据助手</h1>
        <p className="mt-2 text-muted-foreground">根据标签组筛选并统计广告数据</p>
      </div>

      {/* 配置选择 */}
      <Card>
        <CardHeader>
          <CardTitle>选择引擎账户 *（可多选）</CardTitle>
          <CardDescription>选择要同时拉取数据的账户</CardDescription>
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
                  const isSelected = selectedConfigIds.includes(config.id)
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
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 ${
                              isSelected
                                ? 'border-primary bg-primary'
                                : 'border-muted-foreground/30'
                            }`}
                          >
                            {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
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
                    关键字分组（红果项目生效）
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

      {/* 标签组筛选 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>标签筛选组</CardTitle>
              <CardDescription>为每个账户配置标签组进行数据筛选</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => activeConfigId && clearAllTagGroups(activeConfigId)}
                size="sm"
                variant="outline"
                disabled={!activeConfigId || (tagGroupsMap[activeConfigId] || []).length === 0}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="mr-2 w-4 h-4" />
                清空标签组
              </Button>
              <Button
                onClick={() => addTagGroup()}
                size="sm"
                variant="outline"
                disabled={!activeConfigId}
              >
                <Plus className="mr-2 w-4 h-4" />
                手动添加组
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedConfigIds.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">请先选择引擎账户</div>
          ) : (
            <div className="space-y-4">
              {/* 账户标签页 */}
              <div className="flex overflow-x-auto gap-1 bg-muted/50 p-1 rounded-lg no-scrollbar">
                {selectedConfigIds.map((configId) => {
                  const config = configs.find((c) => c.id === configId)
                  const isActive = activeConfigId === configId
                  const isLoading = loadingTags[configId]
                  return (
                    <button
                      key={configId}
                      disabled={isLoading}
                      onClick={() => {
                        setActiveConfigId(configId)
                        setActiveGroupId(null)
                        setSearchTerm('')
                        setQuickSelectorSearchTerm1((prev) => ({ ...prev, [configId]: '' }))
                        setQuickSelectorSearchTerm2((prev) => ({ ...prev, [configId]: '' }))
                        setQuickSelectorSearchTerm3((prev) => ({ ...prev, [configId]: '' }))
                      }}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                        isActive
                          ? 'bg-background text-primary shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                      }`}
                    >
                      {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                      {config?.cookie_name || `账户${configId}`}
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                          isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {(tagGroupsMap[configId] || []).filter((g) => g.tags.length > 0).length}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* 快速组合标签选择器 */}
              {activeConfigId && (
                <Card className="border-dashed">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">快速组合标签</CardTitle>
                    <CardDescription className="text-xs">
                      选择三个标签组后，点击"生成标签组"自动组合
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* 选择投手 */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">选择投手</label>
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="搜索标签..."
                            value={quickSelectorSearchTerm1[activeConfigId] || ''}
                            onChange={(e) =>
                              setQuickSelectorSearchTerm1((prev) => ({
                                ...prev,
                                [activeConfigId]: e.target.value
                              }))
                            }
                            className="pl-8 h-9 text-sm"
                          />
                        </div>
                        <div className="border rounded-md p-2 max-h-[200px] overflow-y-auto space-y-1">
                          {availableTagsMap[activeConfigId]
                            ?.filter((tag) =>
                              tag.value
                                .toLowerCase()
                                .includes(
                                  (quickSelectorSearchTerm1[activeConfigId] || '').toLowerCase()
                                )
                            )
                            .map((tag) => {
                              const isSelected = (quickTagSelector1[activeConfigId] || []).some(
                                (t) => t.id === tag.id
                              )
                              return (
                                <label
                                  key={tag.id}
                                  className={`flex items-center space-x-2 cursor-pointer p-1.5 rounded hover:bg-accent transition-colors ${
                                    isSelected ? 'bg-accent/50' : ''
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleQuickSelectorTag(activeConfigId, 1, tag)}
                                    className="w-4 h-4"
                                  />
                                  <span className="text-xs truncate flex-1" title={tag.value}>
                                    {tag.value}
                                  </span>
                                </label>
                              )
                            })}
                          {(!availableTagsMap[activeConfigId] ||
                            availableTagsMap[activeConfigId].filter((tag) =>
                              tag.value
                                .toLowerCase()
                                .includes(
                                  (quickSelectorSearchTerm1[activeConfigId] || '').toLowerCase()
                                )
                            ).length === 0) && (
                            <div className="text-xs text-muted-foreground text-center py-2">
                              未找到标签
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          已选: {(quickTagSelector1[activeConfigId] || []).length}
                        </div>
                      </div>

                      {/* 选择投放类型 */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">选择投放类型</label>
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="搜索标签..."
                            value={quickSelectorSearchTerm2[activeConfigId] || ''}
                            onChange={(e) =>
                              setQuickSelectorSearchTerm2((prev) => ({
                                ...prev,
                                [activeConfigId]: e.target.value
                              }))
                            }
                            className="pl-8 h-9 text-sm"
                          />
                        </div>
                        <div className="border rounded-md p-2 max-h-[200px] overflow-y-auto space-y-1">
                          {availableTagsMap[activeConfigId]
                            ?.filter((tag) =>
                              tag.value
                                .toLowerCase()
                                .includes(
                                  (quickSelectorSearchTerm2[activeConfigId] || '').toLowerCase()
                                )
                            )
                            .map((tag) => {
                              const isSelected = (quickTagSelector2[activeConfigId] || []).some(
                                (t) => t.id === tag.id
                              )
                              return (
                                <label
                                  key={tag.id}
                                  className={`flex items-center space-x-2 cursor-pointer p-1.5 rounded hover:bg-accent transition-colors ${
                                    isSelected ? 'bg-accent/50' : ''
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleQuickSelectorTag(activeConfigId, 2, tag)}
                                    className="w-4 h-4"
                                  />
                                  <span className="text-xs truncate flex-1" title={tag.value}>
                                    {tag.value}
                                  </span>
                                </label>
                              )
                            })}
                          {(!availableTagsMap[activeConfigId] ||
                            availableTagsMap[activeConfigId].filter((tag) =>
                              tag.value
                                .toLowerCase()
                                .includes(
                                  (quickSelectorSearchTerm2[activeConfigId] || '').toLowerCase()
                                )
                            ).length === 0) && (
                            <div className="text-xs text-muted-foreground text-center py-2">
                              未找到标签
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          已选: {(quickTagSelector2[activeConfigId] || []).length}
                        </div>
                      </div>

                      {/* 选择出价类型 */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">选择出价类型</label>
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="搜索标签..."
                            value={quickSelectorSearchTerm3[activeConfigId] || ''}
                            onChange={(e) =>
                              setQuickSelectorSearchTerm3((prev) => ({
                                ...prev,
                                [activeConfigId]: e.target.value
                              }))
                            }
                            className="pl-8 h-9 text-sm"
                          />
                        </div>
                        <div className="border rounded-md p-2 max-h-[200px] overflow-y-auto space-y-1">
                          {availableTagsMap[activeConfigId]
                            ?.filter((tag) =>
                              tag.value
                                .toLowerCase()
                                .includes(
                                  (quickSelectorSearchTerm3[activeConfigId] || '').toLowerCase()
                                )
                            )
                            .map((tag) => {
                              const isSelected = (quickTagSelector3[activeConfigId] || []).some(
                                (t) => t.id === tag.id
                              )
                              return (
                                <label
                                  key={tag.id}
                                  className={`flex items-center space-x-2 cursor-pointer p-1.5 rounded hover:bg-accent transition-colors ${
                                    isSelected ? 'bg-accent/50' : ''
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleQuickSelectorTag(activeConfigId, 3, tag)}
                                    className="w-4 h-4"
                                  />
                                  <span className="text-xs truncate flex-1" title={tag.value}>
                                    {tag.value}
                                  </span>
                                </label>
                              )
                            })}
                          {(!availableTagsMap[activeConfigId] ||
                            availableTagsMap[activeConfigId].filter((tag) =>
                              tag.value
                                .toLowerCase()
                                .includes(
                                  (quickSelectorSearchTerm3[activeConfigId] || '').toLowerCase()
                                )
                            ).length === 0) && (
                            <div className="text-xs text-muted-foreground text-center py-2">
                              未找到标签
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          已选: {(quickTagSelector3[activeConfigId] || []).length}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end pt-2 border-t">
                      <Button
                        onClick={() => activeConfigId && generateQuickTagGroups(activeConfigId)}
                        disabled={
                          !activeConfigId || (quickTagSelector1[activeConfigId] || []).length === 0
                        }
                        size="sm"
                      >
                        <Plus className="mr-2 w-4 h-4" />
                        生成标签组
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 当前活动账户的标签组 */}
              {activeConfigId &&
                (loadingTags[activeConfigId] ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="ml-2">加载标签中...</span>
                  </div>
                ) : !availableTagsMap[activeConfigId] ||
                  availableTagsMap[activeConfigId].length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">该账户暂无可用标签</div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
                    {(tagGroupsMap[activeConfigId] || []).map((group, index) => (
                      <Card
                        key={group.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`flex flex-col border transition-all cursor-move ${
                          dragIndex === index ? 'opacity-50 scale-95' : ''
                        } ${
                          dragOverIndex === index && dragIndex !== index
                            ? 'ring-2 ring-primary ring-offset-2'
                            : ''
                        }`}
                      >
                        <CardHeader className="p-4 pb-2 space-y-0">
                          <div className="flex justify-between items-center">
                            <div className="flex flex-1 gap-2 items-center min-w-0">
                              <GripVertical className="flex-shrink-0 w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                              {editingGroupName === group.id ? (
                                <Input
                                  value={editingGroupNameValue}
                                  onChange={(e) => setEditingGroupNameValue(e.target.value)}
                                  onBlur={confirmEditingGroupName}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      confirmEditingGroupName()
                                    } else if (e.key === 'Escape') {
                                      cancelEditingGroupName()
                                    }
                                  }}
                                  className="flex-1 min-w-0 h-8 text-base font-medium"
                                  autoFocus
                                />
                              ) : (
                                <CardTitle
                                  className={`truncate transition-colors cursor-pointer hover:text-primary ${
                                    !group.name.trim()
                                      ? 'text-muted-foreground/60 italic text-sm font-normal'
                                      : 'text-base'
                                  }`}
                                  onClick={() => startEditingGroupName(group.id)}
                                  title={
                                    group.name.trim() ? '点击编辑标签组名称' : '点击输入标签组名称'
                                  }
                                >
                                  {group.name.trim() || '点击输入标签组名称...'}
                                </CardTitle>
                              )}
                            </div>
                            <Button
                              onClick={() => removeTagGroup(group.id)}
                              size="sm"
                              variant="ghost"
                              className="flex-shrink-0 p-0 w-8 h-8 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="flex flex-col flex-1 p-4 pt-2">
                          <div className="min-h-[60px] max-h-[120px] overflow-y-auto border rounded-md p-2 bg-background flex-1">
                            {group.tags.length === 0 ? (
                              <div className="flex justify-center items-center h-full text-xs text-muted-foreground">
                                未选择标签
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {group.tags.map((tag) => (
                                  <div
                                    key={tag.id}
                                    className="flex items-center gap-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors max-w-full"
                                  >
                                    <span className="truncate max-w-[100px]" title={tag.value}>
                                      {tag.value}
                                    </span>
                                    <button
                                      onClick={() => toggleTagInGroup(group.id, tag)}
                                      className="ml-0.5 text-muted-foreground hover:text-foreground shrink-0"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex justify-end mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-8 text-xs"
                              onClick={() => {
                                setActiveGroupId(group.id)
                                setSearchTerm('')
                              }}
                            >
                              <Edit className="w-3 h-3 mr-1.5" />
                              选择标签 ({group.tags.length})
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ))}

              {/* 附加标签选择 */}
              {activeConfigId && (
                <Card className="border-2 border-dashed border-primary/30">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base">附加统计标签</CardTitle>
                    <CardDescription className="text-xs">
                      选择用于附加统计的标签，这些标签将单独统计并显示在总计前面
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="min-h-[60px] max-h-[120px] overflow-y-auto border rounded-md p-2 bg-background">
                      {(additionalTagGroupsMap[activeConfigId] || []).length === 0 ? (
                        <div className="flex justify-center items-center h-full text-xs text-muted-foreground">
                          未选择附加标签
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {(additionalTagGroupsMap[activeConfigId] || []).map((tag) => (
                            <div
                              key={tag.id}
                              className="flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors max-w-full"
                            >
                              <span className="truncate max-w-[100px]" title={tag.value}>
                                {tag.value}
                              </span>
                              <button
                                onClick={() => {
                                  setAdditionalTagGroupsMap((prev) => ({
                                    ...prev,
                                    [activeConfigId]: (prev[activeConfigId] || []).filter(
                                      (t) => t.id !== tag.id
                                    )
                                  }))
                                }}
                                className="ml-0.5 text-muted-foreground hover:text-foreground shrink-0"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={() => {
                          setActiveGroupId('additional_tags')
                          setSearchTerm('')
                        }}
                      >
                        <Edit className="w-3 h-3 mr-1.5" />
                        选择附加标签 ({(additionalTagGroupsMap[activeConfigId] || []).length})
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
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
          {selectedConfigIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              已选中 <span className="font-semibold text-primary">{selectedConfigIds.length}</span>{' '}
              个账户
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

          <Button
            onClick={saveAllConfigs}
            disabled={isSavingConfig || selectedConfigIds.length === 0}
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
          </Button>

          <Button
            onClick={handleFetchData}
            disabled={loading || selectedConfigIds.length === 0}
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
                {selectedConfigIds
                  .filter((configId) => statisticsDataMap[configId]?.data)
                  .map((configId) => {
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
                  })}
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
                    const validStats = selectedConfigIds
                      .map((id) => ({ id, data: statisticsDataMap[id] }))
                      .filter((item) => item.data?.data)
                    if (validStats.length === 0) return '暂无数据'
                    const query_date = validStats[0].data!.data!.query_date
                    return `查询日期: ${query_date} | 账户数量: ${validStats.length}`
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
                          发送汇总到飞书表格
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
              const validStats = selectedConfigIds
                .map((id) => ({ id, data: statisticsDataMap[id] }))
                .filter((item) => item.data?.data)

              if (validStats.length === 0) {
                return <div className="py-8 text-center text-muted-foreground">暂无数据</div>
              }

              let totalCost = 0
              let totalActiveCost = 0
              let totalActive = 0
              let totalYesterdayCost = 0
              let totalYesterdayActive = 0
              let totalYesterdayRetentionCount = 0 // 昨日次留数 = 昨日次留率 * 昨日激活数
              let totalHistory7dCost = 0
              let totalHistory7dActive = 0
              let totalHistory7dNextDayOpenCnt = 0
              let totalHistory7dRetention7dCnt = 0

              validStats.forEach(({ data }) => {
                const { total_data } = data!.data!
                totalCost += total_data.total_cost
                // totalActiveCost += total_data.active_cost
                totalActive += total_data.total_active || 0
                totalYesterdayCost += total_data.yesterday_cost || 0
                totalYesterdayActive += total_data.yesterday_active || 0
                // 累加昨日次留数 = 昨日次留率(%) * 昨日激活数 / 100
                const yesterdayRetention = (total_data.yesterday_next_day_retention || 0) / 100
                const yesterdayActive = total_data.yesterday_active || 0
                totalYesterdayRetentionCount += yesterdayRetention * yesterdayActive
                totalHistory7dCost += total_data.history_7d_cost || 0
                totalHistory7dActive += total_data.history_7d_active || 0
                totalHistory7dNextDayOpenCnt +=
                  total_data.history_7d_attribution_next_day_open_cnt || 0
                totalHistory7dRetention7dCnt +=
                  total_data.history_7d_attribution_retention_7d_cnt || 0
              })
              if (totalActive > 0) {
                totalActiveCost = totalCost / totalActive
              }
              // 计算总计的昨日激活成本 = 昨日总消耗 / 昨日总激活数
              const totalYesterdayActiveCost =
                totalYesterdayActive > 0 ? totalYesterdayCost / totalYesterdayActive : 0

              // 计算总计的昨日次留率 = 昨日总次留数 / 昨日总激活数 * 100
              const totalYesterdayNextRetention =
                totalYesterdayActive > 0
                  ? (totalYesterdayRetentionCount / totalYesterdayActive) * 100
                  : 0

              // 检查是否启用了关键字分组
              const hasKeywordGrouping = validStats.some(({ data }) =>
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
                    history7dActive: number
                    history7dNextDayOpenCnt: number
                    history7dRetention7dCnt: number
                    count: number
                  }
                >
              > = {}

              validStats.forEach(({ id, data }) => {
                const config = configs.find((c) => c.id === id)
                const configName = config?.cookie_name || `账户${id}`
                const { group_results } = data!.data!

                group_results.forEach((group) => {
                  let originalGroupName: string
                  let keyword: string | undefined

                  if (group.keyword) {
                    // 如果有关键字字段，从group_name中提取原始标签组名
                    const match = group.group_name.match(/^(.+?) - (.+)$/)
                    if (match) {
                      originalGroupName = match[1]
                      keyword = group.keyword
                    } else {
                      originalGroupName = group.group_name
                      keyword = group.keyword
                    }
                  } else if (group.group_name.includes(' - ')) {
                    // 从group_name中解析
                    const parts = group.group_name.split(' - ')
                    originalGroupName = parts[0]
                    keyword = parts[1]
                  } else {
                    originalGroupName = group.group_name
                    keyword = undefined
                  }

                  // 如果没有关键字分组，使用默认关键字
                  const keywordKey = keyword || '__no_keyword__'
                  const groupNameKey = originalGroupName

                  if (!keywordGroupAggregation[keywordKey]) {
                    keywordGroupAggregation[keywordKey] = {}
                  }

                  if (!keywordGroupAggregation[keywordKey][groupNameKey]) {
                    keywordGroupAggregation[keywordKey][groupNameKey] = {
                      accounts: [],
                      tagList: group.tags.map((t) => t.value).join(', '),
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

                  // 累加昨日次留数 = 昨日次留率(%) * 昨日激活数 / 100
                  const yesterdayRetention =
                    (group.filter_data.yesterday_next_day_retention || 0) / 100
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

              // 转换为数组,按关键字和标签组名称排序,并添加rowspan信息
              const tagGroupAggregationArray: Array<{
                keyword?: string
                keywordRowspan: number
                key: string
                keyPart1: string
                keyPart2: string
                keyPart3: string
                keyPart1Rowspan: number
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
                allocationRatio: number
              }> = []

              // 按关键字排序
              const sortedKeywords = Object.keys(keywordGroupAggregation).sort()

              sortedKeywords.forEach((keyword) => {
                const groups = keywordGroupAggregation[keyword]
                const groupEntries = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))

                // 先处理所有条目，分割标签组名称
                const processedEntries = groupEntries.map(([groupNameKey, value]) => {
                  const parts = groupNameKey.split('-')
                  return {
                    groupNameKey,
                    keyPart1: parts[0]?.trim() || groupNameKey,
                    keyPart2: parts[1]?.trim() || '',
                    keyPart3: parts[2]?.trim() || '',
                    value
                  }
                })

                // 计算keyPart1的rowspan
                const keyPart1Groups = new Map<string, number>()
                processedEntries.forEach((entry) => {
                  keyPart1Groups.set(entry.keyPart1, (keyPart1Groups.get(entry.keyPart1) || 0) + 1)
                })

                // 按投手分组，计算每个投手组的总消耗行激活数（作为分母）
                const keyPart1Denominators = new Map<string, number>()
                processedEntries.forEach((entry) => {
                  // 如果出价方式包含"总消耗"，则将其激活数作为该投手的分母
                  if (entry.keyPart2 == '') {
                    keyPart1Denominators.set(entry.keyPart1, entry.value.totalActive)
                  }
                })

                // 记录每个keyPart1是否已经输出过
                const keyPart1Used = new Map<string, boolean>()

                processedEntries.forEach((entry, index) => {
                  const keyPart1Rowspan = keyPart1Used.has(entry.keyPart1)
                    ? 0
                    : keyPart1Groups.get(entry.keyPart1) || 1
                  if (!keyPart1Used.has(entry.keyPart1)) {
                    keyPart1Used.set(entry.keyPart1, true)
                  }

                  // 计算投放占比：如果值为空，占比为100%，否则用该行激活数除以分母
                  const denominator = keyPart1Denominators.get(entry.keyPart1) || 0
                  const allocationRatio =
                    entry.keyPart2 === ''
                      ? 100
                      : denominator > 0
                        ? (entry.value.totalActive / denominator) * 100
                        : 0

                  // 计算历史七日成本和留存率（使用累加后的数值）
                  const history7dActiveCost =
                    entry.value.history7dActive > 0
                      ? entry.value.history7dCost / entry.value.history7dActive
                      : 0
                  const history7dNextDayRetention =
                    entry.value.history7dActive > 0
                      ? (entry.value.history7dNextDayOpenCnt / entry.value.history7dActive) * 100
                      : 0
                  const history7d7dRetention =
                    entry.value.history7dActive > 0
                      ? (entry.value.history7dRetention7dCnt / entry.value.history7dActive) * 100
                      : 0

                  tagGroupAggregationArray.push({
                    keyword: keyword === '__no_keyword__' ? undefined : keyword,
                    keywordRowspan: index === 0 ? groupEntries.length : 0,
                    key: entry.groupNameKey,
                    keyPart1: entry.keyPart1,
                    keyPart2: entry.keyPart2,
                    keyPart3: entry.keyPart3,
                    keyPart1Rowspan,
                    ...entry.value,
                    activeCost:
                      entry.value.totalActive > 0
                        ? entry.value.totalCost / entry.value.totalActive
                        : 0,
                    yesterdayActiveCost:
                      entry.value.yesterdayActive > 0
                        ? entry.value.yesterdayCost / entry.value.yesterdayActive
                        : 0,
                    yesterdayNextRetention:
                      entry.value.yesterdayActive > 0
                        ? (entry.value.yesterdayRetentionCount / entry.value.yesterdayActive) * 100
                        : 0,
                    history7dActiveCost,
                    history7dNextDayRetention,
                    history7d7dRetention,
                    allocationRatio
                  })
                })
              })

              return (
                <div className="overflow-x-auto space-y-3">
                  {/* 标签组汇总 */}
                  {validStats.length > 1 && tagGroupAggregationArray.length > 0 && (
                    <div id="tag-group-summary" className="rounded-lg border">
                      <div className="p-3 bg-purple-10 border-b dark:bg-purple-950/10">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold">汇总数据 </h4>
                          {/* <Button
                            onClick={generateTagGroupImage}
                            variant="outline"
                            size="sm"
                            disabled={isGeneratingImage}
                            className="text-xs"
                          >
                            {isGeneratingImage ? (
                              <>
                                <Loader2 className="mr-2 w-3 h-3 animate-spin" />
                                生成中...
                              </>
                            ) : (
                              <>
                                <Camera className="mr-2 w-3 h-3" />
                                生成图片
                              </>
                            )}
                          </Button> */}
                        </div>
                      </div>
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-muted">
                            {hasKeywordGrouping && <th className="p-2 text-left border">关键字</th>}
                            <th className="p-2 text-left border">投手</th>
                            <th className="p-2 text-left border">投放类型</th>
                            <th className="p-2 text-left border">出价类型</th>
                            {/* <th className="p-2 text-left border">标签列表</th> */}

                            <th className="p-2 text-right border">消耗</th>
                            <th className="p-2 text-right border">激活数</th>
                            <th className="p-2 text-right border">当日激活成本</th>
                            <th className="p-2 text-right border">投放占比</th>
                            <th className="p-2 text-right border">昨日消耗</th>
                            <th className="p-2 text-right border">昨日激活成本</th>
                            <th className="p-2 text-right border">昨日次留率</th>
                            <th className="p-2 text-right border">历史七日消耗</th>
                            <th className="p-2 text-right border">历史七日成本</th>
                            <th className="p-2 text-right border">历史七日次留率</th>
                            <th className="p-2 text-right border">历史七日7留率</th>
                            {/* <th className="p-2 text-left border">涉及账户及标签组</th> */}
                          </tr>
                        </thead>
                        <tbody>
                          {tagGroupAggregationArray.map((agg, idx) => (
                            <tr key={idx} className="hover:bg-muted/50">
                              {hasKeywordGrouping &&
                                (agg.keywordRowspan > 0 ? (
                                  <td className="p-2 border" rowSpan={agg.keywordRowspan}>
                                    <div className="font-medium text-blue-600">{agg.keyword}</div>
                                  </td>
                                ) : null)}
                              {agg.keyPart1Rowspan > 0 ? (
                                <td className="p-2 border" rowSpan={agg.keyPart1Rowspan}>
                                  <div className="font-medium">{agg.keyPart1}</div>
                                </td>
                              ) : null}
                              <td className="p-2 border">
                                <div className="font-medium">{agg.keyPart2 || '总消耗'}</div>
                              </td>
                              <td className="p-2 border">
                                <div className="font-medium">{agg.keyPart3 || ''}</div>
                              </td>
                              {/* <td className="p-2 border">
                                <div className="text-xs text-muted-foreground">
                                  {agg.tagList}
                                </div>
                              </td> */}

                              <td className="p-2 text-right border">{agg.totalCost.toFixed(2)}</td>
                              <td className="p-2 text-right text-orange-600 border">
                                {agg.totalActive}
                              </td>
                              <td className="p-2 text-right text-blue-600 border">
                                {agg.activeCost.toFixed(2)}
                              </td>
                              <td className="p-2 text-right text-green-600 border">
                                {agg.allocationRatio.toFixed(2)}%
                              </td>
                              <td className="p-2 text-right text-amber-600 border">
                                {agg.yesterdayCost.toFixed(2)}
                              </td>
                              <td className="p-2 text-right text-amber-600 border">
                                {agg.yesterdayActiveCost.toFixed(2)}
                              </td>
                              <td className="p-2 text-right text-amber-600 border">
                                {agg.yesterdayNextRetention.toFixed(2)}%
                              </td>
                              <td className="p-2 text-right text-indigo-600 border">
                                {agg.history7dCost.toFixed(2)}
                              </td>
                              <td className="p-2 text-right text-indigo-600 border">
                                {(agg.history7dActiveCost || 0).toFixed(2)}
                              </td>
                              <td className="p-2 text-right text-indigo-600 border">
                                {(agg.history7dNextDayRetention || 0).toFixed(2)}%
                              </td>
                              <td className="p-2 text-right text-indigo-600 border">
                                {(agg.history7d7dRetention || 0).toFixed(2)}%
                              </td>
                              {/* <td className="p-2 border">
                                <div className="text-xs">
                                  {agg.accounts.join(', ')}
                                  <span className="ml-1 text-muted-foreground">({agg.accounts.length})</span>
                                  （{agg.tagList}）
                                </div>
                              </td> */}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {/* 附加统计结果 */}
                  {validStats.length > 1 &&
                    (() => {
                      // 收集所有账户的附加统计结果
                      const additionalResultsMap: Record<
                        string,
                        {
                          tagValue: string
                          totalCost: number
                          totalActive: number
                          yesterdayCost: number
                          yesterdayActive: number
                          yesterdayNextDayRetention: number
                          history7dCost: number
                          history7dActive: number
                          history7dNextDayOpenCnt: number
                          history7dRetention7dCnt: number
                          history7dActiveCost: number
                          history7dNextDayRetention: number
                          history7dRetention7d: number
                          count: number
                        }
                      > = {}

                      validStats.forEach(({ data }) => {
                        const additionalResults = data?.data?.additional_results || []
                        additionalResults.forEach((result) => {
                          const tagValue = result.group_name || result.tags[0]?.value || ''
                          if (!additionalResultsMap[tagValue]) {
                            additionalResultsMap[tagValue] = {
                              tagValue,
                              totalCost: 0,
                              totalActive: 0,
                              yesterdayCost: 0,
                              yesterdayActive: 0,
                              yesterdayNextDayRetention: 0,
                              history7dCost: 0,
                              history7dActive: 0,
                              history7dNextDayOpenCnt: 0,
                              history7dRetention7dCnt: 0,
                              history7dActiveCost: 0,
                              history7dNextDayRetention: 0,
                              history7dRetention7d: 0,
                              count: 0
                            }
                          }
                          const agg = additionalResultsMap[tagValue]
                          agg.totalCost += result.filter_data.total_cost || 0
                          agg.totalActive += result.filter_data.total_active || 0
                          agg.yesterdayCost += result.filter_data.yesterday_cost || 0
                          agg.yesterdayActive += result.filter_data.yesterday_active || 0
                          agg.yesterdayNextDayRetention +=
                            ((result.filter_data.yesterday_next_day_retention || 0) *
                              (result.filter_data.yesterday_active || 0)) /
                            100
                          agg.history7dCost += result.filter_data.history_7d_cost || 0
                          agg.history7dActive += result.filter_data.history_7d_active || 0
                          agg.history7dNextDayOpenCnt +=
                            result.filter_data.history_7d_attribution_next_day_open_cnt || 0
                          agg.history7dRetention7dCnt +=
                            result.filter_data.history_7d_attribution_retention_7d_cnt || 0
                          agg.count++
                        })
                      })

                      // 计算历史七日成本和留存率
                      Object.values(additionalResultsMap).forEach((agg) => {
                        if (agg.history7dActive > 0) {
                          agg.history7dActiveCost = agg.history7dCost / agg.history7dActive
                          agg.history7dNextDayRetention =
                            (agg.history7dNextDayOpenCnt / agg.history7dActive) * 100
                          agg.history7dRetention7d =
                            (agg.history7dRetention7dCnt / agg.history7dActive) * 100
                        }
                      })

                      const additionalResultsArray = Object.values(additionalResultsMap)

                      if (additionalResultsArray.length === 0) {
                        return null
                      }

                      return (
                        <div className="rounded-lg border mb-4">
                          <div className="p-3 border-b bg-primary/10">
                            <h4 className="font-bold">附加统计（{validStats.length}个账户）</h4>
                          </div>
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-muted">
                                <th className="p-2 text-left border">标签</th>
                                <th className="p-2 text-right border">总消耗</th>
                                <th className="p-2 text-right border">总激活数</th>
                                <th className="p-2 text-right border">当日激活成本</th>
                                <th className="p-2 text-right border">昨日消耗</th>
                                <th className="p-2 text-right border">昨日激活成本</th>
                                <th className="p-2 text-right border">昨日次留率</th>
                                <th className="p-2 text-right border">历史七日消耗</th>
                                <th className="p-2 text-right border">历史七日成本</th>
                                <th className="p-2 text-right border">历史七日次留率</th>
                                <th className="p-2 text-right border">历史七日7留率</th>
                              </tr>
                            </thead>
                            <tbody>
                              {additionalResultsArray.map((agg, idx) => {
                                const activeCost =
                                  agg.totalActive > 0 ? agg.totalCost / agg.totalActive : 0
                                const yesterdayActiveCost =
                                  agg.yesterdayActive > 0
                                    ? agg.yesterdayCost / agg.yesterdayActive
                                    : 0
                                const yesterdayNextRetention =
                                  agg.yesterdayActive > 0
                                    ? (agg.yesterdayNextDayRetention / agg.yesterdayActive) * 100
                                    : 0
                                const history7dActiveCost =
                                  agg.history7dActive > 0
                                    ? agg.history7dCost / agg.history7dActive
                                    : 0
                                const history7dNextDayRetention =
                                  agg.history7dActive > 0
                                    ? (agg.history7dNextDayOpenCnt / agg.history7dActive) * 100
                                    : 0
                                const history7d7dRetention =
                                  agg.history7dActive > 0
                                    ? (agg.history7dRetention7dCnt / agg.history7dActive) * 100
                                    : 0
                                return (
                                  <tr key={idx}>
                                    <td className="p-2 border font-medium">{agg.tagValue}</td>
                                    <td className="p-2 text-right border">
                                      {agg.totalCost.toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right text-orange-600 border">
                                      {agg.totalActive}
                                    </td>
                                    <td className="p-2 text-right text-blue-600 border">
                                      {activeCost.toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right text-amber-600 border">
                                      {agg.yesterdayCost.toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right text-amber-600 border">
                                      {yesterdayActiveCost.toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right text-amber-600 border">
                                      {yesterdayNextRetention.toFixed(2)}%
                                    </td>
                                    <td className="p-2 text-right text-indigo-600 border">
                                      {agg.history7dCost.toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right text-indigo-600 border">
                                      {history7dActiveCost.toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right text-indigo-600 border">
                                      {history7dNextDayRetention.toFixed(2)}%
                                    </td>
                                    <td className="p-2 text-right text-indigo-600 border">
                                      {history7d7dRetention.toFixed(2)}%
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}
                  {/* 总计行 */}
                  {validStats.length > 1 && (
                    <div className="rounded-lg border">
                      <div className="p-3 border-b bg-primary/10">
                        <h4 className="font-bold">总计（{validStats.length}个账户）</h4>
                      </div>
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-muted">
                            <th className="p-2 text-left border">项目</th>
                            <th className="p-2 text-right border">总消耗</th>
                            <th className="p-2 text-right border">总激活数</th>
                            <th className="p-2 text-right border">当日激活成本</th>
                            <th className="p-2 text-right border">昨日消耗</th>
                            <th className="p-2 text-right border">昨日激活成本</th>
                            <th className="p-2 text-right border">昨日次留率</th>
                            <th className="p-2 text-right border">历史七日消耗</th>
                            <th className="p-2 text-right border">历史七日成本</th>
                            <th className="p-2 text-right border">历史七日次留率</th>
                            <th className="p-2 text-right border">历史七日7留率</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="font-bold">
                            <td className="p-2 border">所有账户合计</td>
                            <td className="p-2 text-right border">{totalCost.toFixed(2)}</td>
                            <td className="p-2 text-right text-orange-600 border">{totalActive}</td>
                            <td className="p-2 text-right text-blue-600 border">
                              {totalActiveCost.toFixed(2)}
                            </td>
                            <td className="p-2 text-right text-amber-600 border">
                              {totalYesterdayCost.toFixed(2)}
                            </td>
                            <td className="p-2 text-right text-amber-600 border">
                              {totalYesterdayActiveCost.toFixed(2)}
                            </td>
                            <td className="p-2 text-right text-amber-600 border">
                              {totalYesterdayNextRetention.toFixed(2)}%
                            </td>
                            <td className="p-2 text-right text-indigo-600 border">
                              {totalHistory7dCost.toFixed(2)}
                            </td>
                            <td className="p-2 text-right text-indigo-600 border">
                              {(totalHistory7dActive > 0
                                ? totalHistory7dCost / totalHistory7dActive
                                : 0
                              ).toFixed(2)}
                            </td>
                            <td className="p-2 text-right text-indigo-600 border">
                              {(totalHistory7dActive > 0
                                ? (totalHistory7dNextDayOpenCnt / totalHistory7dActive) * 100
                                : 0
                              ).toFixed(2)}
                              %
                            </td>
                            <td className="p-2 text-right text-indigo-600 border">
                              {(totalHistory7dActive > 0
                                ? (totalHistory7dRetention7dCnt / totalHistory7dActive) * 100
                                : 0
                              ).toFixed(2)}
                              %
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 分账户统计 - 账户明细 */}
                  <div className="rounded-lg border">
                    <button
                      onClick={() => setIsAccountDetailsCollapsed(!isAccountDetailsCollapsed)}
                      className="flex justify-between items-center p-3 w-full border-b transition-colors bg-muted/50 hover:bg-muted"
                    >
                      <h4 className="font-bold">账户明细</h4>
                      {isAccountDetailsCollapsed ? (
                        <ChevronRight className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                    {!isAccountDetailsCollapsed && (
                      <div className="p-4 space-y-4">
                        {validStats.map(({ id, data }) => {
                          const config = configs.find((c) => c.id === id)
                          const { total_data, group_results } = data!.data!

                          // 处理关键字分组：按关键字分组，每个关键字下显示所有标签组
                          const processGroupResults = (results: typeof group_results) => {
                            // 检查是否启用了关键字分组（通过检查是否有keyword字段或group_name包含" - "）
                            const hasKeywordGrouping = results.some(
                              (g) => g.keyword || g.group_name.includes(' - ')
                            )

                            if (!hasKeywordGrouping) {
                              // 没有关键字分组，直接返回
                              return results.map((group) => ({
                                ...group,
                                originalGroupName: group.group_name,
                                keywordRowspan: 1,
                                keyword: undefined
                              }))
                            }

                            // 有关键字分组，先按关键字分组
                            const keywordGroupMap = new Map<string, typeof group_results>()

                            results.forEach((group) => {
                              let originalGroupName: string
                              let keyword: string | undefined

                              if (group.keyword) {
                                // 如果有关键字字段，从group_name中提取原始标签组名
                                // group_name格式: "标签组名 - 关键字"
                                const match = group.group_name.match(/^(.+?) - (.+)$/)
                                if (match) {
                                  originalGroupName = match[1]
                                  keyword = group.keyword
                                } else {
                                  originalGroupName = group.group_name
                                  keyword = group.keyword
                                }
                              } else if (group.group_name.includes(' - ')) {
                                // 从group_name中解析
                                const parts = group.group_name.split(' - ')
                                originalGroupName = parts[0]
                                keyword = parts[1]
                              } else {
                                originalGroupName = group.group_name
                                keyword = undefined
                              }

                              if (keyword) {
                                if (!keywordGroupMap.has(keyword)) {
                                  keywordGroupMap.set(keyword, [])
                                }
                                keywordGroupMap.get(keyword)!.push({
                                  ...group,
                                  originalGroupName,
                                  keyword
                                })
                              }
                            })

                            // 转换为数组，按关键字排序，并添加rowspan信息
                            const processed: Array<
                              (typeof group_results)[0] & {
                                originalGroupName: string
                                keyword?: string
                                keywordRowspan: number
                              }
                            > = []

                            // 按关键字排序
                            const sortedKeywords = Array.from(keywordGroupMap.keys()).sort()

                            sortedKeywords.forEach((keyword) => {
                              const groups = keywordGroupMap.get(keyword)!
                              groups.forEach((group, index) => {
                                processed.push({
                                  ...group,
                                  originalGroupName: group.originalGroupName || group.group_name,
                                  keyword: group.keyword || keyword,
                                  keywordRowspan: index === 0 ? groups.length : 0 // 第一行设置rowspan，其他行设为0（不渲染该单元格）
                                })
                              })
                            })

                            return processed
                          }

                          const processedGroups = processGroupResults(group_results)
                          const hasKeywordGrouping = processedGroups.some((g) => g.keyword)

                          return (
                            <div key={id} className="rounded-lg border">
                              <div className="p-3 border-b bg-muted/50">
                                <h4 className="font-medium">
                                  {config?.cookie_name || `账户${id}`}
                                  {data?.recordTime && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      (快照时间：{new Date(data.recordTime).toLocaleString('zh-CN')}
                                      )
                                    </span>
                                  )}
                                </h4>
                              </div>
                              <table className="w-full text-sm border-collapse">
                                <thead>
                                  <tr className="bg-muted">
                                    {hasKeywordGrouping && (
                                      <th className="p-2 text-left border">关键字</th>
                                    )}
                                    <th className="p-2 text-left border">标签组</th>
                                    <th className="p-2 text-right border">总消耗</th>
                                    <th className="p-2 text-right border">激活数</th>
                                    <th className="p-2 text-right border">激活成本</th>
                                    <th className="p-2 text-right border">昨日消耗</th>
                                    <th className="p-2 text-right border">昨日激活成本</th>
                                    <th className="p-2 text-right border">昨日次留率</th>
                                    {/* <th className="p-2 text-right border">次留率</th>
                                  <th className="p-2 text-right border">七留率</th> */}
                                    <th className="p-2 text-right border">历史七日消耗</th>
                                    <th className="p-2 text-right border">历史七日成本</th>
                                    <th className="p-2 text-right border">历史七日次留率</th>
                                    <th className="p-2 text-right border">历史七日7留率</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {processedGroups.map((group, idx) => (
                                    <tr key={idx}>
                                      {hasKeywordGrouping &&
                                        (group.keywordRowspan > 0 ? (
                                          <td className="p-2 border" rowSpan={group.keywordRowspan}>
                                            <div className="font-medium text-blue-600">
                                              {group.keyword}
                                            </div>
                                          </td>
                                        ) : null)}
                                      <td className="p-2 border">
                                        <div className="font-medium">{group.originalGroupName}</div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          {group.tags.map((t) => t.value).join(', ')}
                                        </div>
                                      </td>
                                      <td className="p-2 text-right border">
                                        {group.filter_data.total_cost.toFixed(2)}
                                      </td>
                                      <td className="p-2 text-right text-orange-600 border">
                                        {group.filter_data.total_active || 0}
                                      </td>
                                      <td className="p-2 text-right text-blue-600 border">
                                        {group.filter_data.active_cost.toFixed(2)}
                                      </td>
                                      <td className="p-2 text-right text-amber-600 border">
                                        {(group.filter_data.yesterday_cost || 0).toFixed(2)}
                                      </td>
                                      <td className="p-2 text-right text-amber-600 border">
                                        {(group.filter_data.yesterday_active_cost || 0).toFixed(2)}
                                      </td>
                                      <td className="p-2 text-right text-amber-600 border">
                                        {(
                                          group.filter_data.yesterday_next_day_retention || 0
                                        ).toFixed(2)}
                                        %
                                      </td>
                                      <td className="p-2 text-right text-indigo-600 border">
                                        {(group.filter_data.history_7d_cost || 0).toFixed(2)}
                                      </td>
                                      <td className="p-2 text-right text-indigo-600 border">
                                        {(group.filter_data.history_7d_active_cost || 0).toFixed(2)}
                                      </td>
                                      <td className="p-2 text-right text-indigo-600 border">
                                        {(
                                          group.filter_data.history_7d_next_day_retention || 0
                                        ).toFixed(2)}
                                        %
                                      </td>
                                      <td className="p-2 text-right text-indigo-600 border">
                                        {(group.filter_data.history_7d_retention_7d || 0).toFixed(
                                          2
                                        )}
                                        %
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="font-bold ">
                                    <td className="p-2 border">小计</td>
                                    <td className="p-2 text-right border">
                                      {total_data.total_cost.toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right text-blue-600 border">
                                      {total_data.active_cost.toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right text-orange-600 border">
                                      {total_data.total_active || 0}
                                    </td>
                                    <td className="p-2 text-right text-amber-600 border">
                                      {(total_data.yesterday_cost || 0).toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right text-amber-600 border">
                                      {(total_data.yesterday_active_cost || 0).toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right text-amber-600 border">
                                      {(total_data.yesterday_next_day_retention || 0).toFixed(2)}%
                                    </td>
                                    <td className="p-2 text-right text-indigo-600 border">
                                      {(total_data.history_7d_cost || 0).toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right text-indigo-600 border">
                                      {(total_data.history_7d_active_cost || 0).toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right text-indigo-600 border">
                                      {(total_data.history_7d_next_day_retention || 0).toFixed(2)}%
                                    </td>
                                    <td className="p-2 text-right text-indigo-600 border">
                                      {(total_data.history_7d_retention_7d || 0).toFixed(2)}%
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
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
