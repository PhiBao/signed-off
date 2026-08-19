---
test: ../successful-phone-checkout-shows-an-order-confirmation-with_test.md
status: passed
started: 2026-08-19T16:56:58.108Z
duration_s: 143
session_id: 63c5eb74-42da-467d-8823-432019d43c7c
---

# Successful phone checkout shows an order confirmation with an order number — Result

## Step 1 ✓ passed (26.9s)
md5: 427d4c6209bebd1a034a33c091635ccc
Open {{start_url}} in a browser sized to 390x844, land on the Bloom & Vine storefront, and confirm {{in_stock_bouquet}} is available to purchase on that phone-sized web surface.

## Step 2 ✓ passed (39.6s)
md5: 3570c9e56ec153989129a3512d7db7e2
Add {{in_stock_bouquet}} to the basket, continue into checkout, and stay on the guest path without signing in or creating an account.

## Step 3 ✓ passed (37.7s)
md5: dd3dada18dbdc7f752d80719463e7004
Complete the checkout form with {{guest_name}}, {{guest_email}}, {{guest_phone}}, {{delivery_address}}, and the non-Sunday delivery date {{non_sunday_delivery_date}}, then place the order using {{test_payment_method}}.

## Step 4 ✓ passed (14.4s)
md5: c0dfd7e82a1167608691a53dea014cbe
Remain on the post-purchase confirmation screen for the completed order and inspect the visible confirmation details.

## Step 5 — assert ✓ passed (22.4s)
md5: 2a514fb03dde85e5359007adad58a865
Confirm presence check: an order confirmation with an order number (exists) — the stated promise: After a successful online order on the phone checkout path, the customer sees an order confirmation that includes an order number.
