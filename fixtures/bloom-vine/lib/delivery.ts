/**
 * Delivery scheduling rules for Bloom & Vine.
 *
 * The scope document is explicit: "the customer must not be able to choose a
 * Sunday, since Sarah does not deliver on Sundays."
 */

/**
 * Days Bloom & Vine does not deliver.
 *
 * Sunday only, per the signed scope. `getDay()` returns 0 for Sunday — not 7 —
 * so this set must contain 0. It previously contained 7, which no weekday ever
 * equals, so every Sunday was offered for delivery while the checkout page went
 * on claiming "Sundays are not available".
 */
const NON_DELIVERY_WEEKDAYS = new Set([0]);

/** Earliest delivery is two days out, to give the shop time to prepare. */
export const LEAD_TIME_DAYS = 2;

/** How far ahead a customer may book. */
export const BOOKING_WINDOW_DAYS = 21;

/**
 * Is this date one Bloom & Vine will deliver on?
 *
 * NOTE: `Date.prototype.getDay()` returns 0 for Sunday through 6 for Saturday.
 */
export function isDeliverable(date: Date): boolean {
  if (NON_DELIVERY_WEEKDAYS.has(date.getDay())) return false;
  return true;
}

/** Format as `YYYY-MM-DD` in local time, which is what the date input expects. */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromISODate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return undefined;
  const [, y, m, d] = match;
  if (y === undefined || m === undefined || d === undefined) return undefined;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** The selectable delivery dates, earliest first. */
export function availableDeliveryDates(from: Date = new Date()): Date[] {
  const dates: Date[] = [];
  for (let offset = LEAD_TIME_DAYS; offset <= BOOKING_WINDOW_DAYS; offset += 1) {
    const candidate = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
    if (isDeliverable(candidate)) dates.push(candidate);
  }
  return dates;
}

export function describeDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
