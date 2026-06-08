import type { AdCleanupFilter } from '../../../../services/ocean-engine.service'

export interface AdCleanupConfigSnapshot {
  rootEbpId: string
  ebpId: string
  accountScope: 'all' | 'partial'
  accountIds: string
  filter: AdCleanupFilter
  filterEnabled: boolean
  durationHours: string
}

export function buildAdCleanupConfigFingerprint(snapshot: AdCleanupConfigSnapshot): string {
  const filter = snapshot.filter
  return JSON.stringify({
    rootEbpId: snapshot.rootEbpId.trim(),
    ebpId: snapshot.ebpId.trim(),
    accountScope: snapshot.accountScope,
    accountIds: snapshot.accountIds.trim(),
    durationHours: snapshot.durationHours.trim(),
    filterEnabled: snapshot.filterEnabled,
    startDate: filter.start_date,
    endDate: filter.end_date,
    spendValue: snapshot.filterEnabled ? filter.spend_value : undefined,
    spendOperator: filter.spend_operator,
    conversionNumValue: snapshot.filterEnabled ? filter.conversion_num_value : undefined,
    conversionNumOperator: filter.conversion_num_operator,
    deliveryMode: filter.delivery_mode,
    keyword: snapshot.filterEnabled ? (filter.keyword || '').trim() : '',
    adStatus: filter.ad_status
  })
}
