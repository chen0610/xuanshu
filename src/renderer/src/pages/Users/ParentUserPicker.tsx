import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Label } from '../../components/common'
import { userService } from '../../services/user.service'
import type { ParentUserCandidate, UserRole } from '../../types/user.types'

const ROLE_LABEL: Record<UserRole, string> = {
  admin: '管理员',
  user: '普通用户',
  manager: '团队管理员'
}

function formatCandidateLabel(u: ParentUserCandidate): string {
  const display = (u.name && u.name.trim()) || u.username
  return `${display} (@${u.username}) · ${ROLE_LABEL[u.role]}`
}

export interface ParentUserPickerProps {
  valueId: number | null
  valueLabel: string
  onChange: (id: number | null, label: string) => void
  /** 排除的用户（如正在编辑的用户，避免把自己选为上级） */
  excludeUserId?: number
  disabled?: boolean
  idPrefix?: string
}

export function ParentUserPicker({
  valueId,
  valueLabel,
  onChange,
  excludeUserId,
  disabled,
  idPrefix = 'parent'
}: ParentUserPickerProps): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [debounced, setDebounced] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(draft), 280)
    return () => window.clearTimeout(t)
  }, [draft])

  const candidatesQuery = useQuery({
    queryKey: ['parent-candidates', debounced, excludeUserId],
    queryFn: () =>
      userService.searchParentCandidates({
        search: debounced.trim() || undefined,
        exclude_user_id: excludeUserId,
        limit: 30
      }),
    enabled: panelOpen && !disabled
  })

  const closePanel = useCallback(() => setPanelOpen(false), [])

  useEffect(() => {
    if (!panelOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        closePanel()
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [panelOpen, closePanel])

  const pick = (u: ParentUserCandidate): void => {
    onChange(u.id, formatCandidateLabel(u))
    setDraft('')
    setDebounced('')
    closePanel()
  }

  const clear = (): void => {
    onChange(null, '')
    setDraft('')
    setDebounced('')
    closePanel()
  }

  return (
    <div ref={wrapRef} className="relative grid gap-2">
      <Label htmlFor={`${idPrefix}-search`}>上级用户（可选）</Label>
      {valueId != null && (
        <div className="bg-muted/40 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate" title={valueLabel}>
            {valueLabel || `用户 #${valueId}`}
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 px-2" onClick={clear} disabled={disabled}>
            清除
          </Button>
        </div>
      )}
      <Input
        id={`${idPrefix}-search`}
        placeholder={
          valueId != null
            ? '更换上级：输入姓名或用户名…'
            : '输入姓名或用户名搜索（管理员 / 团队管理员）…'
        }
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setPanelOpen(true)}
        autoComplete="off"
      />
      {panelOpen && !disabled && (
        <ul className="bg-popover absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-auto rounded-md border py-1 text-sm shadow-md">
          {candidatesQuery.isLoading && (
            <li className="text-muted-foreground px-3 py-2">搜索中…</li>
          )}
          {candidatesQuery.isError && (
            <li className="text-destructive px-3 py-2">加载失败</li>
          )}
          {!candidatesQuery.isLoading &&
            !candidatesQuery.isError &&
            (candidatesQuery.data?.length ?? 0) === 0 && (
              <li className="text-muted-foreground px-3 py-2">无匹配用户</li>
            )}
          {candidatesQuery.data?.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="hover:bg-accent flex w-full cursor-pointer flex-col items-start gap-0.5 px-3 py-2 text-left"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(u)}
              >
                <span className="font-medium">{(u.name && u.name.trim()) || u.username}</span>
                <span className="text-muted-foreground text-xs">
                  @{u.username} · {ROLE_LABEL[u.role]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
