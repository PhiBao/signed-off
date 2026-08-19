import { BOUQUETS, findBouquet } from './bouquets';
import type { BasketLine } from './basket';

/**
 * Orders live in sessionStorage. A real shop would persist server-side and send
 * Sarah an email; this fixture stops at the confirmation page, which is exactly
 * the boundary the scope document runs into — email delivery is not observable
 * in a browser, and Signed Off reports it as such rather than pretending.
 */

export interface OrderLine {
  readonly name: string;
  readonly quantity: number;
  readonly pricePence: number;
}

export interface Order {
  readonly number: string;
  readonly placedAt: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly address: string;
  readonly deliveryDate: string;
  readonly message: string;
  readonly lines: readonly OrderLine[];
  readonly totalPence: number;
}

const STORAGE_PREFIX = 'bloom-vine.order.';

/** Human-readable and unambiguous: no ambiguous characters. */
export function generateOrderNumber(): string {
  const alphabet = 'ACDEFGHJKLMNPQRTUVWXY3479';
  let suffix = '';
  const random = new Uint8Array(5);
  crypto.getRandomValues(random);
  for (const byte of random) suffix += alphabet[byte % alphabet.length];
  return `BV-${suffix}`;
}

export function lineItemsFrom(lines: readonly BasketLine[]): OrderLine[] {
  return lines.flatMap((line) => {
    const bouquet = findBouquet(line.slug) ?? BOUQUETS[0];
    if (bouquet === undefined) return [];
    return [{ name: bouquet.name, quantity: line.quantity, pricePence: bouquet.pricePence }];
  });
}

export function saveOrder(order: Order): void {
  try {
    window.sessionStorage.setItem(`${STORAGE_PREFIX}${order.number}`, JSON.stringify(order));
  } catch {
    // Confirmation still renders from the URL if storage is unavailable.
  }
}

export function loadOrder(number: string): Order | undefined {
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${number}`);
    if (raw === null) return undefined;
    return JSON.parse(raw) as Order;
  } catch {
    return undefined;
  }
}
