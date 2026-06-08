import React, { useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  Image as ImageIcon,
  Video,
  FileText,
  BadgeCheck,
  Component,
  Link2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Button
} from '../../components/ui'
import { configService } from '../../services/config.service'
import { creativeAssetService, organizationListService } from '../../services/tencent-ads.service'
import apiClient from '../../services/api'

type AssetTab = 'image' | 'video' | 'text' | 'brand' | 'marketing' | 'landing_page'

interface Config {
  id: number
  cookie_name: string
  realname?: string
}

interface OrganizationItem {
  business_id: number
  business_name: string
}

interface AssetComponentItem {
  component?: {
    account_id?: number | string
    component_id?: number | string
    similarity_status_cn?: string
    shared_account_type?: string
    component_type_cn?: string
    component_sub_type_cn?: string
    component_custom_name?: string
    component_value?: Record<string, any>
    system_status_cn?: string
    image_ids?: string
    video_ids?: string
  }
  report?: {
    cost?: number
    acquisition_cost?: number
    activated_count?: number
    activated_cost?: number
    retention_count?: number
    app_retention_d7_cost?: number
    app_retention_d7_uv?: number
  }
}

interface PageInfo {
  page: number
  page_size: number
  total_number: number
  total_page: number
}

const TAB_OPTIONS: Array<{ key: AssetTab; label: string; icon: React.ReactNode }> = [
  { key: 'image', label: '图片', icon: <ImageIcon className="w-4 h-4" /> },
  { key: 'video', label: '视频', icon: <Video className="w-4 h-4" /> },
  { key: 'text', label: '文案', icon: <FileText className="w-4 h-4" /> },
  { key: 'brand', label: '品牌形象', icon: <BadgeCheck className="w-4 h-4" /> },
  { key: 'marketing', label: '营销组件', icon: <Component className="w-4 h-4" /> },
  { key: 'landing_page', label: '落地页', icon: <Link2 className="w-4 h-4" /> }
]

const PAGE_SIZE = 20
const ImageProxyCell: React.FC<{
  selectedCookieId: number
  organizationId: number
  resourceId: string
  gTk: string
  alt: string
}> = ({ selectedCookieId, organizationId, resourceId, gTk, alt }) => {
  const [src, setSrc] = useState<string>('')

  useEffect(() => {
    let mounted = true
    const load = async (): Promise<void> => {
      try {
        const response = await apiClient.get('/api/v1/tencent-ads/creative-assets/image-proxy', {
          params: {
            selected_cookie_id: selectedCookieId,
            resource_id: resourceId,
            organization_id: organizationId,
            g_tk: gTk
          },
          responseType: 'blob'
        })
        const blob: Blob = response.data
        const reader = new FileReader()
        reader.onloadend = () => {
          if (mounted) setSrc((reader.result as string) || '')
        }
        reader.readAsDataURL(blob)
      } catch {
        if (mounted) setSrc('')
      }
    }

    if (selectedCookieId && organizationId && resourceId && gTk) {
      load()
    } else {
      setSrc('')
    }

    return () => {
      mounted = false
    }
  }, [selectedCookieId, organizationId, resourceId, gTk])

  if (!src) {
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <img src={src} alt={alt} className="w-16 h-10 object-cover rounded border" loading="lazy" />
  )
}

export const CreativeAssetPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(false)
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(false)
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<number | null>(null)
  const [gTk, setGTk] = useState<string>('')
  const [activeTab, setActiveTab] = useState<AssetTab>('image')
  const [list, setList] = useState<AssetComponentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pageInfo, setPageInfo] = useState<PageInfo>({
    page: 1,
    page_size: PAGE_SIZE,
    total_number: 0,
    total_page: 1
  })

  useEffect(() => {
    loadConfigs()
  }, [])

  useEffect(() => {
    if (!selectedConfigId) return
    loadOrganizations(selectedConfigId)
    setSelectedOrganizationId(null)
    setGTk('')
    setList([])
    setPageInfo({ page: 1, page_size: PAGE_SIZE, total_number: 0, total_page: 1 })
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConfigId])

  useEffect(() => {
    if (!selectedConfigId || !selectedOrganizationId) return
    fetchAssets(1, activeTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConfigId, selectedOrganizationId, activeTab])

  const loadConfigs = async (): Promise<void> => {
    setLoadingConfigs(true)
    try {
      const tencentConfigs = await configService.getConfigsBySource(2)
      setConfigs(tencentConfigs)
      if (tencentConfigs.length > 0) {
        setSelectedConfigId(tencentConfigs[0].id)
      }
    } catch (err) {
      setError('加载配置失败，请稍后重试')
    } finally {
      setLoadingConfigs(false)
    }
  }

  const loadOrganizations = async (configId: number): Promise<void> => {
    setLoadingOrganizations(true)
    try {
      const result = await organizationListService.getOrganizationList({
        selected_cookie_id: configId
      })
      if (result.code !== 0) {
        throw new Error(result.error || result.msg || '加载组织列表失败')
      }
      const orgs = result.data || []
      setOrganizations(orgs)
    } catch (err: any) {
      setOrganizations([])
      setError(err?.message || '加载组织列表失败')
    } finally {
      setLoadingOrganizations(false)
    }
  }

  const fetchAssets = async (page: number, tab: AssetTab): Promise<void> => {
    if (!selectedConfigId || !selectedOrganizationId) return
    setLoading(true)
    setError('')
    try {
      const res = await creativeAssetService.getCreativeAssets({
        selected_cookie_id: selectedConfigId,
        asset_type: tab,
        organization_id: selectedOrganizationId,
        page,
        page_size: PAGE_SIZE
      })
      if (res.code !== 0) {
        throw new Error(res.error || res.msg || '获取创意资产失败')
      }
      setGTk(res.data?.g_tk || '')
      setList(res.data?.list || [])
      setPageInfo(
        res.data?.page_info || { page: 1, page_size: PAGE_SIZE, total_number: 0, total_page: 1 }
      )
    } catch (err: any) {
      setError(err?.message || '获取创意资产失败')
      setList([])
      setPageInfo({ page: 1, page_size: PAGE_SIZE, total_number: 0, total_page: 1 })
    } finally {
      setLoading(false)
    }
  }

  const contentText = (item: AssetComponentItem): string => {
    const component = item.component || {}
    const value = component.component_value || {}
    return (
      value?.image?.value?.image_id ||
      value?.video?.value?.video_id ||
      value?.description?.value?.content ||
      value?.title?.value?.content ||
      value?.brand?.value?.brand_name ||
      value?.action_button?.value?.button_text ||
      value?.text_link?.value?.link_name_text ||
      value?.jump_info?.value?.page_type ||
      component.image_ids ||
      component.video_ids ||
      '-'
    )
  }
  const textContent = (item: AssetComponentItem): string => {
    const value = item.component?.component_value || {}
    return value?.description?.value?.content || '-'
  }

  const imageText = (item: AssetComponentItem): string => {
    const value = item.component?.component_value || {}
    return (
      value?.image?.value?.image_id ||
      value?.video?.value?.cover_id ||
      item.component?.image_ids ||
      '-'
    )
  }

  const imageId = (item: AssetComponentItem): string => {
    const value = item.component?.component_value || {}
    const fromValue = value?.image?.value?.image_id
    if (fromValue) return String(fromValue)
    const ids = item.component?.image_ids || ''
    if (!ids) return ''
    return String(ids).split(',')[0].trim()
  }

  const previewImageId = (item: AssetComponentItem, tabKey: AssetTab): string => {
    const value = item.component?.component_value || {}
    if (tabKey === 'video') {
      const coverId = value?.video?.value?.cover_id
      if (coverId) return String(coverId)
    }
    return imageId(item)
  }

  const sharedScopeText = (value?: string): string => {
    if (value === 'ORGANIZATION') return '全部账户'
    if (value === 'ACCOUNT') return '当前账户'
    return '-'
  }

  const pageButtons = useMemo(() => {
    const total = pageInfo.total_page || 1
    const current = pageInfo.page || 1
    const pages: (number | string)[] = []
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i)
      return pages
    }
    pages.push(1)
    if (current <= 4) {
      pages.push(2, 3, 4, 5, '...', total)
    } else if (current >= total - 3) {
      pages.push('...', total - 4, total - 3, total - 2, total - 1, total)
    } else {
      pages.push('...', current - 1, current, current + 1, '...', total)
    }
    return pages
  }, [pageInfo.page, pageInfo.total_page])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>创意资产</CardTitle>
          <CardDescription>
            选择Cookie和组织后，查看图片、视频、文案、品牌形象、营销组件和落地页资产
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingConfigs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : configs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              暂无可用配置，请先在配置中心添加腾讯Cookie
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {configs.map((config) => {
                const isSelected = selectedConfigId === config.id
                return (
                  <div
                    key={config.id}
                    className={`p-3 border rounded-md cursor-pointer transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/50 hover:bg-accent/50'}`}
                    onClick={() => setSelectedConfigId(config.id)}
                  >
                    <div className="text-sm font-medium">{config.cookie_name}</div>
                    {config.realname && (
                      <div className="text-xs text-muted-foreground">{config.realname}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      {selectedConfigId && (
        <Card>
          <CardHeader>
            <CardTitle>选择组织</CardTitle>
            <CardDescription>单选一个组织后才会开始加载Tab数据</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingOrganizations ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                加载组织中...
              </div>
            ) : organizations.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">暂无可用组织</div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">组织（单选）</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={selectedOrganizationId ?? ''}
                  onChange={(e) => {
                    const value = e.target.value ? Number(e.target.value) : null
                    setSelectedOrganizationId(value)
                    setList([])
                    setPageInfo({ page: 1, page_size: PAGE_SIZE, total_number: 0, total_page: 1 })
                  }}
                >
                  <option value="">请选择组织</option>
                  {organizations.map((org) => (
                    <option key={org.business_id} value={org.business_id}>
                      {org.business_name}（{org.business_id}）
                    </option>
                  ))}
                </select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AssetTab)}>
            <TabsList className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              {TAB_OPTIONS.map((tab) => (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="flex items-center gap-1"
                  disabled={!selectedOrganizationId}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {TAB_OPTIONS.map((tab) => (
              <TabsContent key={tab.key} value={tab.key} className="mt-4">
                {!selectedOrganizationId ? (
                  <div className="py-12 text-center text-muted-foreground">请先选择组织</div>
                ) : (
                  <>
                    {error && (
                      <div className="mb-3 p-3 text-sm rounded-md border border-destructive/20 bg-destructive/10 text-destructive">
                        {error}
                      </div>
                    )}
                    {loading ? (
                      <div className="flex items-center justify-center py-12 text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        加载中...
                      </div>
                    ) : (
                      <>
                        <div className="border rounded-md overflow-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/60 border-b">
                              <tr>
                                <th className="p-2 text-left w-10">
                                  <input type="checkbox" disabled />
                                </th>
                                <th className="p-2 text-left min-w-[120px]">
                                  {tab.key === 'video'
                                    ? '视频'
                                    : tab.key === 'text'
                                      ? '文案'
                                      : '图片'}
                                </th>
                                <th className="p-2 text-left min-w-[120px]">二级组件类型</th>
                                <th className="p-2 text-left min-w-[120px]">组件名称</th>
                                {tab.key !== 'text' && (
                                  <th className="p-2 text-left min-w-[100px]">相似度检测</th>
                                )}
                                {tab.key !== 'text' && (
                                  <th className="p-2 text-left min-w-[100px]">组件状态</th>
                                )}
                                <th className="p-2 text-left min-w-[100px]">共享范围</th>
                                <th className="p-2 text-left min-w-[120px]">组件ID</th>
                                <th className="p-2 text-right min-w-[80px]">花费</th>
                                <th className="p-2 text-right min-w-[110px]">一键起量消耗</th>
                                <th className="p-2 text-left min-w-[70px]">评估</th>
                                <th className="p-2 text-right min-w-[100px]">APP激活次数</th>
                                <th className="p-2 text-right min-w-[100px]">APP激活成本</th>
                                <th className="p-2 text-right min-w-[100px]">次日留存次数</th>
                                <th className="p-2 text-right min-w-[140px]">
                                  7日留存成本（人数）
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {list.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={tab.key === 'text' ? 12 : 15}
                                    className="p-8 text-center text-muted-foreground"
                                  >
                                    暂无数据
                                  </td>
                                </tr>
                              ) : (
                                list.map((item, idx) => {
                                  const component = item.component || {}
                                  const report = item.report || {}
                                  return (
                                    <tr
                                      key={`${component.component_id || idx}`}
                                      className="border-b last:border-b-0 hover:bg-muted/30"
                                    >
                                      <td className="p-2">
                                        <input type="checkbox" disabled />
                                      </td>
                                      <td className="p-2 max-w-[140px]">
                                        {tab.key === 'image' || tab.key === 'video' ? (
                                          previewImageId(item, tab.key) ? (
                                            selectedConfigId && selectedOrganizationId ? (
                                              <ImageProxyCell
                                                selectedCookieId={selectedConfigId}
                                                organizationId={selectedOrganizationId}
                                                resourceId={previewImageId(item, tab.key)}
                                                gTk={gTk}
                                                alt={previewImageId(item, tab.key)}
                                              />
                                            ) : (
                                              '-'
                                            )
                                          ) : (
                                            '-'
                                          )
                                        ) : tab.key === 'text' ? (
                                          <span
                                            className="truncate block"
                                            title={textContent(item)}
                                          >
                                            {textContent(item)}
                                          </span>
                                        ) : (
                                          <span className="truncate block" title={imageText(item)}>
                                            {imageText(item)}
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-2">
                                        {component.component_sub_type_cn ||
                                          component.component_type_cn ||
                                          '-'}
                                      </td>
                                      <td
                                        className="p-2 max-w-[140px] truncate"
                                        title={component.component_custom_name || ''}
                                      >
                                        {component.component_custom_name || '-'}
                                      </td>
                                      {tab.key !== 'text' && (
                                        <td className="p-2">
                                          {component.similarity_status_cn || '-'}
                                        </td>
                                      )}
                                      {tab.key !== 'text' && (
                                        <td className="p-2">{component.system_status_cn || '-'}</td>
                                      )}
                                      <td className="p-2">
                                        {sharedScopeText(component.shared_account_type)}
                                      </td>
                                      <td className="p-2 font-mono">
                                        {component.component_id || '-'}
                                      </td>
                                      <td className="p-2 text-right">{report.cost ?? '-'}</td>
                                      <td className="p-2 text-right">
                                        {report.acquisition_cost ?? '-'}
                                      </td>
                                      <td className="p-2">
                                        {contentText(item) === '-' ? '-' : '有'}
                                      </td>
                                      <td className="p-2 text-right">
                                        {report.activated_count ?? '-'}
                                      </td>
                                      <td className="p-2 text-right">
                                        {report.activated_cost ?? '-'}
                                      </td>
                                      <td className="p-2 text-right">
                                        {report.retention_count ?? '-'}
                                      </td>
                                      <td className="p-2 text-right">
                                        {report.app_retention_d7_cost !== undefined &&
                                        report.app_retention_d7_cost !== null
                                          ? `${report.app_retention_d7_cost}${report.app_retention_d7_uv !== undefined ? `（${report.app_retention_d7_uv}）` : ''}`
                                          : '-'}
                                      </td>
                                    </tr>
                                  )
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        {(pageInfo.total_page || 1) > 1 && (
                          <div className="flex flex-wrap justify-between items-center gap-3 pt-3">
                            <div className="text-xs text-muted-foreground">
                              第 {pageInfo.page}/{pageInfo.total_page} 页，共{' '}
                              {pageInfo.total_number} 条
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-7 h-7 p-0"
                                disabled={pageInfo.page <= 1 || loading}
                                onClick={() => fetchAssets(pageInfo.page - 1, activeTab)}
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </Button>
                              {pageButtons.map((page, index) =>
                                page === '...' ? (
                                  <span
                                    key={`ellipsis-${index}`}
                                    className="px-2 text-xs text-muted-foreground"
                                  >
                                    ...
                                  </span>
                                ) : (
                                  <Button
                                    key={page}
                                    variant={Number(page) === pageInfo.page ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-7 min-w-7 px-2 text-xs"
                                    disabled={loading}
                                    onClick={() => fetchAssets(Number(page), activeTab)}
                                  >
                                    {page}
                                  </Button>
                                )
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-7 h-7 p-0"
                                disabled={pageInfo.page >= pageInfo.total_page || loading}
                                onClick={() => fetchAssets(pageInfo.page + 1, activeTab)}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
