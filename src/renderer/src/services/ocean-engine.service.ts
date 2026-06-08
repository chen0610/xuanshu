import apiClient, { API_BASE_URL } from './api'

const BASE_PATH = '/api/v1/ocean-engine'
const LONG_PROJECT_ID_PATTERN = /("project_id"\s*:\s*)(\d{16,})(\s*[,}])/g

function parseOceanEngineBatchCreateResponse<T>(data: unknown): T {
  if (typeof data !== 'string') {
    return data as T
  }

  const normalized = data.replace(LONG_PROJECT_ID_PATTERN, '$1"$2"$3')
  return JSON.parse(normalized) as T
}

interface PaginationParams {
  page?: number
  page_size?: number
  config_id?: number
  status?: string
  task_type?: string
  is_active?: boolean
}

interface PaginatedResponse<T> {
  items: T[]
  meta: {
    total: number
    page: number
    page_size: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
}

interface ProjectBid {
  id: number
  project_id: string
  project_name: string
  current_bid: number
  new_bid: number | null
  config_id: number
  user_id: number
  status: string
  error_message: string | null
  created_at: string
  updated_at: string
}

interface ProjectBidCreate {
  project_id: string
  project_name: string
  current_bid: number
  new_bid: number | null
  config_id: number
}

interface ProjectBidUpdate {
  project_id?: string
  project_name?: string
  current_bid?: number
  new_bid?: number | null
  status?: string
  error_message?: string | null
}

interface ProjectBidBatchUpdate {
  config_id: number
  project_ids: string[]
  new_bid: number
}

interface ScheduledTask {
  id: number
  name: string
  task_type: string
  config_id: number
  user_id: number
  cron_expression: string
  task_config: Record<string, any> | null
  is_active: boolean
  last_run_at: string | null
  next_run_at: string | null
  run_count: number
  status: string
  created_at: string
  updated_at: string
}

interface ScheduledTaskCreate {
  name: string
  task_type: string
  config_id: number
  cron_expression: string
  task_config?: Record<string, any> | null
}

interface ScheduledTaskUpdate {
  name?: string
  task_type?: string
  config_id?: number
  cron_expression?: string
  task_config?: Record<string, any> | null
  is_active?: boolean
  status?: string
}

interface ScheduledTaskExecutionDetail {
  id: number
  execution_log_id: number
  task_id: number
  config_id: number
  config_name: string | null
  tags: TagInfo[] | null
  ads_found: number
  ads_processed: number
  success_count: number
  failed_count: number
  error_message: string | null
  error_details: Record<string, any> | null
  created_at: string
}

interface ScheduledTaskExecutionLog {
  id: number
  task_id: number
  user_id: number
  execution_status: 'success' | 'failed' | 'partial' | 'running'
  start_time: string
  end_time: string | null
  duration_seconds: number | null
  total_targets: number
  total_ads_found: number
  total_ads_processed: number
  total_success: number
  total_failed: number
  task_config_snapshot: Record<string, any> | null
  error_message: string | null
  error_details: Record<string, any> | null
  created_at: string
  details: ScheduledTaskExecutionDetail[]
}

/**
 * 项目出价服务
 */
export const projectBidService = {
  /**
   * 创建项目出价记录
   */
  async createProjectBid(data: ProjectBidCreate): Promise<ProjectBid> {
    const response = await apiClient.post<ProjectBid>(`${BASE_PATH}/project-bids`, data)
    return response.data
  },

  /**
   * 获取项目出价详情
   */
  async getProjectBid(bidId: number): Promise<ProjectBid> {
    const response = await apiClient.get<ProjectBid>(`${BASE_PATH}/project-bids/${bidId}`)
    return response.data
  },

  /**
   * 更新项目出价
   */
  async updateProjectBid(bidId: number, data: ProjectBidUpdate): Promise<ProjectBid> {
    const response = await apiClient.patch<ProjectBid>(`${BASE_PATH}/project-bids/${bidId}`, data)
    return response.data
  },

  /**
   * 删除项目出价
   */
  async deleteProjectBid(bidId: number): Promise<void> {
    await apiClient.delete(`${BASE_PATH}/project-bids/${bidId}`)
  },

  /**
   * 批量更新项目出价
   */
  async batchUpdateProjectBids(data: ProjectBidBatchUpdate): Promise<ProjectBid[]> {
    const response = await apiClient.post<ProjectBid[]>(
      `${BASE_PATH}/project-bids/batch-update`,
      data
    )
    return response.data
  }
}

/**
 * 批量修改深度出价相关接口
 */
interface GetAdProjectsRequest {
  account_ids: string[]
  selected_cookie_id: number
}

interface GetAdProjectsResponse {
  code: number
  data?: {
    all_projects: any[]
    manual_projects: any[]
    auto_projects: any[]
    manual_count: number
    auto_count: number
    total_count: number
  }
  msg?: string
  error?: string
}

interface BatchModifyBidsRequest {
  account_ids: string[]
  enable_range_bid: 'yes' | 'no'
  selected_cookie_id: number
  deep_bid_value?: number
  deep_bid_min_value?: number
  deep_bid_max_value?: number
}

interface BatchModifyBidsResponse {
  code: number
  data?: {
    total_auto_projects: number
    total_manual_projects: number
    total_success: number
    total_error: number
    account_results: Array<{
      account_id: string
      auto_projects_processed: number
      manual_projects_processed: number
      success_count: number
      error_count: number
      errors: string[]
    }>
  }
  msg?: string
  error?: string
}

export type { BatchModifyBidsRequest, BatchModifyBidsResponse }

/**
 * 批量修改深度出价服务
 */
export const batchBidModifyService = {
  /**
   * 获取广告项目列表
   */
  async getAdProjects(data: GetAdProjectsRequest): Promise<GetAdProjectsResponse> {
    const response = await apiClient.post<GetAdProjectsResponse>(
      `${BASE_PATH}/get-ad-projects`,
      data
    )
    return response.data
  },

  /**
   * 批量修改出价
   */
  async batchModifyBids(data: BatchModifyBidsRequest): Promise<BatchModifyBidsResponse> {
    const response = await apiClient.post<BatchModifyBidsResponse>(
      `${BASE_PATH}/batch-modify-bids`,
      data,
      {
        timeout: 600000 // 10分钟超时
      }
    )
    return response.data
  }
}

/**
 * 定时任务服务
 */
export const scheduledTaskService = {
  /**
   * 创建定时任务
   */
  async createScheduledTask(data: ScheduledTaskCreate): Promise<ScheduledTask> {
    const response = await apiClient.post<ScheduledTask>(`${BASE_PATH}/scheduled-tasks`, data)
    return response.data
  },

  /**
   * 获取定时任务列表（分页）
   */
  async getScheduledTasks(
    params: PaginationParams = {}
  ): Promise<PaginatedResponse<ScheduledTask>> {
    const response = await apiClient.get<PaginatedResponse<ScheduledTask>>(
      `${BASE_PATH}/scheduled-tasks`,
      { params }
    )
    return response.data
  },

  /**
   * 获取定时任务详情
   */
  async getScheduledTask(taskId: number): Promise<ScheduledTask> {
    const response = await apiClient.get<ScheduledTask>(`${BASE_PATH}/scheduled-tasks/${taskId}`)
    return response.data
  },

  /**
   * 更新定时任务
   */
  async updateScheduledTask(taskId: number, data: ScheduledTaskUpdate): Promise<ScheduledTask> {
    const response = await apiClient.patch<ScheduledTask>(
      `${BASE_PATH}/scheduled-tasks/${taskId}`,
      data
    )
    return response.data
  },

  /**
   * 删除定时任务
   */
  async deleteScheduledTask(taskId: number): Promise<void> {
    await apiClient.delete(`${BASE_PATH}/scheduled-tasks/${taskId}`)
  },

  /**
   * 切换定时任务状态
   */
  async toggleScheduledTask(taskId: number): Promise<ScheduledTask> {
    const response = await apiClient.post<ScheduledTask>(
      `${BASE_PATH}/scheduled-tasks/${taskId}/toggle`
    )
    return response.data
  },

  /**
   * 获取任务执行日志列表
   */
  async getExecutionLogs(
    taskId: number,
    params: {
      page?: number
      page_size?: number
      start_date?: string
      end_date?: string
    } = {}
  ): Promise<PaginatedResponse<ScheduledTaskExecutionLog>> {
    const response = await apiClient.get<PaginatedResponse<ScheduledTaskExecutionLog>>(
      `${BASE_PATH}/scheduled-tasks/${taskId}/execution-logs`,
      { params }
    )
    return response.data
  },

  /**
   * 获取执行日志详情
   */
  async getExecutionLogDetail(taskId: number, logId: number): Promise<ScheduledTaskExecutionLog> {
    const response = await apiClient.get<ScheduledTaskExecutionLog>(
      `${BASE_PATH}/scheduled-tasks/${taskId}/execution-logs/${logId}`
    )
    return response.data
  },

  /**
   * 获取最新执行日志
   */
  async getLatestExecutionLog(taskId: number): Promise<ScheduledTaskExecutionLog | null> {
    const response = await apiClient.get<ScheduledTaskExecutionLog | null>(
      `${BASE_PATH}/scheduled-tasks/${taskId}/execution-logs/latest`
    )
    return response.data
  }
}

/**
 * 数据助手相关接口
 */
interface TagInfo {
  id: string
  value: string
}

interface TagGroup {
  id: string
  name: string
  tags: TagInfo[]
}

interface GetAccountTagsResponse {
  code: number
  data?: {
    tags?: TagInfo[]
  }
  msg?: string
  error?: string
}

interface DataStatisticsRequest {
  config_id: number
  query_date: string
  ebp_ids: string[]
  use_keyword_grouping?: boolean
  keyword_text?: string | null
}

interface PromotionMetrics {
  total_cost: number
  total_ads: number
  conversion_cost: number
  active_cost: number
  total_active: number
  next_day_retention: number
  retention_7d: number
  yesterday_cost: number
  yesterday_active_cost: number
  yesterday_active: number
  yesterday_next_day_retention: number
  history_7d_cost: number
  history_7d_active_cost: number
  history_7d_active: number
  history_7d_attribution_next_day_open_cnt: number
  history_7d_attribution_retention_7d_cnt: number
  history_7d_next_day_retention: number
  history_7d_retention_7d: number
}

interface GroupStatistics {
  group_name: string
  keyword?: string
  tags?: TagInfo[]
  ebp_id?: string
  ebp_name?: string
  filter_data: PromotionMetrics
}

interface DataAssistantConfig {
  id: number
  config_id: number
  user_id: number
  use_keyword_grouping: boolean
  keyword_text: string | null
  tag_groups: Record<string, TagGroup[]>
  data_control_groups?: Record<string, any>
  additional_tag_groups?: TagInfo[]
  created_at: string
  updated_at: string
}

interface DataAssistantConfigCreate {
  config_id: number
  use_keyword_grouping: boolean
  keyword_text?: string | null
  tag_groups: Record<string, TagGroup[]>
  data_control_groups?: Record<string, any>
}

interface DataAssistantConfigUpdate {
  use_keyword_grouping?: boolean
  keyword_text?: string | null
  tag_groups?: Record<string, TagGroup[]>
  data_control_groups?: Record<string, any>
  additional_tag_groups?: TagInfo[] | null
}

interface DataStatisticsResponse {
  code: number
  data?: {
    total_data: PromotionMetrics
    group_results: GroupStatistics[]
    additional_results?: GroupStatistics[] // 附加统计结果
    query_date: string
  }
  msg?: string
  error?: string
  recordTime?: string // 记录拉取完成的时间
}

/**
 * 数据助手服务
 */
export const dataAssistantService = {
  /**
   * 获取账户标签列表
   */
  async getAccountTags(configId: number): Promise<GetAccountTagsResponse> {
    const response = await apiClient.get<GetAccountTagsResponse>(
      `${BASE_PATH}/data-assistant/account-tags`,
      { params: { config_id: configId } }
    )
    return response.data
  },

  /**
   * 获取数据统计
   */
  async getDataStatistics(data: DataStatisticsRequest): Promise<DataStatisticsResponse> {
    const response = await apiClient.post<DataStatisticsResponse>(
      `${BASE_PATH}/data-assistant/statistics`,
      data
    )
    return response.data
  },

  /**
   * 导出统计数据为图片(V1)
   * @returns Blob 格式的 PNG 图片
   */
  async exportStatisticsImage(statisticsData: any): Promise<Blob> {
    const response = await apiClient.post(
      `${BASE_PATH}/data-assistant/statistics/export-image`,
      { statistics_data: statisticsData },
      { responseType: 'blob' }
    )
    return response.data as Blob
  }
}

/**
 * 数据助手V2服务
 */
export const dataAssistantV2Service = {
  /**
   * 获取账户标签列表
   */
  async getAccountTags(configId: number): Promise<GetAccountTagsResponse> {
    const response = await apiClient.get<GetAccountTagsResponse>(
      `${BASE_PATH}/data-assistant-v2/account-tags`,
      { params: { config_id: configId } }
    )
    return response.data
  },

  /**
   * 获取数据统计
   */
  async getDataStatistics(data: DataStatisticsRequest): Promise<DataStatisticsResponse> {
    const response = await apiClient.post<DataStatisticsResponse>(
      `${BASE_PATH}/data-assistant-v2/statistics`,
      data
    )
    return response.data
  },

  /**
   * 获取根组织列表
   */
  async getRootOrganizations(configId: number): Promise<any> {
    const response = await apiClient.get(`${BASE_PATH}/data-assistant-v2/root-organizations`, {
      params: { config_id: configId }
    })
    return response.data
  },

  /**
   * 获取组织树
   */
  async getOrganizationTree(configId: number, ebpId: string): Promise<any> {
    const response = await apiClient.get(`${BASE_PATH}/data-assistant-v2/organization-tree`, {
      params: { config_id: configId, ebp_id: ebpId }
    })
    return response.data
  },

  /**
   * 发送统计数据到飞书表格(V2)
   */
  async sendStatisticsToFeishuV2(
    statisticsData: any,
    configId: number
  ): Promise<{ code: number; message: string; spreadsheet_url?: string; row_count?: number }> {
    const response = await apiClient.post(`${BASE_PATH}/data-assistant-v2/send-to-feishu`, {
      statistics_data: statisticsData,
      config_id: configId
    })
    return response.data
  },

  /**
   * 导出统计数据为图片(V2)
   * @returns Blob 格式的 PNG 图片
   */
  async exportStatisticsImage(statisticsData: any): Promise<Blob> {
    const response = await apiClient.post(
      `${BASE_PATH}/data-assistant-v2/statistics/export-image`,
      { statistics_data: statisticsData },
      { responseType: 'blob' }
    )
    return response.data as Blob
  }
}

export type {
  TagInfo,
  TagGroup,
  GetAccountTagsResponse,
  DataStatisticsRequest,
  PromotionMetrics,
  GroupStatistics,
  DataStatisticsResponse
}

/**
 * 广告优化相关接口
 */
interface AdOptimizeFilter {
  filter_enabled: boolean
  spend_value?: number
  spend_operator: 'gte' | 'lte'
  conversion_num_value?: number
  conversion_num_operator: 'gte' | 'lte'
  conversion_cost_value?: number
  conversion_cost_operator: 'gte' | 'lte'
  delivery_mode: 'all' | 'manual' | 'auto'
  keyword?: string
}

interface AdOptimizeScheduleRequest {
  account_ids: string[]
  selected_cookie_id: number
  filter: AdOptimizeFilter
  time_type: 'unlimited' | 'custom'
  week_schedule?: string[][]
}

interface AdOptimizeBidRequest {
  account_ids: string[]
  selected_cookie_id: number
  filter: AdOptimizeFilter
  bid_value: number
}

interface AdOptimizeAccountResult {
  account_id: string
  projects_processed: number
  manual_projects_processed: number
  auto_projects_processed: number
  success_count: number
  error_count: number
  errors: string[]
}

interface AdOptimizeResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    account_results: AdOptimizeAccountResult[]
  }
  msg?: string
  error?: string
}

/**
 * 广告优化服务
 */
export const adOptimizeService = {
  /**
   * 批量修改投放时段
   */
  async optimizeSchedule(data: AdOptimizeScheduleRequest): Promise<AdOptimizeResponse> {
    const response = await apiClient.post<AdOptimizeResponse>(
      `${BASE_PATH}/ad-optimize/schedule`,
      data
    )
    return response.data
  },

  /**
   * 批量修改出价
   */
  async optimizeBid(data: AdOptimizeBidRequest): Promise<AdOptimizeResponse> {
    const response = await apiClient.post<AdOptimizeResponse>(`${BASE_PATH}/ad-optimize/bid`, data)
    return response.data
  }
}

export type {
  AdOptimizeFilter,
  AdOptimizeScheduleRequest,
  AdOptimizeBidRequest,
  AdOptimizeAccountResult,
  AdOptimizeResponse
}

/**
 * 广告清理相关接口
 */
interface AdCleanupFilter {
  filter_enabled: boolean
  start_date?: string
  end_date?: string
  spend_value?: number
  spend_operator: 'gte' | 'lte'
  conversion_num_value?: number
  conversion_num_operator: 'gte' | 'lte'
  delivery_mode: 'all' | 'manual' | 'auto'
  keyword?: string
  ad_status: 'all' | 'running' | 'paused' | 'project_paused'
  account_scope: 'all' | 'partial'
  account_ids?: string[]
  tag_ids?: number[]
}

interface AdCleanupPreviewRequest {
  ebp_id: string
  account_ids: string[]
  selected_cookie_id: number
  filter: AdCleanupFilter
  duration_hours: number
}

interface PromotionInfo {
  promotion_id: string
  promotion_name: string
  advertiser_id: string
  promotion_create_time: string
}

interface AdCleanupPreviewResponse {
  code: number
  data?: {
    total: number
    eligible_count: number
    ads: PromotionInfo[]
    preview_job_id?: number
    delete_params?: Array<{
      advertiser_id: string
      id: string
    }>
  }
  msg?: string
  error?: string
}

interface AdCleanupDeleteRequest {
  preview_job_id: number
  ebp_id: string
  account_ids: string[]
  selected_cookie_id: number
  filter: AdCleanupFilter
  duration_hours: number
}

interface AdCleanupDeleteResponse {
  code: number
  data?: {
    total: number
    eligible_count: number
    success_count: number
    fail_count: number
  }
  msg?: string
  error?: string
}

/**
 * 广告清理服务
 */
export const adCleanupService = {
  /**
   * 预览待清理的广告
   */
  async previewCleanup(
    data: AdCleanupPreviewRequest,
    options?: { signal?: AbortSignal }
  ): Promise<AdCleanupPreviewResponse> {
    const response = await apiClient.post<AdCleanupPreviewResponse>(
      `${BASE_PATH}/ad-cleanup/preview`,
      data,
      {
        timeout: 1200000, // 20分钟超时
        signal: options?.signal
      }
    )
    return response.data
  },

  /**
   * 预览待清理的广告（SSE 实时日志）
   */
  async previewCleanupStream(
    data: AdCleanupPreviewRequest,
    options?: { signal?: AbortSignal }
  ): Promise<Response> {
    const token = localStorage.getItem('access_token')
    const url = `${API_BASE_URL}${BASE_PATH}/ad-cleanup/preview/stream`

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify(data),
      signal: options?.signal
    })
  },

  /**
   * 执行广告清理
   */
  async cleanupAds(data: AdCleanupDeleteRequest): Promise<AdCleanupDeleteResponse> {
    const response = await apiClient.post<AdCleanupDeleteResponse>(
      `${BASE_PATH}/ad-cleanup/delete`,
      data
    )
    return response.data
  }
}

export type {
  AdCleanupFilter,
  AdCleanupPreviewRequest,
  PromotionInfo,
  AdCleanupPreviewResponse,
  AdCleanupDeleteRequest,
  AdCleanupDeleteResponse
}

/**
 * 项目清理相关接口
 */
type ProjectCleanupFilterOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'between'

interface ProjectCleanupMetricConditionPayload {
  field: string
  operator: ProjectCleanupFilterOperator
  value?: number
  min_value?: number
  max_value?: number
}

interface ProjectCleanupFilter {
  filter_enabled: boolean
  start_date?: string
  end_date?: string
  project_status: 'all' | 'running' | 'paused'
  metric_conditions?: ProjectCleanupMetricConditionPayload[]
  account_scope: 'all' | 'partial'
  account_ids?: string[]
}

interface ProjectInfo {
  project_id: string
  project_name: string
  advertiser_id: string
  create_time: string
}

interface ProjectCleanupPreviewResponse {
  code: number
  data?: {
    total: number
    eligible_count: number
    projects: ProjectInfo[]
    preview_job_id?: number
  }
  msg?: string
  error?: string
}

interface ProjectCleanupDeleteResponse {
  code: number
  data?: {
    total: number
    eligible_count: number
    success_count: number
    fail_count: number
  }
  msg?: string
  error?: string
}

export type {
  ProjectCleanupFilter,
  ProjectCleanupMetricConditionPayload,
  ProjectCleanupFilterOperator,
  ProjectInfo,
  ProjectCleanupPreviewResponse,
  ProjectCleanupDeleteResponse
}

/**
 * 起量助手相关接口
 */
interface AdBoostBatchRequest {
  ad_ids: string[]
  selected_cookie_id: number
  budget: number
  time_type: 'now' | 'custom'
  specific_time?: number
}

interface AdBoostProjectRequest {
  account_ids: string[]
  selected_cookie_id: number
  budget: number
  end_time: number
}

interface AdBoostAccountResult {
  account_id: string
  success_count: number
  error_count: number
  errors: string[]
}

interface AdBoostResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    account_results: AdBoostAccountResult[]
  }
  msg?: string
  error?: string
}

/**
 * 起量助手服务
 */
export const adBoostService = {
  /**
   * 批量起量（一键起量）
   */
  async batchBoost(data: AdBoostBatchRequest): Promise<AdBoostResponse> {
    const response = await apiClient.post<AdBoostResponse>(`${BASE_PATH}/ad-boost/batch`, data)
    return response.data
  },

  /**
   * 项目起量
   */
  async projectBoost(data: AdBoostProjectRequest): Promise<AdBoostResponse> {
    const response = await apiClient.post<AdBoostResponse>(`${BASE_PATH}/ad-boost/project`, data)
    return response.data
  }
}

export type { AdBoostBatchRequest, AdBoostProjectRequest, AdBoostAccountResult, AdBoostResponse }

// ==================== 批量助手相关类型 ====================

interface RTABindRequest {
  account_ids: string[]
  rta_id: number
  selected_cookie_id: number
}

interface RTABindResult {
  account_id: string
  success: boolean
  message?: string
  error?: string
}

interface RTABindResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    results: RTABindResult[]
  }
  msg?: string
  error?: string
}

interface RTACheckRequest {
  account_ids: string[]
  selected_cookie_id: number
}

interface RTACheckResult {
  account_id: string
  is_bound: boolean
  rta_id?: string
  error?: string
}

interface RTACheckResponse {
  code: number
  data?: {
    total_bound: number
    total_unbound: number
    results: RTACheckResult[]
  }
  msg?: string
  error?: string
}

interface RemarkModifyRequest {
  account_ids: string[]
  remark?: string
  remarks?: string[]
  enable_increment: boolean
  enable_date: boolean
  append_to_existing: boolean
  append_dimension?: 'all' | 'account'
  remark_keyword?: string
  ebp_id?: string
  selected_cookie_id: number
}

interface RemarkModifyResult {
  account_id: string
  success: boolean
  final_remark?: string
  error?: string
}

interface RemarkModifyResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    results: RemarkModifyResult[]
  }
  msg?: string
  error?: string
}

interface RemarkSearchRequest {
  remark_keyword: string
  selected_cookie_id: number
}

interface AccountRemarkInfo {
  advertiser_id: string
  advertiser_remark: string
}

interface RemarkSearchResponse {
  code: number
  data?: {
    accounts: AccountRemarkInfo[]
    total_count: number
  }
  msg?: string
  error?: string
}

interface MainAssetAccountInfo {
  advertiser_id: string
  advertiser_name: string
  group_id: string
  advertiser_remark?: string
}

interface MainAssetAccountListResponse {
  code: number
  data?: {
    accounts: MainAssetAccountInfo[]
    total_count: number
  }
  msg?: string
  error?: string
}

interface AccountAssetListRequest {
  selected_cookie_id: number
  group_id: string
  owner_account_id?: string
  keyword?: string
  page?: number
  page_size?: number
}

interface AccountAssetInfo {
  assets_id: string
  asset_name: string
  app_type?: number
  account_info?: {
    id?: string
    name?: string
    app_key?: number
  }
  create_time?: string
}

interface AccountAssetListResponse {
  code: number
  data?: {
    assets: AccountAssetInfo[]
    total_count: number
    page?: number
    page_size?: number
    total_pages?: number
    has_more?: boolean
  }
  msg?: string
  error?: string
}

interface AssetShareRequest {
  selected_cookie_id: number
  group_id: string
  asset_id: string
  account_ids: string[]
}

interface AssetShareResult {
  account_id: string
  success: boolean
  error?: string
}

interface AssetShareResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    results: AssetShareResult[]
  }
  msg?: string
  error?: string
}
interface MaterialShareGroupInfo {
  group_id: string
  group_name: string
}

interface MaterialShareGroupListResponse {
  code: number
  data?: {
    groups: MaterialShareGroupInfo[]
    total_count: number
  }
  msg?: string
  error?: string
}

interface MaterialShareRequest {
  selected_cookie_id: number
  group_id: string
  asset_ids: string[]
  account_ids: string[]
}

interface MaterialShareResult {
  account_id: string
  success: boolean
  error?: string
}

interface MaterialShareResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    results: MaterialShareResult[]
  }
  msg?: string
  error?: string
}

interface ProjectBudgetModifyRequest {
  dimension: 'account' | 'project'
  account_ids?: string[]
  project_ids?: string[]
  budget: number
  selected_cookie_id: number
}

interface ProjectBudgetModifyAccountResult {
  account_id: string
  success_count: number
  error_count: number
  errors: string[]
}

interface ProjectBudgetModifyResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    account_results: ProjectBudgetModifyAccountResult[]
  }
  msg?: string
  error?: string
}

interface ProjectRoiModifyRequest {
  dimension: 'account' | 'project'
  account_ids?: string[]
  project_ids?: string[]
  roi_goal: number
  selected_cookie_id: number
}

interface AccountBiddingBudgetModifyRequest {
  account_ids: string[]
  budget_mode: 'unlimited' | 'specified'
  budget?: number
  selected_cookie_id: number
}

interface AccountNameModifyResult {
  account_id: string
  account_name: string
  success: boolean
  error?: string
}

interface AccountNameModifyResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    results: AccountNameModifyResult[]
  }
  msg?: string
  error?: string
}

interface ProjectToggleRequest {
  selected_cookie_id: number
  action: 'pause' | 'enable'
  dimension?: 'tag' | 'account'
  tag_ids?: string[]
  keyword?: string
  account_ids?: string[]
}

interface ProjectToggleBatchResult {
  batch_index: number
  total: number
  success_count: number
  error_count: number
  error?: string
  failed_ids?: string[]
}

interface ProjectToggleResponse {
  code: number
  data?: {
    total_projects: number
    total_batches: number
    total_success: number
    total_error: number
    batch_results: ProjectToggleBatchResult[]
  }
  msg?: string
  error?: string
}

/**
 * 批量助手服务
 */
export const pAssistantService = {
  /**
   * 批量绑定RTA策略
   */
  async bindRTA(data: RTABindRequest): Promise<RTABindResponse> {
    const response = await apiClient.post<RTABindResponse>(
      `${BASE_PATH}/p-assistant/rta/bind`,
      data
    )
    return response.data
  },

  /**
   * 批量检查RTA状态
   */
  async checkRTA(data: RTACheckRequest): Promise<RTACheckResponse> {
    const response = await apiClient.post<RTACheckResponse>(
      `${BASE_PATH}/p-assistant/rta/check`,
      data
    )
    return response.data
  },

  /**
   * 批量修改备注
   */
  async modifyRemark(data: RemarkModifyRequest): Promise<RemarkModifyResponse> {
    const response = await apiClient.post<RemarkModifyResponse>(
      `${BASE_PATH}/p-assistant/remark/modify`,
      data
    )
    return response.data
  },

  /**
   * 根据备注关键字搜索账户
   */
  async searchAccountsByRemark(data: RemarkSearchRequest): Promise<RemarkSearchResponse> {
    const response = await apiClient.post<RemarkSearchResponse>(
      `${BASE_PATH}/p-assistant/remark/search`,
      data
    )
    return response.data
  }
}

export type {
  RTABindRequest,
  RTABindResult,
  RTABindResponse,
  RTACheckRequest,
  RTACheckResult,
  RTACheckResponse,
  RemarkModifyRequest,
  RemarkModifyResult,
  RemarkModifyResponse,
  RemarkSearchRequest,
  RemarkSearchResponse,
  MainAssetAccountInfo,
  MainAssetAccountListResponse,
  AccountAssetListRequest,
  AccountAssetInfo,
  AccountAssetListResponse,
  AssetShareRequest,
  AssetShareResult,
  AssetShareResponse,
  MaterialShareGroupInfo,
  MaterialShareGroupListResponse,
  MaterialShareRequest,
  MaterialShareResult,
  MaterialShareResponse,
  ProjectBudgetModifyRequest,
  ProjectBudgetModifyAccountResult,
  ProjectBudgetModifyResponse,
  ProjectRoiModifyRequest,
  AccountBiddingBudgetModifyRequest,
  ProjectToggleRequest,
  ProjectToggleBatchResult,
  AccountNameModifyResponse,
  ProjectToggleResponse
}

// ==================== 标签修改相关类型 ====================

interface PATagInfo {
  id: string
  value: string
}

interface TagListResponse {
  code: number
  data?: {
    tags?: PATagInfo[]
  }
  msg?: string
  error?: string
}

interface TagModifyRequest {
  account_ids: string[]
  tag_ids: string[]
  tag_values: string[]
  edit_mode: 'add' | 'delete'
  selected_cookie_id: number
}

interface TagModifyResult {
  account_id: string
  success: boolean
  error?: string
}

interface TagModifyResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    results: TagModifyResult[]
  }
  msg?: string
  error?: string
}

// ==================== 清空素材相关类型 ====================

interface ClearMaterialRequest {
  account_ids: string[]
  selected_cookie_id: number
}

interface ClearMaterialResult {
  account_id: string
  success: boolean
  deleted_count: number
  error?: string
}

interface ClearMaterialResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    total_deleted: number
    unknown_count?: number // 未知数量的任务数（异步任务）
    results: ClearMaterialResult[]
  }
  msg?: string
  error?: string
}

export interface AccountAvatarBatchRequest {
  account_ids: string[]
  /** 已废弃，后端忽略 */
  selected_cookie_id?: number
  image_base64: string
  /** 可选：OAuth 载体广告主 ID；不传则对每个账户用其自身取 token */
  oauth_token_source_advertiser_id?: string
}

export interface UnitScheduleBatchRequest {
  selected_cookie_id: number
  schedule_dimension?: 'account' | 'promotion'
  ebp_id?: string
  account_ids?: string[]
  promotion_ids?: string[]
  start_time: number
}

export interface UnitScheduleAccountResult {
  account_id: string
  paused_count: number
  success_count: number
  error_count: number
  success_ids: string[]
  errors: Record<string, string>
  error?: string | null
}

export interface UnitScheduleBatchResponse {
  code: number
  data?: {
    total_accounts: number
    total_paused: number
    total_success: number
    total_error: number
    results: UnitScheduleAccountResult[]
  }
  msg?: string
  error?: string
}

export interface AccountAvatarSetResult {
  account_id: string
  success: boolean
  error?: string
}

export interface AccountAvatarBatchResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    results: AccountAvatarSetResult[]
  }
  msg?: string
  error?: string
}

/**
 * 批量助手服务 - 扩展方法
 */
export interface PromotionProjectSearchItem {
  advertiser_id: string
  project_id: string
  project_name: string
  landing_type?: string | null
}

export interface PromotionProjectSearchResponse {
  code: number
  msg: string
  items: PromotionProjectSearchItem[]
  account_errors: { account_id?: string; error: string }[]
}

type PAssistantJobStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed' | 'cancelled'

export interface PAssistantJobCreateRequest {
  job_type: string
  payload: Record<string, unknown>
}

export interface PAssistantJobCreateResponse {
  code: number
  job_id: number
  status: PAssistantJobStatus
  msg: string
}

export interface PAssistantJobDetailResponse {
  id: number
  user_id: number
  creator_name?: string | null
  creator_username?: string | null
  creator_role?: string | null
  config_id?: number | null
  job_type: string
  status: PAssistantJobStatus
  total_count: number
  processed_count?: number
  success_count: number
  error_count: number
  progress: number
  current_step?: string | null
  current_message?: string | null
  parent_job_id?: number | null
  retry_mode?: string | null
  error_message?: string | null
  attempt_count: number
  max_attempts: number
  created_at: string
  started_at?: string | null
  finished_at?: string | null
  payload: Record<string, unknown>
  result?: Record<string, any> | null
}

export interface PAssistantJobListMeta {
  total: number
  page: number
  page_size: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

export interface PAssistantJobListResponse {
  items: PAssistantJobDetailResponse[]
  meta: PAssistantJobListMeta
}

export interface PAssistantJobRecoverResponse {
  code: number
  job_id: number
  status: PAssistantJobStatus
  msg: string
}

export interface PAssistantJobEventResponse {
  id: number
  job_id: number
  event_type: string
  level: 'info' | 'warning' | 'error' | string
  account_id?: string | null
  batch_index?: number | null
  message: string
  data?: Record<string, any> | null
  created_at: string
}

export interface PAssistantJobEventListResponse {
  items: PAssistantJobEventResponse[]
}

export interface PAssistantJobRetryResponse {
  code: number
  job_id: number
  status: PAssistantJobStatus
  msg: string
}

export const pAssistantServiceExtended = {
  async createJob(data: PAssistantJobCreateRequest): Promise<PAssistantJobCreateResponse> {
    const response = await apiClient.post<PAssistantJobCreateResponse>(
      `${BASE_PATH}/p-assistant/jobs`,
      data
    )
    return response.data
  },

  async getJob(jobId: number): Promise<PAssistantJobDetailResponse> {
    const response = await apiClient.get<PAssistantJobDetailResponse>(
      `${BASE_PATH}/p-assistant/jobs/${jobId}`
    )
    return response.data
  },

  async listJobs(params?: {
    page?: number
    page_size?: number
    job_status?: PAssistantJobStatus
  }): Promise<PAssistantJobListResponse> {
    const response = await apiClient.get<PAssistantJobListResponse>(`${BASE_PATH}/p-assistant/jobs`, {
      params
    })
    return response.data
  },

  async listJobEvents(jobId: number, params?: { limit?: number; after_id?: number }): Promise<PAssistantJobEventListResponse> {
    const query: { limit?: number; after_id?: number } = {}
    if (params?.limit != null) query.limit = params.limit
    if (params?.after_id != null && params.after_id > 0) query.after_id = params.after_id
    const response = await apiClient.get<PAssistantJobEventListResponse>(
      `${BASE_PATH}/p-assistant/jobs/${jobId}/events`,
      { params: query }
    )
    return response.data
  },

  async retryJob(jobId: number, mode: 'all' | 'failed_only'): Promise<PAssistantJobRetryResponse> {
    const response = await apiClient.post<PAssistantJobRetryResponse>(
      `${BASE_PATH}/p-assistant/jobs/${jobId}/retry`,
      { mode }
    )
    return response.data
  },

  async cancelJob(jobId: number): Promise<PAssistantJobRecoverResponse> {
    const response = await apiClient.post<PAssistantJobRecoverResponse>(
      `${BASE_PATH}/p-assistant/jobs/${jobId}/cancel`
    )
    return response.data
  },

  async resumeJob(jobId: number): Promise<PAssistantJobRecoverResponse> {
    const response = await apiClient.post<PAssistantJobRecoverResponse>(
      `${BASE_PATH}/p-assistant/jobs/${jobId}/resume`
    )
    return response.data
  },

  async recoverJob(jobId: number): Promise<PAssistantJobRecoverResponse> {
    const response = await apiClient.post<PAssistantJobRecoverResponse>(
      `${BASE_PATH}/p-assistant/jobs/${jobId}/recover`
    )
    return response.data
  },

  /**
   * 按账户 + 关键字在推广管理侧查询项目（多 Cookie 并发，keyword 如漫剧名）
   */
  async searchPromotionProjects(data: {
    selected_cookie_id: number
    account_ids: string[]
    keyword: string
    st?: string
    et?: string
  }): Promise<PromotionProjectSearchResponse> {
    const response = await apiClient.post<PromotionProjectSearchResponse>(
      `${BASE_PATH}/p-assistant/promotion-projects/search`,
      data,
      { timeout: 120000 }
    )
    return response.data
  },

  /**
   * 获取主资产账户列表
   */
  async getMainAssetAccounts(configId: number): Promise<MainAssetAccountListResponse> {
    const response = await apiClient.post<MainAssetAccountListResponse>(
      `${BASE_PATH}/p-assistant/assets/main-accounts`,
      { selected_cookie_id: configId }
    )
    return response.data
  },

  /**
   * 获取账户资产列表
   */
  async getAccountAssets(data: AccountAssetListRequest): Promise<AccountAssetListResponse> {
    const response = await apiClient.post<AccountAssetListResponse>(
      `${BASE_PATH}/p-assistant/assets/list`,
      data
    )
    return response.data
  },

  /**
   * 资产共享
   */
  async shareAssets(data: AssetShareRequest): Promise<AssetShareResponse> {
    const response = await apiClient.post<AssetShareResponse>(
      `${BASE_PATH}/p-assistant/assets/share`,
      data,
      {
        timeout: 300000 // 5分钟超时
      }
    )
    return response.data
  },

  /**
   * 获取素材共享组织列表
   */
  async getMaterialShareGroups(configId: number): Promise<MaterialShareGroupListResponse> {
    const response = await apiClient.post<MaterialShareGroupListResponse>(
      `${BASE_PATH}/p-assistant/material-share/groups`,
      { selected_cookie_id: configId }
    )
    return response.data
  },

  /**
   * 素材共享
   */
  async shareMaterials(data: MaterialShareRequest): Promise<MaterialShareResponse> {
    const response = await apiClient.post<MaterialShareResponse>(
      `${BASE_PATH}/p-assistant/material-share/share`,
      data,
      { timeout: 300000 }
    )
    return response.data
  },

  /**
   * 批量设置账户头像（裁剪后的 300×300 PNG，Base64 上传）
   */
  async batchSetAccountAvatar(
    data: AccountAvatarBatchRequest
  ): Promise<AccountAvatarBatchResponse> {
    // 大批量（数百账户 × 上传+提交）易超过数分钟，与默认 api 2 分钟超时区分，单独放宽到 60 分钟
    const response = await apiClient.post<AccountAvatarBatchResponse>(
      `${BASE_PATH}/p-assistant/account/avatar/batch`,
      data,
      { timeout: 3_600_000 }
    )
    return response.data
  },

  async batchSchedulePausedUnits(
    data: UnitScheduleBatchRequest
  ): Promise<UnitScheduleBatchResponse> {
    const response = await apiClient.post<UnitScheduleBatchResponse>(
      `${BASE_PATH}/p-assistant/unit-schedule/batch`,
      data,
      { timeout: 600000 }
    )
    return response.data
  },
  /**
   * 批量修改项目预算
   */
  async modifyProjectBudget(
    data: ProjectBudgetModifyRequest
  ): Promise<ProjectBudgetModifyResponse> {
    const response = await apiClient.post<ProjectBudgetModifyResponse>(
      `${BASE_PATH}/p-assistant/budget/modify`,
      data,
      {
        timeout: 300000 // 5分钟超时
      }
    )
    return response.data
  },
  /**
   * 批量修改账户竞价日预算（不限 / 指定）
   */
  async modifyAccountBiddingBudget(
    data: AccountBiddingBudgetModifyRequest
  ): Promise<ProjectBudgetModifyResponse> {
    const response = await apiClient.post<ProjectBudgetModifyResponse>(
      `${BASE_PATH}/p-assistant/account-bidding-budget/modify`,
      data,
      { timeout: 300000 }
    )
    return response.data
  },
  /**
   * 批量修改项目 ROI 系数
   */
  async modifyProjectRoi(data: ProjectRoiModifyRequest): Promise<ProjectBudgetModifyResponse> {
    const response = await apiClient.post<ProjectBudgetModifyResponse>(
      `${BASE_PATH}/p-assistant/roi/modify`,
      data,
      {
        timeout: 300000
      }
    )
    return response.data
  },
  /**
   * 获取标签列表
   */
  async getTagList(configId: number): Promise<TagListResponse> {
    const response = await apiClient.get<TagListResponse>(`${BASE_PATH}/p-assistant/tags`, {
      params: { config_id: configId }
    })
    return response.data
  },

  /**
   * 批量修改标签
   */
  async modifyTags(data: TagModifyRequest): Promise<TagModifyResponse> {
    const response = await apiClient.post<TagModifyResponse>(
      `${BASE_PATH}/p-assistant/tags/modify`,
      data
    )
    return response.data
  },

  /**
   * 批量清空素材
   */
  async clearMaterials(data: ClearMaterialRequest): Promise<ClearMaterialResponse> {
    const response = await apiClient.post<ClearMaterialResponse>(
      `${BASE_PATH}/p-assistant/materials/clear`,
      data
    )
    return response.data
  },

  async modifyAccountNames(data: {
    selected_cookie_id: number
    account_ids: string[]
    account_names: string[]
  }): Promise<AccountNameModifyResponse> {
    const response = await apiClient.post<AccountNameModifyResponse>(
      `${BASE_PATH}/p-assistant/account/name/modify`,
      data,
      { timeout: 300000 }
    )
    return response.data
  },

  /**
   * 项目启停
   */
  async toggleProjects(data: ProjectToggleRequest): Promise<ProjectToggleResponse> {
    const response = await apiClient.post<ProjectToggleResponse>(
      `${BASE_PATH}/p-assistant/projects/toggle`,
      data,
      {
        timeout: 300000 // 5分钟超时
      }
    )
    return response.data
  }
}

export type {
  PATagInfo,
  TagListResponse,
  TagModifyRequest,
  TagModifyResult,
  TagModifyResponse,
  ClearMaterialRequest,
  ClearMaterialResult,
  ClearMaterialResponse
}

/**
 * 空项目清理相关接口
 */
interface EmptyProjectCleanupRequest {
  account_ids: string[]
  selected_cookie_id: number
}

interface EmptyProjectCleanupResult {
  account_id: string
  success: boolean
  project_count: number
  deleted_count: number
  task_id?: string
  error?: string
}

interface EmptyProjectCleanupResponse {
  code: number
  data?: {
    results: EmptyProjectCleanupResult[]
    summary: {
      total_accounts: number
      total_project_count: number
      total_deleted_count: number
    }
  }
  msg?: string
  error?: string
}

/**
 * 空项目清理服务
 */
export const emptyProjectCleanupService = {
  /**
   * 清理空项目
   */
  async cleanup(data: EmptyProjectCleanupRequest): Promise<EmptyProjectCleanupResponse> {
    const response = await apiClient.post<EmptyProjectCleanupResponse>(
      `${BASE_PATH}/empty-project-cleanup`,
      data,
      {
        timeout: 300000 // 5分钟超时
      }
    )
    return response.data
  }
}

export type { EmptyProjectCleanupRequest, EmptyProjectCleanupResult, EmptyProjectCleanupResponse }

/**
 * 在投素材清理相关接口
 */
interface MaterialCleanupRequest {
  account_ids: string[]
  selected_cookie_id: number
  operation_type?: 'pause' | 'delete'
  cleanup_direction?: 'low_efficiency_carry_rejected' | 'low_efficiency_carry' | 'specified_creative_ids'
  creative_ids?: string[]
}

interface MaterialCleanupAccountResult {
  account_id: string
  success: boolean
  promotion_count: number
  material_count: number
  error?: string
}

interface MaterialCleanupResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    total_promotion_count: number
    total_material_count: number
    account_results: MaterialCleanupAccountResult[]
  }
  msg?: string
  error?: string
}

/**
 * 在投素材清理服务
 */
export const materialCleanupService = {
  /**
   * 清理在投素材
   */
  async cleanup(data: MaterialCleanupRequest): Promise<MaterialCleanupResponse> {
    const response = await apiClient.post<MaterialCleanupResponse>(
      `${BASE_PATH}/material-cleanup`,
      data,
      {
        timeout: 1200000 // 20分钟超时
      }
    )
    return response.data
  }
}

export type { MaterialCleanupRequest, MaterialCleanupAccountResult, MaterialCleanupResponse }

// ==================== ARPU预估相关接口 ====================

interface ArpuEstimateRequest {
  selected_cookie_id: number
  group_index?: number
}

interface ArpuEstimateResponse {
  code: number
  data?: {
    user?: {
      name: string
    }
  }
  msg?: string
  error?: string
}

/**
 * ARPU预估服务
 */
export const arpuEstimateService = {
  /**
   * 获取账户信息
   */
  async getAccountInfo(data: ArpuEstimateRequest): Promise<ArpuEstimateResponse> {
    const response = await apiClient.post<ArpuEstimateResponse>(
      `${BASE_PATH}/arpu-estimate/account-info`,
      data
    )
    return response.data
  },

  /**
   * ARPU预估（流式）
   */
  async estimateStream(data: ArpuEstimateRequest): Promise<Response> {
    const token = localStorage.getItem('access_token')
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9090'
    const url = `${baseURL}/api/v1/ocean-engine/arpu-estimate/stream`

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify(data)
    })
  }
}

export type { ArpuEstimateRequest, ArpuEstimateResponse }

// ==================== 数据面板相关接口 ====================

interface DataPanelRequest {
  config_id: number
  start_time: string
  end_time: string
  offset?: number
  limit?: number
  order_field?: string
  order_type?: number
  filter?: Record<string, any>
}

interface DataPanelResponse {
  code: number
  data?: {
    data_list?: any[]
    total_metrics?: Record<string, any>
    pagination?: {
      page: number
      limit: number
      total: number
      hasMore: boolean
    }
  }
  msg?: string
  error?: string
}

/**
 * 数据面板服务
 */
export const dataPanelService = {
  /**
   * 获取账户列表
   */
  async getAccountList(data: DataPanelRequest): Promise<DataPanelResponse> {
    const response = await apiClient.post<DataPanelResponse>(
      `${BASE_PATH}/data-panel/accounts`,
      data
    )
    return response.data
  },

  /**
   * 获取项目列表
   */
  async getProjectList(data: DataPanelRequest): Promise<DataPanelResponse> {
    const response = await apiClient.post<DataPanelResponse>(
      `${BASE_PATH}/data-panel/projects`,
      data
    )
    return response.data
  },

  /**
   * 获取广告列表
   */
  async getPromotionList(data: DataPanelRequest): Promise<DataPanelResponse> {
    const response = await apiClient.post<DataPanelResponse>(
      `${BASE_PATH}/data-panel/promotions`,
      data
    )
    return response.data
  }
}

export type { DataPanelRequest, DataPanelResponse }

// ==================== 数据调控相关接口 ====================

interface DataControlListRequest {
  config_id: number
  ebp_ids: string[]
  query_date: string
  page?: number
  limit?: number
  order_field?: string
  order_type?: number
  keyword?: string
  status?: string
  custom_fields?: string[]
}

interface DataControlEbpResult {
  ebp_id: string
  items: any[]
  total_metrics?: Record<string, any>
  pagination: {
    page: number
    limit: number
    total: number
    has_more: boolean
  }
}

interface DataControlListResponse {
  code: number
  data?: {
    items: any[]
    total: number
    page: number
    limit: number
    has_more: boolean
    ebp_results: DataControlEbpResult[]
  }
  msg?: string
  error?: string
}

interface DataControlStatusItem {
  ebp_id: string
  advertiser_id: string
  entity_id: string
}

interface DataControlStatusUpdateRequest {
  config_id: number
  items: DataControlStatusItem[]
  is_pause: boolean
}

interface DataControlStatusUpdateResponse {
  code: number
  data?: {
    results: any[]
    total: number
    success: boolean
    has_failed: boolean
  }
  msg?: string
  error?: string
}

export const dataControlService = {
  async getProjectList(data: DataControlListRequest): Promise<DataControlListResponse> {
    const response = await apiClient.post<DataControlListResponse>(
      `${BASE_PATH}/data-control/projects/list`,
      data
    )
    return response.data
  },

  async getPromotionList(data: DataControlListRequest): Promise<DataControlListResponse> {
    const response = await apiClient.post<DataControlListResponse>(
      `${BASE_PATH}/data-control/promotions/list`,
      data
    )
    return response.data
  },

  async updateProjectStatus(
    data: DataControlStatusUpdateRequest
  ): Promise<DataControlStatusUpdateResponse> {
    const response = await apiClient.post<DataControlStatusUpdateResponse>(
      `${BASE_PATH}/data-control/projects/status`,
      data
    )
    return response.data
  },

  async updatePromotionStatus(
    data: DataControlStatusUpdateRequest
  ): Promise<DataControlStatusUpdateResponse> {
    const response = await apiClient.post<DataControlStatusUpdateResponse>(
      `${BASE_PATH}/data-control/promotions/status`,
      data
    )
    return response.data
  }
}

export type {
  DataControlListRequest,
  DataControlListResponse,
  DataControlEbpResult,
  DataControlStatusItem,
  DataControlStatusUpdateRequest,
  DataControlStatusUpdateResponse
}

// ==================== 视频分析相关接口 ====================

interface VideoAnalysisListRequest {
  config_id: number
  ebp_ids: string[]
  start_time: string
  end_time: string
  page?: number
  limit?: number
  order_field?: string
  order_type?: number
  /** 素材 ID 列表，精确筛选 */
  material_ids?: string[]
}

interface VideoAnalysisItem {
  vid?: string
  video_title?: string
  video_cover_url?: string
  material_id?: string
  video_sync_time?: string
  video_duration?: string
  stat_time_duration?: string
  stat_cost?: string
  show_cnt?: string
  click_cnt?: string
  ctr?: string
  max_advertiser_id?: string
  banyun_block_ad_count?: string
  ebp_id?: string
}

interface VideoAnalysisListResponse {
  code: number
  data?: {
    items: VideoAnalysisItem[]
    total: number
    page: number
    limit: number
    has_more: boolean
    total_metrics?: Record<string, string>
    ebp_results?: Array<{
      ebp_id: string
      items: VideoAnalysisItem[]
      total_metrics?: Record<string, string>
      pagination: {
        page: number
        limit: number
        total: number
        has_more: boolean
      }
    }>
  }
  msg?: string
  error?: string
}

interface VideoAnalysisPlayInfoRequest {
  config_id: number
  ebp_id: string
  video_id: string
  material_id: string
}

interface VideoAnalysisPlayInfoResponse {
  code: number
  data?: {
    video_id?: string
    video_url?: string
    cover_url?: string
    video_duration?: number
    error?: string
  }
  msg?: string
  error?: string
}

interface VideoAnalysisPlayInfoBatchItem {
  ebp_id: string
  video_id: string
  material_id: string
}

interface VideoAnalysisPlayInfoBatchRequest {
  config_id: number
  items: VideoAnalysisPlayInfoBatchItem[]
}

interface VideoAnalysisPlayInfoBatchResult {
  video_id?: string
  video_url?: string
  cover_url?: string
  video_duration?: number
  error?: string
}

interface VideoAnalysisPlayInfoBatchResponse {
  code: number
  data?: {
    results?: Record<string, VideoAnalysisPlayInfoBatchResult>
    cookie_count?: number
  }
  msg?: string
  error?: string
}

export function buildVideoUrlKey(
  ebpId: string,
  videoId: string,
  materialId: string
): string {
  return `${ebpId}:${videoId}:${materialId}`
}

export const videoAnalysisService = {
  async getVideoList(data: VideoAnalysisListRequest): Promise<VideoAnalysisListResponse> {
    const response = await apiClient.post<VideoAnalysisListResponse>(
      `${BASE_PATH}/video-analysis/list`,
      data
    )
    return response.data
  },

  async getVideoPlayInfo(
    data: VideoAnalysisPlayInfoRequest
  ): Promise<VideoAnalysisPlayInfoResponse> {
    const response = await apiClient.post<VideoAnalysisPlayInfoResponse>(
      `${BASE_PATH}/video-analysis/play-info`,
      data
    )
    return response.data
  },

  async getVideoPlayInfoBatch(
    data: VideoAnalysisPlayInfoBatchRequest
  ): Promise<VideoAnalysisPlayInfoBatchResponse> {
    const response = await apiClient.post<VideoAnalysisPlayInfoBatchResponse>(
      `${BASE_PATH}/video-analysis/play-info/batch`,
      data
    )
    return response.data
  }
}

export type {
  VideoAnalysisListRequest,
  VideoAnalysisListResponse,
  VideoAnalysisItem,
  VideoAnalysisPlayInfoRequest,
  VideoAnalysisPlayInfoResponse,
  VideoAnalysisPlayInfoBatchRequest,
  VideoAnalysisPlayInfoBatchResponse,
  VideoAnalysisPlayInfoBatchResult
}

// ==================== 数据分析相关接口 ====================

interface DataAnalysisProjectRequest {
  config_ids: number[]
  query_date: string
  ebp_ids: string[]
  groups?: Array<{
    id: string
    name?: string
    shooter_keyword?: string
    keywords?: string
  }>
  limit?: number
}

interface DataAnalysisProjectItem {
  project_name?: string
  metrics: Record<string, any>
}

interface DataAnalysisProjectResult {
  config_id: number
  ebp_id: string
  last_page: number
  zero_cost_page?: number | null
  project_count: number
  projects: DataAnalysisProjectItem[]
  grouped_results?: Array<{
    id?: string
    name?: string
    shooter_keyword?: string
    match_count: number
    items: DataAnalysisProjectItem[]
    keyword_groups: Array<{
      keyword: string
      count: number
      items: DataAnalysisProjectItem[]
    }>
  }>
}

interface DataAnalysisProjectResponse {
  code: number
  data?: {
    results: DataAnalysisProjectResult[]
  }
  msg?: string
  error?: string
}

export const dataAnalysisService = {
  async getProjectsByCost(data: DataAnalysisProjectRequest): Promise<DataAnalysisProjectResponse> {
    const response = await apiClient.post<DataAnalysisProjectResponse>(
      `${BASE_PATH}/data-analysis/projects`,
      data,
      { timeout: 300000 }
    )
    return response.data
  }
}

export interface CustomReportFactItem {
  id: number
  user_id: number | null
  advertiser_id: string
  entity_type: string
  entity_id: string
  stat_date: string
  data_topic: string
  metrics: Record<string, string | number | null>
  dimensions_snapshot?: Record<string, unknown> | null
  spi_event_id: number | null
  created_at: string
  updated_at: string
}

export interface CustomReportFactListResponse {
  items: CustomReportFactItem[]
  total: number
  page: number
  page_size: number
}

export const customReportService = {
  async listFacts(params: {
    page?: number
    page_size?: number
    advertiser_id?: string
    entity_type?: string
    start_date?: string
    end_date?: string
  }): Promise<CustomReportFactListResponse> {
    const response = await apiClient.get<CustomReportFactListResponse>(
      `${BASE_PATH}/custom-report/facts`,
      { params }
    )
    return response.data
  },

  async backfill(data: {
    advertiser_id: string
    entity_types?: string[]
    start_date: string
    end_date: string
  }): Promise<{ rows_written: number; message: string }> {
    const response = await apiClient.post<{ rows_written: number; message: string }>(
      `${BASE_PATH}/custom-report/backfill`,
      data
    )
    return response.data
  }
}

export type {
  DataAnalysisProjectRequest,
  DataAnalysisProjectResponse,
  DataAnalysisProjectResult,
  DataAnalysisProjectItem
}

/** Open API 多广告主：先创建项目再创建广告（单元） */
export interface OceanEngineBatchCreateAdsRequest {
  /** 持有 access_token 的纵横组织 ID 列表（步骤①勾选） */
  org_advertiser_ids: string[]
  /** 实际投放广告主 ID 列表（步骤②填写） */
  advertiser_ids: string[]
  project: Record<string, unknown>
  /** 广告单元列表；视频素材超过 2 条时由前端拆分为多个单元 */
  promotions: Record<string, unknown>[]
  project_path?: string
  promotion_path?: string
  max_concurrency?: number
  /** 复用任务时回填界面所需的 Cookie 配置快照 */
  selected_cookie_config_id?: number | null
  /** 复用任务时回填界面所需的漫剧名称快照 */
  draft_drama_name?: string | null
  /** 复用任务时回填界面所需的视频素材快照 */
  draft_committed_videos?: VideoMaterialItem[] | null
  /** 复用任务时回填界面所需的投放模板 */
  draft_selected_template_code?: string | null
  /** 复用任务时回填自定义投放模板的基础模板 */
  draft_custom_base_template_code?: string | null
  /** 复用任务时回填项目来源 */
  draft_project_mode?: 'new' | 'existing' | 'web' | null
  /** 复用任务时回填网页新建捕获的项目数据包 */
  draft_web_project_payload?: Record<string, unknown> | null
  /** 复用任务时回填网页新建批量创建项目名称前缀 */
  draft_web_project_name?: string | null
  /** 复用任务时回填选择视频素材时使用的查询广告主 ID */
  draft_video_advertiser_id?: string | null
  /** 复用任务时回填视频素材分配方式 */
  draft_video_distribution_mode?: 'full' | 'average' | null
  /** 复用任务时回填平均分配下每项目目标单元数；为空表示按素材数自然拆分 */
  draft_average_target_promotion_count_per_advertiser?: number | null
  /** 复用任务时回填每单元素材数（1～30）；复制任务时优先于从 promotion 视频数反推 */
  draft_materials_per_unit?: number | null
  /** 复用任务时回填标题自定义开关 */
  draft_custom_title_enabled?: boolean | null
  /** 复用任务时回填自定义标题多行文本（一行一条） */
  draft_custom_titles_text?: string | null
  /** 复用任务时回填标题分配模式 */
  draft_custom_title_mode?: 'random' | 'uniform' | null
  /** 按广告主复用已有项目时：advertiser_id -> project_id（均字符串），
   * 与 advertiser_ids 一一覆盖；有此项则跳过 project/create
   */
  advertiser_project_ids?: Record<string, string> | null
  /** 可选：广告主维度单元列表；用于平均分配素材后让每个账户创建自己的单元 */
  promotions_by_advertiser?: Record<string, Record<string, unknown>[]> | null
  draft_custom_template_id?: number | null
}

export interface OceanEngineTemplateValidationError {
  field: string
  message: string
  code: string
}

export interface OceanEngineTemplateValidationResponse {
  valid: boolean
  errors: OceanEngineTemplateValidationError[]
}

export interface OceanEngineCustomAdTemplate {
  id: number
  user_id: number
  name: string
  description?: string | null
  tags: string[]
  project_template: Record<string, any>
  promotion_template: Record<string, any>
  rules: Record<string, any>
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface OceanEngineCustomAdTemplateListResponse {
  items: OceanEngineCustomAdTemplate[]
  total: number
}

export interface OceanEngineCustomAdTemplateInput {
  name: string
  description?: string | null
  tags?: string[]
  project_template: Record<string, any>
  promotion_template: Record<string, any>
  rules?: Record<string, any>
  enabled?: boolean
}

export interface OceanEngineCustomAdTemplateUpdateInput {
  name?: string
  description?: string | null
  tags?: string[]
  project_template?: Record<string, any>
  promotion_template?: Record<string, any>
  rules?: Record<string, any>
  enabled?: boolean
}

export interface OceanEngineBatchCreateStepResult {
  success: boolean
  code?: number | null
  message?: string | null
  data?: Record<string, unknown> | unknown[] | null
}

export interface OceanEngineBatchCreateAdsAccountResult {
  advertiser_id: string
  success: boolean
  message?: string | null
  project: OceanEngineBatchCreateStepResult
  promotions: OceanEngineBatchCreateStepResult[]
}

export interface OceanEngineBatchCreateAdsResponse {
  account_results: OceanEngineBatchCreateAdsAccountResult[]
}

export interface OceanEngineWebProjectDynamicParamConfigItem {
  key: string
  label: string
  description?: string | null
  default_uniform: boolean
}

export interface OceanEngineWebProjectDynamicParamConfigResponse {
  items: OceanEngineWebProjectDynamicParamConfigItem[]
}

export interface OceanEngineWebProjectDynamicParamOverride {
  key: string
  uniform: boolean
  value?: string | null
  values?: string[] | null
}

export interface OceanEngineWebProjectBatchCreateRequest {
  selected_cookie_config_id: number
  advertiser_ids: string[]
  project_payload: Record<string, unknown>
  project_name?: string | null
  download_urls?: string[] | null
  track_urls?: string[] | null
  action_track_urls?: string[] | null
  effective_frames?: string[] | null
  dynamic_param_overrides?: OceanEngineWebProjectDynamicParamOverride[] | null
  max_concurrency?: number
}

export interface OceanEngineWebProjectBatchCreateItem {
  advertiser_id: string
  success: boolean
  project_id?: string | null
  message?: string | null
  cookie_id?: string | null
  data?: Record<string, unknown> | unknown[] | null
}

export interface OceanEngineWebProjectBatchCreateResponse {
  results: OceanEngineWebProjectBatchCreateItem[]
  advertiser_project_ids: Record<string, string>
}

/** 手动批量创建异步任务 */
export interface BatchCreateJobEnqueueRequest {
  payload: OceanEngineBatchCreateAdsRequest
  scheduled_at?: string | null
}

export interface BatchCreateJobCreateResponse {
  job_id: number
}

export interface BatchCreateJobCancelResponse {
  message: string
}

export interface BatchCreateJobResubmitResponse {
  job_id: number
  status: string
}

export interface BatchCreateJobDetailResponse {
  id: number
  status: string
  error_message?: string | null
  result?: OceanEngineBatchCreateAdsResponse | null
  /** 入队请求体快照，用于复制到新建 */
  payload?: OceanEngineBatchCreateAdsRequest | null
  attempt_count: number
  max_attempts: number
  scheduled_at: string
  created_at: string
  started_at?: string | null
  finished_at?: string | null
}

export interface BatchCreateJobCreatorOption {
  user_id: number
  user_name?: string | null
}

export interface BatchCreateJobListItem {
  id: number
  user_id: number
  user_name?: string | null
  status: string
  summary?: string | null
  first_project_name?: string | null
  error_message?: string | null
  /** 项目步骤成功数 */
  success_project_count?: number | null
  /** 项目步骤总数（账户数） */
  total_project_count?: number | null
  /** 单元创建成功步数 */
  success_promotion_count?: number | null
  /** 单元创建总步数 */
  total_promotion_count?: number | null
  attempt_count: number
  max_attempts: number
  scheduled_at: string
  created_at: string
  started_at?: string | null
  finished_at?: string | null
}

const BATCH_CREATE_JOB_POLL_MS = 3000
/** 调度未运行时避免无限轮询（30 分钟） */
const BATCH_CREATE_JOB_MAX_WAIT_MS = 30 * 60 * 1000

// ==================== 视频素材相关 ====================

export interface VideoMaterialItem {
  id: string
  filename: string
  material_id: number
  poster_url: string
  url: string
  duration: number
  width: number
  height: number
  create_time: string
  format: string
  size: number
  /** 复制历史任务时可直接复用已有封面 ID，避免只有 video_id 无法反推 poster_url */
  video_cover_id?: string
}

export interface VideoMaterialPageInfo {
  page: number
  page_size: number
  total_number: number
  total_page: number
}

export interface VideoMaterialResponse {
  code: number
  message?: string
  data?: {
    list: VideoMaterialItem[]
    page_info: VideoMaterialPageInfo
  }
}

export type VideoMaterialFetchMode = 'cookie' | 'api'

export interface VideoMaterialFetchParams {
  org_advertiser_id: string
  advertiser_id: string
  page?: number
  page_size?: number
  /** 素材创建开始时间，格式 "yyyy-MM-dd" */
  start_time?: string
  /** 素材创建结束时间，格式 "yyyy-MM-dd" */
  end_time?: string
}

export interface CookieVideoMaterialFetchParams {
  selected_cookie_id: number
  advertiser_id: string
  page?: number
  page_size?: number
  keyword?: string
  /** 统计开始时间，格式 "yyyy-MM-dd" */
  start_time?: string
  /** 统计结束时间，格式 "yyyy-MM-dd" */
  end_time?: string
}

export interface VideoUploadResponse {
  code: number
  message?: string
  msg?: string
  data?: {
    video_id?: string
    material_id?: number | string
    video_signature?: string
    video_url?: string
    cover_image_url?: string
    duration?: number
    size?: number
    width?: number
    height?: number
  }
  _http_status?: number
}

export interface ImageUploadResponse {
  code: number
  message?: string
  msg?: string
  data?: {
    id?: string
    image_id?: string
    url?: string
    size?: number
    width?: number
    height?: number
    format?: string
    signature?: string
  }
  _http_status?: number
}

/** 连山 URL 异步上传（2/file/upload_task/create） */
export interface VideoAsyncUploadCreateResponse {
  code: number
  message?: string | null
  local_id?: number | null
  ocean_task_id?: number | null
}

export interface VideoAsyncUploadTaskItem {
  id: number
  org_advertiser_id: string
  advertiser_id: string
  account_type: string
  ocean_task_id: number | null
  local_status: string
  filename: string
  video_url_hash: string
  last_error?: string | null
  ocean_video_id?: string | null
  raw_last_poll?: unknown
  created_at?: string | null
  updated_at?: string | null
}

export interface VideoAsyncUploadTaskListResponse {
  items: VideoAsyncUploadTaskItem[]
  synced: boolean
}

export interface LianshanTosStatusResponse {
  enabled: boolean
}

/** 连山 TOS 上传 + 巨量 upload_task/create 一键响应 */
export interface VideoAsyncFullUploadResponse extends VideoAsyncUploadCreateResponse {
  video_url?: string | null
  lianshan_object_key?: string | null
}

export const videoMaterialService = {
  async getVideoMaterials(params: VideoMaterialFetchParams): Promise<VideoMaterialResponse> {
    const response = await apiClient.get<VideoMaterialResponse>(`${BASE_PATH}/video-materials`, {
      params
    })
    return response.data
  },

  async getVideoMaterialsByCookie(
    params: CookieVideoMaterialFetchParams
  ): Promise<VideoMaterialResponse> {
    const response = await apiClient.get<VideoMaterialResponse>(
      `${BASE_PATH}/video-materials/cookie`,
      {
        params
      }
    )
    return response.data
  },

  /** 本地上传视频至广告主素材库（multipart，对应 Open API 2/file/video/ad） */
  async uploadVideoMaterial(
    params: {
      org_advertiser_id: string
      advertiser_id: string
      file: File
      file_name?: string
      is_aigc?: boolean
    },
    options?: { onUploadProgress?: (percent: number) => void }
  ): Promise<VideoUploadResponse> {
    const form = new FormData()
    form.append('org_advertiser_id', params.org_advertiser_id)
    form.append('advertiser_id', params.advertiser_id)
    form.append('file', params.file)
    if (params.file_name != null && params.file_name !== '') {
      form.append('file_name', params.file_name)
    }
    if (params.is_aigc !== undefined) {
      form.append('is_aigc', params.is_aigc ? 'true' : 'false')
    }
    const response = await apiClient.post<VideoUploadResponse>(
      `${BASE_PATH}/video-materials/upload`,
      form,
      {
        timeout: 300000,
        onUploadProgress: (ev) => {
          if (ev.total && options?.onUploadProgress) {
            options.onUploadProgress(Math.round((ev.loaded * 100) / ev.total))
          }
        },
        transformRequest: [
          (data, headers) => {
            if (data instanceof FormData && headers) {
              delete headers['Content-Type']
            }
            return data
          }
        ]
      }
    )
    return response.data
  },

  /** 本地上传视频至升级版工作台素材库（multipart，对应 Open API v3.0/tools/ebp/video/upload） */
  async uploadEbpVideoMaterial(
    params: {
      org_advertiser_id: string
      account_id: string
      file: File
      file_name?: string
      is_aigc?: boolean
    },
    options?: { onUploadProgress?: (percent: number) => void }
  ): Promise<VideoUploadResponse> {
    const form = new FormData()
    form.append('org_advertiser_id', params.org_advertiser_id)
    form.append('account_id', params.account_id)
    form.append('file', params.file)
    if (params.file_name != null && params.file_name !== '') {
      form.append('file_name', params.file_name)
    }
    if (params.is_aigc !== undefined) {
      form.append('is_aigc', params.is_aigc ? 'true' : 'false')
    }
    const response = await apiClient.post<VideoUploadResponse>(
      `${BASE_PATH}/video-materials/upload-ebp`,
      form,
      {
        timeout: 300000,
        onUploadProgress: (ev) => {
          if (ev.total && options?.onUploadProgress) {
            options.onUploadProgress(Math.round((ev.loaded * 100) / ev.total))
          }
        },
        transformRequest: [
          (data, headers) => {
            if (data instanceof FormData && headers) {
              delete headers['Content-Type']
            }
            return data
          }
        ]
      }
    )
    return response.data
  },

  /** 本地上传图片至广告主素材库（multipart，对应 Open API 2/file/image/ad） */
  async uploadImageMaterial(params: {
    org_advertiser_id: string
    advertiser_id: string
    file: File
    filename?: string
    is_aigc?: boolean
  }): Promise<ImageUploadResponse> {
    const form = new FormData()
    form.append('org_advertiser_id', params.org_advertiser_id)
    form.append('advertiser_id', params.advertiser_id)
    form.append('file', params.file)
    if (params.filename != null && params.filename !== '') {
      form.append('filename', params.filename)
    }
    if (params.is_aigc !== undefined) {
      form.append('is_aigc', params.is_aigc ? 'true' : 'false')
    }
    const response = await apiClient.post<ImageUploadResponse>(
      `${BASE_PATH}/image-materials/upload`,
      form,
      {
        timeout: 120000,
        transformRequest: [
          (data, headers) => {
            if (data instanceof FormData && headers) {
              delete headers['Content-Type']
            }
            return data
          }
        ]
      }
    )
    return response.data
  },

  /** 连山 video_url 异步上传（JSON，对应 2/file/upload_task/create） */
  async createAsyncUpload(params: {
    org_advertiser_id: string
    advertiser_id: string
    filename: string
    video_url: string
    account_type?: string
    labels?: string[]
    is_aigc?: boolean
    is_guide_video?: boolean
    is_need_auth?: boolean
  }): Promise<VideoAsyncUploadCreateResponse> {
    const response = await apiClient.post<VideoAsyncUploadCreateResponse>(
      `${BASE_PATH}/video-materials/upload-async`,
      params
    )
    return response.data
  },

  /** 异步任务列表；sync=true 时后端会先向巨量拉取 processing 任务状态 */
  async listUploadTasks(params?: {
    sync?: boolean
    limit?: number
  }): Promise<VideoAsyncUploadTaskListResponse> {
    const response = await apiClient.get<VideoAsyncUploadTaskListResponse>(
      `${BASE_PATH}/video-materials/upload-tasks`,
      { params: params ?? {} }
    )
    return response.data
  },

  async getLianshanTosStatus(): Promise<LianshanTosStatusResponse> {
    const response = await apiClient.get<LianshanTosStatusResponse>(
      `${BASE_PATH}/video-materials/lianshan-tos-status`
    )
    return response.data
  },

  /**
   * 本地上传 → 连山 TOS → 巨量 2/file/upload_task/create（需服务端配置 LIANGSHAN_TOS_*）
   */
  async uploadAsyncFull(
    params: {
      org_advertiser_id: string
      advertiser_id: string
      file: File
      file_name?: string
      account_type?: string
      is_aigc?: boolean
      is_guide_video?: boolean
      is_need_auth?: boolean
    },
    options?: { onUploadProgress?: (percent: number) => void }
  ): Promise<VideoAsyncFullUploadResponse> {
    const form = new FormData()
    form.append('org_advertiser_id', params.org_advertiser_id)
    form.append('advertiser_id', params.advertiser_id)
    form.append('account_type', params.account_type ?? 'ADVERTISER')
    form.append('file', params.file)
    if (params.file_name != null && params.file_name !== '') {
      form.append('file_name', params.file_name)
    }
    if (params.is_aigc !== undefined) {
      form.append('is_aigc', params.is_aigc ? 'true' : 'false')
    }
    if (params.is_guide_video !== undefined) {
      form.append('is_guide_video', params.is_guide_video ? 'true' : 'false')
    }
    if (params.is_need_auth !== undefined) {
      form.append('is_need_auth', params.is_need_auth ? 'true' : 'false')
    }
    const response = await apiClient.post<VideoAsyncFullUploadResponse>(
      `${BASE_PATH}/video-materials/upload-async-full`,
      form,
      {
        timeout: 600000,
        onUploadProgress: (ev) => {
          if (ev.total && options?.onUploadProgress) {
            options.onUploadProgress(Math.round((ev.loaded * 100) / ev.total))
          }
        },
        transformRequest: [
          (data, headers) => {
            if (data instanceof FormData && headers) {
              delete headers['Content-Type']
            }
            return data
          }
        ]
      }
    )
    return response.data
  }
}

// ==================== DPA 商品库查询 ====================

export interface DpaProductItem {
  product_id: number | string // 大整数在 JS 中会失精，使用时始终用 String() 转换
  name: string
  platform_id?: number
  status?: number
}

export interface DpaProductResponse {
  code: number
  message?: string
  data?: {
    list: DpaProductItem[]
    page_info?: { total_number: number; page: number }
  }
}

export interface DpaProductLibraryItem {
  product_platform_id: string
  name: string
}

export interface DpaProductLibraryListResponse {
  code: number
  message?: string
  data?: {
    list: DpaProductLibraryItem[]
  }
}

export const dpaProductService = {
  async listProductLibraries(params: {
    org_advertiser_id: string
    limit?: number
    /** EBP 失败或为空时，携带 Cookie 配置 ID 与广告主 aadvid 降级 superior 接口 */
    selected_cookie_id?: number
    advertiser_id?: string
  }): Promise<DpaProductLibraryListResponse> {
    const response = await apiClient.get<DpaProductLibraryListResponse>(
      `${BASE_PATH}/dpa-product-libraries`,
      { params }
    )
    return response.data
  },
  async queryProducts(params: {
    org_advertiser_id: string
    advertiser_id: string
    product_platform_id: string
    product_name: string
  }): Promise<DpaProductResponse> {
    const response = await apiClient.get<DpaProductResponse>(`${BASE_PATH}/dpa-products`, {
      params
    })
    return response.data
  }
}

export interface AwemeAuthItem {
  aweme_id?: string | null
  aweme_name?: string | null
  auth_type?: string | null
  auth_status?: string | null
  share_type?: string | null
  start_time?: string | null
  end_time?: string | null
}

export interface AwemeAuthListResponse {
  code: number
  message?: string
  data?: {
    list: AwemeAuthItem[]
    page_info?: {
      total_number?: number
      page?: number
      page_size?: number
      total_page?: number
    }
  }
}

export const awemeAuthService = {
  async getAwemeAuthList(params: {
    org_advertiser_id: string
    advertiser_id: string
    page_size?: number
  }): Promise<AwemeAuthListResponse> {
    const response = await apiClient.get<AwemeAuthListResponse>(`${BASE_PATH}/aweme-auth-list`, {
      params
    })
    return response.data
  }
}

export interface GetDramaTitlesResponse {
  code: number
  data?: {
    titles: string[]
  }
  msg?: string
  error?: string
}

// ==================== Excel 导入批量创建广告 ====================

export interface ExcelAdRowConfig {
  advertiser_id: string
  /** 视频素材库所在广告主 ID；留空则与 advertiser_id 相同 */
  material_advertiser_id?: string | null
  template: 'puju' | 'ceju'
  drama_name: string
  playlet_url: string
  aweme_id?: string
  budget?: number
  roi_goal?: number | null
  material_keywords?: string | null
  project_name?: string | null
  promo_name?: string | null
  product_platform_id?: string | null
  source?: string | null
  /** 行级单元素材数（留空则继承高级设置中的全局值） */
  materials_per_unit?: number | null
  /** 预检后填入，execute 时携带避免重复查询 */
  product_id?: string | null
}

export interface ExcelBatchCreateAdsRequest {
  org_advertiser_ids: string[]
  rows: ExcelAdRowConfig[]
  max_concurrency?: number
  video_start_time?: string
  video_end_time?: string
  project_path?: string
  promotion_path?: string
  /** 每个广告单元最多包含的视频素材数，超出自动拆分（默认 10） */
  materials_per_unit?: number
}

export interface ExcelBatchPreviewRow {
  row_index: number
  advertiser_id: string
  /** 预检拉取视频时实际使用的账户 ID */
  material_advertiser_id: string
  drama_name: string
  template: string
  product_id?: string | null
  product_id_error?: string | null
  matched_video_ids: string[]
  matched_video_count: number
  promotion_count: number
  warnings: string[]
}

export interface ExcelBatchPreviewResponse {
  rows: ExcelBatchPreviewRow[]
  total_accounts: number
  total_promotions: number
  has_warnings: boolean
}

export interface ExcelBatchCreateAdsResponse {
  account_results: OceanEngineBatchCreateAdsAccountResult[]
}

export const oceanEngineExcelAdService = {
  /** 下载 Excel 模板文件 */
  async downloadTemplate(): Promise<void> {
    const response = await apiClient.get(`${BASE_PATH}/batch-create-ads-excel/template`, {
      responseType: 'blob'
    })
    const blob = new Blob([response.data as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'batch_ads_template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  },

  /** 预检：查询 product_id + 匹配视频素材 */
  async preview(payload: ExcelBatchCreateAdsRequest): Promise<ExcelBatchPreviewResponse> {
    const response = await apiClient.post<ExcelBatchPreviewResponse>(
      `${BASE_PATH}/batch-create-ads-excel/preview`,
      payload,
      { timeout: 120000 }
    )
    return response.data
  },

  /** 执行批量创建 */
  async execute(payload: ExcelBatchCreateAdsRequest): Promise<ExcelBatchCreateAdsResponse> {
    const response = await apiClient.post<ExcelBatchCreateAdsResponse>(
      `${BASE_PATH}/batch-create-ads-excel/execute`,
      payload,
      { timeout: 300000, responseType: 'text', transformResponse: [(data) => data] }
    )
    return parseOceanEngineBatchCreateResponse<ExcelBatchCreateAdsResponse>(response.data)
  }
}

// ==================== 飞书 Bitable 接入批量创建广告 ====================

export interface BitableAdTemplateCreateRequest {
  bitable_name?: string
  table_name?: string
  folder_token?: string
  with_example?: boolean
}

export interface BitableAdTemplateCreateResponse {
  app_token: string
  app_url: string
  table_id: string
  table_name: string
  message: string
}

export interface BitableAdSubmitRequest {
  app_token: string
  table_id: string
  org_advertiser_ids: string[]
  max_concurrency?: number
  video_start_time?: string
  video_end_time?: string
  materials_per_unit?: number
  sender_open_id?: string
}

export const oceanEngineBitableAdService = {
  /** 创建飞书多维表格投放配置模板 */
  async createTemplate(
    payload: BitableAdTemplateCreateRequest
  ): Promise<BitableAdTemplateCreateResponse> {
    const response = await apiClient.post<BitableAdTemplateCreateResponse>(
      `${BASE_PATH}/bitable-ads/template`,
      payload,
      { timeout: 60000 }
    )
    return response.data
  },

  /** 预检：读取 Bitable 配置，查询商品 ID + 匹配视频素材 */
  async preview(payload: BitableAdSubmitRequest): Promise<ExcelBatchPreviewResponse> {
    const response = await apiClient.post<ExcelBatchPreviewResponse>(
      `${BASE_PATH}/bitable-ads/preview`,
      payload,
      { timeout: 180000 }
    )
    return response.data
  },

  /** 执行：只取预检通过行，批量创建广告 */
  async execute(payload: BitableAdSubmitRequest): Promise<ExcelBatchCreateAdsResponse> {
    const response = await apiClient.post<ExcelBatchCreateAdsResponse>(
      `${BASE_PATH}/bitable-ads/execute`,
      payload,
      { timeout: 300000, responseType: 'text', transformResponse: [(data) => data] }
    )
    return parseOceanEngineBatchCreateResponse<ExcelBatchCreateAdsResponse>(response.data)
  }
}

export interface OceanEngineAdTemplateMeta {
  code: string
  label: string
  tags: string[]
  enabled: boolean
}

export interface OceanEngineAdTemplateRules {
  default_product_platform_id: string
  supports_roi_goal: boolean
  supports_cpa_bid: boolean
  requires_product_id: boolean
  requires_playlet_url: boolean
  requires_aweme_id: boolean
  requires_video_materials: boolean
  materials_split_mode: string
  materials_per_unit_default: number
}

export interface OceanEngineAdTemplateSummary {
  meta: OceanEngineAdTemplateMeta
  rules: OceanEngineAdTemplateRules
}

export interface OceanEngineAdTemplateDetail {
  meta: OceanEngineAdTemplateMeta
  rules: OceanEngineAdTemplateRules
  project_template: Record<string, any>
  unit_template: Record<string, any>
}

export interface OceanEngineAdTemplateListResponse {
  items: OceanEngineAdTemplateSummary[]
  total: number
}

export const oceanEngineBatchAdService = {
  async getAdTemplates(): Promise<OceanEngineAdTemplateListResponse> {
    const response = await apiClient.get<OceanEngineAdTemplateListResponse>(
      `${BASE_PATH}/ad-templates`
    )
    return response.data
  },

  async getAdTemplateDetail(templateCode: string): Promise<OceanEngineAdTemplateDetail> {
    const response = await apiClient.get<OceanEngineAdTemplateDetail>(
      `${BASE_PATH}/ad-templates/${templateCode}`
    )
    return response.data
  },

  async getCustomAdTemplates(params?: {
    include_disabled?: boolean
  }): Promise<OceanEngineCustomAdTemplateListResponse> {
    const response = await apiClient.get<OceanEngineCustomAdTemplateListResponse>(
      `${BASE_PATH}/custom-ad-templates`,
      { params }
    )
    return response.data
  },

  async getCustomAdTemplate(templateId: number): Promise<OceanEngineCustomAdTemplate> {
    const response = await apiClient.get<OceanEngineCustomAdTemplate>(
      `${BASE_PATH}/custom-ad-templates/${templateId}`
    )
    return response.data
  },

  async createCustomAdTemplate(
    payload: OceanEngineCustomAdTemplateInput
  ): Promise<OceanEngineCustomAdTemplate> {
    const response = await apiClient.post<OceanEngineCustomAdTemplate>(
      `${BASE_PATH}/custom-ad-templates`,
      payload
    )
    return response.data
  },

  async updateCustomAdTemplate(
    templateId: number,
    payload: OceanEngineCustomAdTemplateUpdateInput
  ): Promise<OceanEngineCustomAdTemplate> {
    const response = await apiClient.put<OceanEngineCustomAdTemplate>(
      `${BASE_PATH}/custom-ad-templates/${templateId}`,
      payload
    )
    return response.data
  },

  async deleteCustomAdTemplate(templateId: number): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(
      `${BASE_PATH}/custom-ad-templates/${templateId}`
    )
    return response.data
  },

  async validateCustomAdTemplate(payload: {
    project_template: Record<string, any>
    promotion_template: Record<string, any>
  }): Promise<OceanEngineTemplateValidationResponse> {
    const response = await apiClient.post<OceanEngineTemplateValidationResponse>(
      `${BASE_PATH}/custom-ad-templates/validate`,
      payload
    )
    return response.data
  },

  async batchCreateAds(
    payload: OceanEngineBatchCreateAdsRequest
  ): Promise<OceanEngineBatchCreateAdsResponse> {
    const response = await apiClient.post<OceanEngineBatchCreateAdsResponse>(
      `${BASE_PATH}/batch-create-ads`,
      payload,
      { timeout: 300000, responseType: 'text', transformResponse: [(data) => data] }
    )
    return parseOceanEngineBatchCreateResponse<OceanEngineBatchCreateAdsResponse>(response.data)
  },

  async getWebProjectDynamicParamConfig(): Promise<OceanEngineWebProjectDynamicParamConfigResponse> {
    const response = await apiClient.get<OceanEngineWebProjectDynamicParamConfigResponse>(
      `${BASE_PATH}/web-projects/dynamic-param-config`
    )
    return response.data
  },

  async batchCreateWebProjects(
    payload: OceanEngineWebProjectBatchCreateRequest
  ): Promise<OceanEngineWebProjectBatchCreateResponse> {
    const response = await apiClient.post<OceanEngineWebProjectBatchCreateResponse>(
      `${BASE_PATH}/web-projects/batch-create`,
      payload,
      { timeout: 300000 }
    )
    return response.data
  },

  /** 手动批量创建：入队，由 ocean 调度进程执行 */
  async createBatchCreateJob(
    body: BatchCreateJobEnqueueRequest
  ): Promise<BatchCreateJobCreateResponse> {
    const response = await apiClient.post<BatchCreateJobCreateResponse>(
      `${BASE_PATH}/batch-create-ads/jobs`,
      body,
      { timeout: 120000 }
    )
    return response.data
  },

  async getBatchCreateJob(jobId: number): Promise<BatchCreateJobDetailResponse> {
    const response = await apiClient.get<BatchCreateJobDetailResponse>(
      `${BASE_PATH}/batch-create-ads/jobs/${jobId}`,
      { responseType: 'text', transformResponse: [(data) => data] }
    )
    return parseOceanEngineBatchCreateResponse<BatchCreateJobDetailResponse>(response.data)
  },

  async listBatchCreateJobs(params: {
    page?: number
    page_size?: number
    status?: string
    user_id?: number
    keyword?: string
    advertiser_id?: string
  }): Promise<PaginatedResponse<BatchCreateJobListItem>> {
    const response = await apiClient.get<PaginatedResponse<BatchCreateJobListItem>>(
      `${BASE_PATH}/batch-create-ads/jobs`,
      {
        params: {
          page: params.page,
          page_size: params.page_size,
          status: params.status || undefined,
          user_id: params.user_id ?? undefined,
          keyword: params.keyword?.trim() || undefined,
          advertiser_id: params.advertiser_id?.trim() || undefined
        }
      }
    )
    return response.data
  },

  async listBatchCreateJobCreators(): Promise<BatchCreateJobCreatorOption[]> {
    const response = await apiClient.get<BatchCreateJobCreatorOption[]>(
      `${BASE_PATH}/batch-create-ads/jobs/creators`
    )
    return response.data
  },

  async retryFailedBatchCreateJob(jobId: number): Promise<BatchCreateJobCreateResponse> {
    const response = await apiClient.post<BatchCreateJobCreateResponse>(
      `${BASE_PATH}/batch-create-ads/jobs/${jobId}/retry-failed`
    )
    return response.data
  },

  async cancelBatchCreateJob(jobId: number): Promise<BatchCreateJobCancelResponse> {
    const response = await apiClient.post<BatchCreateJobCancelResponse>(
      `${BASE_PATH}/batch-create-ads/jobs/${jobId}/cancel`
    )
    return response.data
  },

  async resubmitBatchCreateJob(
    jobId: number,
    payload: OceanEngineBatchCreateAdsRequest
  ): Promise<BatchCreateJobResubmitResponse> {
    const response = await apiClient.put<BatchCreateJobResubmitResponse>(
      `${BASE_PATH}/batch-create-ads/jobs/${jobId}/resubmit`,
      payload,
      { timeout: 120000 }
    )
    return response.data
  },

  /** 轮询直到 success / partial / failed */
  async pollBatchCreateJobUntilDone(
    jobId: number,
    options?: { intervalMs?: number; signal?: AbortSignal; maxWaitMs?: number }
  ): Promise<BatchCreateJobDetailResponse> {
    const intervalMs = options?.intervalMs ?? BATCH_CREATE_JOB_POLL_MS
    const maxWaitMs = options?.maxWaitMs ?? BATCH_CREATE_JOB_MAX_WAIT_MS
    const terminal = new Set(['success', 'partial', 'failed'])
    const started = Date.now()
    for (;;) {
      if (options?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      if (Date.now() - started > maxWaitMs) {
        throw new Error(
          '等待任务结果超时（请确认已启动手动批量创建 Worker：tasks.ocean_batch_create_main，或稍后再试）'
        )
      }
      const detail = await this.getBatchCreateJob(jobId)
      if (terminal.has(detail.status)) {
        return detail
      }
      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))
    }
  },

  /**
   * 获取漫剧标题池（从后端获取，便于后续统一调整）
   */
  async getDramaTitles(): Promise<GetDramaTitlesResponse> {
    const response = await apiClient.get<GetDramaTitlesResponse>(`${BASE_PATH}/get-drama-titles`)
    return response.data
  }
}

/**
 * 数据助手配置服务
 */
export const dataAssistantConfigService = {
  /**
   * 获取数据助手配置（如果不存在则创建默认配置）
   */
  async getConfig(configId: number): Promise<DataAssistantConfig> {
    const response = await apiClient.get<DataAssistantConfig>(
      `/api/v1/data-assistant-config/config/${configId}`
    )
    return response.data
  },

  /**
   * 创建数据助手配置
   */
  async createConfig(data: DataAssistantConfigCreate): Promise<DataAssistantConfig> {
    const response = await apiClient.post<DataAssistantConfig>(
      '/api/v1/data-assistant-config',
      data
    )
    return response.data
  },

  /**
   * 更新数据助手配置
   */
  async updateConfig(
    configId: number,
    data: DataAssistantConfigUpdate
  ): Promise<DataAssistantConfig> {
    const response = await apiClient.put<DataAssistantConfig>(
      `/api/v1/data-assistant-config/config/${configId}`,
      data
    )
    return response.data
  },

  /**
   * 获取用户所有数据助手配置
   */
  async getAllConfigs(): Promise<DataAssistantConfig[]> {
    const response = await apiClient.get<DataAssistantConfig[]>(
      '/api/v1/data-assistant-config/user/all'
    )
    return response.data
  },

  /**
   * 删除数据助手配置
   */
  async deleteConfig(configId: number): Promise<void> {
    await apiClient.delete(`/api/v1/data-assistant-config/config/${configId}`)
  }
}

/**
 * 数据助手V2配置服务
 */
export const dataAssistantV2ConfigService = {
  /**
   * 获取数据助手V2配置（如果不存在则创建默认配置）
   */
  async getConfig(configId: number): Promise<DataAssistantConfig> {
    const response = await apiClient.get<DataAssistantConfig>(
      `/api/v1/data-assistant-v2-config/config/${configId}`
    )
    return response.data
  },

  /**
   * 创建数据助手V2配置
   */
  async createConfig(data: DataAssistantConfigCreate): Promise<DataAssistantConfig> {
    const response = await apiClient.post<DataAssistantConfig>(
      '/api/v1/data-assistant-v2-config',
      data
    )
    return response.data
  },

  /**
   * 更新数据助手V2配置
   */
  async updateConfig(
    configId: number,
    data: DataAssistantConfigUpdate
  ): Promise<DataAssistantConfig> {
    const response = await apiClient.put<DataAssistantConfig>(
      `/api/v1/data-assistant-v2-config/config/${configId}`,
      data
    )
    return response.data
  },

  /**
   * 获取用户所有数据助手V2配置
   */
  async getAllConfigs(): Promise<DataAssistantConfig[]> {
    const response = await apiClient.get<DataAssistantConfig[]>(
      '/api/v1/data-assistant-v2-config/user/all'
    )
    return response.data
  },

  /**
   * 删除数据助手V2配置
   */
  async deleteConfig(configId: number): Promise<void> {
    await apiClient.delete(`/api/v1/data-assistant-v2-config/config/${configId}`)
  }
}

export type { DataAssistantConfig, DataAssistantConfigCreate, DataAssistantConfigUpdate }
