import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, Loader2, RefreshCw, X } from 'lucide-react'
import { Button, Input, Label, RadioGroup, RadioGroupItem, Textarea } from '../../../../components/ui'
import { PAssistantFeaturePanel } from '../../PAssistantFeaturePanel'
import { parseAccountIds } from '../../pAssistantUtils'
import { persistNonEmptyString, usePersistedState } from '../../usePersistedState'
import { usePAssistantContext } from '../PAssistantContext'
import {
  dataAssistantV2Service,
  type UnitScheduleBatchResponse
} from '../../../../services/ocean-engine.service'

// ─── 辅助类型与工具函数 ──────────────────────────────────

interface OrgNodeSelection {
  id: string
  name: string
}

const DEFAULT_UNIT_SCHEDULE_EBP_ID = '1853254961360906'

function flattenOrgTreeNodes(node: any, level = 0): OrgNodeSelection[] {
  if (!node || typeof node !== 'object') return []
  const nodeId = String(node.id || node.ebp_id || '').trim()
  const nodeName = String(node.name || node.ebp_name || node.group_name || nodeId).trim()
  const current = nodeId ? [{ id: nodeId, name: `${'　'.repeat(level)}${nodeName || nodeId}` }] : []
  const children = Array.isArray(node.children) ? node.children : []
  return [...current, ...children.flatMap((child) => flattenOrgTreeNodes(child, level + 1))]
}

// ─── 组件 ───────────────────────────────────────────────

export const UnitScheduleTab: React.FC = () => {
  const {
    selectedConfigId,
    loading,
    setLoading,
    setError,
    addLog,
    clearLogs,
    setIsBottomPanelOpen,
    runPAssistantJob
  } = usePAssistantContext()

  const [unitScheduleDimension, setUnitScheduleDimension] = usePersistedState<'account' | 'promotion'>(
    'p-assistant-unit-schedule-dimension',
    'account',
    { deserialize: (raw) => (raw === 'promotion' ? 'promotion' : 'account') }
  )
  const [unitScheduleRootEbpId, setUnitScheduleRootEbpId] = usePersistedState<string>(
    'p-assistant-unit-schedule-root-ebp-id',
    DEFAULT_UNIT_SCHEDULE_EBP_ID,
    { shouldPersist: persistNonEmptyString }
  )
  const [unitScheduleEbpId, setUnitScheduleEbpId] = usePersistedState<string>(
    'p-assistant-unit-schedule-ebp-id',
    '',
    { shouldPersist: persistNonEmptyString }
  )
  const [unitScheduleOrgNodes, setUnitScheduleOrgNodes] = useState<OrgNodeSelection[]>([])
  const [unitScheduleLoadingOrgNodes, setUnitScheduleLoadingOrgNodes] = useState(false)
  const [unitScheduleAccountIds, setUnitScheduleAccountIds] = useState('')
  const [unitScheduleStartTime, setUnitScheduleStartTime] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const offsetMs = tomorrow.getTimezoneOffset() * 60 * 1000
    return new Date(tomorrow.getTime() - offsetMs).toISOString().slice(0, 16)
  })
  const [unitScheduleResults, setUnitScheduleResults] = useState<UnitScheduleBatchResponse | null>(
    null
  )

  const loadUnitScheduleOrgNodes = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个 Cookie 配置')
      return
    }
    const rootEbpId = unitScheduleRootEbpId.trim()
    if (!rootEbpId) {
      setError('请输入根 EBP ID')
      return
    }

    setUnitScheduleLoadingOrgNodes(true)
    setError('')
    try {
      const result = await dataAssistantV2Service.getOrganizationTree(selectedConfigId, rootEbpId)
      if (result.code === 0 && result.data) {
        const nodes = flattenOrgTreeNodes(result.data)
        setUnitScheduleOrgNodes(nodes)
        setUnitScheduleEbpId((prev) => {
          if (prev && nodes.some((node) => node.id === prev)) return prev
          return nodes[0]?.id || ''
        })
        addLog(`成功加载 ${nodes.length} 个组织节点`, 'success')
      } else {
        setUnitScheduleOrgNodes([])
        setError(result.msg || result.error || '获取组织节点失败')
      }
    } catch (err: any) {
      setUnitScheduleOrgNodes([])
      setError(err?.response?.data?.detail || err?.message || '获取组织节点失败')
    } finally {
      setUnitScheduleLoadingOrgNodes(false)
    }
  }

  useEffect(() => {
    if (selectedConfigId && unitScheduleDimension === 'promotion') {
      void loadUnitScheduleOrgNodes()
    }
  }, [selectedConfigId, unitScheduleDimension])

  const handleBatchSchedulePausedUnits = async (): Promise<void> => {
    if (!selectedConfigId) {
      setError('请选择一个 Cookie 配置')
      return
    }
    if (unitScheduleDimension === 'promotion' && !unitScheduleEbpId.trim()) {
      setError('请选择组织节点')
      return
    }
    const targetIdList = parseAccountIds(unitScheduleAccountIds)
    if (targetIdList.length === 0) {
      setError(unitScheduleDimension === 'promotion' ? '请输入至少一个单元ID' : '请输入至少一个账户ID')
      return
    }
    if (!unitScheduleStartTime) {
      setError('请选择预约投放时间')
      return
    }
    const startTimestamp = Math.floor(new Date(unitScheduleStartTime).getTime() / 1000)
    if (!Number.isFinite(startTimestamp) || startTimestamp <= Math.floor(Date.now() / 1000)) {
      setError('预约投放时间必须晚于当前时间')
      return
    }
    const targetLabel = unitScheduleDimension === 'promotion' ? '单元' : '账户'
    const confirmMessage = `确定要按${targetLabel}维度为 ${targetIdList.length} 个${targetLabel}预约投放吗？\n预约时间：${new Date(unitScheduleStartTime).toLocaleString()}`
    if (!window.confirm(confirmMessage)) return

    setLoading(true)
    setError('')
    setUnitScheduleResults(null)
    clearLogs()
    setIsBottomPanelOpen(true)
    addLog(
      unitScheduleDimension === 'promotion'
        ? `开始查询 ${targetIdList.length} 个单元详情并按账户分组`
        : `开始获取 ${targetIdList.length} 个账户的已暂停单元`,
      'info'
    )

    try {
      const payload =
        unitScheduleDimension === 'promotion'
          ? {
              selected_cookie_id: selectedConfigId,
              schedule_dimension: 'promotion',
              ebp_id: unitScheduleEbpId.trim(),
              promotion_ids: targetIdList,
              start_time: startTimestamp
            }
          : {
              selected_cookie_id: selectedConfigId,
              schedule_dimension: 'account',
              account_ids: targetIdList,
              start_time: startTimestamp
            }
      const result = await runPAssistantJob<UnitScheduleBatchResponse>('unit_schedule_batch', payload)
      setUnitScheduleResults(result)
      if (result.code !== 0) {
        addLog(result.error || result.msg || '单元预约投放失败', 'error')
        return
      }
      if (result.data) {
        addLog(
          `预约投放完成：暂停单元 ${result.data.total_paused}，成功 ${result.data.total_success}，失败 ${result.data.total_error}`,
          result.data.total_error === 0 ? 'success' : 'info'
        )
        result.data.results.forEach((item) => {
          if (item.error) {
            addLog(`账户 ${item.account_id}: ${item.error}`, 'error')
          } else if (item.paused_count === 0) {
            addLog(`账户 ${item.account_id}: 未发现已暂停单元`, 'info')
          } else {
            addLog(
              `账户 ${item.account_id}: 已暂停 ${item.paused_count}，预约成功 ${item.success_count}，失败 ${item.error_count}`,
              item.error_count === 0 ? 'success' : 'info'
            )
          }
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '单元预约投放失败'
      setError(msg)
      addLog(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PAssistantFeaturePanel
      title="单元预约投放"
      description="支持按账户获取已暂停单元，或按单元 ID 查询所属账户后分组预约；使用当前 Cookie 配置的主 Cookie 和有效备用 Cookie 并发提交预约投放任务"
      icon={<Clock />}
    >
      <div className="space-y-2">
        <Label className="text-base font-semibold">预约维度</Label>
        <RadioGroup
          value={unitScheduleDimension}
          onValueChange={(value) => setUnitScheduleDimension(value as 'account' | 'promotion')}
          disabled={loading}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="account" id="unit-schedule-dimension-account" />
            <Label htmlFor="unit-schedule-dimension-account" className="cursor-pointer">
              账户
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="promotion" id="unit-schedule-dimension-promotion" />
            <Label htmlFor="unit-schedule-dimension-promotion" className="cursor-pointer">
              单元
            </Label>
          </div>
        </RadioGroup>
        <p className="text-sm text-muted-foreground">
          账户维度保持现有逻辑；单元维度会先查询单元详情，提取 advertiser_id 后按账户分组预约。
        </p>
      </div>

      {unitScheduleDimension === 'promotion' && (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto]">
            <div className="grid gap-2">
              <Label
                htmlFor="p-assistant-unit-schedule-root-ebp-id"
                className="text-base font-semibold"
              >
                根 EBP ID
              </Label>
              <Input
                id="p-assistant-unit-schedule-root-ebp-id"
                value={unitScheduleRootEbpId}
                onChange={(e) => setUnitScheduleRootEbpId(e.target.value.trim())}
                disabled={loading || unitScheduleLoadingOrgNodes}
                placeholder="请输入根 EBP ID"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadUnitScheduleOrgNodes()}
                disabled={loading || unitScheduleLoadingOrgNodes || !selectedConfigId}
              >
                {unitScheduleLoadingOrgNodes ? (
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 w-4 h-4" />
                )}
                获取组织节点
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label
              htmlFor="p-assistant-unit-schedule-ebp-id"
              className="text-base font-semibold"
            >
              组织节点 *
            </Label>
            <select
              id="p-assistant-unit-schedule-ebp-id"
              value={unitScheduleEbpId}
              onChange={(e) => setUnitScheduleEbpId(e.target.value)}
              disabled={loading || unitScheduleLoadingOrgNodes}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {unitScheduleOrgNodes.length === 0 ? (
                <option value="">请先获取组织节点</option>
              ) : (
                unitScheduleOrgNodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name}（{node.id}）
                  </option>
                ))
              )}
            </select>
            <p className="text-sm text-muted-foreground">
              单元详情查询接口的 ebpid 使用这里选择的组织节点 ID。
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-2">
        <div className="flex justify-between items-center">
          <Label
            htmlFor="p-assistant-unit-schedule-account-ids"
            className="text-base font-semibold"
          >
            {unitScheduleDimension === 'promotion'
              ? '单元列表（一行一个）*'
              : '账户列表（一行一个）*'}
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setUnitScheduleAccountIds('')}
            disabled={loading}
          >
            <X className="mr-2 w-4 h-4" />
            清空列表
          </Button>
        </div>
        <Textarea
          id="p-assistant-unit-schedule-account-ids"
          placeholder={
            unitScheduleDimension === 'promotion'
              ? '请输入需要预约投放的单元ID，每行一个...'
              : '请输入需要预约投放的账户ID，每行一个...'
          }
          value={unitScheduleAccountIds}
          onChange={(e) => setUnitScheduleAccountIds(e.target.value)}
          disabled={loading}
          className="min-h-[120px] resize-y font-mono text-sm"
          rows={5}
        />
        <p className="text-sm text-muted-foreground">
          已输入 {parseAccountIds(unitScheduleAccountIds).length} 个
          {unitScheduleDimension === 'promotion' ? '单元' : '账户'}
        </p>
      </div>

      <div className="grid gap-2 max-w-md">
        <Label
          htmlFor="p-assistant-unit-schedule-start-time"
          className="text-base font-semibold"
        >
          预约投放时间 *
        </Label>
        <Input
          id="p-assistant-unit-schedule-start-time"
          type="datetime-local"
          value={unitScheduleStartTime}
          onChange={(e) => setUnitScheduleStartTime(e.target.value)}
          disabled={loading}
        />
        <p className="text-sm text-muted-foreground">
          默认隔天 00:00，提交到巨量接口时会转换为秒级时间戳。
        </p>
      </div>

      <div className="flex justify-end pt-2 border-t">
        <Button
          type="button"
          onClick={() => void handleBatchSchedulePausedUnits()}
          disabled={
            loading ||
            !selectedConfigId ||
            !unitScheduleAccountIds.trim() ||
            !unitScheduleStartTime
          }
          size="lg"
          className="min-w-[160px]"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              预约中…
            </>
          ) : (
            <>
              <Clock className="mr-2 w-4 h-4" />
              确定预约
            </>
          )}
        </Button>
      </div>

      {unitScheduleResults?.data && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg border bg-muted/50"
        >
          <div className="flex flex-wrap gap-2 justify-between items-center mb-2">
            <h4 className="font-semibold">执行结果</h4>
            <div className="flex gap-3 text-sm">
              <span>暂停单元: {unitScheduleResults.data.total_paused}</span>
              <span className="text-green-600">
                成功: {unitScheduleResults.data.total_success}
              </span>
              <span className="text-red-600">
                失败: {unitScheduleResults.data.total_error}
              </span>
            </div>
          </div>
          <div className="overflow-y-auto space-y-1 max-h-56">
            {unitScheduleResults.data.results.map((item) => (
              <div
                key={item.account_id}
                className={`flex justify-between items-center p-2 rounded text-sm ${
                  item.error || item.error_count > 0
                    ? 'bg-red-50 dark:bg-red-950/20'
                    : 'bg-green-50 dark:bg-green-950/20'
                }`}
              >
                <span className="font-mono">{item.account_id}</span>
                <span
                  className={`truncate max-w-[70%] ${
                    item.error || item.error_count > 0
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}
                  title={item.error || undefined}
                >
                  {item.error ||
                    `已暂停 ${item.paused_count}，成功 ${item.success_count}，失败 ${item.error_count}`}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </PAssistantFeaturePanel>
  )
}
