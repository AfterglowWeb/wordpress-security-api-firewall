import { __ } from '@wordpress/i18n';
import type { IpEntry } from '@services/ip';
import { IpAPI } from '@services/ip';
import { apiRequest } from '@services/api';

interface IpEntriesDiff {
  toDelete: IpEntry[];
  toAdd: string[];
  desiredReferrer: string | null;
}

interface SyncIpEntriesResult {
  ok: boolean;
  entries: IpEntry[];
  addCount: number;
  deleteCount: number;
  updateCount: number;
  error?: string;
}

interface SyncIpEntriesResponse {
  delete_count: number;
  add_count: number;
  update_count: number;
}

export function computeIpEntriesDiff(
  ipEntries: IpEntry[],
  ipListValue: string,
  ipListReferrer: string
): IpEntriesDiff {
  const desiredReferrer = ipListReferrer.trim() || null;
  const desiredLines = Array.from(
    new Set(ipListValue.split('\n').map((l) => l.trim()).filter(Boolean))
  );
  const desiredSet = new Set(desiredLines);

  const toDelete = ipEntries.filter(
    (e) => !desiredSet.has(e.ip) || (e.referrer ?? null) !== desiredReferrer
  );

  const keptIps = new Set(
    ipEntries
      .filter((e) => desiredSet.has(e.ip) && (e.referrer ?? null) === desiredReferrer)
      .map((e) => e.ip)
  );
  const toAdd = desiredLines.filter((ip) => !keptIps.has(ip));

  return { toDelete, toAdd, desiredReferrer };
}

export async function syncUserIpEntries(
  userId: number,
  diff: IpEntriesDiff
): Promise<SyncIpEntriesResult> {
  const { toDelete, toAdd, desiredReferrer } = diff;

  if (toDelete.length === 0 && toAdd.length === 0) {
    return { ok: true, entries: [], addCount: 0, deleteCount: 0, updateCount: 0 };
  }

  let result: SyncIpEntriesResponse;

  try {
    result = await apiRequest<SyncIpEntriesResponse>('bromate_sync_ip_entries', {
      add_ips: toAdd,
      delete_ips: toDelete.map((e) => e.ip),
      list_type: 'whitelist',
      user_id: userId,
      referrer: desiredReferrer,
    });
  } catch (error) {
    return {
      ok: false,
      entries: [],
      addCount: 0,
      deleteCount: 0,
      updateCount: 0,
      error: error instanceof Error ? error.message : __('Failed to sync IP entries', 'bromate-security-api-firewall'),
    };
  }

  const fresh = await IpAPI.getUserEntries(userId);

  return {
    ok: true,
    entries: fresh.entries,
    deleteCount: result.delete_count ?? 0,
    addCount: result.add_count ?? 0,
    updateCount: result.update_count ?? 0,
  };
}