'use client';

import Link from 'next/link';
import { basketBouquets, useBasket } from '@/lib/basket';
import { formatPrice } from '@/lib/bouquets';

export default function BasketPage() {
  const { lines, totalPence, itemCount, setQuantity, remove, ready } = useBasket();
  const entries = basketBouquets(lines);

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-bloom-muted">Loading your basket…</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h1 className="font-display text-2xl">Your basket is empty</h1>
        <p className="mt-2 text-bloom-muted">Pick a bouquet and it will appear here.</p>
        <Link
          href="/"
          className="inline-block mt-6 rounded-lg bg-bloom-leaf text-white px-5 py-2.5 text-sm font-medium hover:bg-bloom-leafdark transition-colors"
        >
          Browse bouquets
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-display text-2xl mb-6">Your basket</h1>

      <ul className="divide-y divide-bloom-line border-y border-bloom-line">
        {entries.map(({ bouquet, quantity }) => (
          <li key={bouquet.slug} className="py-4 flex items-center gap-4">
            <span
              aria-hidden
              className="h-12 w-12 rounded-full shrink-0"
              style={{ background: bouquet.palette[0] }}
            />

            <div className="flex-1 min-w-0">
              <p className="font-medium">{bouquet.name}</p>
              <p className="text-sm text-bloom-muted">{formatPrice(bouquet.pricePence)} each</p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only">Quantity of {bouquet.name}</span>
              <input
                type="number"
                min={1}
                max={20}
                value={quantity}
                aria-label={`Quantity of ${bouquet.name}`}
                onChange={(event) => setQuantity(bouquet.slug, Number(event.target.value))}
                className="w-16 rounded-md border border-bloom-line px-2 py-1.5 tabular-nums"
              />
            </label>

            <p className="w-20 text-right font-medium tabular-nums">
              {formatPrice(bouquet.pricePence * quantity)}
            </p>

            <button
              type="button"
              onClick={() => remove(bouquet.slug)}
              className="text-sm text-bloom-muted hover:text-bloom-blush transition-colors"
            >
              Remove
              <span className="sr-only"> {bouquet.name} from basket</span>
            </button>
          </li>
        ))}
      </ul>

      {/* The basket total reflects exactly what was added. */}
      <div className="mt-6 flex items-baseline justify-between">
        <p className="text-bloom-muted text-sm">
          {itemCount} {itemCount === 1 ? 'bouquet' : 'bouquets'}
        </p>
        <p className="text-lg">
          <span className="text-bloom-muted text-sm mr-2">Total</span>
          <span className="font-medium tabular-nums" data-testid="basket-total">
            {formatPrice(totalPence)}
          </span>
        </p>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:justify-end">
        <Link
          href="/"
          className="rounded-lg border border-bloom-line px-5 py-2.5 text-sm text-center hover:border-bloom-leaf transition-colors"
        >
          Keep browsing
        </Link>
        <Link
          href="/checkout"
          className="rounded-lg bg-bloom-leaf text-white px-6 py-2.5 text-sm font-medium text-center hover:bg-bloom-leafdark transition-colors"
        >
          Checkout
        </Link>
      </div>

      <p className="mt-4 text-sm text-bloom-muted sm:text-right">
        No account needed — you can order as a guest.
      </p>
    </div>
  );
}
