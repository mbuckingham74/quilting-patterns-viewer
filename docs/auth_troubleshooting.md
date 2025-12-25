# Authentication Troubleshooting Guide

## Common Issues & Solutions

### Issue: AuthButton shows loading skeleton forever / Auth info takes 10+ seconds to appear

**Symptoms:**
- User is logged in (can see patterns, server-side auth works)
- AuthButton in header shows gray loading skeleton
- Eventually (after 10+ seconds) the email/Account/Sign out appears
- Console may show timeout errors

**Root Cause:**
Using `supabase.auth.getUser()` instead of `supabase.auth.getSession()`.

- `getUser()` makes a **network request** to Supabase to verify the token
- `getSession()` reads from **local storage/cookies** (instant)

**Solution:**
In client components, always use `getSession()` for initial auth state:

```typescript
// SLOW - makes network request
const { data: { user } } = await supabase.auth.getUser()

// FAST - reads from local storage
const { data: { session } } = await supabase.auth.getSession()
const user = session?.user ?? null
```

**Fixed in commit:** `dc37a65` (Dec 24, 2025)

---

### Issue: React Hydration Error #418 in AuthButton

**Symptoms:**
- Console shows "Minified React error #418"
- AuthButton doesn't render or gets stuck
- Error mentions hydration mismatch

**Root Cause:**
Server renders one thing, client renders something different. Common with auth components because server doesn't have access to browser cookies/session.

**Solution:**
1. Add a `mounted` state that starts as `false`
2. Only run auth logic AFTER component is mounted on client
3. Return consistent skeleton during SSR and initial mount

```typescript
const [mounted, setMounted] = useState(false)

useEffect(() => {
  setMounted(true)
}, [])

useEffect(() => {
  if (!mounted) return
  // Auth logic here...
}, [mounted])

if (!mounted || loading) {
  return <LoadingSkeleton />
}
```

**Fixed in commit:** `d75c3d0` (Dec 24, 2025)

---

### Issue: OAuth callback fails with "Invalid authentication credentials"

**Symptoms:**
- User authenticates with Google successfully
- Callback route logs "Exchange code error: Invalid authentication credentials"
- User redirected back to landing page

**Root Causes:**
1. **Double code exchange:** OAuth codes are single-use. Calling `exchangeCodeForSession(code)` twice will fail.
2. **PKCE verifier cookie not sent:** The code verifier cookie must be present when exchanging.

**Solution:**
Only call `exchangeCodeForSession` once, and collect cookies properly:

```typescript
const cookiesToSetLater = []

const supabase = createServerClient(url, key, {
  cookies: {
    getAll() { return request.cookies.getAll() },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(c => cookiesToSetLater.push(c))
    },
  },
})

const { data, error } = await supabase.auth.exchangeCodeForSession(code)

// Apply cookies AFTER exchange
cookiesToSetLater.forEach(({ name, value, options }) => {
  response.cookies.set(name, value, { ...options })
})
```

**Fixed in commit:** `47e25cb` (Dec 24, 2025)

---

### Issue: 502 Bad Gateway on OAuth callback

**Symptoms:**
- OAuth flow works up to callback
- Callback returns 502 Bad Gateway
- NPM logs show "upstream sent too big header"

**Root Cause:**
Nginx Proxy Manager's default proxy buffer size (4KB) is too small for Supabase's large JWT cookies.

**Solution:**
Create `/data/nginx/custom/server_proxy.conf` in NPM container:

```nginx
proxy_buffer_size 128k;
proxy_buffers 4 256k;
proxy_busy_buffers_size 256k;
```

Then reload: `docker exec nginx-proxy-manager nginx -s reload`

**Note:** This file may be lost if NPM container is recreated.

---

### Issue: "JWT issued in the future" error

**Symptoms:**
- Auth fails with clock-related error
- Works sometimes, fails other times

**Root Cause:**
Clock skew between Supabase server and client browser.

**Solution:**
Add clock skew tolerance to Supabase auth config:

```bash
# In /home/michael/docker-configs/supabase/.env
GOTRUE_JWT_CLOCK_SKEW_LEEWAY=10
```

Then restart auth: `docker compose restart auth`

---

## RECOMMENDED: Server-Side Auth Pattern

The most robust approach is to fetch auth on the server and pass it to a minimal client component:

**AuthButtonServer.tsx** (Server Component - fetches auth):
```typescript
import { createClient } from '@/lib/supabase/server'
import AuthButtonClient from './AuthButtonClient'

export default async function AuthButtonServer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <Link href="/auth/login">Sign in</Link>
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return (
    <AuthButtonClient
      email={user.email || ''}
      isAdmin={profile?.is_admin ?? false}
    />
  )
}
```

**AuthButtonClient.tsx** (Client Component - only for sign out):
```typescript
'use client'

export default function AuthButtonClient({ email, isAdmin }) {
  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div>
      <span>{email}</span>
      {isAdmin && <Link href="/admin">Admin</Link>}
      <Link href="/account">Account</Link>
      <button onClick={handleSignOut}>Sign out</button>
    </div>
  )
}
```

**Why this is better:**
- Auth fetched during SSR (same request as page data)
- No client-side network calls
- No loading skeleton - instant render
- No hydration mismatches

---

## Fallback: Client-Side AuthButton Pattern

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthButton() {
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Step 1: Track mount state
  useEffect(() => {
    setMounted(true)
  }, [])

  // Step 2: Only init auth after mounted
  useEffect(() => {
    if (!mounted) return

    const supabase = createClient()

    const initAuth = async () => {
      // Step 3: Use getSession, NOT getUser
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    initAuth()

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    )

    return () => subscription.unsubscribe()
  }, [mounted])

  // Step 4: Consistent skeleton during SSR
  if (!mounted || loading) {
    return <div className="skeleton" />
  }

  // Render based on user state
  return user ? <LoggedInUI /> : <SignInButton />
}
```

## Files Reference

- Auth callback: `app/src/app/auth/callback/route.ts`
- Auth signin: `app/src/app/auth/signin/route.ts`
- AuthButton: `app/src/components/AuthButton.tsx`
- Supabase client: `app/src/lib/supabase/client.ts`
- Supabase server: `app/src/lib/supabase/server.ts`
