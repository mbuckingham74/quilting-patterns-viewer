# Test Coverage Documentation

Last updated: January 17, 2026

## Summary

| Metric     | Coverage |
|------------|----------|
| Statements | ~54%     |
| Branches   | ~47%     |
| Functions  | ~51%     |
| Lines      | ~54%     |

**Total Tests:** 770 across 53 test files

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
- `src/app/api/admin/upload/route.test.ts` - 21 tests
- `src/hooks/useFetch.test.ts` - 25 tests

### Contexts (src/contexts/) - 100% statements

| File               | Statements | Branches | Functions | Lines   |
|--------------------|------------|----------|-----------|---------|
| ShareContext.tsx   | 100%       | 100%     | 100%      | 100%    |

**Test files:**
- `src/contexts/ShareContext.test.tsx` - 14 tests

### API Routes - Variable coverage

#### Fully Covered (100%)

| Route                               | Tests |
|-------------------------------------|-------|
| /api/favorites                      | 9     |
| /api/favorites/[id]                 | 5     |
| /api/saved-searches                 | 11    |
| /api/saved-searches/[id]            | 5     |
| /api/admin/duplicates               | 14    |
| /api/admin/duplicates/review        | 12    |
| /api/admin/users                    | 4     |
| /api/admin/users/[id]/approve       | 6     |
| /api/admin/users/[id]/reject        | 6     |
| /api/admin/analytics                | 5     |
| /api/admin/analytics/top-patterns   | 5     |
| /api/admin/analytics/top-searches   | 5     |
| /api/admin/analytics/activity       | 5     |
| /api/admin/patterns/[id]            | 11    |
| /api/admin/patterns/[id]/keywords   | 16    |
| /api/keywords                       | 4     |

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

#### Admin Upload (fully covered)

| Route                          | Tests | Notes                         |
|--------------------------------|-------|-------------------------------|
| /api/admin/upload              | 21    | File upload, ZIP processing, storage, auth, error handling |

## What's NOT Covered

### React Components (src/components/) - 47.98% statements

Components with coverage:
- **AISearchBar.tsx** - 25 tests (100% coverage)
- **Toast.tsx** - 22 tests (95.52% coverage)
- **ErrorBoundary.tsx** - 24 tests (100% coverage)
- **AuthButton.tsx** - 13 tests (95.55% coverage)
- **PatternCard.tsx** - 20 tests (100% coverage)
- **SearchBar.tsx** - 17 tests (100% coverage)
- **PatternGrid.tsx** - 17 tests (100% coverage)
- **KeywordFilter.tsx** - 25 tests (100% coverage)
- **ShareButton.tsx** - 13 tests (100% coverage)
- **ShareBasket.tsx** - 19 tests (100% coverage)
- **ShareModal.tsx** - 24 tests (97.67% coverage)
- **FavoriteButton.tsx** - 18 tests (96.42% coverage)
- **Pagination.tsx** - 22 tests (100% coverage)
- **SaveSearchButton.tsx** - 18 tests (94.11% coverage)

Components with new coverage:
- **StatCard.tsx** - 10 tests (100% coverage)
- **ActivityChart.tsx** - 5 tests (100% coverage)
- **TopPatternsList.tsx** - 9 tests (100% coverage)
- **TopSearchesList.tsx** - 7 tests (100% coverage)
- **PatternEditForm.tsx** - 37 tests (97.91% coverage)
- **BrowseContent.tsx** - 17 tests (100% coverage)

Components still at 0% coverage:
- AccountContent.tsx
- AdminUploadForm.tsx
- AdminUserList.tsx
- AuthButtonClient.tsx / AuthButtonServer.tsx
- AuthTabs.tsx
- DuplicateReview.tsx
- KeywordSidebar.tsx
- LandingPage.tsx
- PatternRanker.tsx

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

2. **Browse/display components** ✅ Completed
   - ~~PatternGrid.tsx~~ ✅ Done
   - ~~PatternCard.tsx~~ ✅ Done
   - ~~SearchBar.tsx~~ ✅ Done
   - ~~KeywordFilter.tsx~~ ✅ Done

3. **Share flow components** ✅ Completed
   - ~~ShareModal.tsx~~ ✅ Done
   - ~~ShareBasket.tsx~~ ✅ Done
   - ~~ShareButton.tsx~~ ✅ Done
   - ~~FavoriteButton.tsx~~ ✅ Done
   - ~~Pagination.tsx~~ ✅ Done

4. **Search and save components** ✅ Completed
   - ~~AISearchBar.tsx~~ ✅ Done
   - ~~SaveSearchButton.tsx~~ ✅ Done
   - ~~ShareContext.tsx~~ ✅ Done

### Lower Priority (Admin and edge features)

5. **Admin components** (0% coverage)
   - AdminUploadForm.tsx
   - AdminUserList.tsx
   - DuplicateReview.tsx

6. **Auth UI components** (0% coverage)
   - AuthTabs.tsx
   - AuthButtonClient.tsx / AuthButtonServer.tsx

## Recent Progress

### January 17, 2026

Refactored admin upload route error handling and added 3 new tests (total: 21 tests):

**Error Handling Refactor** (`/api/admin/upload`)

- Replaced manual `NextResponse.json` calls with standardized helpers (`unauthorized`, `forbidden`, `badRequest`, `internalError`)
- Added structured error logging with `logError()` context
- Wrapped form data and ZIP parsing in try-catch blocks
- Distinguished PGRST116 (no profile row) from real database errors
- Added fallback error for null upload log without error object

**New Tests:**

- `returns 403 when profile row does not exist (PGRST116)` - Verifies that missing profile returns 403 with AUTH_FORBIDDEN code
- `returns 500 when profile lookup fails with database error` - Verifies real DB errors return 500 with INTERNAL_ERROR code
- `returns 500 when upload log creation fails` - Verifies upload log insert failure returns 500

### January 11, 2026

Added comprehensive tests for PatternEditForm and BrowseContent (42 new tests):

**PatternEditForm.tsx** - 25 new tests (total: 37 tests, 97.91% coverage)

- **Keyword dropdown** (5 tests)
  - Shows dropdown when search input is focused
  - Filters keywords based on search input
  - Excludes already-assigned keywords from dropdown
  - Closes dropdown when clicking outside
  - Shows "no matching keywords" when search has no results

- **Adding keywords** (3 tests)
  - Adds keyword when clicking dropdown item
  - Clears search and closes dropdown after adding keyword
  - Shows error when adding keyword fails

- **Removing keywords** (2 tests)
  - Shows error when removing keyword fails
  - Removes keyword from displayed list after successful removal

- **Thumbnail transformations** (10 tests)
  - Calls transform API for rotate CW, CCW, 180, flip H, flip V
  - Shows error when transform fails
  - Disables transform buttons while transforming
  - Does not show transform controls when no thumbnail
  - Updates thumbnail URL after successful transform

- **Keyword fetch errors** (2 tests)
  - Handles keyword fetch failure gracefully
  - Handles non-ok response from keyword fetch

- **Form field handling** (3 tests)
  - Handles empty initial values
  - Updates all form fields correctly
  - Sends correct data when saving

**BrowseContent.tsx** - 17 new tests (100% coverage)

- **Rendering** (4 tests)
  - Renders PatternGrid with patterns
  - Renders Pagination with correct props
  - Passes error to PatternGrid
  - Renders empty patterns array

- **Favorites** (6 tests)
  - Initializes favorites from initialFavoriteIds
  - Adds pattern to favorites when toggled on
  - Removes pattern from favorites when toggled off
  - Updates favorites when initialFavoriteIds changes
  - Handles empty initialFavoriteIds
  - Handles toggling same pattern multiple times

- **Admin mode** (3 tests)
  - Passes isAdmin false by default
  - Passes isAdmin true when specified
  - Passes isAdmin false when explicitly set

- **Edge cases** (4 tests)
  - Handles large number of patterns
  - Handles patterns with all null fields
  - Handles page 0 edge case
  - Handles very large favorite ids

### January 8, 2026 (Night)

Added tests for Pattern Analytics Dashboard and Pattern Metadata Editor (93 new tests):

**Pattern Analytics API Routes:**

- **GET /api/admin/analytics** (`route.test.ts`) - 5 tests
  - Returns 401 for unauthenticated users
  - Returns 403 for non-admin users
  - Returns analytics data for admin users
  - Returns zero counts when no data exists
  - Returns 500 on database error

- **GET /api/admin/analytics/top-patterns** (`top-patterns/route.test.ts`) - 5 tests
  - Authentication and authorization checks
  - Returns top downloaded patterns with counts
  - Returns empty array when no downloads
  - Returns 500 on database error

- **GET /api/admin/analytics/top-searches** (`top-searches/route.test.ts`) - 5 tests
  - Authentication and authorization checks
  - Returns popular search queries with counts
  - Returns empty array when no searches
  - Returns 500 on database error

- **GET /api/admin/analytics/activity** (`activity/route.test.ts`) - 5 tests
  - Authentication and authorization checks
  - Returns 30-day activity data (downloads, searches, signups)
  - Returns empty arrays when no activity
  - Returns 500 on database error

**Pattern Analytics Components:**

- **StatCard.tsx** (`StatCard.test.tsx`) - 10 tests
  - Renders title and value
  - Locale-formatted numeric values
  - String values rendered as-is
  - Optional subtitle display
  - Icon rendering
  - Color class variations (purple, indigo, green, etc.)
  - Default purple color

- **ActivityChart.tsx** (`ActivityChart.test.tsx`) - 5 tests
  - Renders title and legend
  - Empty state message
  - Bars for each data point
  - Date labels at intervals

- **TopPatternsList.tsx** (`TopPatternsList.test.tsx`) - 9 tests
  - Renders title
  - Empty state message
  - Pattern names and authors
  - Download counts and ranking numbers
  - Links to pattern pages
  - Thumbnail images with placeholder fallback

- **TopSearchesList.tsx** (`TopSearchesList.test.tsx`) - 7 tests
  - Renders title
  - Empty state message
  - Search queries with quote formatting
  - Search counts and ranking numbers
  - Formatted dates

**Pattern Metadata Editor API Routes:**

- **GET/PATCH /api/admin/patterns/[id]** (`route.test.ts`) - 11 tests
  - Authentication and authorization checks
  - Pattern ID validation
  - Pattern not found handling
  - Returns pattern with keywords for admin
  - PATCH updates pattern metadata
  - Field validation (only allowed fields)
  - Returns 500 on update error

- **GET/POST/DELETE /api/admin/patterns/[id]/keywords** (`keywords/route.test.ts`) - 16 tests
  - Authentication and authorization checks
  - GET returns keywords for pattern
  - POST adds keyword to pattern
  - POST validates keyword existence
  - DELETE removes keyword from pattern
  - Error handling for all operations

- **GET /api/keywords** (`route.test.ts`) - 4 tests
  - Authentication required
  - Returns all keywords sorted
  - Empty array when no keywords
  - Returns 500 on database error

**Pattern Metadata Editor Component:**

- **PatternEditForm.tsx** (`PatternEditForm.test.tsx`) - 12 tests
  - Renders pattern thumbnail
  - Renders form fields with initial values
  - Renders initial keywords as tags
  - Shows pattern ID and extension
  - Allows editing form fields
  - Saves pattern on button click
  - Shows error on save failure
  - Cancel link navigation
  - Removes keyword on X click
  - Shows empty keywords message
  - Shows placeholder for missing thumbnail
  - Disables save button while saving

### January 8, 2026 (Earlier)

Added tests for search/save components and context (57 new tests):

- **ShareContext.tsx** (`src/contexts/ShareContext.test.tsx`) - 14 tests
  - Provider initialization and empty state
  - Loading patterns from localStorage on mount
  - Invalid JSON handling in localStorage
  - addPattern (success, duplicate rejection, max capacity)
  - removePattern functionality
  - clearSelection functionality
  - isSelected state checking
  - canAddMore computed value
  - localStorage error handling (setItem failures)

- **AISearchBar.tsx** (`src/components/AISearchBar.test.tsx`) - 25 tests
  - Input rendering and placeholder text
  - AI Search button state (enabled/disabled)
  - Query initialization from URL params
  - Input value updates on typing
  - Clear button visibility and functionality
  - Form submission with API call
  - Query trimming before submission
  - Empty/whitespace query prevention
  - Loading state during search
  - onSearch callback with results
  - URL update with search query
  - Fallback indicator for text search
  - Error handling with toast
  - SaveSearchButton integration

- **SaveSearchButton.tsx** (`src/components/SaveSearchButton.test.tsx`) - 18 tests
  - Button rendering with save text
  - Bookmark icon when not saved
  - Disabled state for empty/whitespace query
  - API call with trimmed query
  - Loading state during save
  - Saved state after successful save
  - onSaved callback execution
  - setTimeout for reset after 3 seconds
  - Ignore clicks while saved
  - Ignore clicks while loading
  - Error logging on API failure
  - No saved state on error
  - No onSaved callback on error
  - Network error handling
  - Purple styling when not saved
  - Green styling when saved

### January 7, 2026 (Night)

Added tests for share flow and interaction components (96 new tests):

- **ShareButton.tsx** (`src/components/ShareButton.test.tsx`) - 13 tests
  - Rendering states (plus icon, checkmark, full basket)
  - Adding to basket (calls addPattern)
  - Removing from basket (calls removePattern)
  - Event handling (preventDefault, stopPropagation)
  - Styling (selected, unselected, disabled states)

- **ShareBasket.tsx** (`src/components/ShareBasket.test.tsx`) - 19 tests
  - Rendering (hidden when empty, floating button with count)
  - Expand/collapse toggle
  - Pattern list display with thumbnails
  - Remove pattern functionality
  - Clear all functionality
  - Share modal integration
  - Success callback handling

- **ShareModal.tsx** (`src/components/ShareModal.test.tsx`) - 24 tests
  - Rendering (pattern preview, form fields)
  - Form interaction (input changes)
  - Form submission (API call, loading state)
  - Success state (share URL, copy to clipboard)
  - Error handling (API failure, network error)
  - Close behavior

- **FavoriteButton.tsx** (`src/components/FavoriteButton.test.tsx`) - 18 tests
  - Rendering (star icons, aria labels)
  - Adding favorites (POST API call)
  - Removing favorites (DELETE API call)
  - Optimistic updates (immediate UI change, revert on error)
  - Error handling (toast notifications)
  - Loading state (disabled button, ignore clicks)
  - Event handling (stopPropagation)

- **Pagination.tsx** (`src/components/Pagination.test.tsx`) - 22 tests
  - Rendering (hide for single page, show page numbers)
  - Page number display (ellipsis logic, current page highlight)
  - Navigation (page click, prev/next buttons)
  - URL param preservation
  - Button states (disabled at boundaries)
  - Edge cases (2 pages, 3 pages, many pages)

### January 7, 2026 (Late Evening)

Added tests for browse/display components (42 new tests):

- **PatternGrid.tsx** (`src/components/PatternGrid.test.tsx`) - 17 tests
  - Loading state with skeleton placeholders
  - Auth error state with session expired message
  - Empty state message
  - Pattern card rendering and grid layout
  - Favorites integration (isFavorited state, toggle callbacks)
  - State priority (loading > error > empty)
  - Large data set handling

- **KeywordFilter.tsx** (`src/components/KeywordFilter.test.tsx`) - 25 tests
  - Filter button rendering with badge count
  - Dropdown open/close toggle
  - All keywords displayed with checkboxes
  - Checkbox states based on URL params
  - Keyword selection updates URL
  - Multiple keyword selection
  - Keyword deselection
  - Clear all button visibility and functionality
  - Page param reset on selection/clear
  - Other params preserved
  - Edge cases (empty keywords, invalid IDs in URL)

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

- **Admin Upload** (`/api/admin/upload`) - 21 tests
  - Authentication (401 unauthenticated)
  - Authorization (403 non-admin, 403 PGRST116 no profile, 500 DB error)
  - File validation (ZIP required, must contain .qli files)
  - Duplicate detection and skipping
  - Successful upload with pattern processing
  - Nested folder structure in ZIP files
  - Storage upload error handling with cleanup
  - Database error handling with cleanup
  - Upload log creation failure handling
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

### Mocking localStorage

```typescript
class MockStorage implements Storage {
  private store: Record<string, string> = {}

  get length() { return Object.keys(this.store).length }
  clear() { this.store = {} }
  getItem(key: string) { return this.store[key] || null }
  key(index: number) { return Object.keys(this.store)[index] || null }
  removeItem(key: string) { delete this.store[key] }
  setItem(key: string, value: string) { this.store[key] = value }
}

beforeEach(() => {
  mockStorage = new MockStorage()
  vi.stubGlobal('localStorage', mockStorage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})
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
