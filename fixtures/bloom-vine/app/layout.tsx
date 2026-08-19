import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { BasketProvider } from '@/lib/basket';
import { SiteHeader } from './site-header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bloom & Vine — Fresh flowers, delivered locally',
  description:
    'A small independent florist. Hand-tied bouquets delivered across the city, Monday to Saturday.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-dvh flex flex-col">
        <BasketProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-bloom-line mt-16">
            <div className="mx-auto max-w-5xl px-5 py-8 text-sm text-bloom-muted">
              <p>Bloom &amp; Vine · 14 Fennel Street · Deliveries Monday to Saturday</p>
            </div>
          </footer>
        </BasketProvider>
      </body>
    </html>
  );
}
