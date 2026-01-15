# Performance Optimizations

This document tracks all performance improvements made to the Quilting Patterns application.

## Phase 1: Quick Wins (Completed)

### Image Optimization

**Problem**: Multiple components used `unoptimized={true}` on Next.js Image components, bypassing automatic image optimization (resizing, format conversion, lazy loading).

**Solution**: Removed `unoptimized` prop and added proper `sizes` attributes to enable Next.js image optimization.

**Files Modified**:
- `app/src/components/AdminPatternCard.tsx`
- `app/src/components/PatternReviewCard.tsx`
- `app/src/components/ShareBasket.tsx`
- `app/src/components/DuplicateReview.tsx`
- `app/src/components/PatternEditForm.tsx`
- `app/src/components/PatternRanker.tsx`
- `app/src/app/admin/rotate-review/page.tsx`
- `app/src/app/share/[token]/page.tsx`

**Impact**: Reduced image payload sizes, automatic WebP/AVIF conversion, proper lazy loading.

---

### React.memo for List Components

**Problem**: `PatternCard` and `AdminPatternCard` re-rendered on every parent state change, causing 50+ unnecessary re-renders when interacting with a page of patterns.

**Solution**: Wrapped components with `React.memo()` to prevent re-renders when props haven't changed.

**Files Modified**:
- `app/src/components/PatternCard.tsx`
- `app/src/components/AdminPatternCard.tsx`

**Impact**: Significantly reduced CPU usage during interactions like favoriting, filtering, or scrolling.

---

### Lazy Loading DnD-Kit

**Problem**: The `@dnd-kit` library (61KB) was loaded on the main bundle even though it's only used in the share/ranking feature.

**Solution**: Used `next/dynamic` to lazy-load `PatternRanker` component only when needed.

**File Modified**: `app/src/app/share/[token]/page.tsx`

```typescript
const PatternRanker = dynamic(() => import('@/components/PatternRanker'), {
  loading: () => <LoadingSpinner />,
  ssr: false,
})
```

**Impact**: Reduced initial bundle size by 61KB for most users.

---

### Analytics Query Parallelization

**Problem**: The top-patterns analytics endpoint made sequential queries and loaded up to all download logs into memory.

**Solution**: Added safety limit (10k rows) and parallelized pattern/favorite fetches with `Promise.all()`.

**File Modified**: `app/src/app/api/admin/analytics/top-patterns/route.ts`

**Impact**: Faster response times, reduced memory usage.

---

## Phase 2: Database & API Optimization (Completed)

### SQL Performance Indexes

**Problem**: Several common queries lacked proper indexes, causing full table scans.

**Solution**: Added targeted indexes for frequently queried columns.

**Migration**: `scripts/027_performance_indexes.sql`

**Indexes Added**:
| Index | Table | Purpose |
|-------|-------|---------|
| `idx_patterns_embedding_not_null` | patterns | Semantic search fallback check |
| `idx_download_logs_user_date` | download_logs | User download history |
| `idx_search_logs_user_date` | search_logs | User search history |
| `idx_view_logs_pattern_date` | view_logs | Pattern view analytics |
| `idx_orientation_analysis_pattern_id` | orientation_analysis | Pattern lookups |
| `idx_mirror_analysis_unreviewed` | mirror_analysis | Partial index for unreviewed items |
| `idx_admin_activity_log_admin_date` | admin_activity_log | Admin activity queries |
| `idx_admin_activity_log_type` | admin_activity_log | Action type filtering |

---

### RPC Functions for SQL Aggregation

**Problem**: Analytics endpoints loaded thousands of rows into memory to count/aggregate in JavaScript.

**Solution**: Created PostgreSQL RPC functions that perform aggregation server-side.

**Migration**: `scripts/027_performance_indexes.sql`

**Functions Created**:

#### `get_top_downloaded_patterns(p_limit INT)`
Returns top patterns by download count with favorite counts, all in one efficient query using CTEs.

#### `get_top_viewed_patterns(p_limit INT)`
Returns top patterns by view count with pattern metadata.

#### `get_top_searches(p_limit INT)`
Returns most common search queries with counts and average result counts.

**API Updated**: `app/src/app/api/admin/analytics/top-patterns/route.ts`

**Impact**: Reduced data transfer from potentially thousands of rows to just 10 result rows. Query execution moved to database server.

---

### Keyword Caching

**Problem**: Keywords rarely change but were fetched fresh on every request.

**Solution**: Added Cache-Control headers for browser caching.

**File Modified**: `app/src/app/api/keywords/route.ts`

```typescript
headers: {
  'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
}
```

**Impact**: Repeat requests within 5 minutes served from browser cache. Stale-while-revalidate allows serving cached data while fetching fresh in background.

---

### Admin Users Pagination

**Problem**: Admin users endpoint loaded all users without pagination.

**Solution**: Added pagination support with parallel count query.

**File Modified**: `app/src/app/api/admin/users/route.ts`

**API**: `GET /api/admin/users?page=1&limit=50`

**Response**:
```json
{
  "users": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3,
    "hasMore": true
  }
}
```

**Impact**: Reduced payload size, faster initial load for admin user management.

---

### Pattern Detail JOIN Query

**Problem**: Pattern detail page made 2-3 separate queries to fetch pattern + keywords.

**Solution**: Single query with nested select (Supabase JOIN syntax).

**File Modified**: `app/src/app/patterns/[id]/page.tsx`

**Before** (3 queries):
1. Fetch pattern
2. Fetch pattern_keywords for pattern
3. Fetch keywords by IDs

**After** (1 query):
```typescript
const { data: pattern } = await supabase
  .from('patterns')
  .select(`
    *,
    pattern_keywords (
      keywords (id, value)
    )
  `)
  .eq('id', id)
  .single()
```

**Impact**: Reduced database round trips from 3 to 1.

---

## Phase 3: Bundle Analysis & Tree-Shaking (Completed)

### Bundle Analysis Setup

**Added**: `@next/bundle-analyzer` configured in `next.config.ts`

```typescript
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});
```

**Run with**: `ANALYZE=true npm run build` or `npx next experimental-analyze` (for Turbopack)

### Bundle Analysis Results

**Total Client JS**: 1.3MB uncompressed, **387KB gzipped** (reasonable for a Next.js app)

**Largest Chunks**:
- Next.js runtime: ~220KB (unavoidable framework code)
- Polyfills: ~200KB (unavoidable for browser compatibility)
- App code: well-split across many smaller chunks

**Key Findings**:
- No heavy charting libraries - using lightweight CSS-based charts
- JSZip only used in API routes (server-side, not in client bundle)
- @dnd-kit already lazy-loaded (Phase 1)
- Sentry properly configured with Next.js plugin for tree-shaking

---

### Sentry Tree-Shaking Optimization

**Problem**: `import * as Sentry from '@sentry/nextjs'` prevents optimal tree-shaking.

**Solution**: Changed to named imports for only the functions we use.

**File Modified**: `app/src/lib/errors.ts`

**Before**:
```typescript
import * as Sentry from '@sentry/nextjs'
// ...
Sentry.captureException(error)
```

**After**:
```typescript
import {
  withScope,
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
} from '@sentry/nextjs'
// ...
captureException(error)
```

**Impact**: Allows bundler to exclude unused Sentry code paths.

---

## Phase 4: Security Hardening (Completed)

### Analytics RPC Security

**Problem**: The analytics RPC functions (`get_top_downloaded_patterns`, `get_top_viewed_patterns`, `get_top_searches`) used `SECURITY DEFINER` without admin checks, allowing any authenticated user to bypass RLS and access aggregated analytics data.

**Solution**: Added in-function admin verification, search path protection, and restricted grants.

**Migration**: `scripts/028_secure_analytics_rpcs.sql`

**Security Controls Added**:
| Control | Purpose |
|---------|---------|
| `WHERE EXISTS (SELECT ... is_admin = true)` | Verify caller is admin |
| `SET search_path = public` | Prevent search path injection attacks |
| `REVOKE ALL FROM PUBLIC, anon` | Remove default access |
| `GRANT EXECUTE TO authenticated` | Only allow authenticated users to call |

**Behavior**: Non-admin users receive empty result sets rather than errors, avoiding leakage of admin status.

---

### API Error Handling Improvements

**Problem**: Missing RPC functions silently returned empty arrays, masking migration failures.

**Solution**: Return HTTP 503 with clear error message when RPC is missing.

**File Modified**: `app/src/app/api/admin/analytics/top-patterns/route.ts`

```typescript
if (error.code === 'PGRST202') {
  return NextResponse.json(
    { error: 'Analytics RPC function not found. Run migration...' },
    { status: 503 }
  )
}
```

**Impact**: Clear feedback when migrations haven't been run.

---

### Pagination Input Validation

**Problem**: Invalid pagination parameters (e.g., `?page=abc`) caused NaN values that corrupted range calculations.

**Solution**: Added `Number.isNaN()` checks with fallback to safe defaults.

**File Modified**: `app/src/app/api/admin/users/route.ts`

```typescript
const parsedPage = parseInt(searchParams.get('page') || '1', 10)
const page = Math.max(1, Number.isNaN(parsedPage) ? 1 : parsedPage)
```

**Impact**: Graceful handling of malformed query parameters.

---

## Phase 5: Server Components Conversion (Completed)

### Analytics Components to Server Components

**Problem**: Analytics dashboard components (`StatCard`, `TopPatternsList`, `TopViewsList`, `TopSearchesList`, `ActivityChart`) were marked as client components with `'use client'` despite being purely presentational with no client-side interactivity.

**Solution**: Removed `'use client'` directive from all 5 analytics components, converting them to Server Components.

**Files Modified**:
- `app/src/components/analytics/StatCard.tsx`
- `app/src/components/analytics/TopPatternsList.tsx`
- `app/src/components/analytics/TopViewsList.tsx`
- `app/src/components/analytics/TopSearchesList.tsx`
- `app/src/components/analytics/ActivityChart.tsx`

**Changes**:
- Removed `'use client'` directive from all files
- In `ActivityChart.tsx`: Removed `useMemo` hook (unnecessary in Server Components since they only render once)

**Impact**:
- Reduced client-side JavaScript bundle for the analytics page
- Components now render entirely on the server
- No hydration overhead for these components
- Faster Time to Interactive (TTI) on the analytics dashboard

---

## Phase 6: Web Vitals Monitoring (Completed)

### Real User Performance Metrics

**Problem**: No visibility into actual user performance experience. Optimizations were made without data on real-world impact.

**Solution**: Added Web Vitals tracking using the `web-vitals` library, integrated with existing Matomo analytics.

**Files Added/Modified**:
- `app/src/components/WebVitals.tsx` (new)
- `app/src/app/layout.tsx` (added WebVitals component)
- `package.json` (added `web-vitals` dependency)

**Metrics Tracked**:
| Metric | Description | Good Threshold |
|--------|-------------|----------------|
| **LCP** | Largest Contentful Paint - main content load time | < 2.5s |
| **INP** | Interaction to Next Paint - responsiveness | < 200ms |
| **CLS** | Cumulative Layout Shift - visual stability | < 0.1 |
| **FCP** | First Contentful Paint - initial render | < 1.8s |
| **TTFB** | Time to First Byte - server response | < 800ms |

**Integration**: Metrics are sent to Matomo as custom events:
- Category: "Web Vitals"
- Action: metric name (LCP, INP, CLS, etc.)
- Label: page path
- Value: metric value (rounded)

**Viewing Data**: In Matomo dashboard:
1. Go to Behavior → Events
2. Filter by Category: "Web Vitals"
3. View metrics by page and over time

**Development**: Metrics also log to browser console in dev mode for debugging.

---

## Future Optimization Opportunities

### Not Yet Implemented

1. **Streaming SSR**: Use React Suspense for progressive page loading
2. **Connection Pooling**: If experiencing connection limits, add PgBouncer
3. **CDN Caching**: Add edge caching for static API responses
4. **Database Partitioning**: If logs tables grow very large, consider time-based partitioning

### Monitoring Suggestions

- Monitor database query times in Supabase dashboard
- Use Chrome DevTools Lighthouse for frontend performance audits
- Review Web Vitals data in Matomo to identify slow pages

---

## Running Migrations

See [DEPLOYMENT.md](./DEPLOYMENT.md) for instructions on running SQL migrations.

Current latest migration: `028_secure_analytics_rpcs.sql`
