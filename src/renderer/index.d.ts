import { ElectronAPI } from '@electron-toolkit/preload'
import { LoginWindowResult } from './src/types/config.types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      // 打开外部链接
      openExternal: (url: string) => Promise<void>
      // 保存文件并打开文件夹
      saveFileAndOpenFolder: (
        content: string,
        defaultFilename: string
      ) => Promise<{
        success: boolean
        filePath?: string
        canceled?: boolean
      }>
      // 退出应用
      quitApp: () => Promise<void>
      // 设置登录状态
      setLoginStatus: (loggedIn: boolean) => Promise<void>
      // 打开登录窗口获取Cookie
      getLoginCredentials: (
        platform: 'ocean' | 'tencent' | 'changdu',
        configId?: number
      ) => Promise<{
        hasStored: boolean
        email?: string
        password?: string
      }>
      saveLoginCredentials: (
        platform: 'ocean' | 'tencent' | 'changdu',
        configId: number,
        email: string,
        password: string
      ) => Promise<{ success: boolean }>
      clearLoginCredentials: (
        platform: 'ocean' | 'tencent' | 'changdu',
        configId?: number
      ) => Promise<{ success: boolean }>
      openLoginWindow: (
        platform: 'ocean' | 'tencent' | 'changdu',
        options?: {
          email?: string
          password?: string
          remember?: boolean
          configId?: number
          persistOnly?: boolean
        }
      ) => Promise<LoginWindowResult>
      openOceanEngineProjectCreateWindow: (payload: {
        advertiserId: string
        cookie: string
      }) => Promise<
        | { success: true; params: unknown; url: string }
        | { success: false; error?: string }
      >
      selectFolder: () => Promise<{ folderPath?: string; canceled?: boolean }>
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
        }) => Promise<{ ok: true; batchId: string } | { ok: false; error: string }>
        append: (payload: {
          tasks: Array<{
            id: string
            materialId: string
            videoId: string
            title?: string
            filename?: string
            url: string
          }>
        }) => Promise<{ ok: boolean; error?: string }>
        clearCompleted: () => Promise<{ ok: boolean; error?: string; removed?: number }>
        pause: () => Promise<{ ok: boolean; error?: string }>
        resume: () => Promise<{ ok: boolean; error?: string }>
        cancel: () => Promise<{ ok: boolean; error?: string }>
        retryFailed: (payload: {
          tasks: Array<{
            id: string
            materialId: string
            videoId: string
            title?: string
            filename?: string
            url: string
          }>
        }) => Promise<{ ok: boolean; error?: string }>
        getState: () => Promise<{
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
        } | null>
        openFolder: () => Promise<{ ok: boolean; error?: string }>
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
        ) => () => void
      }
      // 更新相关 API
      update: {
        checkForUpdates: () => Promise<void>
        downloadUpdate: () => Promise<void>
        installUpdate: () => Promise<void>
        onUpdateChecking: (callback: (meta: unknown) => void) => () => void
        onUpdateAvailable: (callback: (info: unknown) => void) => () => void
        onUpdateNotAvailable: (callback: (meta: unknown) => void) => () => void
        onDownloadProgress: (callback: (progress: unknown) => void) => () => void
        onUpdateDownloaded: (callback: (info: unknown) => void) => () => void
        onUpdateError: (callback: (error: unknown) => void) => () => void
        onUpdateShowDialog: (callback: () => void) => () => void
      }
    }
  }
}
