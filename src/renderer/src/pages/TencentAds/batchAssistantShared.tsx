import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, Loader2, X, XCircle } from 'lucide-react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui'
import { configService } from '../../services/config.service'

export interface TencentConfigOption {
  id: number
  cookie_name: string
  realname?: string
}

export interface TencentBatchLogEntry {
  message: string
  type: 'info' | 'success' | 'error'
  timestamp: Date
}

export function useTencentConfigs(): {
  configs: TencentConfigOption[]
  loading: boolean
  error: string
} {
  const [configs, setConfigs] = useState<TencentConfigOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadConfigs = async (): Promise<void> => {
      setLoading(true)
      try {
        const tencentConfigs = await configService.getConfigsBySource(2)
        setConfigs(tencentConfigs)
        setError('')
      } catch (err) {
        console.error('Failed to load configs:', err)
        setError('加载配置失败，请稍后重试')
      } finally {
        setLoading(false)
      }
    }

    loadConfigs()
  }, [])

  return { configs, loading, error }
}

interface TencentConfigSelectorProps {
  configs: TencentConfigOption[]
  loading: boolean
  selectedConfigId: number | null
  onSelect: (configId: number) => void
}

export const TencentConfigSelector: React.FC<TencentConfigSelectorProps> = ({
  configs,
  loading,
  selectedConfigId,
  onSelect
}) => {
  return (
    <div className="space-y-3">
      <div className="text-base font-semibold">选择账号配置 *</div>
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : configs.length === 0 ? (
        <div className="rounded-md border p-4 text-center text-muted-foreground">
          暂无可用账户配置，请先在配置中心添加腾讯账号的 Cookie 配置
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {configs.map((config) => (
            <motion.div
              key={config.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`cursor-pointer rounded-lg border p-4 transition-all ${
                selectedConfigId === config.id
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50'
              }`}
              onClick={() => onSelect(config.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                      selectedConfigId === config.id
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground/30'
                    }`}
                  >
                    {selectedConfigId === config.id && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{config.cookie_name}</div>
                    {config.realname ? (
                      <div className="truncate text-sm text-muted-foreground">{config.realname}</div>
                    ) : null}
                  </div>
                </div>
                {selectedConfigId === config.id ? (
                  <CheckCircle className="ml-2 h-5 w-5 flex-shrink-0 text-primary" />
                ) : null}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

interface TencentBatchLogPanelProps {
  logs: TencentBatchLogEntry[]
  isOpen: boolean
  isSubmitting: boolean
  title?: string
  description?: string
  onToggle: () => void
  onClear?: () => void
}

export const TencentBatchLogPanel: React.FC<TencentBatchLogPanelProps> = ({
  logs,
  isOpen,
  isSubmitting,
  title = '操作日志',
  description = '查看批量操作的执行过程和结果',
  onToggle,
  onClear
}) => {
  if (logs.length === 0 && !isSubmitting) {
    return null
  }

  return (
    <>
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="fixed bottom-6 right-6 z-50">
        <Button onClick={onToggle} size="lg" className="relative h-14 w-14 rounded-full p-0 shadow-lg">
          {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <CardTitle className="text-sm">日志</CardTitle>}
          {logs.length > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
              {logs.length}
            </span>
          ) : null}
        </Button>
      </motion.div>

      {isOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="fixed bottom-24 right-6 z-50 w-[500px] max-w-[calc(100vw-3rem)]"
        >
          <Card className="border-2 shadow-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription className="text-xs">{description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  {onClear && logs.length > 0 && !isSubmitting ? (
                    <Button variant="ghost" size="sm" onClick={onClear} className="h-8 text-xs">
                      清空
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={onToggle} className="h-8 w-8 p-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-[500px] overflow-y-auto rounded-lg border bg-muted/30">
                <div className="space-y-2 p-3 text-sm">
                  {logs.length === 0 && isSubmitting ? (
                    <div className="flex items-center gap-2 p-4 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>正在执行操作...</span>
                    </div>
                  ) : (
                    logs.map((log, index) => (
                      <motion.div
                        key={`${log.timestamp.getTime()}-${index}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={`flex items-start gap-3 rounded-md border p-3 ${
                          log.type === 'error'
                            ? 'border-destructive/20 bg-destructive/10 text-destructive'
                            : log.type === 'success'
                              ? 'border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400'
                              : 'border-border bg-muted/50 text-muted-foreground'
                        }`}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {log.type === 'error' ? (
                            <XCircle className="h-4 w-4" />
                          ) : log.type === 'success' ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <Loader2 className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="font-mono text-xs opacity-70">{log.timestamp.toLocaleTimeString()}</span>
                          </div>
                          <div className="break-words leading-relaxed">{log.message}</div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}
    </>
  )
}
