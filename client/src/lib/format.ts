/** Format cents as dollars: 150000 → "$1,500.00" */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/** Format ISO date string as human-readable: "Mar 26, 2026" */
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Days from today (negative = overdue) */
export function daysFromNow(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Get client color as CSS hex */
export function clientColor(hex: string): string {
  return `#${hex}`;
}
