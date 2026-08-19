---
test: ../guest-checkout-does-not-allow-sunday-as-the-selected_test.md
status: passed
started: 2026-08-19T16:36:10.294Z
duration_s: 200
session_id: 3d1ac01d-f0ab-4923-b6d1-ec442ef56c68
---

# Guest checkout does not allow Sunday as the selected delivery date — Result

## Step 1 ✓ passed (34.9s)
md5: 7a7feffd8582433d3c71a357632130ca
Open {{start_url}} in a browser sized to 390x844, locate {{in_stock_bouquet}}, and add it to the basket so checkout can begin.

## Step 2 ✓ passed (24.7s)
md5: 1ab96d16edfa4c4a62e88b6e4b6bc3af
Continue from the basket into checkout through the guest path, without signing in or creating an account.

## Step 3 ✓ passed (29.1s)
md5: 2ec6f50ad59bc58f5dfa538f43295231
Complete the required guest details with {{guest_name}}, {{guest_email}}, {{guest_phone}}, and {{delivery_address}} until the delivery-date control is available.

## Step 4 ✓ passed (49.2s)
md5: f793a470085916589740ccfdd934bddc
Inspect the delivery-date control for the upcoming Sunday and exercise the normal selection path for that Sunday if the control exposes it as a visible choice.

## Step 5 ✓ passed (32.4s)
md5: 5dc3c5d6ac32001f93d019da568467a1
Observe the delivery-date field, calendar state, and any inline validation after the Sunday selection attempt.

## Step 6 — assert ✓ passed (27.2s)
md5: ac6130c67cbdac2f2ba207585b67cac0
Confirm 'Sunday shown as the selected delivery date after the selection attempt' does NOT appear (forbidden-presence) — the stated promise: After a visitor attempts to choose Sunday during guest checkout, Sunday is not shown as the selected delivery date.
