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
- **Deployment**: Docker container on VPS at patterns.tachyonfuture.com
- **Reverse Proxy**: Nginx Proxy Manager (NPM) handles SSL

## Database Schema (Supabase Postgres)

```sql
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
│   └── migrate.py              # SQLite → Supabase migration
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
│   │       └── download/[id]/route.ts  # Pattern file download
│   ├── components/
│   │   ├── PatternGrid.tsx
│   │   ├── PatternCard.tsx
│   │   ├── KeywordFilter.tsx
│   │   ├── SearchBar.tsx
│   │   └── AuthButton.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts       # Browser client
│   │   │   ├── server.ts       # Server client
│   │   │   └── middleware.ts
│   │   └── utils.ts
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

### Pattern Detail Page
- Larger thumbnail view
- Metadata: file name, extension, author, notes
- Keywords as clickable tags
- Download button (requires auth)

### Authentication
- Google OAuth via Supabase
- Protected routes for downloads
- Simple profile (just email/name)

## Phase 2 Features (Future)

- Upload new patterns (accept .zip, extract, add to DB)
- User favorites/collections
- Pattern sharing links
- Admin panel for Pam to manage patterns

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

## Notes

- Original PVM stored patterns as .NET BinaryFormatter serialized blobs — we extracted the raw files during migration
- Thumbnails were also .NET serialized GraphicsPath objects — we rendered them to PNG using a C# tool on Windows
- The 301 patterns without thumbnails can display a placeholder image
- FileData is raw deflate compressed (no header) — decompress with `zlib.decompress(data, -15)`
