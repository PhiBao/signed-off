'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { basketBouquets, useBasket } from '@/lib/basket';
import { formatPrice } from '@/lib/bouquets';
import { availableDeliveryDates, describeDate, toISODate } from '@/lib/delivery';
import { generateOrderNumber, lineItemsFrom, saveOrder } from '@/lib/orders';

/**
 * Guest checkout. No account, no sign-in — the scope is explicit that Sarah's
 * customers are mostly one-off buyers.
 */

interface FieldErrors {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  deliveryDate?: string;
  card?: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { lines, totalPence, clear, ready } = useBasket();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [message, setMessage] = useState('');
  const [card, setCard] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Delivery dates the shop offers. Bloom & Vine does not deliver on Sundays.
  const deliveryOptions = useMemo(() => availableDeliveryDates(), []);
  const entries = basketBouquets(lines);

  if (ready && entries.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h1 className="font-display text-2xl">Nothing to check out</h1>
        <p className="mt-2 text-bloom-muted">Your basket is empty.</p>
        <Link
          href="/"
          className="inline-block mt-6 rounded-lg bg-bloom-leaf text-white px-5 py-2.5 text-sm font-medium"
        >
          Browse bouquets
        </Link>
      </div>
    );
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (name.trim() === '') next.name = 'Please tell us your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = 'Please enter an email address we can send the confirmation to.';
    if (phone.trim().length < 7) next.phone = 'Please enter a phone number.';
    if (address.trim().length < 8) next.address = 'Please enter the full delivery address.';
    if (deliveryDate === '') next.deliveryDate = 'Please choose a delivery date.';
    if (card.replace(/\s/g, '').length < 12) next.card = 'Please enter a card number.';
    return next;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    const number = generateOrderNumber();
    saveOrder({
      number,
      placedAt: new Date().toISOString(),
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      deliveryDate,
      message: message.trim(),
      lines: lineItemsFrom(lines),
      totalPence,
    });
    clear();
    router.push(`/order/${number}`);
  }

  const field =
    'w-full rounded-lg border border-bloom-line bg-white px-3 py-2.5 text-base';
  const labelText = 'block text-sm font-medium mb-1.5';

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-display text-2xl">Checkout</h1>
      <p className="mt-1.5 text-sm text-bloom-muted">
        Ordering as a guest. You do not need an account.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 grid gap-8">
        <fieldset className="grid gap-4">
          <legend className="font-display text-lg mb-2">Your details</legend>

          <div>
            <label className={labelText} htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              name="name"
              autoComplete="name"
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={errors.name !== undefined}
              aria-describedby={errors.name === undefined ? undefined : 'name-error'}
            />
            {errors.name !== undefined && (
              <p id="name-error" className="mt-1.5 text-sm text-bloom-blush">
                {errors.name}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelText} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                className={field}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={errors.email !== undefined}
                aria-describedby={errors.email === undefined ? undefined : 'email-error'}
              />
              {errors.email !== undefined && (
                <p id="email-error" className="mt-1.5 text-sm text-bloom-blush">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label className={labelText} htmlFor="phone">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className={field}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={errors.phone !== undefined}
                aria-describedby={errors.phone === undefined ? undefined : 'phone-error'}
              />
              {errors.phone !== undefined && (
                <p id="phone-error" className="mt-1.5 text-sm text-bloom-blush">
                  {errors.phone}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        <fieldset className="grid gap-4">
          <legend className="font-display text-lg mb-2">Delivery</legend>

          <div>
            <label className={labelText} htmlFor="address">
              Delivery address
            </label>
            <textarea
              id="address"
              name="address"
              rows={3}
              autoComplete="shipping street-address"
              className={field}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              aria-invalid={errors.address !== undefined}
              aria-describedby={errors.address === undefined ? undefined : 'address-error'}
            />
            {errors.address !== undefined && (
              <p id="address-error" className="mt-1.5 text-sm text-bloom-blush">
                {errors.address}
              </p>
            )}
          </div>

          <div>
            <label className={labelText} htmlFor="deliveryDate">
              Delivery date
            </label>
            <select
              id="deliveryDate"
              name="deliveryDate"
              className={field}
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              aria-invalid={errors.deliveryDate !== undefined}
              aria-describedby="delivery-help"
            >
              <option value="">Choose a date…</option>
              {deliveryOptions.map((date) => (
                <option key={toISODate(date)} value={toISODate(date)}>
                  {describeDate(date)}
                </option>
              ))}
            </select>
            <p id="delivery-help" className="mt-1.5 text-sm text-bloom-muted">
              We deliver Monday to Saturday. Sundays are not available.
            </p>
            {errors.deliveryDate !== undefined && (
              <p className="mt-1.5 text-sm text-bloom-blush">{errors.deliveryDate}</p>
            )}
          </div>

          <div>
            <label className={labelText} htmlFor="message">
              Gift message <span className="text-bloom-muted font-normal">(optional)</span>
            </label>
            <input
              id="message"
              name="message"
              className={field}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="grid gap-4">
          <legend className="font-display text-lg mb-2">Payment</legend>
          <div>
            <label className={labelText} htmlFor="card">
              Card number
            </label>
            <input
              id="card"
              name="card"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="4242 4242 4242 4242"
              className={field}
              value={card}
              onChange={(e) => setCard(e.target.value)}
              aria-invalid={errors.card !== undefined}
              aria-describedby={errors.card === undefined ? undefined : 'card-error'}
            />
            {errors.card !== undefined && (
              <p id="card-error" className="mt-1.5 text-sm text-bloom-blush">
                {errors.card}
              </p>
            )}
            <p className="mt-1.5 text-sm text-bloom-muted">
              Test shop — no real payment is taken.
            </p>
          </div>
        </fieldset>

        <div className="rounded-xl border border-bloom-line bg-white p-4">
          <ul className="grid gap-1.5 text-sm">
            {entries.map(({ bouquet, quantity }) => (
              <li key={bouquet.slug} className="flex justify-between gap-4">
                <span>
                  {bouquet.name} × {quantity}
                </span>
                <span className="tabular-nums">
                  {formatPrice(bouquet.pricePence * quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-bloom-line flex justify-between">
            <span className="font-medium">Total</span>
            <span className="font-medium tabular-nums">{formatPrice(totalPence)}</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-bloom-leaf text-white px-6 py-3 font-medium hover:bg-bloom-leafdark transition-colors disabled:opacity-60"
        >
          {submitting ? 'Placing order…' : `Place order · ${formatPrice(totalPence)}`}
        </button>
      </form>
    </div>
  );
}
