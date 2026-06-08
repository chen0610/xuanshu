import type { ChangduSeriesDbItem, ChangduSeriesRow } from '../../services/changdu.service'

export const normalizeBookId = (bookId: unknown): string => {
  if (bookId == null) return ''
  if (typeof bookId === 'number') {
    if (!Number.isSafeInteger(bookId)) return ''
    return String(bookId)
  }
  const text = String(bookId).trim()
  if (!text || text === 'undefined' || text === 'null') return ''
  return text
}

export const normalizeCustomAppendLine = (line: string): string =>
  line.trim().replace(/[\t]+/g, ',').replace(/\s+/g, ',').replace(/,+/g, ',').replace(/^,|,$/g, '')

const emptySeriesRow = (seriesName: string, bookId: string, playletId: string): ChangduSeriesRow => ({
  book_id: bookId,
  playlet_id: playletId,
  series_name: seriesName,
  thumb_url: '',
  create_time: '',
  category: '',
  gender: '',
  creation_status: '',
  episode_amount: '',
  estimate_publish_time: '',
  publish_time: '',
  publish_status: '已发布',
  delivery_status: '可投放',
  permission_status: ''
})

export const parseCustomAppendRows = (rawText: string): { rows: ChangduSeriesRow[]; errors: string[] } => {
  const rows: ChangduSeriesRow[] = []
  const errors: string[] = []

  rawText
    .split(/\r?\n/)
    .map(normalizeCustomAppendLine)
    .filter(Boolean)
    .forEach((line, index) => {
      const parts = line.split(',').map((item) => item.trim())
      if (parts.length !== 3 || parts.some((item) => !item)) {
        errors.push(`第 ${index + 1} 行格式错误：${line}`)
        return
      }
      rows.push(emptySeriesRow(parts[0], parts[1], parts[2]))
    })

  return { rows, errors }
}

export const toChangduSeriesRow = (row: ChangduSeriesDbItem): ChangduSeriesRow => ({
  book_id: normalizeBookId(row.book_id),
  playlet_id: normalizeBookId(row.playlet_id),
  series_name: row.series_name || '',
  thumb_url: '',
  create_time: row.create_time || '',
  category: row.category || '',
  gender: row.gender || '',
  creation_status: row.creation_status || '',
  episode_amount: row.episode_amount || '',
  estimate_publish_time: row.estimate_publish_time || '',
  publish_time: row.publish_time || '',
  publish_status: row.publish_status || '',
  delivery_status: row.delivery_status || '',
  permission_status: row.permission_status || ''
})

export const getSeriesRowKey = (row: ChangduSeriesRow): string =>
  normalizeBookId(row.book_id) || `${row.series_name}-${row.create_time}-${normalizeBookId(row.playlet_id)}`

export const getBatchAppendRowKey = (row: ChangduSeriesRow): string =>
  `${normalizeBookId(row.book_id)}::${normalizeBookId(row.playlet_id)}`

export const formatBatchAppendRowForCopy = (row: ChangduSeriesRow): string =>
  `${row.series_name || ''},${normalizeBookId(row.book_id)},${normalizeBookId(row.playlet_id)}`
