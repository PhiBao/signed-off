'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatPrice } from '@/lib/bouquets';
import { describeDate, fromISODate } from '@/lib/delivery';
import { loadOrder, type Order } from '@/lib/orders';

export default function OrderConfirmationPage() {
  const params = useParams<{ number: string }>();
  const orderNumber = typeof params.number === 'string' ? params.number : '';
  const [order, setOrder] = useState<Order | undefined>(undefined);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setOrder(loadOrder(orderNumber));
    setChecked(true);
  }, [orderNumber]);

  const deliveryDate = order === undefined ? undefined : fromISODate(order.deliveryDate);

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div className="rounded-2xl border border-bloom-line bg-white p-6 sm:p-8">
        <p className="text-bloom-leaf font-medium">Order confirmed</p>

        <h1 className="mt-2 font-display text-2xl sm:text-3xl">Thank you{order === undefined ? '' : `, ${order.name.split(' ')[0]}`}</h1>

        <p className="mt-3 text-bloom-muted">
          We have your order and Sarah has been notified. A confirmation is on its way to
          {order === undefined ? ' your inbox' : ` ${order.email}`}.
        </p>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-bloom-muted">Order number</dt>
            {/* The confirmation always shows an order number. */}
            <dd
              className="mt-0.5 text-lg font-medium tracking-wide"
              data-testid="order-number"
            >
              {orderNumber}
            </dd>
          </div>

          {deliveryDate !== undefined && (
            <div>
              <dt className="text-sm text-bloom-muted">Delivery date</dt>
              <dd className="mt-0.5 text-lg font-medium" data-testid="order-delivery-date">
                {describeDate(deliveryDate)}
              </dd>
            </div>
          )}
        </dl>

        {order !== undefined && (
          <>
            <div className="mt-6 pt-6 border-t border-bloom-line">
              <h2 className="text-sm text-bloom-muted mb-2">Delivering to</h2>
              <p className="whitespace-pre-line">{order.address}</p>
              {order.message !== '' && (
                <p className="mt-3 text-sm text-bloom-muted">
                  Gift message: &ldquo;{order.message}&rdquo;
                </p>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-bloom-line">
              <ul className="grid gap-1.5 text-sm">
                {order.lines.map((line) => (
                  <li key={line.name} className="flex justify-between gap-4">
                    <span>
                      {line.name} × {line.quantity}
                    </span>
                    <span className="tabular-nums">
                      {formatPrice(line.pricePence * line.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t border-bloom-line flex justify-between">
                <span className="font-medium">Total paid</span>
                <span className="font-medium tabular-nums">{formatPrice(order.totalPence)}</span>
              </div>
            </div>
          </>
        )}

        {checked && order === undefined && (
          <p className="mt-6 text-sm text-bloom-muted">
            We could not load the full details of this order in this browser, but the order number
            above is your reference.
          </p>
        )}
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="text-sm underline hover:text-bloom-leaf">
          Back to the shop
        </Link>
      </div>
    </div>
  );
}
