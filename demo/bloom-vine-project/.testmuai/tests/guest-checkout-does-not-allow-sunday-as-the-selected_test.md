---
assurance:
  id: t-2
  base: sha256:8c759f526183a89472f23fe3666db75aa9f11eb287e9a547dee22fae2226eef0
---
# Guest checkout does not allow Sunday as the selected delivery date

> Prove that Sunday cannot be chosen as the delivery date during bouquet checkout.

## Step 1

Open {{start_url}} in a browser sized to 390x844, locate {{in_stock_bouquet}}, and add it to the basket so checkout can begin.

## Step 2

Continue from the basket into checkout through the guest path, without signing in or creating an account.

## Step 3

Complete the required guest details with {{guest_name}}, {{guest_email}}, {{guest_phone}}, and {{delivery_address}} until the delivery-date control is available.

## Step 4

Inspect the delivery-date control for the upcoming Sunday and exercise the normal selection path for that Sunday if the control exposes it as a visible choice.

## Step 5

Observe the delivery-date field, calendar state, and any inline validation after the Sunday selection attempt.

## Step 6 — assert @verifies ac-3, ac-7, ac-10

Confirm 'Sunday shown as the selected delivery date after the selection attempt' does NOT appear (forbidden-presence) — the stated promise: After a visitor attempts to choose Sunday during guest checkout, Sunday is not shown as the selected delivery date.
