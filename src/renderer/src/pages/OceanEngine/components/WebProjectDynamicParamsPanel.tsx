import React, { useMemo } from 'react'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ClipboardPaste,
  ListChecks,
  Plus,
  Trash2
} from 'lucide-react'
import { Button, Input, Textarea } from '../../../components/ui'
import { cn } from '../../../lib/utils'
import type { OceanEngineWebProjectDynamicParamConfigItem } from '../../../services/ocean-engine.service'

export interface WebProjectDynamicParamFormItem {
  key: string
  uniform: boolean
  value: string
  valuesText: string
}

interface WebProjectDynamicParamsPanelProps {
  payload: Record<string, unknown> | null
  accountIds: string[]
  configs: OceanEngineWebProjectDynamicParamConfigItem[]
  availableParams: OceanEngineWebProjectDynamicParamConfigItem[]
  value: WebProjectDynamicParamFormItem[]
  pasteText: string
  pasteRows: string[][]
  pasteColumnCount: number
  pasteColumnByKey: Record<string, number>
  onAddParam: (key: string) => void
  onUpdateParam: (key: string, patch: Partial<WebProjectDynamicParamFormItem>) => void
  onRemoveParam: (key: string) => void
  onMoveParam: (fromKey: string, toKey: string) => void
  onPasteTextChange: (value: string) => void
  onPasteColumnChange: (key: string, columnIndex: number) => void
  onApplyPaste: () => void
}

function formatPayloadPreview(value: unknown): string {
  if (value == null || value === '') return '空'
  if (typeof value === 'string') return value.length > 48 ? `${value.slice(0, 48)}...` : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    const text = JSON.stringify(value)
    return text.length > 48 ? `${text.slice(0, 48)}...` : text
  } catch {
    return String(value)
  }
}

function parseValueLines(text: string): string[] {
  const normalized = text.replace(/(?:\r?\n)+$/, '')
  if (!normalized.trim()) return []
  return normalized.split(/\r?\n/).map((line) => line.trim())
}

function getParamStatus(
  item: WebProjectDynamicParamFormItem,
  accountCount: number
): {
  ok: boolean
  label: string
} {
  if (item.uniform) {
    return item.value.trim()
      ? { ok: true, label: '已填写' }
      : { ok: false, label: '待填写' }
  }
  if (accountCount === 0) return { ok: false, label: '缺少账户' }
  const lines = parseValueLines(item.valuesText)
  if (lines.length !== accountCount) return { ok: false, label: `${lines.length}/${accountCount} 行` }
  if (lines.some((line) => !line)) return { ok: false, label: '存在空行' }
  return { ok: true, label: `${lines.length}/${accountCount} 行` }
}

const FIELD_TAG_STYLES = [
  { backgroundColor: '#e8f2ff', borderColor: '#8fb9e8', color: '#17456f' },
  { backgroundColor: '#e7f6ef', borderColor: '#84c7a3', color: '#15533a' },
  { backgroundColor: '#fff2d8', borderColor: '#e0ad55', color: '#704315' },
  { backgroundColor: '#ffe8ee', borderColor: '#de8ba1', color: '#74263a' },
  { backgroundColor: '#e3f7f8', borderColor: '#7abec4', color: '#164e56' },
  { backgroundColor: '#eef7d8', borderColor: '#a9c96a', color: '#455d12' }
]

function getFieldTagStyle(index: number): React.CSSProperties {
  return FIELD_TAG_STYLES[index % FIELD_TAG_STYLES.length]
}

export const WebProjectDynamicParamsPanel: React.FC<WebProjectDynamicParamsPanelProps> = ({
  payload,
  accountIds,
  configs,
  availableParams,
  value,
  pasteText,
  pasteRows,
  pasteColumnCount,
  pasteColumnByKey,
  onAddParam,
  onUpdateParam,
  onRemoveParam,
  onMoveParam,
  onPasteTextChange,
  onPasteColumnChange,
  onApplyPaste
}) => {
  const configByKey = useMemo(
    () => new Map(configs.map((item) => [item.key, item])),
    [configs]
  )
  const tagStyleByKey = useMemo(
    () => new Map(configs.map((item, index) => [item.key, getFieldTagStyle(index)])),
    [configs]
  )
  const nonUniformParams = useMemo(() => value.filter((item) => !item.uniform), [value])
  const readyCount = value.filter((item) => getParamStatus(item, accountIds.length).ok).length
  const nameParamEnabled = value.some((item) => item.key === 'name')
  const selectedColumnIndexes = nonUniformParams.map(
    (item, index) => pasteColumnByKey[item.key] ?? index
  )
  const duplicatePasteColumns =
    selectedColumnIndexes.length > 1 &&
    new Set(selectedColumnIndexes).size !== selectedColumnIndexes.length
  const pasteRowMismatch =
    pasteRows.length > 0 && accountIds.length > 0 && pasteRows.length !== accountIds.length
  const pastePreviewRows = pasteRows.slice(0, 3)

  return (
    <section className="space-y-3 rounded-lg border bg-background/70 p-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium">动态覆盖规则</p>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
              添加需要覆盖的字段，选择统一值或按账户逐行填写。
            </p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {value.length === 0
            ? '未添加覆盖字段'
            : `${readyCount}/${value.length} 个字段已就绪，逐账户字段 ${nonUniformParams.length} 个`}
        </p>
      </div>

      {nameParamEnabled && (
        <div className="border-l-2 border-primary/40 pl-3 text-[11px] leading-4 text-muted-foreground">
          已覆盖项目名称 name，下方“网页项目名称”前缀会隐藏，最终名称以此处配置为准。
        </div>
      )}

      <div className="rounded-md border bg-muted/10 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-medium">选择要覆盖的字段</p>
          <p className="text-[11px] text-muted-foreground">只显示可添加字段</p>
        </div>
        {!payload ? (
          <div className="rounded-md border border-dashed bg-background/60 px-3 py-3 text-[11px] text-muted-foreground">
            先捕获项目数据包后，字段会显示在这里。
          </div>
        ) : availableParams.length === 0 ? (
          <div className="rounded-md border border-dashed bg-background/60 px-3 py-3 text-[11px] text-muted-foreground">
            没有更多可覆盖字段。
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableParams.map((item, index) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onAddParam(item.key)}
                title={`添加 ${item.label} (${item.key})，当前值：${
                  payload ? formatPayloadPreview(payload[item.key]) : '空'
                }`}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-[box-shadow,transform] hover:shadow-sm active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                )}
                style={tagStyleByKey.get(item.key) ?? getFieldTagStyle(index)}
              >
                <Plus className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {value.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground">
          选择一个字段后，会在这里编辑它的覆盖值。
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((item, index) => {
            const config = configByKey.get(item.key)
            const label = config?.label ?? item.key
            const status = getParamStatus(item, accountIds.length)
            return (
              <div key={item.key} className="overflow-hidden rounded-lg border bg-background">
                <div className="flex flex-col gap-2 border-b bg-muted/10 px-3 py-2.5 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex h-7 max-w-full items-center rounded-full border px-2.5 text-xs font-semibold"
                        style={tagStyleByKey.get(item.key) ?? getFieldTagStyle(index)}
                      >
                        {label}
                      </span>
                      <span className="max-w-full truncate rounded-md border bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground">
                        {item.key}
                      </span>
                      <span
                        className={cn(
                          'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold',
                          status.ok
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-amber-700 bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
                        )}
                      >
                        {status.ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5" />
                        )}
                        {status.label}
                      </span>
                    </div>
                    {payload && (
                      <p className="mt-1 max-w-[520px] truncate text-[11px] text-muted-foreground">
                        原值：{formatPayloadPreview(payload[item.key])}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1 self-start rounded-md border bg-background p-0.5 md:self-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => index > 0 && onMoveParam(item.key, value[index - 1].key)}
                      disabled={index === 0}
                      className="h-7 w-7 p-0"
                      title="上移"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        index < value.length - 1 && onMoveParam(item.key, value[index + 1].key)
                      }
                      disabled={index === value.length - 1}
                      className="h-7 w-7 p-0"
                      title="下移"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveParam(item.key)}
                      className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                      title="移除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 p-3 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-start">
                  <div className="inline-flex w-fit rounded-md border bg-muted/30 p-0.5">
                    <button
                      type="button"
                      onClick={() => onUpdateParam(item.key, { uniform: true })}
                      className={cn(
                        'h-7 rounded px-2 text-[11px] transition-colors',
                        item.uniform
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      统一值
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateParam(item.key, { uniform: false })}
                      className={cn(
                        'h-7 rounded px-2 text-[11px] transition-colors',
                        !item.uniform
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      逐账户
                    </button>
                  </div>

                  {item.uniform ? (
                    <Input
                      value={item.value}
                      onChange={(event) => onUpdateParam(item.key, { value: event.target.value })}
                      placeholder={`请输入${label}统一值`}
                      className="h-9 text-xs"
                    />
                  ) : (
                    <Textarea
                      className="min-h-[58px] resize-y font-mono text-xs"
                      value={item.valuesText}
                      onChange={(event) =>
                        onUpdateParam(item.key, { valuesText: event.target.value })
                      }
                      placeholder={`每行一个值，对应 ${accountIds.length || 0} 个广告主账户`}
                      spellCheck={false}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <details className="group rounded-md border bg-muted/10">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs marker:hidden">
          <span className="inline-flex min-w-0 items-center gap-2">
            <ClipboardPaste className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="font-medium">批量粘贴逐账户值</span>
            <span className="text-muted-foreground">
              {nonUniformParams.length === 0
                ? '暂无逐账户字段'
                : pasteRows.length > 0
                  ? `${pasteRows.length} 行 / ${pasteColumnCount} 列`
                  : `${nonUniformParams.length} 个字段可录入`}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>

        <div className="space-y-3 border-t px-3 py-3">
          {nonUniformParams.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">
              将某个覆盖字段切换为“逐账户”后，可以在这里从表格批量粘贴多列数据。
            </div>
          ) : (
            <>
              <Textarea
                className="min-h-[78px] resize-y font-mono text-xs"
                value={pasteText}
                onChange={(event) => onPasteTextChange(event.target.value)}
                placeholder="从表格复制多列数据后直接粘贴；可在下方选择每个字段对应哪一列"
                spellCheck={false}
              />
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span
                  className={cn(
                    pasteRowMismatch && 'text-amber-700 dark:text-amber-300'
                  )}
                >
                  已识别 {pasteRows.length} 行 / {pasteColumnCount} 列，账户 {accountIds.length} 行
                </span>
                {duplicatePasteColumns && (
                  <span className="text-amber-700 dark:text-amber-300">存在重复列映射</span>
                )}
              </div>
              {pasteColumnCount > 0 && (
                <div className="grid gap-2 md:grid-cols-2">
                  {nonUniformParams.map((item, index) => {
                    const config = configByKey.get(item.key)
                    const label = config?.label ?? item.key
                    const selectedColumn = pasteColumnByKey[item.key] ?? index
                    return (
                      <label key={item.key} className="space-y-1 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">{label}</span>
                        <select
                          className="h-8 w-full rounded-md border bg-background px-2 text-xs text-foreground"
                          value={selectedColumn}
                          onChange={(event) =>
                            onPasteColumnChange(item.key, Number(event.target.value))
                          }
                        >
                          {Array.from({ length: pasteColumnCount }, (_, columnIndex) => (
                            <option key={columnIndex} value={columnIndex}>
                              第 {columnIndex + 1} 列：
                              {pasteRows[0]?.[columnIndex]?.slice(0, 18) || '空'}
                            </option>
                          ))}
                        </select>
                      </label>
                    )
                  })}
                </div>
              )}
              {pastePreviewRows.length > 0 && (
                <div className="overflow-x-auto rounded-md border bg-background">
                  <table className="w-full min-w-[520px] text-xs">
                    <thead className="bg-muted/30 text-left text-muted-foreground">
                      <tr>
                        <th className="p-2 font-medium">广告主 ID</th>
                        {nonUniformParams.map((item) => {
                          const config = configByKey.get(item.key)
                          return (
                            <th key={item.key} className="p-2 font-medium">
                              {config?.label ?? item.key}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {pastePreviewRows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t">
                          <td className="p-2 font-mono text-muted-foreground">
                            {accountIds[rowIndex] ?? `第 ${rowIndex + 1} 行`}
                          </td>
                          {nonUniformParams.map((item, index) => {
                            const columnIndex = pasteColumnByKey[item.key] ?? index
                            return (
                              <td key={item.key} className="max-w-[220px] truncate p-2">
                                {row[columnIndex] || '空'}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Button type="button" variant="outline" size="sm" onClick={onApplyPaste}>
                确认批量录入
              </Button>
            </>
          )}
        </div>
      </details>
    </section>
  )
}
