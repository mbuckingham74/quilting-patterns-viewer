# Quilting Pattern Manager

A web application to browse, search, and download quilting patterns. Built for Pam and her quilting friends.

## Project Overview

This app replaces the legacy Windows-only PVM (Pattern Viewer and Manager) software with a modern web interface. The original software is from 2008, the company is defunct, and the application cannot be reinstalled if the machine dies.

### Data Sources (in `/files/`)
- `patterns.db.20251212` - SQLite database with 15,651 patterns, 568 keywords
- `PVM_Thumbnails/` - 15,350 pre-rendered PNG thumbnails (256x256, black line art on white)

### Key Data Facts
- Pattern files are stored as deflate-compressed blobs in the `FileData` column
- File types: `.qli`, `.csq`, `.dxf`, `.pat`
- Thumbnails are named `{PatternID}.png`
- ~301 patterns have no thumbnail

## Tech Stack

- **Frontend**: Next.js 14+ (App Router)
- **Backend**: Supabase (hosted at https://base.tachyonfuture.com)
- **Auth**: Supabase Auth with Google OAuth
- **Database**: Supabase Postgres
- **Storage**: Supabase Storage (for thumbnails and pattern files)
- **AI Search**: Voyage AI multimodal embeddings + pgvector
- **Error Monitoring**: Sentry (production only)
- **Deployment**: Docker container on VPS at patterns.tachyonfuture.com
- **Reverse Proxy**: Nginx Proxy Manager (NPM) handles SSL

## Database Schema (Supabase Postgres)

```sql
-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table (managed by Supabase Auth, extended with profile)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Main patterns table
CREATE TABLE patterns (
  id INTEGER PRIMARY KEY,
  file_name TEXT,
  file_extension TEXT,
  file_size INTEGER,
  author TEXT,
  author_url TEXT,
  author_notes TEXT,
  notes TEXT,
  thumbnail_url TEXT,
  pattern_file_url TEXT,
  embedding vector(1024),        -- Voyage multimodal embedding for semantic search
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast vector similarity search (HNSW - better than IVFFlat for <1M rows)
CREATE INDEX idx_patterns_embedding_hnsw ON patterns USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Keywords for filtering
CREATE TABLE keywords (
  id INTEGER PRIMARY KEY,
  value TEXT NOT NULL UNIQUE
);

-- Pattern-keyword junction
CREATE TABLE pattern_keywords (
  pattern_id INTEGER REFERENCES patterns(id) ON DELETE CASCADE,
  keyword_id INTEGER REFERENCES keywords(id) ON DELETE CASCADE,
  PRIMARY KEY (pattern_id, keyword_id)
);

-- Keyword groups (optional, for organized filtering)
CREATE TABLE keyword_groups (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE keyword_group_keywords (
  keyword_group_id INTEGER REFERENCES keyword_groups(id) ON DELETE CASCADE,
  keyword_id INTEGER REFERENCES keywords(id) ON DELETE CASCADE,
  PRIMARY KEY (keyword_group_id, keyword_id)
);

-- Pinned keywords (user's favorite keywords for quick access)
CREATE TABLE pinned_keywords (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  keyword_id INTEGER REFERENCES keywords(id) ON DELETE CASCADE NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, keyword_id)
);

CREATE INDEX idx_pinned_keywords_user ON pinned_keywords(user_id);
CREATE INDEX idx_pinned_keywords_keyword ON pinned_keywords(keyword_id);

-- Indexes for performance
CREATE INDEX idx_patterns_file_extension ON patterns(file_extension);
CREATE INDEX idx_patterns_author ON patterns(author);
CREATE INDEX idx_keywords_value ON keywords(value);
CREATE INDEX idx_pattern_keywords_pattern ON pattern_keywords(pattern_id);
CREATE INDEX idx_pattern_keywords_keyword ON pattern_keywords(keyword_id);
```

## Supabase Storage Buckets

```
thumbnails/          -- Public bucket for pattern thumbnails
  {pattern_id}.png

patterns/            -- Private bucket for pattern files (requires auth)
  {pattern_id}.{extension}
```

## Migration Script Requirements

Create a Python script (`scripts/migrate.py`) that:

1. Reads the SQLite database from `files/patterns.db.20251212`
2. Connects to Supabase using service role key
3. Uploads all thumbnails from `files/PVM_Thumbnails/` to Supabase Storage `thumbnails` bucket
4. Extracts and decompresses pattern files (using `zlib.decompress(data, -15)`) and uploads to `patterns` bucket
5. Inserts all records into Postgres tables
6. Maps the original IDs to preserve relationships

Environment variables needed:
```
SUPABASE_URL=https://base.tachyonfuture.com
SUPABASE_SERVICE_KEY=<service_role_key>
```

## Project Structure

```
patterns/
├── CLAUDE.md
├── files/
│   ├── patterns.db.20251212
│   ├── PVM_Thumbnails/
│   └── ui/
│       └── pvm-UI.png          # Reference screenshot of original app
├── scripts/
│   ├── migrate.py              # SQLite → Supabase migration
│   ├── generate_embeddings.py  # Voyage AI embeddings for search
│   ├── detect_orientation.py   # AI orientation detection
│   ├── detect_mirrored.py      # AI mirror detection
│   └── compute_similarities.py # Duplicate detection
├── app/                        # Next.js app
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Landing/browse page
│   │   ├── auth/
│   │   │   ├── login/page.tsx
│   │   │   └── callback/route.ts
│   │   ├── patterns/
│   │   │   └── [id]/page.tsx   # Pattern detail page
│   │   └── api/
│   │       ├── patterns/[id]/route.ts  # Fetch single pattern with keywords
│   │       └── download/[id]/route.ts  # Pattern file download
│   ├── components/
│   │   ├── PatternGrid.tsx
│   │   ├── PatternCard.tsx
│   │   ├── KeywordFilter.tsx
│   │   ├── SearchBar.tsx
│   │   ├── AuthButton.tsx
│   │   ├── Toast.tsx           # Toast notification system
│   │   ├── ErrorBoundary.tsx   # React error boundary
│   │   ├── FlipButton.tsx      # Horizontal flip button for mirrored thumbnails
│   │   ├── PatternDetailThumbnail.tsx  # Client-side thumbnail with flip support
│   │   ├── PatternModal.tsx    # URL-synced modal for pattern details
│   │   └── AdminActivityLog.tsx # Admin activity audit log with undo
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts       # Browser client
│   │   │   ├── server.ts       # Server client
│   │   │   └── middleware.ts
│   │   ├── activity-log.ts     # Admin activity logging utility
│   │   ├── embeddings.ts       # Voyage AI embedding generation
│   │   ├── errors.ts           # Error codes, parsing, Sentry integration
│   │   ├── api-response.ts     # API route response helpers
│   │   ├── fetch-with-retry.ts # Fetch wrapper with retry logic
│   │   └── utils.ts
│   ├── hooks/
│   │   ├── useFetch.ts         # React hook for fetch with retry
│   │   └── usePatternModal.ts  # URL-synced modal state management
│   ├── public/
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── tsconfig.json
├── Dockerfile
├── docker-compose.yml
└── .env.local.example
```

## Core Features (Phase 1)

### Browse Patterns
- Responsive thumbnail grid (similar to original PVM layout)
- Infinite scroll or pagination (50 patterns per page)
- Click thumbnail to view pattern detail

### Search & Filter
- Text search across file_name, author, notes
- Filter by keyword (sidebar or dropdown)
- Filter by file extension
- Sort by: name, author, date added

### Pattern Detail (Modal + Page)
- **Modal view**: Click pattern in browse grid → opens URL-synced modal overlay
- **Full page**: Direct navigation to `/patterns/{id}` shows dedicated page
- Larger thumbnail view with metadata (file name, extension, author, notes)
- Keywords as clickable tags (filter by keyword)
- Download button (requires auth)
- Admin inline editing (name, author, notes, keywords, thumbnail transforms)

### Authentication
- Google OAuth via Supabase
- Protected routes for downloads
- Simple profile (just email/name)

## Natural Language Search (Voyage AI + pgvector)

Users can describe patterns in natural language (e.g., "butterflies with swirls", "floral border patterns") and get visually relevant results.

### Architecture

1. **Embedding Generation (one-time)**
   - Use Voyage AI's `voyage-multimodal-3` model to embed all 15,350 thumbnails
   - Cost: ~$1.80 total (images ~1k tokens each, $0.12/1M tokens)
   - Store 1024-dimensional vectors in `patterns.embedding` column

2. **Search Flow**
   - User enters natural language query
   - Embed query text using `voyage-multimodal-3`
   - Vector similarity search (cosine) returns top N matches
   - (Optional) Claude re-ranks or explains why patterns match

### Implementation

**Embedding Script** (`scripts/generate_embeddings.py`):
```python
import voyageai
from supabase import create_client
import base64

vo = voyageai.Client(api_key=VOYAGE_API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Fetch patterns without embeddings
patterns = supabase.table('patterns').select('id, thumbnail_url').is_('embedding', None).execute()

for pattern in patterns.data:
    # Download thumbnail
    img_bytes = download_image(pattern['thumbnail_url'])
    img_base64 = base64.b64encode(img_bytes).decode('utf-8')
    
    # Generate embedding
    result = vo.multimodal_embed(
        inputs=[[{'type': 'image', 'data': img_base64, 'encoding': 'base64'}]],
        model='voyage-multimodal-3'
    )
    embedding = result.embeddings[0]
    
    # Store in Supabase
    supabase.table('patterns').update({'embedding': embedding}).eq('id', pattern['id']).execute()
```

**Search API Route** (`app/api/search/route.ts`):
```typescript
import { createClient } from '@supabase/supabase-js';
import VoyageAI from 'voyageai';

const voyage = new VoyageAI({ apiKey: process.env.VOYAGE_API_KEY });

export async function POST(request: Request) {
  const { query } = await request.json();
  
  // Embed the text query
  const embeddingResult = await voyage.multimodalEmbed({
    inputs: [[{ type: 'text', text: query }]],
    model: 'voyage-multimodal-3'
  });
  const queryEmbedding = embeddingResult.embeddings[0];
  
  // Vector similarity search in Supabase
  const { data: patterns } = await supabase.rpc('match_patterns', {
    query_embedding: queryEmbedding,
    match_threshold: 0.3,
    match_count: 50
  });
  
  return Response.json({ patterns });
}
```

**Supabase RPC Function** (`scripts/013_vector_search_index.sql`):
```sql
CREATE OR REPLACE FUNCTION search_patterns_semantic(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.2,
  match_count int DEFAULT 50
)
RETURNS TABLE (
  id int,
  file_name text,
  file_extension text,
  author text,
  thumbnail_url text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    p.id,
    p.file_name,
    p.file_extension,
    p.author,
    p.thumbnail_url,
    (1 - (p.embedding <=> query_embedding))::float AS similarity
  FROM patterns p
  WHERE p.embedding IS NOT NULL
    AND (1 - (p.embedding <=> query_embedding)) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

**Performance Note**: Requires HNSW index and planner tuning for optimal performance (~2-3ms queries). See `docs/PERFORMANCE_OPTIMIZATIONS.md` for details.

### Environment Variables

Add to `.env.local`:
```bash
VOYAGE_API_KEY=<your_voyage_api_key>
```

### UI Component

Add a search bar that:
- Accepts natural language input
- Shows loading state while embedding + searching
- Displays results in the same grid format
- Optionally shows similarity score or "why this matched"

## Admin Features

### Admin Activity Log

Track all admin actions for audit purposes. Located at `/admin/activity`.

**Database Table** (`admin_activity_log`):
```sql
CREATE TABLE admin_activity_log (
  id SERIAL PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES profiles(id),
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  description TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Logged Actions**:
- `user.approve` / `user.reject` - User account management
- `pattern.delete` / `pattern.update` / `pattern.transform` - Pattern changes
- `keyword.create` / `keyword.update` / `keyword.delete` / `keyword.merge` - Keyword management
- `orientation.review` - Thumbnail review status

**Undo Feature**: Some actions can be undone via the activity log UI:
- `keyword.update` - Restore original keyword name
- `user.approve` - Revoke user approval

API: `POST /api/admin/activity/undo` with `{ activity_id: number }`

### Auto-Generated Embeddings

When an admin commits a batch of imported patterns, embeddings are automatically generated in the background:

1. Admin uploads ZIP → patterns staged for review
2. Admin reviews on Recent Imports page
3. Admin clicks "Save" (commit) → patterns become visible
4. **Embeddings automatically generate** → patterns become AI-searchable

Implementation: `app/src/lib/embeddings.ts` - Voyage AI integration called from batch commit endpoint.

The manual script `scripts/generate_embeddings.py` can still be run to backfill any patterns missing embeddings.

## Pinned Keywords

Authenticated users can pin up to 10 keywords for quick access. Pinned keywords appear at the top of the keyword sidebar on the browse page.

### Features
- **Inline pinning**: Hover over any keyword in the sidebar and click the pin icon
- **Account management**: Full pin management available at `/account`
- **Display order**: Pinned keywords maintain their order (by display_order, then created_at)
- **10-pin limit**: Enforced both client-side and via database trigger

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/pinned-keywords` | GET | Fetch user's pinned keywords with keyword data |
| `/api/pinned-keywords` | POST | Pin a keyword `{ keyword_id }` → 201/409/422 |
| `/api/pinned-keywords/[keywordId]` | DELETE | Unpin a keyword (idempotent) |

### Components
- `KeywordSidebar.tsx` - Displays pinned section at top, pin/unpin buttons on hover
- `KeywordSidebarWrapper.tsx` - Client wrapper handling API calls with optimistic updates
- `PinnedKeywordsManager.tsx` - Account page component for managing pins

## Pattern Modal (URL-Synced)

When browsing patterns, clicking a pattern opens a modal overlay instead of navigating to a new page. The modal uses the URL-synced pattern (similar to Instagram/Pinterest) for seamless UX.

### How It Works
1. **Click pattern** → Modal opens over browse page
2. **URL updates** → `pushState` changes URL to `/patterns/{id}` (bookmarkable/shareable)
3. **Back button** → Closes modal via `popstate` event, returns to browse
4. **Direct navigation** → Going to `/patterns/{id}` directly shows the full page (not modal)
5. **Modifier clicks** → Ctrl/Cmd/Shift/middle-click opens in new tab (respects user intent)

### Components

| Component | Purpose |
|-----------|---------|
| `usePatternModal.ts` | Hook managing modal state, URL sync, body scroll lock, escape key |
| `PatternModal.tsx` | Full modal UI with pattern details, admin editing, similar patterns |
| `BrowseContent.tsx` | Integrates modal into browse page |
| `PatternCard.tsx` | Calls `onOpenModal` on unmodified clicks |

### API Endpoint

**GET `/api/patterns/[id]`** - Fetch single pattern with keywords
- Returns pattern data with `keywords` array (sorted alphabetically)
- Requires authentication
- Returns 404 for invalid/missing patterns

### Key Implementation Details
- Body scroll locked when modal open (`overflow: hidden`)
- Escape key closes modal
- Click outside modal content closes it
- `navigateToPattern(id)` uses `replaceState` for similar pattern navigation (no extra history entries)
- Accessible: `aria-modal`, `aria-labelledby` with state-aware heading for loading/error/success

## Phase 2 Features (Future)

- User favorites/collections
- Pattern sharing links
- Claude-powered "explain this match" feature

## Docker Configuration

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY app/package*.json ./
RUN npm ci
COPY app/ .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    restart: unless-stopped
```

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://base.tachyonfuture.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
VOYAGE_API_KEY=<voyage_api_key>              # For AI semantic search
ANTHROPIC_API_KEY=<anthropic_api_key>        # For AI orientation/mirror detection

# Production only (optional)
NEXT_PUBLIC_SENTRY_DSN=<sentry_dsn>          # Error monitoring
RESEND_API_KEY=<resend_api_key>              # Admin email notifications
```

## NPM (Nginx Proxy Manager) Setup

- Domain: patterns.tachyonfuture.com
- Proxy to: http://localhost:3000 (or container IP)
- SSL: Let's Encrypt auto
- Websockets: Enable (for Supabase realtime if needed later)

## UI Design Notes

Reference the original PVM interface in `files/ui/pvm-UI.png`:
- Left sidebar: Keyword list with checkboxes
- Center: Thumbnail grid (4-5 columns)
- Right panel: Properties/details (can be modal on web)
- Clean, simple, functional — this is for quilters, not designers

Use Tailwind CSS with a light, warm color scheme. Patterns are black line art on white, so the UI should complement that.

## Development Commands

```bash
# Setup
cd app
npm install

# Development
npm run dev

# Build
npm run build

# Migration (run once)
cd scripts
python migrate.py
```

## Deployment

**IMPORTANT**: Always use the deploy script. Do not run docker build manually.

```bash
# Deploy to production (from project root)
./scripts/deploy.sh
```

The deploy script handles:
- Building for linux/amd64 (server architecture)
- Passing NEXT_PUBLIC_* build args (required at compile time for Next.js)
- Transferring image to server
- Restarting container with correct env vars
- Verifying HTTP 200 response

The server runs at https://patterns.tachyonfuture.com via Nginx Proxy Manager.

## Security

### API Security

- **Search API** (`/api/search`): Requires authentication. Rate-limited to 60 requests/minute per user with HTTP 429 responses and Retry-After headers. Query length validated (2-500 chars), results capped at 100.

- **Admin Notify Signup** (`/api/admin/notify-signup`): Internal-only endpoint protected by `x-internal-secret` header (uses SUPABASE_SERVICE_ROLE_KEY as shared secret). Only called by OAuth callback.

- **Admin Upload** (`/api/admin/upload`): Requires admin role. Uses service-role client to bypass RLS for storage operations.

- **Download API** (`/api/download/[id]`): Requires authentication. Sanitizes filenames before use in Content-Disposition headers.

### Database Security

- **RLS Policies**: All tables restrict SELECT to authenticated users only (not PUBLIC/anon).
- **Pattern IDs**: Use PostgreSQL sequence (`patterns_id_seq`) to prevent race conditions. Migration: `scripts/011_pattern_id_sequence.sql`
- **Profile Protection**: RLS policies and triggers prevent users from self-promoting to admin via email spoofing. Migrations: `scripts/009_fix_profile_self_promotion.sql`, `scripts/010_fix_security_definer_bypass.sql`

### Migrations Required

Run these in Supabase SQL Editor before deploying new security features:
```bash
# Pattern ID sequence (prevents race conditions in uploads)
scripts/011_pattern_id_sequence.sql

# Profile self-promotion fix
scripts/009_fix_profile_self_promotion.sql
scripts/010_fix_security_definer_bypass.sql

# Security hardening (Jan 2026) - RLS policies, anon revokes, function search paths
scripts/012_security_fixes.sql

# Vector search optimization (Jan 2026) - HNSW index, planner tuning
scripts/013_vector_search_index.sql
```

### Security Hardening (Migration 012)

Applied January 2026 to address Supabase Security Advisor warnings:

1. **RLS Policy Gaps**: Added policy to `admin_emails` table (had RLS but no policies)
2. **Overly Permissive Policies**: Removed "viewable by everyone" SELECT policies that allowed unauthenticated access to `patterns`, `keywords`, `pattern_keywords`, `keyword_groups`, `keyword_group_keywords`
3. **Anon Role Permissions**: Revoked all permissions from `anon` role on all public tables (defense in depth - RLS was already blocking, but best practice)
4. **INSERT Validation**: Added WITH CHECK clauses to INSERT policies for `download_logs`, `search_logs`, `view_logs`, `saved_searches`, `user_favorites`, `shared_collections`, `shared_collection_patterns`
5. **Function Search Paths**: Set `search_path = public` on 11 functions to prevent search path injection attacks
6. **Note**: "Extension in Public" warning for pgvector is acceptable for self-hosted Supabase

## Error Handling

The app has a comprehensive error handling system. See `docs/ERROR_HANDLING.md` for full details.

### Key Components

| File | Purpose |
|------|---------|
| `lib/errors.ts` | Error codes, parsing, Sentry integration |
| `lib/api-response.ts` | Standardized API error responses |
| `lib/fetch-with-retry.ts` | Automatic retry with exponential backoff |
| `hooks/useFetch.ts` | React hook for fetch with retry |
| `components/Toast.tsx` | User-friendly toast notifications |
| `components/ErrorBoundary.tsx` | React error boundary for crash recovery |
| `app/error.tsx` | Next.js route-level error page |
| `app/global-error.tsx` | Next.js root error page |

### Sentry Integration

Errors are automatically sent to Sentry in production when `NEXT_PUBLIC_SENTRY_DSN` is configured.

```typescript
import { logError, setErrorUser, addErrorBreadcrumb } from '@/lib/errors'

// Log errors with context (auto-sends to Sentry in production)
logError(error, { component: 'PatternGrid', action: 'load_patterns', userId })

// Set user context for better debugging
setErrorUser(userId, email)

// Add breadcrumbs to trace user actions
addErrorBreadcrumb('Downloaded pattern', 'user', { patternId: 123 })
```

### Graceful Degradation

**AI Search Fallback**: When Voyage AI is unavailable, search automatically falls back to text-based search:
- Falls back on: API key missing, network error, rate limit, timeout
- Text search matches: `file_name`, `author`, `notes` fields
- UI shows indicator: "Using text search (AI search temporarily unavailable)"
- Response includes: `searchMethod: 'semantic' | 'text'` and `fallbackUsed: boolean`

### Toast Notifications

```typescript
import { useToast } from '@/components/Toast'

const { showError, showSuccess } = useToast()
showSuccess('Pattern downloaded!')
showError(error, 'Download failed')  // Auto-parses error for user-friendly message
```

## AI Thumbnail Analysis

The app uses Claude Vision to detect thumbnail issues that need correction.

### Database Tables

```sql
-- Orientation analysis (rotation issues)
CREATE TABLE orientation_analysis (
  id SERIAL PRIMARY KEY,
  pattern_id INTEGER REFERENCES patterns(id) ON DELETE CASCADE UNIQUE,
  orientation TEXT NOT NULL,  -- 'correct', 'rotate_90_cw', 'rotate_90_ccw', 'rotate_180'
  confidence TEXT NOT NULL,   -- 'high', 'medium', 'low'
  reason TEXT,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mirror analysis (horizontally flipped images)
CREATE TABLE mirror_analysis (
  id SERIAL PRIMARY KEY,
  pattern_id INTEGER REFERENCES patterns(id) ON DELETE CASCADE UNIQUE,
  is_mirrored BOOLEAN NOT NULL,
  confidence TEXT NOT NULL,   -- 'high', 'medium', 'low'
  reason TEXT,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Scripts

**Orientation Detection** (`scripts/detect_orientation.py`):
- Analyzes thumbnails for rotation issues using Claude Vision
- Stores results in `orientation_analysis` table
- Run: `python scripts/detect_orientation.py [--limit N] [--batch-size N]`

**Mirror Detection** (`scripts/detect_mirrored.py`):
- Detects horizontally mirrored images (backwards text like "YMRA" instead of "ARMY")
- Stores results in `mirror_analysis` table
- Run: `python scripts/detect_mirrored.py [--limit N] [--batch-size N]`

### API Endpoints

**GET `/api/admin/orientation`**
- Query params: `page`, `limit`, `filter` ('needs_rotation' | 'mirrored' | 'all' | 'reviewed')
- Returns patterns flagged for issues with stats
- When `filter=mirrored`, queries `mirror_analysis` table instead

**PATCH `/api/admin/orientation`**
- Body: `{ pattern_ids: number[], reviewed: boolean, source?: 'orientation_analysis' | 'mirror_analysis' }`
- Marks patterns as reviewed in the appropriate table

**POST `/api/admin/patterns/[id]/transform`**
- Body: `{ operation: 'rotate_cw' | 'rotate_ccw' | 'rotate_180' | 'flip_h' | 'flip_v' }`
- Applies transformation to thumbnail using Sharp
- `flip_h`: Horizontal flip for mirrored images
- `flip_v`: Vertical flip for upside-down + mirrored images

### Review Page

The pattern triage page (`/admin/triage`) provides a unified workflow for fixing pattern issues:
- **Filter tabs**: All, Rotation, Mirror, No Keywords (with live counts)
- **Issue badges**: Confidence levels (high/medium/low) and issue types
- **Quick actions**: Recommended rotation, flip, mark correct
- **Bulk selection**: Checkbox selection with shift-click for ranges
- **Keyboard shortcuts**: j/k navigate, space select, r rotate, f flip, c mark correct
- Patterns automatically leave the queue when all issues are resolved

## Notes

- Original PVM stored patterns as .NET BinaryFormatter serialized blobs — we extracted the raw files during migration
- Thumbnails were also .NET serialized GraphicsPath objects — we rendered them to PNG using a C# tool on Windows
- The 301 patterns without thumbnails can display a placeholder image
- FileData is raw deflate compressed (no header) — decompress with `zlib.decompress(data, -15)`
