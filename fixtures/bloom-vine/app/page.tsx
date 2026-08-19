'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BOUQUETS, formatPrice, type Bouquet } from '@/lib/bouquets';
import { useBasket } from '@/lib/basket';

function Posy({ palette }: { palette: readonly [string, string] }) {
  const [bloom, leaf] = palette;
  return (
    <div
      aria-hidden
      className="h-40 rounded-t-xl relative overflow-hidden"
      style={{ background: `linear-gradient(160deg, ${bloom}22, ${leaf}18)` }}
    >
      <span
        className="absolute left-1/2 top-9 -translate-x-1/2 h-16 w-16 rounded-full"
        style={{ background: bloom }}
      />
      <span
        className="absolute left-1/2 top-6 -translate-x-[135%] h-11 w-11 rounded-full opacity-90"
        style={{ background: bloom }}
      />
      <span
        className="absolute left-1/2 top-7 translate-x-[35%] h-12 w-12 rounded-full opacity-80"
        style={{ background: bloom }}
      />
      <span
        className="absolute left-1/2 bottom-0 -translate-x-1/2 h-16 w-2 rounded-t"
        style={{ background: leaf }}
      />
    </div>
  );
}

function BouquetCard({ bouquet }: { bouquet: Bouquet }) {
  const { add } = useBasket();
  const [added, setAdded] = useState(false);

  return (
    <article className="rounded-xl border border-bloom-line bg-white overflow-hidden flex flex-col">
      <Posy palette={bouquet.palette} />

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg">{bouquet.name}</h2>
          {/* Price is always visible before anything is added to the basket. */}
          <p className="text-base font-medium tabular-nums" data-testid={`price-${bouquet.slug}`}>
            {formatPrice(bouquet.pricePence)}
          </p>
        </div>

        <p className="text-sm text-bloom-muted flex-1">{bouquet.description}</p>

        {bouquet.inStock ? (
          <button
            type="button"
            onClick={() => {
              add(bouquet);
              setAdded(true);
              window.setTimeout(() => setAdded(false), 1600);
            }}
            className="mt-2 rounded-lg bg-bloom-leaf text-white py-2.5 text-sm font-medium hover:bg-bloom-leafdark transition-colors"
          >
            {added ? 'Added to basket' : 'Add to basket'}
          </button>
        ) : (
          <div className="mt-2">
            <p className="rounded-lg bg-bloom-cream border border-bloom-line text-bloom-muted py-2.5 text-sm text-center">
              Sold out
            </p>
            <p className="sr-only">{bouquet.name} is out of stock and cannot be added</p>
          </div>
        )}
      </div>
    </article>
  );
}

export default function CataloguePage() {
  const { itemCount } = useBasket();

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <section className="mb-10 max-w-2xl">
        <h1 className="font-display text-3xl sm:text-4xl leading-tight">
          Hand-tied bouquets, delivered locally
        </h1>
        <p className="mt-3 text-bloom-muted">
          Cut fresh the morning of delivery. Order by 6pm for delivery from two days&rsquo; time,
          Monday to Saturday.
        </p>
      </section>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {BOUQUETS.map((bouquet) => (
          <BouquetCard key={bouquet.slug} bouquet={bouquet} />
        ))}
      </div>

      {itemCount > 0 && (
        <div className="sticky bottom-4 mt-8 flex justify-center">
          <Link
            href="/basket"
            className="rounded-full bg-bloom-ink text-white px-6 py-3 text-sm font-medium shadow-lg"
          >
            View basket ({itemCount})
          </Link>
        </div>
      )}
    </div>
  );
}
