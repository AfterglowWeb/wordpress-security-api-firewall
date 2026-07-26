import type { IpEntry } from '@services/ip';
import { apiRequest } from '@services/api';
import { __ } from '@wordpress/i18n';

export interface DesiredIpEntry {
  ip: string;
  referrer: string | null;
}

interface IpEntriesDiff {
  toDelete: IpEntry[];
  toAdd: DesiredIpEntry[];
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
  desired: DesiredIpEntry[]
): IpEntriesDiff {
  const desiredMap = new Map<string, string | null>();
  desired.forEach(({ ip, referrer }) => {
    const trimmedIp = ip.trim();
    if (!trimmedIp) return;
    desiredMap.set(trimmedIp, referrer?.trim() || null);
  });

  const toDelete = ipEntries.filter((e) => {
    if (!desiredMap.has(e.ip)) return true;
    return desiredMap.get(e.ip) !== (e.referrer ?? null);
  });

  const matchedIps = new Set(
    ipEntries
      .filter((e) => desiredMap.has(e.ip) && desiredMap.get(e.ip) === (e.referrer ?? null))
      .map((e) => e.ip)
  );

  const toAdd: DesiredIpEntry[] = [];
  desiredMap.forEach((referrer, ip) => {
    if (!matchedIps.has(ip)) toAdd.push({ ip, referrer });
  });

  return { toDelete, toAdd };
}

export async function syncUserIpEntries(
  userId: number,
  diff: IpEntriesDiff
): Promise<SyncIpEntriesResult> {
  const { toDelete, toAdd } = diff;

  if (toDelete.length === 0 && toAdd.length === 0) {
    return { ok: true, entries: [], addCount: 0, deleteCount: 0, updateCount: 0 };
  }

  let result: SyncIpEntriesResponse;

  try {
    result = await apiRequest<SyncIpEntriesResponse>('bromate_sync_ip_entries', {
      add_entries: toAdd, // [{ ip, referrer }] — referrer désormais par entrée, pas partagé
      delete_ips: toDelete.map((e) => e.ip),
      list_type: 'whitelist',
      user_id: userId,
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

  const { IpAPI } = await import('@services/ip');
  const fresh = await IpAPI.getUserEntries(userId);

  return {
    ok: true,
    entries: fresh.entries,
    deleteCount: result.delete_count ?? 0,
    addCount: result.add_count ?? 0,
    updateCount: result.update_count ?? 0,
  };
}