# Complete End-to-End Payment Testing Guide

## Prerequisites

1. ✅ SQL migration executed: `scripts/021_add_awaiting_payment_status.sql`
2. ✅ Stripe test keys added to `.env.local`:
   ```env
   STRIPE_SECRET_KEY=
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
   ```
3. ✅ Development server running: `npm run dev`

## Complete Testing Flow

### Step 1: Client Requests Consultation

1. **Login as Client**
   - Go to: `http://localhost:3000/auth/client/sign-in`
   - Use your client credentials

2. **Browse Lawyers**
   - Navigate to: `http://localhost:3000/match`
   - Browse available lawyers
   - Click on a lawyer profile

3. **Request Appointment**
   - Click "Book Consultation" button
   - Fill in:
     - Case Title: "Test Consultation"
     - Case Type: Select any (e.g., "Family Law")
     - Description: "Testing payment flow"
     - Select Date & Time
     - Duration: 60 minutes
   - Click "Request Consultation"

4. **Verify Status**
   - Go to: `http://localhost:3000/client/appointments`
   - Status should be: **"Pending"** (orange badge)
   - Message: "Waiting for lawyer response"

### Step 2: Lawyer Approves Request

1. **Login as Lawyer** (in a different browser/incognito)
   - Go to: `http://localhost:3000/auth/lawyer/sign-in`
   - Use the lawyer credentials for the lawyer you selected

2. **View Pending Requests**
   - Go to: `http://localhost:3000/lawyer/appointments`
   - You should see the request in "Pending Requests" section
   - Shows:
     - Client name and email
     - Case title and description
     - Scheduled date and time
     - Request message

3. **Accept Request**
   - Click "Accept" button (green button with checkmark)
   - Status changes to: **"Awaiting Payment"** (yellow badge)

4. **Verify on Client Side**
   - Switch back to client browser
   - Refresh: `http://localhost:3000/client/appointments`
   - Status should now be: **"Awaiting Payment"** (yellow badge)
   - **"Proceed to Payment"** button should appear

### Step 3: Client Makes Payment

1. **Click Payment Button**
   - On client appointments page, click **"Proceed to Payment"**
   - Payment dialog opens showing:
     - Consultation Fee amount
     - Duration and hourly rate breakdown

2. **Stripe Checkout**
   - Click **"Pay $X.XX"** button
   - You'll be redirected to Stripe Checkout page

3. **Test Payment Scenarios**

   #### ✅ Success Scenario
   - Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/25)
   - CVC: Any 3 digits (e.g., 123)
   - ZIP: Any 5 digits (e.g., 12345)
   - Click "Pay"
   - You'll be redirected back to appointments page
   - Status should be: **"Scheduled"** (blue badge)
   - Payment record created in database

   #### ❌ Failure Scenario
   - Use declined card: `4000 0000 0000 0002`
   - Fill in same details
   - Click "Pay"
   - Payment will fail
   - Status remains: **"Awaiting Payment"**
   - Error message shown

   #### ⏸️ Cancelled Scenario
   - Start payment process
   - Click "Cancel" or close the Stripe window
   - Status remains: **"Awaiting Payment"**
   - No payment record created

### Step 4: Verify Payment Records

1. **Check Database** (Supabase Dashboard)
   - Go to `payments` table
   - Filter by appointment_id
   - Verify:
     - `status`: "completed" (for successful payment)
     - `stripe_payment_id`: Should have a Stripe payment intent ID
     - `amount`: Matches calculated fee
     - `appointment_id`: Links to the appointment

2. **Check Appointments Table**
   - Status should be: "scheduled" (after successful payment)
   - `updated_at` timestamp should reflect payment time

### Step 5: Lawyer View After Payment

1. **Lawyer Dashboard**
   - Go to: `http://localhost:3000/lawyer/appointments`
   - Check "All Appointments" section
   - Appointment should show:
     - Status: **"Scheduled"** (blue badge)
     - No longer in "Awaiting Payment" section

2. **Earnings Summary** (if implemented)
   - Payment should be reflected in earnings

## Testing Checklist

### ✅ Client Flow
- [ ] Can request consultation
- [ ] Sees "Pending" status
- [ ] Receives notification when lawyer approves
- [ ] Sees "Awaiting Payment" status
- [ ] Payment button appears
- [ ] Can open payment dialog
- [ ] Can complete payment successfully
- [ ] Status changes to "Scheduled" after payment
- [ ] Payment failure handled gracefully
- [ ] Can cancel payment

### ✅ Lawyer Flow
- [ ] Sees pending requests
- [ ] Can accept request
- [ ] Status changes to "Awaiting Payment"
- [ ] Client notified of approval
- [ ] Sees "Scheduled" status after client pays
- [ ] Payment status visible in appointments

### ✅ Payment Processing
- [ ] Payment intent created correctly
- [ ] Payment record created in database
- [ ] Stripe webhook processes payment (if configured)
- [ ] Appointment status updates automatically
- [ ] Error handling works for failed payments
- [ ] Payment amounts calculated correctly

### ✅ Notifications
- [ ] Client notified when lawyer approves
- [ ] Client notified when payment succeeds
- [ ] Lawyer notified when payment completes
- [ ] Notification bell shows unread count
- [ ] Notifications appear in dropdown

## Common Issues & Solutions

### Issue: Payment button not appearing
**Solution:**
- Check appointment status is "awaiting_payment"
- Verify SQL migration was executed
- Check browser console for errors

### Issue: Stripe redirect not working
**Solution:**
- Verify `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set
- Check API route `/api/stripe/create-checkout-session` is accessible
- Check browser console for errors

### Issue: Status not updating after payment
**Solution:**
- Check Stripe webhook is configured (for production)
- For development, payment status updates via redirect callback
- Verify database connection
- Check Supabase logs

### Issue: Payment amount incorrect
**Solution:**
- Verify `hourly_rate` in cases table
- Check `duration_minutes` in appointments
- Formula: `(hourly_rate * duration_minutes) / 60`

## Test Cards (Stripe Test Mode)

| Card Number | Scenario | Result |
|------------|----------|--------|
| `4242 4242 4242 4242` | Success | Payment succeeds |
| `4000 0000 0000 0002` | Decline | Payment fails |
| `4000 0025 0000 3155` | 3D Secure | Requires authentication |
| `4000 0000 0000 9995` | Insufficient funds | Payment fails |

## Next Steps After Testing

1. **Production Setup**
   - Replace test keys with live Stripe keys
   - Set up production webhook endpoint
   - Configure webhook signing secret
   - Test with real payment methods

2. **Additional Features**
   - Email notifications for payments
   - Payment receipts
   - Refund processing
   - Payment history page
   - Invoice generation

## Support

If you encounter issues:
1. Check browser console for errors
2. Check Supabase logs
3. Check Stripe Dashboard for payment attempts
4. Verify all environment variables are set
5. Ensure SQL migration was executed successfully

