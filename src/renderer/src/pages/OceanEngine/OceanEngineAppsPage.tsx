import React, { useEffect, useState } from 'react'
import { Plus, RefreshCw, Trash2, Edit, Loader2, Shield, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch
} from '../../components/ui'
import { oceanEngineAppService } from '../../services/ocean-engine-app.service'
import type {
  OceanEngineApp,
  OceanEngineAppCreateRequest,
  OceanEngineAppUpdateRequest
} from '../../types/ocean-engine-app.types'

type FormState = {
  app_code: string
  app_id: string
  app_secret: string
  redirect_uri: string
  remark: string
  status: string
  weight: number
  is_active: boolean
}

const defaultForm: FormState = {
  app_code: '',
  app_id: '',
  app_secret: '',
  redirect_uri: '',
  remark: '',
  status: 'active',
  weight: 100,
  is_active: true
}

export const OceanEngineAppsPage: React.FC = () => {
  const [items, setItems] = useState<OceanEngineApp[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<OceanEngineApp | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm)

  const loadApps = async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await oceanEngineAppService.listApps(false)
      setItems(result.items)
    } catch (error: any) {
      toast.error(error?.message || '加载 App 列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadApps()
  }, [])

  const openCreate = (): void => {
    setEditing(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  const openEdit = (item: OceanEngineApp): void => {
    setEditing(item)
    setForm({
      app_code: item.app_code,
      app_id: item.app_id,
      app_secret: '',
      redirect_uri: item.redirect_uri,
      remark: item.remark || '',
      status: item.status,
      weight: item.weight,
      is_active: item.is_active
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (): Promise<void> => {
    if (!form.app_code.trim() || !form.app_id.trim() || !form.redirect_uri.trim()) {
      toast.error('请填写 app_code、app_id 和 redirect_uri')
      return
    }
    if (!editing && !form.app_secret.trim()) {
      toast.error('创建时必须填写 app_secret')
      return
    }

    setSaving(true)
    try {
      if (editing) {
        const payload: OceanEngineAppUpdateRequest = {
          app_id: form.app_id,
          redirect_uri: form.redirect_uri,
          remark: form.remark || undefined,
          status: form.status,
          weight: Number(form.weight),
          is_active: form.is_active
        }
        if (form.app_secret.trim()) {
          payload.app_secret = form.app_secret.trim()
        }
        await oceanEngineAppService.updateApp(editing.app_code, payload)
        toast.success('App 更新成功')
      } else {
        const payload: OceanEngineAppCreateRequest = {
          app_code: form.app_code.trim(),
          app_id: form.app_id.trim(),
          app_secret: form.app_secret.trim(),
          redirect_uri: form.redirect_uri.trim(),
          remark: form.remark || undefined,
          status: form.status,
          weight: Number(form.weight),
          is_active: form.is_active
        }
        await oceanEngineAppService.createApp(payload)
        toast.success('App 创建成功')
      }
      setDialogOpen(false)
      setForm(defaultForm)
      setEditing(null)
      await loadApps()
    } catch (error: any) {
      toast.error(error?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (appCode: string): Promise<void> => {
    if (!window.confirm(`确认删除 App ${appCode} 吗？`)) return
    try {
      await oceanEngineAppService.deleteApp(appCode)
      toast.success('App 已删除')
      await loadApps()
    } catch (error: any) {
      toast.error(error?.message || '删除失败')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">授权端口管理</h1>
          <p className="text-sm text-muted-foreground">
            管理多套 OceanEngine 开放平台 App，用于多 App OAuth 和容量分流。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadApps()} disabled={loading}>
            <RefreshCw className={`mr-2 w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 w-4 h-4" />
            新建 App
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-16 text-center text-muted-foreground">
              暂无 App 配置
            </CardContent>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.app_code} className="border-border/60">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Shield className="w-4 h-4 text-primary" />
                      {item.app_code}
                    </CardTitle>
                    <CardDescription>{item.remark || '未设置备注'}</CardDescription>
                  </div>
                  <div
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      item.is_active && item.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-amber-500/10 text-amber-600'
                    }`}
                  >
                    {item.is_active ? item.status : 'disabled'}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <KeyRound className="w-4 h-4" />
                  <span className="font-mono">{item.app_id}</span>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground break-all">
                  {item.redirect_uri}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>权重 {item.weight}</span>
                  <span>{new Date(item.created_at).toLocaleString()}</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEdit(item)}
                  >
                    <Edit className="mr-2 w-4 h-4" />
                    编辑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-600"
                    onClick={() => void handleDelete(item.app_code)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑 App' : '新建 App'}</DialogTitle>
            <DialogDescription>填写 OceanEngine 开放平台应用信息。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="app_code">App Code</Label>
              <Input
                id="app_code"
                value={form.app_code}
                disabled={!!editing}
                onChange={(e) => setForm((prev) => ({ ...prev, app_code: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="app_id">App ID</Label>
              <Input
                id="app_id"
                value={form.app_id}
                onChange={(e) => setForm((prev) => ({ ...prev, app_id: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="app_secret">App Secret {editing ? '(留空表示不修改)' : ''}</Label>
              <Input
                id="app_secret"
                type="password"
                value={form.app_secret}
                onChange={(e) => setForm((prev) => ({ ...prev, app_secret: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="redirect_uri">Redirect URI</Label>
              <Input
                id="redirect_uri"
                value={form.redirect_uri}
                onChange={(e) => setForm((prev) => ({ ...prev, redirect_uri: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="remark">备注</Label>
              <Input
                id="remark"
                value={form.remark}
                onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="weight">权重</Label>
              <Input
                id="weight"
                type="number"
                value={form.weight}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, weight: Number(e.target.value || 100) }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">启用状态</div>
                <div className="text-xs text-muted-foreground">关闭后该 App 不参与授权和分流</div>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
