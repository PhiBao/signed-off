---
test: ../an-out-of-stock-bouquet-does-not-appear-in-the-basket-after_test.md
status: passed
started: 2026-08-19T16:47:26.022Z
duration_s: 86
session_id: 7644adb2-c7d5-47df-8635-22d9f034377f
---

# An out-of-stock bouquet does not appear in the basket after an add attempt — Result

## Step 1 ✓ passed (14s)
md5: 62ea913e8ac40b008f5262793eaa89c9
Open {{start_url}} in a browser sized to 390x844 and locate {{out_of_stock_bouquet}} in the Bloom & Vine bouquet catalogue or on its product detail page.

## Step 2 ✓ passed (17.5s)
md5: e79a6328068104c6059912e8d43124d9
Attempt to add {{out_of_stock_bouquet}} to the basket through any product action the storefront exposes for that bouquet.

## Step 3 ✓ passed (23.5s)
md5: f3cde76730e38c1f1072100beb3d35ed
Review the resulting product state, basket indicator, and basket contents on the same phone-sized browser.

## Step 4 — assert ✓ passed (28.7s)
md5: 67ac60d18c1c32fe430fdef0a14c4c86
Confirm 'the attempted out-of-stock bouquet present in the basket' does NOT appear (forbidden-presence) — the stated promise: After a visitor attempts to add an out-of-stock bouquet, that bouquet is not present in the basket.
