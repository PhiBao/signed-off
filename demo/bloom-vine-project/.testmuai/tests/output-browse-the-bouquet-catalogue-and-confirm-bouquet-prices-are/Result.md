---
test: ../browse-the-bouquet-catalogue-and-confirm-bouquet-prices-are_test.md
status: failed
started: 2026-08-19T17:34:09.821Z
duration_s: 26
session_id: f4043390-d43d-4705-ab57-72d04d1412f6
---

# Browse the bouquet catalogue and confirm bouquet prices are visible before any basket action — Result

## Step 1 ✓ passed (0.21s)
md5: 9f0bfd23a26f46275fa3a47ef71aa01e
Open {{start_url}} in a browser and land on the Bloom & Vine storefront catalogue page at a default browser width.

## Step 2 ✓ passed (0.23s)
md5: 512dd7be7149b23134598eea10672b7f
On the catalogue page, confirm that at least one bouquet listing is visible to a visitor without signing in or opening the basket.

## Step 3 ✓ passed (0.16s)
md5: b917c4b824de0288ee3c109109cbd70a
On the visible catalogue listings, confirm that each bouquet currently shown displays its price before any add-to-basket action is taken.

## Step 4 ✗ failed (23.1s)
md5: ab6c73487423da02e566e4e4f8c8e3dd
Reason: AP determined agent is stuck — no viable actions remain — bug verdict: Agent stalls before completing mobile resize task [automation_bug/agent_misstep, confidence 0.91]
Resize the same browser session to a phone-sized viewport around 375 px wide and return to the catalogue area if needed.

## Step 5 ⏭ skipped

## Step 6 — assert ⏭ skipped
