# Deployment & Database Access

## Server Access

SSH into the production server:
```bash
ssh michael@100.115.127.119
```

This is a Tailscale IP address for the VPS that hosts the Docker container.

## Running SQL Migrations

### How Claude Runs Migrations (Preferred)

Claude runs migrations directly via SSH + psql by piping the SQL file:
```bash
cat scripts/XXX_migration.sql | ssh michael@100.115.127.119 'docker exec -i supabase-db psql -U postgres'
```

This is the fastest and most reliable method. Claude will run migrations when asked; the user handles deployment.

### Manual Option 1: Supabase SQL Editor

1. Go to the Supabase dashboard for the project
2. Navigate to SQL Editor
3. Copy the contents of the migration file (e.g., `scripts/026_admin_activity_log.sql`)
4. Paste and run in the SQL Editor

### Manual Option 2: Via psql on Server

SSH into the server and connect to the database:
```bash
ssh michael@100.115.127.119
cd /home/michael/docker-configs/supabase
docker exec -it supabase-db psql -U postgres
```

Then run the migration:
```sql
\i /path/to/migration.sql
-- or paste the SQL directly
```

### Manual Option 3: Using Supabase CLI (if installed locally)

```bash
# From the project root
supabase db push
```

## Deploying Code Changes

Always use the deploy script from the project root:
```bash
./scripts/deploy.sh
```

This handles:
- Building for linux/amd64 (server architecture)
- Passing NEXT_PUBLIC_* build args
- Transferring image to server
- Restarting container
- Verifying HTTP 200 response

## Checking Container Status

```bash
ssh michael@100.115.127.119 'docker ps | grep quilting'
ssh michael@100.115.127.119 'docker logs quilting-patterns --tail 50'
```

## Restarting Services

```bash
# App container
ssh michael@100.115.127.119 'docker restart quilting-patterns'

# Supabase Auth (if OAuth issues)
ssh michael@100.115.127.119 'cd /home/michael/docker-configs/supabase && docker compose restart auth'
```

## Database Connection Details

- **Host**: base.tachyonfuture.com (Supabase instance)
- **Database**: postgres
- **Tables**: See CLAUDE.md for schema

## Migration File Naming

Sequential numbering: `XXX_description.sql`
- Current latest: `012_security_fixes.sql`
- Next migration should be: `013_*.sql`

Note: Migration numbering was reset. The `012_security_fixes.sql` migration addresses
Supabase Security Advisor warnings (RLS policies, anon permissions, function search paths).

## Important Notes

1. **Never commit secrets** - Use environment variables
2. **Test migrations locally first** if possible
3. **Backup before destructive migrations** (DROP, DELETE, ALTER)
4. **Check RLS policies** - Most tables require admin access
