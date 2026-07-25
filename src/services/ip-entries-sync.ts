import type { IpEntry } from '@services/ip';
import { IpAPI } from '@services/ip';

interface IpEntriesDiff {
  toDelete: IpEntry[];
  toAdd: string[];
  desiredReferrer: string | null;
}

interface SyncIpEntriesResult {
  ok: boolean;
  entries: IpEntry[];
  error?: string;
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

export async function syncIpEntries(
  userId: number,
  diff: IpEntriesDiff
): Promise<SyncIpEntriesResult> {
  const { toDelete, toAdd, desiredReferrer } = diff;

  if (toDelete.length === 0 && toAdd.length === 0) {
    return { ok: true, entries: [] };
  }

  const [deleteResults, addResults] = await Promise.all([
    Promise.allSettled(toDelete.map((e) => IpAPI.deleteEntry(e.id))),
    Promise.allSettled(toAdd.map((ip) => IpAPI.addEntry(ip, 'whitelist', userId, desiredReferrer))),
  ]);

  const failures = [
    ...deleteResults
      .map((r, i) => ({ r, ip: toDelete[i].ip }))
      .filter(({ r }) => r.status === 'rejected')
      .map(({ r, ip }) => `${ip}: ${(r as PromiseRejectedResult).reason?.message ?? 'error'}`),
    ...addResults
      .map((r, i) => ({ r, ip: toAdd[i] }))
      .filter(({ r }) => r.status === 'rejected')
      .map(({ r, ip }) => `${ip}: ${(r as PromiseRejectedResult).reason?.message ?? 'error'}`),
  ];

  if (failures.length) {
    return { ok: false, entries: [], error: failures.join('\n') };
  }

  const fresh = await IpAPI.getUserEntries(userId);
  return { ok: true, entries: fresh.entries };
}