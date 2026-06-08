import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Loader2,
  X,
  Calendar,
  FileText,
  XCircle,
  BarChart3,
  Download,
  Send,
  Plus,
  Trash2,
  Edit2,
  Check,
  X as XIcon,
  Camera
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
import { configService } from '../../services/config.service'
import {
  organizationListService,
  dataAssistantService,
  type OrganizationItem,
  type AccountData
} from '../../services/tencent-ads.service'
import { feishuService } from '../../services/feishu.service'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'sonner'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

export const TencentAdsDataAssistantPage: React.FC = () => {
  const { user } = useAuth()
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingOrganizations, setLoadingOrganizations] = useState(false)
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([])

  // 组织分组管理
  interface OrganizationGroup {
    id: string
    name: string
    businessIds: number[]
  }
  const [organizationGroups, setOrganizationGroups] = useState<OrganizationGroup[]>([])
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState<string>('')
  // 每个分组的独立搜索关键字
  const [groupSearchKeywords, setGroupSearchKeywords] = useState<Record<string, string>>({})
  const [queryDate, setQueryDate] = useState<string>('')
  const [dateError, setDateError] = useState('')
  const [useTagGrouping, setUseTagGrouping] = useState(true)
  const [tagText, setTagText] = useState('纯短剧\n纯激励')
  const [useOperatorDimension, setUseOperatorDimension] = useState(false) // 投手维度开关
  // 投手分组管理
  interface OperatorGroup {
    id: string
    name: string
    tags: string[] // 标签列表，每行一个
  }
  const [operatorGroups, setOperatorGroups] = useState<OperatorGroup[]>([])
  const [editingOperatorGroupId, setEditingOperatorGroupId] = useState<string | null>(null)
  const [editingOperatorGroupName, setEditingOperatorGroupName] = useState<string>('')
  const [editingOperatorGroupTags, setEditingOperatorGroupTags] = useState<string>('')
  const [error, setError] = useState('')
  const [loadingData, setLoadingData] = useState(false)
  const [statisticsData, setStatisticsData] = useState<Record<string, AccountData[]>>({})
  const [totalSummaryData, setTotalSummaryData] = useState<Record<string, AccountData[]>>({})
  // 投手维度下的组织化数据：{ groupName: { operatorName: { tagKey: AccountData[] } } }
  const [organizedData, setOrganizedData] = useState<
    Record<string, Record<string, Record<string, AccountData[]>>>
  >({})
  // 投手维度下的汇总数据：{ groupName: { operatorName: AccountData[] } }
  const [operatorSummaryData, setOperatorSummaryData] = useState<
    Record<string, Record<string, AccountData[]>>
  >({})
  // 标签分组数据（独立于投手数据）
  const [tagGroupData, setTagGroupData] = useState<AccountData[]>([])
  const [isStatisticsDialogOpen, setIsStatisticsDialogOpen] = useState(false)
  const [isSendingToFeishu, setIsSendingToFeishu] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  // 原始 API 返回数据，用于生成图片
  const [rawStatisticsData, setRawStatisticsData] = useState<Record<string, unknown> | null>(null)

  // 获取缓存key
  const getCacheKey = (configId: number | null): string | null => {
    if (!configId || !user?.id) return null
    return `tencent_ads_org_groups_${user.id}_${configId}`
  }

  // 获取投手分组缓存key
  const getOperatorGroupsCacheKey = (configId: number | null): string | null => {
    if (!configId || !user?.id) return null
    return `tencent_ads_operator_groups_${user.id}_${configId}`
  }

  // 从缓存加载投手分组数据
  const loadOperatorGroupsFromCache = (configId: number | null): void => {
    const cacheKey = getOperatorGroupsCacheKey(configId)
    if (!cacheKey) return

    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached) as OperatorGroup[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOperatorGroups(parsed)
        }
      }
    } catch (err) {
      console.error('Failed to load operator groups from cache:', err)
    }
  }

  // 保存投手分组数据到缓存
  const saveOperatorGroupsToCache = (configId: number | null, groups: OperatorGroup[]): void => {
    const cacheKey = getOperatorGroupsCacheKey(configId)
    if (!cacheKey) return

    try {
      if (groups.length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify(groups))
      } else {
        localStorage.removeItem(cacheKey)
      }
    } catch (err) {
      console.error('Failed to save operator groups to cache:', err)
    }
  }

  // 从缓存加载分组数据
  const loadGroupsFromCache = (configId: number | null): void => {
    const cacheKey = getCacheKey(configId)
    if (!cacheKey) return

    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached) as OrganizationGroup[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrganizationGroups(parsed)
        }
      }
    } catch (err) {
      console.error('Failed to load groups from cache:', err)
    }
  }

  // 保存分组数据到缓存
  const saveGroupsToCache = (configId: number | null, groups: OrganizationGroup[]): void => {
    const cacheKey = getCacheKey(configId)
    if (!cacheKey) return

    try {
      if (groups.length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify(groups))
      } else {
        localStorage.removeItem(cacheKey)
      }
    } catch (err) {
      console.error('Failed to save groups to cache:', err)
    }
  }

  useEffect(() => {
    loadConfigs()
    // 设置默认日期为今天
    const today = new Date().toISOString().split('T')[0]
    setQueryDate(today)
  }, [])

  // 当配置切换时，从缓存加载分组并重新加载组织列表
  useEffect(() => {
    if (selectedConfigId && configs.length > 0 && user?.id) {
      // 从缓存加载分组数据
      loadGroupsFromCache(selectedConfigId)
      // 从缓存加载投手分组数据
      loadOperatorGroupsFromCache(selectedConfigId)
      // 清空分组搜索关键字
      setGroupSearchKeywords({})
      // 重新加载组织列表
      if (!loadingOrganizations) {
        loadOrganizations()
      }
    } else {
      // 如果配置被清空，也清空组织列表和分组
      setOrganizations([])
      setOrganizationGroups([])
      setOperatorGroups([])
      setGroupSearchKeywords({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConfigId, configs.length, user?.id])

  // 当分组数据变化时，保存到缓存
  useEffect(() => {
    if (selectedConfigId) {
      saveGroupsToCache(selectedConfigId, organizationGroups)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationGroups, selectedConfigId])

  // 当投手分组数据变化时，保存到缓存
  useEffect(() => {
    if (selectedConfigId) {
      saveOperatorGroupsToCache(selectedConfigId, operatorGroups)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorGroups, selectedConfigId])

  // 当组织分组数量变化时，如果启用投手维度但组织分组不为1，自动关闭
  useEffect(() => {
    if (useOperatorDimension && organizationGroups.length !== 1) {
      setUseOperatorDimension(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationGroups.length])

  const loadConfigs = async (): Promise<void> => {
    setLoading(true)
    try {
      const tencentConfigs = await configService.getConfigsBySource(2)
      setConfigs(tencentConfigs)
      if (tencentConfigs.length > 0 && !selectedConfigId) {
        setSelectedConfigId(tencentConfigs[0].id)
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
      setError('加载配置失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const loadOrganizations = async (): Promise<void> => {
    if (!selectedConfigId) {
      toast.error('请先选择配置')
      return
    }

    setLoadingOrganizations(true)
    setError('')
    try {
      const result = await organizationListService.getOrganizationList({
        selected_cookie_id: selectedConfigId
      })

      if (result.code === 0 && result.data) {
        setOrganizations(result.data)
        toast.success(`成功加载 ${result.data.length} 个组织`)
      } else {
        setError(result.error || result.msg || '获取组织列表失败')
        toast.error(result.error || result.msg || '获取组织列表失败')
      }
    } catch (err: any) {
      console.error('Failed to load organizations:', err)
      const errorMsg = err.message || '获取组织列表失败'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoadingOrganizations(false)
    }
  }

  // 创建新分组
  const createGroup = (): void => {
    const newGroup: OrganizationGroup = {
      id: `group_${Date.now()}`,
      name: `分组 ${organizationGroups.length + 1}`,
      businessIds: []
    }
    setOrganizationGroups([...organizationGroups, newGroup])
    // 创建后自动进入编辑名称状态
    setEditingGroupId(newGroup.id)
    setEditingGroupName(newGroup.name)
  }

  // 删除分组
  const deleteGroup = (groupId: string): void => {
    setOrganizationGroups(organizationGroups.filter((g) => g.id !== groupId))
    // 清除该分组的搜索关键字
    setGroupSearchKeywords((prev) => {
      const updated = { ...prev }
      delete updated[groupId]
      return updated
    })
  }

  // 开始编辑分组名称
  const startEditGroupName = (groupId: string): void => {
    const group = organizationGroups.find((g) => g.id === groupId)
    if (group) {
      setEditingGroupId(groupId)
      setEditingGroupName(group.name)
    }
  }

  // 保存分组名称
  const saveGroupName = (groupId: string): void => {
    if (!editingGroupName.trim()) {
      toast.error('分组名称不能为空')
      return
    }
    const updatedGroups = organizationGroups.map((g) =>
      g.id === groupId ? { ...g, name: editingGroupName.trim() } : g
    )
    setOrganizationGroups(updatedGroups)
    setEditingGroupId(null)
    setEditingGroupName('')
  }

  // 设置分组搜索关键字
  const setGroupSearchKeyword = (groupId: string, keyword: string): void => {
    setGroupSearchKeywords((prev) => ({
      ...prev,
      [groupId]: keyword
    }))
  }

  // 获取分组搜索关键字
  const getGroupSearchKeyword = (groupId: string): string => {
    return groupSearchKeywords[groupId] || ''
  }

  // 取消编辑分组名称
  const cancelEditGroupName = (): void => {
    setEditingGroupId(null)
    setEditingGroupName('')
  }

  // 切换组织选择（添加到分组或从分组移除）
  const toggleOrganizationInGroup = (groupId: string, org: OrganizationItem): void => {
    setOrganizationGroups(
      organizationGroups.map((group) => {
        if (group.id === groupId) {
          const exists = group.businessIds.includes(org.business_id)
          return {
            ...group,
            businessIds: exists
              ? group.businessIds.filter((id) => id !== org.business_id)
              : [...group.businessIds, org.business_id]
          }
        }
        return group
      })
    )
  }

  // 检查组织是否在某个分组中
  const isOrganizationInGroup = (groupId: string, businessId: number): boolean => {
    const group = organizationGroups.find((g) => g.id === groupId)
    return group ? group.businessIds.includes(businessId) : false
  }

  // 投手分组管理函数
  const createOperatorGroup = (): void => {
    const newGroup: OperatorGroup = {
      id: `operator_group_${Date.now()}`,
      name: `投手分组 ${operatorGroups.length + 1}`,
      tags: []
    }
    setOperatorGroups([...operatorGroups, newGroup])
    // 创建后自动进入编辑名称状态
    setEditingOperatorGroupId(newGroup.id)
    setEditingOperatorGroupName(newGroup.name)
    setEditingOperatorGroupTags('')
  }

  const deleteOperatorGroup = (groupId: string): void => {
    setOperatorGroups(operatorGroups.filter((g) => g.id !== groupId))
  }

  const startEditOperatorGroup = (groupId: string): void => {
    const group = operatorGroups.find((g) => g.id === groupId)
    if (group) {
      setEditingOperatorGroupId(groupId)
      setEditingOperatorGroupName(group.name)
      setEditingOperatorGroupTags(group.tags.join('\n'))
    }
  }

  const saveOperatorGroup = (groupId: string): void => {
    if (!editingOperatorGroupName.trim()) {
      toast.error('分组名称不能为空')
      return
    }
    const tags = editingOperatorGroupTags
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t)
    if (tags.length === 0) {
      toast.error('至少需要添加一个标签')
      return
    }
    const updatedGroups = operatorGroups.map((g) =>
      g.id === groupId ? { ...g, name: editingOperatorGroupName.trim(), tags } : g
    )
    setOperatorGroups(updatedGroups)
    setEditingOperatorGroupId(null)
    setEditingOperatorGroupName('')
    setEditingOperatorGroupTags('')
  }

  const cancelEditOperatorGroup = (): void => {
    setEditingOperatorGroupId(null)
    setEditingOperatorGroupName('')
    setEditingOperatorGroupTags('')
  }

  const validateDate = (date: string): void => {
    if (!date) {
      setDateError('请选择查询日期')
      return
    }
    const selectedDate = new Date(date)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    if (selectedDate > today) {
      setDateError('查询日期不能超过今天')
      return
    }
    setDateError('')
  }

  const handleFetchData = async (): Promise<void> => {
    if (!selectedConfigId) {
      toast.error('请先选择配置')
      return
    }

    if (!queryDate) {
      setDateError('请选择查询日期')
      toast.error('请选择查询日期')
      return
    }

    if (organizationGroups.length === 0) {
      toast.error('请至少创建一个组织分组')
      return
    }

    // 检查每个分组是否至少包含一个组织
    const emptyGroups = organizationGroups.filter((g) => g.businessIds.length === 0)
    if (emptyGroups.length > 0) {
      toast.error(`分组 "${emptyGroups[0].name}" 至少需要选择一个组织`)
      return
    }

    // 如果启用投手维度，检查投手分组（仅当组织分组为一个时）
    if (useOperatorDimension && organizationGroups.length === 1) {
      if (operatorGroups.length === 0) {
        toast.error('请至少创建一个投手分组')
        return
      }
      const emptyOperatorGroups = operatorGroups.filter((g) => g.tags.length === 0)
      if (emptyOperatorGroups.length > 0) {
        toast.error(`投手分组 "${emptyOperatorGroups[0].name}" 至少需要添加一个标签`)
        return
      }
    }

    // 如果组织分组不为一个但启用了投手维度，自动关闭
    if (useOperatorDimension && organizationGroups.length !== 1) {
      setUseOperatorDimension(false)
      toast.warning('投手维度仅在组织分组为一个时可用')
      return
    }

    setLoadingData(true)
    setError('')

    try {
      // 构建organization_groups：分组名称和对应的组织ID列表
      const organizationGroupsData = organizationGroups.map((group) => ({
        group_name: group.name,
        business_id_list: group.businessIds
      }))

      // 如果启用投手维度，发送一次请求，将所有投手分组信息一起发送
      if (useOperatorDimension && operatorGroups.length > 0) {
        // 构建投手分组数据
        const operatorGroupsData = operatorGroups.map((group) => ({
          name: group.name,
          tags: group.tags
        }))

        // 发送一次请求，包含所有投手分组信息
        const result = await dataAssistantService.getDataStatistics({
          selected_cookie_id: selectedConfigId,
          query_date: queryDate,
          organization_groups: organizationGroupsData,
          use_tag_grouping: useTagGrouping,
          tag_text: useTagGrouping ? tagText : undefined,
          operator_groups: operatorGroupsData
        })

        if (result.code === 0 && result.data) {
          const businessData = result.data.business_data || {}
          const totalSummaryList = (result.data as any)?.total_summary || []
          const tagGroupList = (result.data as any)?.tag_group_data || [] // 独立的标签分组数据

          // 重新组织数据：按组织分组 -> 按投手分组 -> 按标签分组
          // 结构：{ groupName: { operatorName: { tagKey: AccountData[] } } }
          const organizedData: Record<string, Record<string, Record<string, AccountData[]>>> = {}
          const operatorSummaryData: Record<string, Record<string, AccountData[]>> = {} // { groupName: { operatorName: AccountData[] } }

          // 遍历每个组织的数据
          Object.entries(businessData).forEach(([groupName, businessInfo]: [string, any]) => {
            const tagGroups = (businessInfo as any).tag_groups || {}

            if (!organizedData[groupName]) {
              organizedData[groupName] = {}
            }

            // 解析tagKey格式：operatorName::tagKey
            Object.entries(tagGroups).forEach(([combinedKey, accounts]: [string, any]) => {
              const [operatorName, tagKey] = combinedKey.includes('::')
                ? combinedKey.split('::', 2)
                : [null, combinedKey]

              if (!operatorName) {
                // 如果没有投手名称，跳过
                return
              }

              if (!organizedData[groupName][operatorName]) {
                organizedData[groupName][operatorName] = {}
              }

              if (!organizedData[groupName][operatorName][tagKey]) {
                organizedData[groupName][operatorName][tagKey] = []
              }

              // 账户数据已经包含operator字段
              organizedData[groupName][operatorName][tagKey].push(...(accounts as AccountData[]))
            })
          })

          // 处理汇总数据，按组织分组和投手分组
          if (totalSummaryList.length > 0) {
            organizationGroups.forEach((group) => {
              if (!operatorSummaryData[group.name]) {
                operatorSummaryData[group.name] = {}
              }

              // 汇总数据已经包含operator字段
              totalSummaryList.forEach((acc: AccountData) => {
                const operatorName = acc.operator || ''
                if (operatorName) {
                  if (!operatorSummaryData[group.name][operatorName]) {
                    operatorSummaryData[group.name][operatorName] = []
                  }
                  operatorSummaryData[group.name][operatorName].push(acc)
                }
              })
            })
          }

          // 转换为旧格式以保持兼容（但实际展示时会重新组织）
          const tagGroupsData: Record<string, AccountData[]> = {}
          Object.entries(organizedData).forEach(([groupName, operators]) => {
            Object.entries(operators).forEach(([operatorName, tags]) => {
              Object.entries(tags).forEach(([tagKey, accounts]) => {
                const key = `${groupName}::${operatorName}::${tagKey}`
                tagGroupsData[key] = accounts
              })
            })
          })

          setStatisticsData(tagGroupsData)
          setOrganizedData(organizedData)
          setOperatorSummaryData(operatorSummaryData)
          // 设置标签分组数据（独立于投手数据）
          setTagGroupData(tagGroupList)
          // 设置全局汇总数据（total_summary）
          setTotalSummaryData({ __all__: totalSummaryList })
          // 保存原始 API 数据用于生成图片
          setRawStatisticsData({ ...result.data, query_date: queryDate })
          setIsStatisticsDialogOpen(true)
          toast.success('数据拉取成功！')
        } else {
          const errorMsg = result.error || result.msg || '获取数据失败'
          setError(errorMsg)
          toast.error(errorMsg)
        }
      } else {
        // 原有的逻辑：不使用投手维度
        const result = await dataAssistantService.getDataStatistics({
          selected_cookie_id: selectedConfigId,
          query_date: queryDate,
          organization_groups: organizationGroupsData,
          use_tag_grouping: useTagGrouping,
          tag_text: useTagGrouping ? tagText : undefined
        })

        if (result.code === 0 && result.data) {
          // 将按组织ID分组的数据转换为按标签分组的格式（用于显示）
          const businessData = result.data.business_data || {}
          const tagGroupsData: Record<string, AccountData[]> = {}

          // 遍历每个组织的数据
          Object.values(businessData).forEach((businessInfo: any) => {
            const tagGroups = businessInfo.tag_groups || {}
            // 合并所有组织的标签组数据
            Object.entries(tagGroups).forEach(([tagKey, accounts]: [string, any]) => {
              if (!tagGroupsData[tagKey]) {
                tagGroupsData[tagKey] = []
              }
              tagGroupsData[tagKey].push(...accounts)
            })
          })

          // 处理汇总数据（单独存放，合并所有标签组）
          const totalSummaryList = (result.data as any)?.total_summary || []

          setStatisticsData(tagGroupsData)
          setTotalSummaryData({ __all__: totalSummaryList }) // 所有汇总数据放在一个组中
          setOrganizedData({}) // 清空组织化数据
          setOperatorSummaryData({}) // 清空投手汇总数据
          setTagGroupData([]) // 清空标签分组数据（非投手维度不使用）
          // 保存原始 API 数据用于生成图片
          setRawStatisticsData({ ...result.data, query_date: queryDate })
          setIsStatisticsDialogOpen(true)
          toast.success('数据拉取成功！')
        } else {
          const errorMsg = result.error || result.msg || '获取数据失败'
          setError(errorMsg)
          toast.error(errorMsg)
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch data:', err)
      const errorMsg = err.message || '获取数据失败'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoadingData(false)
    }
  }

  // 发送数据到飞书表格
  const sendToFeishuSheet = async (): Promise<void> => {
    const hasData = Object.keys(statisticsData).length > 0
    const hasTagGroupData = tagGroupData.length > 0
    const hasSummaryData = useOperatorDimension
      ? Object.keys(totalSummaryData).length > 0
      : totalSummaryData['__all__'] && totalSummaryData['__all__'].length > 0

    if (!hasData && !hasTagGroupData && !hasSummaryData) {
      toast.error('暂无数据可发送')
      return
    }

    setIsSendingToFeishu(true)
    try {
      // 准备表头
      const headers = [
        '项目',
        ...(useOperatorDimension ? ['投手'] : []),
        '体裁',
        '团队',
        '消耗',
        '激活数',
        '当日激活成本',
        '昨日消耗',
        '昨日成本',
        '昨日实时次留',
        '历史七日消耗',
        '七日留存成本',
        '历史七日次留',
        '历史七日7留'
      ]

      // 准备数据行和合并范围
      const rows: string[][] = []
      const projectMergeRanges: number[][] = []
      const tagMergeRanges: number[][] = []
      const operatorMergeRanges: number[][] = [] // 投手列合并范围
      const totalRows: number[] = []
      const totalGenreTeamMergeRanges: number[][] = [] // 总计行的体裁和团队列合并范围

      let currentRow = 4 // 数据从第4行开始（第1行是标题，第2行空，第3行是表头）
      const dataStartRow = currentRow // 记录数据开始行
      let currentGenreStartRow = currentRow
      let currentGenre = ''
      let currentOperatorStartRow = currentRow
      let currentOperator = ''

      if (useOperatorDimension) {
        // 投手维度：按投手分组处理数据
        // statisticsData 的 key 格式是：groupName::operatorName::tagKey

        // 先按投手分组，然后按tagKey排序
        const operatorDataMap: Record<
          string,
          Array<{ tagKey: string; accounts: AccountData[] }>
        > = {}

        Object.keys(statisticsData).forEach((key) => {
          if (key === '__all__') return
          const accounts = statisticsData[key]
          if (accounts.length === 0) return

          // 解析tagKey：groupName::operatorName::tagKey
          const parts = key.split('::')
          const operatorName = parts.length >= 2 ? parts[1] : ''
          const actualTagKey = parts.length >= 3 ? parts[2] : parts.length >= 2 ? parts[1] : key

          if (!operatorDataMap[operatorName]) {
            operatorDataMap[operatorName] = []
          }

          operatorDataMap[operatorName].push({
            tagKey: actualTagKey,
            accounts: accounts
          })
        })

        // 对每个投手的数据进行排序：1. 投手汇总（__total__） 2. 各个标签数据
        Object.keys(operatorDataMap).forEach((operatorName) => {
          operatorDataMap[operatorName].sort((a, b) => {
            // 投手汇总排在最前面
            if (a.tagKey === '__total__' && b.tagKey !== '__total__') return -1
            if (a.tagKey !== '__total__' && b.tagKey === '__total__') return 1
            // 其他情况按字母顺序排序
            return a.tagKey.localeCompare(b.tagKey)
          })
        })

        // 按投手分组配置顺序排序（未配置的投手追加到末尾并按名称排序）
        const operatorOrder = operatorGroups.map((g) => g.name)
        const sortedOperators = [
          ...operatorOrder.filter((name) => operatorDataMap[name]),
          ...Object.keys(operatorDataMap)
            .filter((name) => !operatorOrder.includes(name))
            .sort()
        ]

        // 遍历每个投手的数据
        sortedOperators.forEach((operatorName) => {
          const operatorData = operatorDataMap[operatorName]

          // 开始新的投手，记录起始行
          if (operatorName !== currentOperator) {
            // 如果投手变化，合并之前的投手列
            if (currentRow > currentOperatorStartRow && currentOperator) {
              operatorMergeRanges.push([currentOperatorStartRow, currentRow - 1])
            }
            currentOperator = operatorName
            currentOperatorStartRow = currentRow
          }

          // 遍历该投手的所有数据
          operatorData.forEach(({ tagKey: actualTagKey, accounts }) => {
            const projectValue = '腾讯\n红果短剧\n(分销)'
            // 如果是汇总数据（__total__），体裁显示为"总消耗"
            let genreValue = actualTagKey
            if (actualTagKey === '__total__') {
              genreValue = '总消耗'
            }

            // 检查体裁是否变化
            if (genreValue !== currentGenre) {
              // 如果体裁变化，合并之前的体裁列
              if (currentRow > currentGenreStartRow && currentGenre) {
                tagMergeRanges.push([currentGenreStartRow, currentRow - 1])
              }
              currentGenre = genreValue
              currentGenreStartRow = currentRow
            }

            accounts.forEach((account) => {
              // 添加数据行（投手列在体裁列前面）
              rows.push([
                projectValue,
                account.operator || operatorName || '',
                genreValue,
                account.team || account.business_name || '',
                account.cost.toFixed(2),
                account.activated_count.toString(),
                account.activated_cost.toFixed(2),
                account.yesterday_cost.toFixed(2),
                account.yesterday_activated_cost.toFixed(2),
                account.yesterday_retention_rate || '0.00%',
                account.history_7d_cost.toFixed(2),
                account.history_7d_activated_cost.toFixed(2),
                account.history_7d_retention_rate || '0.00%',
                account.history_7d_app_retention_d7_rate || '0.00%'
              ])

              currentRow++
            })
          })
        })

        // 合并最后一个投手
        if (currentRow > currentOperatorStartRow && currentOperator) {
          operatorMergeRanges.push([currentOperatorStartRow, currentRow - 1])
        }

        // 合并最后一个体裁
        if (currentRow > currentGenreStartRow && currentGenre) {
          tagMergeRanges.push([currentGenreStartRow, currentRow - 1])
        }

        // 添加标签分组数据（在汇总数据之前）
        // 注意：标签分组数据不影响投手和体裁的合并逻辑，因为它们独立显示
        if (tagGroupData.length > 0) {
          // 重置体裁状态，因为标签分组数据是独立的
          const tagGroupGenreStartRow = currentRow
          tagGroupData.forEach((account, index) => {
            const projectValue = '腾讯\n红果短剧\n(分销)'
            rows.push([
              projectValue,
              '', // 标签分组数据没有投手
              account.genre,
              account.team || account.business_name || '',
              account.cost.toFixed(2),
              account.activated_count.toString(),
              account.activated_cost.toFixed(2),
              account.yesterday_cost.toFixed(2),
              account.yesterday_activated_cost.toFixed(2),
              account.yesterday_retention_rate || '0.00%',
              account.history_7d_cost.toFixed(2),
              account.history_7d_activated_cost.toFixed(2),
              account.history_7d_retention_rate || '0.00%',
              account.history_7d_app_retention_d7_rate || '0.00%'
            ])
            currentRow++
          })
          // 如果标签分组数据有多行且体裁相同，可以合并体裁列
          if (
            tagGroupData.length > 1 &&
            tagGroupData.every((acc) => acc.genre === tagGroupData[0].genre)
          ) {
            tagMergeRanges.push([tagGroupGenreStartRow, currentRow - 1])
          }
        }

        // 添加全局汇总数据（total_summary）
        if (totalSummaryData['__all__'] && totalSummaryData['__all__'].length > 0) {
          totalSummaryData['__all__'].forEach((account) => {
            const projectValue = '腾讯\n红果短剧\n(分销)'
            rows.push([
              projectValue,
              '合计', // 投手列显示"合计"，合并后会显示在合并的单元格中
              '合计', // 体裁列显示"合计"，合并后会显示在合并的单元格中
              '合计', // 团队列显示"合计"，合并后会显示在合并的单元格中
              account.cost.toFixed(2),
              account.activated_count.toString(),
              account.activated_cost.toFixed(2),
              account.yesterday_cost.toFixed(2),
              account.yesterday_activated_cost.toFixed(2),
              account.yesterday_retention_rate || '0.00%',
              account.history_7d_cost.toFixed(2),
              account.history_7d_activated_cost.toFixed(2),
              account.history_7d_retention_rate || '0.00%',
              account.history_7d_app_retention_d7_rate || '0.00%'
            ])
            // 总计行的投手、体裁和团队列合并（B、C、D列）
            totalGenreTeamMergeRanges.push([currentRow, currentRow])
            totalRows.push(currentRow)
            currentRow++
          })
        }
      } else {
        // 非投手维度：原有逻辑
        const tagKeys = Object.keys(statisticsData).filter((key) => key !== '__all__')

        tagKeys.forEach((tagKey) => {
          const accounts = statisticsData[tagKey]
          if (accounts.length === 0) return

          // 项目列的值：腾讯\n红果短剧\n(分销)，\n为换行
          const projectValue = '腾讯\n红果短剧\n(分销)'
          const genreValue = tagKey // 标签就是体裁

          // 检查体裁是否变化
          if (genreValue !== currentGenre) {
            // 如果体裁变化，合并之前的体裁列
            if (currentRow > currentGenreStartRow && currentGenre) {
              tagMergeRanges.push([currentGenreStartRow, currentRow - 1])
            }
            currentGenre = genreValue
            currentGenreStartRow = currentRow
          }

          accounts.forEach((account, index) => {
            // 添加数据行
            rows.push([
              projectValue,
              genreValue,
              account.team || account.business_name || '',
              account.cost.toFixed(2),
              account.activated_count.toString(),
              account.activated_cost.toFixed(2),
              account.yesterday_cost.toFixed(2),
              account.yesterday_activated_cost.toFixed(2),
              account.yesterday_retention_rate || '0.00%',
              account.history_7d_cost.toFixed(2),
              account.history_7d_activated_cost.toFixed(2),
              account.history_7d_retention_rate || '0.00%',
              account.history_7d_app_retention_d7_rate || '0.00%'
            ])

            currentRow++
          })
        })

        // 合并最后一个体裁
        if (currentRow > currentGenreStartRow && currentGenre) {
          tagMergeRanges.push([currentGenreStartRow, currentRow - 1])
        }

        // 添加总计数据
        if (totalSummaryData['__all__'] && totalSummaryData['__all__'].length > 0) {
          totalSummaryData['__all__'].forEach((account) => {
            const projectValue = '腾讯\n红果短剧\n(分销)'
            rows.push([
              projectValue,
              '总计',
              account.team || account.business_name || '',
              account.cost.toFixed(2),
              account.activated_count.toString(),
              account.activated_cost.toFixed(2),
              account.yesterday_cost.toFixed(2),
              account.yesterday_activated_cost.toFixed(2),
              account.yesterday_retention_rate || '0.00%',
              account.history_7d_cost.toFixed(2),
              account.history_7d_activated_cost.toFixed(2),
              account.history_7d_retention_rate || '0.00%',
              account.history_7d_app_retention_d7_rate || '0.00%'
            ])
            // 总计行的体裁和团队列合并（B列和C列）
            totalGenreTeamMergeRanges.push([currentRow, currentRow])
            totalRows.push(currentRow)
            currentRow++
          })
        }
      }

      // 项目列整列合并（从第一行数据到最后一行数据，包括总计行）
      const dataEndRow = currentRow - 1
      if (dataEndRow >= dataStartRow) {
        projectMergeRanges.push([dataStartRow, dataEndRow])
      }

      // 生成表格标题
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const queryDateObj = new Date(queryDate)
      const queryDateOnly = new Date(
        queryDateObj.getFullYear(),
        queryDateObj.getMonth(),
        queryDateObj.getDate()
      )

      let sheetTitle = ''
      if (queryDateOnly < today) {
        sheetTitle = `${queryDate}-日报-腾讯广告数据统计`
      } else {
        const hour = now.getHours()
        sheetTitle = `${queryDate}/${hour}:00-时报-腾讯广告数据统计`
      }

      // 调用飞书API创建表格
      const response = await feishuService.createSheetWithDataPersonal({
        title: sheetTitle,
        headers,
        rows,
        color_type: 'black',
        project_merge_ranges: projectMergeRanges.length > 0 ? projectMergeRanges : undefined,
        tag_merge_ranges: tagMergeRanges.length > 0 ? tagMergeRanges : undefined,
        operator_merge_ranges:
          useOperatorDimension && operatorMergeRanges.length > 0 ? operatorMergeRanges : undefined,
        total_rows: totalRows.length > 0 ? totalRows : undefined,
        total_genre_team_merge_ranges:
          totalGenreTeamMergeRanges.length > 0 ? totalGenreTeamMergeRanges : undefined
      })

      toast.success('数据已成功发送到飞书表格！')

      // 打开飞书表格链接
      if (response.spreadsheet_url) {
        window.open(response.spreadsheet_url, '_blank')
      }
    } catch (error: any) {
      console.error('发送到飞书失败:', error)
      toast.error(error.message || '发送到飞书失败，请稍后重试')
    } finally {
      setIsSendingToFeishu(false)
    }
  }

  // 生成图片
  const generateImage = async (): Promise<void> => {
    if (!rawStatisticsData) {
      toast.error('暂无统计数据，请先拉取数据')
      return
    }

    setIsGeneratingImage(true)
    try {
      const blob = await dataAssistantService.exportStatisticsImage(rawStatisticsData)
      const url = URL.createObjectURL(blob)
      setGeneratedImageUrl(url)
      toast.success('图片生成成功')
    } catch (err: unknown) {
      console.error('生成图片失败:', err)
      toast.error(err instanceof Error ? err.message : '生成图片失败')
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

  return (
    <div className="space-y-6 pb-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            数据助手
          </h1>
        </div>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          根据组织筛选并统计广告数据，支持多组织组合查询
        </p>
      </motion.div>

      {/* 选择配置 */}
      <Card>
        <CardHeader>
          <CardTitle>选择配置</CardTitle>
          <CardDescription>选择要使用的腾讯助手账号配置</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">加载配置中...</span>
            </div>
          ) : configs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              暂无配置，请先在配置页面添加腾讯助手账号
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {configs.map((config) => {
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
                    onClick={() => setSelectedConfigId(config.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex flex-1 gap-2 items-center min-w-0">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                            isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
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
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 组织分组管理 */}
      {selectedConfigId !== null && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>组织分组管理</CardTitle>
                <CardDescription>创建分组，为每个分组选择组织并自定义命名</CardDescription>
              </div>
              <Button
                onClick={loadOrganizations}
                disabled={loadingOrganizations || !user?.id}
                variant="outline"
                size="sm"
              >
                {loadingOrganizations ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    加载中...
                  </>
                ) : (
                  '加载组织列表'
                )}
              </Button>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500 mt-2">
                <XCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* 创建分组按钮 */}
              <div className="flex justify-start items-center">
                <Button onClick={createGroup} variant="outline" size="sm">
                  <Plus className="mr-2 w-4 h-4" />
                  创建分组
                </Button>
              </div>

              {/* 分组列表 */}
              {organizationGroups.length > 0 && (
                <div className="space-y-3">
                  {organizationGroups.map((group) => (
                    <div key={group.id} className="border rounded-lg p-4 space-y-3">
                      {/* 分组头部 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          {editingGroupId === group.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                value={editingGroupName}
                                onChange={(e) => setEditingGroupName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    saveGroupName(group.id)
                                  } else if (e.key === 'Escape') {
                                    cancelEditGroupName()
                                  }
                                }}
                                className="flex-1"
                                autoFocus
                              />
                              <Button
                                onClick={() => saveGroupName(group.id)}
                                size="sm"
                                variant="ghost"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button onClick={cancelEditGroupName} size="sm" variant="ghost">
                                <XIcon className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="font-semibold text-base">{group.name}</span>
                              <span className="text-sm text-muted-foreground">
                                ({group.businessIds.length} 个组织)
                              </span>
                              <Button
                                onClick={() => startEditGroupName(group.id)}
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                        <Button
                          onClick={() => deleteGroup(group.id)}
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* 分组搜索框 */}
                      {organizations.length > 0 && (
                        <div className="relative">
                          <Input
                            type="text"
                            placeholder="搜索组织（支持ID或名称）"
                            value={getGroupSearchKeyword(group.id)}
                            onChange={(e) => setGroupSearchKeyword(group.id, e.target.value)}
                            className="w-full"
                          />
                          {getGroupSearchKeyword(group.id) && (
                            <button
                              onClick={() => setGroupSearchKeyword(group.id, '')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* 组织选择区域 */}
                      {organizations.length > 0 && (
                        <div className="border rounded-md p-3 max-h-[300px] overflow-y-auto bg-muted/30">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {organizations
                              .filter((org) => {
                                // 使用分组搜索关键字
                                const searchKeyword = getGroupSearchKeyword(group.id)
                                if (!searchKeyword.trim()) {
                                  return true
                                }
                                const keyword = searchKeyword.toLowerCase().trim()
                                const orgId = String(org.business_id).toLowerCase()
                                const orgName = org.business_name.toLowerCase()
                                return orgId.includes(keyword) || orgName.includes(keyword)
                              })
                              .map((org) => {
                                const isSelected = isOrganizationInGroup(group.id, org.business_id)
                                return (
                                  <div
                                    key={org.business_id}
                                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all ${
                                      isSelected
                                        ? 'bg-primary/10 border border-primary/50'
                                        : 'border border-border hover:border-primary/50 hover:bg-accent/50'
                                    }`}
                                    onClick={() => toggleOrganizationInGroup(group.id, org)}
                                  >
                                    <div
                                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                        isSelected
                                          ? 'border-primary bg-primary'
                                          : 'border-muted-foreground/30'
                                      }`}
                                    >
                                      {isSelected && (
                                        <div className="w-2 h-2 rounded-full bg-white" />
                                      )}
                                    </div>
                                    <span className="text-sm flex-1">
                                      {org.business_id}-{org.business_name}
                                    </span>
                                  </div>
                                )
                              })}
                          </div>
                          {organizations.filter((org) => {
                            const searchKeyword = getGroupSearchKeyword(group.id)
                            if (!searchKeyword.trim()) {
                              return true
                            }
                            const keyword = searchKeyword.toLowerCase().trim()
                            const orgId = String(org.business_id).toLowerCase()
                            const orgName = org.business_name.toLowerCase()
                            return orgId.includes(keyword) || orgName.includes(keyword)
                          }).length === 0 && (
                            <div className="py-8 text-center text-muted-foreground text-sm">
                              未找到匹配的组织
                            </div>
                          )}
                        </div>
                      )}

                      {/* 已选组织显示 */}
                      {group.businessIds.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {group.businessIds.map((businessId) => {
                            const org = organizations.find((o) => o.business_id === businessId)
                            if (!org) return null
                            return (
                              <div
                                key={businessId}
                                className="flex items-center gap-2 px-2 py-1 bg-primary/10 text-primary rounded-md text-xs"
                              >
                                {org.business_name}
                                <button
                                  onClick={() => toggleOrganizationInGroup(group.id, org)}
                                  className="hover:text-destructive"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {organizationGroups.length === 0 && organizations.length > 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  点击&ldquo;创建分组&rdquo;开始管理组织分组
                </div>
              )}

              {organizations.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">请先加载组织列表</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 查询配置：日期与标签分组 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>查询配置</CardTitle>
          <CardDescription>设置查询日期及标签分组</CardDescription>
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

            {/* 右侧：标签分组设置 */}
            <div className="space-y-3 border-l pl-8 md:block hidden">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <Label htmlFor="tag-grouping" className="font-semibold text-sm cursor-pointer">
                    标签分组
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="tag-grouping"
                    checked={useTagGrouping}
                    onChange={(e) => setUseTagGrouping(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-muted-foreground">
                    {useTagGrouping ? '已启用' : '未启用'}
                  </span>
                </div>
              </div>

              <div
                className={`transition-all duration-300 overflow-hidden ${useTagGrouping ? 'opacity-100 max-h-40' : 'opacity-40 max-h-40 pointer-events-none'}`}
              >
                <textarea
                  id="tag-text"
                  value={tagText}
                  onChange={(e) => setTagText(e.target.value)}
                  disabled={!useTagGrouping}
                  placeholder="请输入标签，每行一个。例如：\n游戏\n工具"
                  className="w-full h-24 px-3 py-2 text-sm border rounded-md resize-none focus-visible:ring-1 focus-visible:ring-primary outline-none bg-background/50"
                  rows={4}
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  系统将根据标签名称中是否包含以上标签，自动对标签进行归类。
                </p>
              </div>
            </div>

            {/* 移动端显示的标签分组设置（无边框） */}
            <div className="space-y-3 md:hidden block">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <Label htmlFor="tag-grouping-mobile" className="font-semibold text-sm">
                    标签分组
                  </Label>
                </div>
                <input
                  type="checkbox"
                  id="tag-grouping-mobile"
                  checked={useTagGrouping}
                  onChange={(e) => setUseTagGrouping(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary"
                />
              </div>
              {useTagGrouping && (
                <div className="space-y-2">
                  <textarea
                    value={tagText}
                    onChange={(e) => setTagText(e.target.value)}
                    placeholder="请输入标签，每行一个"
                    className="w-full h-24 px-3 py-2 text-sm border rounded-md resize-none"
                    rows={4}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 投手维度设置 - 仅当组织分组为一个时显示 */}
          {organizationGroups.length === 1 && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <Label
                    htmlFor="operator-dimension"
                    className="font-semibold text-sm cursor-pointer"
                  >
                    投手维度
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="operator-dimension"
                    checked={useOperatorDimension}
                    onChange={(e) => setUseOperatorDimension(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-muted-foreground">
                    {useOperatorDimension ? '已启用' : '未启用'}
                  </span>
                </div>
              </div>

              {useOperatorDimension && (
                <div className="space-y-4">
                  {/* 创建投手分组按钮 */}
                  <div className="flex justify-start items-center">
                    <Button onClick={createOperatorGroup} variant="outline" size="sm">
                      <Plus className="mr-2 w-4 h-4" />
                      创建投手分组
                    </Button>
                  </div>

                  {/* 投手分组列表 */}
                  {operatorGroups.length > 0 && (
                    <div className="space-y-3">
                      {operatorGroups.map((group) => (
                        <div key={group.id} className="border rounded-lg p-4 space-y-3">
                          {/* 分组头部 */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              {editingOperatorGroupId === group.id ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <Input
                                    value={editingOperatorGroupName}
                                    onChange={(e) => setEditingOperatorGroupName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && e.ctrlKey) {
                                        saveOperatorGroup(group.id)
                                      } else if (e.key === 'Escape') {
                                        cancelEditOperatorGroup()
                                      }
                                    }}
                                    className="flex-1"
                                    placeholder="分组名称"
                                    autoFocus
                                  />
                                  <Button
                                    onClick={() => saveOperatorGroup(group.id)}
                                    size="sm"
                                    variant="ghost"
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    onClick={cancelEditOperatorGroup}
                                    size="sm"
                                    variant="ghost"
                                  >
                                    <XIcon className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <span className="font-semibold text-base">{group.name}</span>
                                  <span className="text-sm text-muted-foreground">
                                    ({group.tags.length} 个标签)
                                  </span>
                                  <Button
                                    onClick={() => startEditOperatorGroup(group.id)}
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                            <Button
                              onClick={() => deleteOperatorGroup(group.id)}
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>

                          {/* 标签编辑区域 */}
                          {editingOperatorGroupId === group.id ? (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">
                                标签列表（每行一个）
                              </Label>
                              <textarea
                                value={editingOperatorGroupTags}
                                onChange={(e) => setEditingOperatorGroupTags(e.target.value)}
                                placeholder="请输入标签，每行一个。例如：\n纯短剧\n纯激励"
                                className="w-full h-24 px-3 py-2 text-sm border rounded-md resize-none focus-visible:ring-1 focus-visible:ring-primary outline-none"
                                rows={4}
                              />
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {group.tags.map((tag, idx) => (
                                <div
                                  key={idx}
                                  className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs"
                                >
                                  {tag}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {operatorGroups.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      点击&ldquo;创建投手分组&rdquo;开始管理投手分组
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 拉取数据按钮 */}
      {selectedConfigId !== null && organizationGroups.length > 0 && queryDate && (
        <Card>
          <CardContent className="pt-6">
            <Button
              onClick={handleFetchData}
              disabled={
                loadingData ||
                !queryDate ||
                organizationGroups.length === 0 ||
                organizationGroups.some((g) => g.businessIds.length === 0)
              }
              className="w-full"
              size="lg"
            >
              {loadingData ? (
                <>
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                  拉取数据中...
                </>
              ) : (
                <>
                  <Download className="mr-2 w-5 h-5" />
                  拉取数据
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 统计结果对话框 */}
      <Dialog open={isStatisticsDialogOpen} onOpenChange={setIsStatisticsDialogOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>统计结果</DialogTitle>
            <DialogDescription>
              查询日期：{queryDate} | 共 {Object.values(statisticsData).flat().length} 条记录
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {Object.keys(statisticsData).length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">暂无数据</div>
            ) : (
              <div className="space-y-6">
                {useOperatorDimension ? (
                  // 投手维度：按组织分组显示，每个组织分组内按投手排序
                  Object.keys(organizedData).length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">数据加载中...</div>
                  ) : (
                    <>
                      {Object.entries(organizedData).map(([groupName, operators]) => {
                        // 获取投手列表并排序
                        const operatorNames = Object.keys(operators).sort()

                        // 收集所有行数据，用于合并投手列
                        const allRows: Array<{
                          account: AccountData
                          operator: string
                          tagKey: string
                          isSummary?: boolean
                        }> = []

                        // 按投手顺序添加数据，顺序：1. 投手汇总 2. 标签分组数据 3. 各个标签数据
                        operatorNames.forEach((operatorName) => {
                          const tags = operators[operatorName]

                          // 先添加汇总数据（如果存在）
                          const totalTagKey = '__total__'
                          if (tags[totalTagKey]) {
                            tags[totalTagKey].forEach((account) => {
                              allRows.push({
                                account,
                                operator: operatorName,
                                tagKey: totalTagKey,
                                isSummary: true
                              })
                            })
                          }

                          // 分离标签分组数据和普通标签数据
                          const tagGroupItems: Array<[string, AccountData[]]> = []
                          const regularTagItems: Array<[string, AccountData[]]> = []

                          Object.entries(tags).forEach(([tagKey, accounts]) => {
                            if (tagKey === totalTagKey) {
                              return // 跳过汇总数据
                            }
                            if (tagKey.startsWith('__tag_group__')) {
                              tagGroupItems.push([tagKey, accounts])
                            } else {
                              regularTagItems.push([tagKey, accounts])
                            }
                          })

                          // 然后添加标签分组数据（在投手汇总之后）
                          tagGroupItems.forEach(([tagKey, accounts]) => {
                            accounts.forEach((account) => {
                              allRows.push({
                                account,
                                operator: operatorName,
                                tagKey,
                                isSummary: false
                              })
                            })
                          })

                          // 最后添加各个标签数据
                          regularTagItems.forEach(([tagKey, accounts]) => {
                            accounts.forEach((account) => {
                              allRows.push({ account, operator: operatorName, tagKey })
                            })
                          })
                        })

                        return (
                          <div key={groupName}>
                            <h3 className="text-lg font-semibold mb-3">{groupName}</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse text-sm">
                                <thead>
                                  <tr className="border-b bg-muted/50">
                                    <th className="p-2 text-left border-r">项目</th>
                                    <th className="p-2 text-left border-r">投手</th>
                                    <th className="p-2 text-left border-r">体裁</th>
                                    <th className="p-2 text-right border-r">消耗</th>
                                    <th className="p-2 text-right border-r">激活数</th>
                                    <th className="p-2 text-right border-r">当日激活成本</th>
                                    <th className="p-2 text-right border-r">昨日消耗</th>
                                    <th className="p-2 text-right border-r">昨日成本</th>
                                    <th className="p-2 text-right border-r">昨日实时次留</th>
                                    <th className="p-2 text-right border-r">历史七日消耗</th>
                                    <th className="p-2 text-right border-r">七日留存成本</th>
                                    <th className="p-2 text-right border-r">历史七日次留</th>
                                    <th className="p-2 text-right">历史七日7留</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    // 计算每个投手的数据行数量（用于rowSpan）
                                    const operatorRowCounts: Record<string, number> = {}
                                    allRows.forEach((row) => {
                                      operatorRowCounts[row.operator] =
                                        (operatorRowCounts[row.operator] || 0) + 1
                                    })

                                    // 渲染数据行
                                    const result: JSX.Element[] = []

                                    allRows.forEach((row, index) => {
                                      const { account, operator, tagKey, isSummary } = row

                                      // 检查是否是新投手的第一行
                                      const isFirstRowOfOperator =
                                        index === 0 || allRows[index - 1].operator !== operator
                                      const rowCount = operatorRowCounts[operator]
                                      const rowSpan = isFirstRowOfOperator ? rowCount : undefined

                                      result.push(
                                        <tr
                                          key={`${groupName}-${operator}-${tagKey}-${account.account_id}-${index}`}
                                          className={`border-b hover:bg-muted/30 ${isSummary ? 'font-semibold bg-muted/50' : ''}`}
                                        >
                                          <td className="p-2 border-r">{account.project}</td>
                                          {isFirstRowOfOperator ? (
                                            <td
                                              rowSpan={rowSpan}
                                              className="p-2 border-r align-top"
                                            >
                                              {operator}
                                            </td>
                                          ) : null}
                                          <td className="p-2 border-r">
                                            {isSummary
                                              ? '总消耗'
                                              : tagKey.startsWith('__tag_group__')
                                                ? tagKey.replace('__tag_group__', '')
                                                : account.genre}
                                          </td>
                                          <td className="p-2 text-right border-r">
                                            {account.cost.toFixed(2)}
                                          </td>
                                          <td className="p-2 text-right border-r">
                                            {account.activated_count}
                                          </td>
                                          <td className="p-2 text-right border-r">
                                            {account.activated_cost.toFixed(2)}
                                          </td>
                                          <td className="p-2 text-right border-r">
                                            {account.yesterday_cost.toFixed(2)}
                                          </td>
                                          <td className="p-2 text-right border-r">
                                            {account.yesterday_activated_cost.toFixed(2)}
                                          </td>
                                          <td className="p-2 text-right border-r">
                                            {account.yesterday_retention_rate || '0.00%'}
                                          </td>
                                          <td className="p-2 text-right border-r">
                                            {account.history_7d_cost.toFixed(2)}
                                          </td>
                                          <td className="p-2 text-right border-r">
                                            {account.history_7d_activated_cost.toFixed(2)}
                                          </td>
                                          <td className="p-2 text-right border-r">
                                            {account.history_7d_retention_rate || '0.00%'}
                                          </td>
                                          <td className="p-2 text-right">
                                            {account.history_7d_app_retention_d7_rate || '0.00%'}
                                          </td>
                                        </tr>
                                      )

                                      // 如果不是最后一个投手，在最后一个数据行后添加分隔行
                                      const isLastRowOfOperator =
                                        index === allRows.length - 1 ||
                                        allRows[index + 1].operator !== operator
                                      if (isLastRowOfOperator) {
                                        const currentOperatorIndex = operatorNames.indexOf(operator)
                                        const isLastOperator =
                                          currentOperatorIndex === operatorNames.length - 1

                                        // 如果不是最后一个投手，添加分隔行
                                        if (!isLastOperator) {
                                          result.push(
                                            <tr
                                              key={`separator-${groupName}-${operator}`}
                                              className="border-t-4 border-b-2"
                                            >
                                              <td colSpan={13} className="p-1"></td>
                                            </tr>
                                          )
                                        }
                                      }
                                    })

                                    return result
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )
                ) : (
                  // 非投手维度：原有逻辑
                  Object.entries(statisticsData).map(([tagKey, accounts]) => {
                    const displayTagKey = tagKey === '__all__' ? '全部数据' : `标签: ${tagKey}`

                    return (
                      <div key={tagKey}>
                        <h3 className="text-lg font-semibold mb-3">{displayTagKey}</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="p-2 text-left border-r">项目</th>
                                <th className="p-2 text-left border-r">体裁</th>
                                <th className="p-2 text-left border-r">团队</th>
                                <th className="p-2 text-right border-r">消耗</th>
                                <th className="p-2 text-right border-r">激活数</th>
                                <th className="p-2 text-right border-r">当日激活成本</th>
                                <th className="p-2 text-right border-r">昨日消耗</th>
                                <th className="p-2 text-right border-r">昨日成本</th>
                                <th className="p-2 text-right border-r">昨日实时次留</th>
                                <th className="p-2 text-right border-r">历史七日消耗</th>
                                <th className="p-2 text-right border-r">七日留存成本</th>
                                <th className="p-2 text-right border-r">历史七日次留</th>
                                <th className="p-2 text-right">历史七日7留</th>
                              </tr>
                            </thead>
                            <tbody>
                              {accounts.map((account, index) => (
                                <tr
                                  key={`${account.account_id}-${index}`}
                                  className="border-b hover:bg-muted/30"
                                >
                                  <td className="p-2 border-r">{account.project}</td>
                                  <td className="p-2 border-r">{account.genre}</td>
                                  <td className="p-2 border-r">
                                    {account.team || account.business_name || ''}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.cost.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.activated_count}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.activated_cost.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.yesterday_cost.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.yesterday_activated_cost.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.yesterday_retention_rate || '0.00%'}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.history_7d_cost.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.history_7d_activated_cost.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.history_7d_retention_rate || '0.00%'}
                                  </td>
                                  <td className="p-2 text-right">
                                    {account.history_7d_app_retention_d7_rate || '0.00%'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })
                )}

                {/* 显示标签分组数据（在汇总数据之前） */}
                {useOperatorDimension && tagGroupData.length > 0 && (
                  <div className="mt-6 pt-6 border-t-2">
                    <h3 className="text-lg font-semibold mb-3">标签分组</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="p-2 text-left border-r">项目</th>
                            <th className="p-2 text-left border-r">投手</th>
                            <th className="p-2 text-left border-r">体裁</th>
                            <th className="p-2 text-left border-r">团队</th>
                            <th className="p-2 text-right border-r">消耗</th>
                            <th className="p-2 text-right border-r">激活数</th>
                            <th className="p-2 text-right border-r">当日激活成本</th>
                            <th className="p-2 text-right border-r">昨日消耗</th>
                            <th className="p-2 text-right border-r">昨日成本</th>
                            <th className="p-2 text-right border-r">昨日实时次留</th>
                            <th className="p-2 text-right border-r">历史七日消耗</th>
                            <th className="p-2 text-right border-r">七日留存成本</th>
                            <th className="p-2 text-right border-r">历史七日次留</th>
                            <th className="p-2 text-right">历史七日7留</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tagGroupData.map((account, index) => (
                            <tr
                              key={`tag-group-${account.account_id}-${index}`}
                              className="border-b hover:bg-muted/30"
                            >
                              <td className="p-2 border-r">{account.project}</td>
                              <td className="p-2 border-r"></td>
                              <td className="p-2 border-r">{account.genre}</td>
                              <td className="p-2 border-r">
                                {account.team || account.business_name || ''}
                              </td>
                              <td className="p-2 text-right border-r">{account.cost.toFixed(2)}</td>
                              <td className="p-2 text-right border-r">{account.activated_count}</td>
                              <td className="p-2 text-right border-r">
                                {account.activated_cost.toFixed(2)}
                              </td>
                              <td className="p-2 text-right border-r">
                                {account.yesterday_cost.toFixed(2)}
                              </td>
                              <td className="p-2 text-right border-r">
                                {account.yesterday_activated_cost.toFixed(2)}
                              </td>
                              <td className="p-2 text-right border-r">
                                {account.yesterday_retention_rate || '0.00%'}
                              </td>
                              <td className="p-2 text-right border-r">
                                {account.history_7d_cost.toFixed(2)}
                              </td>
                              <td className="p-2 text-right border-r">
                                {account.history_7d_activated_cost.toFixed(2)}
                              </td>
                              <td className="p-2 text-right border-r">
                                {account.history_7d_retention_rate || '0.00%'}
                              </td>
                              <td className="p-2 text-right">
                                {account.history_7d_app_retention_d7_rate || '0.00%'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 显示汇总数据（在最后，合并所有标签组） */}
                {useOperatorDimension
                  ? // 投手维度：按投手分组显示汇总数据
                    Object.entries(totalSummaryData).map(([operatorName, accounts]) => {
                      // 计算总消耗
                      const totalCost = accounts.reduce((sum, acc) => sum + acc.cost, 0)

                      return (
                        <div key={operatorName} className="mt-8 pt-6 border-t-2">
                          <h3 className="text-lg font-semibold mb-3">{operatorName} - 汇总数据</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                              <thead>
                                <tr className="border-b bg-muted/50">
                                  <th className="p-2 text-left border-r">项目</th>
                                  <th className="p-2 text-left border-r">体裁</th>
                                  <th className="p-2 text-left border-r">投手</th>
                                  <th className="p-2 text-left border-r">团队</th>
                                  <th className="p-2 text-right border-r">消耗</th>
                                  <th className="p-2 text-right border-r">激活数</th>
                                  <th className="p-2 text-right border-r">当日激活成本</th>
                                  <th className="p-2 text-right border-r">昨日消耗</th>
                                  <th className="p-2 text-right border-r">昨日成本</th>
                                  <th className="p-2 text-right border-r">昨日实时次留</th>
                                  <th className="p-2 text-right border-r">历史七日消耗</th>
                                  <th className="p-2 text-right border-r">七日留存成本</th>
                                  <th className="p-2 text-right border-r">历史七日次留</th>
                                  <th className="p-2 text-right">历史七日7留</th>
                                </tr>
                              </thead>
                              <tbody>
                                {accounts.map((account, index) => (
                                  <tr
                                    key={`total-${operatorName}-${account.account_id}-${index}`}
                                    className="border-b border-t-2 font-semibold bg-muted/50"
                                  >
                                    <td className="p-2 border-r">{account.project}</td>
                                    <td className="p-2 border-r">{account.genre}</td>
                                    <td className="p-2 border-r">
                                      {account.operator || operatorName}
                                    </td>
                                    <td className="p-2 border-r">
                                      {account.team || account.business_name || ''}
                                    </td>
                                    <td className="p-2 text-right border-r">
                                      {account.cost.toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right border-r">
                                      {account.activated_count}
                                    </td>
                                    <td className="p-2 text-right border-r">
                                      {account.activated_cost.toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right border-r">
                                      {account.yesterday_cost.toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right border-r">
                                      {account.yesterday_activated_cost.toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right border-r">
                                      {account.yesterday_retention_rate || '0.00%'}
                                    </td>
                                    <td className="p-2 text-right border-r">
                                      {account.history_7d_cost.toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right border-r">
                                      {account.history_7d_activated_cost.toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right border-r">
                                      {account.history_7d_retention_rate || '0.00%'}
                                    </td>
                                    <td className="p-2 text-right">
                                      {account.history_7d_app_retention_d7_rate || '0.00%'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })
                  : // 非投手维度：原有逻辑
                    totalSummaryData['__all__'] &&
                    totalSummaryData['__all__'].length > 0 && (
                      <div className="mt-8 pt-6 border-t-2">
                        <h3 className="text-lg font-semibold mb-3">汇总数据</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="p-2 text-left border-r">项目</th>
                                <th className="p-2 text-left border-r">体裁</th>
                                <th className="p-2 text-left border-r">团队</th>
                                <th className="p-2 text-right border-r">消耗</th>
                                <th className="p-2 text-right border-r">激活数</th>
                                <th className="p-2 text-right border-r">当日激活成本</th>
                                <th className="p-2 text-right border-r">昨日消耗</th>
                                <th className="p-2 text-right border-r">昨日成本</th>
                                <th className="p-2 text-right border-r">昨日实时次留</th>
                                <th className="p-2 text-right border-r">历史七日消耗</th>
                                <th className="p-2 text-right border-r">七日留存成本</th>
                                <th className="p-2 text-right border-r">历史七日次留</th>
                                <th className="p-2 text-right">历史七日7留</th>
                              </tr>
                            </thead>
                            <tbody>
                              {totalSummaryData['__all__'].map((account, index) => (
                                <tr
                                  key={`total-${account.account_id}-${index}`}
                                  className="border-b border-t-2 font-semibold bg-muted/50"
                                >
                                  <td className="p-2 border-r">{account.project}</td>
                                  <td className="p-2 border-r">{account.genre}</td>
                                  <td className="p-2 border-r">
                                    {account.team || account.business_name || ''}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.cost.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.activated_count}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.activated_cost.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.yesterday_cost.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.yesterday_activated_cost.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.yesterday_retention_rate || '0.00%'}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.history_7d_cost.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.history_7d_activated_cost.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right border-r">
                                    {account.history_7d_retention_rate || '0.00%'}
                                  </td>
                                  <td className="p-2 text-right">
                                    {account.history_7d_app_retention_d7_rate || '0.00%'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatisticsDialogOpen(false)}>
              关闭
            </Button>
            <Button
              onClick={generateImage}
              variant="outline"
              size="sm"
              disabled={isGeneratingImage || !rawStatisticsData}
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
            <Button onClick={sendToFeishuSheet} disabled={isSendingToFeishu}>
              {isSendingToFeishu ? (
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
                  link.download = `腾讯广告数据统计_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.png`
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
    </div>
  )
}
