import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Calendar, Building2, Search, Users, Download } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Label
} from '../../components/ui'
import { configService } from '../../services/config.service'
import {
  organizationListService,
  materialStatisticsService
} from '../../services/tencent-ads.service'
import { toast } from 'sonner'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

interface OrganizationItem {
  business_id: number
  business_name: string
}

interface MaterialItem {
  creative_asset_id?: string | number
  creative_asset_name?: string
  cost: number
}

export const MaterialStatisticsPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([])
  const [selectedOrganizations, setSelectedOrganizations] = useState<number[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(false)
  const [organizationKeyword, setOrganizationKeyword] = useState('')
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [loadingData, setLoadingData] = useState(false)
  const [materialList, setMaterialList] = useState<MaterialItem[]>([])
  const [materialTotalCost, setMaterialTotalCost] = useState<number | null>(null)

  useEffect(() => {
    loadConfigs()
  }, [])
  useEffect(() => {
    if (selectedConfigId) {
      setOrganizations([])
      setSelectedOrganizations([])
      setOrganizationKeyword('')
      loadOrganizations()
    }
  }, [selectedConfigId])

  const loadConfigs = async () => {
    setLoading(true)
    try {
      const tencentConfigs = await configService.getConfigsBySource(2)
      setConfigs(tencentConfigs)
      if (tencentConfigs.length > 0 && !selectedConfigId) {
        setSelectedConfigId(tencentConfigs[0].id)
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
      toast.error('加载配置失败')
    } finally {
      setLoading(false)
    }
  }

  const loadOrganizations = async () => {
    if (!selectedConfigId) {
      toast.error('请先选择配置')
      return
    }

    setLoadingOrganizations(true)
    try {
      const result = await organizationListService.getOrganizationList({
        selected_cookie_id: selectedConfigId
      })

      if (result.code === 0 && result.data) {
        setOrganizations(result.data)
        toast.success(`成功加载 ${result.data.length} 个组织`)
      } else {
        toast.error(result.error || '获取组织列表失败')
      }
    } catch (err: any) {
      toast.error(err.message || '获取组织列表失败')
    } finally {
      setLoadingOrganizations(false)
    }
  }

  const toggleOrganization = (businessId: number) => {
    setSelectedOrganizations((prev) => {
      if (prev.includes(businessId)) {
        return prev.filter((id) => id !== businessId)
      } else {
        return [...prev, businessId]
      }
    })
  }

  const normalizedOrgKeyword = organizationKeyword.trim().toLowerCase()
  const filteredOrganizations = normalizedOrgKeyword
    ? organizations.filter((org) => {
        const name = (org.business_name || '').toLowerCase()
        return (
          name.includes(normalizedOrgKeyword) ||
          String(org.business_id).includes(normalizedOrgKeyword)
        )
      })
    : organizations

  const handleFetchData = async () => {
    if (!selectedConfigId) {
      toast.error('请先选择配置')
      return
    }

    if (selectedOrganizations.length === 0) {
      toast.error('请至少选择一个组织')
      return
    }

    if (!startDate || !endDate) {
      toast.error('请选择查询日期区间')
      return
    }

    const start = new Date(`${startDate}T00:00:00`)
    const end = new Date(`${endDate}T00:00:00`)
    if (end < start) {
      toast.error('结束日期不能早于开始日期')
      return
    }
    const diffDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
    if (diffDays > 90) {
      toast.error('查询区间不能超过90天')
      return
    }

    setLoadingData(true)
    setMaterialList([])
    setMaterialTotalCost(null)

    try {
      const result = await materialStatisticsService.getAccountList({
        selected_cookie_id: selectedConfigId,
        start_date: startDate,
        end_date: endDate,
        business_id_list: selectedOrganizations
      })

      if (result.code === 0 && result.data) {
        setMaterialList(result.data.material_list || [])
        setMaterialTotalCost(result.data.material_total_cost ?? null)
        toast.success(`成功获取 ${result.data.total_count} 个账户`)
      } else {
        toast.error(result.error || '获取账户列表失败')
      }
    } catch (err: any) {
      toast.error(err.message || '获取账户列表失败')
    } finally {
      setLoadingData(false)
    }
  }

  const handleExportMaterials = async () => {
    if (materialList.length === 0) {
      toast.error('暂无素材消耗数据可导出')
      return
    }

    const header = ['创意资产ID', '素材名', '消耗'].join(',')
    const rows = materialList.map((item) =>
      [
        item.creative_asset_id ?? '',
        `"${item.creative_asset_name || ''}"`,
        (item.cost ?? 0).toFixed(2)
      ].join(',')
    )

    if (materialTotalCost !== null) {
      rows.push(['总计', '', materialTotalCost.toFixed(2)].join(','))
    }

    const dateRangeText = startDate === endDate ? startDate : `${startDate}_${endDate}`
    const filename = `素材消耗_${dateRangeText}.csv`
    const csvContent = [header, ...rows].join('\n')

    if (window.api?.saveFileAndOpenFolder) {
      try {
        const result = await window.api.saveFileAndOpenFolder(csvContent, filename)
        if (result.success) {
          toast.success('导出成功')
          return
        }
        if (result.canceled) {
          toast.info('已取消保存')
          return
        }
      } catch (error) {
        console.error('Failed to save file:', error)
        toast.error('导出失败，已改用浏览器下载')
      }
    }

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()

    toast.success('导出成功')
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
            <Search className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            素材统计
          </h1>
        </div>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          获取指定组织和日期范围内的账户列表，支持多Cookie分页获取所有数据
        </p>
      </motion.div>

      {/* 配置选择 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            选择配置
          </CardTitle>
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

      {/* 组织选择 */}
      {selectedConfigId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  选择组织
                </CardTitle>
                <CardDescription>选择要查询的组织</CardDescription>
              </div>
              <Button
                onClick={loadOrganizations}
                disabled={loadingOrganizations}
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
          </CardHeader>
          <CardContent>
            {organizations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                点击"加载组织列表"获取组织数据
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  placeholder="输入组织名称或ID进行搜索"
                  value={organizationKeyword}
                  onChange={(e) => setOrganizationKeyword(e.target.value)}
                />
                {filteredOrganizations.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">未找到匹配的组织</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredOrganizations.map((org) => {
                      const isSelected = selectedOrganizations.includes(org.business_id)
                      return (
                        <motion.div
                          key={org.business_id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`p-3 border rounded-md cursor-pointer transition-all ${
                            isSelected
                              ? 'shadow-sm border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50 hover:bg-accent/50'
                          }`}
                          onClick={() => toggleOrganization(org.business_id)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary'
                                  : 'border-muted-foreground/30'
                              }`}
                            >
                              {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {org.business_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ID: {org.business_id}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 查询配置 */}
      {selectedOrganizations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              查询配置
            </CardTitle>
            <CardDescription>设置查询日期区间（最大90天）</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="start-date">开始日期</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">结束日期</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 查询按钮 */}
      {selectedOrganizations.length > 0 && startDate && endDate && (
        <Card>
          <CardContent className="pt-6">
            <Button onClick={handleFetchData} disabled={loadingData} className="w-full" size="lg">
              {loadingData ? (
                <>
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                  查询中...
                </>
              ) : (
                <>
                  <Search className="mr-2 w-5 h-5" />
                  开始查询
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 素材消耗结果 */}
      {materialList.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>素材消耗结果</CardTitle>
              <CardDescription>
                共获取 {materialList.length} 条素材数据
                {materialTotalCost !== null && `，消耗总计：${materialTotalCost.toFixed(2)}`}
              </CardDescription>
            </div>
            <Button onClick={handleExportMaterials} variant="outline" size="sm">
              <Download className="mr-2 w-4 h-4" />
              导出CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-left">创意资产ID</th>
                    <th className="p-2 text-left">素材名</th>
                    <th className="p-2 text-right">消耗</th>
                  </tr>
                </thead>
                <tbody>
                  {materialList.map((item, index) => (
                    <tr
                      key={`${item.creative_asset_name || 'material'}-${index}`}
                      className="border-b hover:bg-muted/30"
                    >
                      <td className="p-2 font-mono">{item.creative_asset_id || '-'}</td>
                      <td className="p-2">{item.creative_asset_name || '-'}</td>
                      <td className="p-2 text-right">{(item.cost ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
