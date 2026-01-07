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
  email TEXT NOT NULL,
  display_name TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
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

-- Index for fast vector similarity search
CREATE INDEX idx_patterns_embedding ON patterns USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

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

-- Indexes for performance
CREATE INDEX idx_patterns_file_extension ON patterns(file_extension);
CREATE INDEX idx_patterns_author ON patterns(author);
CREATE INDEX idx_keywords_value ON keywords(value);
CREATE INDEX idx_pattern_keywords_pattern ON pattern_keywords(pattern_id);
CREATE INDEX idx_pattern_keywords_keyword ON pattern_keywords(keyword_id);

-- User favorites
CREATE TABLE user_favorites (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  pattern_id INTEGER REFERENCES patterns(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, pattern_id)
);

-- Saved AI searches
CREATE TABLE saved_searches (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pattern sharing with customers
CREATE TABLE shared_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by UUID REFERENCES profiles(id) NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  message TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shared_collection_patterns (
  id SERIAL PRIMARY KEY,
  collection_id UUID REFERENCES shared_collections(id) ON DELETE CASCADE,
  pattern_id INTEGER REFERENCES patterns(id) ON DELETE CASCADE,
  "position" INTEGER NOT NULL,
  UNIQUE(collection_id, pattern_id)
);

CREATE TABLE shared_collection_feedback (
  id SERIAL PRIMARY KEY,
  collection_id UUID REFERENCES shared_collections(id) ON DELETE CASCADE UNIQUE,
  rankings JSONB NOT NULL,  -- [{pattern_id: 123, rank: 1}, ...]
  customer_name TEXT,
  customer_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Duplicate pattern tracking
CREATE TABLE duplicate_reviews (
  id SERIAL PRIMARY KEY,
  pattern_id_1 INTEGER REFERENCES patterns(id) ON DELETE CASCADE,
  pattern_id_2 INTEGER REFERENCES patterns(id) ON DELETE CASCADE,
  similarity FLOAT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'duplicate', 'not_duplicate'
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pattern_id_1, pattern_id_2)
);

-- Admin email notification list
CREATE TABLE admin_emails (
  email TEXT PRIMARY KEY
);
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
├── README.md
├── files/
│   ├── patterns.db.20251212
│   ├── PVM_Thumbnails/
│   └── ui/
│       └── pvm-UI.png          # Reference screenshot of original app
├── scripts/
│   ├── migrate.py              # SQLite → Supabase migration
│   ├── generate_embeddings.py  # Voyage AI embedding generation
│   ├── deploy.sh               # Production deployment script
│   └── *.sql                   # Database migrations (001-014)
├── docs/
│   └── ERROR_HANDLING.md       # Error handling documentation
├── app/                        # Next.js app
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx            # Landing page
│   │   │   ├── browse/page.tsx     # Pattern browser
│   │   │   ├── account/page.tsx    # User account & shares
│   │   │   ├── share/[token]/      # Public share view
│   │   │   ├── auth/               # Login, signup, callback
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx        # Admin dashboard
│   │   │   │   ├── users/          # User management
│   │   │   │   ├── approved-users/ # Approved users table
│   │   │   │   ├── upload/         # Pattern upload
│   │   │   │   ├── duplicates/     # Duplicate finder
│   │   │   │   └── help/           # How-to guide
│   │   │   ├── patterns/[id]/      # Pattern detail
│   │   │   └── api/
│   │   │       ├── search/         # AI search
│   │   │       ├── download/[id]/  # File download
│   │   │       ├── favorites/      # User favorites
│   │   │       ├── saved-searches/ # Saved searches
│   │   │       ├── shares/         # Pattern sharing
│   │   │       └── admin/          # Admin endpoints
│   │   ├── components/
│   │   │   ├── PatternGrid.tsx
│   │   │   ├── PatternCard.tsx
│   │   │   ├── ShareBasket.tsx     # Pattern selection for sharing
│   │   │   ├── ShareModal.tsx      # Share creation form
│   │   │   ├── PatternRanker.tsx   # Drag-to-rank for customers
│   │   │   ├── Toast.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   ├── contexts/
│   │   │   └── ShareContext.tsx    # Share basket state
│   │   ├── lib/
│   │   │   ├── supabase/
│   │   │   ├── errors.ts
│   │   │   ├── api-response.ts
│   │   │   └── fetch-with-retry.ts
│   │   └── hooks/
│   │       └── useFetch.ts
│   ├── public/
│   └── package.json
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

### Pattern Detail Page
- Larger thumbnail view
- Metadata: file name, extension, author, notes
- Keywords as clickable tags
- Download button (requires auth)

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

**Supabase RPC Function**:
```sql
CREATE OR REPLACE FUNCTION match_patterns(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 50
)
RETURNS TABLE (
  id int,
  file_name text,
  thumbnail_url text,
  similarity float
)
LANGUAGE sql STABLE
AS $
  SELECT
    patterns.id,
    patterns.file_name,
    patterns.thumbnail_url,
    1 - (patterns.embedding <=> query_embedding) AS similarity
  FROM patterns
  WHERE 1 - (patterns.embedding <=> query_embedding) > match_threshold
  ORDER BY patterns.embedding <=> query_embedding
  LIMIT match_count;
$;
```

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

## Implemented Features

### User Features
- **Favorites** - Save patterns to personal collection
- **Saved Searches** - Store and replay AI search queries
- **Pattern Sharing** - Share up to 10 patterns with customers via email
  - Customers can view thumbnails without an account
  - Drag-to-rank interface for customer feedback
  - Email notification when feedback is submitted
  - 30-day expiration on share links

### Admin Features
- **User Approval System** - New signups require admin approval
- **Pattern Upload** - Accept .zip files, extract, and add to DB with auto-generated embeddings
- **Duplicate Detection** - Find visually similar patterns using AI embeddings
  - Adjustable similarity threshold (0.90-0.99)
  - Batch review interface
- **Approved Users View** - Table with registration date, approval date, and last login
- **How-To Guide** - Built-in help documentation at `/admin/help`

## Future Features

- Claude-powered "explain this match" feature
- Bulk pattern management (delete, merge duplicates)
- User activity analytics

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

Run these in Supabase SQL Editor in order:
```bash
# Core tables
scripts/001_schema.sql                      # Initial schema
scripts/008_user_approval_system.sql        # User approval and RLS

# Security fixes
scripts/009_fix_profile_self_promotion.sql  # Prevent admin self-promotion
scripts/010_fix_security_definer_bypass.sql # Fix security definer bypass
scripts/011_pattern_id_sequence.sql         # Pattern ID sequence

# Feature tables
scripts/012_duplicate_detection.sql         # Duplicate review tracking
scripts/013_pattern_sharing.sql             # Pattern sharing tables
scripts/014_approved_users_with_login.sql   # User last login view
```

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

## Notes

- Original PVM stored patterns as .NET BinaryFormatter serialized blobs — we extracted the raw files during migration
- Thumbnails were also .NET serialized GraphicsPath objects — we rendered them to PNG using a C# tool on Windows
- The 301 patterns without thumbnails can display a placeholder image
- FileData is raw deflate compressed (no header) — decompress with `zlib.decompress(data, -15)`
