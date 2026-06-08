import axios from 'axios'
import apiClient from './api'

const BASE_PATH = '/api/v1/shared-materials'

export interface SharedFolderTreeRow {
  id: number
  parent_id: number | null
  name: string
  sort_order: number
  depth: number
  created_by_user_id: number
  created_at: string | null
}

export interface SharedAssetItem {
  id: number
  folder_id: number
  display_name: string
  original_filename: string
  video_url: string
  file_size: number
  content_type: string | null
  uploaded_by_user_id: number
  created_at: string | null
}

export interface SharedAssetDetail extends SharedAssetItem {
  tos_object_key: string
  /** 为 true 表示未再次写入连山，引用库内已有相同内容 */
  reused_existing_tos?: boolean
}

export interface SharedAssetListResponse {
  items: SharedAssetItem[]
  total: number
  page: number
  page_size: number
}

export interface SharedEnqueueOceanRequest {
  org_advertiser_id: string
  advertiser_id: string
  account_type?: string
  labels?: string[]
  is_aigc?: boolean
  is_guide_video?: boolean
  is_need_auth?: boolean
}

export interface SharedEnqueueOceanResponse {
  code: number
  message?: string | null
  local_id?: number | null
  ocean_task_id?: number | null
}

export interface SharedEnqueueOceanBatchRequest {
  asset_ids: number[]
  org_advertiser_id: string
  advertiser_id: string
  account_type?: string
  labels?: string[]
  is_aigc?: boolean
  is_guide_video?: boolean
  is_need_auth?: boolean
  /** 可选：覆盖服务端批并发，默认由服务端按授权与 QPS 计算 */
  concurrency?: number
}

export interface SharedEnqueueOceanBatchItem {
  asset_id: number
  code: number
  message?: string | null
  local_id?: number | null
  ocean_task_id?: number | null
}

export interface SharedEnqueueOceanBatchResponse {
  code: number
  message?: string | null
  batch_id: string
  concurrency: number
  wall_time_ms: number
  success_count: number
  error_count: number
  items: SharedEnqueueOceanBatchItem[]
}

export interface SharedMaterialUploadOptions {
  tos_configured: boolean
  shared_library_direct_upload_enabled: boolean
}

export type SharedTosUploadSessionResponse =
  | {
      upload_mode: 'put'
      object_key: string
      presigned_url: string
      signed_headers: Record<string, string>
      expires_in_seconds: number
      content_type: string
      content_sha256: string
    }
  | {
      upload_mode: 'reuse'
      reuse_source_asset_id: number
      video_url: string
      tos_object_key: string
      file_size: number
      content_type: string | null
      content_sha256: string
    }

/** 浏览器端对整文件计算 SHA-256（十六进制小写），用于直传会话与去重。 */
export async function sha256HexFromFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buf)
  const bytes = new Uint8Array(hash)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

const sharedMaterialLibraryService = {
  async getUploadOptions(): Promise<SharedMaterialUploadOptions> {
    const { data } = await apiClient.get<SharedMaterialUploadOptions>(`${BASE_PATH}/upload-options`)
    return data
  },

  async listFolders(): Promise<{ folders: SharedFolderTreeRow[] }> {
    const { data } = await apiClient.get<{ folders: SharedFolderTreeRow[] }>(`${BASE_PATH}/folders`)
    return data
  },

  async createFolder(body: { parent_id?: number | null; name: string; sort_order?: number }): Promise<{
    id: number
    parent_id: number | null
    name: string
    sort_order: number
  }> {
    const { data } = await apiClient.post(`${BASE_PATH}/folders`, body)
    return data
  },

  async updateFolder(
    folderId: number,
    body: { name?: string; parent_id?: number | null; parent_id_set?: boolean; sort_order?: number }
  ): Promise<void> {
    await apiClient.patch(`${BASE_PATH}/folders/${folderId}`, body)
  },

  async deleteFolder(folderId: number): Promise<void> {
    await apiClient.delete(`${BASE_PATH}/folders/${folderId}`)
  },

  async getFolderAcl(folderId: number): Promise<{ folder_id: number; user_ids: number[] }> {
    const { data } = await apiClient.get(`${BASE_PATH}/folders/${folderId}/acl`)
    return data
  },

  async putFolderAcl(folderId: number, user_ids: number[]): Promise<void> {
    await apiClient.put(`${BASE_PATH}/folders/${folderId}/acl`, { user_ids })
  },

  async listAssets(params: {
    folder_id: number
    page?: number
    page_size?: number
    /** 关键词：匹配展示名、原始文件名 */
    q?: string
  }): Promise<SharedAssetListResponse> {
    const { data } = await apiClient.get<SharedAssetListResponse>(`${BASE_PATH}/assets`, { params })
    return data
  },

  async getAsset(assetId: number): Promise<SharedAssetDetail> {
    const { data } = await apiClient.get<SharedAssetDetail>(`${BASE_PATH}/assets/${assetId}`)
    return data
  },

  async createTosUploadSession(body: {
    folder_id: number
    original_filename: string
    file_size: number
    content_sha256: string
    content_type?: string | null
  }): Promise<SharedTosUploadSessionResponse> {
    const { data } = await apiClient.post<SharedTosUploadSessionResponse>(`${BASE_PATH}/tos-upload-session`, body)
    return data
  },

  async completeDirectUpload(body: {
    folder_id: number
    upload_mode: 'put' | 'reuse'
    content_sha256: string
    file_size: number
    original_filename: string
    display_name?: string | null
    content_type?: string | null
    object_key?: string | null
    reuse_source_asset_id?: number | null
  }): Promise<SharedAssetDetail> {
    const { data } = await apiClient.post<SharedAssetDetail>(`${BASE_PATH}/assets/complete-direct`, body)
    return data
  },

  /**
   * 连山直传：预签名 PUT → complete（不经业务服务器传文件字节）。
   * 注意：TOS 桶需配置 CORS，允许当前页面 Origin 对桶域名发起 PUT。
   */
  async uploadAssetDirectToTos(
    params: {
      folder_id: number
      file: File
      /** 列表展示名，默认可用 webkitRelativePath */
      display_name?: string
      /** 用于 MIME 猜测，默认 file.name */
      original_filename?: string
    },
    options?: { onUploadProgress?: (percent: number) => void }
  ): Promise<SharedAssetDetail> {
    const file = params.file
    const originalName = (params.original_filename ?? file.name).trim() || 'video.mp4'
    const display = (params.display_name ?? '').trim() || originalName

    options?.onUploadProgress?.(1)
    const content_sha256 = await sha256HexFromFile(file)
    options?.onUploadProgress?.(5)

    const session = await this.createTosUploadSession({
      folder_id: params.folder_id,
      original_filename: originalName,
      file_size: file.size,
      content_sha256,
      content_type: file.type || undefined
    })

    if (session.upload_mode === 'reuse') {
      options?.onUploadProgress?.(40)
      const detail = await this.completeDirectUpload({
        folder_id: params.folder_id,
        upload_mode: 'reuse',
        content_sha256: session.content_sha256,
        file_size: session.file_size,
        original_filename: originalName,
        display_name: display,
        content_type: session.content_type ?? undefined,
        reuse_source_asset_id: session.reuse_source_asset_id
      })
      options?.onUploadProgress?.(100)
      return detail
    }

    const headers: Record<string, string> = { ...session.signed_headers }
    const putRes = await axios.put(session.presigned_url, file, {
      timeout: 600000,
      headers,
      validateStatus: () => true,
      onUploadProgress: (ev) => {
        if (ev.total && options?.onUploadProgress) {
          const ratio = ev.loaded / ev.total
          options.onUploadProgress(Math.min(99, Math.round(5 + ratio * 94)))
        }
      }
    })
    if (putRes.status < 200 || putRes.status >= 300) {
      const body =
        typeof putRes.data === 'string' ? putRes.data : JSON.stringify(putRes.data ?? '')
      throw new Error(`连山 TOS 直传失败 HTTP ${putRes.status}${body ? `: ${body.slice(0, 500)}` : ''}`)
    }

    options?.onUploadProgress?.(99)
    const detail = await this.completeDirectUpload({
      folder_id: params.folder_id,
      upload_mode: 'put',
      content_sha256: session.content_sha256,
      file_size: file.size,
      original_filename: originalName,
      display_name: display,
      content_type: session.content_type,
      object_key: session.object_key
    })
    options?.onUploadProgress?.(100)
    return detail
  },

  async uploadAsset(
    params: {
      folder_id: number
      file: File
      display_name?: string
    },
    options?: { onUploadProgress?: (percent: number) => void }
  ): Promise<SharedAssetDetail> {
    const form = new FormData()
    form.append('folder_id', String(params.folder_id))
    form.append('file', params.file)
    if (params.display_name != null && params.display_name !== '') {
      form.append('display_name', params.display_name)
    }
    const { data } = await apiClient.post<SharedAssetDetail>(`${BASE_PATH}/assets`, form, {
      timeout: 600000,
      onUploadProgress: (ev) => {
        if (ev.total && options?.onUploadProgress) {
          options.onUploadProgress(Math.round((ev.loaded * 100) / ev.total))
        }
      },
      transformRequest: [
        (body, headers) => {
          if (body instanceof FormData && headers) {
            delete headers['Content-Type']
          }
          return body
        }
      ]
    })
    return data
  },

  /**
   * 在服务端开启直传且 TOS 已配置时走预签名上传，否则走 multipart。
   */
  async uploadAssetAuto(
    params: { folder_id: number; file: File; display_name?: string },
    options?: { onUploadProgress?: (percent: number) => void }
  ): Promise<SharedAssetDetail> {
    const opts = await this.getUploadOptions()
    const label = (params.display_name ?? '').trim()
    if (opts.shared_library_direct_upload_enabled) {
      return this.uploadAssetDirectToTos(
        {
          folder_id: params.folder_id,
          file: params.file,
          display_name: label || undefined,
          original_filename: params.file.name
        },
        options
      )
    }
    return this.uploadAsset(
      { folder_id: params.folder_id, file: params.file, display_name: label || undefined },
      options
    )
  },

  async enqueueOceanAsync(assetId: number, body: SharedEnqueueOceanRequest): Promise<SharedEnqueueOceanResponse> {
    const { data } = await apiClient.post<SharedEnqueueOceanResponse>(
      `${BASE_PATH}/assets/${assetId}/enqueue-ocean-async`,
      body
    )
    return data
  },

  async enqueueOceanAsyncBatch(
    body: SharedEnqueueOceanBatchRequest
  ): Promise<SharedEnqueueOceanBatchResponse> {
    const { data } = await apiClient.post<SharedEnqueueOceanBatchResponse>(
      `${BASE_PATH}/assets/enqueue-ocean-async/batch`,
      body
    )
    return data
  }
}

export { sharedMaterialLibraryService }
