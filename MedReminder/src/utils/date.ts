/**
 * Format a Date or ISO string as a user-friendly time string, e.g. "8:00 AM".
 */
export function formatTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format a Date or ISO string as a user-friendly date string, e.g. "Mon, Jan 6".
 */
export function formatDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Format a Date or ISO string as "YYYY-MM-DD" (used as Supabase date keys).
 */
export function toDateKey(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns true if two Dates fall on the same calendar day.
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Returns the start-of-day (00:00:00.000) for the local date of `value`.
 */
export function startOfDay(value: Date | string): Date {
  const date = typeof value === 'string' ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Returns the end-of-day (23:59:59.999) for the local date of `value`.
 */
export function endOfDay(value: Date | string): Date {
  const date = typeof value === 'string' ? new Date(value) : new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

/**
 * Convert a "HH:MM:SS" time string to a human-friendly "H:MM AM/PM" label.
 */
export function timeStringToLabel(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Convert a Date to a 24-hour "HH:MM:SS" time string for storage.
 */
export function dateToTimeString(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}:00`;
}

/**
 * Day-of-week short labels indexed 0 (Sun) → 6 (Sat).
 */
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
