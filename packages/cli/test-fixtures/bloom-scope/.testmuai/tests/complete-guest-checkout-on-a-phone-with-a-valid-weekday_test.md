---
assurance:
  id: t-1
  base: sha256:5b6f95faed0fd490a10fe75ce938be6dc194632d54025016033fbb79072753a6
---
# Complete guest checkout on a phone with a valid weekday delivery date

> Prove that a visitor can complete the end-to-end bouquet checkout as a guest on a phone-sized web surface, choose a non-Sunday delivery date, and reach an order confirmation that includes an order number.

## Step 1

Open {{start_url}} in a phone-sized browser viewport and land on the Bloom & Vine storefront home page.

## Step 2

From the bouquet catalogue, choose an in-stock bouquet that shows a visible price and add it to the basket.

## Step 3

From the basket, open checkout and continue without signing in or creating an account.

## Step 4

In the guest checkout form, enter {{guest_name}}, {{guest_email}}, {{guest_phone}}, and delivery address {{delivery_address}}.

## Step 5

In the delivery-date field, choose the non-Sunday date {{non_sunday_delivery_date}}.

## Step 6

In the payment section, use the approved test payment method {{payment_details}} and submit the order.

## Step 7

Assert the post-purchase page shows an order confirmation with a visible order number.

## Step 8 — assert @verifies ac-1, ac-2, ac-3, ac-6

Confirm presence check: order number on the order confirmation after a successful order (exists) — the stated promise: A successful order confirmation includes an order number.
