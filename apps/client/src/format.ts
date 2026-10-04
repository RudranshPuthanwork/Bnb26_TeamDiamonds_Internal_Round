const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n: number) => String(n).padStart(2, '0');

/** "04 Oct 2026" in UTC. */
export function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  return `${p2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "04 Oct 2026, 14:07 UTC". */
export function fmtDateTime(ts: number): string {
  const d = new Date(ts * 1000);
  return `${fmtDate(ts)}, ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} UTC`;
}

/** Seconds as "1 d 04 h", "3 h 05 m" or "12 m 30 s". Used for every countdown and window. */
export function formatSpan(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s >= 86400) return `${Math.floor(s / 86400)} d ${p2(Math.floor((s % 86400) / 3600))} h`;
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${p2(Math.floor((s % 3600) / 60))} m`;
  return `${Math.floor(s / 60)} m ${p2(s % 60)} s`;
}

/** Match an accession route param ("HL-0007/03", "03" or an asset id) to an item. */
export function findByAccession<T extends { accessionNumber: string; assetId: string }>(
  items: T[],
  raw: string | undefined
): T | undefined {
  const q = decodeURIComponent(raw ?? '').toLowerCase().trim();
  const tail = (x: string) => x.replace(/^hl-\d+\//i, '');
  return items.find((a) => {
    const acc = a.accessionNumber.toLowerCase();
    return acc === q || tail(acc) === tail(q) || a.assetId.toLowerCase() === q;
  });
}
