# Test Coverage Documentation

Last updated: January 7, 2026

## Summary

| Metric     | Coverage |
|------------|----------|
| Statements | 47.45%   |
| Branches   | 43.39%   |
| Functions  | 38.67%   |
| Lines      | 47.91%   |

**Total Tests:** 437 across 29 test files

## Running Tests

```bash
# Run all tests
cd app && npm run test:run

# Run tests with coverage report
cd app && npm run test:coverage

# Run tests in watch mode
cd app && npm test
```

## What's Covered

### Library Utilities (src/lib/) - 83.72% statements

| File               | Statements | Branches | Functions | Lines   |
|--------------------|------------|----------|-----------|---------|
| filename.ts        | 100%       | 100%     | 100%      | 100%    |
| fetch-with-retry.ts| 91.30%     | 84%      | 90.9%     | 90.9%   |
| api-response.ts    | 84.44%     | 71.73%   | 100%      | 84.44%  |
| errors.ts          | 77.33%     | 76.05%   | 66.66%    | 80.55%  |

**Test files:**
- `src/lib/filename.test.ts` - 32 tests
- `src/lib/errors.test.ts` - 32 tests
- `src/lib/api-response.test.ts` - 35 tests
- `src/lib/fetch-with-retry.test.ts` - 19 tests
- `src/app/api/search/route.test.ts` - 20 tests
- `src/app/api/search/rateLimit.test.ts` - 8 tests
- `src/app/auth/callback/route.test.ts` - 18 tests
- `src/app/auth/signin/route.test.ts` - 14 tests
- `src/app/api/admin/upload/route.test.ts` - 18 tests
- `src/hooks/useFetch.test.ts` - 25 tests

### API Routes - Variable coverage

#### Fully Covered (100%)

| Route                          | Tests |
|--------------------------------|-------|
| /api/favorites                 | 9     |
| /api/favorites/[id]            | 5     |
| /api/saved-searches            | 11    |
| /api/saved-searches/[id]       | 5     |
| /api/admin/duplicates          | 14    |
| /api/admin/duplicates/review   | 12    |
| /api/admin/users               | 4     |
| /api/admin/users/[id]/approve  | 6     |
| /api/admin/users/[id]/reject   | 6     |

#### Mostly Covered (85%+)

| Route                          | Statements | Tests |
|--------------------------------|------------|-------|
| /api/shares                    | 86.66%     | 13    |
| /api/shares/[token]            | 95.83%     | 8     |
| /api/shares/[token]/feedback   | 98.11%     | 13    |

#### Partially Covered

| Route                          | Statements | Notes                    |
|--------------------------------|------------|--------------------------|
| /api/download/[id]             | covered    | 9 tests                  |
| /api/admin/notify-signup       | covered    | 7 tests                  |

#### Auth Routes (NEW - fully covered)

| Route                          | Tests | Notes                         |
|--------------------------------|-------|-------------------------------|
| /auth/callback                 | 18    | OAuth callback, profile creation, redirect validation |
| /auth/signin                   | 14    | OAuth initiation, cookie handling |
| /api/search                    | 20    | Auth, rate limiting, semantic/text search paths |

#### Admin Upload (NEW - fully covered)

| Route                          | Tests | Notes                         |
|--------------------------------|-------|-------------------------------|
| /api/admin/upload              | 18    | File upload, ZIP processing, storage, auth |

## What's NOT Covered

### React Components (mostly 0%)

Components with coverage:
- **Toast.tsx** - 22 tests (context, provider, auto-dismiss, error handling)
- **ErrorBoundary.tsx** - 24 tests (error catching, fallback UI, HOC, retry)
- **AuthButton.tsx** - 13 tests (loading state, auth states, admin detection, sign out)
- **PatternCard.tsx** - 20 tests (rendering, favorite/share buttons, edge cases)
- **SearchBar.tsx** - 17 tests (form submission, clear button, param handling)

Components still at 0% coverage:
- AISearchBar.tsx
- AccountContent.tsx
- AdminUploadForm.tsx
- AdminUserList.tsx
- AuthButtonClient.tsx / AuthButtonServer.tsx
- AuthTabs.tsx
- BrowseContent.tsx
- DuplicateReview.tsx
- FavoriteButton.tsx
- KeywordFilter.tsx / KeywordSidebar.tsx
- LandingPage.tsx
- Pagination.tsx
- PatternGrid.tsx / PatternRanker.tsx
- SaveSearchButton.tsx
- ShareBasket.tsx / ShareButton.tsx / ShareModal.tsx

### Pages (0%)

- /auth/login/page.tsx
- /auth/signup/page.tsx
- /browse/page.tsx
- /contact/page.tsx
- /patterns/[id]/page.tsx
- /pending-approval/page.tsx
- /share/[token]/page.tsx

### React Hooks (src/hooks/) - 100% statements

| File        | Statements | Branches | Functions | Lines |
|-------------|------------|----------|-----------|-------|
| useFetch.ts | 100%       | 89.65%   | 100%      | 100%  |

**Test file:** `src/hooks/useFetch.test.ts` - 25 tests

### Other (0%)

- src/contexts/ShareContext.tsx
- src/lib/supabase/client.ts
- src/lib/supabase/server.ts
- src/lib/supabase/middleware.ts

## Where to Pick Up Next

### High Priority (Critical paths, low coverage)

1. **Core components** ✅ Completed
   - ErrorBoundary.tsx - Error handling UI
   - Toast.tsx - Notification system
   - AuthButton.tsx - Auth state handling

### Medium Priority (UI components)

2. **Browse/display components** (Partially done)
   - PatternGrid.tsx ← Next priority
   - ~~PatternCard.tsx~~ ✅ Done
   - ~~SearchBar.tsx~~ ✅ Done
   - KeywordFilter.tsx
   - Complexity: React Testing Library + visual testing

3. **Share flow components**
   - ShareModal.tsx, ShareBasket.tsx, PatternRanker.tsx
   - Complexity: Complex state management

## Recent Progress

### January 7, 2026 (Evening)

Added tests for more React components (50 new tests):

- **AuthButton.tsx** (`src/components/AuthButton.test.tsx`) - 13 tests
  - Loading skeleton state
  - Unauthenticated state (Sign in link)
  - Authenticated state (email display, Account link, Sign out button)
  - Admin role detection and Admin link display
  - Sign out with redirect
  - Auth state change subscription/unsubscription
  - Session and profile error handling

- **PatternCard.tsx** (`src/components/PatternCard.test.tsx`) - 20 tests
  - Pattern name rendering with fallback for empty names
  - Thumbnail display with placeholder when missing
  - Author display (conditional)
  - File extension badge
  - Link to pattern detail page
  - FavoriteButton conditional rendering and toggle
  - ShareButton conditional rendering
  - Edge cases (minimal data, long names with truncation)

- **SearchBar.tsx** (`src/components/SearchBar.test.tsx`) - 17 tests
  - Input rendering with search param initialization
  - Value changes on typing (no navigation)
  - Form submission with search param
  - Empty search clears param
  - Page param reset on new search
  - Other params preserved
  - Clear button visibility
  - Clear button functionality (clears input, navigates, resets page)
  - Accessibility (input type, button type)

### January 8, 2026

Added React component testing infrastructure:
- Installed `@testing-library/jest-dom` for DOM matchers
- Added `src/test/setup.ts` for vitest setup
- Configured `vitest.config.ts` with setupFiles

Added tests for core UI components:

- **Toast.tsx** (`src/components/Toast.test.tsx`) - 22 tests
  - useToast hook context validation
  - showToast with unique IDs and auto-dismiss
  - Duration handling (default 5s, error 7s, persistent with 0)
  - Max toasts limit (5)
  - dismissToast with timer cleanup
  - showSuccess with correct styling
  - showError with error parsing, context, auth actions, rate limit display
  - ToastItem dismiss button and action buttons
  - ToastContainer accessibility (aria-live)

- **ErrorBoundary.tsx** (`src/components/ErrorBoundary.test.tsx`) - 24 tests
  - Normal render without errors
  - Error catching with default fallback
  - Custom fallback support
  - logError with component context
  - onError callback
  - Retry functionality
  - Development error details visibility
  - PageErrorFallback component
  - withErrorBoundary HOC (displayName, props passthrough, options)

### January 7, 2026

Added React hook testing infrastructure and tests for:

- **useFetch Hook** (`src/hooks/useFetch.ts`) - 25 tests
  - Initial state verification
  - Successful fetch with data transformation
  - Loading and retrying state management
  - Error handling with toast notifications
  - onSuccess/onError callbacks
  - Abort behavior for concurrent requests
  - Reset functionality
  - Transform error handling
  - usePost convenience hook
  - useMutation hook for mutations

Added comprehensive tests for:

- **Search API** (`/api/search`) - 20 tests
  - Authentication requirements (401 for unauthenticated)
  - Query validation (length limits 2-500 chars)
  - Rate limiting (429 with Retry-After header)
  - Limit parameter clamping (max 100)
  - Text search fallback when Voyage API unavailable
  - Semantic search with Voyage AI mocking
  - Graceful fallback on API errors, network errors, RPC failures

- **Auth Callback** (`/auth/callback`) - 18 tests
  - Code parameter validation
  - Origin validation (prevent open redirects)
  - Next parameter validation (relative paths only)
  - Code exchange error handling
  - Existing user flow (approved vs unapproved)
  - New user flow (profile creation, admin notification)
  - Cookie handling (PKCE verifier)

- **Auth Signin** (`/auth/signin`) - 14 tests
  - OAuth initiation with Google
  - Correct redirect callback URL
  - Query parameters (offline access, consent prompt)
  - Origin detection from headers
  - Error handling for OAuth failures
  - Cookie handling for PKCE flow

- **Admin Upload** (`/api/admin/upload`) - 18 tests
  - Authentication (401 unauthenticated)
  - Authorization (403 non-admin)
  - File validation (ZIP required, must contain .qli files)
  - Duplicate detection and skipping
  - Successful upload with pattern processing
  - Nested folder structure in ZIP files
  - Storage upload error handling with cleanup
  - Database error handling with cleanup
  - Summary reporting with mixed results

## Test Patterns Used

### Mocking Supabase Client

```typescript
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

function createMockSupabase(options: {
  user?: { id: string } | null
  // ... other options
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table) => {
      // Return appropriate mock based on table
    }),
  }
}
```

### Dynamic Import for Env Vars

For routes that read env vars at module load time:

```typescript
let GET: typeof import('./route').GET

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

  const module = await import('./route')
  GET = module.GET
})
```

### Testing Next.js Route Handlers

```typescript
function createRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/endpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

it('returns 400 for invalid input', async () => {
  const response = await POST(createRequest({ invalid: 'data' }))
  expect(response.status).toBe(400)
})
```

### Testing React Hooks with jsdom

Use inline environment config and React Testing Library:

```typescript
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Mock dependencies
vi.mock('@/lib/fetch-with-retry', () => ({
  fetchWithRetry: vi.fn(),
}))

vi.mock('@/components/Toast', () => ({
  useToast: vi.fn(() => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
  })),
}))

import { useFetch } from './useFetch'
import { fetchWithRetry } from '@/lib/fetch-with-retry'

it('fetches data successfully', async () => {
  vi.mocked(fetchWithRetry).mockResolvedValueOnce({
    data: { id: 1 },
    error: null,
    attempts: 1,
  })

  const { result } = renderHook(() => useFetch('/api/test'))

  await act(async () => {
    await result.current.execute()
  })

  expect(result.current.data).toEqual({ id: 1 })
})
```

## Configuration

### vitest.config.ts

```typescript
export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/app/layout.tsx',
        'src/app/global-error.tsx',
        'src/instrumentation-client.ts',
        'src/instrumentation.ts',
        'node_modules/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

## Coverage Reports

HTML coverage reports are generated in `app/coverage/` when running `npm run test:coverage`. Open `coverage/index.html` in a browser for a detailed interactive view.
