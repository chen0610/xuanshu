import React, { useEffect, useState } from 'react'
import {
  Activity,
  Calendar,
  CalendarRange,
  FolderKanban,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Users,
  X
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
  Checkbox
} from '../../components/ui'
import { configService } from '../../services/config.service'
import { dataAssistantV2Service, dataAnalysisService } from '../../services/ocean-engine.service'
import type { Config } from '../../types/config.types'

interface GroupConfig {
  id: string
  name: string
  shooterKeyword: string
  keywords: string
}

const createId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const createGroup = (): GroupConfig => ({
  id: createId('group'),
  name: '',
  shooterKeyword: '',
  keywords: ''
})

const getTodayDateString = (): string => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const DataAnalysisPage: React.FC = () => {
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigIds, setSelectedConfigIds] = useState<number[]>([])
  const [groups, setGroups] = useState<GroupConfig[]>([createGroup()])
  const [queryDate, setQueryDate] = useState<string>(getTodayDateString())
  const [organizationTree, setOrganizationTree] = useState<any>(null)
  const [selectedOrgNodes, setSelectedOrgNodes] = useState<Array<{ id: string; name: string }>>([])
  const [loadingOrgTree, setLoadingOrgTree] = useState(false)
  const [orgTreeError, setOrgTreeError] = useState('')
  const [ebpId, setEbpId] = useState<string>('1853254961360906')
  const [orgConfigId, setOrgConfigId] = useState<number | null>(null)
  const [isQuerying, setIsQuerying] = useState(false)
  const [querySummaries, setQuerySummaries] = useState<string[]>([])
  const [analysisResults, setAnalysisResults] = useState<any[]>([])

  useEffect(() => {
    loadConfigs()
  }, [])

  useEffect(() => {
    if (selectedConfigIds.length === 0) {
      setOrgConfigId(null)
      setOrganizationTree(null)
      setSelectedOrgNodes([])
      setOrgTreeError('')
      return
    }
    if (!orgConfigId || !selectedConfigIds.includes(orgConfigId)) {
      setOrgConfigId(selectedConfigIds[0])
    }
  }, [selectedConfigIds, orgConfigId])

  useEffect(() => {
    if (orgConfigId !== null && ebpId) {
      setOrganizationTree(null)
      setSelectedOrgNodes([])
      loadOrganizationTree(orgConfigId, ebpId)
    }
  }, [orgConfigId, ebpId])

  const loadConfigs = async (): Promise<void> => {
    try {
      const oceanConfigs = await configService.getConfigsBySource(1)
      setConfigs(oceanConfigs)
    } catch (err) {
      console.error('Failed to load configs:', err)
    }
  }

  const parseMetricNumber = (value: any): number => {
    if (value === null || value === undefined) return 0
    if (typeof value === 'number') return value
    const str = String(value).replace(/,/g, '').replace('%', '')
    const num = parseFloat(str)
    return Number.isNaN(num) ? 0 : num
  }

  const buildGroupRows = () => {
    const configMap = new Map(configs.map((c) => [c.id, c.cookie_name]))
    const rows: Array<{
      configId: number
      configName: string
      ebpId: string
      groupName: string
      shooterKeyword: string
      keyword: string
      count: number
      totalCost: number
      totalActive: number
      activeCost: number
    }> = []

    analysisResults.forEach((result) => {
      const configName = configMap.get(result.config_id) || `账户${result.config_id}`
      const groupedResults = result.grouped_results || []
      groupedResults.forEach((group: any) => {
        const groupItems = group.items || []
        const keywordGroups = group.keyword_groups || []
        const keywordNorms = keywordGroups.map((kg: any) =>
          String(kg.keyword || '')
            .trim()
            .toLowerCase()
        )

        const aggregate = (items: any[]) => {
          let totalCost = 0
          let totalActive = 0
          items.forEach((item) => {
            const metrics = item.metrics || {}
            totalCost += parseMetricNumber(metrics.stat_cost)
            const active = metrics.active ?? metrics.convert_cnt ?? 0
            totalActive += parseMetricNumber(active)
          })
          return {
            totalCost,
            totalActive,
            activeCost: totalActive > 0 ? totalCost / totalActive : 0
          }
        }

        const allAgg = aggregate(groupItems)
        rows.push({
          configId: result.config_id,
          configName,
          ebpId: result.ebp_id,
          groupName: group.name || '',
          shooterKeyword: group.shooter_keyword || '',
          keyword: '全部',
          count: groupItems.length,
          totalCost: allAgg.totalCost,
          totalActive: allAgg.totalActive,
          activeCost: allAgg.activeCost
        })

        keywordGroups.forEach((kg: any, index: number) => {
          const items = kg.items || []
          const agg = aggregate(items)
          rows.push({
            configId: result.config_id,
            configName,
            ebpId: result.ebp_id,
            groupName: group.name || '',
            shooterKeyword: group.shooter_keyword || '',
            keyword: kg.keyword || `关键字${index + 1}`,
            count: items.length,
            totalCost: agg.totalCost,
            totalActive: agg.totalActive,
            activeCost: agg.activeCost
          })
        })

        if (keywordNorms.length > 0) {
          const unmatchedItems = groupItems.filter((item: any) => {
            const name = String(item.project_name || '').toLowerCase()
            return !keywordNorms.some((kw) => kw && name.includes(kw))
          })
          if (unmatchedItems.length > 0) {
            const agg = aggregate(unmatchedItems)
            rows.push({
              configId: result.config_id,
              configName,
              ebpId: result.ebp_id,
              groupName: group.name || '',
              shooterKeyword: group.shooter_keyword || '',
              keyword: '未匹配关键字',
              count: unmatchedItems.length,
              totalCost: agg.totalCost,
              totalActive: agg.totalActive,
              activeCost: agg.activeCost
            })
          }
        }
      })
    })

    return rows
  }

  const handleStartQuery = async (): Promise<void> => {
    if (selectedConfigIds.length === 0) {
      console.warn('请先选择Cookie账户')
      return
    }
    if (!queryDate) {
      console.warn('请先选择查询日期')
      return
    }
    if (selectedOrgNodes.length === 0) {
      console.warn('请先选择组织树账户')
      return
    }

    setIsQuerying(true)
    setQuerySummaries([])
    try {
      const response = await dataAnalysisService.getProjectsByCost({
        config_ids: selectedConfigIds,
        query_date: queryDate,
        ebp_ids: selectedOrgNodes.map((node) => node.id),
        groups: groups.map((group) => ({
          id: group.id,
          name: group.name,
          shooter_keyword: group.shooterKeyword,
          keywords: group.keywords
        }))
      })
      if (response.code !== 0) {
        console.error(response.error || response.msg || '项目列表获取失败')
        return
      }
      const results = response.data?.results || []
      setAnalysisResults(results)
      const summaries = results.map(
        (result) =>
          `配置${result.config_id} | ebp ${result.ebp_id}: 最后一页 ${result.last_page}, 项目数 ${result.project_count}`
      )
      summaries.forEach((line) => console.log(line))
      setQuerySummaries(summaries)
    } catch (err) {
      console.error('项目列表获取失败:', err)
    } finally {
      setIsQuerying(false)
    }
  }

  const toggleConfigSelection = (configId: number, checked: boolean): void => {
    setSelectedConfigIds((prev) => {
      if (checked) {
        return prev.includes(configId) ? prev : [...prev, configId]
      }
      return prev.filter((id) => id !== configId)
    })
  }

  const selectAllConfigs = (): void => {
    setSelectedConfigIds(configs.map((config) => config.id))
  }

  const clearConfigSelection = (): void => {
    setSelectedConfigIds([])
  }

  const addGroup = (): void => {
    setGroups((prev) => [...prev, createGroup()])
  }

  const removeGroup = (groupId: string): void => {
    setGroups((prev) => prev.filter((group) => group.id !== groupId))
  }

  const updateGroupName = (groupId: string, name: string): void => {
    setGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, name } : group)))
  }

  const updateGroupShooterKeyword = (groupId: string, shooterKeyword: string): void => {
    setGroups((prev) =>
      prev.map((group) => (group.id === groupId ? { ...group, shooterKeyword } : group))
    )
  }

  const groupRows = buildGroupRows()

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

  const toggleOrgNodeSelection = (node: { id: string; name: string }): void => {
    setSelectedOrgNodes((prev) => {
      const exists = prev.find((n) => n.id === node.id)
      if (exists) {
        return prev.filter((n) => n.id !== node.id)
      }
      return [...prev, node]
    })
  }

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

  const updateGroupKeywords = (groupId: string, keywords: string): void => {
    setGroups((prev) =>
      prev.map((group) => (group.id === groupId ? { ...group, keywords } : group))
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Ocean Engine Analysis Workspace
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl sm:text-3xl">数据分析</CardTitle>
                <CardDescription className="max-w-2xl">
                  支持多账户、多分组、多模块配置的自定义数据分析。这里更适合作为分析台，而不是单次查询表单。
                </CardDescription>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-4 py-2 text-sm text-muted-foreground">
              <FolderKanban className="h-4 w-4 text-primary" />
              分组数 {groups.length}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">已选账户</span>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-2xl">{selectedConfigIds.length}</CardTitle>
            <CardDescription>支持多账户联合查询与汇总分析。</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">组织节点</span>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-2xl">{selectedOrgNodes.length}</CardTitle>
            <CardDescription>组织树会影响 EBP 维度的数据范围。</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">查询日期</span>
              <CalendarRange className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-2xl">{queryDate || '--'}</CardTitle>
            <CardDescription>分析结果会基于当前日期配置生成。</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Cookie账户选择（多选）
              </CardTitle>
              <CardDescription>选择需要参与分析的Cookie账户</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={selectAllConfigs}
                disabled={configs.length === 0}
              >
                全选
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={clearConfigSelection}
                disabled={selectedConfigIds.length === 0}
              >
                清空
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            已选 {selectedConfigIds.length} 个账户
          </div>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <div className="flex items-center justify-center h-28 rounded-lg border border-dashed text-sm text-muted-foreground">
              暂无可用账户，请先在配置中心添加Cookie
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {configs.map((config) => {
                const checked = selectedConfigIds.includes(config.id)
                return (
                  <label
                    key={config.id}
                    className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
                      checked
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border/70 bg-background/70 hover:border-primary/30 hover:bg-accent/30'
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggleConfigSelection(config.id, value === true)}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" title={config.cookie_name}>
                        {config.cookie_name}
                      </div>
                      {config.realname && (
                        <div className="text-xs text-muted-foreground truncate">
                          {config.realname}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground">ID: {config.id}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      {selectedConfigIds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>选择组织</CardTitle>
            <CardDescription>选择要筛选的组织节点（可多选）</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">组织树账户</Label>
                  <select
                    className="px-3 py-2 w-full rounded-md border bg-background"
                    value={orgConfigId ?? ''}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      setOrgConfigId(Number.isNaN(value) ? null : value)
                    }}
                  >
                    {selectedConfigIds.map((id) => {
                      const config = configs.find((c) => c.id === id)
                      return (
                        <option key={id} value={id}>
                          {config?.cookie_name || `账户${id}`}
                        </option>
                      )
                    })}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ebp-id-input" className="text-sm font-medium">
                    EBP ID
                  </Label>
                  <Input
                    placeholder="请输入EBP ID"
                    id="ebp-id-input"
                    value={ebpId}
                    onChange={(e) => setEbpId(e.target.value.trim())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && orgConfigId !== null && ebpId) {
                        loadOrganizationTree(orgConfigId, ebpId)
                      }
                    }}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => {
                      if (orgConfigId !== null && ebpId) {
                        loadOrganizationTree(orgConfigId, ebpId)
                      }
                    }}
                    disabled={loadingOrgTree || !ebpId || orgConfigId === null}
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
              </div>

              {orgTreeError && <div className="text-sm text-red-500">{orgTreeError}</div>}

              {organizationTree && (
                <div className="max-h-[400px] overflow-y-auto rounded-2xl border border-border/70 bg-background/70 p-4">
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
                      className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm text-primary"
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            分组配置
          </CardTitle>
          <CardDescription>每个分组支持自定义名称与多行关键字配置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {groups.map((group, groupIndex) => (
            <div
              key={group.id}
              className="space-y-4 rounded-2xl border border-dashed border-border/70 bg-background/70 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">分组名称</Label>
                    <Input
                      value={group.name}
                      onChange={(e) => updateGroupName(group.id, e.target.value)}
                      placeholder={`例如：分组${groupIndex + 1}`}
                      className="w-48"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">投手关键字</Label>
                    <Input
                      value={group.shooterKeyword}
                      onChange={(e) => updateGroupShooterKeyword(group.id, e.target.value)}
                      placeholder="例如：关键词A|关键词B"
                      className="w-48"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeGroup(group.id)}
                    disabled={groups.length <= 1}
                  >
                    <Trash2 className="w-4 h-4" />
                    删除分组
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">关键字（每行一个）</Label>
                <textarea
                  className="min-h-[120px] w-full rounded-2xl border border-border/70 bg-card px-3.5 py-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0"
                  value={group.keywords}
                  onChange={(e) => updateGroupKeywords(group.id, e.target.value)}
                  placeholder="例如：\n纯短剧\n纯激励"
                />
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addGroup} className="w-full">
            <Plus className="w-4 h-4" />
            添加分组
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            查询日期
          </CardTitle>
          <CardDescription>请选择需要查询的数据日期</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="query-date" className="text-sm font-medium">
              查询日期
            </Label>
            <Input
              id="query-date"
              type="date"
              value={queryDate}
              onChange={(e) => setQueryDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={handleStartQuery} disabled={isQuerying}>
          {isQuerying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              查询中...
            </>
          ) : (
            '开始查询'
          )}
        </Button>
        <Button type="button" variant="outline">
          重置条件
        </Button>
      </div>
      {querySummaries.length > 0 && (
        <div className="text-sm text-muted-foreground space-y-1">
          {querySummaries.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}
      {analysisResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>分组匹配结果</CardTitle>
            <CardDescription>按分组与关键字展示匹配到的项目汇总</CardDescription>
          </CardHeader>
          <CardContent>
            {groupRows.length === 0 ? (
              <div className="py-6 text-sm text-muted-foreground">暂无匹配数据</div>
            ) : (
              <div className="overflow-hidden rounded-[24px] border border-border/70 bg-background/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/70 bg-muted/40">
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          账户
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          EBP
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          分组
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          投手关键字
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          关键字
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                          项目数
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                          消耗
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                          激活数
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                          激活成本
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupRows.map((row, idx) => (
                        <tr
                          key={`${row.configId}-${row.ebpId}-${row.groupName}-${row.keyword}-${idx}`}
                          className="border-b border-border/60 hover:bg-accent/30"
                        >
                          <td className="px-4 py-3">{row.configName}</td>
                          <td className="px-4 py-3">{row.ebpId}</td>
                          <td className="px-4 py-3">{row.groupName || '-'}</td>
                          <td className="px-4 py-3">{row.shooterKeyword || '-'}</td>
                          <td className="px-4 py-3">{row.keyword}</td>
                          <td className="px-4 py-3 text-right">{row.count}</td>
                          <td className="px-4 py-3 text-right">{row.totalCost.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right">{row.totalActive}</td>
                          <td className="px-4 py-3 text-right">{row.activeCost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
