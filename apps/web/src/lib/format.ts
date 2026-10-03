const UNITS: [limit: number, seconds: number, name: Intl.RelativeTimeFormatUnit][] = [
  [60, 1, 'second'],
  [3_600, 60, 'minute'],
  [86_400, 3_600, 'hour'],
  [Number.POSITIVE_INFINITY, 86_400, 'day'],
];

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const absolute = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

/** "9jwG…niT" — enough of an address to recognise it. */
export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** "5 minutes ago" / "in 2 hours" for an ISO time, relative to `now`. */
export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = (new Date(iso).getTime() - now) / 1000;
  const [, size, name] = UNITS.find(([limit]) => Math.abs(seconds) < limit) ?? UNITS[3];

  return relative.format(Math.round(seconds / size), name);
}

export function dateTime(iso?: string): string {
  return iso ? absolute.format(new Date(iso)) : '—';
}

export function percent(rate?: number): string {
  return rate === undefined ? '—' : `${(rate * 100).toFixed(1)}%`;
}
