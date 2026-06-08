import {
  Activity,
  Clock,
  Copy,
  FileText,
  FolderX,
  ImagePlus,
  Percent,
  RefreshCw,
  Scissors,
  Tag,
  Trash2,
  TrendingUp,
  Wallet,
  Zap
} from 'lucide-react'
import type React from 'react'

export type PAssistantTabKey =
  | 'rta'
  | 'remark'
  | 'tag'
  | 'clear-material'
  | 'asset-share'
  | 'material-share'
  | 'bid'
  | 'schedule'
  | 'bid-optimize'
  | 'account-bidding-budget'
  | 'project-budget'
  | 'project-roi'
  | 'project-boost'
  | 'project-toggle'
  | 'account-name-modify'
  | 'account-avatar'
  | 'unit-schedule'
  | 'ad-cleanup'
  | 'project-cleanup'
  | 'material-cleanup'
  | 'empty-project-cleanup'
  | 'job-history'

export type PAssistantFeatureGroup = 'delivery' | 'asset' | 'account' | 'cleanup'

export interface PAssistantFeature {
  key: PAssistantTabKey
  label: string
  shortLabel?: string
  group: PAssistantFeatureGroup
  description: string
  keywords: string[]
  icon: React.ComponentType<{ className?: string }>
  badges?: string[]
  danger?: boolean
}

export const P_ASSISTANT_FEATURE_GROUPS: Array<{
  key: PAssistantFeatureGroup | 'all'
  label: string
}> = [
  { key: 'all', label: '全部操作' },
  { key: 'delivery', label: '投放调控' },
  { key: 'asset', label: '素材资产' },
  { key: 'account', label: '账户设置' },
  { key: 'cleanup', label: '清理治理' }
]

export const P_ASSISTANT_FEATURES: PAssistantFeature[] = [
  {
    key: 'bid',
    label: '深度出价修改',
    shortLabel: '深度出价',
    group: 'delivery',
    description: '批量调整账户下深度转化目标出价。',
    keywords: ['深度出价', '出价', 'bid', '转化'],
    icon: Percent,
    badges: ['批量修改']
  },
  {
    key: 'schedule',
    label: '投放时段优化',
    shortLabel: '时段优化',
    group: 'delivery',
    description: '按周时间网格批量设置投放时段。',
    keywords: ['时段', '投放', '排期', 'schedule'],
    icon: Clock,
    badges: ['时段']
  },
  {
    key: 'bid-optimize',
    label: '出价修改',
    group: 'delivery',
    description: '按筛选条件批量修改项目或广告出价。',
    keywords: ['出价', '修改', '优化', 'bid'],
    icon: TrendingUp,
    badges: ['筛选']
  },
  {
    key: 'project-budget',
    label: '项目预算修改',
    shortLabel: '项目预算',
    group: 'delivery',
    description: '按账户或项目维度批量调整项目预算。',
    keywords: ['项目', '预算', 'budget'],
    icon: Wallet,
    badges: ['批量修改']
  },
  {
    key: 'project-roi',
    label: '项目ROI修改',
    shortLabel: '项目ROI',
    group: 'delivery',
    description: '按账户或项目维度批量修改 ROI 目标。',
    keywords: ['项目', 'roi', '目标'],
    icon: Percent,
    badges: ['批量修改']
  },
  {
    key: 'project-boost',
    label: '项目起量',
    shortLabel: '项目起量',
    group: 'delivery',
    description: '批量调整项目预算与结束时间，辅助项目起量。',
    keywords: ['项目', '起量', '预算', '结束时间'],
    icon: Zap,
    badges: ['批量修改']
  },
  {
    key: 'project-toggle',
    label: '项目启停',
    shortLabel: '项目启停',
    group: 'delivery',
    description: '按标签或账户维度批量暂停、开启项目。',
    keywords: ['项目', '启停', '暂停', '开启'],
    icon: RefreshCw,
    badges: ['高影响'],
    danger: true
  },
  {
    key: 'unit-schedule',
    label: '单元预约投放',
    shortLabel: '单元预约',
    group: 'delivery',
    description: '批量获取暂停单元并预约恢复投放。',
    keywords: ['单元', '预约', '投放', '暂停'],
    icon: Clock,
    badges: ['异步任务']
  },
  {
    key: 'asset-share',
    label: '资产共享',
    shortLabel: '资产共享',
    group: 'asset',
    description: '将主资产账户中的资产批量共享到目标账户。',
    keywords: ['资产', '共享', '主账户'],
    icon: FolderX,
    badges: ['批量共享']
  },
  {
    key: 'material-share',
    label: '素材共享',
    shortLabel: '素材共享',
    group: 'asset',
    description: '按组织与素材 ID 批量共享素材。',
    keywords: ['素材', '共享', '组织'],
    icon: Copy,
    badges: ['批量共享']
  },
  {
    key: 'clear-material',
    label: '清空素材',
    shortLabel: '清空素材',
    group: 'asset',
    description: '批量清空账户素材，适合素材治理场景。',
    keywords: ['清空', '素材', '治理'],
    icon: Trash2,
    badges: ['高风险'],
    danger: true
  },
  {
    key: 'rta',
    label: 'RTA绑定',
    group: 'account',
    description: '批量绑定或检查账户 RTA 设置。',
    keywords: ['rta', '绑定', '检查'],
    icon: Zap,
    badges: ['检查']
  },
  {
    key: 'remark',
    label: '备注修改',
    shortLabel: '备注修改',
    group: 'account',
    description: '批量覆盖或追加账户备注，支持自增和日期。',
    keywords: ['备注', '修改', '追加', '自增'],
    icon: FileText,
    badges: ['批量修改']
  },
  // {
  //   key: 'tag',
  //   label: '标签修改',
  //   shortLabel: '标签',
  //   group: 'account',
  //   description: '批量添加或删除账户标签。',
  //   keywords: ['标签', 'tag', '添加', '删除'],
  //   icon: Tag,
  //   badges: ['批量修改']
  // },
  {
    key: 'account-bidding-budget',
    label: '账户预算修改',
    shortLabel: '账户预算',
    group: 'account',
    description: '批量设置账户竞价预算为不限或指定金额。',
    keywords: ['账户', '预算', '竞价'],
    icon: Wallet,
    badges: ['批量修改']
  },
  {
    key: 'account-name-modify',
    label: '账户名称修改',
    shortLabel: '账户名称',
    group: 'account',
    description: '批量修改账户名称，并校验账户与名称数量一致。',
    keywords: ['账户', '名称', '修改'],
    icon: FileText,
    badges: ['批量修改']
  },
  {
    key: 'account-avatar',
    label: '设置账户头像',
    shortLabel: '账户头像',
    group: 'account',
    description: '通过 OAuth 授权组织批量上传并应用账户头像。',
    keywords: ['账户', '头像', 'oauth', '图片'],
    icon: ImagePlus,
    badges: ['OAuth']
  },
  {
    key: 'project-cleanup',
    label: '项目清理',
    shortLabel: '项目清理',
    group: 'cleanup',
    description: '按时长、消耗、转化和状态筛选项目，预览后删除。',
    keywords: ['项目', '清理', '删除', '预览'],
    icon: Trash2,
    badges: ['支持预览', '高风险'],
    danger: true
  },
  {
    key: 'ad-cleanup',
    label: '广告清理',
    shortLabel: '广告清理',
    group: 'cleanup',
    description: '按时长、消耗、转化和状态筛选广告，预览后删除。',
    keywords: ['广告', '清理', '删除', '预览'],
    icon: Trash2,
    badges: ['支持预览', '高风险'],
    danger: true
  },
  {
    key: 'material-cleanup',
    label: '在投素材清理',
    shortLabel: '在投素材清理',
    group: 'cleanup',
    description: '清理低效在投素材或指定创意 ID。',
    keywords: ['素材', '清理', '创意', '低效'],
    icon: Scissors,
    badges: ['异步任务'],
    danger: true
  },
  {
    key: 'empty-project-cleanup',
    label: '空项目清理',
    shortLabel: '空项目清理',
    group: 'cleanup',
    description: '扫描项目与广告，识别空项目并同步删除（多Cookie）。',
    keywords: ['空项目', '清理', '项目'],
    icon: FolderX,
    badges: ['异步任务'],
    danger: true
  }
]

export const MAX_RECENT_FEATURES = 4
export const RECENT_FEATURE_STORAGE_KEY = 'p-assistant-recent-features'

export function getPAssistantFeatureByKey(key: PAssistantTabKey): PAssistantFeature | undefined {
  return P_ASSISTANT_FEATURES.find((feature) => feature.key === key)
}

export function isPAssistantFeatureKey(key: string): key is PAssistantTabKey {
  return P_ASSISTANT_FEATURES.some((feature) => feature.key === key) || key === 'job-history'
}

export function filterPAssistantFeatures(
  searchText: string,
  selectedGroup: PAssistantFeatureGroup | 'all'
): PAssistantFeature[] {
  const normalizedSearch = searchText.trim().toLowerCase()

  return P_ASSISTANT_FEATURES.filter((feature) => {
    const matchesGroup = selectedGroup === 'all' || feature.group === selectedGroup
    const matchesSearch =
      !normalizedSearch ||
      [feature.label, feature.shortLabel, feature.description, ...feature.keywords]
        .filter(Boolean)
        .some((text) => text?.toLowerCase().includes(normalizedSearch))

    return matchesGroup && matchesSearch
  })
}
