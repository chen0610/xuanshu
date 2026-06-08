import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { configService } from '../../../services/config.service'
import { dataAssistantV2Service } from '../../../services/ocean-engine.service'
import type { Config } from '../../../types/config.types'
import {
  usePAssistantJobRunner,
  type PAssistantLogEntry
} from '../usePAssistantJobRunner'
import { isPAssistantFeatureKey, type PAssistantTabKey } from '../pAssistantFeatures'
import {
  flattenOrgTreeNodes,
  resolveRootEbpId,
  type OrgNodeSelection,
  type RootOrganizationOption
} from './shared/cleanupOrgConfig'

// ─── 常量 ──────────────────────────────────────────────

/** 批量助手仅展示 Cookie 数量大于该阈值的配置 */
export const MIN_P_ASSISTANT_COOKIE_COUNT = 8

const ACTIVE_TAB_STORAGE_KEY = 'p-assistant-active-tab'
const SELECTED_ROOT_EBP_STORAGE_KEY = 'p-assistant-selected-root-ebp-id'
const SELECTED_ORG_EBP_STORAGE_KEY = 'p-assistant-selected-org-ebp-id'
const SELECTED_ORG_NAME_STORAGE_KEY = 'p-assistant-selected-org-name'
const DEFAULT_ACTIVE_TAB: PAssistantTabKey = 'rta'

function readSavedActiveTab(): PAssistantTabKey {
  const saved = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY)
  if (saved && isPAssistantFeatureKey(saved) && saved !== 'job-history') {
    return saved
  }
  return DEFAULT_ACTIVE_TAB
}

// ─── 类型 ──────────────────────────────────────────────

export interface PAssistantContextValue {
  // Cookie 配置
  configs: Config[]
  selectedConfigId: number | null
  setSelectedConfigId: (id: number | null) => void

  // 组织节点选择
  rootOrganizations: RootOrganizationOption[]
  selectedRootEbpId: string
  selectedOrgEbpId: string
  selectedOrgName: string
  orgNodes: OrgNodeSelection[]
  loadingOrgNodes: boolean
  organizationError: string
  loadOrgNodes: (preferredRootId?: string) => Promise<void>
  selectOrgNode: (id: string) => void
  setSelectedRootEbpId: (id: string) => void

  // 当前激活 Tab
  activeTab: PAssistantTabKey
  setActiveTab: (tab: PAssistantTabKey) => void

  // 全局 loading / error
  loading: boolean
  setLoading: (v: boolean) => void
  error: string
  setError: (v: string) => void

  // 日志
  logs: PAssistantLogEntry[]
  addLog: (message: string, type?: PAssistantLogEntry['type']) => void
  clearLogs: () => void

  // 操作日志底栏
  isBottomPanelOpen: boolean
  setIsBottomPanelOpen: (v: boolean) => void

  // 任务记录抽屉
  isJobCenterOpen: boolean
  setIsJobCenterOpen: (v: boolean) => void

  // 任务运行
  runPAssistantJob: <T extends { code?: number; error?: string; msg?: string }>(
    jobType: string,
    payload: Record<string, unknown>
  ) => Promise<T>
  activePAssistantJobId: number | null

  // 任务中心
  jobRefreshToken: number
  focusedJobId: number | null
}

// ─── Context ───────────────────────────────────────────

const PAssistantCtx = createContext<PAssistantContextValue | null>(null)

export function usePAssistantContext(): PAssistantContextValue {
  const ctx = useContext(PAssistantCtx)
  if (!ctx) throw new Error('usePAssistantContext must be used within PAssistantProvider')
  return ctx
}

// ─── Provider ──────────────────────────────────────────

export const PAssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Cookie 配置
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)

  // 组织节点选择
  const [rootOrganizations, setRootOrganizations] = useState<RootOrganizationOption[]>([])
  const [selectedRootEbpId, setSelectedRootEbpId] = useState(
    () => localStorage.getItem(SELECTED_ROOT_EBP_STORAGE_KEY) || ''
  )
  const [selectedOrgEbpId, setSelectedOrgEbpId] = useState(
    () => localStorage.getItem(SELECTED_ORG_EBP_STORAGE_KEY) || ''
  )
  const [selectedOrgName, setSelectedOrgName] = useState(
    () => localStorage.getItem(SELECTED_ORG_NAME_STORAGE_KEY) || ''
  )
  const [orgNodes, setOrgNodes] = useState<OrgNodeSelection[]>([])
  const [loadingOrgNodes, setLoadingOrgNodes] = useState(false)
  const [organizationError, setOrganizationError] = useState('')
  const hasHydratedSelectedConfigRef = useRef(false)

  // Tab
  const [activeTab, setActiveTab] = useState<PAssistantTabKey>(readSavedActiveTab)

  // 全局状态
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<PAssistantLogEntry[]>([])
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false)
  const [isJobCenterOpen, setIsJobCenterOpen] = useState(false)

  // 任务中心
  const [jobRefreshToken, setJobRefreshToken] = useState(0)
  const [focusedJobId, setFocusedJobId] = useState<number | null>(null)

  const addLog = useCallback((message: string, type: PAssistantLogEntry['type'] = 'info') => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }])
  }, [])

  const clearLogs = useCallback(() => setLogs([]), [])

  const handleAsyncJobCreated = useCallback((jobId: number) => {
    setFocusedJobId(jobId)
    setJobRefreshToken((prev) => prev + 1)
    setIsJobCenterOpen(true)
  }, [])

  const { activePAssistantJobId, runPAssistantJob } = usePAssistantJobRunner({
    addLog,
    onJobCreated: handleAsyncJobCreated,
    onJobTerminal: () => setJobRefreshToken((prev) => prev + 1)
  })

  const selectOrgNode = useCallback(
    (id: string): void => {
      setSelectedOrgEbpId(id)
      const selectedNode = orgNodes.find((node) => node.id === id)
      setSelectedOrgName(selectedNode?.name.trim() || '')
    },
    [orgNodes]
  )

  const loadOrgNodes = useCallback(
    async (preferredRootId?: string): Promise<void> => {
      if (!selectedConfigId) {
        setOrganizationError('请先选择 Cookie')
        return
      }

      setLoadingOrgNodes(true)
      setOrganizationError('')
      try {
        const rootsResult = await dataAssistantV2Service.getRootOrganizations(selectedConfigId)
        if (
          rootsResult.code !== 0 ||
          !Array.isArray(rootsResult.data) ||
          rootsResult.data.length === 0
        ) {
          setRootOrganizations([])
          setOrgNodes([])
          setSelectedOrgEbpId('')
          setSelectedOrgName('')
          setOrganizationError(rootsResult.msg || rootsResult.error || '获取根组织失败')
          return
        }

        const roots = rootsResult.data as RootOrganizationOption[]
        const rootEbpId = resolveRootEbpId(roots, preferredRootId ?? selectedRootEbpId)
        setRootOrganizations(roots)
        setSelectedRootEbpId(rootEbpId)

        if (!rootEbpId) {
          setOrgNodes([])
          setSelectedOrgEbpId('')
          setSelectedOrgName('')
          setOrganizationError('未找到可用的根组织')
          return
        }

        const treeResult = await dataAssistantV2Service.getOrganizationTree(selectedConfigId, rootEbpId)
        if (treeResult.code === 0 && treeResult.data) {
          const nodes = flattenOrgTreeNodes(treeResult.data)
          setOrgNodes(nodes)
          setSelectedOrgEbpId((prev) => {
            const selectedNode = nodes.find((node) => node.id === prev) || nodes[0]
            setSelectedOrgName(selectedNode?.name.trim() || '')
            return selectedNode?.id || ''
          })
        } else {
          setOrgNodes([])
          setSelectedOrgEbpId('')
          setSelectedOrgName('')
          setOrganizationError(treeResult.msg || treeResult.error || '获取组织节点失败')
        }
      } catch (err: unknown) {
        setRootOrganizations([])
        setOrgNodes([])
        setSelectedOrgEbpId('')
        setSelectedOrgName('')
        const errorMessage = err instanceof Error ? err.message : '获取组织节点失败'
        setOrganizationError(errorMessage)
      } finally {
        setLoadingOrgNodes(false)
      }
    },
    [selectedConfigId, selectedRootEbpId]
  )

  // 加载 Cookie 配置
  useEffect(() => {
    configService
      .getConfigsBySource(1, { forPAssistant: true })
      .then((data) => {
        setConfigs(data)
        if (data.length > 0) {
          const savedId = localStorage.getItem('p-assistant-selected-config-id')
          const savedNum = savedId ? parseInt(savedId, 10) : NaN
          const savedExists = !isNaN(savedNum) && data.some((c) => c.id === savedNum)
          setSelectedConfigId((prev) => {
            if (prev !== null && data.some((c) => c.id === prev)) return prev
            return savedExists ? savedNum : data[0].id
          })
        }
      })
      .catch((err) => {
        console.error('Failed to load configs:', err)
        addLog('加载配置失败', 'error')
      })
  }, [addLog])

  // 持久化 Cookie 配置选择
  useEffect(() => {
    if (selectedConfigId !== null) {
      localStorage.setItem('p-assistant-selected-config-id', String(selectedConfigId))
    }
  }, [selectedConfigId])

  useEffect(() => {
    if (!selectedConfigId) {
      setRootOrganizations([])
      setOrgNodes([])
      setOrganizationError('')
      return
    }
    if (!hasHydratedSelectedConfigRef.current) {
      hasHydratedSelectedConfigRef.current = true
      return
    }
    void loadOrgNodes()
  }, [selectedConfigId])

  useEffect(() => {
    if (selectedRootEbpId) {
      localStorage.setItem(SELECTED_ROOT_EBP_STORAGE_KEY, selectedRootEbpId)
    } else {
      localStorage.removeItem(SELECTED_ROOT_EBP_STORAGE_KEY)
    }
  }, [selectedRootEbpId])

  useEffect(() => {
    if (selectedOrgEbpId) {
      localStorage.setItem(SELECTED_ORG_EBP_STORAGE_KEY, selectedOrgEbpId)
    } else {
      localStorage.removeItem(SELECTED_ORG_EBP_STORAGE_KEY)
    }
  }, [selectedOrgEbpId])

  useEffect(() => {
    if (selectedOrgName) {
      localStorage.setItem(SELECTED_ORG_NAME_STORAGE_KEY, selectedOrgName)
    } else {
      localStorage.removeItem(SELECTED_ORG_NAME_STORAGE_KEY)
    }
  }, [selectedOrgName])

  // 持久化当前 Tab
  useEffect(() => {
    if (activeTab !== 'job-history') {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab)
    }
  }, [activeTab])

  const value: PAssistantContextValue = {
    configs,
    selectedConfigId,
    setSelectedConfigId,
    rootOrganizations,
    selectedRootEbpId,
    selectedOrgEbpId,
    selectedOrgName,
    orgNodes,
    loadingOrgNodes,
    organizationError,
    loadOrgNodes,
    selectOrgNode,
    setSelectedRootEbpId,
    activeTab,
    setActiveTab,
    loading,
    setLoading,
    error,
    setError,
    logs,
    addLog,
    clearLogs,
    isBottomPanelOpen,
    setIsBottomPanelOpen,
    isJobCenterOpen,
    setIsJobCenterOpen,
    runPAssistantJob,
    activePAssistantJobId,
    jobRefreshToken,
    focusedJobId
  }

  return <PAssistantCtx.Provider value={value}>{children}</PAssistantCtx.Provider>
}
