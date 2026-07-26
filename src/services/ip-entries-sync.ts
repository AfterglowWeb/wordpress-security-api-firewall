import type { IpEntry } from '@services/ip';
import { apiRequest } from '@services/api';
import { __ } from '@wordpress/i18n';

export interface DesiredIpEntry {
  ip: string;
  referrer: string | null;
  expires_at: string | null;
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
  const desiredMap = new Map<string, { referrer: string | null; expires_at: string | null }>();
  desired.forEach(({ ip, referrer, expires_at }) => {
    const trimmedIp = ip.trim();
    if (!trimmedIp) return;
    desiredMap.set(trimmedIp, {
      referrer: referrer?.trim() || null,
      expires_at: expires_at?.trim() || null,
    });
  });

  const toDelete = ipEntries.filter((e) => {
    const desired = desiredMap.get(e.ip);
    if (!desired) return true;
    return desired.referrer !== (e.referrer ?? null) || desired.expires_at !== (e.expires_at ?? null);
  });

  const matchedIps = new Set(
    ipEntries
      .filter((e) => {
        const desired = desiredMap.get(e.ip);
        return desired && desired.referrer === (e.referrer ?? null) && desired.expires_at === (e.expires_at ?? null);
      })
      .map((e) => e.ip)
  );

  const toAdd: DesiredIpEntry[] = [];
  desiredMap.forEach((value, ip) => {
    if (!matchedIps.has(ip)) toAdd.push({ ip, referrer: value.referrer, expires_at: value.expires_at });
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