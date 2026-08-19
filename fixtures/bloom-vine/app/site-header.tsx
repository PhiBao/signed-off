'use client';

import Link from 'next/link';
import { useBasket } from '@/lib/basket';

export function SiteHeader() {
  const { itemCount } = useBasket();

  return (
    <header className="border-b border-bloom-line bg-white/70 backdrop-blur">
      <div className="mx-auto max-w-5xl px-5 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="font-display text-xl tracking-tight">
          Bloom <span className="text-bloom-blush">&amp;</span> Vine
        </Link>

        <Link
          href="/basket"
          className="text-sm inline-flex items-center gap-2 rounded-full border border-bloom-line px-4 py-2 hover:border-bloom-leaf transition-colors"
        >
          Basket
          <span
            aria-hidden
            className="min-w-5 text-center rounded-full bg-bloom-leaf text-white text-xs px-1.5 py-0.5"
          >
            {itemCount}
          </span>
          <span className="sr-only">{itemCount} items in basket</span>
        </Link>
      </div>
    </header>
  );
}
