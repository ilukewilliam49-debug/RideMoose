

# Save Card for Returning Customers

## What this does
Returning riders won't need to re-enter card details. After their first payment, their card is saved to their Stripe customer profile and automatically used for future rides.

## How it works

Stripe already creates/finds a customer per email in `create-payment-intent`. The missing piece is telling Stripe to save the payment method to that customer for reuse.

### Changes

**1. Edge Function: `create-payment-intent/index.ts`**
- Add `setup_future_usage: "off_session"` to the `paymentIntents.create()` call
- This tells Stripe to save the card on the customer after successful confirmation
- No new edge function needed

**2. Edge Function: `authorize-bid/index.ts`**
- Same change: add `setup_future_usage: "off_session"` to the PaymentIntent create call

**3. Edge Function (new): `list-payment-methods/index.ts`**
- Authenticated endpoint that looks up the user's Stripe customer and returns saved cards (`stripe.paymentMethods.list({ customer, type: 'card' })`)
- Returns last4, brand, expiry for each card

**4. Frontend: `PaymentConfirmation.tsx`**
- Before showing the Stripe PaymentElement, call `list-payment-methods` to check for saved cards
- If saved cards exist, show a card selector (e.g. "Visa •••• 4242") with option to "Use a new card"
- When a saved card is selected, pass `payment_method` to the edge function and skip the PaymentElement form
- When "new card" is chosen, show the existing PaymentElement flow (which will also save the new card)

**5. Edge Function: `pay-with-saved-card/index.ts`**
- Accepts `ride_id` and `payment_method_id`
- Creates the PaymentIntent with the saved payment method and `confirm: true, off_session: true`
- Updates the ride record with payment info
- Returns success/failure

**6. Frontend: `RiderDashboard.tsx`**
- Wire the saved card flow into the booking confirmation step
- If a saved card is selected, call `pay-with-saved-card` directly instead of showing the Stripe form

### Technical details
- `setup_future_usage: "off_session"` is the Stripe-recommended way to save cards during a payment
- No database changes needed — Stripe stores the payment methods on the customer object
- Cards are automatically attached to the existing Stripe customer (already created per user email)
- PCI compliance is maintained since card data never touches our servers

