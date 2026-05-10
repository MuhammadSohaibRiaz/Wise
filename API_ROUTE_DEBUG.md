# API Route Debugging Guide

## Issue: 404 on `/api/stripe/create-payment-intent`

### Possible Causes:

1. **Next.js Dev Server Not Restarted**
   - After creating new API routes, you need to restart the dev server
   - Solution: Stop the server (Ctrl+C) and run `npm run dev` again

2. **Route File Location**
   - The route file must be at: `app/api/stripe/create-payment-intent/route.ts`
   - Verify the file exists and is in the correct location

3. **Next.js Cache Issue**
   - Sometimes Next.js caches routes incorrectly
   - Solution: Delete `.next` folder and restart dev server

### Steps to Fix:

1. **Restart Dev Server:**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Clear Next.js Cache:**
   ```bash
   # Delete .next folder
   rm -rf .next
   # Or on Windows:
   rmdir /s .next
   
   # Then restart
   npm run dev
   ```

3. **Verify Route File:**
   - Check that `app/api/stripe/create-payment-intent/route.ts` exists
   - Verify it exports a `POST` function

4. **Check Server Logs:**
   - Look for any errors when starting the dev server
   - Check if the route is being registered

### Testing the Route:

Once the server is restarted, test the route directly:

```bash
curl -X POST http://localhost:3000/api/stripe/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{"appointmentId":"test","amount":100}'
```

Or use the browser console:
```javascript
fetch('/api/stripe/create-payment-intent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ appointmentId: 'test', amount: 100 })
}).then(r => r.json()).then(console.log)
```

### Enhanced Error Messages:

The route now includes detailed error messages that will help identify the issue:
- Authentication errors
- Missing fields
- Appointment not found
- Status mismatch
- Client ID mismatch

Check the server console (terminal) for detailed logs when the request is made.

