# Google OAuth Setup & Troubleshooting

## Overview

This app uses Google OAuth via Supabase for authentication. The flow is:

1. User clicks "Sign in with Google" on landing page
2. App redirects to `/auth/signin` (route handler)
3. Route handler initiates OAuth with Supabase, sets PKCE cookie, redirects to Google
4. User authenticates with Google
5. Google redirects to Supabase callback (`base.tachyonfuture.com/auth/v1/callback`)
6. Supabase redirects to our app callback (`/auth/callback?code=...`)
7. Our callback exchanges the code for a session and sets auth cookies

## Configuration

### Google Cloud Console

- Project: (your project)
- OAuth 2.0 Client ID: `<your-client-id>.apps.googleusercontent.com`
- Authorized redirect URI: `https://base.tachyonfuture.com/auth/v1/callback`

### Supabase (.env on server)

Located at `/home/michael/docker-configs/supabase/.env`:

```bash
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOTRUE_EXTERNAL_GOOGLE_SECRET=<your-client-secret>
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://base.tachyonfuture.com/auth/v1/callback
ADDITIONAL_REDIRECT_URLS=https://patterns.tachyonfuture.com/**
```

## Issues We Encountered & Solutions

### Issue 1: PKCE Code Verifier Not Found

**Symptom:** After Google authentication, callback fails with error:
```
AuthPKCECodeVerifierMissingError: PKCE code verifier not found in storage
```

**Root Cause:** Client-side OAuth initiation (`signInWithOAuth` in browser) stores the PKCE code verifier in cookies, but cookie handling across the OAuth redirect flow was unreliable.

**Solution:** Move OAuth initiation to a server-side route handler (`/auth/signin/route.ts`) instead of client-side JavaScript. The route handler:
1. Creates a Supabase client with proper cookie handling
2. Calls `signInWithOAuth` which generates the PKCE verifier
3. Sets the verifier cookie in the response
4. Redirects to Google

This ensures cookies are set via HTTP headers rather than client-side JavaScript.

### Issue 2: 502 Bad Gateway on Callback

**Symptom:** After successful Google authentication, the callback URL returns 502 Bad Gateway.

**Root Cause:** Nginx Proxy Manager's default proxy buffer size (4KB) is too small for Supabase's auth session cookies, which are quite large (contain JWT tokens).

The NPM error log showed:
```
upstream sent too big header while reading response header from upstream
```

**Solution:** Add custom Nginx configuration to increase proxy buffer sizes.

Created `/data/nginx/custom/server_proxy.conf` in the NPM container:
```nginx
proxy_buffer_size 128k;
proxy_buffers 4 256k;
proxy_busy_buffers_size 256k;
```

Then reload Nginx:
```bash
docker exec nginx-proxy-manager nginx -t && docker exec nginx-proxy-manager nginx -s reload
```

**Important:** This file may be lost if NPM container is recreated. Consider adding to a persistent volume or documenting in deployment notes.

## Key Files

- `/auth/signin/route.ts` - Initiates OAuth flow (server-side)
- `/auth/callback/route.ts` - Handles OAuth callback, exchanges code for session
- `/lib/supabase/server.ts` - Server-side Supabase client
- `/lib/supabase/client.ts` - Browser-side Supabase client
- `/lib/supabase/middleware.ts` - Session refresh middleware

## Debugging Tips

### Check NPM Error Logs
```bash
ssh michael@tachyonfuture.com 'docker exec nginx-proxy-manager tail -50 /data/logs/proxy-host-35_error.log'
```

### Check App Container Logs
```bash
ssh michael@tachyonfuture.com 'docker logs quilting-patterns --tail 50'
```

### Test OAuth Flow Manually
```bash
# Test signin route (should redirect to Google with Set-Cookie header)
curl -s -I https://patterns.tachyonfuture.com/auth/signin

# Test callback route (should return 307 redirect)
curl -s -I "https://patterns.tachyonfuture.com/auth/callback?code=test"
```

### Restart Supabase Auth
```bash
ssh michael@tachyonfuture.com 'cd /home/michael/docker-configs/supabase && docker compose restart auth'
```
