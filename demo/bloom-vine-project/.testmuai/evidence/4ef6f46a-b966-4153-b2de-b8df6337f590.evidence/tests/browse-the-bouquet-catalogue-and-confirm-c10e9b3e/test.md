---
assurance:
  id: t-5
  base: sha256:d59ec97722c8cff2d02db40610019e9b8c27ba8a63669f43439d13c1755e13a0
---
# Browse the bouquet catalogue and confirm bouquet prices are visible before any basket action

> Prove that a visitor can browse bouquet listings and see each bouquet's price before taking any basket action, including on a phone-sized browser.

## Step 1

Open {{start_url}} in a browser and land on the Bloom & Vine storefront catalogue page at a default browser width.

## Step 2

On the catalogue page, confirm that at least one bouquet listing is visible to a visitor without signing in or opening the basket.

## Step 3

On the visible catalogue listings, confirm that each bouquet currently shown displays its price before any add-to-basket action is taken.

## Step 4

Resize the same browser session to a phone-sized viewport around 375 px wide and return to the catalogue area if needed.

## Step 5

On the phone-sized catalogue view, confirm that bouquet listings and their prices remain visible before any add-to-basket action and that no overlapping or clipped layout blocks reading the listing or price.

## Step 6 — assert @verifies ac-15, ac-14

Confirm presence check: each bouquet shown in the catalogue has a visible price before any add-to-basket action (forall) — the stated promise: Every bouquet shown in the catalogue displays its price before any add-to-basket action.
