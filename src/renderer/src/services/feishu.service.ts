import apiClient from './api'
import type {
  FeishuAuthUrlResponse,
  FeishuBindingInfo,
  BitableCreateWithDataRequest,
  BitableResponse,
  SheetCreateWithDataRequest,
  SheetResponse
} from '../types/feishu.types'

/**
 * 飞书集成 API 服务
 */
export const feishuService = {
  /**
   * 获取飞书授权 URL
   * @returns 授权 URL 和 state
   */
  async getAuthUrl(): Promise<FeishuAuthUrlResponse> {
    const { data } = await apiClient.get<FeishuAuthUrlResponse>('/api/v1/feishu/auth-url')
    return data
  },

  /**
   * 获取当前用户的飞书绑定信息
   * @returns 绑定信息
   */
  async getBindingInfo(): Promise<FeishuBindingInfo> {
    const { data } = await apiClient.get<FeishuBindingInfo>('/api/v1/feishu/binding')
    return data
  },

  /**
   * 解除飞书绑定
   */
  async unbind(): Promise<void> {
    await apiClient.delete('/api/v1/feishu/binding')
  },

  /**
   * 开始飞书授权流程
   * - Electron: 使用外部浏览器打开
   * - 网页: 使用弹窗模式
   */
  async startAuthFlow(): Promise<{ success: boolean; message?: string }> {
    try {
      // 1. 获取授权 URL 和 state
      const { auth_url, state } = await this.getAuthUrl()

      // 2. 获取当前用户信息
      const userStr = localStorage.getItem('user')
      let enhancedState = state

      if (userStr) {
        try {
          const user = JSON.parse(userStr)
          // 将 user_id 编码到 state 中 (格式: state:user_id)
          enhancedState = `${state}:${user.id}`
        } catch (e) {
          console.warn('解析用户信息失败:', e)
        }
      }

      // 3. 保存原始 state 用于回调验证 (防 CSRF)
      sessionStorage.setItem('feishu_auth_state', state)

      // 4. 替换 URL 中的 state 参数
      const urlObj = new URL(auth_url)
      urlObj.searchParams.set('state', enhancedState)
      const finalUrl = urlObj.toString()

      // 5. 检测运行环境
      const isElectron = !!(window as any).electron || !!(window as any).api

      if (isElectron) {
        // Electron 环境: 使用外部浏览器打开
        return await this.startElectronAuthFlow(finalUrl)
      } else {
        // 普通浏览器: 使用弹窗
        return await this.startPopupAuthFlow(finalUrl)
      }
    } catch (error) {
      console.error('启动飞书授权失败:', error)
      throw error
    }
  },

  /**
   * Electron 环境的授权流程
   */
  async startElectronAuthFlow(url: string): Promise<{ success: boolean; message?: string }> {
    // 使用内嵌的 BrowserWindow 打开授权页面
    if ((window as any).api?.openFeishuAuthWindow) {
      try {
        console.log('[飞书授权] 使用 Electron 内嵌窗口打开授权')
        const result = await (window as any).api.openFeishuAuthWindow(url)

        if (result.success && result.code && result.state) {
          console.log('[飞书授权] 授权窗口返回成功')

          // 验证 state
          const savedState = sessionStorage.getItem('feishu_auth_state')
          // 从增强的 state 中提取原始 state (state:user_id 格式)
          const originalState = result.state.includes(':')
            ? result.state.split(':')[0]
            : result.state

          if (savedState !== originalState) {
            throw new Error('State 验证失败，可能存在 CSRF 攻击')
          }

          // 调用后端 API 完成绑定
          await this.handleCallback(result.code, result.state)

          // 清除保存的 state
          this.clearAuthState()

          return {
            success: true,
            message: '授权成功，已完成飞书绑定'
          }
        } else {
          throw new Error(result.error || '授权失败')
        }
      } catch (error) {
        console.error('[飞书授权] Electron 授权失败:', error)
        throw error
      }
    }

    // 降级: 使用外部浏览器
    if ((window as any).api?.openExternal) {
      try {
        await (window as any).api.openExternal(url)
        return {
          success: true,
          message: '已在浏览器中打开授权页面，请完成授权后返回应用'
        }
      } catch (error) {
        throw new Error('无法打开授权窗口')
      }
    }

    // 最终降级: 直接跳转
    window.location.href = url
    return { success: true }
  },

  /**
   * 浏览器弹窗授权流程
   */
  async startPopupAuthFlow(url: string): Promise<{ success: boolean; message?: string }> {
    const popup = this.openAuthPopup(url)

    if (!popup) {
      // 弹窗被阻止,降级为全屏跳转
      console.warn('弹窗被阻止,使用全屏跳转模式')
      window.location.href = url
      return { success: true }
    }

    // 等待授权完成
    return await this.waitForAuthResult(popup)
  },

  /**
   * 打开授权弹窗
   * @param url 授权 URL
   * @returns 弹窗对象
   */
  openAuthPopup(url: string): Window | null {
    const width = 600
    const height = 700
    const left = (window.screen.width - width) / 2
    const top = (window.screen.height - height) / 2

    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      'toolbar=no',
      'menubar=no',
      'scrollbars=yes',
      'resizable=yes',
      'status=no'
    ].join(',')

    return window.open(url, 'feishu_auth', features)
  },

  /**
   * 等待授权结果
   * @param popup 弹窗对象
   * @returns 授权结果
   */
  waitForAuthResult(popup: Window): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve, reject) => {
      // 设置超时(5分钟)
      const timeout = setTimeout(
        () => {
          cleanup()
          reject(new Error('授权超时,请重试'))
        },
        5 * 60 * 1000
      )

      // 监听消息
      const messageHandler = (event: MessageEvent) => {
        // 验证消息来源(生产环境应严格验证 origin)
        if (event.data && event.data.type === 'feishu_auth_result') {
          cleanup()

          if (event.data.success) {
            resolve({ success: true, message: event.data.message })
          } else {
            reject(new Error(event.data.message || '授权失败'))
          }
        }
      }

      // 监听窗口关闭
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          cleanup()
          // 检查是否已收到成功消息
          const authSuccess = sessionStorage.getItem('feishu_auth_success')
          if (authSuccess === 'true') {
            sessionStorage.removeItem('feishu_auth_success')
            resolve({ success: true })
          } else {
            reject(new Error('授权窗口已关闭'))
          }
        }
      }, 500)

      const cleanup = () => {
        clearTimeout(timeout)
        clearInterval(checkClosed)
        window.removeEventListener('message', messageHandler)
        if (!popup.closed) {
          popup.close()
        }
      }

      window.addEventListener('message', messageHandler)
    })
  },

  /**
   * 验证授权回调的 state
   * @param state 回调参数中的 state
   * @returns 是否验证成功
   */
  verifyCallbackState(state: string): boolean {
    const savedState = sessionStorage.getItem('feishu_auth_state')
    return savedState === state
  },

  /**
   * 清除保存的 state
   */
  clearAuthState(): void {
    sessionStorage.removeItem('feishu_auth_state')
  },

  /**
   * 处理授权回调,调用后端完成绑定
   * @param code 授权码
   * @param state 状态码
   * @returns void
   */
  async handleCallback(code: string, state: string): Promise<void> {
    const response = await apiClient.get('/api/v1/feishu/callback', {
      params: { code, state }
    })
    return response.data
  },

  /**
   * 创建多维表格并推送数据
   * @param request 创建请求参数
   * @returns 多维表格响应
   */
  async createBitableWithData(request: BitableCreateWithDataRequest): Promise<BitableResponse> {
    const { data } = await apiClient.post<BitableResponse>('/api/v1/feishu/bitable', request)
    return data
  },

  /**
   * 创建电子表格并推送数据
   * @param request 创建请求参数
   * @returns 电子表格响应
   */
  async createSheetWithData(request: SheetCreateWithDataRequest): Promise<SheetResponse> {
    const { data } = await apiClient.post<SheetResponse>('/api/v1/feishu/sheet', request)
    return data
  },
  /**
   * 创建个人维度电子表格并推送数据
   */
  async createSheetWithDataPersonal(request: SheetCreateWithDataRequest): Promise<SheetResponse> {
    const { data } = await apiClient.post<SheetResponse>('/api/v1/feishu/sheet/personal', request)
    return data
  }
}
