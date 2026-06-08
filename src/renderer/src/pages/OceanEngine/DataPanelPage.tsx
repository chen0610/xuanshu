import React, { useState, useEffect } from 'react'
import {
  Activity,
  CalendarRange,
  Database,
  Loader2,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns,
  PanelTop,
  Wallet
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '../../components/ui'
import {
  dataPanelService,
  type DataPanelRequest,
  type DataPanelResponse
} from '../../services/ocean-engine.service'
import { configService } from '../../services/config.service'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

type TabType = 'accounts' | 'projects' | 'promotions'

export const DataPanelPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('accounts')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [totalMetrics, setTotalMetrics] = useState<Record<string, any>>({})
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, hasMore: false })
  const [pageSize, setPageSize] = useState<number>(10)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [jumpToPage, setJumpToPage] = useState<string>('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [orderField, setOrderField] = useState<string>('')
  const [orderType, setOrderType] = useState<number>(1)
  // 自定义列功能：手动定义每个 tab 的可用列
  const availableColumns: Record<TabType, string[]> = {
    accounts: [
      'advertiser_name',
      'advertiser_id',
      'advertiser_remark',
      'advertiser_balance',
      'advertiser_status_name',
      'account_tag',
      'stat_cost',
      'show_cnt',
      'convert_cnt',
      'active_cost',
      'conversion_cost'
    ],
    projects: [
      'project_name',
      'project_id',
      'project_status_name',
      'advertiser_name',
      'stat_cost',
      'show_cnt',
      'convert_cnt',
      'conversion_cost',
      'conversion_rate'
    ],
    promotions: [
      'promotion_name',
      'promotion_id',
      'promotion_status_name',
      'project_name',
      'advertiser_name',
      'stat_cost',
      'show_cnt',
      'convert_cnt',
      'conversion_cost',
      'active_cost'
    ]
  }
  // 默认选中的列
  const [selectedColumns, setSelectedColumns] = useState<Record<TabType, Set<string>>>({
    accounts: new Set([
      'advertiser_name',
      'advertiser_remark',
      'stat_cost',
      'convert_cnt',
      'active_cost',
      'conversion_cost'
    ]),
    projects: new Set([
      'project_name',
      'project_status_name',
      'advertiser_name',
      'stat_cost',
      'convert_cnt',
      'conversion_cost',
      'conversion_rate'
    ]),
    promotions: new Set([
      'promotion_name',
      'promotion_status_name',
      'project_name',
      'advertiser_name',
      'stat_cost',
      'convert_cnt',
      'conversion_cost',
      'active_cost'
    ])
  })

  useEffect(() => {
    loadConfigs()
    // 设置默认日期为今天
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const formatDate = (date: Date): string => {
      return Math.floor(date.getTime() / 1000).toString()
    }

    setStartDate(formatDate(yesterday))
    setEndDate(formatDate(today))
  }, [])

  const loadConfigs = async (): Promise<void> => {
    try {
      const oceanConfigs = await configService.getConfigsBySource(1)
      setConfigs(oceanConfigs)
      if (oceanConfigs.length > 0 && !selectedConfigId) {
        setSelectedConfigId(oceanConfigs[0].id)
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
    }
  }

  const fetchData = async (page: number = 1, limit: number = pageSize): Promise<void> => {
    if (!selectedConfigId || !startDate || !endDate) {
      return
    }

    setLoading(true)
    try {
      const requestData: DataPanelRequest = {
        config_id: selectedConfigId,
        start_time: startDate,
        end_time: endDate,
        offset: page,
        limit: limit,
        order_field: orderField || undefined,
        order_type: orderType
      }

      let response: DataPanelResponse
      if (activeTab === 'accounts') {
        response = await dataPanelService.getAccountList(requestData)
      } else if (activeTab === 'projects') {
        response = await dataPanelService.getProjectList(requestData)
      } else {
        response = await dataPanelService.getPromotionList(requestData)
      }

      if (response.code === 0 && response.data) {
        setData(response.data.data_list || [])
        setTotalMetrics(response.data.total_metrics || {})
        const paginationData = response.data.pagination || {
          page: 1,
          limit: limit,
          total: 0,
          hasMore: false
        }
        setPagination(paginationData)
        setCurrentPage(paginationData.page || page)
      }
    } catch (err: any) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedConfigId && startDate && endDate) {
      setCurrentPage(1)
      fetchData(1, pageSize)
    }
  }, [activeTab, selectedConfigId, startDate, endDate, orderField, orderType])

  useEffect(() => {
    if (selectedConfigId && startDate && endDate && pageSize) {
      setCurrentPage(1)
      fetchData(1, pageSize)
    }
  }, [pageSize])

  const handleSearch = (): void => {
    setCurrentPage(1)
    fetchData(1, pageSize)
  }

  const handlePageChange = (page: number): void => {
    if (page >= 1 && page <= Math.ceil(pagination.total / pageSize)) {
      setCurrentPage(page)
      fetchData(page, pageSize)
    }
  }

  const handlePageSizeChange = (newSize: number): void => {
    setPageSize(newSize)
    setCurrentPage(1)
  }

  const handleJumpToPage = (): void => {
    const page = parseInt(jumpToPage)
    if (!isNaN(page) && page >= 1 && page <= Math.ceil(pagination.total / pageSize)) {
      handlePageChange(page)
      setJumpToPage('')
    }
  }

  const renderPagination = (): React.ReactElement | null => {
    const totalPages = Math.ceil(pagination.total / pageSize) || 1
    const currentPageNum = currentPage

    if (pagination.total === 0) {
      return null
    }

    const pages: (number | string)[] = []

    if (totalPages <= 7) {
      // 如果总页数少于等于7页，显示所有页码
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // 总是显示第一页
      pages.push(1)

      if (currentPageNum <= 4) {
        // 当前页在前4页
        for (let i = 2; i <= 5; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPageNum >= totalPages - 3) {
        // 当前页在后4页
        pages.push('...')
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // 当前页在中间
        pages.push('...')
        for (let i = currentPageNum - 1; i <= currentPageNum + 1; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      }
    }

    return (
      <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-xs text-muted-foreground">共 {pagination.total} 条记录</div>

        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => handlePageChange(currentPageNum - 1)}
            disabled={currentPageNum <= 1 || loading}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          {pages.map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className="px-2 text-xs text-muted-foreground">
                  ...
                </span>
              )
            }
            const pageNum = page as number
            return (
              <Button
                key={pageNum}
                variant={currentPageNum === pageNum ? 'default' : 'outline'}
                size="sm"
                className="h-8 min-w-8 px-2 text-xs"
                onClick={() => handlePageChange(pageNum)}
                disabled={loading}
              >
                {pageNum}
              </Button>
            )
          })}

          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => handlePageChange(currentPageNum + 1)}
            disabled={currentPageNum >= totalPages || loading}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="h-8 rounded-xl border border-border/70 bg-card px-3 text-xs text-foreground"
            disabled={loading}
          >
            <option value={10}>10条/页</option>
            <option value={20}>20条/页</option>
            <option value={50}>50条/页</option>
            <option value={100}>100条/页</option>
          </select>

          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">跳转</span>
            <Input
              type="number"
              value={jumpToPage}
              onChange={(e) => setJumpToPage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJumpToPage()}
              placeholder="页码"
              className="h-8 w-16 text-xs"
              min={1}
              max={totalPages}
              disabled={loading}
            />
            <Button
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={handleJumpToPage}
              disabled={loading}
            >
              跳转
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const handleSort = (field: string): void => {
    if (orderField === field) {
      setOrderType(orderType === 1 ? 0 : 1)
    } else {
      setOrderField(field)
      setOrderType(1)
    }
  }

  const formatNumber = (value: any): string => {
    if (value === null || value === undefined || value === '') return '--'
    const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value
    if (isNaN(num)) return String(value)
    return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatPercent = (value: any): string => {
    if (value === null || value === undefined || value === '') return '--'
    const str = String(value)
    if (str.includes('%')) return str
    const num = parseFloat(str.replace(/,/g, ''))
    if (isNaN(num)) return str
    return `${num.toFixed(2)}%`
  }

  // 切换列的显示/隐藏
  const toggleColumn = (tab: TabType, columnKey: string): void => {
    setSelectedColumns((prev) => {
      const newSet = new Set(prev[tab])
      if (newSet.has(columnKey)) {
        newSet.delete(columnKey)
      } else {
        newSet.add(columnKey)
      }
      return {
        ...prev,
        [tab]: newSet
      }
    })
  }

  // 获取列的显示名称（用于列选择器）
  const getColumnLabel = (key: string): string => {
    const labelMap: Record<string, string> = {
      advertiser_name: '账户名称',
      advertiser_id: '账户ID',
      advertiser_remark: '备注',
      advertiser_balance: '账户余额',
      advertiser_status_name: '账户状态',
      account_tag: '账户标签',
      stat_cost: '消耗(元)',
      show_cnt: '展示数',
      convert_cnt: '转化数',
      active_cost: '激活成本(元)',
      conversion_cost: '平均转化成本',
      project_name: '项目名称',
      project_id: '项目ID',
      project_status_name: '项目状态',
      conversion_rate: '转化率',
      promotion_name: '广告名称',
      promotion_id: '广告ID',
      promotion_status_name: '广告状态',
      active: '激活数',
      attribution_next_day_open_cnt: '次留数',
      attribution_next_day_open_rate: '次留率',
      attribution_retention_7d_rate: '7留率',
      attribution_retention_7d_cnt: '7留数'
    }
    return labelMap[key] || key
  }

  // 渲染列选择器
  const renderColumnSelector = (): React.ReactElement => {
    const columns = availableColumns[activeTab]
    const selected = selectedColumns[activeTab]

    if (columns.length === 0) {
      return <></>
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs">
            <Columns className="mr-1 w-3 h-3" />
            自定义列
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="overflow-y-auto w-56 max-h-96">
          <DropdownMenuLabel>选择显示的列</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {columns.map((columnKey) => (
            <DropdownMenuCheckboxItem
              key={columnKey}
              checked={selected.has(columnKey)}
              onCheckedChange={() => toggleColumn(activeTab, columnKey)}
            >
              {getColumnLabel(columnKey)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // 渲染单元格内容
  const renderCellContent = (item: any, key: string): React.ReactNode => {
    const value = item[key]

    // 特殊处理某些字段
    if (key === 'advertiser_name' || key === 'project_name' || key === 'promotion_name') {
      const idKey = key.replace('_name', '_id')
      return (
        <div>
          <div className="text-xs font-medium">{value || '--'}</div>
          <div className="text-xs text-muted-foreground">ID: {item[idKey] || '--'}</div>
        </div>
      )
    }

    if (key === 'account_tag' && Array.isArray(value)) {
      return <span className="text-xs">{value.length}个标签</span>
    }

    if (
      key === 'advertiser_status_name' ||
      key === 'project_status_name' ||
      key === 'promotion_status_name'
    ) {
      return (
        <div className="flex gap-1 items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
          <span className="text-xs">{value || '--'}</span>
        </div>
      )
    }

    // 数字字段格式化
    if (
      [
        'stat_cost',
        'show_cnt',
        'convert_cnt',
        'active_cost',
        'conversion_cost',
        'advertiser_balance'
      ].includes(key)
    ) {
      return <span className="text-xs whitespace-nowrap">{formatNumber(value)}</span>
    }

    if (key === 'conversion_rate') {
      return <span className="text-xs whitespace-nowrap">{formatPercent(value)}</span>
    }

    // 默认显示
    return <span className="text-xs whitespace-nowrap">{value ?? '--'}</span>
  }

  const renderAccountTable = (): React.ReactElement => {
    const selectedCols = Array.from(selectedColumns.accounts)
    const sortableFields = [
      'stat_cost',
      'show_cnt',
      'convert_cnt',
      'active_cost',
      'conversion_cost',
      'advertiser_balance'
    ]

    // 如果没有选中的列，显示提示
    if (selectedCols.length === 0) {
      return <div className="py-8 text-center text-muted-foreground">请至少选择一列进行显示</div>
    }

    return (
      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40">
              {selectedCols.map((key) => {
                const isSortable = sortableFields.includes(key)
                return (
                  <th
                    key={key}
                    className={`px-4 py-3 text-left whitespace-nowrap text-xs font-medium text-muted-foreground ${
                      isSortable ? 'cursor-pointer hover:bg-muted/50' : ''
                    }`}
                    onClick={() => isSortable && handleSort(key)}
                  >
                    <div className="flex gap-1 items-center">
                      <span className="text-xs">{getColumnLabel(key)}</span>
                      {isSortable && <ArrowUpDown className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="border-b border-border/60 hover:bg-accent/30">
                {selectedCols.map((key) => {
                  const isNumeric = [
                    'stat_cost',
                    'show_cnt',
                    'convert_cnt',
                    'active_cost',
                    'conversion_cost',
                    'advertiser_balance',
                    'conversion_rate'
                  ].includes(key)
                  return (
                    <td
                      key={key}
                      className={`px-4 py-3 align-top ${isNumeric ? 'text-right' : ''}`}
                    >
                      {renderCellContent(item, key)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderProjectTable = (): React.ReactElement => {
    const selectedCols = Array.from(selectedColumns.projects)
    const sortableFields = [
      'stat_cost',
      'show_cnt',
      'convert_cnt',
      'conversion_cost',
      'conversion_rate'
    ]

    if (selectedCols.length === 0) {
      return <div className="py-8 text-center text-muted-foreground">请至少选择一列进行显示</div>
    }

    return (
      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40">
              {selectedCols.map((key) => {
                const isSortable = sortableFields.includes(key)
                return (
                  <th
                    key={key}
                    className={`px-4 py-3 text-left whitespace-nowrap text-xs font-medium text-muted-foreground ${
                      isSortable ? 'cursor-pointer hover:bg-muted/50' : ''
                    }`}
                    onClick={() => isSortable && handleSort(key)}
                  >
                    <div className="flex gap-1 items-center">
                      <span className="text-xs">{getColumnLabel(key)}</span>
                      {isSortable && <ArrowUpDown className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="border-b border-border/60 hover:bg-accent/30">
                {selectedCols.map((key) => {
                  const isNumeric = [
                    'stat_cost',
                    'show_cnt',
                    'convert_cnt',
                    'conversion_cost',
                    'conversion_rate'
                  ].includes(key)
                  return (
                    <td
                      key={key}
                      className={`px-4 py-3 align-top ${isNumeric ? 'text-right' : ''}`}
                    >
                      {renderCellContent(item, key)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderPromotionTable = (): React.ReactElement => {
    const selectedCols = Array.from(selectedColumns.promotions)
    const sortableFields = [
      'stat_cost',
      'show_cnt',
      'convert_cnt',
      'conversion_cost',
      'active_cost'
    ]

    if (selectedCols.length === 0) {
      return <div className="py-8 text-center text-muted-foreground">请至少选择一列进行显示</div>
    }

    return (
      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40">
              {selectedCols.map((key) => {
                const isSortable = sortableFields.includes(key)
                return (
                  <th
                    key={key}
                    className={`px-4 py-3 text-left whitespace-nowrap text-xs font-medium text-muted-foreground ${
                      isSortable ? 'cursor-pointer hover:bg-muted/50' : ''
                    }`}
                    onClick={() => isSortable && handleSort(key)}
                  >
                    <div className="flex gap-1 items-center">
                      <span className="text-xs">{getColumnLabel(key)}</span>
                      {isSortable && <ArrowUpDown className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="border-b border-border/60 hover:bg-accent/30">
                {selectedCols.map((key) => {
                  const isNumeric = [
                    'stat_cost',
                    'show_cnt',
                    'convert_cnt',
                    'conversion_cost',
                    'active_cost'
                  ].includes(key)
                  return (
                    <td
                      key={key}
                      className={`px-4 py-3 align-top ${isNumeric ? 'text-right' : ''}`}
                    >
                      {renderCellContent(item, key)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                <PanelTop className="h-3.5 w-3.5 text-primary" />
                Ocean Engine Data Panel
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl sm:text-3xl">数据面板</CardTitle>
                <p className="text-sm leading-7 text-muted-foreground">
                  统一查看账户、项目和广告三个层级的数据明细，并在同一处完成筛选、排序和分页操作。
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-4 py-2 text-sm text-muted-foreground">
              <Database className="h-4 w-4 text-primary" />
              当前配置数 {configs.length}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">当前层级</span>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-2xl capitalize">
              {activeTab === 'accounts' ? '账户' : activeTab === 'projects' ? '项目' : '广告'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">记录总数</span>
              <Database className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-2xl">{pagination.total || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">总消耗</span>
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-2xl">{formatNumber(totalMetrics.stat_cost ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-4 border-b border-border/70">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">账户配置</span>
              {configs.map((config) => (
                <Button
                  key={config.id}
                  variant={selectedConfigId === config.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedConfigId(config.id)}
                  className="text-xs"
                >
                  {config.cookie_name}
                </Button>
              ))}
            </div>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
              <TabsList className="h-11 rounded-2xl border border-border/70 bg-background/70 p-1">
                <TabsTrigger value="accounts" className="rounded-xl px-4 text-sm">
                  账户
                </TabsTrigger>
                <TabsTrigger value="projects" className="rounded-xl px-4 text-sm">
                  项目
                </TabsTrigger>
                <TabsTrigger value="promotions" className="rounded-xl px-4 text-sm">
                  广告
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto]">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CalendarRange className="h-4 w-4" />
                  开始日期
                </div>
                <Input
                  type="date"
                  value={
                    startDate
                      ? new Date(parseInt(startDate) * 1000).toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) => {
                    const timestamp = Math.floor(
                      new Date(e.target.value).getTime() / 1000
                    ).toString()
                    setStartDate(timestamp)
                  }}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CalendarRange className="h-4 w-4" />
                  结束日期
                </div>
                <Input
                  type="date"
                  value={
                    endDate ? new Date(parseInt(endDate) * 1000).toISOString().split('T')[0] : ''
                  }
                  onChange={(e) => {
                    const timestamp = Math.floor(
                      new Date(e.target.value).getTime() / 1000
                    ).toString()
                    setEndDate(timestamp)
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="请输入名称、ID、备注"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch}>
                <Search className="h-4 w-4" />
                搜索
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              {renderColumnSelector()}
              <Button variant="outline">
                <Filter className="h-4 w-4" />
                筛选
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                总消耗
              </p>
              <p className="mt-2 text-lg font-semibold">
                {formatNumber(totalMetrics.stat_cost ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                展示数
              </p>
              <p className="mt-2 text-lg font-semibold">
                {formatNumber(totalMetrics.show_cnt ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                转化数
              </p>
              <p className="mt-2 text-lg font-semibold">
                {formatNumber(totalMetrics.convert_cnt ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                平均成本
              </p>
              <p className="mt-2 text-lg font-semibold">
                {formatNumber(totalMetrics.conversion_cost ?? totalMetrics.active_cost ?? 0)}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-border/70 bg-background/60">
            {activeTab === 'accounts' && (
              <>
                {loading ? (
                  <div className="flex items-center justify-center py-14">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
                  </div>
                ) : data.length === 0 ? (
                  <div className="py-14 text-center text-sm text-muted-foreground">暂无数据</div>
                ) : (
                  <>
                    {renderAccountTable()}
                    {renderPagination()}
                  </>
                )}
              </>
            )}

            {activeTab === 'projects' && (
              <>
                {loading ? (
                  <div className="flex items-center justify-center py-14">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
                  </div>
                ) : data.length === 0 ? (
                  <div className="py-14 text-center text-sm text-muted-foreground">暂无数据</div>
                ) : (
                  <>
                    {renderProjectTable()}
                    {renderPagination()}
                  </>
                )}
              </>
            )}

            {activeTab === 'promotions' && (
              <>
                {loading ? (
                  <div className="flex items-center justify-center py-14">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
                  </div>
                ) : data.length === 0 ? (
                  <div className="py-14 text-center text-sm text-muted-foreground">暂无数据</div>
                ) : (
                  <>
                    {renderPromotionTable()}
                    {renderPagination()}
                  </>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
