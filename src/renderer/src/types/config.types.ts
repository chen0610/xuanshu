// 配置相关类型定义

export interface Config {
  id: number
  cookie_name: string
  cookie: string // 主Cookie值（必填）
  backup_cookies: string[] // 备用Cookie值列表
  backup_statuses: boolean[] // 备用Cookie状态列表
  realname?: string
  user_id: number
  source: number // 1-巨量, 2-腾讯
  status: boolean
}

export interface ConfigCreate {
  cookie_name: string
  cookie: string // 主Cookie值（必填）
  backup_cookies?: string[] // 备用Cookie值列表（可选，最多10个）
  backup_statuses?: boolean[] // 备用Cookie状态列表
  realname?: string
  user_id: number
  source: number
  status?: boolean
}

export interface ConfigUpdate {
  cookie_name?: string
  cookie?: string // 主Cookie值
  backup_cookies?: string[] // 备用Cookie值列表
  backup_statuses?: boolean[] // 备用Cookie状态列表
  realname?: string
  user_id?: number
  source?: number
  status?: boolean
}

export interface MobileAccessToggleResponse {
  enabled: boolean
  url?: string | null
  secret_key?: string | null
}

// 登录窗口结果类型
export interface LoginWindowResult {
  success: boolean
  cookies?: string
  error?: string
}

/** 浏览器登录弹窗可选凭据（仅本机使用，不上传服务器） */
export interface OpenLoginWindowOptions {
  email?: string
  password?: string
  remember?: boolean
  /** 配置账号 ID，凭据按账号分别保存在本机 */
  configId?: number
  /** 仅保存/清除本机凭据，不打开浏览器 */
  persistOnly?: boolean
}

export interface StoredLoginCredentialsResult {
  hasStored: boolean
  email?: string
  password?: string
}

// 登录方式类型
export type LoginMethod = 'manual' | 'browser'
