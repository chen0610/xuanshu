import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // 打开外部链接
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  // 保存文件并打开文件夹
  saveFileAndOpenFolder: (content: string, defaultFilename: string) =>
    ipcRenderer.invoke('save-file-and-open-folder', content, defaultFilename),
  // 选择文件夹
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  // 选择多个视频文件
  selectVideoFiles: () =>
    ipcRenderer.invoke('select-video-files') as Promise<{ canceled: boolean; filePaths: string[] }>,
  /** 主进程使用 @volcengine/tos-sdk 分片上传本地文件（需主进程环境变量 LIANGSHAN_TOS_*） */
  lianshanTosUploadFileFromPath: (payload: { filePath: string; objectKey: string; contentType?: string }) =>
    ipcRenderer.invoke('lianshan-tos:upload-file-from-path', payload) as Promise<
      { ok: true } | { ok: false; error: string }
    >,
  videoDownload: {
    start: (payload: {
      saveDir: string
      tasks: Array<{
        id: string
        materialId: string
        videoId: string
        title?: string
        filename?: string
        url: string
      }>
      concurrency?: number
      proxyConfig?: {
        apiBaseUrl: string
        authToken: string
        configId: number
      }
    }) =>
      ipcRenderer.invoke('video-download:start', payload) as Promise<
        { ok: true; batchId: string } | { ok: false; error: string }
      >,
    append: (payload: {
      tasks: Array<{
        id: string
        materialId: string
        videoId: string
        title?: string
        filename?: string
        url: string
      }>
    }) => ipcRenderer.invoke('video-download:append', payload) as Promise<{ ok: boolean; error?: string }>,
    clearCompleted: () =>
      ipcRenderer.invoke('video-download:clear-completed') as Promise<{
        ok: boolean
        error?: string
        removed?: number
      }>,
    pause: () => ipcRenderer.invoke('video-download:pause') as Promise<{ ok: boolean; error?: string }>,
    resume: () => ipcRenderer.invoke('video-download:resume') as Promise<{ ok: boolean; error?: string }>,
    cancel: () => ipcRenderer.invoke('video-download:cancel') as Promise<{ ok: boolean; error?: string }>,
    retryFailed: (payload: {
      tasks: Array<{
        id: string
        materialId: string
        videoId: string
        title?: string
        filename?: string
        url: string
      }>
    }) =>
      ipcRenderer.invoke('video-download:retry-failed', payload) as Promise<{ ok: boolean; error?: string }>,
    getState: () =>
      ipcRenderer.invoke('video-download:get-state') as Promise<{
        batchId: string
        saveDir: string
        status: 'running' | 'paused' | 'completed' | 'cancelled'
        concurrency: number
        tasks: Array<{
          id: string
          materialId: string
          videoId: string
          filename: string
          status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled'
          progress: number
          downloadedBytes: number
          totalBytes: number
          error?: string
          filePath?: string
        }>
        startedAt: number
      } | null>,
    openFolder: () =>
      ipcRenderer.invoke('video-download:open-folder') as Promise<{ ok: boolean; error?: string }>,
    onStateChanged: (
      callback: (state: {
        batchId: string
        saveDir: string
        status: 'running' | 'paused' | 'completed' | 'cancelled'
        concurrency: number
        tasks: Array<{
          id: string
          materialId: string
          videoId: string
          filename: string
          status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled'
          progress: number
          downloadedBytes: number
          totalBytes: number
          error?: string
          filePath?: string
        }>
        startedAt: number
      } | null) => void
    ) => {
      const subscription = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state as never)
      ipcRenderer.on('video-download:state-changed', subscription)
      return () => ipcRenderer.removeListener('video-download:state-changed', subscription)
    }
  },
  // 退出应用
  quitApp: () => ipcRenderer.invoke('quit-app'),
  // 设置登录状态
  setLoginStatus: (loggedIn: boolean) => ipcRenderer.invoke('set-login-status', loggedIn),
  // 读取本机已保存的登录凭据（加密存储）
  getLoginCredentials: (platform: 'ocean' | 'tencent' | 'changdu', configId?: number) =>
    ipcRenderer.invoke('get-login-credentials', platform, configId),
  saveLoginCredentials: (
    platform: 'ocean' | 'tencent' | 'changdu',
    configId: number,
    email: string,
    password: string
  ) => ipcRenderer.invoke('save-login-credentials', platform, configId, email, password),
  clearLoginCredentials: (platform: 'ocean' | 'tencent' | 'changdu', configId?: number) =>
    ipcRenderer.invoke('clear-login-credentials', platform, configId),
  // 打开登录窗口获取Cookie（可选自动填账号密码）
  openLoginWindow: (
    platform: 'ocean' | 'tencent' | 'changdu',
    options?: {
      email?: string
      password?: string
      remember?: boolean
      configId?: number
      persistOnly?: boolean
    }
  ) => ipcRenderer.invoke('open-login-window', platform, options),
  // 打开飞书授权窗口
  openFeishuAuthWindow: (authUrl: string) => ipcRenderer.invoke('open-feishu-auth-window', authUrl),
  // 打开巨量引擎 OAuth 授权窗口
  openOceanEngineAuthWindow: (authUrl: string) =>
    ipcRenderer.invoke('open-ocean-engine-auth-window', authUrl),
  // 打开巨量网页新建项目窗口并捕获创建请求参数
  openOceanEngineProjectCreateWindow: (payload: { advertiserId: string; cookie: string }) =>
    ipcRenderer.invoke('ocean-engine:open-project-create-window', payload) as Promise<
      | { success: true; params: Record<string, string | string[]>; url: string }
      | { success: false; error?: string }
    >,
  // 批量打开多个登录窗口获取多个Cookie（自动填入模式）
  openMultiLoginWindowsAuto: (
    platform: 'ocean' | 'tencent' | 'changdu',
    count: number,
    options?: {
      email?: string
      password?: string
      remember?: boolean
      configId?: number
      persistOnly?: boolean
    }
  ) => ipcRenderer.invoke('open-multi-login-windows-auto', platform, count, options),
  // 监听自动收集到的Cookie事件
  onMultiLoginCookieCollected: (
    callback: (data: {
      index: number
      sessionId: string
      cookies: string
      success: boolean
    }) => void
  ) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on('multi-login-cookie-collected', subscription)
    return () => ipcRenderer.removeListener('multi-login-cookie-collected', subscription)
  },
  // 监听窗口关闭事件
  onMultiLoginWindowClosed: (callback: (data: { index: number; sessionId: string }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on('multi-login-window-closed', subscription)
    return () => ipcRenderer.removeListener('multi-login-window-closed', subscription)
  },
  // 关闭所有批量登录窗口
  closeMultiLoginWindows: () => ipcRenderer.invoke('close-multi-login-windows'),
  // 更新相关 API
  update: {
    // 检查更新
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    // 下载更新
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    // 安装更新
    installUpdate: () => ipcRenderer.invoke('install-update'),
    // 监听更新事件
    onUpdateChecking: (callback: (meta: unknown) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, meta: unknown) => callback(meta)
      ipcRenderer.on('update-checking', subscription)
      return () => ipcRenderer.removeListener('update-checking', subscription)
    },
    onUpdateAvailable: (callback: (info: unknown) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, info: unknown) => callback(info)
      ipcRenderer.on('update-available', subscription)
      return () => ipcRenderer.removeListener('update-available', subscription)
    },
    onUpdateNotAvailable: (callback: (meta: unknown) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, meta: unknown) => callback(meta)
      ipcRenderer.on('update-not-available', subscription)
      return () => ipcRenderer.removeListener('update-not-available', subscription)
    },
    onDownloadProgress: (callback: (progress: unknown) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, progress: unknown) =>
        callback(progress)
      ipcRenderer.on('update-download-progress', subscription)
      return () => ipcRenderer.removeListener('update-download-progress', subscription)
    },
    onUpdateDownloaded: (callback: (info: unknown) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, info: unknown) => callback(info)
      ipcRenderer.on('update-downloaded', subscription)
      return () => ipcRenderer.removeListener('update-downloaded', subscription)
    },
    onUpdateError: (callback: (error: unknown) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, error: unknown) => callback(error)
      ipcRenderer.on('update-error', subscription)
      return () => ipcRenderer.removeListener('update-error', subscription)
    },
    onUpdateShowDialog: (callback: () => void) => {
      const subscription = () => callback()
      ipcRenderer.on('update-show-dialog', subscription)
      return () => ipcRenderer.removeListener('update-show-dialog', subscription)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
