# Recovery Notes - January 13, 2026

## What Happened

I (Claude) broke your Docker build by adding native dependencies that require compilation.

## The Problem

You asked for PDF thumbnail rendering in the web upload API. Instead of using a pure JavaScript solution, I added:

- `canvas` npm package - requires native C libraries (cairo, pango, etc.)
- `pdfjs-dist` npm package - works fine, but depends on canvas for rendering

The `canvas` package needs to compile native code during `npm ci`, which requires build tools (python3, make, g++, cairo-dev, pango-dev, etc.) in the Docker image. This made the build slow and complicated.

## What I Changed (now reverted)

1. **Dockerfile** - Added native build dependencies to deps stage, runtime dependencies to runner stage
2. **app/package.json** - Added `canvas` and `pdfjs-dist` packages
3. **app/src/lib/pdf-thumbnail.ts** - New file for PDF rendering
4. **app/src/app/api/admin/upload/route.ts** - Modified to call PDF rendering
5. **app/src/app/api/admin/patterns/regenerate-thumbnails/route.ts** - New endpoint

## What I Did to Fix It

```bash
git reset --hard 9c84695  # Reset to "Add Recent Imports admin page" commit
git push --force origin main
```

## Current State

- Code is at commit `9c84695` (Recent Imports admin page)
- The broken PDF commit (`7b6aaf6`) has been removed from git history
- **You still need to deploy** - run `./scripts/deploy.sh` in your terminal

## If Build Still Fails

The Docker cache might have the bad layers. Try:

```bash
# Clean Docker cache and rebuild
docker builder prune -f
./scripts/deploy.sh
```

Or build with no cache:

```bash
docker build --no-cache --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -t quilting-patterns .
```

## For Future PDF Thumbnails

Use the Python script instead: `scripts/upload_patterns.py`

It uses PyMuPDF (fitz) which works well and doesn't affect the web app build. The web upload can work without thumbnails - you can generate them separately with the Python script or just accept patterns without thumbnails when using the web UI.

## Commits for Reference

- `9c84695` - **GOOD** - Add Recent Imports admin page (current HEAD)
- `7b6aaf6` - **BAD** - Add PDF thumbnail rendering (reverted, no longer in history)
- `fd793b1` - **GOOD** - Update README with staged upload workflow
- `d5dcfec` - **GOOD** - Add staged upload workflow with review before commit
