import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Pencil, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label
} from '../../components/common'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '../../hooks/useAuth'
import { userService } from '../../services/user.service'
import type { User, UserCreate, UserRole, UserUpdate } from '../../types/user.types'
import { ParentUserPicker } from './ParentUserPicker'

const ROLE_LABEL: Record<UserRole, string> = {
  admin: '管理员',
  user: '普通用户',
  manager: '团队管理员'
}

export const UsersPage = (): React.JSX.Element => {
  const { user: authUser } = useAuth()
  const queryClient = useQueryClient()
  const isAdmin = authUser?.role === 'admin'
  const isManager = authUser?.role === 'manager'

  const [page, setPage] = useState(1)
  const pageSize = 20
  const [search, setSearch] = useState('')
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>(undefined)
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)

  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formName, setFormName] = useState('')
  const [formRole, setFormRole] = useState<UserRole>('user')
  const [formParentUserId, setFormParentUserId] = useState<number | null>(null)
  const [formParentLabel, setFormParentLabel] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)

  const listQuery = useQuery({
    queryKey: ['users', page, pageSize, search, isActiveFilter, ...(isAdmin ? [roleFilter] : [])],
    queryFn: () =>
      userService.getUsers({
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        is_active: isActiveFilter,
        // 团队管理员后端固定只返回下属普通用户，不传 role
        role: isAdmin ? roleFilter || undefined : undefined,
        sort_by: 'id',
        sort_order: 'desc'
      }),
    enabled: !!(isAdmin || isManager)
  })

  const resetForm = (): void => {
    setFormUsername('')
    setFormPassword('')
    setFormEmail('')
    setFormName('')
    setFormRole('user')
    setFormParentUserId(null)
    setFormParentLabel('')
    setFormIsActive(true)
  }

  const openCreate = (): void => {
    resetForm()
    setCreateOpen(true)
  }

  const openEdit = (u: User): void => {
    setEditUser(u)
    setFormUsername(u.username)
    setFormPassword('')
    setFormEmail(u.email ?? '')
    setFormName(u.name ?? '')
    setFormRole(u.role)
    setFormParentUserId(u.parent_user_id ?? null)
    setFormParentLabel('')
    if (u.parent_user_id != null) {
      void userService
        .getUserById(u.parent_user_id)
        .then((p) => {
          const display = (p.name && p.name.trim()) || p.username
          setFormParentLabel(`${display} (@${p.username}) · ${ROLE_LABEL[p.role]}`)
        })
        .catch(() => {
          setFormParentLabel(`用户 #${u.parent_user_id}`)
        })
    }
    setFormIsActive(u.is_active)
  }

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['users'] })
  }

  const createMutation = useMutation({
    mutationFn: (body: UserCreate) => userService.createUser(body),
    onSuccess: () => {
      toast.success('用户已创建')
      setCreateOpen(false)
      resetForm()
      invalidate()
    },
    onError: (e: { detail?: string; message?: string }) => {
      toast.error(e.detail || e.message || '创建失败')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: UserUpdate }) => userService.updateUser(id, body),
    onSuccess: () => {
      toast.success('已保存')
      setEditUser(null)
      invalidate()
    },
    onError: (e: { detail?: string; message?: string }) => {
      toast.error(e.detail || e.message || '保存失败')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => userService.deleteUser(id),
    onSuccess: () => {
      toast.success('已删除')
      invalidate()
    },
    onError: (e: { detail?: string; message?: string }) => {
      toast.error(e.detail || e.message || '删除失败')
    }
  })

  const handleCreateSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!formUsername.trim() || !formPassword) {
      toast.error('请填写用户名与密码')
      return
    }
    const body: UserCreate = {
      username: formUsername.trim(),
      password: formPassword,
      name: formName.trim() || undefined,
      email: formEmail.trim() || undefined
    }
    if (isAdmin) {
      body.role = formRole
      body.parent_user_id = formParentUserId
    }
    createMutation.mutate(body)
  }

  const handleEditSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!editUser) return
    const body: UserUpdate = {
      username: formUsername.trim(),
      name: formName.trim() || undefined,
      email: formEmail.trim() || undefined,
      is_active: formIsActive
    }
    if (formPassword.trim()) {
      body.password = formPassword
    }
    if (isAdmin) {
      body.role = formRole
      body.parent_user_id = formParentUserId
    }
    updateMutation.mutate({ id: editUser.id, body })
  }

  const handleDelete = (u: User): void => {
    if (!window.confirm(`确定删除用户「${u.username}」？`)) return
    deleteMutation.mutate(u.id)
  }

  const meta = listQuery.data?.meta
  const items = listQuery.data?.items ?? []

  const subtitle = useMemo(() => {
    if (!meta) return ''
    return `共 ${meta.total} 条 · 第 ${meta.page}/${Math.max(meta.total_pages, 1)} 页`
  }, [meta])

  return (
    <div>
      <motion.div
        className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="mb-2 text-4xl font-bold">
            用户 <span className="text-primary">管理</span>
          </h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        <Button type="button" onClick={openCreate}>
          <UserPlus className="mr-2 h-4 w-4" />
          添加用户
        </Button>
      </motion.div>

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="grid flex-1 gap-2 sm:max-w-xs">
            <Label htmlFor="user-search">搜索</Label>
            <Input
              id="user-search"
              placeholder="用户名 / 姓名 / 邮箱"
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
            />
          </div>
          <div className="grid gap-2 sm:w-40">
            <Label>状态</Label>
            <select
              className="border-input bg-background h-10 rounded-md border px-3 text-sm"
              value={isActiveFilter === undefined ? '' : isActiveFilter ? '1' : '0'}
              onChange={(ev) => {
                const v = ev.target.value
                setIsActiveFilter(v === '' ? undefined : v === '1')
                setPage(1)
              }}
            >
              <option value="">全部</option>
              <option value="1">启用</option>
              <option value="0">停用</option>
            </select>
          </div>
          {isAdmin && (
            <div className="grid gap-2 sm:w-44">
              <Label>角色</Label>
              <select
                className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                value={roleFilter}
                onChange={(ev) => {
                  setRoleFilter((ev.target.value || '') as UserRole | '')
                  setPage(1)
                }}
              >
                <option value="">全部</option>
                <option value="admin">管理员</option>
                <option value="manager">团队管理员</option>
                <option value="user">普通用户</option>
              </select>
            </div>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setPage(1)
              void listQuery.refetch()
            }}
          >
            查询
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <p className="text-muted-foreground py-8 text-center">加载中…</p>
          ) : listQuery.isError ? (
            <p className="text-destructive py-8 text-center">加载失败</p>
          ) : (
            <div className="space-y-3">
              {items.map((row, index) => (
                <motion.div
                  key={row.id}
                  className="hover:bg-accent flex flex-col gap-3 rounded-md border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="from-primary to-purple-500 text-primary-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-lg font-bold">
                      {(row.name || row.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.name || row.username}</p>
                      <p className="text-muted-foreground truncate text-sm">{row.email || '—'}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        @{row.username} · {ROLE_LABEL[row.role]}
                        {row.parent_user_id != null ? ` · 上级 ID ${row.parent_user_id}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        row.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                      }`}
                    >
                      {row.is_active ? '启用' : '停用'}
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      编辑
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(row)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      删除
                    </Button>
                  </div>
                </motion.div>
              ))}
              {items.length === 0 && (
                <p className="text-muted-foreground py-8 text-center">暂无数据</p>
              )}
            </div>
          )}

          {meta && meta.total_pages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!meta.has_prev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!meta.has_next}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="overflow-visible sm:max-w-md">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle>新建用户</DialogTitle>
            </DialogHeader>
            <div className="max-h-[min(70vh,520px)] overflow-y-auto overflow-x-visible">
              <div className="grid gap-3 py-4">
              <div className="grid gap-2">
                <Label htmlFor="c-user">用户名</Label>
                <Input id="c-user" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="c-pass">密码</Label>
                <Input
                  id="c-pass"
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="c-name">姓名</Label>
                <Input id="c-name" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="c-email">邮箱</Label>
                <Input id="c-email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
              </div>
              {isAdmin && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="c-role">角色</Label>
                    <select
                      id="c-role"
                      className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value as UserRole)}
                    >
                      <option value="user">普通用户</option>
                      <option value="manager">团队管理员</option>
                      <option value="admin">管理员</option>
                    </select>
                  </div>
                  <ParentUserPicker
                    idPrefix="c-parent"
                    valueId={formParentUserId}
                    valueLabel={formParentLabel}
                    onChange={(id, label) => {
                      setFormParentUserId(id)
                      setFormParentLabel(label)
                    }}
                  />
                </>
              )}
              {isManager && (
                <p className="text-muted-foreground text-xs">团队管理员创建的用户将自动归属为您，角色为普通用户。</p>
              )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '提交中…' : '创建'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="overflow-visible sm:max-w-md">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>编辑用户</DialogTitle>
            </DialogHeader>
            <div className="max-h-[min(70vh,520px)] overflow-y-auto overflow-x-visible">
              <div className="grid gap-3 py-4">
              <div className="grid gap-2">
                <Label htmlFor="e-user">用户名</Label>
                <Input id="e-user" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="e-pass">新密码（留空不改）</Label>
                <Input
                  id="e-pass"
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="e-name">姓名</Label>
                <Input id="e-name" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="e-email">邮箱</Label>
                <Input id="e-email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="e-active"
                  checked={formIsActive}
                  onCheckedChange={(v) => setFormIsActive(v === true)}
                />
                <Label htmlFor="e-active" className="cursor-pointer font-normal">
                  启用账户
                </Label>
              </div>
              {isAdmin && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="e-role">角色</Label>
                    <select
                      id="e-role"
                      className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value as UserRole)}
                    >
                      <option value="user">普通用户</option>
                      <option value="manager">团队管理员</option>
                      <option value="admin">管理员</option>
                    </select>
                  </div>
                  <ParentUserPicker
                    idPrefix="e-parent"
                    valueId={formParentUserId}
                    valueLabel={formParentLabel}
                    onChange={(id, label) => {
                      setFormParentUserId(id)
                      setFormParentLabel(label)
                    }}
                    excludeUserId={editUser?.id}
                  />
                </>
              )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                取消
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? '保存中…' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
