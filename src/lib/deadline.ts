const IST_OFFSET_MS = 5.5 * 60 * 60 * 1_000;

export function articleCloseAtIst(pubDate: string) {
  const published = Date.parse(pubDate);
  if (!Number.isFinite(published)) return 0;
  const shifted = new Date(published + IST_OFFSET_MS);
  shifted.setUTCHours(24, 0, 0, 0);
  return Math.floor((shifted.getTime() - IST_OFFSET_MS) / 1_000);
}
