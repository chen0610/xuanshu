/**
 * Electron 主进程：使用 @volcengine/tos-sdk 对本地路径做分片上传（可选能力）。
 * 需在运行主进程的环境中配置与后端一致的 LIANGSHAN_TOS_* 变量；共享素材默认走预签名直传，本 IPC 供大文件或其它场景扩展。
 */
import { existsSync } from 'fs'
import { ipcMain } from 'electron'
import TosClient from '@volcengine/tos-sdk'

export function registerLianshanTosMultipartIpc(): void {
  ipcMain.removeHandler('lianshan-tos:upload-file-from-path')
  ipcMain.handle(
    'lianshan-tos:upload-file-from-path',
    async (
      _,
      payload: { filePath: string; objectKey: string; contentType?: string }
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      const ak = process.env.LIANGSHAN_TOS_ACCESS_KEY?.trim()
      const sk = process.env.LIANGSHAN_TOS_SECRET_KEY?.trim()
      const bucket = process.env.LIANGSHAN_TOS_BUCKET?.trim()
      const endpointRaw = (process.env.LIANGSHAN_TOS_ENDPOINT || 'tos-cn-beijing.volces.com').trim()
      const region = (process.env.LIANGSHAN_TOS_REGION || 'cn-beijing').trim()
      if (!ak || !sk || !bucket) {
        return { ok: false, error: '主进程未配置 LIANGSHAN_TOS_ACCESS_KEY / SECRET_KEY / BUCKET' }
      }
      if (!payload?.filePath || !existsSync(payload.filePath)) {
        return { ok: false, error: '本地文件不存在' }
      }
      const key = (payload.objectKey || '').trim()
      if (!key) {
        return { ok: false, error: 'objectKey 不能为空' }
      }
      const endpoint = endpointRaw.startsWith('http') ? endpointRaw : `https://${endpointRaw}`
      try {
        const client = new TosClient({
          accessKeyId: ak,
          accessKeySecret: sk,
          region,
          endpoint
        })
        await client.uploadFile({
          bucket,
          key,
          file: payload.filePath,
          contentType: (payload.contentType || 'application/octet-stream').slice(0, 128),
          partSize: 20 * 1024 * 1024,
          taskNum: 3
        })
        return { ok: true }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return { ok: false, error: msg }
      }
    }
  )
}
