import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Loader2, PieChart, Users } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  RadioGroup,
  RadioGroupItem,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea
} from '../../components/ui'
import { configService } from '../../services/config.service'
import { dataAssistantConfigService } from '../../services/ocean-engine.service'
import { displayPromotionService } from '../../services/tencent-ads.service'
import { toast } from 'sonner'

type Condition = {
  id: string
  metric: string
  operator: string
  value1: string
  value2: string
}

type TabState = {
  accountsText: string
  dimension: string
  dateRange: {
    start_date: string
    end_date: string
  }
  conditions: Condition[]
  accountGroups: AccountGroup[]
  selectedGroupIds: string[]
}

const adTabs = [
  { value: 'display', label: '展示广告' },
  { value: 'smart', label: '智能投放' },
  { value: 'search', label: '搜索广告' }
]

const metricOptions = [
  { value: 'cost', label: '花费' },
  { value: 'app_cpa', label: 'APP激活成本' },
  { value: 'activated_count', label: 'APP激活数' }
]

const operatorOptions = [
  { value: 'gte', label: '大于等于' },
  { value: 'lte', label: '小于等于' },
  { value: 'between', label: '介于' }
]

const createDefaultCondition = (): Condition => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  metric: 'cost',
  operator: 'gte',
  value1: '',
  value2: ''
})

type AccountGroup = {
  id: string
  name: string
  accountsText: string
}

type DataControlGroupConfig = {
  groups: AccountGroup[]
  selectedGroupIds: string[]
}

const createDefaultTabState = (): TabState => ({
  accountsText: '',
  dimension: 'ad',
  dateRange: {
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  },
  conditions: [createDefaultCondition()],
  accountGroups: [],
  selectedGroupIds: []
})
interface Config {
  id: number
  cookie_name: string
  realname?: string
}

interface DisplayPromotionRow {
  account_id: number | string
  adgroup_id?: number | string
  adgroup_name?: string
  dynamic_creative_id?: number | string
  dynamic_creative_name?: string
  configured_status?: string
  cost?: number
  activated_cost?: number
  activated_count?: number
}

interface PageInfo {
  page: number
  page_size: number
  total_number: number
  total_page: number
}

export const TencentAdsDataControlPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [loadingConfigs, setLoadingConfigs] = useState(false)
  const [activeAdTab, setActiveAdTab] = useState('display')
  const disabledTabs = new Set(['smart', 'search'])
  const [tabStates, setTabStates] = useState<Record<string, TabState>>(() => ({
    display: { ...createDefaultTabState(), dimension: 'ad' },
    smart: { ...createDefaultTabState(), dimension: 'project' },
    search: { ...createDefaultTabState(), dimension: 'ad' }
  }))
  const [displayRows, setDisplayRows] = useState<DisplayPromotionRow[]>([])
  const [displayAllRows, setDisplayAllRows] = useState<DisplayPromotionRow[]>([])
  const [displayPageInfo, setDisplayPageInfo] = useState<PageInfo | null>(null)
  const [displayPage, setDisplayPage] = useState(1)
  const [displayPageSize, setDisplayPageSize] = useState(100)
  const [displayLoading, setDisplayLoading] = useState(false)
  const [displayBatchLoading, setDisplayBatchLoading] = useState<'enable' | 'pause' | null>(null)
  const [selectedDisplayKeys, setSelectedDisplayKeys] = useState<Set<string>>(new Set())
  useEffect(() => {
    loadConfigs()
  }, [])
  useEffect(() => {
    if (selectedConfigId) {
      loadDataControlGroups(selectedConfigId)
    }
  }, [selectedConfigId])
  useEffect(() => {
    setSelectedDisplayKeys(new Set())
    setDisplayRows([])
    setDisplayAllRows([])
    setDisplayPageInfo(null)
  }, [tabStates.display.dimension])

  const loadConfigs = async (): Promise<void> => {
    setLoadingConfigs(true)
    try {
      const tencentConfigs = await configService.getConfigsBySource(2)
      setConfigs(tencentConfigs)
      if (tencentConfigs.length > 0 && !selectedConfigId) {
        setSelectedConfigId(tencentConfigs[0].id)
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
    } finally {
      setLoadingConfigs(false)
    }
  }

  const updateTabState = (tabValue: string, next: Partial<TabState>): void => {
    setTabStates((prev) => ({
      ...prev,
      [tabValue]: { ...prev[tabValue], ...next }
    }))
  }

  const parseAccountIds = (text: string): string[] => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }

  const normalizeDataControlGroups = (raw: any): Record<string, DataControlGroupConfig> => {
    if (!raw || typeof raw !== 'object') return {}
    const normalized: Record<string, DataControlGroupConfig> = {}
    Object.keys(raw).forEach((key) => {
      const value = raw[key] || {}
      const groups = Array.isArray(value.groups) ? value.groups : []
      const selectedGroupIds = Array.isArray(value.selected_group_ids || value.selectedGroupIds)
        ? value.selected_group_ids || value.selectedGroupIds
        : []
      normalized[key] = {
        groups: groups.map((group: any) => ({
          id: String(group.id || ''),
          name: String(group.name || '未命名分组'),
          accountsText: String(group.accountsText || group.accounts_text || '')
        })),
        selectedGroupIds: selectedGroupIds.map((id: any) => String(id))
      }
    })
    return normalized
  }

  const loadDataControlGroups = async (configId: number): Promise<void> => {
    try {
      const config = await dataAssistantConfigService.getConfig(configId)
      const groupConfig = normalizeDataControlGroups(config.data_control_groups)
      setTabStates((prev) => ({
        ...prev,
        display: {
          ...prev.display,
          accountGroups: groupConfig.display?.groups ?? prev.display.accountGroups,
          selectedGroupIds: groupConfig.display?.selectedGroupIds ?? []
        },
        smart: {
          ...prev.smart,
          accountGroups: groupConfig.smart?.groups ?? prev.smart.accountGroups,
          selectedGroupIds: groupConfig.smart?.selectedGroupIds ?? []
        },
        search: {
          ...prev.search,
          accountGroups: groupConfig.search?.groups ?? prev.search.accountGroups,
          selectedGroupIds: groupConfig.search?.selectedGroupIds ?? []
        }
      }))
    } catch (err) {
      console.error('Failed to load data control groups:', err)
    }
  }

  const saveDataControlGroups = async (): Promise<void> => {
    if (!selectedConfigId) {
      toast.error('请先选择配置')
      return
    }
    const buildPayload = (tabKey: string): DataControlGroupConfig => {
      const tabState = tabStates[tabKey]
      return {
        groups: tabState.accountGroups.map((group) => ({
          id: group.id,
          name: group.name,
          accountsText: group.accountsText
        })),
        selectedGroupIds: tabState.selectedGroupIds
      }
    }

    try {
      await dataAssistantConfigService.updateConfig(selectedConfigId, {
        data_control_groups: {
          display: {
            groups: buildPayload('display').groups,
            selected_group_ids: buildPayload('display').selectedGroupIds
          },
          smart: {
            groups: buildPayload('smart').groups,
            selected_group_ids: buildPayload('smart').selectedGroupIds
          },
          search: {
            groups: buildPayload('search').groups,
            selected_group_ids: buildPayload('search').selectedGroupIds
          }
        }
      })
      toast.success('分组配置已保存')
    } catch (err: any) {
      toast.error(err.message || '分组配置保存失败')
    }
  }

  const getSelectedGroupAccounts = (tabState: TabState): string[] => {
    const selected = new Set(tabState.selectedGroupIds)
    const accounts = tabState.accountGroups
      .filter((group) => selected.has(group.id))
      .flatMap((group) => parseAccountIds(group.accountsText))
    return Array.from(new Set(accounts))
  }

  const getEffectiveAccountIds = (tabState: TabState): string[] => {
    if (tabState.selectedGroupIds.length > 0) {
      return getSelectedGroupAccounts(tabState)
    }
    return parseAccountIds(tabState.accountsText)
  }

  const fetchDisplayPromotionData = async (pageSize: number): Promise<void> => {
    if (!selectedConfigId) {
      toast.error('请先选择配置')
      return
    }

    const displayState = tabStates.display
    const accountIds = getEffectiveAccountIds(displayState)
    if (accountIds.length === 0) {
      toast.error('请输入账户列表')
      return
    }

    setDisplayLoading(true)
    try {
      const requestPageSize = 100
      const response = await displayPromotionService.getDisplayPromotionData({
        account_ids: accountIds,
        selected_cookie_id: selectedConfigId,
        page: 1,
        page_size: requestPageSize,
        dimension: displayState.dimension === 'creative' ? 'creative' : 'ad',
        date_range: displayState.dateRange,
        filters: displayState.conditions.map((condition) => {
          const metricMap: Record<string, 'cost' | 'activated_cost' | 'activated_count'> = {
            cost: 'cost',
            app_cpa: 'activated_cost',
            activated_count: 'activated_count'
          }
          return {
            metric: metricMap[condition.metric] ?? 'cost',
            operator: condition.operator as 'gte' | 'lte' | 'between',
            value1: condition.value1 ? Number(condition.value1) : null,
            value2: condition.value2 ? Number(condition.value2) : null
          }
        })
      })

      if (response.code === 0 && response.data) {
        const list = response.data.list || []
        setSelectedDisplayKeys(new Set())
        setDisplayAllRows(list)
        setDisplayPageInfo({
          page: 1,
          page_size: pageSize,
          total_number: list.length,
          total_page: Math.max(1, Math.ceil(list.length / pageSize))
        })
        setDisplayPage(1)
        setDisplayRows(list.slice(0, pageSize))
      } else {
        toast.error(response.error || '获取推广数据失败')
      }
    } catch (err: any) {
      toast.error(err.message || '获取推广数据失败')
    } finally {
      setDisplayLoading(false)
    }
  }

  const getDisplayRowKey = (row: DisplayPromotionRow, dimension: string): string => {
    if (dimension === 'creative') {
      return `${row.account_id}-${row.dynamic_creative_id}`
    }
    return `${row.account_id}-${row.adgroup_id}`
  }

  const getDisplaySelectableKeys = (rows: DisplayPromotionRow[], dimension: string): string[] => {
    if (dimension === 'creative') {
      return rows
        .filter((row) => row.dynamic_creative_id !== undefined && row.dynamic_creative_id !== null)
        .map((row) => getDisplayRowKey(row, dimension))
    }
    return rows
      .filter((row) => row.adgroup_id !== undefined && row.adgroup_id !== null)
      .map((row) => getDisplayRowKey(row, dimension))
  }

  const toggleDisplayRow = (key: string, checked: boolean): void => {
    setSelectedDisplayKeys((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(key)
      } else {
        next.delete(key)
      }
      return next
    })
  }

  const toggleDisplayAllRows = (checked: boolean): void => {
    const pageKeys = getDisplaySelectableKeys(displayRows, tabStates.display.dimension)
    setSelectedDisplayKeys((prev) => {
      const next = new Set(prev)
      if (checked) {
        pageKeys.forEach((key) => next.add(key))
      } else {
        pageKeys.forEach((key) => next.delete(key))
      }
      return next
    })
  }

  const handleDisplayBatchStatus = async (action: 'enable' | 'pause'): Promise<void> => {
    if (!selectedConfigId) {
      toast.error('请先选择配置')
      return
    }

    const selectedKeys = Array.from(selectedDisplayKeys)
    if (selectedKeys.length === 0) {
      toast.error('请先选择需要操作的广告')
      return
    }

    const items = displayAllRows
      .filter((row) => selectedDisplayKeys.has(getDisplayRowKey(row, tabStates.display.dimension)))
      .map((row) =>
        tabStates.display.dimension === 'creative'
          ? {
              account_id: Number(row.account_id),
              dynamic_creative_id: Number(row.dynamic_creative_id),
              configured_status: action === 'enable' ? 'AD_STATUS_NORMAL' : 'AD_STATUS_SUSPEND',
              adgroup_type: 'ADGROUP_TYPE_NORMAL'
            }
          : {
              account_id: Number(row.account_id),
              adgroup_id: Number(row.adgroup_id),
              configured_status: action === 'enable' ? 'AD_STATUS_NORMAL' : 'AD_STATUS_SUSPEND',
              adgroup_type: 'ADGROUP_TYPE_NORMAL'
            }
      )

    if (items.length === 0) {
      toast.error('未找到可操作的广告')
      return
    }

    setDisplayBatchLoading(action)
    try {
      const response = await displayPromotionService.batchUpdateStatus({
        selected_cookie_id: selectedConfigId,
        items
      })
      if (response.code === 0) {
        const nextStatus = action === 'enable' ? 'AD_STATUS_NORMAL' : 'AD_STATUS_SUSPEND'
        setDisplayAllRows((prev) =>
          prev.map((row) =>
            selectedDisplayKeys.has(getDisplayRowKey(row, tabStates.display.dimension))
              ? { ...row, configured_status: nextStatus }
              : row
          )
        )
        setDisplayRows((prev) =>
          prev.map((row) =>
            selectedDisplayKeys.has(getDisplayRowKey(row, tabStates.display.dimension))
              ? { ...row, configured_status: nextStatus }
              : row
          )
        )
        setSelectedDisplayKeys(new Set())
        toast.success('操作成功')
      } else {
        toast.error(response.error || '批量操作失败')
      }
    } catch (err: any) {
      toast.error(err.message || '批量操作失败')
    } finally {
      setDisplayBatchLoading(null)
    }
  }

  const handleDisplayConfirm = async (): Promise<void> => {
    setDisplayPage(1)
    await fetchDisplayPromotionData(displayPageSize)
  }

  const handleDisplayPageChange = (page: number): void => {
    if (!displayPageInfo) return
    if (page < 1 || page > displayPageInfo.total_page) return
    setDisplayPage(page)
    const startIndex = (page - 1) * displayPageSize
    const endIndex = startIndex + displayPageSize
    setDisplayRows(displayAllRows.slice(startIndex, endIndex))
  }

  const handleDisplayPageSizeChange = (size: number): void => {
    setDisplayPageSize(size)
    setDisplayPage(1)
    setDisplayRows(displayAllRows.slice(0, size))
    if (displayPageInfo) {
      setDisplayPageInfo({
        ...displayPageInfo,
        page: 1,
        page_size: size,
        total_page: Math.max(1, Math.ceil(displayAllRows.length / size))
      })
    }
  }

  const renderDisplayPagination = (): React.ReactElement | null => {
    if (!displayPageInfo) return null
    const totalPages = displayPageInfo.total_page || 1
    if (totalPages <= 1) return null

    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (displayPage <= 4) {
        for (let i = 2; i <= 5; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      } else if (displayPage >= totalPages - 3) {
        pages.push('...')
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push('...')
        for (let i = displayPage - 1; i <= displayPage + 1; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      }
    }

    return (
      <div className="flex flex-wrap gap-3 justify-between items-center border-t pt-3">
        <div className="text-xs text-muted-foreground">共 {displayPageInfo.total_number} 条</div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="p-0 w-7 h-7"
            onClick={() => handleDisplayPageChange(displayPage - 1)}
            disabled={displayPage <= 1 || displayLoading}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {pages.map((page, index) =>
            page === '...' ? (
              <span key={`ellipsis-${index}`} className="px-2 text-xs text-muted-foreground">
                ...
              </span>
            ) : (
              <Button
                key={page as number}
                variant={displayPage === page ? 'default' : 'outline'}
                size="sm"
                className="px-2 h-7 text-xs min-w-7"
                onClick={() => handleDisplayPageChange(page as number)}
                disabled={displayLoading}
              >
                {page}
              </Button>
            )
          )}
          <Button
            variant="outline"
            size="sm"
            className="p-0 w-7 h-7"
            onClick={() => handleDisplayPageChange(displayPage + 1)}
            disabled={displayPage >= totalPages || displayLoading}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={displayPageSize}
            onChange={(e) => handleDisplayPageSizeChange(Number(e.target.value))}
            className="px-2 h-7 text-xs rounded-md border"
            disabled={displayLoading}
          >
            <option value={10}>10条/页</option>
            <option value={20}>20条/页</option>
            <option value={100}>100条/页</option>
          </select>
        </div>
      </div>
    )
  }

  const updateCondition = (tabValue: string, id: string, next: Partial<Condition>): void => {
    setTabStates((prev) => ({
      ...prev,
      [tabValue]: {
        ...prev[tabValue],
        conditions: prev[tabValue].conditions.map((item) =>
          item.id === id ? { ...item, ...next } : item
        )
      }
    }))
  }

  const addCondition = (tabValue: string): void => {
    setTabStates((prev) => ({
      ...prev,
      [tabValue]: {
        ...prev[tabValue],
        conditions: [...prev[tabValue].conditions, createDefaultCondition()]
      }
    }))
  }

  const removeCondition = (tabValue: string, id: string): void => {
    setTabStates((prev) => ({
      ...prev,
      [tabValue]: {
        ...prev[tabValue],
        conditions: prev[tabValue].conditions.filter((item) => item.id !== id)
      }
    }))
  }

  const createAccountGroup = (tabValue: string): void => {
    const newGroup: AccountGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `分组 ${tabStates[tabValue].accountGroups.length + 1}`,
      accountsText: ''
    }
    setTabStates((prev) => ({
      ...prev,
      [tabValue]: {
        ...prev[tabValue],
        accountGroups: [...prev[tabValue].accountGroups, newGroup]
      }
    }))
  }

  const updateAccountGroup = (
    tabValue: string,
    groupId: string,
    next: Partial<AccountGroup>
  ): void => {
    setTabStates((prev) => ({
      ...prev,
      [tabValue]: {
        ...prev[tabValue],
        accountGroups: prev[tabValue].accountGroups.map((group) =>
          group.id === groupId ? { ...group, ...next } : group
        )
      }
    }))
  }

  const deleteAccountGroup = (tabValue: string, groupId: string): void => {
    setTabStates((prev) => ({
      ...prev,
      [tabValue]: {
        ...prev[tabValue],
        accountGroups: prev[tabValue].accountGroups.filter((group) => group.id !== groupId),
        selectedGroupIds: prev[tabValue].selectedGroupIds.filter((id) => id !== groupId)
      }
    }))
  }

  const toggleGroupSelection = (tabValue: string, groupId: string, checked: boolean): void => {
    setTabStates((prev) => {
      const selectedGroupIds = new Set(prev[tabValue].selectedGroupIds)
      if (checked) {
        selectedGroupIds.add(groupId)
      } else {
        selectedGroupIds.delete(groupId)
      }
      return {
        ...prev,
        [tabValue]: {
          ...prev[tabValue],
          selectedGroupIds: Array.from(selectedGroupIds)
        }
      }
    })
  }

  const clearGroupSelection = (tabValue: string): void => {
    setTabStates((prev) => ({
      ...prev,
      [tabValue]: {
        ...prev[tabValue],
        selectedGroupIds: []
      }
    }))
  }

  const displayPageKeys = getDisplaySelectableKeys(displayRows, tabStates.display.dimension)
  const displayAllSelected =
    displayPageKeys.length > 0 && displayPageKeys.every((key) => selectedDisplayKeys.has(key))
  const displaySomeSelected = displayPageKeys.some((key) => selectedDisplayKeys.has(key))
  const displaySelectionCount = selectedDisplayKeys.size

  return (
    <div className="space-y-6">
      {/* 选择配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            选择配置
          </CardTitle>
          <CardDescription>选择要使用的腾讯助手账号配置</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingConfigs ? (
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
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{config.cookie_name}</div>
                        {config.realname && (
                          <div className="text-xs text-muted-foreground">{config.realname}</div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            数据调控
          </CardTitle>
          <CardDescription>按广告类型配置账户与筛选条件</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs
            value={activeAdTab}
            onValueChange={(value) => {
              if (!disabledTabs.has(value)) {
                setActiveAdTab(value)
              }
            }}
          >
            <TabsList className="w-full">
              {adTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex-1"
                  disabled={disabledTabs.has(tab.value)}
                >
                  {tab.label}
                  {disabledTabs.has(tab.value) && (
                    <span className="ml-1 text-xs text-muted-foreground">(待开发)</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            {adTabs.map((tab) => {
              const tabState = tabStates[tab.value]
              const tabAccountCount = getEffectiveAccountIds(tabState).length

              return (
                <TabsContent key={tab.value} value={tab.value} className="space-y-0">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* 左侧控制面板 */}
                    <div className="lg:col-span-1 space-y-4">
                      <div className="space-y-3 p-4 border rounded-lg bg-card text-card-foreground shadow-sm h-full flex flex-col">
                        <div className="font-medium flex items-center gap-2 border-b pb-2">
                          <Users className="w-4 h-4" />
                          账户设置
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">账户分组</label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              title="新增分组"
                              onClick={() => createAccountGroup(tab.value)}
                            >
                              <span className="text-lg leading-none">+</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              title="保存分组配置"
                              onClick={saveDataControlGroups}
                              disabled={loadingConfigs}
                            >
                              <span className="text-xs">💾</span>
                            </Button>
                          </div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                          {tabState.accountGroups.length === 0 ? (
                            <div className="text-xs text-muted-foreground">
                              暂无分组，请先新增分组
                            </div>
                          ) : (
                            <div className="space-y-3 pr-1">
                              {tabState.accountGroups.map((group) => (
                                <div
                                  key={group.id}
                                  className="border rounded-md p-3 space-y-2 bg-muted/20"
                                >
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={tabState.selectedGroupIds.includes(group.id)}
                                      onCheckedChange={(checked) =>
                                        toggleGroupSelection(tab.value, group.id, checked === true)
                                      }
                                    />
                                    <Input
                                      value={group.name}
                                      onChange={(e) =>
                                        updateAccountGroup(tab.value, group.id, {
                                          name: e.target.value
                                        })
                                      }
                                      className="h-7 text-xs"
                                      placeholder="分组名称"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 shrink-0"
                                      onClick={() => deleteAccountGroup(tab.value, group.id)}
                                    >
                                      <span className="text-xs text-red-500">×</span>
                                    </Button>
                                  </div>
                                  <Textarea
                                    value={group.accountsText}
                                    onChange={(e) =>
                                      updateAccountGroup(tab.value, group.id, {
                                        accountsText: e.target.value
                                      })
                                    }
                                    rows={2}
                                    className="text-xs min-h-[60px]"
                                    placeholder="输入账户ID，一行一个"
                                  />
                                  <div className="text-[10px] text-muted-foreground text-right">
                                    账户数：{parseAccountIds(group.accountsText).length}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {tabState.selectedGroupIds.length > 0 && (
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              已选 {tabState.selectedGroupIds.length} 组 / {tabAccountCount} 户
                            </span>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs"
                              onClick={() => clearGroupSelection(tab.value)}
                            >
                              清空
                            </Button>
                          </div>
                        )}

                        <div className="space-y-2 pt-2 border-t mt-auto">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium">账户列表</label>
                            <span className="text-[10px] text-muted-foreground">
                              共 {tabAccountCount} 个
                            </span>
                          </div>
                          <Textarea
                            value={
                              tabState.selectedGroupIds.length > 0
                                ? getSelectedGroupAccounts(tabState).join('\n')
                                : tabState.accountsText
                            }
                            onChange={(e) =>
                              updateTabState(tab.value, { accountsText: e.target.value })
                            }
                            rows={3}
                            className="text-xs min-h-[80px]"
                            placeholder={
                              tabState.selectedGroupIds.length > 0
                                ? '已启用分组选择'
                                : '请输入账户，每行一个'
                            }
                            disabled={tabState.selectedGroupIds.length > 0}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 右侧数据列表 */}
                    <div className="lg:col-span-3 flex flex-col h-[calc(100vh-240px)] min-h-[500px] space-y-4">
                      {/* 顶部查询面板 */}
                      <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm space-y-4">
                        {/* 顶部行：日期、维度与操作 */}
                        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                          <div className="flex flex-wrap gap-4 items-center">
                            {/* 日期选择 */}
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                                日期
                              </span>
                              <div className="flex items-center gap-2 border rounded-md px-3 py-1.5 bg-background shadow-sm hover:border-primary/50 transition-colors">
                                <Input
                                  type="date"
                                  className="h-auto p-0 border-0 focus-visible:ring-0 w-[110px] text-sm text-center cursor-pointer"
                                  value={tabState.dateRange.start_date}
                                  onChange={(e) =>
                                    updateTabState(tab.value, {
                                      dateRange: {
                                        ...tabState.dateRange,
                                        start_date: e.target.value
                                      }
                                    })
                                  }
                                />
                                <span className="text-muted-foreground">→</span>
                                <Input
                                  type="date"
                                  className="h-auto p-0 border-0 focus-visible:ring-0 w-[110px] text-sm text-center cursor-pointer"
                                  value={tabState.dateRange.end_date}
                                  onChange={(e) =>
                                    updateTabState(tab.value, {
                                      dateRange: {
                                        ...tabState.dateRange,
                                        end_date: e.target.value
                                      }
                                    })
                                  }
                                />
                              </div>
                            </div>

                            {/* 维度选择 */}
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                                维度
                              </span>
                              <div className="bg-muted/30 p-1 rounded-md border flex items-center gap-1">
                                <RadioGroup
                                  value={tabState.dimension}
                                  onValueChange={(value) =>
                                    updateTabState(tab.value, { dimension: value })
                                  }
                                  className="flex gap-1"
                                >
                                  {tab.value === 'display' && (
                                    <>
                                      <label
                                        className={`cursor-pointer px-3 py-1 rounded text-xs transition-all select-none ${
                                          tabState.dimension === 'ad'
                                            ? 'bg-background shadow text-foreground font-medium'
                                            : 'text-muted-foreground hover:bg-muted/50'
                                        }`}
                                      >
                                        <RadioGroupItem value="ad" className="sr-only" />
                                        广告
                                      </label>
                                      <label
                                        className={`cursor-pointer px-3 py-1 rounded text-xs transition-all select-none ${
                                          tabState.dimension === 'creative'
                                            ? 'bg-background shadow text-foreground font-medium'
                                            : 'text-muted-foreground hover:bg-muted/50'
                                        }`}
                                      >
                                        <RadioGroupItem value="creative" className="sr-only" />
                                        创意
                                      </label>
                                    </>
                                  )}
                                  {tab.value === 'smart' && (
                                    <>
                                      <label
                                        className={`cursor-pointer px-3 py-1 rounded text-xs transition-all select-none ${
                                          tabState.dimension === 'project'
                                            ? 'bg-background shadow text-foreground font-medium'
                                            : 'text-muted-foreground hover:bg-muted/50'
                                        }`}
                                      >
                                        <RadioGroupItem value="project" className="sr-only" />
                                        项目
                                      </label>
                                      <label
                                        className={`cursor-pointer px-3 py-1 rounded text-xs transition-all select-none ${
                                          tabState.dimension === 'creative'
                                            ? 'bg-background shadow text-foreground font-medium'
                                            : 'text-muted-foreground hover:bg-muted/50'
                                        }`}
                                      >
                                        <RadioGroupItem value="creative" className="sr-only" />
                                        创意
                                      </label>
                                    </>
                                  )}
                                  {tab.value === 'search' && (
                                    <>
                                      <label
                                        className={`cursor-pointer px-3 py-1 rounded text-xs transition-all select-none ${
                                          tabState.dimension === 'campaign'
                                            ? 'bg-background shadow text-foreground font-medium'
                                            : 'text-muted-foreground hover:bg-muted/50'
                                        }`}
                                      >
                                        <RadioGroupItem value="campaign" className="sr-only" />
                                        计划
                                      </label>
                                      <label
                                        className={`cursor-pointer px-3 py-1 rounded text-xs transition-all select-none ${
                                          tabState.dimension === 'ad'
                                            ? 'bg-background shadow text-foreground font-medium'
                                            : 'text-muted-foreground hover:bg-muted/50'
                                        }`}
                                      >
                                        <RadioGroupItem value="ad" className="sr-only" />
                                        广告
                                      </label>
                                      <label
                                        className={`cursor-pointer px-3 py-1 rounded text-xs transition-all select-none ${
                                          tabState.dimension === 'creative'
                                            ? 'bg-background shadow text-foreground font-medium'
                                            : 'text-muted-foreground hover:bg-muted/50'
                                        }`}
                                      >
                                        <RadioGroupItem value="creative" className="sr-only" />
                                        创意
                                      </label>
                                    </>
                                  )}
                                </RadioGroup>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 w-full lg:w-auto">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 gap-1 hover:border-primary/50 transition-colors"
                              onClick={() => addCondition(tab.value)}
                            >
                              <span className="text-lg leading-none">+</span>
                              <span>条件</span>
                            </Button>
                            <Button
                              type="button"
                              className="h-9 px-6 flex-1 lg:flex-none shadow-sm"
                              onClick={() => {
                                if (tab.value === 'display') {
                                  handleDisplayConfirm()
                                } else {
                                  toast.info('该广告类型暂未接入')
                                }
                              }}
                              disabled={tab.value === 'display' ? displayLoading : false}
                            >
                              {tab.value === 'display' && displayLoading ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  查询中...
                                </>
                              ) : (
                                '查询'
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* 筛选条件列表 */}
                        {tabState.conditions.length > 0 && (
                          <div className="pt-4 border-t grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            {tabState.conditions.map((condition) => (
                              <div
                                key={condition.id}
                                className="group relative flex items-start sm:items-center gap-2 p-2 rounded-lg border bg-muted/10 hover:bg-muted/20 hover:border-primary/30 transition-all shadow-sm min-w-0"
                              >
                                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:flex-wrap gap-2">
                                  <select
                                    className="h-8 px-2 rounded-md border bg-background text-xs focus:ring-1 focus:ring-primary/30 outline-none min-w-[72px] sm:min-w-[80px] shrink-0"
                                    value={condition.metric}
                                    onChange={(e) =>
                                      updateCondition(tab.value, condition.id, {
                                        metric: e.target.value
                                      })
                                    }
                                  >
                                    {metricOptions.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    className="h-8 px-2 rounded-md border bg-background text-xs focus:ring-1 focus:ring-primary/30 outline-none min-w-[72px] sm:min-w-[88px] shrink-0"
                                    value={condition.operator}
                                    onChange={(e) =>
                                      updateCondition(tab.value, condition.id, {
                                        operator: e.target.value,
                                        value2: e.target.value === 'between' ? condition.value2 : ''
                                      })
                                    }
                                  >
                                    {operatorOptions.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Input
                                      type="number"
                                      placeholder="值"
                                      className="h-8 px-3 min-w-[60px] w-20 sm:w-24 text-sm bg-background focus-visible:ring-1 focus-visible:ring-primary/30 shrink-0"
                                      value={condition.value1}
                                      onChange={(e) =>
                                        updateCondition(tab.value, condition.id, {
                                          value1: e.target.value
                                        })
                                      }
                                    />
                                    {condition.operator === 'between' && (
                                      <>
                                        <span className="text-muted-foreground text-sm px-1 shrink-0">
                                          -
                                        </span>
                                        <Input
                                          type="number"
                                          placeholder="值2"
                                          className="h-8 px-3 min-w-[60px] w-20 sm:w-24 text-sm bg-background focus-visible:ring-1 focus-visible:ring-primary/30 shrink-0"
                                          value={condition.value2}
                                          onChange={(e) =>
                                            updateCondition(tab.value, condition.id, {
                                              value2: e.target.value
                                            })
                                          }
                                        />
                                      </>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity absolute -right-2 -top-2 bg-background border shadow-sm shrink-0"
                                  onClick={() => removeCondition(tab.value, condition.id)}
                                >
                                  <span className="text-sm leading-none">×</span>
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {tab.value !== 'display' ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                          <PieChart className="w-12 h-12 mb-4 opacity-20" />
                          <p>该模块暂未接入</p>
                        </div>
                      ) : displayLoading ? (
                        <div className="flex flex-col items-center justify-center flex-1 h-full text-sm text-muted-foreground bg-muted/5 rounded-lg border">
                          <Loader2 className="w-8 h-8 mb-4 animate-spin text-primary/50" />
                          加载数据中...
                        </div>
                      ) : displayRows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center flex-1 h-full text-sm text-muted-foreground bg-muted/5 rounded-lg border border-dashed">
                          <div className="mb-2 text-4xl">📭</div>
                          {displayPageInfo ? '暂无数据' : '请先执行查询'}
                        </div>
                      ) : (
                        <>
                          {/* 顶部工具栏 */}
                          {displaySelectionCount > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border rounded-md bg-accent/20">
                              <div className="text-sm font-medium text-accent-foreground">
                                已选中{' '}
                                <span className="text-primary font-bold">
                                  {displaySelectionCount}
                                </span>{' '}
                                条数据
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleDisplayBatchStatus('enable')}
                                  disabled={displayBatchLoading !== null || displayLoading}
                                  className="shadow-sm"
                                >
                                  {displayBatchLoading === 'enable' ? (
                                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                  ) : (
                                    <span className="mr-2">▶</span>
                                  )}
                                  {displayBatchLoading === 'enable' ? '启用中...' : '批量启用'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleDisplayBatchStatus('pause')}
                                  disabled={displayBatchLoading !== null || displayLoading}
                                  className="shadow-sm bg-background border hover:bg-muted"
                                >
                                  {displayBatchLoading === 'pause' ? (
                                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                  ) : (
                                    <span className="mr-2">⏸</span>
                                  )}
                                  {displayBatchLoading === 'pause' ? '暂停中...' : '批量暂停'}
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* 表格区域 */}
                          <div className="flex-1 overflow-auto border rounded-md bg-background shadow-sm relative">
                            <table className="w-full text-sm relative">
                              <thead className="sticky top-0 z-20 bg-muted/90 backdrop-blur-sm border-b shadow-sm">
                                <tr>
                                  <th className="p-3 w-12 text-center">
                                    <Checkbox
                                      checked={
                                        displayAllSelected
                                          ? true
                                          : displaySomeSelected
                                            ? 'indeterminate'
                                            : false
                                      }
                                      onCheckedChange={(checked) =>
                                        toggleDisplayAllRows(checked === true)
                                      }
                                      disabled={displayLoading}
                                    />
                                  </th>
                                  <th className="p-3 w-16 text-center font-medium text-muted-foreground">
                                    状态
                                  </th>
                                  <th className="p-3 text-left font-medium text-muted-foreground">
                                    账户ID
                                  </th>
                                  <th className="p-3 text-left font-medium text-muted-foreground">
                                    广告ID
                                  </th>
                                  {tabState.dimension === 'ad' ? (
                                    <th className="p-3 text-left font-medium text-muted-foreground">
                                      广告名称
                                    </th>
                                  ) : (
                                    <>
                                      <th className="p-3 text-left font-medium text-muted-foreground">
                                        创意ID
                                      </th>
                                      <th className="p-3 text-left font-medium text-muted-foreground">
                                        创意名称
                                      </th>
                                    </>
                                  )}
                                  <th className="p-3 text-right font-medium text-muted-foreground">
                                    花费
                                  </th>
                                  <th className="p-3 text-right font-medium text-muted-foreground">
                                    激活成本
                                  </th>
                                  <th className="p-3 text-right font-medium text-muted-foreground">
                                    激活数
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {displayRows.map((row, index) => (
                                  <tr
                                    key={`${getDisplayRowKey(row, tabStates.display.dimension)}-${index}`}
                                    className={`transition-colors hover:bg-muted/50 ${
                                      selectedDisplayKeys.has(
                                        getDisplayRowKey(row, tabStates.display.dimension)
                                      )
                                        ? 'bg-accent/10'
                                        : ''
                                    }`}
                                  >
                                    <td className="p-3 text-center">
                                      <Checkbox
                                        checked={selectedDisplayKeys.has(
                                          getDisplayRowKey(row, tabStates.display.dimension)
                                        )}
                                        onCheckedChange={(checked) =>
                                          toggleDisplayRow(
                                            getDisplayRowKey(row, tabStates.display.dimension),
                                            checked === true
                                          )
                                        }
                                        disabled={
                                          displayLoading ||
                                          displayBatchLoading !== null ||
                                          (tabStates.display.dimension === 'creative'
                                            ? row.dynamic_creative_id === undefined ||
                                              row.dynamic_creative_id === null
                                            : row.adgroup_id === undefined ||
                                              row.adgroup_id === null)
                                        }
                                      />
                                    </td>
                                    <td className="p-3 text-center">
                                      <div className="flex justify-center">
                                        <div
                                          className={`w-2 h-2 rounded-full ${
                                            row.configured_status === 'AD_STATUS_NORMAL'
                                              ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]'
                                              : 'bg-muted-foreground/30'
                                          }`}
                                          title={
                                            row.configured_status === 'AD_STATUS_NORMAL'
                                              ? '启用'
                                              : '暂停'
                                          }
                                        />
                                      </div>
                                    </td>
                                    <td className="p-3 font-mono text-xs">{row.account_id}</td>
                                    <td className="p-3 font-mono text-xs">
                                      {row.adgroup_id || '-'}
                                    </td>
                                    {tabState.dimension === 'ad' ? (
                                      <td
                                        className="p-3 max-w-[200px] truncate"
                                        title={row.adgroup_name}
                                      >
                                        {row.adgroup_name || '-'}
                                      </td>
                                    ) : (
                                      <>
                                        <td className="p-3 font-mono text-xs">
                                          {row.dynamic_creative_id || '-'}
                                        </td>
                                        <td
                                          className="p-3 max-w-[200px] truncate"
                                          title={row.dynamic_creative_name}
                                        >
                                          {row.dynamic_creative_name || '-'}
                                        </td>
                                      </>
                                    )}
                                    <td className="p-3 text-right font-medium">{row.cost ?? 0}</td>
                                    <td className="p-3 text-right">{row.activated_cost ?? 0}</td>
                                    <td className="p-3 text-right">{row.activated_count ?? 0}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* 分页 */}
                          <div className="shrink-0 bg-background pt-2">
                            {renderDisplayPagination()}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
