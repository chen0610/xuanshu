import {
  Clock,
  DollarSign,
  FileText,
  Rocket,
  Settings,
  Tag,
  Target,
  Trash2,
  type LucideIcon
} from 'lucide-react'

export type TencentBatchAssistantFeatureGroup = 'delivery' | 'account' | 'asset' | 'advanced'

export interface TencentBatchAssistantFeature {
  key: string
  title: string
  description: string
  group: TencentBatchAssistantFeatureGroup
  path: string
  icon: LucideIcon
  keywords: string[]
  badges?: string[]
}

export const TENCENT_BATCH_ASSISTANT_GROUPS: Array<{
  key: TencentBatchAssistantFeatureGroup | 'all'
  label: string
}> = [
  { key: 'all', label: '全部操作' },
  { key: 'delivery', label: '投放调控' },
  { key: 'account', label: '账户设置' },
  { key: 'asset', label: '素材处理' },
  { key: 'advanced', label: '高级配置' }
]

export const TENCENT_BATCH_ASSISTANT_FEATURES: TencentBatchAssistantFeature[] = [
  {
    key: 'auto-acquisition',
    title: '一键起量',
    description: '批量开启或关闭广告组，快速调整投放状态。',
    group: 'delivery',
    path: '/tencent-ads/auto-acquisition',
    icon: Rocket,
    keywords: ['起量', '广告组', '开启', '关闭'],
    badges: ['高频批量']
  },
  {
    key: 'bid-management',
    title: '广告出价修改',
    description: '批量修改广告出价和成本控制策略。',
    group: 'delivery',
    path: '/tencent-ads/bid-management',
    icon: DollarSign,
    keywords: ['出价', '成本', '广告', '批量'],
    badges: ['高频批量']
  },
  {
    key: 'schedule-management',
    title: '修改投放时间',
    description: '管理投放日期、时段和计划节奏。',
    group: 'delivery',
    path: '/tencent-ads/schedule-management',
    icon: Clock,
    keywords: ['投放时间', '日期', '时段', '排期'],
    badges: ['时间策略']
  },
  {
    key: 'account-remark',
    title: '修改备注标签',
    description: '统一维护账户备注、标签和自动编号。',
    group: 'account',
    path: '/tencent-ads/account-remark',
    icon: Tag,
    keywords: ['备注', '标签', '账户', '编号'],
    badges: ['账户设置']
  },
  {
    key: 'account-ad-clear',
    title: '账户广告清空',
    description: '批量清空账号下的展示广告或智能投放营销单元。',
    group: 'account',
    path: '/tencent-ads/account-ad-clear',
    icon: Trash2,
    keywords: ['清空', '删除', '广告', '营销单元', '账户'],
    badges: ['高风险', '异步任务']
  },
  {
    key: 'rta',
    title: '修改 RTA',
    description: '批量修改账户 RTA 与相关投放设置。',
    group: 'account',
    path: '/tencent-ads/rta',
    icon: Settings,
    keywords: ['RTA', '账户', '策略', '投放设置'],
    badges: ['账户设置']
  },
  {
    key: 'material-extraction',
    title: '有量素材提取',
    description: '按消耗和时间范围提取高表现素材。',
    group: 'asset',
    path: '/tencent-ads/material-extraction',
    icon: FileText,
    keywords: ['素材', '提取', '消耗', '创意'],
    badges: ['结果导出']
  },
  {
    key: 'conversion-attribution',
    title: '转化归因',
    description: '创建或维护转化归因配置，适合进入专业模式处理。',
    group: 'advanced',
    path: '/tencent-ads/conversion-attribution',
    icon: Target,
    keywords: ['转化', '归因', '营销链路', '配置'],
    badges: ['专业模式']
  }
]
