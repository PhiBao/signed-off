---
test: ../guest-bouquet-checkout-succeeds-on-a-phone-sized-browser-and_test.md
status: passed
started: 2026-08-19T16:51:14.331Z
duration_s: 312
session_id: 0fbfcb72-7ad7-439f-9446-0e1eea6d95df
---

# Guest bouquet checkout succeeds on a phone-sized browser and shows an order number — Result

## Step 1 ✓ passed (24.8s)
md5: f3f5fb0e20254a7c999f664eaec562a8
Open {{start_url}} in a browser sized to 390x844, land on the Bloom & Vine storefront, and locate {{in_stock_bouquet}} with its displayed price.

## Step 2 ✓ passed (45.4s)
md5: aa9be49d82f435fd95251a6bb1e49bd2
Store the current basket total as baseline_basket_total.

## Step 3 ✓ passed (43s)
md5: 8c4d5d8573a8f2c0cd052a316dde95ab
Store the displayed price of {{in_stock_bouquet}} as selected_bouquet_price.

## Step 4 ✓ passed (33.5s)
md5: a609e8628f57e82520e556f8c3d569d2
Add {{in_stock_bouquet}} to the basket from the storefront or its product detail page, and review the basket summary on the same phone-sized browser.

## Step 5 ✓ passed (18.5s)
md5: 1ab96d16edfa4c4a62e88b6e4b6bc3af
Continue from the basket into checkout through the guest path, without signing in or creating an account.

## Step 6 ✓ passed (27.6s)
md5: 5dbeb0ca73d00ca17914c7a93d1856e4
Complete the guest checkout form with {{guest_name}}, {{guest_email}}, {{guest_phone}}, {{delivery_address}}, and a delivery date that is not Sunday.

## Step 7 ✓ passed (33s)
md5: 8be2cc9a8f0fa0291ddbc97b0a893aa4
Place the order using {{test_payment_method}} and remain on the post-purchase confirmation screen.

## Step 8 ✓ passed (48.5s)
md5: 2ffbecbae7b5a7640754293226acdc30
Confirm the basket total reflects baseline_basket_total plus selected_bouquet_price, and note the visible order confirmation details including the order number.

## Step 9 — assert ✓ passed (34.7s)
md5: e085c7e638e6579481e4524b6fe86026
Confirm presence check: an order number on the order confirmation (exists) — the stated promise: The order confirmation includes an order number.
