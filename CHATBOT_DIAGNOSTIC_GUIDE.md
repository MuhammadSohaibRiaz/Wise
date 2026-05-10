# WiseCase Chatbot Diagnostic Guide

## Quick Fixes Applied

### 1. **API Route Improvements** (`app/api/chat/route.ts`)
✅ Added validation for Groq API key at startup with clear error messages
✅ Added JSON parsing error handling
✅ Added messages array validation
✅ Improved error responses with specific status codes (400, 403, 429, 503, 504)
✅ Better error messages for auth failures vs network/rate limit issues
✅ Fallback mechanism now catches authentication errors separately

### 2. **Chat Component Improvements** (`components/chatbot/Chat.tsx`)
✅ Added `onError` handler to useChat hook to capture and display errors
✅ Added 15-second timeout detection for stuck loading states
✅ Better timeout error messages with support notice
✅ Improved loading indicator with status messages (📄 Analyzing, 🤔 Thinking)
✅ Better error display in message format

### 3. **Error Handling Flow**
```
User sends message
    ↓
API validates request
    ↓
Check if GROQ_API_KEY is set
    ├─ YES → Try Groq API call
    │          ├─ Success → Stream response
    │          ├─ Tool error → Fallback without tools
    │          └─ Auth error → Show config error (503)
    │
    └─ NO → Return config error immediately (503)
    ↓
Error occurs
    ├─ Request parsing error → 400 error
    ├─ Auth/config error → 503 error
    ├─ Rate limit → 429 error
    ├─ Timeout → 504 error
    └─ Generic error → 500 error with user-friendly message
    ↓
Chat component shows error message to user
```

---

## 🔍 Verification Checklist

### Step 1: Check Environment Configuration

**In your `.env.local` file, verify:**

```
✅ GROQ_API_KEY=gsk_xxxxxxxxxxxxx  (Should be a long string starting with 'gsk_')
✅ NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
✅ SUPABASE_SERVICE_ROLE_KEY=xxxxx
```

**If any are missing:**
1. Get your Groq API key from: https://console.groq.com/keys
2. Create a new key or copy existing one
3. Add it to `.env.local`
4. Restart the dev server: `pnpm dev`

### Step 2: Check Server Logs

**While running `pnpm dev`, watch for:**

```javascript
// ✅ GOOD - Should see:
[Chat API] GROQ_API_KEY is properly set
// or
(no warning about GROQ_API_KEY)

// ❌ BAD - Should NOT see:
[Chat API] CRITICAL: GROQ_API_KEY is not set
[Chat API] Groq API authentication failed
```

### Step 3: Test the Chatbot

1. **Open the app** and navigate to any page
2. **Click the chatbot button** (bottom right)
3. **Send a simple message**: "Hi"
4. **Expected behavior**:
   - Message appears on your side
   - Loading dots appear with "🤔 Thinking..."
   - After 2-5 seconds, AI response appears
   - No error messages

**If you see an error:**

```
❌ Error: Chat service is not properly configured
→ Your GROQ_API_KEY is likely missing or invalid

❌ Error: I'm currently busy. Please wait a moment
→ Rate limited - wait a bit and try again

❌ Error: Request timed out
→ Groq API is slow or unresponsive - try again

❌ Error: An error occurred while processing
→ Generic error - check browser console for details
```

### Step 4: Check Browser Console

**Open DevTools** (F12) → **Console** tab → Look for messages starting with `[Chat]`:

```javascript
// ✅ GOOD - Should see:
[Chat] Load error: Not logged in (for guest)
// or
[Chat] Loaded chat history...

// ❌ BAD - Should NOT see:
[Chat] Send error: <error details>
```

**If you see errors:**
1. Right-click the error → **Store as global variable** (temp1, temp2, etc.)
2. Type: `console.log(temp1)` to see full details
3. Share the error message in the debugging section below

### Step 5: Network Request Check

1. **Open DevTools** → **Network** tab
2. **Send a message** to the chatbot
3. **Look for `/api/chat` request**:
   - **Status should be 200** (OK)
   - **Response should contain text data** (not HTML error page)
   - **If status is 500, 503, 429**: Shows there's an API error

**If request shows error:**
1. Click the request
2. View the **Response** tab
3. Look for `error` field - this is your error message
4. Compare with troubleshooting guide below

---

## 🐛 Troubleshooting

### Issue: "Chat service is not properly configured"

**Cause**: GROQ_API_KEY is not set or invalid

**Fix**:
1. Get key from: https://console.groq.com/keys
2. Add to `.env.local`: `GROQ_API_KEY=gsk_xxxxx`
3. Run: `pnpm dev`
4. Restart browser and try again

### Issue: "I'm currently busy. Please wait a moment" (429 status)

**Cause**: Rate limited by Groq API

**Fix**:
- Wait 2-3 minutes before trying again
- Consider upgrading Groq tier or adding multiple API keys for round-robin

### Issue: "Request timed out" (15 seconds)

**Cause**: Groq API is slow or not responding

**Fix**:
1. Verify internet connection
2. Check Groq status: https://status.groq.com/
3. Try a shorter message first
4. If persistent, contact Groq support

### Issue: Loading dots appear but never disappear (stuck)

**Cause**: WebSocket connection issue or response streaming broken

**Fix**:
1. Check browser console for WebSocket errors
2. Verify your network doesn't block streaming
3. Try in an incognito/private window
4. Restart the dev server

### Issue: Error appears as a message instead of alert

**Cause**: Expected behavior - errors are now shown as chat messages for UX

**Good Example**:
- You: "Hello"
- AI: "❌ Error: Chat service is not properly configured..."

This is better than a popup because it's part of the conversation history.

---

## 📝 Testing Scenarios

### Scenario 1: Unauthenticated User
1. Log out or use incognito window
2. Send message: "What can I do here?"
3. Expected: AI mentions sign-in options with links

### Scenario 2: Authenticated Client
1. Log in as client user
2. Send message: "Show me my recent cases"
3. Expected: AI uses `getMyDataSummary` tool, shows cases

### Scenario 3: Document Upload
1. Click upload icon
2. Select a PDF/image
3. Expected: Shows "📄 Analyzing Document..." then results

### Scenario 4: Navigation
1. Send: "Take me to my appointments"
2. Expected: "Taking you to..." message then navigates

---

## 🔧 Developer Debugging

### Enable Extra Logging

**Edit `app/api/chat/route.ts`** - add after imports:

```typescript
const DEBUG_CHAT = true; // Set to true for verbose logs

// Then use:
if (DEBUG_CHAT) console.log("[Chat DEBUG]", { messages, currentPath });
```

### Test API Directly

**Using curl:**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hi"}],
    "currentPath": "/client/dashboard"
  }' \
  -v
```

**Expected response**: Stream of text chunks (not JSON)

**If you get JSON error**: The API is returning an error instead of streaming

### Check Groq API Directly

**Using groq-sdk:**
```bash
npx ts-node -e "
import { Groq } from 'groq-sdk';
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
client.chat.completions.create({
  messages: [{ role: 'user', content: 'test' }],
  model: 'llama-3.3-70b-versatile',
}).then(r => console.log('OK:', r.choices[0].message.content))
 .catch(e => console.error('ERROR:', e.message));
"
```

---

## 📊 Performance Notes

- **Response time**: Usually 2-5 seconds for simple questions
- **With tools**: Might take 5-10 seconds (uses reasoning)
- **Long documents**: 10-30 seconds for analysis
- **Rate limits**: Groq free tier has ~500 requests/day

---

## 🆘 Still Not Working?

1. **Check all items in Verification Checklist above**
2. **Review server logs** for `[Chat API]` messages
3. **Check browser console** for `[Chat]` messages
4. **Verify network request** in DevTools Network tab
5. **Test with different browser** (rule out browser cache)
6. **Restart dev server**: Ctrl+C then `pnpm dev`
7. **Clear browser cache**: DevTools → Application → Clear Site Data

---

## 📞 Support Information

When reporting issues, include:
- [ ] Browser console errors (copy full error text)
- [ ] Server log messages (look for `[Chat API]` or `[Chat]`)
- [ ] Network request status code and response
- [ ] `.env.local` snippet (without actual keys, e.g., `GROQ_API_KEY=gsk_...` ✓)
- [ ] Steps to reproduce
- [ ] Expected vs actual behavior

---

**Last Updated**: 2026-05-07
**Status**: In Development - Please test and report issues
