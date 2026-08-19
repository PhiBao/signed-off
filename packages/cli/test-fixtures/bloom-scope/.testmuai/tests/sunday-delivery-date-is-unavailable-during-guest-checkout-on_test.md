---
assurance:
  id: t-2
  base: sha256:1ab068b6bb83115fd6d24381b47efd2a74fa18d84eccf17eb60eb87726030efb
---
# Sunday delivery date is unavailable during guest checkout on a phone

> Prove that the delivery-date control in the phone-sized guest checkout flow forbids selecting a Sunday.

## Step 1

Open {{start_url}} in a phone-sized browser viewport and land on the Bloom & Vine storefront home page.

## Step 2

From the bouquet catalogue, choose an in-stock bouquet that shows a visible price and add it to the basket.

## Step 3

From the basket, open checkout and continue without signing in or creating an account.

## Step 4

In the guest checkout form, enter {{guest_name}}, {{guest_email}}, {{guest_phone}}, and delivery address {{delivery_address}} up to the delivery-date field.

## Step 5

In the delivery-date picker, attempt to choose the Sunday date {{sunday_delivery_date}}.

## Step 6

Assert the Sunday date {{sunday_delivery_date}} remains unavailable for delivery selection.

## Step 7 — assert @verifies ac-5

Confirm 'a selectable Sunday delivery date' does NOT appear (forbidden-presence) — the stated promise: Delivery date selection does not allow Sundays.
