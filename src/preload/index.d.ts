import { ElectronAPI } from '@electron-toolkit/preload'

interface UpdateInfo {
  version: string
  releaseNotes?: string
  releaseDate?: string
}

interface UpdateProgressInfo {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

interface UpdateEventMeta {
  manual?: boolean
  silent?: boolean
}

interface UpdateAPI {
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  onUpdateChecking: (callback: (meta: UpdateEventMeta) => void) => () => void
  onUpdateAvailable: (callback: (info: UpdateInfo & UpdateEventMeta) => void) => () => void
  onUpdateNotAvailable: (callback: (meta: UpdateEventMeta) => void) => () => void
  onDownloadProgress: (callback: (progress: UpdateProgressInfo) => void) => () => void
  onUpdateDownloaded: (callback: (info: UpdateInfo & UpdateEventMeta) => void) => () => void
  onUpdateError: (callback: (error: { message: string; manual?: boolean }) => void) => () => void
  onUpdateShowDialog: (callback: () => void) => () => void
}

interface MultiLoginWindowResult {
  index: number
  sessionId: string
  cookies: string
  success: boolean
  error?: string
}

interface MultiLoginResult {
  success: boolean
  cookies?: MultiLoginWindowResult[]
  count?: number
  successCount?: number
  message?: string
  windowIds?: string[]
  error?: string
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openExternal: (url: string) => Promise<void>
      saveFileAndOpenFolder: (
        content: string,
        defaultFilename: string
      ) => Promise<{ success: boolean; canceled?: boolean; filePath?: string }>
      selectFolder: () => Promise<{ folderPath?: string; canceled?: boolean }>
      selectVideoFiles: () => Promise<{ canceled: boolean; filePaths: string[] }>
      lianshanTosUploadFileFromPath: (payload: {
        filePath: string
        objectKey: string
        contentType?: string
      }) => Promise<{ ok: true } | { ok: false; error: string }>
      videoDownload: {
        start: (payload: {
          saveDir: string
          tasks: Array<{
            id: string
            materialId: string
            videoId: string
            title?: string
            url: string
          }>
          concurrency?: number
          proxyConfig?: {
            apiBaseUrl: string
            authToken: string
            configId: number
          }
        }) => Promise<{ ok: true; batchId: string } | { ok: false; error: string }>
        pause: () => Promise<{ ok: boolean; error?: string }>
        resume: () => Promise<{ ok: boolean; error?: string }>
        cancel: () => Promise<{ ok: boolean; error?: string }>
        retryFailed: (payload: {
          tasks: Array<{
            id: string
            materialId: string
            videoId: string
            title?: string
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
      quitApp: () => Promise<void>
      setLoginStatus: (loggedIn: boolean) => Promise<void>
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
      ) => Promise<{ success: boolean; cookies?: string; error?: string }>
      openFeishuAuthWindow: (
        authUrl: string
      ) => Promise<{ success: boolean; code?: string; state?: string; error?: string }>
      openOceanEngineAuthWindow: (
        authUrl: string
      ) => Promise<{ success: boolean; auth_code?: string; state?: string; error?: string }>
      openOceanEngineProjectCreateWindow: (payload: {
        advertiserId: string
        cookie: string
      }) => Promise<
        | { success: true; params: unknown; url: string }
        | { success: false; error?: string }
      >
      openMultiLoginWindowsAuto: (
        platform: 'ocean' | 'tencent' | 'changdu',
        count: number,
        options?: { email?: string; password?: string; remember?: boolean; configId?: number }
      ) => Promise<MultiLoginResult>
      onMultiLoginCookieCollected: (
        callback: (data: {
          index: number
          sessionId: string
          cookies: string
          success: boolean
        }) => void
      ) => () => void
      onMultiLoginWindowClosed: (
        callback: (data: { index: number; sessionId: string }) => void
      ) => () => void
      closeMultiLoginWindows: () => Promise<{ success: boolean; error?: string }>
      update: UpdateAPI
    }
  }
}

export {}
