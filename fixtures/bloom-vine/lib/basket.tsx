'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { BOUQUETS, findBouquet, type Bouquet } from './bouquets';

/**
 * Basket state, held client-side and mirrored into localStorage so a refresh
 * mid-checkout does not lose the order. No account, no server session — the
 * scope is explicit that guests must be able to buy without signing up.
 */

export interface BasketLine {
  readonly slug: string;
  readonly quantity: number;
}

interface BasketContextValue {
  readonly lines: readonly BasketLine[];
  readonly itemCount: number;
  readonly totalPence: number;
  readonly ready: boolean;
  add: (bouquet: Bouquet) => void;
  setQuantity: (slug: string, quantity: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
}

const STORAGE_KEY = 'bloom-vine.basket.v1';

const BasketContext = createContext<BasketContextValue | undefined>(undefined);

function readStored(): BasketLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): BasketLine[] => {
      if (typeof entry !== 'object' || entry === null) return [];
      const slug = (entry as Record<string, unknown>)['slug'];
      const quantity = (entry as Record<string, unknown>)['quantity'];
      if (typeof slug !== 'string' || typeof quantity !== 'number') return [];
      // Drop anything no longer in the catalogue.
      if (findBouquet(slug) === undefined) return [];
      return [{ slug, quantity: Math.max(1, Math.min(20, Math.trunc(quantity))) }];
    });
  } catch {
    return [];
  }
}

export function BasketProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<readonly BasketLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(readStored());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // A full or blocked storage quota must not break checkout.
    }
  }, [lines, ready]);

  const add = useCallback((bouquet: Bouquet) => {
    // Out-of-stock bouquets are not addable. The scope requires this, and
    // enforcing it here as well as in the UI keeps the rule in one place.
    if (!bouquet.inStock) return;
    setLines((current) => {
      const existing = current.find((l) => l.slug === bouquet.slug);
      if (existing === undefined) return [...current, { slug: bouquet.slug, quantity: 1 }];
      return current.map((l) =>
        l.slug === bouquet.slug ? { ...l, quantity: Math.min(20, l.quantity + 1) } : l,
      );
    });
  }, []);

  const setQuantity = useCallback((slug: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((l) => l.slug !== slug)
        : current.map((l) => (l.slug === slug ? { ...l, quantity: Math.min(20, quantity) } : l)),
    );
  }, []);

  const remove = useCallback((slug: string) => {
    setLines((current) => current.filter((l) => l.slug !== slug));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<BasketContextValue>(() => {
    const totalPence = lines.reduce((sum, line) => {
      const bouquet = findBouquet(line.slug);
      return bouquet === undefined ? sum : sum + bouquet.pricePence * line.quantity;
    }, 0);
    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    return { lines, itemCount, totalPence, ready, add, setQuantity, remove, clear };
  }, [lines, ready, add, setQuantity, remove, clear]);

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBasket(): BasketContextValue {
  const context = useContext(BasketContext);
  if (context === undefined) throw new Error('useBasket must be used inside BasketProvider');
  return context;
}

export function basketBouquets(lines: readonly BasketLine[]): { bouquet: Bouquet; quantity: number }[] {
  return lines.flatMap((line) => {
    const bouquet = BOUQUETS.find((b) => b.slug === line.slug);
    return bouquet === undefined ? [] : [{ bouquet, quantity: line.quantity }];
  });
}
