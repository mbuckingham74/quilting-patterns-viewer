# Error Handling Guide

This document describes the error handling architecture for the Quilting Patterns application.

## Overview

The app uses a centralized error handling system that provides:
- Consistent error codes and messages
- User-friendly toast notifications
- React error boundaries for crash recovery
- Automatic retry for transient failures
- Structured logging for debugging
- **Sentry integration** for production error monitoring
- **Graceful degradation** for AI search (falls back to text search)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Side                               │
├─────────────────────────────────────────────────────────────────┤
│  Components                                                      │
│  ├── useToast() hook → Toast notifications                      │
│  ├── useFetch() hook → Fetch with retry + error display         │
│  └── <ErrorBoundary> → Catches React render errors              │
├─────────────────────────────────────────────────────────────────┤
│  lib/errors.ts                                                   │
│  ├── ErrorCode enum → Standardized error codes                  │
│  ├── parseError() → Parse any error into structured format      │
│  └── parseResponseError() → Parse HTTP response errors          │
├─────────────────────────────────────────────────────────────────┤
│  lib/fetch-with-retry.ts                                         │
│  └── fetchWithRetry() → Automatic retry with backoff            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        Server Side                               │
├─────────────────────────────────────────────────────────────────┤
│  API Routes                                                      │
│  └── lib/api-response.ts                                        │
│      ├── unauthorized() → 401 responses                         │
│      ├── badRequest() → 400 responses                           │
│      ├── notFound() → 404 responses                             │
│      ├── conflict() → 409 responses                             │
│      ├── rateLimited() → 429 responses                          │
│      ├── internalError() → 500 responses + logging              │
│      └── serviceUnavailable() → 503 responses                   │
├─────────────────────────────────────────────────────────────────┤
│  Next.js Error Pages                                             │
│  ├── app/error.tsx → Route-level errors                         │
│  └── app/global-error.tsx → Root layout errors                  │
└─────────────────────────────────────────────────────────────────┘
```

## Error Codes

All errors use standardized codes defined in `lib/errors.ts`:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_REQUIRED` | 401 | User must sign in |
| `AUTH_EXPIRED` | 401 | Session expired |
| `AUTH_INVALID` | 401 | Invalid credentials |
| `AUTH_FORBIDDEN` | 403 | Insufficient permissions |
| `VALIDATION_FAILED` | 400 | Invalid input |
| `INVALID_INPUT` | 400 | Malformed request |
| `MISSING_REQUIRED` | 400 | Required field missing |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `ALREADY_EXISTS` | 409 | Duplicate resource |
| `CONFLICT` | 409 | Operation conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | External service down |
| `EXTERNAL_SERVICE_ERROR` | 503 | Third-party API error |
| `NETWORK_ERROR` | - | Client network issue |
| `TIMEOUT` | - | Request timed out |
| `UNKNOWN` | - | Unclassified error |

## Client-Side Usage

### Toast Notifications

The `useToast()` hook provides methods for displaying notifications:

```tsx
import { useToast } from '@/components/Toast'

function MyComponent() {
  const { showError, showSuccess, showToast } = useToast()

  const handleAction = async () => {
    try {
      await doSomething()
      showSuccess('Action completed!')
    } catch (error) {
      // Automatically parses error and shows user-friendly message
      showError(error, 'Failed to complete action')
    }
  }
}
```

Toast types:
- `success` - Green, auto-dismisses in 5s
- `error` - Red, auto-dismisses in 7s (persistent for auth errors)
- `warning` - Amber, auto-dismisses in 5s
- `info` - Blue, auto-dismisses in 5s

### Fetch with Retry

Use `fetchWithRetry()` for API calls that should retry on transient failures:

```tsx
import { fetchWithRetry, postWithRetry } from '@/lib/fetch-with-retry'

// GET request with retry
const result = await fetchWithRetry<Pattern[]>('/api/patterns')
if (result.error) {
  console.log(`Failed after ${result.attempts} attempts`)
}

// POST request with retry
const result = await postWithRetry<SearchResult>(
  '/api/search',
  { query: 'flowers' },
  {
    maxRetries: 3,
    timeout: 30000,
    onRetry: (attempt, error, delay) => {
      console.log(`Retry ${attempt} in ${delay}ms: ${error.message}`)
    }
  }
)
```

### useFetch Hook

For React components, use the `useFetch()` hook:

```tsx
import { useFetch } from '@/hooks/useFetch'

function SearchResults({ query }: { query: string }) {
  const { data, error, isLoading, isRetrying, execute } = useFetch<Pattern[]>(
    '/api/search',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    },
    {
      showErrorToast: true,      // Auto-show toast on error
      errorContext: 'Search',    // Prefix for error message
      maxRetries: 2,
    }
  )

  useEffect(() => {
    if (query) execute()
  }, [query, execute])

  if (isLoading) return <Spinner />
  if (isRetrying) return <div>Retrying...</div>
  if (error) return <ErrorMessage error={error} />
  return <PatternGrid patterns={data} />
}
```

### Error Boundaries

Wrap components that might throw render errors:

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Basic usage
<ErrorBoundary component="PatternGrid">
  <PatternGrid patterns={patterns} />
</ErrorBoundary>

// With custom fallback
<ErrorBoundary
  component="SearchResults"
  fallback={<div>Search is temporarily unavailable</div>}
  onError={(error, info) => logToService(error)}
>
  <SearchResults />
</ErrorBoundary>

// Using HOC
const SafePatternCard = withErrorBoundary(PatternCard)
```

## Server-Side Usage

### API Route Responses

Use the helper functions from `lib/api-response.ts`:

```typescript
import {
  unauthorized,
  badRequest,
  notFound,
  conflict,
  rateLimited,
  internalError,
  serviceUnavailable
} from '@/lib/api-response'

export async function POST(request: Request) {
  try {
    // Auth check
    const user = await getUser()
    if (!user) {
      return unauthorized()
    }

    // Validation
    const { email } = await request.json()
    if (!email) {
      return badRequest('Email is required')
    }

    // Rate limiting
    if (isRateLimited(user.id)) {
      return rateLimited(60) // Retry after 60 seconds
    }

    // Business logic
    const result = await doSomething(email)
    if (!result) {
      return notFound('User not found')
    }

    return NextResponse.json({ data: result })

  } catch (error) {
    // Logs error and returns 500
    return internalError(error, {
      action: 'create_user',
      userId: user?.id
    })
  }
}
```

### Response Format

All error responses follow this structure:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "retryable": true,
  "details": { ... }
}
```

The `code` field allows clients to handle specific errors programmatically:

```typescript
const response = await fetch('/api/search', { ... })
if (!response.ok) {
  const { code } = await response.json()
  if (code === 'RATE_LIMITED') {
    const retryAfter = response.headers.get('Retry-After')
    showToast(`Please wait ${retryAfter} seconds`)
  }
}
```

## Error Logging

Errors are logged using `logError()` from `lib/errors.ts`:

```typescript
import { logError } from '@/lib/errors'

try {
  await riskyOperation()
} catch (error) {
  logError(error, {
    component: 'PatternUpload',
    action: 'upload_file',
    userId: user.id,
    fileSize: file.size,
  })
}
```

Log output includes:
- Parsed error code and message
- Timestamp
- Context metadata
- Original error details (name, message, stack)

In development, logs go to console. In production, errors are automatically sent to Sentry (see below).

## Retry Behavior

### Which Errors Are Retryable?

| Error Code | Retryable | Reason |
|------------|-----------|--------|
| `NETWORK_ERROR` | Yes | Temporary connectivity issue |
| `TIMEOUT` | Yes | Server may be slow |
| `SERVICE_UNAVAILABLE` | Yes | External service may recover |
| `EXTERNAL_SERVICE_ERROR` | Yes | Third-party API may recover |
| `RATE_LIMITED` | Yes | After Retry-After delay |
| `AUTH_*` | No | Requires user action |
| `VALIDATION_FAILED` | No | Bad input won't change |
| `NOT_FOUND` | No | Resource doesn't exist |
| `CONFLICT` | No | Requires conflict resolution |
| `INTERNAL_ERROR` | No | Server bug, needs fix |

### Backoff Strategy

`fetchWithRetry()` uses exponential backoff with jitter:

```
delay = min(baseDelay * 2^attempt * jitter, maxDelay)

Where:
- baseDelay = 1000ms (default)
- maxDelay = 10000ms (default)
- jitter = random factor between 0.75 and 1.25
```

For rate-limited responses, the `Retry-After` header is respected.

## Next.js Error Pages

### Route Errors (`app/error.tsx`)

Catches errors in page components and API routes:

```tsx
'use client'

export default function Error({ error, reset }) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

### Global Errors (`app/global-error.tsx`)

Catches errors in the root layout (must include `<html>` and `<body>`):

```tsx
'use client'

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body>
        <h2>Application Error</h2>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  )
}
```

## Best Practices

### DO:

1. **Use error codes, not strings** for programmatic handling
2. **Show user-friendly messages** via toasts, not raw error text
3. **Log context** with errors for debugging
4. **Use retry** for network operations
5. **Wrap risky components** in error boundaries
6. **Handle auth errors specially** - prompt re-login

### DON'T:

1. **Swallow errors silently** - always log or display
2. **Show stack traces to users** - only in development
3. **Retry non-retryable errors** - wastes resources
4. **Block UI on errors** - show fallback content
5. **Expose internal details** in API error messages

## File Reference

| File | Purpose |
|------|---------|
| `lib/errors.ts` | Error codes, parsing, Sentry integration |
| `lib/api-response.ts` | API route response helpers |
| `lib/fetch-with-retry.ts` | Fetch wrapper with retry logic |
| `hooks/useFetch.ts` | React hook for fetch with retry |
| `components/Toast.tsx` | Toast notification system |
| `components/ErrorBoundary.tsx` | React error boundary |
| `app/error.tsx` | Next.js route error page |
| `app/global-error.tsx` | Next.js global error page |
| `sentry.client.config.ts` | Browser-side Sentry initialization |
| `sentry.server.config.ts` | Server-side Sentry initialization |
| `sentry.edge.config.ts` | Edge runtime Sentry initialization |

## Extending the System

### Adding a New Error Code

1. Add to `ErrorCode` enum in `lib/errors.ts`
2. Add user message to `ErrorMessages`
3. Update `isRetryableError()` if needed
4. Update `httpStatusToErrorCode()` if HTTP-related

### Sentry Integration

Sentry is already integrated. See the next section for details.

### Custom Toast Types

Add new types in `components/Toast.tsx`:

```tsx
const config = {
  success: { bg: 'bg-green-50', ... },
  error: { bg: 'bg-red-50', ... },
  // Add new type
  upload: {
    bg: 'bg-indigo-50 border-indigo-200',
    icon: 'text-indigo-600',
    iconPath: '...'
  },
}
```

## Sentry Integration

The app uses [Sentry](https://sentry.io) for production error monitoring. Errors are automatically captured and sent to Sentry with context.

### Configuration Files

| File | Purpose |
|------|---------|
| `sentry.client.config.ts` | Browser-side Sentry initialization |
| `sentry.server.config.ts` | Server-side Sentry initialization |
| `sentry.edge.config.ts` | Edge runtime Sentry initialization |

### Setup

1. Create a Sentry project at https://sentry.io
2. Get your DSN from Project Settings → Client Keys
3. Add to environment variables:

```bash
# Production environment (.env or docker-compose)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

Sentry only activates in production when `NEXT_PUBLIC_SENTRY_DSN` is set. In development, errors only log to console.

### How Errors Are Captured

The `logError()` function in `lib/errors.ts` automatically sends errors to Sentry:

```typescript
import { logError } from '@/lib/errors'

try {
  await riskyOperation()
} catch (error) {
  logError(error, {
    component: 'PatternUpload',
    action: 'upload_file',
    userId: user.id,
  })
}
```

This captures:
- Error message and stack trace
- Error code tag (e.g., `AUTH_EXPIRED`, `RATE_LIMITED`)
- Retryable flag
- Component and action tags
- User ID (if provided)
- Custom context as extras

### User Context

Set user context after login for better debugging:

```typescript
import { setErrorUser, clearErrorUser } from '@/lib/errors'

// After successful login
setErrorUser(user.id, user.email)

// After logout
clearErrorUser()
```

### Breadcrumbs

Add breadcrumbs to trace user actions leading to errors:

```typescript
import { addErrorBreadcrumb } from '@/lib/errors'

// Track user actions
addErrorBreadcrumb('Clicked download button', 'user', { patternId: 123 })
addErrorBreadcrumb('API request started', 'http', { endpoint: '/api/download' })
```

### Filtering in Sentry

Use tags to filter errors:
- `error_code`: Filter by error type (e.g., `RATE_LIMITED`)
- `component`: Filter by component name
- `action`: Filter by action type
- `retryable`: Filter by retryable status

## Graceful Degradation

The app implements graceful degradation for critical features to ensure functionality even when external services fail.

### AI Search Fallback

When the Voyage AI embedding service is unavailable, search automatically falls back to text-based search:

**How it works:**

1. User enters search query
2. App tries semantic search via Voyage AI
3. If Voyage API fails (network error, rate limit, timeout), falls back to text search
4. Text search matches against `file_name`, `author`, and `notes` fields
5. UI shows subtle indicator: "Using text search (AI search temporarily unavailable)"

**Response Format:**

```json
{
  "patterns": [...],
  "searchMethod": "semantic" | "text",
  "fallbackUsed": true | false
}
```

**Fallback triggers:**
- `VOYAGE_API_KEY` not configured
- Voyage API returns non-2xx response
- Network error or timeout
- Any exception during embedding

**UI Indicator:**

The `AISearchBar` component shows an amber message when fallback is used:

```
ⓘ Using text search (AI search temporarily unavailable)
```

This appears below the search bar after a search completes with fallback.

### Implementing Fallback for Other Services

Follow this pattern for other external services:

```typescript
async function serviceWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  context: string
): Promise<{ result: T; usedFallback: boolean }> {
  try {
    const result = await primary()
    return { result, usedFallback: false }
  } catch (error) {
    logError(error, { component: context, action: 'primary_service_failed' })
    const result = await fallback()
    return { result, usedFallback: true }
  }
}
```

### Future Graceful Degradation Candidates

- **Thumbnail loading**: Fall back to placeholder on storage errors
- **Email notifications**: Queue for retry if Resend API fails
- **Auth refresh**: Graceful session recovery on token expiry
