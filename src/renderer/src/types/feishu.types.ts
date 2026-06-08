// 飞书类型定义 - 对应后端 Pydantic 模型

/**
 * 飞书授权 URL 响应
 */
export interface FeishuAuthUrlResponse {
  auth_url: string
  state: string
}

/**
 * 飞书用户信息
 */
export interface FeishuUserInfo {
  open_id: string
  union_id?: string
  name?: string
  en_name?: string
  avatar_url?: string
  mobile?: string
  email?: string
}

/**
 * 飞书绑定信息
 */
export interface FeishuBindingInfo {
  is_bound: boolean
  feishu_user?: FeishuUserInfo
  bound_at?: string
}

/**
 * 飞书授权回调参数
 */
export interface FeishuCallbackParams {
  code: string
  state: string
}

/**
 * 字段定义
 */
export interface FieldDefinition {
  field_name: string
  field_type: string // text, number, date, select, multiSelect, url, attachment, checkbox, person
}

/**
 * 创建多维表格并推送数据请求
 */
export interface BitableCreateWithDataRequest {
  bitable_name: string
  table_name: string
  fields: FieldDefinition[]
  records: Record<string, any>[]
  folder_token?: string
  default_view_name?: string
}

/**
 * 多维表格响应
 */
export interface BitableResponse {
  app_token: string
  app_url: string
  table_id?: string
  table_name?: string
  record_count?: number
  message: string
}

/**
 * 表头背景颜色RGB值
 */
export interface HeaderBackgroundColor {
  red: number
  green: number
  blue: number
}

/**
 * 创建电子表格并推送数据请求
 */
export interface SheetCreateWithDataRequest {
  title: string
  headers: string[]
  rows: any[][]
  folder_token?: string
  color_type?: string
  // V2版本参数：支持合并单元格和设置背景色
  project_merge_ranges?: number[][] // 项目列合并范围列表，每个元素为[start_row, end_row]
  tag_merge_ranges?: number[][] // 标签列合并范围列表，每个元素为[start_row, end_row]
  operator_merge_ranges?: number[][] // 投手列合并范围列表，每个元素为[start_row, end_row]
  total_rows?: number[] // 总计行行号列表
  total_genre_team_merge_ranges?: number[][] // 总计行的体裁和团队列合并范围列表，每个元素为[row]，表示该行的B列和C列合并
}

/**
 * 电子表格响应
 */
export interface SheetResponse {
  spreadsheet_token: string
  spreadsheet_url: string
  sheet_id?: string
  row_count?: number
  message: string
}
