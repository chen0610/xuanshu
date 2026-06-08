import apiClient from './api'

const BASE_PATH = '/api/v1/tencent-ads'

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

/**
 * 创意资产相关接口
 */
interface CreativeAssetListRequest {
  selected_cookie_id: number
  asset_type: 'image' | 'video' | 'text' | 'brand' | 'marketing' | 'landing_page'
  page?: number
  page_size?: number
  organization_id?: number
}

interface CreativeAssetListResponse {
  code: number
  data?: {
    organization_id?: number
    g_tk?: string
    list?: Array<{
      component?: {
        account_id?: number | string
        component_id?: number | string
        component_type?: string
        component_type_cn?: string
        component_sub_type?: string
        component_sub_type_cn?: string
        component_custom_name?: string
        component_value?: Record<string, any>
        system_status_cn?: string
        image_ids?: string
        video_ids?: string
      }
    }>
    page_info?: {
      page: number
      page_size: number
      total_number: number
      total_page: number
    }
  }
  msg?: string
  error?: string
}

/**
 * 创意资产服务
 */
export const creativeAssetService = {
  /**
   * 获取创意资产列表
   */
  async getCreativeAssets(data: CreativeAssetListRequest): Promise<CreativeAssetListResponse> {
    const response = await apiClient.post<CreativeAssetListResponse>(
      `${BASE_PATH}/creative-assets/list`,
      data
    )
    return response.data
  }
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
  success_item_ids?: string[] | null
  success_item_id_type?: string | null
  error_message: string | null
  error_details?: Record<string, any> | null
  task_config_snapshot?: Record<string, any> | null
  created_at: string
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
    all_adgroups?: any[]
    total_count?: number
  }
  msg?: string
  error?: string
}

interface DisplayPromotionStatusUpdateItem {
  account_id: number
  adgroup_id?: number
  dynamic_creative_id?: number
  configured_status: string
  adgroup_type: string
}

interface DisplayPromotionBatchUpdateRequest {
  selected_cookie_id: number
  items: DisplayPromotionStatusUpdateItem[]
}

interface DisplayPromotionBatchUpdateResponse {
  code: number
  data?: {
    task_id?: number | string
    task_ids?: Array<number | string>
  }
  msg?: string
  error?: string
}

interface BatchModifyBidsRequest {
  account_ids: string[]
  bid_type: 'max_conversion' | 'stable'
  selected_cookie_id: number
  control_cost?: number
  bid_amount?: number
  deep_bid_amount?: number
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

export type TencentBatchAssistantJobStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'partial'
  | 'failed'
  | 'cancelled'

interface TencentBatchAssistantJobCreateRequest {
  job_type: string
  payload: Record<string, any>
}

interface TencentBatchAssistantJobCreateResponse {
  code: number
  job_id: number
  status: TencentBatchAssistantJobStatus
  msg?: string
}

export interface TencentBatchAssistantJobItem {
  id: number
  user_id: number
  config_id?: number | null
  job_type: string
  status: TencentBatchAssistantJobStatus
  total_count: number
  processed_count: number
  success_count: number
  error_count: number
  progress: number
  current_step?: string | null
  current_message?: string | null
  creator_username?: string | null
  creator_name?: string | null
  creator_role?: string | null
  parent_job_id?: number | null
  retry_mode?: string | null
  error_message?: string | null
  attempt_count: number
  max_attempts: number
  created_at: string
  started_at?: string | null
  finished_at?: string | null
}

export interface TencentBatchAssistantJobDetail extends TencentBatchAssistantJobItem {
  payload: Record<string, any>
  result?: Record<string, any> | null
}

export interface TencentBatchAssistantJobEvent {
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

interface TencentBatchAssistantJobListResponse {
  items: TencentBatchAssistantJobItem[]
  meta: PaginatedResponse<unknown>['meta']
}

interface TencentBatchAssistantJobEventListResponse {
  items: TencentBatchAssistantJobEvent[]
}

interface TencentBatchAssistantJobRetryRequest {
  mode: 'all' | 'failed_only'
}

interface TencentBatchAssistantJobRetryResponse {
  code: number
  job_id: number
  status: TencentBatchAssistantJobStatus
  msg?: string
}

interface TencentBatchAssistantJobRecoverResponse {
  code: number
  job_id: number
  status: TencentBatchAssistantJobStatus
  msg?: string
}

/**
 * 常规修改出价相关接口
 */
interface NormalBidModifyRequest {
  account_ids: string[]
  selected_cookie_id: number
  bid_amount?: number // 出价金额（单位：分，为空时不修改常规出价）
  deep_conversion_behavior_bid?: number // 深度目标出价（单位：元，为空时不修改深度出价）
  date_range?: {
    start_date: string
    end_date: string
  }
}

interface NormalBidModifyResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    task_ids?: string[]
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

/**
 * 智投投放目标相关接口
 */
interface SmartTargetRequest {
  account_ids: string[]
  selected_cookie_id: number
  activate_cost?: number // 激活成本（单位：元，为空时不修改）
  retention_cost?: number // 次留成本（单位：元，为空时不修改）
  date_range?: {
    start_date: string
    end_date: string
  }
}

interface SmartTargetResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    task_ids?: string[]
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

/**
 * 一键起量相关接口
 */
interface AutoAcquisitionRequest {
  account_ids: string[]
  operation_type: 'enable' | 'disable'
  selected_cookie_id: number
  launch_amount?: number
}

interface AutoAcquisitionResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    task_ids?: string[]
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
      data
    )
    return response.data
  },

  /**
   * 常规修改出价
   */
  async normalBidModify(data: NormalBidModifyRequest): Promise<NormalBidModifyResponse> {
    const response = await apiClient.post<NormalBidModifyResponse>(
      `${BASE_PATH}/normal-bid-modify`,
      data
    )
    return response.data
  },

  /**
   * 智投投放目标修改
   */
  async smartTargetModify(data: SmartTargetRequest): Promise<SmartTargetResponse> {
    const response = await apiClient.post<SmartTargetResponse>(
      `${BASE_PATH}/smart-target-modify`,
      data
    )
    return response.data
  }
}

export const tencentBatchAssistantJobService = {
  async createJob(
    data: TencentBatchAssistantJobCreateRequest
  ): Promise<TencentBatchAssistantJobCreateResponse> {
    const response = await apiClient.post<TencentBatchAssistantJobCreateResponse>(
      `${BASE_PATH}/batch-assistant/jobs`,
      data
    )
    return response.data
  },

  async listJobs(
    params: {
      page?: number
      page_size?: number
      status?: TencentBatchAssistantJobStatus
    } = {}
  ): Promise<TencentBatchAssistantJobListResponse> {
    const response = await apiClient.get<TencentBatchAssistantJobListResponse>(
      `${BASE_PATH}/batch-assistant/jobs`,
      { params }
    )
    return response.data
  },

  async getJob(jobId: number): Promise<TencentBatchAssistantJobDetail> {
    const response = await apiClient.get<TencentBatchAssistantJobDetail>(
      `${BASE_PATH}/batch-assistant/jobs/${jobId}`
    )
    return response.data
  },

  async listJobEvents(
    jobId: number,
    params: { limit?: number; after_id?: number } = {}
  ): Promise<TencentBatchAssistantJobEventListResponse> {
    const response = await apiClient.get<TencentBatchAssistantJobEventListResponse>(
      `${BASE_PATH}/batch-assistant/jobs/${jobId}/events`,
      { params }
    )
    return response.data
  },

  async cancelJob(jobId: number): Promise<{
    code: number
    job_id: number
    status: TencentBatchAssistantJobStatus
    msg?: string
  }> {
    const response = await apiClient.post<{
      code: number
      job_id: number
      status: TencentBatchAssistantJobStatus
      msg?: string
    }>(`${BASE_PATH}/batch-assistant/jobs/${jobId}/cancel`)
    return response.data
  },

  async resumeJob(jobId: number): Promise<TencentBatchAssistantJobRecoverResponse> {
    const response = await apiClient.post<TencentBatchAssistantJobRecoverResponse>(
      `${BASE_PATH}/batch-assistant/jobs/${jobId}/resume`
    )
    return response.data
  },

  async retryJob(
    jobId: number,
    data: TencentBatchAssistantJobRetryRequest
  ): Promise<TencentBatchAssistantJobRetryResponse> {
    const response = await apiClient.post<TencentBatchAssistantJobRetryResponse>(
      `${BASE_PATH}/batch-assistant/jobs/${jobId}/retry`,
      data
    )
    return response.data
  },

  async recoverJob(jobId: number): Promise<TencentBatchAssistantJobRecoverResponse> {
    const response = await apiClient.post<TencentBatchAssistantJobRecoverResponse>(
      `${BASE_PATH}/batch-assistant/jobs/${jobId}/recover`
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
 * 一键起量服务
 */
export const autoAcquisitionService = {
  /**
   * 批量开启/关闭一键起量
   */
  async batchAutoAcquisition(data: AutoAcquisitionRequest): Promise<AutoAcquisitionResponse> {
    const response = await apiClient.post<AutoAcquisitionResponse>(
      `${BASE_PATH}/batch-auto-acquisition`,
      data
    )
    return response.data
  }
}

/**
 * 有量素材提取相关接口
 */
interface MaterialExtractionRequest {
  account_ids: string[]
  selected_cookie_id: number
  consumption_amount?: number
  activated_count?: number
  activated_cost?: number
  start_date: string
  end_date: string
}

interface MaterialExtractionResponse {
  code: number
  data?: {
    materials?: Array<{
      account_id: string
      adgroup_id?: string
      dynamic_creative_id?: string
      dynamic_creative_name: string
      dayu_cid?: string
      cost: number
      activated_count?: number
      activated_cost?: number
      system_status_cn?: string
      material_package_id?: number
      site_set_cn?: string
      video_ids?: string
      descriptions?: string
      brand_name?: string
      button_text?: string
    }>
    total_count?: number
  }
  msg?: string
  error?: string
}

/**
 * 有量素材提取服务
 */
export const materialExtractionService = {
  /**
   * 提取有量素材
   */
  async extractMaterials(data: MaterialExtractionRequest): Promise<MaterialExtractionResponse> {
    const response = await apiClient.post<MaterialExtractionResponse>(
      `${BASE_PATH}/extract-materials`,
      data
    )
    return response.data
  }
}

/**
 * 修改备注标签相关接口
 */
interface AccountRemarkRequest {
  account_ids: string[]
  operation_type: 'remark' | 'tag'
  selected_cookie_id: number
  alias_name: string
  start_number: number
  org_id?: string
}

interface AccountRemarkResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    account_results: Array<{
      account_id: string
      success: boolean
      error?: string
    }>
  }
  msg?: string
  error?: string
}

/**
 * 修改备注标签服务
 */
export const accountRemarkService = {
  /**
   * 批量修改备注标签
   */
  async batchModifyAccountRemark(data: AccountRemarkRequest): Promise<AccountRemarkResponse> {
    const response = await apiClient.post<AccountRemarkResponse>(
      `${BASE_PATH}/batch-modify-account-remark`,
      data
    )
    return response.data
  }
}

/**
 * 修改RTA相关接口
 */
interface RTARequest {
  account_ids: string[]
  selected_cookie_id: number
  dimension_type: 'adgroup' | 'account'
  rta_id?: string
  strategy_id?: string
  rta_target_id?: string
}

interface RTAResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    total_processed_adgroups: number
    account_results: Array<{
      account_id: string
      adgroups_processed: number
      success_count: number
      error_count: number
      errors: string[]
    }>
  }
  msg?: string
  error?: string
}

/**
 * 修改RTA服务
 */
export const rtaService = {
  /**
   * 批量修改RTA
   */
  async batchModifyRTA(data: RTARequest): Promise<RTAResponse> {
    const response = await apiClient.post<RTAResponse>(`${BASE_PATH}/batch-modify-rta`, data)
    return response.data
  }
}

/**
 * 转化归因相关接口
 */
interface ConversionAttributionRequest {
  account_id: string
  conversion_name: string
  tracking_url: string
  conversion_mode: 'APP' | 'WEB'
  app_type?: 'ANDROID' | 'IOS'
  app_id?: string
  web_app_type?: 'WECHAT_MINI_PROGRAM'
  web_app_id?: string
  conversion_type?: '激活' | '次留' | '七留' | '每留' | '网页转化'
  selected_cookie_id: number
  grant_enabled?: boolean
  grant_mode?: 'ALL' | 'SPECIFIED'
  grant_account_ids?: string[]
}

interface ConversionAttributionResponse {
  code: number
  data?: {
    success: boolean
    conversion_spec_id?: number
    grant_warning?: string
  }
  msg?: string
  error?: string
}

interface BatchConversionAttributionItem {
  conversion_name: string
  tracking_url: string
  conversion_type?: '激活' | '次留' | '七留' | '每留' | '网页转化'
}

interface BatchConversionAttributionRequest {
  account_ids: string[]
  items: BatchConversionAttributionItem[]
  conversion_mode: 'APP' | 'WEB'
  app_type?: 'ANDROID' | 'IOS'
  app_id?: string
  web_app_type?: 'WECHAT_MINI_PROGRAM'
  web_app_id?: string
  web_optimization_goal?: number
  web_deep_roi_optimization_goal?: number
  web_conversion_link_id?: number
  web_custom_report_index?: number[]
  selected_cookie_id: number
  grant_enabled?: boolean
  grant_mode?: 'ALL' | 'SPECIFIED'
  grant_account_ids?: string[]
}

interface BatchConversionAttributionResult {
  account_id?: string
  conversion_name: string
  conversion_type: string
  success: boolean
  conversion_spec_id?: number
  grant_warning?: string
  error?: string
}

interface BatchConversionAttributionResponse {
  code: number
  data?: {
    results: BatchConversionAttributionResult[]
    total_count: number
    success_count: number
    error_count: number
  }
  msg?: string
  error?: string
}

/**
 * 获取营销链路数据列表请求
 */
interface GetConversionLinkTemplatesRequest {
  account_id: string
  selected_cookie_id: number
  app_type: string
  optimization_goal: number
  deep_optimization_goal?: number
}

/**
 * 获取营销链路数据列表响应
 */
interface GetConversionLinkTemplatesResponse {
  code: number
  data?: Array<{
    conversionLinkId: number
    conversionLinkDesc: string
    landingPageAccessZh?: { mustPageTypes?: string[] }
    mustReportIndex?: number[]
  }>
  msg?: string
  error?: string
}

/**
 * 转化归因服务
 */
export const conversionAttributionService = {
  /**
   * 创建转化归因
   */
  async createConversionAttribution(
    data: ConversionAttributionRequest
  ): Promise<ConversionAttributionResponse> {
    const response = await apiClient.post<ConversionAttributionResponse>(
      `${BASE_PATH}/conversion-attribution`,
      data
    )
    return response.data
  },

  /**
   * 批量创建转化归因（并发处理）
   */
  async batchCreateConversionAttribution(
    data: BatchConversionAttributionRequest
  ): Promise<BatchConversionAttributionResponse> {
    const response = await apiClient.post<BatchConversionAttributionResponse>(
      `${BASE_PATH}/batch-conversion-attribution`,
      data
    )
    return response.data
  },

  /**
   * 获取营销链路数据列表
   */
  async getConversionLinkTemplates(
    data: GetConversionLinkTemplatesRequest
  ): Promise<GetConversionLinkTemplatesResponse> {
    const response = await apiClient.post<GetConversionLinkTemplatesResponse>(
      `${BASE_PATH}/get-conversion-link-templates`,
      data
    )
    return response.data
  }
}

/**
 * 批量修改投放时间相关接口
 */
interface ScheduleManagementRequest {
  account_ids: string[]
  operation_type: 'date' | 'time'
  selected_cookie_id: number
  start_date?: string
  end_date?: string
  week_schedule?: number[][]
}

interface ScheduleManagementResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    task_ids?: string[]
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

/**
 * 批量修改投放时间服务
 */
export const scheduleManagementService = {
  /**
   * 批量修改投放日期或投放时间
   */
  async batchScheduleManagement(
    data: ScheduleManagementRequest
  ): Promise<ScheduleManagementResponse> {
    const response = await apiClient.post<ScheduleManagementResponse>(
      `${BASE_PATH}/batch-schedule-management`,
      data
    )
    return response.data
  }
}

/**
 * 获取已有推广计划相关接口
 */
interface Campaign {
  account_id: number
  campaign_id: number
  campaign_name: string
}

interface GetCampaignsRequest {
  account_id_list: number[]
  selected_cookie_id: number
  date: string // YYYY-MM-DD格式
}

interface GetCampaignsResponse {
  code: number
  data?: {
    campaigns: Campaign[]
  }
  msg?: string
  error?: string
}

/**
 * 获取转化目标相关接口
 */
interface ConversionGoal {
  conversion_id: number
  conversion_name: string
  optimization_goal?: {
    goal_value: number
    goal_name: string
  }
}

interface GetConversionGoalsRequest {
  advertiser_id: number
  selected_cookie_id: number
  product_type?: number
  site_set?: number[]
  campaign_type?: number
  search_name?: string
}

interface GetConversionGoalsResponse {
  code: number
  data?: {
    list: ConversionGoal[]
    conf?: {
      page: number
      page_size: number
      total_num: number
      total_page: number
    }
  }
  msg?: string
  error?: string
}

/**
 * 获取品牌形象相关接口
 */
interface BrandImage {
  brand_name: string
  brand_image_id: string
}

interface GetBrandImageRequest {
  advertiser_id: number
  selected_cookie_id: number
}

interface GetBrandImageResponse {
  code: number
  data?: {
    list: BrandImage[]
    conf?: {
      page: number
      page_size: number
      total_num: number
      total_page: number
    }
  }
  msg?: string
  error?: string
}

interface GetTitlePoolResponse {
  code: number
  data?: {
    title_pool: string[]
  }
  msg?: string
  error?: string
}

/**
 * 获取TACC Token相关接口
 */
interface GetTaccTokenRequest {
  advertiser_id: number
  selected_cookie_id: number
}

interface GetTaccTokenResponse {
  code: number
  data?: string
  msg?: string
  error?: string
}

/**
 * 获取应用ID列表相关接口
 */
interface ProductItem {
  product_type: number
  product_id: string
  pname: string
  app_property_icon_url?: string
  children_privacy_protection?: number
  locale?: string
}

interface GetProductListRequest {
  advertiser_id: number
  selected_cookie_id: number
  product_type: number // 19-IOS应用, 20-Android应用, 21-微信小游戏
}

interface GetProductListResponse {
  code: number
  data?: {
    list: ProductItem[]
    conf?: {
      page: number
      page_size: number
      total_num: number
      total_page: number
    }
  }
  msg?: string
  error?: string
}

/**
 * 获取视频图片素材相关接口
 */
interface MediaItem {
  media_id: string
  media_description: string
  base_media_url: string
  key_frame_image_url: string
  cover_image_id: string
  video_width?: number
  video_height?: number
  media_duration_second?: number
  teg_resource_id?: string
}

/**
 * 检查素材是否符合版位要求相关接口
 */
interface ValidateMediaPlacementRequest {
  uid: number
  selected_cookie_id: number
  url: string
  svp_vid: string
  site_set: number[]
  creative_template_ids: number[]
  promoted_object_type: number
  tacc_token?: string
}

interface ValidateMediaPlacementResponse {
  code: number
  data?: {
    valid_result?: number
    valid_message?: string[]
  }
  msg?: string
  error?: string
}

interface MediaItemForValidation {
  media_id: string
  url: string
  svp_vid: string
}

interface BatchValidateMediaPlacementRequest {
  uid: number
  selected_cookie_id: number
  media_list: MediaItemForValidation[]
  site_set: number[]
  creative_template_ids: number[]
  promoted_object_type: number
  tacc_token?: string
}

interface BatchValidateMediaPlacementResponse {
  code: number
  data?: Record<string, number> // key为media_id，value为valid_result（1表示符合要求，0表示不符合）
  msg?: string
  error?: string
}

interface GetMediaListRequest {
  advertiser_id: number
  selected_cookie_id: number
  offset?: number
  limit?: number
  keyword?: string
  keywords?: string[]
}

interface GetMediaListResponse {
  code: number
  data?: {
    list: MediaItem[]
    range?: {
      offset: number
      limit: number
      total_num: number
    }
  }
  msg?: string
  error?: string
}

/**
 * 批量创建搜索广告相关接口
 */
interface BatchCreateSearchAdAccountConfig {
  advertiser_id: number
  campaign_id?: number
  conversion_id?: number
}

interface BatchCreateSearchAdRequest {
  account_configs: BatchCreateSearchAdAccountConfig[]
  selected_cookie_id: number
  campaign_create_type: 'new' | 'existing'
  campaign_name?: string
  campaign_type: string
  marketing_goal: string
  product_type: string
  daily_budget?: number
  total_budget?: number
  speed_mode: string
  adgroup_name: string
  site_set: number[]
  auto_siteset_switch: number
  begin_date: string
  end_date?: string | null
  time_set: string
  cost_type: string
  bid_mode: string
  cost_price: number
  optimization_goal: string
  geographic_location?: string
  gender?: string
  age?: string[]
  custom_audience?: string
  installed_users?: string
  filter_converted_users?: string
  keywords: Array<{
    keyword: string
    match_type: string
    bid_price: number
  }>
  creative_name: string
  titles: string[]
  account_titles?: Record<string, string[]> // 分账户标题映射（account_id -> titles[]）
  descriptions?: string[]
  brand_image_id: string
  brand_name?: string
  creative_materials?: Array<{
    media_id: string
    media_description: string
    base_media_url: string
    key_frame_image_url: string
    video_id?: string
    cover_image_id?: string
  }>
  account_materials?: Record<
    string,
    Record<
      number,
      Array<{
        media_id: string
        media_description: string
        base_media_url: string
        key_frame_image_url: string
        cover_image_id: string
      }>
    >
  >
  product_id?: string | null
  product_name?: string | null
}

interface BatchCreateSearchAdAccountResult {
  account_id: number
  success: boolean
  data?: any
  error?: string
}

interface BatchCreateSearchAdResponse {
  code: number
  data?: {
    total_success: number
    total_error: number
    account_results: BatchCreateSearchAdAccountResult[]
  }
  msg?: string
  error?: string
}

/**
 * 创建搜索广告相关接口
 */
interface CreateSearchAdRequest {
  advertiser_id: number
  selected_cookie_id: number
  campaign_create_type: 'new' | 'existing'
  campaign_id?: number
  campaign_name?: string
  campaign_type: string
  marketing_goal: string
  product_type: string
  daily_budget?: number
  total_budget?: number
  speed_mode: string
  adgroup_name: string
  site_set: number[]
  auto_siteset_switch: number
  begin_date: string
  end_date?: string | null
  time_set: string
  cost_type: string
  bid_mode: string
  cost_price: number
  optimization_goal: string
  conversion_id?: number
  geographic_location?: string
  gender?: string
  age?: string[]
  custom_audience?: string
  installed_users?: string
  filter_converted_users?: string
  keywords: Array<{
    keyword: string
    match_type: string
    bid_price: number
  }>
  creative_name: string
  titles: string[]
  descriptions?: string[]
  brand_image_id: string
  creative_materials?: Array<{
    media_id: string
    media_description: string
    base_media_url: string
    key_frame_image_url: string
    video_id?: string
    cover_image_id?: string
  }>
  product_id?: string | null
}

interface CreateSearchAdResponse {
  code: number
  data?: {
    advertiser_id?: number
    campaign_id?: number
    adgroup_id?: number
    adtarget_id?: number
    creative_id_list?: number[]
    product_id?: string
    subordinate_product_id?: string
    bidword_result?: {
      success_list?: Array<{
        index: number
        bidword_id: number
        bidword: string
        bid_price: number
        match_type: string
        configured_status: string
        error_msg: string
        approval_status: number
      }>
      error_list?: Array<{
        index: number
        error_msg: string
      }>
    }
  }
  msg?: string
  error?: string
}

/**
 * 搜索广告创建服务
 */
export const searchAdCreateService = {
  /**
   * 获取已有推广计划列表
   */
  async getCampaigns(data: GetCampaignsRequest): Promise<GetCampaignsResponse> {
    const response = await apiClient.post<GetCampaignsResponse>(`${BASE_PATH}/get-campaigns`, data)
    return response.data
  },

  /**
   * 获取转化目标列表
   */
  async getConversionGoals(data: GetConversionGoalsRequest): Promise<GetConversionGoalsResponse> {
    const response = await apiClient.post<GetConversionGoalsResponse>(
      `${BASE_PATH}/get-conversion-goals`,
      data
    )
    return response.data
  },

  /**
   * 获取品牌形象列表
   */
  async getBrandImages(data: GetBrandImageRequest): Promise<GetBrandImageResponse> {
    const response = await apiClient.post<GetBrandImageResponse>(
      `${BASE_PATH}/get-brand-images`,
      data
    )
    return response.data
  },

  /**
   * 获取标题包列表
   */
  async getTitlePool(): Promise<GetTitlePoolResponse> {
    const response = await apiClient.get<GetTitlePoolResponse>(`${BASE_PATH}/get-title-pool`)
    return response.data
  },

  /**
   * 获取TACC Token
   */
  async getTaccToken(data: GetTaccTokenRequest): Promise<GetTaccTokenResponse> {
    const response = await apiClient.post<GetTaccTokenResponse>(`${BASE_PATH}/get-tacc-token`, data)
    return response.data
  },

  /**
   * 获取应用ID列表
   */
  async getProductList(data: GetProductListRequest): Promise<GetProductListResponse> {
    const response = await apiClient.post<GetProductListResponse>(
      `${BASE_PATH}/get-product-list`,
      data
    )
    return response.data
  },

  /**
   * 获取视频图片素材列表
   */
  async getMediaList(data: GetMediaListRequest): Promise<GetMediaListResponse> {
    const response = await apiClient.post<GetMediaListResponse>(`${BASE_PATH}/get-media-list`, data)
    return response.data
  },

  /**
   * 检查素材是否符合版位要求
   */
  async validateMediaPlacement(
    data: ValidateMediaPlacementRequest
  ): Promise<ValidateMediaPlacementResponse> {
    const response = await apiClient.post<ValidateMediaPlacementResponse>(
      `${BASE_PATH}/validate-media-placement`,
      data
    )
    return response.data
  },

  /**
   * 批量检查素材是否符合版位要求
   */
  async batchValidateMediaPlacement(
    data: BatchValidateMediaPlacementRequest
  ): Promise<BatchValidateMediaPlacementResponse> {
    const response = await apiClient.post<BatchValidateMediaPlacementResponse>(
      `${BASE_PATH}/batch-validate-media-placement`,
      data
    )
    return response.data
  },

  /**
   * 创建搜索广告
   */
  async createSearchAd(data: CreateSearchAdRequest): Promise<CreateSearchAdResponse> {
    const response = await apiClient.post<CreateSearchAdResponse>(
      `${BASE_PATH}/create-search-ad`,
      data
    )
    return response.data
  },

  /**
   * 批量创建搜索广告（支持多Cookie并发模式）
   */
  async batchCreateSearchAd(
    data: BatchCreateSearchAdRequest
  ): Promise<BatchCreateSearchAdResponse> {
    const response = await apiClient.post<BatchCreateSearchAdResponse>(
      `${BASE_PATH}/batch-create-search-ad`,
      data
    )
    return response.data
  }
}

/**
 * 获取组织列表相关接口
 */
interface OrganizationItem {
  business_id: number
  business_name: string
}

interface GetOrganizationListRequest {
  user_id?: number
  selected_cookie_id: number
}

interface GetOrganizationListResponse {
  code: number
  data?: OrganizationItem[]
  msg?: string
  error?: string
}

/**
 * 获取组织列表服务
 */
export const organizationListService = {
  /**
   * 获取组织列表
   */
  async getOrganizationList(
    data: GetOrganizationListRequest
  ): Promise<GetOrganizationListResponse> {
    const response = await apiClient.post<GetOrganizationListResponse>(
      `${BASE_PATH}/get-organization-list`,
      data
    )
    return response.data
  }
}

interface AccountAdClearRequest {
  selected_cookie_id: number
  account_ids: string[]
  clear_type: 'all' | 'display' | 'smart'
}

interface AccountAdClearResponse {
  code: number
  data?: {
    total_adgroups: number
    task_ids: Array<number | string>
    account_results: Array<{
      account_id: number
      adgroup_count: number
    }>
  }
  msg?: string
  error?: string
}

/**
 * 展示广告推广数据服务
 */
export const displayPromotionService = {
  async getDisplayPromotionData(
    data: DisplayPromotionDataRequest
  ): Promise<DisplayPromotionDataResponse> {
    const response = await apiClient.post<DisplayPromotionDataResponse>(
      `${BASE_PATH}/display-promotion-data`,
      data,
      { timeout: 300000 }
    )
    return response.data
  },

  async batchUpdateStatus(
    data: DisplayPromotionBatchUpdateRequest
  ): Promise<DisplayPromotionBatchUpdateResponse> {
    const response = await apiClient.post<DisplayPromotionBatchUpdateResponse>(
      `${BASE_PATH}/display-promotion/batch-update-status`,
      data
    )
    return response.data
  },

  async clearAccountAds(data: AccountAdClearRequest): Promise<AccountAdClearResponse> {
    const response = await apiClient.post<AccountAdClearResponse>(
      `${BASE_PATH}/account-ad-clear`,
      data,
      { timeout: 300000 }
    )
    return response.data
  }
}

export type { OrganizationItem, GetOrganizationListRequest, GetOrganizationListResponse }

/**
 * 数据助手相关接口
 */
interface AccountData {
  account_id: number | string
  business_id?: number
  business_name?: string
  comment: string
  project: string
  genre: string
  team: string
  operator?: string // 投手字段
  cost: number
  activated_count: number
  activated_cost: number
  acquisition_cost: number
  view_count: string
  yesterday_cost: number
  yesterday_activated_count: number
  yesterday_activated_cost: number
  yesterday_retention_count?: number
  yesterday_retention_rate?: string
  history_7d_cost: number
  history_7d_activated_count: number
  history_7d_activated_cost: number
  history_7d_retention_count?: number
  history_7d_retention_rate?: string
  history_7d_app_retention_d7_uv?: number
  history_7d_app_retention_d7_rate?: string
  history_7d_acquisition_cost: number
}

interface OrganizationGroup {
  group_name: string
  business_id_list: number[]
}

interface OperatorGroup {
  name: string
  tags: string[]
}

interface DataAssistantRequest {
  selected_cookie_id: number
  query_date: string
  organization_groups: OrganizationGroup[]
  use_tag_grouping?: boolean
  tag_text?: string
  user_id?: number
  operator_groups?: OperatorGroup[] // 投手分组列表
}

interface DataAssistantResponse {
  code: number
  data?: {
    query_date: string
    business_data: Record<
      string,
      {
        business_id: number
        tag_groups: Record<string, AccountData[]>
      }
    >
    total_summary?: AccountData[]
    total_count: number
  }
  msg?: string
  error?: string
}

/**
 * 素材统计相关接口
 */
interface MaterialStatisticsAccount {
  account_id: number
  business_id: number
  corporation_name?: string
  account_alias?: string
  wallet_name?: string
  wallet_balance?: number
  comment?: string
}

interface MaterialStatisticsRequest {
  selected_cookie_id: number
  start_date: string
  end_date: string
  business_id_list: number[]
}

interface MaterialStatisticsResponse {
  code: number
  data?: {
    account_list: MaterialStatisticsAccount[]
    total_count: number
    material_list?: Array<{
      creative_asset_id?: string | number
      creative_asset_name?: string
      cost: number
    }>
    material_total_cost?: number
    page_info?: {
      total_page: number
      total_count: number
      page_size: number
    }
  }
  msg?: string
  error?: string
}

/**
 * 展示广告推广数据相关接口
 */
interface DisplayPromotionDataRequest {
  account_ids: string[]
  selected_cookie_id: number
  page?: number
  page_size?: number
  dimension: 'ad' | 'creative'
  start_date?: string
  end_date?: string
  date_range?: {
    start_date: string
    end_date: string
  }
  filters?: Array<{
    metric: 'cost' | 'activated_cost' | 'activated_count'
    operator: 'gte' | 'lte' | 'between'
    value1?: number | null
    value2?: number | null
  }>
}

interface DisplayPromotionDataResponse {
  code: number
  data?: {
    list?: Array<{
      account_id: number | string
      adgroup_id?: number | string
      adgroup_name?: string
      dynamic_creative_id?: number | string
      dynamic_creative_name?: string
      configured_status?: string
      cost?: number
      activated_cost?: number
      activated_count?: number
    }>
    page_info?: {
      page: number
      page_size: number
      total_number: number
      total_page: number
    }
  }
  msg?: string
  error?: string
}

/**
 * 数据助手服务
 */
export const dataAssistantService = {
  /**
   * 获取数据统计
   */
  async getDataStatistics(data: DataAssistantRequest): Promise<DataAssistantResponse> {
    const response = await apiClient.post<DataAssistantResponse>(
      `${BASE_PATH}/data-assistant/statistics`,
      data
    )
    return response.data
  },

  /**
   * 导出统计数据为图片
   * @returns Blob 格式的 PNG 图片
   */
  async exportStatisticsImage(statisticsData: Record<string, any>): Promise<Blob> {
    const response = await apiClient.post(
      `${BASE_PATH}/data-assistant/statistics/export-image`,
      { statistics_data: statisticsData },
      { responseType: 'blob' }
    )
    return response.data as Blob
  }
}

/**
 * 素材统计服务
 */
export const materialStatisticsService = {
  /**
   * 获取账户列表
   */
  async getAccountList(data: MaterialStatisticsRequest): Promise<MaterialStatisticsResponse> {
    const response = await apiClient.post<MaterialStatisticsResponse>(
      `${BASE_PATH}/material-statistics/account-list`,
      data,
      { timeout: 300000 }
    )
    return response.data
  }
}

export type {
  AccountData,
  DataAssistantRequest,
  DataAssistantResponse,
  OperatorGroup,
  MaterialStatisticsAccount,
  MaterialStatisticsRequest,
  MaterialStatisticsResponse,
  DisplayPromotionDataRequest,
  DisplayPromotionDataResponse,
  DisplayPromotionBatchUpdateRequest,
  DisplayPromotionBatchUpdateResponse,
  DisplayPromotionStatusUpdateItem
}
