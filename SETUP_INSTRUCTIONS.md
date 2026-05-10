# WiseCase - Environment Setup Instructions

## 🔧 Supabase Connection Setup

### Step 1: Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project (or create a new one)
3. Go to **Settings** → **API**
4. Copy the following:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys" → "anon public")

### Step 2: Create .env.local File

1. In the root directory of your project, create a file named `.env.local`
2. **IMPORTANT**: The file must be named exactly `.env.local` (not `.env`, not `.env.local.txt`)
3. Add the following content:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback
```

### Step 3: Replace Placeholder Values

Replace:
- `https://your-project-id.supabase.co` with your actual Supabase Project URL
- `your-anon-key-here` with your actual Supabase anon key

**Example:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODk2NzI4MCwiZXhwIjoxOTU0NTQzMjgwfQ.example
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback
```

### Step 4: Restart Development Server

**CRITICAL**: After creating or updating `.env.local`, you MUST restart your development server:

1. Stop the current server (Ctrl+C)
2. Start it again:
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

### Step 5: Verify Connection

1. Open browser console (F12)
2. Try to register a new account
3. Check for any Supabase connection errors
4. Check Supabase Dashboard → Authentication → Users to see if user was created

## 🐛 Troubleshooting

### Issue: "Missing Supabase environment variables" error

**Solution:**
1. Check that `.env.local` file exists in the root directory (same level as `package.json`)
2. Check that variable names are exactly:
   - `NEXT_PUBLIC_SUPABASE_URL` (not `SUPABASE_URL`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not `SUPABASE_KEY`)
3. Check that there are no spaces around the `=` sign
4. Check that values don't have quotes (unless the value itself contains spaces)
5. **Restart your dev server** after making changes

### Issue: Users not appearing in Supabase

**Possible causes:**
1. Wrong Supabase URL or key
2. Dev server not restarted after creating `.env.local`
3. Email confirmation required (check Supabase Auth settings)
4. RLS policies blocking inserts

**Solution:**
1. Verify credentials in Supabase Dashboard
2. Check browser console for errors
3. Check Supabase Dashboard → Logs for API errors
4. Verify trigger `on_auth_user_created` exists (from script 010)

### Issue: Environment variables not loading

**Check:**
1. File is named `.env.local` (not `.env.local.txt` or `.env`)
2. File is in root directory (same folder as `package.json`)
3. No syntax errors (no extra spaces, correct format)
4. Dev server was restarted

### Issue: "Invalid API key" or connection errors

**Check:**
1. Copied the correct key (anon/public key, not service_role key)
2. URL is correct (should end with `.supabase.co`)
3. No extra spaces or characters in the values
4. Project is active in Supabase Dashboard

## 📋 Quick Checklist

- [ ] Created `.env.local` file in root directory
- [ ] Added `NEXT_PUBLIC_SUPABASE_URL` with correct value
- [ ] Added `NEXT_PUBLIC_SUPABASE_ANON_KEY` with correct value
- [ ] No quotes around values (unless needed)
- [ ] No spaces around `=` sign
- [ ] Restarted dev server after creating/updating `.env.local`
- [ ] Verified credentials in Supabase Dashboard
- [ ] Tested registration - user appears in Supabase

## 🔍 Verify Your Setup

Run this in your browser console (after starting the app):

```javascript
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing')
```

If you see `undefined`, the environment variables are not loading correctly.

## 📞 Still Having Issues?

1. Check Supabase Dashboard → Settings → API for correct credentials
2. Verify `.env.local` file location and contents
3. Check terminal/console for error messages
4. Ensure dev server was restarted
5. Check Supabase project is active and not paused

