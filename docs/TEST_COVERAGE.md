# Test Coverage Documentation

Last updated: January 6, 2026

## Summary

| Metric     | Coverage |
|------------|----------|
| Statements | 25.98%   |
| Branches   | 26.84%   |
| Functions  | 17.43%   |
| Lines      | 26.54%   |

**Total Tests:** 248 across 20 test files

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
- `src/lib/errors.test.ts` - 32 tests (originally existed)
- `src/lib/api-response.test.ts` - 35 tests
- `src/lib/fetch-with-retry.test.ts` - 19 tests

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
| /api/search                    | 41.37%     | Voyage AI integration    |
| /api/download/[id]             | covered    | 9 tests                  |
| /api/admin/notify-signup       | covered    | 2 tests                  |

#### Not Covered (0%)

| Route                     | Reason                           |
|---------------------------|----------------------------------|
| /auth/callback            | OAuth flow, complex mocking      |
| /auth/signin              | OAuth flow                       |
| /api/admin/upload         | File upload, storage operations  |

## What's NOT Covered

### React Components (0%)

All components in `src/components/` have 0% coverage:

- AISearchBar.tsx
- AccountContent.tsx
- AdminUploadForm.tsx
- AdminUserList.tsx
- AuthButton.tsx / AuthButtonClient.tsx / AuthButtonServer.tsx
- AuthTabs.tsx
- BrowseContent.tsx
- DuplicateReview.tsx
- ErrorBoundary.tsx
- FavoriteButton.tsx
- KeywordFilter.tsx / KeywordSidebar.tsx
- LandingPage.tsx
- Pagination.tsx
- PatternCard.tsx / PatternGrid.tsx / PatternRanker.tsx
- SaveSearchButton.tsx / SearchBar.tsx
- ShareBasket.tsx / ShareButton.tsx / ShareModal.tsx
- Toast.tsx

### Pages (0%)

- /auth/login/page.tsx
- /auth/signup/page.tsx
- /browse/page.tsx
- /contact/page.tsx
- /patterns/[id]/page.tsx
- /pending-approval/page.tsx
- /share/[token]/page.tsx

### Other (0%)

- src/contexts/ShareContext.tsx
- src/hooks/useFetch.ts
- src/lib/supabase/client.ts
- src/lib/supabase/server.ts
- src/lib/supabase/middleware.ts

## Where to Pick Up Next

### High Priority (Critical paths, low coverage)

1. **Search API (`/api/search/route.ts`)** - 41.37% coverage
   - Missing: Voyage AI semantic search path, fallback text search
   - Complexity: Needs mocking of Voyage AI client

2. **Auth routes** - 0% coverage
   - `/auth/callback/route.ts` - OAuth callback handling
   - `/auth/signin/route.ts` - Sign-in flow
   - Complexity: OAuth mocking, cookie handling

3. **Admin upload** - 0% coverage
   - `/api/admin/upload/route.ts` - File upload and storage
   - Complexity: Supabase storage mocking, multipart form data

### Medium Priority (Important but complex)

4. **React hooks**
   - `useFetch.ts` - Fetch with retry hook
   - Complexity: React Testing Library setup needed

5. **Core components**
   - ErrorBoundary.tsx - Error handling UI
   - Toast.tsx - Notification system
   - AuthButton.tsx - Auth state handling

### Lower Priority (UI components)

6. **Browse/display components**
   - PatternGrid.tsx, PatternCard.tsx
   - SearchBar.tsx, KeywordFilter.tsx
   - Complexity: React Testing Library + visual testing

7. **Share flow components**
   - ShareModal.tsx, ShareBasket.tsx, PatternRanker.tsx
   - Complexity: Complex state management

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
