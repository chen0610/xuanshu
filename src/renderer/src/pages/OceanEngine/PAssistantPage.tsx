import React, { lazy, Suspense } from 'react'
import { CheckCircle, Loader2, RefreshCw, Settings } from 'lucide-react'
import { PAssistantProvider, usePAssistantContext, MIN_P_ASSISTANT_COOKIE_COUNT } from './pAssistant/PAssistantContext'
import { PAssistantSidebar } from './pAssistant/PAssistantSidebar'
import { PAssistantBottomPanel } from './pAssistant/PAssistantBottomPanel'
import { PAssistantJobCenter } from './PAssistantJobCenter'
import { Button } from '../../components/ui'
import { formatRootOrganizationLabel } from './pAssistant/shared/cleanupOrgConfig'
import type { PAssistantTabKey } from './pAssistantFeatures'

// ─── Tab 组件懒加载 ──────────────────────────────────

const lazyTab = (loader: () => Promise<{ [key: string]: React.FC }>, name: string) =>
  lazy(() => loader().then((m) => ({ default: m[name] })))

const RtaTab = lazyTab(() => import('./pAssistant/tabs/RtaTab'), 'RtaTab')
const RemarkTab = lazyTab(() => import('./pAssistant/tabs/RemarkTab'), 'RemarkTab')
const TagTab = lazyTab(() => import('./pAssistant/tabs/TagTab'), 'TagTab')
const ClearMaterialTab = lazyTab(() => import('./pAssistant/tabs/ClearMaterialTab'), 'ClearMaterialTab')
const AssetShareTab = lazyTab(() => import('./pAssistant/tabs/AssetShareTab'), 'AssetShareTab')
const MaterialShareTab = lazyTab(() => import('./pAssistant/tabs/MaterialShareTab'), 'MaterialShareTab')
const BidTab = lazyTab(() => import('./pAssistant/tabs/BidTab'), 'BidTab')
const ScheduleTab = lazyTab(() => import('./pAssistant/tabs/ScheduleTab'), 'ScheduleTab')
const BidOptimizeTab = lazyTab(() => import('./pAssistant/tabs/BidOptimizeTab'), 'BidOptimizeTab')
const AccountBiddingBudgetTab = lazyTab(() => import('./pAssistant/tabs/AccountBiddingBudgetTab'), 'AccountBiddingBudgetTab')
const ProjectBudgetTab = lazyTab(() => import('./pAssistant/tabs/ProjectBudgetTab'), 'ProjectBudgetTab')
const ProjectRoiTab = lazyTab(() => import('./pAssistant/tabs/ProjectRoiTab'), 'ProjectRoiTab')
const ProjectBoostTab = lazyTab(() => import('./pAssistant/tabs/ProjectBoostTab'), 'ProjectBoostTab')
const ProjectToggleTab = lazyTab(() => import('./pAssistant/tabs/ProjectToggleTab'), 'ProjectToggleTab')
const AccountNameModifyTab = lazyTab(() => import('./pAssistant/tabs/AccountNameModifyTab'), 'AccountNameModifyTab')
const AccountAvatarTab = lazyTab(() => import('./pAssistant/tabs/AccountAvatarTab'), 'AccountAvatarTab')
const UnitScheduleTab = lazyTab(() => import('./pAssistant/tabs/UnitScheduleTab'), 'UnitScheduleTab')
const AdCleanupTab = lazyTab(() => import('./pAssistant/tabs/AdCleanupTab'), 'AdCleanupTab')
const ProjectCleanupTab = lazyTab(() => import('./pAssistant/tabs/ProjectCleanupTab'), 'ProjectCleanupTab')
const MaterialCleanupTab = lazyTab(() => import('./pAssistant/tabs/MaterialCleanupTab'), 'MaterialCleanupTab')
const EmptyProjectCleanupTab = lazyTab(() => import('./pAssistant/tabs/EmptyProjectCleanupTab'), 'EmptyProjectCleanupTab')

/** Tab key → 懒加载组件映射 */
const TAB_COMPONENTS: Record<PAssistantTabKey, React.LazyExoticComponent<React.FC> | React.FC> = {
  rta: RtaTab,
  remark: RemarkTab,
  tag: TagTab,
  'clear-material': ClearMaterialTab,
  'asset-share': AssetShareTab,
  'material-share': MaterialShareTab,
  bid: BidTab,
  schedule: ScheduleTab,
  'bid-optimize': BidOptimizeTab,
  'account-bidding-budget': AccountBiddingBudgetTab,
  'project-budget': ProjectBudgetTab,
  'project-roi': ProjectRoiTab,
  'project-boost': ProjectBoostTab,
  'project-toggle': ProjectToggleTab,
  'account-name-modify': AccountNameModifyTab,
  'account-avatar': AccountAvatarTab,
  'unit-schedule': UnitScheduleTab,
  'ad-cleanup': AdCleanupTab,
  'project-cleanup': ProjectCleanupTab,
  'material-cleanup': MaterialCleanupTab,
  'empty-project-cleanup': EmptyProjectCleanupTab,
  'job-history': () => null
}

// ─── 页面内部 ──────────────────────────────────────────

function PAssistantInner(): React.JSX.Element {
  const {
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
    error,
    jobRefreshToken,
    focusedJobId,
    isJobCenterOpen,
    setIsJobCenterOpen
  } = usePAssistantContext()

  const ActiveTabComponent = TAB_COMPONENTS[activeTab] ?? (() => null)

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* 全局错误提示 */}
      {error && (
        <div className="mx-4 mt-2 rounded-lg border bg-destructive/10 p-3 text-sm text-destructive border-destructive/20">
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧功能导航 */}
        <PAssistantSidebar activeTab={activeTab} onSelect={setActiveTab} />

        {/* 右侧内容区 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Cookie 与组织选择栏 */}
          <CookieConfigBar
            configs={configs}
            selectedConfigId={selectedConfigId}
            onSelect={setSelectedConfigId}
          />
          <OrganizationConfigBar
            rootOrganizations={rootOrganizations}
            selectedRootEbpId={selectedRootEbpId}
            selectedOrgEbpId={selectedOrgEbpId}
            selectedOrgName={selectedOrgName}
            orgNodes={orgNodes}
            loadingOrgNodes={loadingOrgNodes}
            error={organizationError}
            hasSelectedConfig={!!selectedConfigId}
            onRefresh={() => void loadOrgNodes()}
            onRootChange={(rootId) => {
              setSelectedRootEbpId(rootId)
              void loadOrgNodes(rootId)
            }}
            onOrgChange={selectOrgNode}
          />

          {/* Tab 内容 */}
          <div className="flex-1 overflow-y-auto p-6">
            <Suspense
              fallback={
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <ActiveTabComponent />
            </Suspense>
          </div>

          {/* 操作日志底栏 */}
          <PAssistantBottomPanel />
        </div>
      </div>

      {/* 任务记录：右侧全高抽屉 */}
      <PAssistantJobCenter
        refreshToken={jobRefreshToken}
        focusJobId={focusedJobId}
        isOpen={isJobCenterOpen}
        onOpen={() => setIsJobCenterOpen(true)}
        onClose={() => setIsJobCenterOpen(false)}
      />
    </div>
  )
}

// ─── Cookie 配置选择栏 ──────────────────────────────────

function CookieConfigBar({
  configs,
  selectedConfigId,
  onSelect
}: {
  configs: { id: number; cookie_name: string; realname?: string }[]
  selectedConfigId: number | null
  onSelect: (id: number | null) => void
}) {
  if (configs.length === 0) {
    return (
      <div className="flex-shrink-0 border-b border-border/70 bg-muted/20 px-6 py-3">
        <p className="text-sm text-muted-foreground">
          暂无可用 Cookie 配置（需在配置页添加 Cookie 数量大于 {MIN_P_ASSISTANT_COOKIE_COUNT} 个的巨量账号）
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-shrink-0 items-center gap-3 overflow-x-auto border-b border-border/70 bg-muted/10 px-6 py-2.5">
      <span className="flex-shrink-0 text-xs font-medium text-muted-foreground">
        <Settings className="mr-1 inline h-3.5 w-3.5" />
        Cookie
      </span>
      {configs.map((config) => {
        const isActive = selectedConfigId === config.id
        return (
          <button
            key={config.id}
            type="button"
            onClick={() => onSelect(config.id)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
              isActive
                ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                : 'border-border/70 text-muted-foreground hover:border-primary/40 hover:bg-accent/40'
            }`}
          >
            {isActive && <CheckCircle className="h-3 w-3 text-primary" />}
            <span className="truncate max-w-[120px]">{config.cookie_name}</span>
            {config.realname && (
              <span className="text-[10px] text-muted-foreground">({config.realname})</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── 组织选择栏 ────────────────────────────────────────

function OrganizationConfigBar({
  rootOrganizations,
  selectedRootEbpId,
  selectedOrgEbpId,
  selectedOrgName,
  orgNodes,
  loadingOrgNodes,
  error,
  hasSelectedConfig,
  onRefresh,
  onRootChange,
  onOrgChange
}: {
  rootOrganizations: { rootId: string; rootName?: string; companyName?: string }[]
  selectedRootEbpId: string
  selectedOrgEbpId: string
  selectedOrgName: string
  orgNodes: { id: string; name: string }[]
  loadingOrgNodes: boolean
  error: string
  hasSelectedConfig: boolean
  onRefresh: () => void
  onRootChange: (id: string) => void
  onOrgChange: (id: string) => void
}) {
  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-border/70 bg-background px-6 py-2.5">
      <span className="flex-shrink-0 text-xs font-medium text-muted-foreground">组织</span>
      {rootOrganizations.length > 1 && (
        <select
          value={selectedRootEbpId}
          onChange={(event) => onRootChange(event.target.value)}
          disabled={loadingOrgNodes}
          className="h-8 min-w-[180px] rounded-md border border-input bg-background px-2 text-xs"
        >
          {rootOrganizations.map((root) => (
            <option key={root.rootId} value={root.rootId}>
              {formatRootOrganizationLabel(root)}
            </option>
          ))}
        </select>
      )}
      <select
        value={selectedOrgEbpId}
        onChange={(event) => onOrgChange(event.target.value)}
        disabled={!hasSelectedConfig || loadingOrgNodes || (!selectedOrgEbpId && orgNodes.length === 0)}
        className="h-8 min-w-[220px] rounded-md border border-input bg-background px-2 text-xs"
      >
        {loadingOrgNodes ? (
          <option value="">正在加载组织...</option>
        ) : orgNodes.length === 0 ? (
          <option value={selectedOrgEbpId}>
            {selectedOrgEbpId
              ? `${selectedOrgName || selectedOrgEbpId}（${selectedOrgEbpId}）`
              : '请刷新组织后选择'}
          </option>
        ) : (
          orgNodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.name}（{node.id}）
            </option>
          ))
        )}
      </select>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={!hasSelectedConfig || loadingOrgNodes}
        className="h-8 px-2 text-xs"
      >
        {loadingOrgNodes ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
        )}
        刷新组织
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

// ─── 导出 ────────────────────────────────────────────

export const PAssistantPage: React.FC = () => {
  return (
    <PAssistantProvider>
      <PAssistantInner />
    </PAssistantProvider>
  )
}
