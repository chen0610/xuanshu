import type { ReactNode } from 'react'
import type { SidebarConfig } from './sidebar'
import { oceanEngineSidebarConfig, tencentAdsSidebarConfig, changduSidebarConfig } from './sidebar'

// ─── 页面导入：巨量助手 ─────────────────────────────────
import { OverviewPage } from '../pages/OceanEngine/OverviewPage'
import { BidManagementPage } from '../pages/OceanEngine/BidManagementPage'
import { AdOptimizePage } from '../pages/OceanEngine/AdOptimizePage'
import { AdBoostPage } from '../pages/OceanEngine/AdBoostPage'
import { ScheduledTasksPage } from '../pages/OceanEngine/ScheduledTasksPage'
import { DataAssistantPage } from '../pages/OceanEngine/DataAssistantPage'
import { DataAssistantPageV2 } from '../pages/OceanEngine/DataAssistantPageV2'
import { DataControlPage } from '../pages/OceanEngine/DataControlPage'
import { VideoAnalysisPage } from '../pages/OceanEngine/VideoAnalysisPage'
import { DataPanelPage } from '../pages/OceanEngine/DataPanelPage'
import { DataAnalysisPage } from '../pages/OceanEngine/DataAnalysisPage'
import { OpenApiReportPage } from '../pages/OceanEngine/OpenApiReportPage'
import { MaterialCleanupPage } from '../pages/OceanEngine/MaterialCleanupPage'
import { ArpuEstimatePage } from '../pages/OceanEngine/ArpuEstimatePage'
import { EmptyProjectCleanupPage } from '../pages/OceanEngine/EmptyProjectCleanupPage'
import { PAssistantPage } from '../pages/OceanEngine/PAssistantPage'
import { BatchAdCreateHubPage } from '../pages/OceanEngine/BatchAdCreateHubPage'
import { VideoMaterialUploadPage } from '../pages/OceanEngine/VideoMaterialUploadPage'
import { SharedMaterialLibraryPage } from '../pages/OceanEngine/SharedMaterialLibraryPage'
import { OceanEngineAppsPage } from '../pages/OceanEngine/OceanEngineAppsPage'
import { OceanEngineGatewayPage } from '../pages/OceanEngine/OceanEngineGatewayPage'

// ─── 页面导入：腾讯助手 ─────────────────────────────────
import { TencentAdsOverviewPage } from '../pages/TencentAds/OverviewPage'
import { BatchAssistantPage } from '../pages/TencentAds/BatchAssistantPage'
import { AutoAcquisitionPage } from '../pages/TencentAds/AutoAcquisitionPage'
import { MaterialExtractionPage } from '../pages/TencentAds/MaterialExtractionPage'
import { AccountRemarkPage } from '../pages/TencentAds/AccountRemarkPage'
import { RTAPage } from '../pages/TencentAds/RTAPage'
import { ConversionAttributionPage } from '../pages/TencentAds/ConversionAttributionPage'
import { TencentAdsPage } from '../pages/TencentAds/TencentAdsPage'
import { TencentAdsScheduledTasksPage } from '../pages/TencentAds/ScheduledTasksPage'
import { TencentAdsDataControlPage } from '../pages/TencentAds/DataControlPage'
import { ScheduleManagementPage } from '../pages/TencentAds/ScheduleManagementPage'
import { TencentAdsDataAssistantPage } from '../pages/TencentAds/DataAssistantPage'
import { SearchAdCreatePage } from '../pages/TencentAds/SearchAdCreatePage'
import { MaterialStatisticsPage } from '../pages/TencentAds/MaterialStatisticsPage'
import { AccountAdClearPage } from '../pages/TencentAds/AccountAdClearPage'
import { CreativeAssetPage } from '../pages/TencentAds/CreativeAssetPage'

// ─── 页面导入：常读助手 ─────────────────────────────────
import { ChangduBatchUploadPage } from '../pages/Changdu/BatchUploadPage'
import { ShortDramaListPage } from '../pages/Changdu/ShortDramaListPage'
import { MaterialManagePage } from '../pages/Changdu/MaterialManagePage'
import { ManjuListPage } from '../pages/Changdu/ManjuListPage'
import { PromotionListPage } from '../pages/Changdu/PromotionListPage'
import { ChangduScheduledTasksPage } from '../pages/Changdu/ChangduScheduledTasksPage'

// ─── 页面导入：通用 ──────────────────────────────────────
import { DashboardPage } from '../pages/Dashboard/DashboardPage'
import { UsersPage } from '../pages/Users/UsersPage'
import { ConfigPage } from '../pages/Config/ConfigPage'

// ─── 路由类型 ────────────────────────────────────────────

/** 权限守卫类型 */
export type RouteGuard = 'admin-or-manager' | 'changdu-admin' | 'ocean-batch-ad-create'

/** 带侧边栏的模块路由 */
export interface SidebarRouteItem {
  /** 相对于模块根路径的子路径，空字符串 = 模块首页 */
  subPath: string
  element: ReactNode
  /** MainLayout 是否使用 wide 模式 */
  wide?: boolean
  /** 权限守卫 */
  guard?: RouteGuard
}

/** 侧边栏模块路由组 */
export interface SidebarModuleRoutes {
  /** 模块根路径，如 /ocean-engine */
  basePath: string
  sidebarConfig: SidebarConfig
  routes: SidebarRouteItem[]
}

/** 无侧边栏的独立路由 */
export interface StandaloneRoute {
  path: string
  element: ReactNode
  /** 权限守卫 */
  guard?: RouteGuard
}

// ─── 巨量助手路由 ────────────────────────────────────────

export const oceanEngineRoutes: SidebarModuleRoutes = {
  basePath: '/ocean-engine',
  sidebarConfig: oceanEngineSidebarConfig,
  routes: [
    { subPath: '', element: <OverviewPage /> },
    { subPath: 'bid-management', element: <BidManagementPage /> },
    { subPath: 'ad-optimize', element: <AdOptimizePage /> },
    { subPath: 'ad-boost', element: <AdBoostPage /> },
    { subPath: 'scheduled-tasks', element: <ScheduledTasksPage /> },
    { subPath: 'data-assistant', element: <DataAssistantPage /> },
    { subPath: 'data-assistant-v2', element: <DataAssistantPageV2 /> },
    { subPath: 'data-control', element: <DataControlPage />, wide: true },
    { subPath: 'video-analysis', element: <VideoAnalysisPage />, wide: true },
    { subPath: 'data-panel', element: <DataPanelPage /> },
    { subPath: 'data-analysis', element: <DataAnalysisPage /> },
    { subPath: 'openapi-report', element: <OpenApiReportPage /> },
    { subPath: 'material-cleanup', element: <MaterialCleanupPage /> },
    { subPath: 'arpu-estimate', element: <ArpuEstimatePage /> },
    { subPath: 'empty-project-cleanup', element: <EmptyProjectCleanupPage /> },
    { subPath: 'p-assistant', element: <PAssistantPage /> },
    {
      subPath: 'batch-ad-create',
      element: <BatchAdCreateHubPage />,
      guard: 'ocean-batch-ad-create'
    },
    { subPath: 'video-material-upload', element: <VideoMaterialUploadPage /> },
    { subPath: 'shared-material-library', element: <SharedMaterialLibraryPage /> },
    { subPath: 'open-platform-apps', element: <OceanEngineAppsPage /> },
    { subPath: 'gateway-monitor', element: <OceanEngineGatewayPage /> }
  ]
}

// ─── 腾讯助手路由 ────────────────────────────────────────

export const tencentAdsRoutes: SidebarModuleRoutes = {
  basePath: '/tencent-ads',
  sidebarConfig: tencentAdsSidebarConfig,
  routes: [
    { subPath: '', element: <TencentAdsOverviewPage /> },
    { subPath: 'batch-assistant', element: <BatchAssistantPage /> },
    { subPath: 'auto-acquisition', element: <AutoAcquisitionPage /> },
    { subPath: 'material-extraction', element: <MaterialExtractionPage /> },
    { subPath: 'account-remark', element: <AccountRemarkPage /> },
    { subPath: 'rta', element: <RTAPage /> },
    { subPath: 'conversion-attribution', element: <ConversionAttributionPage /> },
    { subPath: 'bid-management', element: <TencentAdsPage /> },
    { subPath: 'scheduled-tasks', element: <TencentAdsScheduledTasksPage /> },
    { subPath: 'data-control', element: <TencentAdsDataControlPage /> },
    { subPath: 'schedule-management', element: <ScheduleManagementPage /> },
    { subPath: 'data-assistant', element: <TencentAdsDataAssistantPage /> },
    { subPath: 'search-ad-create', element: <SearchAdCreatePage /> },
    { subPath: 'material-statistics', element: <MaterialStatisticsPage /> },
    { subPath: 'account-ad-clear', element: <AccountAdClearPage /> },
    { subPath: 'creative-assets', element: <CreativeAssetPage /> }
  ]
}

// ─── 常读助手路由 ────────────────────────────────────────

export const changduRoutes: SidebarModuleRoutes = {
  basePath: '/changdu',
  sidebarConfig: changduSidebarConfig,
  routes: [
    { subPath: 'batch-upload', element: <ChangduBatchUploadPage />, guard: 'changdu-admin' },
    { subPath: 'short-drama-list', element: <ShortDramaListPage /> },
    { subPath: 'material-manage', element: <MaterialManagePage /> },
    { subPath: 'promotion-list', element: <PromotionListPage /> },
    { subPath: 'manju-list', element: <ManjuListPage /> },
    { subPath: 'scheduled-tasks', element: <ChangduScheduledTasksPage /> }
  ]
}

// ─── 独立路由（不带侧边栏） ──────────────────────────────

export const standaloneRoutes: StandaloneRoute[] = [
  { path: '/dashboard', element: <DashboardPage /> },
  { path: '/users', element: <UsersPage />, guard: 'admin-or-manager' },
  { path: '/config', element: <ConfigPage /> }
]

// ─── 所有侧边栏模块 ─────────────────────────────────────

export const sidebarModules: SidebarModuleRoutes[] = [
  oceanEngineRoutes,
  tencentAdsRoutes,
  changduRoutes
]
