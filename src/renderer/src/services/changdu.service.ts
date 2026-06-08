import apiClient, { API_BASE_URL } from './api'
import type { BitableResponse } from '../types/feishu.types'

const BASE_PATH = '/api/v1/changdu'

/** 分页（与 ocean-engine / tencent 一致） */
export interface PaginatedMeta {
  total: number
  page: number
  page_size: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  meta: PaginatedMeta
}

export interface ChangduScheduledTask {
  id: number
  name: string
  task_type: string
  config_id: number
  user_id: number
  cron_expression: string
  task_config: Record<string, unknown> | null
  is_active: boolean
  last_run_at: string | null
  next_run_at: string | null
  run_count: number
  status: string
  created_at: string
  updated_at: string
}

export interface ChangduScheduledTaskCreate {
  name: string
  task_type: string
  config_id: number
  cron_expression: string
  task_config?: Record<string, unknown> | null
}

export interface ChangduScheduledTaskUpdate {
  name?: string
  task_type?: string
  config_id?: number
  cron_expression?: string
  task_config?: Record<string, unknown> | null
  is_active?: boolean
  status?: string
}

/** 常读定时任务单次执行记录（与后端 ChangduScheduledTaskExecutionLog 一致） */
export interface ChangduScheduledTaskExecutionLog {
  id: number
  task_id: number
  user_id: number
  execution_status: string
  start_time: string
  end_time: string | null
  duration_seconds: number | null
  result_summary: Record<string, unknown> | null
  error_message: string | null
  created_at: string
}

export interface ChangduBatchUploadRequest {
  config_id: number
  file_paths: string[]
}

export interface ChangduBatchUploadResponse {
  success: boolean
  message: string
  file_count: number
  files: string[]
}

export interface ChangduSeriesRow {
  book_id: string
  playlet_id: string
  series_name: string
  thumb_url: string
  create_time: string
  category: string
  /** 性别受众：女频/男频/通用（接口 gender 0/1/2） */
  gender: string
  /** 连载状态：完结/连载（接口 creation_status：0=完结 1=连载） */
  creation_status: string
  /** 集数 */
  episode_amount: string
  estimate_publish_time: string
  publish_time: string
  publish_status: string
  delivery_status: string
  permission_status: string
}

export interface ChangduSeriesListResponse {
  items: ChangduSeriesRow[]
  total: number
}

export interface ChangduPromotionRow {
  promotion_id: string
  promotion_name: string
  book_id: string
  book_name: string
  episode_amount: string
  aweme_publish_name: string
  panel_name: string
  start_episode: string
  product_num: string
  create_time: string
  promotion_url: string
}

export interface ChangduPromotionListResponse {
  items: ChangduPromotionRow[]
  total: number
}

export interface ChangduMaterialMediaInfo {
  filename?: string
  format?: string
  inner_uri?: string
  landing_page_url?: string
  media_type?: number
  preview_url?: string
  text?: string
  vid?: string
}

export interface ChangduMaterialDeliveryAppInfo {
  app_id?: number
  app_name?: string
}

export interface ChangduMaterialChannelInfo {
  app_id?: number
  app_name?: string
  audit_status?: number
  channel_id?: string
  channel_type?: number
  create_time?: string
  push_status?: number
  update_time?: string
}

export interface ChangduMaterialRow {
  channel_info_list: ChangduMaterialChannelInfo[]
  channel_type_list: number[]
  create_time: string
  creator?: number | string | null
  creator_email: string
  creator_nick_name: string
  delivery_app_id_list: number[]
  delivery_app_info_list: ChangduMaterialDeliveryAppInfo[]
  material_id: string
  material_name: string
  material_type?: number | string | null
  media_info_list: ChangduMaterialMediaInfo[]
  root_ad_user_id?: number | string | null
  update_time: string
}

export interface ChangduMaterialListResponse {
  items: ChangduMaterialRow[]
  total: number
}

export interface ChangduMaterialDownloadInfo {
  material_id: string
  play_url: string
  filename: string
}

export interface ChangduMaterialDownloadBatchResponse {
  items: ChangduMaterialDownloadInfo[]
  failed: Array<{ material_id: string; error: string }>
}

export interface ChangduMaterialSubmitRequest {
  config_id: number
  start_time: number
  end_time: number
  platforms: Array<1 | 2>
  app_id?: number
}

export interface ChangduMaterialSubmitResponse {
  message: string
  success_material_id_list: string[]
  raw: Record<string, unknown>
}

export interface ChangduMaterialPushRequest {
  config_id: number
  start_time: number
  end_time: number
  platform: 1 | 2
  advertising_account: string[]
  audit_status_list: Array<1 | 2 | 3 | 4 | 5>
  material_name?: string
}

export interface ChangduMaterialPushResponse {
  message: string
  auth_failed_account_ids: string[]
  raw: Record<string, unknown>
}

export interface ChangduMaterialPushCountRequest {
  config_id: number
  start_time: number
  end_time: number
  platform: 1 | 2
  material_name?: string
}

export interface ChangduMaterialPushCountResponse {
  total: number
  raw: Record<string, unknown>
}

export interface ChangduPromotionTemplateItem {
  panel_template_id: string
  panel_name: string
  can_create_promotion?: boolean
  start_episode?: number
  product_list?: Array<{
    discount?: number
    pay_fee?: number
    segment_number?: number
    unlock_episode?: number
  }>
}

export interface ChangduPromotionTemplateResponse {
  series_info: Record<string, string>
  templates: ChangduPromotionTemplateItem[]
  raw: Record<string, unknown>
}

export interface ChangduPromotionTemplateBatchItem {
  book_id: string
  status: 'success' | 'failed'
  templates: ChangduPromotionTemplateItem[]
  series_info: Record<string, string>
  error_message: string
  raw: Record<string, unknown>
  index?: number
}

export interface ChangduPromotionTemplateBatchResponse {
  items: ChangduPromotionTemplateBatchItem[]
  total: number
  success: number
  failed: number
}

export type ChangduPromotionTemplateBatchProgressEvent =
  | { type: 'info'; message: string; total?: number }
  | {
      type: 'item'
      completed: number
      total: number
      item: ChangduPromotionTemplateBatchItem
    }
  | { type: 'done'; message: string; data: ChangduPromotionTemplateBatchResponse }

export interface ChangduPromotionCreateResponse {
  promotion_info: {
    promotion_id?: string | number
    promotion_name?: string
    promotion_url?: string
  }
  series_info: Record<string, unknown>
  purchase_panel_data: Record<string, unknown>
  raw: Record<string, unknown>
}

export interface ChangduOceanRootOrganizationItem {
  rootId: string
  rootName: string
  role: number
  roleName?: string
  tagName?: string
  isVerified?: boolean
  companyName?: string
  authDepth?: number
}

export interface ChangduOceanRootOrganizationListResponse {
  items: ChangduOceanRootOrganizationItem[]
  raw: Record<string, unknown>
}

export interface ChangduOceanProductLibraryItem {
  advertiserId: string
  platformId: string
  name: string
  storeType: number
  operateAuth: number
  advertiserName: string
  accountType: number
  modifyTime: string
}

export interface ChangduOceanProductLibraryListResponse {
  items: ChangduOceanProductLibraryItem[]
  page_info: Record<string, unknown>
  raw: Record<string, unknown>
}

export interface ChangduAppendToOceanProductRequest {
  changdu_config_id: number
  ocean_config_id: number
  organization_id: string
  platform_id: string
  book_id: string
  playlet_id: string
  distributor_id: string
  purchase_panel_template_id: string
  promotion_name: string
  copyright_owner?: string
  app_id?: string
  app_type?: '21' | '22'
}

export interface ChangduAppendToOceanProductResponse {
  promotion_info: Record<string, unknown>
  playlet_detail: Record<string, unknown>
  save_payload: Record<string, unknown>
  save_result: Record<string, unknown>
  created_product_ids: string[]
}

export interface ChangduAppendToOceanProductBatchItem {
  book_id: string
  playlet_id: string
  purchase_panel_template_id: string
  promotion_name: string
}

export interface ChangduAppendToOceanProductBatchRequest {
  changdu_config_id: number
  ocean_config_id: number
  organization_id: string
  platform_id: string
  distributor_id: string
  items: ChangduAppendToOceanProductBatchItem[]
  copyright_owner?: string
  app_id?: string
  app_type?: '21' | '22'
}

export interface ChangduAppendToOceanProductBatchResultItem {
  index: number
  book_id: string
  playlet_id: string
  promotion_name: string
  status: 'success' | 'failed' | 'skipped'
  error_message: string
  created_product_ids: string[]
  promotion_info?: Record<string, unknown>
  playlet_detail?: Record<string, unknown>
  save_result?: Record<string, unknown>
}

export interface ChangduAppendToOceanProductBatchResponse {
  total: number
  success: number
  failed: number
  skipped: number
  items: ChangduAppendToOceanProductBatchResultItem[]
}

export interface ChangduAppendToOceanProductBatchProgressEvent {
  type: 'info' | 'progress' | 'summary' | 'done' | 'error'
  stage?: string
  message?: string
  data?: {
    total?: number
    completed?: number
    success?: number
    failed?: number
    skipped?: number
    current_name?: string
    promotion_total?: number
    promotion_completed?: number
    current_index?: number
    book_id?: string
    playlet_id?: string
    promotion_name?: string
    purchase_panel_template_id?: string
    promotion_id?: string
    promotion_url?: string
    promotion_error?: string
  } & Partial<ChangduAppendToOceanProductBatchResponse>
}

export interface ChangduChannelRow {
  app_id: string
  app_name: string
  app_type: string
  channel: string
  distributor_id: string
  distributor_name: string
  nick_name: string
  package_allocate_status: string
  release_status: string
}

export interface ChangduChannelListResponse {
  items: ChangduChannelRow[]
}

/** 本地 changdu_series 表行（与后端 ChangduSeriesDbItem 一致） */
export interface ChangduSeriesDbItem {
  id: number
  book_id: string
  playlet_id: string
  series_name: string
  create_time: string
  category: string
  gender: string
  creation_status: string
  episode_amount: string
  aweme_publish_nick_name: string
  aweme_publish_douyin_id: string
  estimate_publish_time: string
  publish_time: string
  publish_status: string
  delivery_status: string
  permission_status: string
  created_at: string
  updated_at: string
}

export interface ChangduSeriesFeishuPushRequest {
  config_id: number
  bitable_name?: string
  table_name?: string
  folder_token?: string
  start_page?: number
  max_pages?: number
  default_view_name?: string
  /** 与 existing_table_id 同时传入时写入已有表，不新建 */
  existing_app_token?: string
  existing_table_id?: string
  /** 可选，浏览器完整链接，优先用于打开（企业租户域名等） */
  existing_bitable_url?: string
  /** 仅追加到已有表时：按「短剧ID」更新已有行，否则新增 */
  upsert_by_book_id?: boolean
}

export interface ChangduSeriesFeishuPushResponse extends BitableResponse {
  pages_fetched: number
  list_total: number
  /** create=新建多维表格，append=追加到已有表 */
  mode?: string
  /** max_pages | invalid_batch */
  fetch_stop_reason?: string
  fetch_stop_reason_detail?: string
  updated_count?: number
  created_count?: number
  skipped_no_key?: number
}

export interface ChangduSeriesDatabaseSyncRequest {
  config_id: number
  start_page?: number
  max_pages?: number
  start_time?: string
  end_time?: string
  publish_status?: '1'
}

export interface ChangduSeriesDatabaseHistorySyncRequest {
  config_id: number
  start_time: string
  end_time: string
  publish_status?: '1'
}

export interface ChangduSeriesDatabaseHistoryMonthSummary {
  month: string
  inserted: number
  updated: number
  unchanged: number
  pages_fetched: number
  skipped_empty_book_id: number
  slices?: Array<Record<string, unknown>>
}

export interface ChangduSeriesDatabaseHistorySyncResponse {
  mode: string
  start_time: string
  end_time: string
  months_processed: number
  month_summaries: ChangduSeriesDatabaseHistoryMonthSummary[]
  failed_months: Array<{ month: string; error: string }>
  totals: {
    inserted: number
    updated: number
    unchanged: number
    pages_fetched: number
    skipped_empty_book_id: number
  }
  inserted_count: number
  updated_count: number
  unchanged_count: number
  skipped_empty_book_id: number
  pages_fetched: number
  update_details: Array<Record<string, unknown>>
  update_details_truncated: boolean
  message: string
}

export interface ChangduSeriesDatabaseSyncResponse {
  mode: string
  pages_fetched: number
  list_total: number
  fetch_stop_reason: string
  fetch_stop_reason_detail: string
  inserted_count: number
  updated_count: number
  unchanged_count: number
  skipped_empty_book_id: number
  update_details: Array<Record<string, unknown>>
  update_details_truncated: boolean
  message: string
}

export const changduService = {
  /**
   * 常读批量视频上传
   * 超时 5 分钟：上传等待最长 120s + 页面加载/提交等
   */
  async batchUpload(payload: ChangduBatchUploadRequest): Promise<ChangduBatchUploadResponse> {
    const response = await apiClient.post<ChangduBatchUploadResponse>(
      `${BASE_PATH}/batch-upload`,
      payload,
      { timeout: 300000 }
    )
    return response.data
  },

  /**
   * 常读渠道列表（available_packages 下的全部 app_type：21=付费漫剧，22=免费漫剧，供新版列表选择渠道）
   */
  async getChannels(configId: number): Promise<ChangduChannelListResponse> {
    const response = await apiClient.get<ChangduChannelListResponse>(`${BASE_PATH}/channels`, {
      params: { config_id: configId },
      timeout: 45000
    })
    return response.data
  },

  async getPromotionTemplates(payload: {
    config_id: number
    book_id: string
    distributor_id: string
    app_id?: string
    app_type?: '21' | '22'
  }): Promise<ChangduPromotionTemplateResponse> {
    const response = await apiClient.post<ChangduPromotionTemplateResponse>(
      `${BASE_PATH}/promotion/templates`,
      payload,
      { timeout: 90000 }
    )
    return response.data
  },

  async getPromotionTemplatesBatch(payload: {
    config_id: number
    book_ids: string[]
    distributor_id: string
    app_id?: string
    app_type?: '21' | '22'
  }): Promise<ChangduPromotionTemplateBatchResponse> {
    const response = await apiClient.post<ChangduPromotionTemplateBatchResponse>(
      `${BASE_PATH}/promotion/templates/batch`,
      payload,
      { timeout: 180000 }
    )
    return response.data
  },

  async getPromotionTemplatesBatchStream(
    payload: {
      config_id: number
      book_ids: string[]
      distributor_id: string
      app_id?: string
      app_type?: '21' | '22'
    },
    onEvent: (event: ChangduPromotionTemplateBatchProgressEvent) => void
  ): Promise<ChangduPromotionTemplateBatchResponse> {
    const token = localStorage.getItem('access_token')
    const response = await fetch(`${API_BASE_URL}${BASE_PATH}/promotion/templates/batch/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || `HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取充值模板加载进度')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let finalResult: ChangduPromotionTemplateBatchResponse | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const event = JSON.parse(line.slice(6)) as ChangduPromotionTemplateBatchProgressEvent
        onEvent(event)
        if (event.type === 'done' && event.data) {
          finalResult = event.data
        }
      }
    }

    if (!finalResult) {
      throw new Error('批量加载充值模板未返回最终结果')
    }
    return finalResult
  },

  async createPromotionLink(payload: {
    config_id: number
    book_id: string
    distributor_id: string
    app_id?: string
    app_type?: '21' | '22'
    promotion_name: string
    purchase_panel_template_id: string
  }): Promise<ChangduPromotionCreateResponse> {
    const response = await apiClient.post<ChangduPromotionCreateResponse>(
      `${BASE_PATH}/promotion/create`,
      payload,
      { timeout: 90000 }
    )
    return response.data
  },

  async getOceanRootOrganizations(params: {
    ocean_config_id: number
  }): Promise<ChangduOceanRootOrganizationListResponse> {
    const response = await apiClient.get<ChangduOceanRootOrganizationListResponse>(
      `${BASE_PATH}/ocean/root-organizations`,
      {
        params,
        timeout: 90000
      }
    )
    return response.data
  },

  async getOceanProductLibraries(params: {
    ocean_config_id: number
    organization_id: string
  }): Promise<ChangduOceanProductLibraryListResponse> {
    const response = await apiClient.get<ChangduOceanProductLibraryListResponse>(
      `${BASE_PATH}/ocean/product-libraries`,
      {
        params,
        timeout: 45000
      }
    )
    return response.data
  },

  async appendSeriesToOceanProductLibrary(
    payload: ChangduAppendToOceanProductRequest
  ): Promise<ChangduAppendToOceanProductResponse> {
    const response = await apiClient.post<ChangduAppendToOceanProductResponse>(
      `${BASE_PATH}/ocean/append-product`,
      payload,
      { timeout: 120000 }
    )
    return response.data
  },

  async appendSeriesBatchToOceanProductLibrary(
    payload: ChangduAppendToOceanProductBatchRequest
  ): Promise<ChangduAppendToOceanProductBatchResponse> {
    const response = await apiClient.post<ChangduAppendToOceanProductBatchResponse>(
      `${BASE_PATH}/ocean/append-products`,
      payload,
      { timeout: 600000 }
    )
    return response.data
  },

  async appendSeriesBatchToOceanProductLibraryStream(
    payload: ChangduAppendToOceanProductBatchRequest,
    onEvent: (event: ChangduAppendToOceanProductBatchProgressEvent) => void
  ): Promise<ChangduAppendToOceanProductBatchResponse> {
    const token = localStorage.getItem('access_token')
    const response = await fetch(`${API_BASE_URL}${BASE_PATH}/ocean/append-products/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || `HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取批量添加进度')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let finalResult: ChangduAppendToOceanProductBatchResponse | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const event = JSON.parse(line.slice(6)) as ChangduAppendToOceanProductBatchProgressEvent
        onEvent(event)
        if (event.type === 'done' && event.data) {
          finalResult = event.data as ChangduAppendToOceanProductBatchResponse
        }
      }
    }

    if (!finalResult) {
      throw new Error('批量添加未返回最终结果')
    }
    return finalResult
  },

  async getPromotionList(params: {
    config_id: number
    page_index: number
    page_size?: number
    distributor_id: string
    app_id?: string
    app_type?: string
    begin_date?: string
    end_date?: string
    book_id?: string
    book_name?: string
  }): Promise<ChangduPromotionListResponse> {
    const response = await apiClient.get<ChangduPromotionListResponse>(
      `${BASE_PATH}/promotion-list`,
      {
        params: {
          ...params,
          book_id: params.book_id?.trim() || undefined,
          book_name: params.book_name?.trim() || undefined
        },
        timeout: 90000
      }
    )
    return response.data
  },

  async getMaterialManageList(params: {
    config_id: number
    page_index: number
    page_size: number
    start_time?: number
    end_time?: number
    channel_type_list?: string
    audit_status_list?: string
    push_status_list?: string
    material_name?: string
  }): Promise<ChangduMaterialListResponse> {
    const response = await apiClient.get<ChangduMaterialListResponse>(
      `${BASE_PATH}/material-manage/list`,
      {
        params: {
          ...params,
          material_name: params.material_name?.trim() || undefined,
          channel_type_list: params.channel_type_list || undefined,
          audit_status_list: params.audit_status_list || undefined,
          push_status_list: params.push_status_list || undefined
        },
        timeout: 90000
      }
    )
    return response.data
  },

  async getMaterialDownloadLinks(params: {
    config_id: number
    material_ids: string[]
  }): Promise<ChangduMaterialDownloadBatchResponse> {
    const response = await apiClient.post<ChangduMaterialDownloadBatchResponse>(
      `${BASE_PATH}/material-manage/download-links`,
      params,
      { timeout: 120000 }
    )
    return response.data
  },

  async submitMaterialManageBatch(
    payload: ChangduMaterialSubmitRequest
  ): Promise<ChangduMaterialSubmitResponse> {
    const response = await apiClient.post<ChangduMaterialSubmitResponse>(
      `${BASE_PATH}/material-manage/submit`,
      payload,
      { timeout: 120000 }
    )
    return response.data
  },

  async pushMaterialManageBatch(
    payload: ChangduMaterialPushRequest
  ): Promise<ChangduMaterialPushResponse> {
    const response = await apiClient.post<ChangduMaterialPushResponse>(
      `${BASE_PATH}/material-manage/push`,
      payload,
      { timeout: 120000 }
    )
    return response.data
  },

  async previewMaterialPushCount(
    payload: ChangduMaterialPushCountRequest
  ): Promise<ChangduMaterialPushCountResponse> {
    const response = await apiClient.post<ChangduMaterialPushCountResponse>(
      `${BASE_PATH}/material-manage/push/count`,
      payload,
      { timeout: 120000 }
    )
    return response.data
  },

  /**
   * 常读短剧列表（与 novelsale/distributor/content/series/list 对齐）
   */
  async getSeriesList(params: {
    config_id: number
    page_index?: number
    page_size?: number
  }): Promise<ChangduSeriesListResponse> {
    const response = await apiClient.get<ChangduSeriesListResponse>(`${BASE_PATH}/series-list`, {
      params: {
        config_id: params.config_id,
        page_index: params.page_index ?? 0,
        page_size: params.page_size ?? 100
      },
      timeout: 90000
    })
    return response.data
  },

  /**
   * 常读短剧列表（新版：浏览器上下文 fetch）
   */
  async getSeriesListNew(params: {
    config_id: number
    page_index?: number
    page_size?: number
    distributor_id: string
    app_id?: string
    app_type?: string
    publish_status?: string
    search_type?: '1' | '2'
    query?: string
    start_time?: string
    end_time?: string
  }): Promise<ChangduSeriesListResponse> {
    const response = await apiClient.get<ChangduSeriesListResponse>(
      `${BASE_PATH}/series-list-new`,
      {
        params: {
          config_id: params.config_id,
          page_index: params.page_index ?? 0,
          page_size: params.page_size ?? 100,
          distributor_id: params.distributor_id,
          app_id: params.app_id ?? '70022244',
          app_type: params.app_type ?? '21',
          publish_status: params.publish_status,
          search_type: params.search_type,
          query: params.query?.trim() || undefined,
          start_time: params.start_time?.trim() || undefined,
          end_time: params.end_time?.trim() || undefined
        },
        timeout: 45000
      }
    )
    return response.data
  },

  /**
   * 本地 changdu_series 漫剧列表：搜索、排序、分页（后端固定查询共享账号 user_id=2）
   */
  async getSeriesDbList(params: {
    page?: number
    page_size?: number
    book_id?: string
    series_name?: string
    aweme_publish_nick_name?: string
    aweme_publish_douyin_id?: string
    publish_status?: '已发布' | '未发布'
    delivery_status?: '可投放' | '不可投放'
    estimate_publish_time_start?: string
    estimate_publish_time_end?: string
    create_time_start?: string
    create_time_end?: string
    sort_by?: 'create_time' | 'estimate_publish_time' | 'updated_at'
    sort_order?: 'asc' | 'desc'
  }): Promise<PaginatedResponse<ChangduSeriesDbItem>> {
    const response = await apiClient.get<PaginatedResponse<ChangduSeriesDbItem>>(
      `${BASE_PATH}/series-db`,
      {
        params: {
          page: params.page ?? 1,
          page_size: params.page_size ?? 20,
          book_id: params.book_id?.trim() || undefined,
          series_name: params.series_name?.trim() || undefined,
          aweme_publish_nick_name: params.aweme_publish_nick_name?.trim() || undefined,
          aweme_publish_douyin_id: params.aweme_publish_douyin_id?.trim() || undefined,
          publish_status: params.publish_status,
          delivery_status: params.delivery_status,
          estimate_publish_time_start: params.estimate_publish_time_start?.trim() || undefined,
          estimate_publish_time_end: params.estimate_publish_time_end?.trim() || undefined,
          create_time_start: params.create_time_start?.trim() || undefined,
          create_time_end: params.create_time_end?.trim() || undefined,
          sort_by: params.sort_by ?? 'create_time',
          sort_order: params.sort_order ?? 'desc'
        }
      }
    )
    return response.data
  },

  /**
   * 将常读短剧列表抓取并写入飞书多维表格（需已绑定飞书）
   */
  async pushSeriesListToFeishu(
    payload: ChangduSeriesFeishuPushRequest
  ): Promise<ChangduSeriesFeishuPushResponse> {
    const response = await apiClient.post<ChangduSeriesFeishuPushResponse>(
      `${BASE_PATH}/series-list/push-feishu`,
      payload,
      { timeout: 600000 }
    )
    return response.data
  },

  /**
   * 常读短剧列表 upsert 到本地数据库（按短剧ID；变更写入 update_details）
   */
  async syncSeriesListToDatabase(
    payload: ChangduSeriesDatabaseSyncRequest
  ): Promise<ChangduSeriesDatabaseSyncResponse> {
    const response = await apiClient.post<ChangduSeriesDatabaseSyncResponse>(
      `${BASE_PATH}/series-list/sync-database`,
      payload,
      { timeout: 600000 }
    )
    return response.data
  },

  /**
   * 常读短剧列表历史分月 upsert 到本地数据库（共享 user_id=2）
   */
  async syncSeriesListHistoryToDatabase(
    payload: ChangduSeriesDatabaseHistorySyncRequest
  ): Promise<ChangduSeriesDatabaseHistorySyncResponse> {
    const response = await apiClient.post<ChangduSeriesDatabaseHistorySyncResponse>(
      `${BASE_PATH}/series-list/sync-database-history`,
      payload,
      { timeout: 600000 }
    )
    return response.data
  },

  /** 常读定时任务（独立 API，与巨量 /ocean-engine/scheduled-tasks 无关） */
  async createScheduledTask(data: ChangduScheduledTaskCreate): Promise<ChangduScheduledTask> {
    const response = await apiClient.post<ChangduScheduledTask>(
      `${BASE_PATH}/scheduled-tasks`,
      data
    )
    return response.data
  },

  async getScheduledTasks(
    params: {
      page?: number
      page_size?: number
      task_type?: string
      is_active?: boolean
    } = {}
  ): Promise<PaginatedResponse<ChangduScheduledTask>> {
    const response = await apiClient.get<PaginatedResponse<ChangduScheduledTask>>(
      `${BASE_PATH}/scheduled-tasks`,
      { params }
    )
    return response.data
  },

  async getScheduledTask(taskId: number): Promise<ChangduScheduledTask> {
    const response = await apiClient.get<ChangduScheduledTask>(
      `${BASE_PATH}/scheduled-tasks/${taskId}`
    )
    return response.data
  },

  async updateScheduledTask(
    taskId: number,
    data: ChangduScheduledTaskUpdate
  ): Promise<ChangduScheduledTask> {
    const response = await apiClient.patch<ChangduScheduledTask>(
      `${BASE_PATH}/scheduled-tasks/${taskId}`,
      data
    )
    return response.data
  },

  async deleteScheduledTask(taskId: number): Promise<void> {
    await apiClient.delete(`${BASE_PATH}/scheduled-tasks/${taskId}`)
  },

  async toggleScheduledTask(taskId: number): Promise<ChangduScheduledTask> {
    const response = await apiClient.post<ChangduScheduledTask>(
      `${BASE_PATH}/scheduled-tasks/${taskId}/toggle`
    )
    return response.data
  },

  /** 分页执行记录 */
  async getScheduledTaskExecutionLogs(
    taskId: number,
    params: { page?: number; page_size?: number } = {}
  ): Promise<PaginatedResponse<ChangduScheduledTaskExecutionLog>> {
    const response = await apiClient.get<PaginatedResponse<ChangduScheduledTaskExecutionLog>>(
      `${BASE_PATH}/scheduled-tasks/${taskId}/execution-logs`,
      { params }
    )
    return response.data
  },

  /** 最近一次执行记录（无记录时后端可能返回 null） */
  async getLatestScheduledTaskExecutionLog(
    taskId: number
  ): Promise<ChangduScheduledTaskExecutionLog | null> {
    const response = await apiClient.get<ChangduScheduledTaskExecutionLog | null>(
      `${BASE_PATH}/scheduled-tasks/${taskId}/execution-logs/latest`
    )
    return response.data
  }
}
