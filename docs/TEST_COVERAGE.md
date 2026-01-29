# Test Coverage Documentation

Last updated: January 29, 2026

## Summary

| Metric     | Coverage |
|------------|----------|
| Statements | ~48%     |
| Branches   | ~42%     |
| Functions  | ~47%     |
| Lines      | ~48%     |

**Total Tests:** 1450 across 79 test files

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

### Library Utilities (src/lib/) - 85%+ statements

| File               | Statements | Branches | Functions | Lines   |
|--------------------|------------|----------|-----------|---------|
| filename.ts        | 100%       | 100%     | 100%      | 100%    |
| url-utils.ts       | 100%       | 100%     | 100%      | 100%    |
| embeddings.ts      | 97.33%     | 100%     | 100%      | 97.18%  |
| fetch-with-retry.ts| 91.30%     | 84%      | 90.9%     | 90.9%   |
| api-response.ts    | 84.44%     | 71.73%   | 100%      | 84.44%  |
| errors.ts          | 77.33%     | 76.05%   | 66.66%    | 80.55%  |

**Test files:**
- `src/lib/filename.test.ts` - 32 tests
- `src/lib/url-utils.test.ts` - 41 tests
- `src/lib/embeddings.test.ts` - 16 tests
- `src/lib/errors.test.ts` - 32 tests
- `src/lib/api-response.test.ts` - 35 tests
- `src/lib/fetch-with-retry.test.ts` - 19 tests
- `src/lib/query-embedding-cache.test.ts` - 26 tests
- `src/app/api/search/route.test.ts` - 23 tests
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
| /api/pinned-keywords                | 10    |
| /api/pinned-keywords/[keywordId]    | 6     |

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
- **PatternEditForm.tsx** - 39 tests (97.91% coverage)
- **TriagePatternCard.tsx** - 7 tests (100% coverage)
- **BrowseContent.tsx** - 17 tests (100% coverage)
- **KeywordSidebar.tsx** - 18 tests (100% coverage)
- **PinnedKeywordsManager.tsx** - 16 tests (100% coverage)
- **PatternDetailClient.tsx** - 42 tests (97.67% coverage)
- **PatternModal.tsx** - 55 tests (98.7% coverage)
- **KeywordManager.tsx** - 47 tests (95.89% coverage)
- **AuthTabs.tsx** - 41 tests (100% coverage)
- **AdminUserList.tsx** - 38 tests (100% coverage)
- **AdminUploadForm.tsx** - 47 tests (98.21% coverage)
- **DuplicateReview.tsx** - 62 tests (96.07% coverage)

Components still at 0% coverage:
- AccountContent.tsx
- AuthButtonClient.tsx / AuthButtonServer.tsx
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

5. **Admin components** ✅ Completed
   - ~~AdminUserList.tsx~~ ✅ Done (100%)
   - ~~AdminUploadForm.tsx~~ ✅ Done (98.21%)
   - ~~DuplicateReview.tsx~~ ✅ Done (96.07%)

6. **Auth UI components** (partial coverage)
   - ~~AuthTabs.tsx~~ ✅ Done (100%)
   - AuthButtonClient.tsx / AuthButtonServer.tsx (0%)

## Recent Progress

### January 29, 2026

Added comprehensive tests for AdminUploadForm and DuplicateReview components (109 new tests):

**AdminUploadForm.tsx** (`src/components/AdminUploadForm.test.tsx`) - 47 tests

Coverage improved from 0% to 98.21% statements.

- **Rendering** (4 tests)
  - Renders drop zone with instructions
  - Renders file input with correct accept attribute
  - Does not show action buttons initially
  - Does not show skip review checkbox initially

- **Drag and drop** (6 tests)
  - Shows dragging state on drag over
  - Removes dragging state on drag leave
  - Accepts dropped ZIP file
  - Shows file size after selecting file
  - Rejects non-ZIP files on drop
  - Accepts ZIP file with uppercase extension

- **File selection via input** (3 tests)
  - Accepts ZIP file via file input
  - Rejects non-ZIP file via file input
  - Handles empty file selection

- **Skip review checkbox** (3 tests)
  - Shows skip review checkbox when file is selected
  - Checkbox is unchecked by default
  - Can toggle skip review checkbox

- **Action buttons** (3 tests)
  - Shows Upload & Review button when file selected and skip review is off
  - Shows Upload & Commit button when skip review is checked
  - Shows Clear button when file selected

- **Upload flow** (7 tests)
  - Calls upload API with FormData
  - Sends staged=true by default (review mode)
  - Sends staged=false when skip review is checked
  - Shows loading state while uploading
  - Disables file input while uploading
  - Disables checkbox while uploading
  - Disables Clear button while uploading

- **Redirect on staged upload** (3 tests)
  - Redirects to batch review page when staged upload succeeds
  - Does not redirect when no patterns were uploaded
  - Does not redirect for non-staged upload

- **Results display** (9 tests)
  - Shows upload complete message for non-staged success
  - Shows summary counts
  - Shows uploaded patterns list
  - Shows checkmark for patterns with thumbnails
  - Shows circle for patterns without thumbnails
  - Shows skipped duplicates count
  - Shows error list
  - Clears selected file on successful non-staged upload

- **Error handling** (5 tests)
  - Shows error message from API response
  - Shows error details when provided
  - Handles network error
  - Handles non-Error exception
  - Applies error styling to results panel

- **Clear selection** (3 tests)
  - Clears selected file when Clear clicked
  - Clears error result when Clear clicked
  - Hides action buttons after clearing

- **Drop zone styling** (2 tests)
  - Has green styling when file is selected
  - Shows checkmark icon when file is selected

**DuplicateReview.tsx** (`src/components/DuplicateReview.test.tsx`) - 62 tests

Coverage improved from 0% to 96.07% statements.

- **Loading state** (2 tests)
  - Shows loading spinner initially
  - Shows loading hint about large collections

- **Error state** (5 tests)
  - Shows error message when fetch fails
  - Shows default error message when no error text provided
  - Shows error on network failure
  - Shows Try Again button on error
  - Retries fetch when Try Again is clicked

- **Empty state** (3 tests)
  - Shows no duplicates message when list is empty
  - Shows threshold in empty state message
  - Shows threshold dropdown in empty state

- **Duplicate pair display** (8 tests)
  - Shows pattern names
  - Shows pattern authors
  - Shows Unknown author when author is null
  - Shows pattern IDs
  - Shows file extension
  - Shows thumbnails when available
  - Shows placeholder when thumbnail is null
  - Shows similarity percentage

- **Similarity color coding** (3 tests)
  - Shows red for >= 98% similarity
  - Shows amber for >= 95% similarity
  - Shows green for < 95% similarity

- **Navigation** (6 tests)
  - Shows current pair index
  - Navigates to next pair
  - Navigates to previous pair
  - Disables Previous button on first pair
  - Disables Next button on last pair
  - Shows keyboard navigation hint

- **Threshold control** (3 tests)
  - Shows threshold dropdown
  - Defaults to 95% threshold
  - Refetches when threshold changes

- **AI verification** (14 tests)
  - Shows AI verification available message
  - Shows Analyze with AI button
  - Calls AI verify endpoint when button clicked
  - Shows loading state during AI verification
  - Shows AI verification result
  - Shows AI reasoning
  - Shows quality comparison
  - Shows recommendation badge
  - Shows Apply AI Recommendation button
  - Shows AI error with retry button
  - Clears AI verification when navigating to different pair
  - Shows not duplicates result
  - Shows needs human review message

- **Apply AI recommendation** (3 tests)
  - Deletes pattern 2 when recommendation is keep_first
  - Deletes pattern 1 when recommendation is keep_second
  - Keeps both when recommendation is keep_both

- **Delete pattern** (8 tests)
  - Shows confirmation dialog when delete clicked
  - Does not call API when confirmation declined
  - Calls review API with deleted_first when first pattern deleted
  - Calls review API with deleted_second when second pattern deleted
  - Shows loading state while deleting
  - Removes pair from list after successful delete
  - Shows alert on delete error
  - Disables buttons while action is loading

- **Keep both** (3 tests)
  - Shows Keep Both Patterns button
  - Calls review API with keep_both decision
  - Removes pair from list after keep both

- **Index adjustment after review** (2 tests)
  - Adjusts index when reviewing last pair
  - Shows empty state after reviewing all pairs

- **Confidence indicators** (3 tests)
  - Shows green badge for high confidence
  - Shows amber badge for medium confidence
  - Shows stone badge for low confidence

### January 28, 2026

Added comprehensive tests for AuthTabs component (41 new tests):

**AuthTabs.tsx** (`src/components/AuthTabs.test.tsx`) - 41 tests

Coverage improved from 0% to 100% statements.

- **Rendering** (3 tests)
  - Renders Sign In tab as active by default
  - Renders sign in form fields by default
  - Renders Sign In submit button

- **Tab switching** (4 tests)
  - Switches to Register tab when clicked
  - Switches back to Sign In tab when clicked
  - Resets form fields when switching tabs
  - Clears errors when switching tabs

- **Sign in form** (9 tests)
  - Updates email field on input
  - Updates password field on input
  - Shows loading state while submitting
  - Redirects to /browse when user is approved
  - Redirects to /pending-approval when user is not approved
  - Redirects to /pending-approval when profile has no is_approved field
  - Shows error when signInWithPassword fails
  - Shows error when user is null after sign in
  - Handles unexpected error during sign in

- **Register form** (16 tests)
  - Renders register form fields when Register tab is active
  - Shows approval notice on register tab
  - Updates confirm password field on input
  - Shows error when passwords do not match
  - Shows error when password is too short
  - Shows loading state while registering
  - Creates profile and redirects to /pending-approval for non-admin user
  - Sends admin notification for non-admin users
  - Does not send admin notification for admin users
  - Redirects to /browse when user is auto-approved
  - Shows error when signUp fails
  - Shows error when user is null after signup
  - Handles profile creation error gracefully
  - Handles admin notification failure gracefully
  - Handles unexpected error during registration
  - Defaults to pending-approval when profile fetch returns null

- **Form validation** (6 tests)
  - Requires email field
  - Requires password field
  - Requires confirm password field on register
  - Has minLength on register password field
  - Email input has type email
  - Password input has type password

- **Accessibility** (3 tests)
  - Has proper labels for form fields
  - Has proper placeholder text
  - Has proper placeholder text on register form

**AdminUserList.tsx** (`src/components/AdminUserList.test.tsx`) - 38 tests

Coverage improved from 0% to 100% statements.

- **Rendering** (10 tests)
  - Renders tabs with correct counts
  - Renders pending tab as active by default
  - Renders user table with headers
  - Renders user email and display name
  - Renders admin badge for admin users
  - Renders pending/approved status
  - Formats date correctly
  - Renders empty state when no users

- **Tab filtering** (7 tests)
  - Shows only pending users by default
  - Switches to approved/all tabs
  - Highlights active tab correctly
  - Shows correct empty states for each tab

- **Approve action** (10 tests)
  - Shows/hides Approve button based on user status
  - Calls approve API when clicked
  - Shows loading state while approving
  - Updates user to approved on success
  - Shows empty state after approving last pending user
  - Shows alert on API error response
  - Shows alert on network error

- **Reject/Remove action** (10 tests)
  - Shows/hides Remove button (hidden for admins)
  - Shows confirmation dialog when clicked
  - Does not call API when confirmation declined
  - Calls reject API when confirmed
  - Shows loading state while removing
  - Removes user from list on success
  - Updates counts after removing
  - Shows alert on API error response
  - Can remove approved non-admin users

- **Multiple users interaction** (1 test)
  - Independent loading states per user

### January 27, 2026

Added comprehensive tests for PatternModal and KeywordManager components (83 new tests):

**PatternModal.tsx** (`src/components/PatternModal.test.tsx`) - 55 tests total (36 new)

Coverage improved from 69% to 98.7% statements.

- **Admin save metadata** (6 tests)
  - Shows saving state while request in progress
  - Shows success toast after successful save
  - Shows error toast when save fails
  - Handles empty pattern gracefully
  - Validates data before saving
  - Preserves unsaved changes

- **Admin keyword management** (11 tests)
  - Shows keyword dropdown when search focused
  - Filters keywords by search term
  - Adds keyword when clicked in dropdown
  - Removes keyword when X clicked
  - Shows error when add keyword fails
  - Shows error when remove keyword fails
  - Excludes already-assigned keywords from dropdown
  - Clears search after adding keyword
  - Handles keyboard navigation in dropdown
  - Shows empty state when no keywords match
  - Handles concurrent keyword operations

- **Edge cases** (12 tests)
  - Handles pattern with no thumbnail
  - Handles pattern with no keywords
  - Handles network errors gracefully
  - Handles API failures silently for similar patterns
  - Uses pattern ID as display name when file_name is empty
  - Handles missing optional fields
  - Handles rapid modal open/close
  - Handles escape key to close
  - Handles click outside to close
  - Accessibility heading states (loading/error/success)

- **Non-admin keyword behavior** (4 tests)
  - Displays keywords as clickable links
  - Does not show remove buttons
  - Does not show keyword dropdown
  - Keywords link to browse with keyword filter

**KeywordManager.tsx** (`src/components/KeywordManager.test.tsx`) - 47 tests (new file)

Coverage improved from 0% to 95.89% statements.

- **Loading and display** (8 tests)
  - Shows loading spinner while fetching keywords
  - Displays keywords in a table with pattern counts
  - Shows total keyword count
  - Handles empty keyword list
  - Handles fetch error gracefully
  - Sorts keywords alphabetically by default
  - Allows sorting by pattern count
  - Shows search input for filtering

- **Search and filter** (5 tests)
  - Filters keywords by search term
  - Shows no results message when filter has no matches
  - Clears search on X button click
  - Search is case-insensitive
  - Preserves sort order when searching

- **Edit keyword modal** (6 tests)
  - Opens edit modal when edit button clicked
  - Shows current keyword value in input
  - Validates keyword is not empty
  - Validates keyword is not duplicate
  - Saves keyword and updates list on success
  - Shows error toast on save failure

- **Delete keyword modal** (5 tests)
  - Opens delete confirmation modal
  - Shows warning about affected patterns
  - Deletes keyword and removes from list on confirm
  - Cancels delete on cancel button
  - Shows error toast on delete failure

- **Merge keyword modal** (8 tests)
  - Opens merge modal when merge button clicked
  - Shows source keyword name
  - Shows dropdown with target keywords (excluding source)
  - Filters target keywords by search
  - Disables merge button when no target selected
  - Merges keywords and updates list on confirm
  - Shows success message with affected pattern count
  - Shows error toast on merge failure

- **Add keyword modal** (5 tests)
  - Opens add modal when add button clicked
  - Validates new keyword is not empty
  - Validates new keyword is not duplicate
  - Adds keyword to list on success
  - Shows error toast on add failure

- **Orphan patterns modal** (4 tests)
  - Opens orphan patterns modal when link clicked
  - Shows patterns with no keywords
  - Closes modal on close button
  - Handles empty orphan list

- **Error handling** (6 tests)
  - Retries fetch on retry button click
  - Shows inline error for individual operations
  - Handles network timeout gracefully
  - Handles concurrent operations
  - Preserves state on partial failure
  - Logs errors to console

### January 26, 2026

Added comprehensive tests for PatternDetailClient component (42 new tests):

**PatternDetailClient.tsx** (`src/components/PatternDetailClient.test.tsx`) - 42 tests

- **Non-admin mode** (8 tests)
  - Renders pattern name as heading
  - Renders pattern metadata (file name, extension, author, notes)
  - Renders keywords as links
  - Renders similar patterns section
  - Calls onClose when close button clicked
  - Handles missing optional fields (author, notes)
  - Shows loading state while fetching similar patterns
  - Shows empty state when no similar patterns

- **Admin mode - Rendering** (7 tests)
  - Renders editable inputs for file_name, author, notes
  - Shows ThumbnailControls for admin
  - Shows keyword dropdown for adding keywords
  - Shows remove button on keywords
  - Shows delete pattern button
  - Renders admin-only transform controls
  - Hides similar patterns section in admin mode

- **Admin mode - Save metadata** (7 tests)
  - Calls onSave with updated fields when save clicked
  - Shows saving state while request in progress
  - Shows success toast after successful save
  - Shows error toast when save fails
  - Disables save button when no changes made
  - Enables save button when changes detected
  - Preserves thumbnail URL when saving other fields

- **Admin mode - Keywords** (8 tests)
  - Shows keyword dropdown when search focused
  - Filters keywords by search term
  - Adds keyword when clicked in dropdown
  - Removes keyword when X clicked
  - Shows error when add keyword fails
  - Shows error when remove keyword fails
  - Excludes already-assigned keywords from dropdown
  - Clears search after adding keyword

- **Admin mode - Thumbnail transforms** (6 tests)
  - Calls transform API with correct operation
  - Updates thumbnail after transform
  - Shows error when transform fails
  - Calls onThumbnailTransformed callback
  - Handles delete and calls onDeleted callback
  - Shows confirmation before delete

- **Admin mode - Edge cases** (6 tests)
  - Handles pattern with no thumbnail
  - Handles pattern with no keywords
  - Handles empty keyword list in dropdown
  - Preserves unsaved changes when component re-renders
  - Resets form when pattern changes
  - Handles concurrent save requests

**Coverage improvement:** PatternDetailClient.tsx went from 0% to 97.67% statement coverage.

---

Added comprehensive tests for Voyage AI embeddings generation (16 new tests):

**Embeddings Library:**

- **embeddings.ts** (`src/lib/embeddings.test.ts`) - 16 tests
  - `generateEmbeddingsForPatterns()`:
    - Returns early when VOYAGE_API_KEY not configured
    - Returns zero counts when no patterns need embeddings
    - Returns zero counts when database fetch fails
    - Successfully generates embeddings for multiple patterns
    - Counts errors when thumbnail download fails
    - Counts errors when Voyage API returns error
    - Counts errors when database update fails
    - Skips patterns with null thumbnail_url
    - Filters by specific pattern IDs when provided
    - Handles network errors during image download gracefully
    - Handles Voyage API network errors gracefully
    - Handles empty embedding response from Voyage API
    - Logs progress during embedding generation
  - `generateEmbeddingsForBatch()`:
    - Returns early when no patterns in batch need embeddings
    - Returns early when fetch fails
    - Calls generateEmbeddingsForPatterns with batch pattern IDs

**Coverage improvement:** embeddings.ts went from 0% to 97.33% statement coverage.

### January 24, 2026

Added tests for Query Embedding Cache feature and URL validation improvements (44 new tests):

**Query Embedding Cache:**

- **query-embedding-cache.ts** (`src/lib/query-embedding-cache.test.ts`) - 26 tests
  - `normalizeQuery()` - lowercases, trims, collapses whitespace
  - `getCachedEmbedding()` - returns cached embedding on hit, null on miss
  - `getCachedEmbedding()` - error handling (returns null, doesn't throw)
  - `cacheEmbedding()` - stores normalized query with embedding
  - `cacheEmbedding()` - error handling (logs but doesn't throw)
  - `getCacheStats()` - returns statistics (total entries, hits, dates)
  - `cleanupCache()` - removes entries older than specified days

**Search API Cache Integration:**

- **route.test.ts** (`src/app/api/search/route.test.ts`) - 3 new tests (total: 23)
  - Uses cached embedding when available (cache hit)
  - Calls Voyage API and caches result on cache miss
  - Continues search even if cache check fails (graceful degradation)

**URL Validation Security:**

- **url-utils.ts** (`src/lib/url-utils.test.ts`) - 13 new tests (total: 41)
  - Allows javascript: in query params (not a scheme attack)
  - Allows URLs with http:/https: in query params
  - Allows all admin pages (/admin/users, /admin/analytics, /admin/exceptions, etc.)
  - Allows /account path
  - Improved scheme detection (path-only, not query params)

**Triage Component:**

- **TriagePatternCard.tsx** (`src/components/triage/TriagePatternCard.test.tsx`) - 2 new tests (total: 9)
  - Encodes custom returnUrl with query params
  - Uses custom returnUrl prop

### January 23, 2026

Added tests for triage navigation fix and URL validation security (37 new tests):

**URL Validation Utility:**

- **url-utils.ts** (`src/lib/url-utils.test.ts`) - 28 tests
  - Returns fallback for invalid inputs (undefined, empty, whitespace, non-paths)
  - Blocks open redirect attacks (protocol-relative, absolute URLs)
  - Blocks dangerous protocols (javascript:, data:, vbscript:)
  - Handles array inputs (takes first value, validates)
  - Allows valid admin paths (/admin/triage, /admin/keywords, etc.)
  - Blocks non-allowed paths (arbitrary admin paths, root, random paths)
  - Blocks path traversal attacks (.. in path, URL-encoded %2e%2e)
  - Allows .. in query string (not a traversal risk)
  - Trims whitespace

**Triage Component:**

- **TriagePatternCard.tsx** (`src/components/triage/TriagePatternCard.test.tsx`) - 7 tests
  - Edit link includes returnUrl=/admin/triage
  - Pattern name links to detail page without returnUrl
  - Add Keywords link includes returnUrl when no_keywords issue present
  - Displays pattern name, author, issue badges
  - Displays mirrored badge for mirror issues

**PatternEditForm.tsx** - 2 new tests (total: 39 tests)

- Navigates to returnUrl after saving when provided
- Cancel link navigates to returnUrl when provided

### January 22, 2026

Added tests for Pinned Keywords feature (50 new tests):

**Pinned Keywords API Routes:**

- **GET/POST /api/pinned-keywords** (`route.test.ts`) - 10 tests
  - Authentication required (401 for unauthenticated)
  - Returns pinned keywords with keyword data
  - Returns empty array when no pins
  - POST validates keyword_id is required
  - POST validates keyword exists
  - POST enforces 10-pin limit (422)
  - POST prevents duplicates (409)
  - POST returns created pinned keyword
  - Error handling for database failures

- **DELETE /api/pinned-keywords/[keywordId]** (`route.test.ts`) - 6 tests
  - Authentication required (401 for unauthenticated)
  - Validates keywordId parameter
  - Returns success on delete
  - Returns 404 when pin doesn't exist
  - Error handling for database failures

**Pinned Keywords Components:**

- **KeywordSidebar.tsx** (`KeywordSidebar.test.tsx`) - 18 tests
  - Renders keywords header
  - Shows pinned section when pins exist
  - Hides pinned section when no pins
  - Displays all keywords in list
  - Search filter functionality
  - Keyword selection/deselection
  - Clear all button visibility and functionality
  - Pin/unpin button interactions
  - Calls callbacks correctly

- **PinnedKeywordsManager.tsx** (`PinnedKeywordsManager.test.tsx`) - 16 tests
  - Renders pinned keywords list
  - Shows count indicator (X of 10)
  - Shows empty state when no pins
  - Shows/hides add button based on limit
  - Shows maximum reached message at 10 pins
  - Unpin API call and success message
  - Unpin error handling with rollback
  - Add keyword dropdown opens on click
  - Filters available keywords (excludes pinned)
  - Search filter in dropdown
  - Pin API call and success message
  - Pin error handling (422 limit, 409 duplicate)
  - Closes dropdown on backdrop click

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
