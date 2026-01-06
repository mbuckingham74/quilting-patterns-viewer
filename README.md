<div align="center">
  <img src="images/patterns_logo.png" alt="Quilting Patterns Logo" width="200"/>

  # Quilting Pattern Manager

  **A modern web app to browse, search, and download quilting patterns**

  [![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
  [![Supabase](https://img.shields.io/badge/Supabase-Postgres-green?logo=supabase)](https://supabase.com/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
  [![License](https://img.shields.io/badge/License-Private-red)]()

  [Live Demo](https://patterns.tachyonfuture.com) &bull; [Documentation](CLAUDE.md) &bull; [Error Handling](docs/ERROR_HANDLING.md)
</div>

---

## Overview

This application replaces the legacy Windows-only **PVM (Pattern Viewer and Manager)** software with a modern, accessible web interface. The original software from 2008 is no longer supported and cannot be reinstalled if the machine fails.

### Key Stats

| Metric | Value |
|--------|-------|
| Total Patterns | 15,651 |
| Keywords | 568 |
| Thumbnails | 15,350 |
| File Types | `.qli`, `.csq`, `.dxf`, `.pat` |

---

## Features

### Pattern Browsing
- Responsive thumbnail grid optimized for all screen sizes
- Infinite scroll pagination (50 patterns per page)
- Filter by keyword, file extension, or author
- Sort by name, author, or date added

### AI-Powered Search
- **Natural language search** - Describe what you're looking for (e.g., "butterflies with swirls", "floral border patterns")
- Powered by Voyage AI multimodal embeddings + pgvector
- Automatic fallback to text search if AI service is unavailable

### Authentication & Security
- Google OAuth via Supabase
- Row-level security (RLS) on all database tables
- Protected pattern downloads
- Admin panel for user management

### Error Handling
- Comprehensive toast notification system
- React error boundaries for crash recovery
- Automatic retry with exponential backoff
- Sentry integration for production monitoring
- Graceful degradation for external services

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS |
| **Backend** | Supabase (Postgres + Auth + Storage) |
| **AI Search** | Voyage AI multimodal embeddings, pgvector |
| **Error Monitoring** | Sentry |
| **Deployment** | Docker, Nginx Proxy Manager |

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase project (or self-hosted instance)

### Installation

```bash
# Clone the repository
git clone https://github.com/mbuckingham74/quilting-patterns-viewer.git
cd quilting-patterns-viewer

# Install dependencies
cd app
npm install

# Set up environment variables
cp ../.env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VOYAGE_API_KEY=your-voyage-api-key

# Optional (Production)
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
RESEND_API_KEY=your-resend-api-key
```

---

## Deployment

### Using the Deploy Script

```bash
# From project root
./scripts/deploy.sh
```

The script handles:
- Building Docker image for linux/amd64
- Passing NEXT_PUBLIC_* build args
- Transferring to production server
- Restarting the container
- Verifying HTTP 200 response

### Manual Docker Build

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -t quilting-patterns:latest .
```

---

## Project Structure

```
patterns/
├── app/                        # Next.js application
│   ├── src/
│   │   ├── app/               # App Router pages & API routes
│   │   ├── components/        # React components
│   │   ├── lib/               # Utilities & Supabase clients
│   │   └── hooks/             # Custom React hooks
│   ├── sentry.*.config.ts     # Sentry configuration
│   └── package.json
├── scripts/                    # Migration & deployment scripts
├── docs/                       # Additional documentation
├── CLAUDE.md                   # Main project documentation
├── Dockerfile
└── docker-compose.yml
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [CLAUDE.md](CLAUDE.md) | Main project documentation, architecture, and development guide |
| [docs/ERROR_HANDLING.md](docs/ERROR_HANDLING.md) | Comprehensive error handling system documentation |

---

## Database Schema

The app uses Supabase Postgres with the following main tables:

- **patterns** - Pattern metadata, file URLs, and vector embeddings
- **keywords** - Searchable keyword taxonomy
- **pattern_keywords** - Many-to-many junction table
- **profiles** - Extended user profiles
- **admin_emails** - Admin notification recipients

See [CLAUDE.md](CLAUDE.md#database-schema-supabase-postgres) for the complete schema.

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/search` | POST | Required | AI-powered pattern search |
| `/api/download/[id]` | GET | Required | Download pattern file |
| `/api/favorites` | GET/POST | Required | User favorites |
| `/api/saved-searches` | GET/POST | Required | Saved search queries |
| `/api/admin/upload` | POST | Admin | Upload new patterns |
| `/api/admin/users` | GET | Admin | User management |

---

## Error Handling

The app includes a robust error handling system:

```typescript
// Show user-friendly toast notifications
import { useToast } from '@/components/Toast'
const { showError, showSuccess } = useToast()
showError(error, 'Download failed')

// Log errors with Sentry integration
import { logError } from '@/lib/errors'
logError(error, { component: 'PatternGrid', action: 'load' })
```

See [docs/ERROR_HANDLING.md](docs/ERROR_HANDLING.md) for complete documentation.

---

## Contributing

This is a private project built for a specific use case. However, the architecture and patterns used may be helpful for similar applications.

---

## License

Private - All rights reserved.

---

<div align="center">
  <sub>Built with care for Pam and her quilting friends</sub>
</div>
