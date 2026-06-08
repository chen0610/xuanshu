import type { ComponentType } from 'react'
import {
  Activity,
  BarChart,
  BarChart3,
  BookOpen,
  Clapperboard,
  Clock,
  Fence,
  Film,
  FolderTree,
  LayoutDashboard,
  Link2,
  Megaphone,
  PackageSearch,
  PieChart,
  PlusCircle,
  PlugZap,
  Radar,
  Satellite,
  Settings,
  Table2,
  Upload
} from 'lucide-react'
import type { User } from '../types/user.types'
import { canUseOceanEngineBatchAdCreate } from '../lib/ocean-engine-permissions'

// ─── 类型定义 ───────────────────────────────────────────

export interface SidebarItem {
  path: string
  label: string
  icon: ComponentType<{ className?: string }>
  /** 自定义可见性判断，返回 false 则隐藏 */
  visible?: (user: User | null) => boolean
}

export interface SidebarGroup {
  label: string
  items: SidebarItem[]
}

export interface SidebarConfig {
  /** localStorage 持久化 key */
  storageKey: string
  /** 展开时显示的标题 */
  title: string
  /** 展开时显示的副标题 */
  subtitle: string
  /** 折叠时显示的图标 */
  icon: ComponentType<{ className?: string }>
  /** nav 区域上方的分类标签 */
  sectionLabel: string
  /** 主题 CSS 类名 */
  themeClass: string
  /** 菜单分组 */
  groups: SidebarGroup[]
}

// ─── 权限工具 ─────────────────────────────────────────

const adminOnly = (user: User | null): boolean => user?.role === 'admin'

const batchAdCreatePermission = (user: User | null): boolean =>
  canUseOceanEngineBatchAdCreate(user)

// ─── 巨量助手配置 ──────────────────────────────────────

export const oceanEngineSidebarConfig: SidebarConfig = {
  storageKey: 'ocean-engine-sidebar-collapsed',
  title: '巨量助手',
  subtitle: '投放、分析与任务协同',
  icon: Activity,
  sectionLabel: 'Ocean Engine',
  themeClass: 'theme-ocean',
  groups: [
    {
      label: '概览',
      items: [{ path: '/ocean-engine', label: '功能概览', icon: LayoutDashboard }]
    },
    {
      label: '数据分析',
      items: [
        // { path: '/ocean-engine/data-panel', label: '数据面板', icon: Fence },
        // { path: '/ocean-engine/data-analysis', label: '数据分析', icon: BarChart },
        // { path: '/ocean-engine/openapi-report', label: 'OpenAPI 报表', icon: Table2 },
        // { path: '/ocean-engine/data-assistant', label: '数据助手', icon: BarChart3 },
        { path: '/ocean-engine/data-assistant-v2', label: '数据助手(升级版)', icon: BarChart3 },
        { path: '/ocean-engine/data-control', label: '数据调控', icon: PieChart },
        { path: '/ocean-engine/video-analysis', label: '视频分析', icon: Clapperboard }
      ]
    },
    {
      label: '批量操作',
      items: [
        { path: '/ocean-engine/p-assistant', label: '批量助手', icon: Settings },
        {
          path: '/ocean-engine/batch-ad-create',
          label: '广告批量创建',
          icon: Megaphone,
          visible: batchAdCreatePermission
        }
      ]
    },
    {
      label: '素材管理',
      items: [
        { path: '/ocean-engine/video-material-upload', label: '巨量素材上传', icon: Upload },
        { path: '/ocean-engine/shared-material-library', label: '共享素材库', icon: FolderTree }
      ]
    },
    {
      label: '系统管理',
      items: [
        {
          path: '/ocean-engine/open-platform-apps',
          label: '授权端口管理',
          icon: PlugZap,
          visible: adminOnly
        },
        {
          path: '/ocean-engine/gateway-monitor',
          label: 'Gateway 监控',
          icon: Radar,
          visible: adminOnly
        },
        { path: '/ocean-engine/scheduled-tasks', label: '定时任务', icon: Clock }
      ]
    }
  ]
}

// ─── 腾讯助手配置 ──────────────────────────────────────

export const tencentAdsSidebarConfig: SidebarConfig = {
  storageKey: 'tencent-ads-sidebar-collapsed',
  title: '腾讯助手',
  subtitle: '投放、素材与任务工作台',
  icon: Satellite,
  sectionLabel: 'Tencent Ads',
  themeClass: 'theme-tencent',
  groups: [
    {
      label: '概览',
      items: [{ path: '/tencent-ads', label: '功能概览', icon: LayoutDashboard }]
    },
    {
      label: '批量操作',
      items: [
        { path: '/tencent-ads/batch-assistant', label: '批量助手', icon: Settings },
        { path: '/tencent-ads/search-ad-create', label: '搜索广告创建', icon: PlusCircle }
      ]
    },
    {
      label: '数据分析',
      items: [
        { path: '/tencent-ads/data-control', label: '数据调控', icon: PieChart },
        { path: '/tencent-ads/material-statistics', label: '素材统计', icon: BarChart3 }
      ]
    },
    {
      label: '系统管理',
      items: [{ path: '/tencent-ads/scheduled-tasks', label: '定时任务', icon: Clock }]
    }
  ]
}

// ─── 常读助手配置 ──────────────────────────────────────

export const changduSidebarConfig: SidebarConfig = {
  storageKey: 'changdu-sidebar-collapsed',
  title: '常读助手',
  subtitle: '上传、内容与任务协同',
  icon: BookOpen,
  sectionLabel: 'Changdu',
  themeClass: 'theme-ocean',
  groups: [
    {
      label: '内容管理',
      items: [
        {
          path: '/changdu/batch-upload',
          label: '批量上传',
          icon: Upload,
          visible: adminOnly
        },
        { path: '/changdu/short-drama-list', label: '常读漫剧列表(实时)', icon: Clapperboard },
        { path: '/changdu/material-manage', label: '素材管理', icon: PackageSearch },
        { path: '/changdu/promotion-list', label: '推广链接列表', icon: Link2 },
        { path: '/changdu/manju-list', label: '漫剧列表', icon: Film }
      ]
    },
    {
      label: '系统管理',
      items: [{ path: '/changdu/scheduled-tasks', label: '定时任务', icon: Clock }]
    }
  ]
}
