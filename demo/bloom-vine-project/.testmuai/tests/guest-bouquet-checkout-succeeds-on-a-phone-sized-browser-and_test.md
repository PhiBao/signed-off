---
assurance:
  id: t-1
  base: sha256:5bf769b14f5585112c21c4d180a3a7152d263384763f854df0423d28d41734fc
---
# Guest bouquet checkout succeeds on a phone-sized browser and shows an order number

> Prove that a visitor can add an in-stock bouquet, see the basket total update, complete checkout without creating an account, and reach an order confirmation with an order number on a phone-sized web surface.

## Step 1

Open {{start_url}} in a browser sized to 390x844, land on the Bloom & Vine storefront, and locate {{in_stock_bouquet}} with its displayed price.

## Step 2

Store the current basket total as baseline_basket_total.

## Step 3

Store the displayed price of {{in_stock_bouquet}} as selected_bouquet_price.

## Step 4

Add {{in_stock_bouquet}} to the basket from the storefront or its product detail page, and review the basket summary on the same phone-sized browser.

## Step 5

Continue from the basket into checkout through the guest path, without signing in or creating an account.

## Step 6

Complete the guest checkout form with {{guest_name}}, {{guest_email}}, {{guest_phone}}, {{delivery_address}}, and a delivery date that is not Sunday.

## Step 7

Place the order using {{test_payment_method}} and remain on the post-purchase confirmation screen.

## Step 8

Confirm the basket total reflects baseline_basket_total plus selected_bouquet_price, and note the visible order confirmation details including the order number.

## Step 9 — assert @verifies ac-1, ac-2, ac-3, ac-4, ac-5, ac-9

Confirm presence check: an order number on the order confirmation (exists) — the stated promise: The order confirmation includes an order number.
