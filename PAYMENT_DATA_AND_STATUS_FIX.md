# Payment Data Storage & Status Update Fix

## ✅ Payment Data Storage

**Yes, all payment data is saved!** Here's where:

### 1. **Stripe Dashboard**
- All payment transactions are stored in Stripe
- Access: https://dashboard.stripe.com/test/payments
- You can see:
  - Payment amount
  - Payment method
  - Customer details
  - Transaction status
  - Payment intent ID

### 2. **Your Database (`payments` table)**
- Payment records are created in your Supabase `payments` table
- Fields stored:
  - `appointment_id` - Links to the appointment
  - `case_id` - Links to the case
  - `client_id` - Who paid
  - `lawyer_id` - Who received payment
  - `amount` - Payment amount
  - `currency` - Payment currency
  - `status` - Payment status (pending, completed, failed)
  - `stripe_payment_id` - Stripe payment intent/session ID
  - `payment_method` - Card, etc.
  - `description` - Payment description
  - `created_at`, `updated_at` - Timestamps

### 3. **Check Payment Data**

Run this SQL in Supabase:

```sql
-- View all payments
SELECT 
  p.*,
  a.status as appointment_status,
  c.title as case_title
FROM payments p
LEFT JOIN appointments a ON p.appointment_id = a.id
LEFT JOIN cases c ON p.case_id = c.id
ORDER BY p.created_at DESC;
```

## ✅ Status Update Fix

### Issue: Payment button still shows after payment

**Fixed!** The page now:
1. Detects payment success from URL params (`?payment=success&session_id=...`)
2. Shows success toast
3. Automatically redirects to clean URL after 2 seconds
4. Refreshes appointment data to show updated status

### What You'll See After Payment:

1. **Before Payment:**
   - Status: "Awaiting Payment" (yellow badge)
   - Button: "Proceed to Payment"

2. **After Payment:**
   - Status: "Scheduled" (blue badge)
   - Indicator: ✅ "Paid" (green checkmark)
   - Button: "Cancel" (if needed)

## ✅ Real-time Updates

Both client and lawyer sides now have real-time subscriptions:
- When payment completes → Status updates automatically
- No page refresh needed (but redirect happens for safety)

## ✅ Notifications

### Payment Notifications Created:

1. **Payment Success:**
   - Client: "Payment Successful" notification
   - Lawyer: "Payment Received" notification

2. **Payment Failed:**
   - Client: "Payment Failed" notification
   - Lawyer: "Payment Failed" notification

### How to Test Notifications:

See `NOTIFICATION_DEBUG_GUIDE.md` for detailed instructions.

**Quick Test:**
1. Complete a payment
2. Check notification bell icon (should show unread count)
3. Click bell to see notifications
4. Check Supabase `notifications` table

## ✅ Lawyer Side Updates

The lawyer appointments page will automatically update when:
- Client completes payment → Status changes to "Scheduled"
- Real-time subscription updates the UI
- Lawyer sees "Scheduled" badge instead of "Awaiting Payment"

## 🔧 If Status Doesn't Update

### Check Webhook Processing:

1. **For Local Development:**
   - Webhooks might not fire locally
   - Use Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
   - Or manually trigger status update

2. **Manual Status Update (for testing):**
   ```sql
   -- Update appointment status manually
   UPDATE appointments 
   SET status = 'scheduled' 
   WHERE id = 'YOUR_APPOINTMENT_ID';
   ```

3. **Check Payment Record:**
   ```sql
   -- Check if payment was created
   SELECT * FROM payments 
   WHERE appointment_id = 'YOUR_APPOINTMENT_ID';
   ```

## 📊 Payment Flow Summary

1. **Client clicks "Proceed to Payment"**
   - Creates payment record in `payments` table (status: `pending`)
   - Creates Stripe Payment Intent
   - Redirects to Stripe Checkout

2. **Client completes payment on Stripe**
   - Stripe processes payment
   - Redirects back with `?payment=success&session_id=...`

3. **Webhook processes payment** (or redirect callback)
   - Updates `payments` table (status: `completed`)
   - Updates `appointments` table (status: `scheduled`)
   - Creates notifications for client and lawyer

4. **Page refreshes**
   - Shows "Scheduled" status
   - Shows ✅ "Paid" indicator
   - Hides "Proceed to Payment" button

## 🐛 Debugging

### Check Payment Status:
```sql
SELECT 
  a.id,
  a.status as appointment_status,
  p.status as payment_status,
  p.stripe_payment_id,
  p.amount
FROM appointments a
LEFT JOIN payments p ON a.id = p.appointment_id
WHERE a.id = 'YOUR_APPOINTMENT_ID';
```

### Check Notifications:
```sql
SELECT * FROM notifications 
WHERE type = 'payment_update'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Webhook Logs:
- Terminal should show: `[Stripe] Payment succeeded for appointment <id>`
- Check Stripe Dashboard > Webhooks for delivery status

