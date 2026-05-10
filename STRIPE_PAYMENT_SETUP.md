# Stripe Payment Integration Setup

## Overview
This document describes the Stripe payment integration for WiseCase, implementing the payment flow where clients pay after lawyers approve consultation requests.

## Payment Flow

1. **Client Requests Consultation** → Status: `pending`
2. **Lawyer Approves** → Status: `awaiting_payment`
3. **Client Pays via Stripe** → Status: `scheduled` (after successful payment)
4. **Payment Failed/Cancelled** → Status remains `awaiting_payment`

## Setup Instructions

### 1. Environment Variables

Add the following to your `.env.local` file:

```env
# Stripe Keys (Test Mode)
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Stripe Webhook Secret
# Get this from Stripe Dashboard > Developers > Webhooks
STRIPE_WEBHOOK_SECRET=whsec_27fb530063b2bee8fbd616acadbad198afc458c955cce5ec887e4590c7d208b8

# Site URL (for redirects)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 2. Database Migration

Run the SQL migration script in your Supabase SQL Editor:

```sql
-- File: scripts/021_add_awaiting_payment_status.sql
```

This script:
- Adds `awaiting_payment` status to appointments
- Adds `appointment_id` column to payments table
- Creates indexes for faster lookups

### 3. Stripe Webhook Setup (Production)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/webhooks)
2. Click "Add endpoint"
3. Set endpoint URL: `https://yourdomain.com/api/stripe/webhook`
4. Select events to listen for:
   - `checkout.session.completed` (primary - for Checkout Sessions)
   - `payment_intent.succeeded` (fallback)
   - `payment_intent.payment_failed`
5. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 4. Testing

#### Test Cards (Stripe Test Mode)
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

Use any future expiry date, any CVC, and any ZIP code.

## API Routes

### `/api/stripe/create-payment-intent`
Creates a Stripe Payment Intent for an appointment.

**Request:**
```json
{
  "appointmentId": "uuid",
  "amount": 100.00,
  "currency": "usd"
}
```

**Response:**
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentId": "uuid"
}
```

### `/api/stripe/create-checkout-session`
Creates a Stripe Checkout Session for redirect-based payment.

**Request:**
```json
{
  "appointmentId": "uuid",
  "amount": 100.00,
  "currency": "usd",
  "paymentId": "uuid"
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

### `/api/stripe/webhook`
Handles Stripe webhook events to update payment and appointment status.

## Components

### `PaymentButton`
Simple button component that redirects to Stripe Checkout.

**Usage:**
```tsx
<PaymentButton
  appointmentId={appointment.id}
  amount={100.00}
  currency="USD"
  onPaymentSuccess={() => window.location.reload()}
/>
```

### `StripeCheckout`
Embedded Stripe Elements form (alternative to redirect).

**Usage:**
```tsx
<StripeCheckout
  appointmentId={appointment.id}
  amount={100.00}
  currency="USD"
  onPaymentSuccess={() => window.location.reload()}
/>
```

## Status Flow

| Status | Description | Next Action |
|--------|-------------|-------------|
| `pending` | Client requested, waiting for lawyer approval | Lawyer accepts/rejects |
| `awaiting_payment` | Lawyer approved, waiting for client payment | Client pays via Stripe |
| `scheduled` | Payment completed, appointment confirmed | Appointment proceeds |
| `completed` | Appointment finished | - |
| `cancelled` | Appointment cancelled | - |
| `rejected` | Lawyer rejected request | - |

## Payment Calculation

Payment amount is calculated based on:
```typescript
const amount = (hourlyRate * durationMinutes) / 60
```

Example:
- Hourly Rate: $150
- Duration: 60 minutes
- Amount: $150.00

## Security Notes

1. **Server-side validation**: All payment operations are validated server-side
2. **RLS policies**: Supabase RLS ensures users can only access their own payments
3. **Webhook verification**: Webhook signatures are verified to prevent fraud
4. **Idempotency**: Payment records prevent duplicate charges

## Troubleshooting

### Payment not updating after success
- Check webhook is configured correctly
- Verify `STRIPE_WEBHOOK_SECRET` is set
- Check Supabase logs for errors
- Manually verify payment status in Stripe Dashboard

### "Appointment not found or invalid" error
- Ensure appointment status is `awaiting_payment`
- Verify appointment belongs to the current user
- Check appointment exists in database

### Checkout redirect not working
- Verify `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set
- Check browser console for errors
- Ensure Stripe keys are in test mode (for development)

## Production Checklist

- [ ] Replace test keys with live Stripe keys
- [ ] Set up production webhook endpoint
- [ ] Configure webhook signing secret
- [ ] Test payment flow end-to-end
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Configure email notifications for payments
- [ ] Set up refund processing workflow
- [ ] Test 3D Secure authentication
- [ ] Configure PCI compliance (Stripe handles this)

