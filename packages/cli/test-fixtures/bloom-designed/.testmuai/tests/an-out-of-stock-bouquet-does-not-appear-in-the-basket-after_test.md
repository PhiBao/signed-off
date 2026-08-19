---
assurance:
  id: t-3
  base: sha256:1df04f2113e6c363dd6de5c396f2aa75c174db6d05a81e990067e04213b89140
---
# An out-of-stock bouquet does not appear in the basket after an add attempt

> Prove that an out-of-stock bouquet cannot be added to the basket.

## Step 1

Open {{start_url}} in a browser sized to 390x844 and locate {{out_of_stock_bouquet}} in the Bloom & Vine bouquet catalogue or on its product detail page.

## Step 2

Attempt to add {{out_of_stock_bouquet}} to the basket through any product action the storefront exposes for that bouquet.

## Step 3

Review the resulting product state, basket indicator, and basket contents on the same phone-sized browser.

## Step 4 — assert @verifies ac-6, ac-11

Confirm 'the attempted out-of-stock bouquet present in the basket' does NOT appear (forbidden-presence) — the stated promise: After a visitor attempts to add an out-of-stock bouquet, that bouquet is not present in the basket.
