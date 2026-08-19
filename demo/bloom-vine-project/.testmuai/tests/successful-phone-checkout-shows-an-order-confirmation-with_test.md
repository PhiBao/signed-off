---
assurance:
  id: t-4
  base: sha256:ff842342030b69ae780d24f78400c9337ebb45807c252c404300b3220fc6a862
---
# Successful phone checkout shows an order confirmation with an order number

> Prove that completing a successful online order through the phone checkout flow reaches the success state that should trigger Sarah's email notification for order processing.

## Step 1

Open {{start_url}} in a browser sized to 390x844, land on the Bloom & Vine storefront, and confirm {{in_stock_bouquet}} is available to purchase on that phone-sized web surface.

## Step 2

Add {{in_stock_bouquet}} to the basket, continue into checkout, and stay on the guest path without signing in or creating an account.

## Step 3

Complete the checkout form with {{guest_name}}, {{guest_email}}, {{guest_phone}}, {{delivery_address}}, and the non-Sunday delivery date {{non_sunday_delivery_date}}, then place the order using {{test_payment_method}}.

## Step 4

Remain on the post-purchase confirmation screen for the completed order and inspect the visible confirmation details.

## Step 5 — assert @verifies ac-13

Confirm presence check: an order confirmation with an order number (exists) — the stated promise: After a successful online order on the phone checkout path, the customer sees an order confirmation that includes an order number.
