# Multi-Tenant Scaling Analysis

## Current State

The Quilting Pattern Manager is currently a **single-tenant application** designed for one user (Pam) and her friends. Key characteristics:

- **One pattern library**: 15,651 patterns shared by all users
- **One Supabase instance**: Self-hosted at base.tachyonfuture.com
- **Flat user model**: Users are either approved or admin, no organization concept
- **Shared storage**: All thumbnails and pattern files in single buckets
- **Single domain**: patterns.tachyonfuture.com

---

## Multi-Tenant Architecture Options

### Option 1: Shared Database with Tenant Column (Recommended for Start)

Add a `tenant_id` column to all tables. Simplest to implement, lowest infrastructure cost.

```sql
-- New tenants table
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,  -- for subdomain: {slug}.patterns.com
  owner_id UUID REFERENCES auth.users,
  plan TEXT DEFAULT 'free',   -- free, pro, enterprise
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add tenant_id to existing tables
ALTER TABLE patterns ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE keywords ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE profiles ADD COLUMN tenant_id UUID REFERENCES tenants(id);
-- ... all other tables
```

**Pros:**
- Single database, simple operations
- Easy to implement incrementally
- Shared infrastructure costs
- Cross-tenant features possible (marketplace?)

**Cons:**
- RLS policies become more complex
- Risk of data leakage if policies are wrong
- Large tenants could impact others (noisy neighbor)
- Harder to offer data residency guarantees

### Option 2: Schema-per-Tenant

Each tenant gets their own PostgreSQL schema within the same database.

```sql
CREATE SCHEMA tenant_acme;
CREATE SCHEMA tenant_quilters_guild;
-- Tables created in each schema
```

**Pros:**
- Better isolation than shared tables
- Easier to backup/restore individual tenants
- Can customize schema per tenant if needed

**Cons:**
- More complex connection management
- Schema migrations must run N times
- Still shares database resources

### Option 3: Database-per-Tenant

Each tenant gets their own Supabase project or database.

**Pros:**
- Complete isolation
- Can offer dedicated resources to enterprise
- Easy to meet compliance requirements
- No noisy neighbor issues

**Cons:**
- Highest operational complexity
- Most expensive
- Harder to implement cross-tenant features
- Need orchestration layer for provisioning

### Recommendation

**Start with Option 1 (shared database + tenant_id)**, then offer Option 3 for enterprise customers who need isolation. This is the pattern used by most successful SaaS products (Slack, Notion, etc.).

---

## Database Schema Changes

### New Tables

```sql
-- Tenants (organizations)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  owner_id UUID REFERENCES auth.users,

  -- Subscription
  plan TEXT DEFAULT 'free',
  plan_started_at TIMESTAMPTZ,
  plan_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- Limits (nullable = unlimited)
  max_patterns INTEGER,
  max_users INTEGER,
  max_storage_gb INTEGER,

  -- Settings
  settings JSONB DEFAULT '{}',
  -- e.g., { "allowPublicSharing": true, "defaultKeywordGroups": [...] }

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant membership (users can belong to multiple tenants)
CREATE TABLE tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',  -- owner, admin, member, viewer
  invited_by UUID REFERENCES auth.users,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(tenant_id, user_id)
);

-- Invitations (for users not yet signed up)
CREATE TABLE tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES auth.users,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Modified Tables

Every table that stores tenant-specific data needs:

```sql
-- Add to: patterns, keywords, pattern_keywords, keyword_groups,
-- keyword_group_keywords, orientation_analysis, mirror_analysis,
-- duplicate_patterns, upload_logs, search_logs, view_logs,
-- download_logs, saved_searches, user_favorites, shared_collections,
-- shared_collection_patterns, admin_activity_log

ALTER TABLE patterns ADD COLUMN tenant_id UUID REFERENCES tenants(id);
CREATE INDEX idx_patterns_tenant ON patterns(tenant_id);

-- Update RLS policies
CREATE POLICY "Users can view patterns in their tenant"
  ON patterns FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid()
    )
  );
```

### Global vs Tenant-Scoped Tables

| Table | Scope | Notes |
|-------|-------|-------|
| `auth.users` | Global | Supabase managed |
| `profiles` | Global | But add tenant memberships |
| `tenants` | Global | Tenant registry |
| `tenant_members` | Global | Membership mapping |
| `patterns` | Tenant | Core content |
| `keywords` | Tenant | Could have global defaults |
| `admin_activity_log` | Tenant | Audit per org |
| `admin_emails` | Tenant | Replace with tenant roles |

---

## Authentication & Authorization Changes

### Current Model (Single-Tenant)
```
User → approved (boolean) → can access everything
User → is_admin (boolean) → can do admin things
admin_emails table → whitelist of admin emails
profiles.is_admin → redundant admin flag
```

### New Model (Multi-Tenant, Simplified)

The multi-tenant model is **much simpler** than typical SaaS because each tenant is a single professional quilter - not an organization with multiple users.

```
Platform Admin (you)     → Global access, billing, support
Tenant Owner (quilter)   → Full control of their own schema
Guest (via share link)   → View/vote on shared patterns, no account
```

**What goes away:**
- User registration/approval workflow (no "users" to approve)
- `admin_emails` table (replaced by tenant ownership)
- `profiles.is_admin` flag (owner = admin of their tenant)
- Complex permission hierarchies (OWNER/ADMIN/MEMBER/VIEWER)
- Most RLS complexity (schema isolation handles it)

**What stays:**
- Google OAuth for tenant owners
- Share links for customers (no registration needed)

### Role Definitions

| Role | Who | Scope | Permissions |
|------|-----|-------|-------------|
| **Platform Admin** | You | Global | Manage tenants, billing, impersonate for support |
| **Tenant Owner** | Quilter (Pam, Veronica, etc.) | Their schema | Full CRUD on patterns, keywords, settings |
| **Guest** | Customer choosing patterns | Specific share link | View shared patterns, vote/favorite, time-limited |

### Database Schema (Simplified)

```sql
-- Global tables (public schema)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,      -- for URL: patterns.com/pam
  owner_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'starter',    -- starter, professional, business
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  is_platform_admin BOOLEAN DEFAULT FALSE,  -- only you
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Share links (global, references tenant patterns)
CREATE TABLE share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,     -- random URL token
  name TEXT,                      -- "Jane's quilt choices"
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE share_link_patterns (
  share_link_id UUID REFERENCES share_links(id) ON DELETE CASCADE,
  pattern_id INTEGER NOT NULL,    -- references tenant schema pattern
  PRIMARY KEY (share_link_id, pattern_id)
);

CREATE TABLE share_link_votes (
  id SERIAL PRIMARY KEY,
  share_link_id UUID REFERENCES share_links(id) ON DELETE CASCADE,
  pattern_id INTEGER NOT NULL,
  voter_name TEXT,                -- "Jane" (no account needed)
  vote_type TEXT DEFAULT 'like', -- like, favorite, maybe
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-tenant schema (no user tables needed)
-- tenant_pam.patterns
-- tenant_pam.keywords
-- tenant_pam.pattern_keywords
-- tenant_pam.orientation_analysis
-- etc.
```

### Tenant Context (Simplified)

```typescript
interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  ownerId: string;          // Auth user ID of tenant owner
  isPlatformAdmin: boolean; // Only true for you
}

// Middleware - much simpler than multi-user orgs
async function getTenantContext(request: Request): Promise<TenantContext | null> {
  const user = await getUser();
  if (!user) return null;

  // Each user owns exactly one tenant (or is platform admin)
  const tenant = await getTenantByOwnerId(user.id);
  const profile = await getProfile(user.id);

  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    ownerId: user.id,
    isPlatformAdmin: profile.is_platform_admin,
  };
}
```

### Share Link Flow (Replaces "Users")

Instead of customers creating accounts, the sharing workflow is:

1. **Owner creates share link**: Selects 5-10 patterns, sets expiration
2. **Owner sends link to customer**: `patterns.com/share/abc123`
3. **Customer views patterns**: No login required, sees thumbnails + details
4. **Customer votes/favorites**: Enters their name, picks favorites
5. **Owner sees results**: "Jane liked patterns #3, #7, #9"

```typescript
// Share link page (no auth required)
async function SharePage({ token }: { token: string }) {
  const shareLink = await getShareLinkByToken(token);

  if (!shareLink || shareLink.expires_at < new Date()) {
    return <ExpiredLink />;
  }

  const patterns = await getSharedPatterns(shareLink.id);
  const votes = await getVotes(shareLink.id);

  return <ShareView patterns={patterns} votes={votes} />;
}

// Vote endpoint (no auth required)
async function POST /api/share/[token]/vote {
  const { pattern_id, voter_name, vote_type } = body;
  await recordVote(token, pattern_id, voter_name, vote_type);
}
```

### What This Enables

1. **Zero friction for customers** - No account creation, just click and vote
2. **Owner keeps control** - They see who voted for what
3. **Time-limited access** - Links expire (30 days default)
4. **Simple data model** - No user management, just patterns + votes
5. **Privacy** - Customers don't see other customers' votes

### Platform Admin Features

As the only platform admin, you need:

```typescript
// Admin-only routes
/admin/tenants           // List all tenants, usage stats
/admin/tenants/[id]      // View/edit tenant, impersonate
/admin/billing           // Stripe dashboard link, revenue
/admin/support           // Support tickets if you add that

// Impersonation for support
async function impersonateTenant(tenantId: string) {
  // Sets session to act as that tenant for debugging
  // All actions logged in admin_activity_log
}
```

---

## Storage Architecture

### Current Structure
```
thumbnails/
  {pattern_id}.png

patterns/
  {pattern_id}.{ext}
```

### Multi-Tenant Structure

**Option A: Prefixed paths (simpler)**
```
thumbnails/
  {tenant_id}/{pattern_id}.png

patterns/
  {tenant_id}/{pattern_id}.{ext}
```

**Option B: Separate buckets per tenant (more isolation)**
```
thumbnails-{tenant_id}/
  {pattern_id}.png

patterns-{tenant_id}/
  {pattern_id}.{ext}
```

### Storage Policies

```sql
-- RLS for storage (Supabase storage policies)
CREATE POLICY "Tenant members can read thumbnails"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'thumbnails' AND
    (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM tenant_members
      WHERE user_id = auth.uid()
    )
  );
```

### Storage Quotas

```typescript
interface TenantLimits {
  maxPatterns: number | null;      // null = unlimited
  maxStorageBytes: number | null;
  maxUsersCount: number | null;
}

// Check before upload
async function canUpload(tenantId: string, fileSize: number): Promise<boolean> {
  const tenant = await getTenant(tenantId);
  const usage = await getStorageUsage(tenantId);

  if (tenant.maxStorageBytes && usage + fileSize > tenant.maxStorageBytes) {
    throw new QuotaExceededError('Storage limit reached');
  }
  return true;
}
```

---

## API Changes

### Tenant-Scoped Endpoints

All existing endpoints become tenant-scoped:

```
Current:                    Multi-tenant:
GET /api/patterns      →    GET /api/patterns (tenant from context)
GET /api/keywords      →    GET /api/keywords
POST /api/search       →    POST /api/search
GET /api/admin/users   →    GET /api/admin/users
```

### New Endpoints

```
# Tenant Management
POST   /api/tenants                    # Create new tenant
GET    /api/tenants/:id                # Get tenant details
PATCH  /api/tenants/:id                # Update tenant
DELETE /api/tenants/:id                # Delete tenant (owner only)

# Membership
GET    /api/tenants/:id/members        # List members
POST   /api/tenants/:id/members        # Invite member
DELETE /api/tenants/:id/members/:uid   # Remove member
PATCH  /api/tenants/:id/members/:uid   # Change role

# Invitations
POST   /api/invitations/:token/accept  # Accept invitation

# Billing (if self-serve)
GET    /api/billing                    # Get subscription status
POST   /api/billing/portal             # Stripe customer portal link
POST   /api/billing/checkout           # Create checkout session

# Super Admin (platform level)
GET    /api/superadmin/tenants         # List all tenants
GET    /api/superadmin/metrics         # Platform metrics
POST   /api/superadmin/tenants/:id/suspend
```

### API Authentication

```typescript
// Current: Just check if user is authenticated + approved
// New: Check tenant membership + role

export async function withTenantAuth(
  handler: (req: Request, ctx: TenantContext) => Promise<Response>,
  requiredPermission?: string
) {
  return async (req: Request) => {
    const ctx = await getTenantContext(req);

    if (!ctx) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (requiredPermission && !ctx.permissions.includes(requiredPermission)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    return handler(req, ctx);
  };
}
```

---

## UI/UX Changes

### Tenant Switching

Users who belong to multiple tenants need a way to switch:

```tsx
// Header component addition
<TenantSwitcher
  currentTenant={tenant}
  availableTenants={userTenants}
  onSwitch={(tenantId) => router.push(`/t/${tenantId}`)}
/>
```

### Onboarding Flow

New user signup creates a tenant:

```
1. Sign up with Google/Email
2. "Create your workspace"
   - Workspace name: "Acme Quilting Guild"
   - URL: acme.patterns.com (or patterns.com/t/acme)
3. "Invite your team" (optional, can skip)
4. "Import patterns" or "Start fresh"
5. Land on dashboard
```

### Settings Pages

```
/settings
  /settings/workspace     # Tenant name, logo, URL
  /settings/members       # Invite, remove, change roles
  /settings/billing       # Plan, usage, invoices
  /settings/integrations  # API keys, webhooks (future)
  /settings/danger        # Delete workspace
```

### Admin vs Tenant Admin

Need to distinguish:
- **Platform Admin**: You, managing the whole platform
- **Tenant Admin**: Customer managing their workspace

```tsx
// Platform admin sees all tenants
/superadmin/tenants
/superadmin/metrics
/superadmin/support

// Tenant admin sees their workspace
/admin/patterns
/admin/users
/admin/analytics
```

---

## Pricing & Plans

### Suggested Tier Structure

| Feature | Free | Pro ($29/mo) | Team ($99/mo) | Enterprise |
|---------|------|--------------|---------------|------------|
| Patterns | 500 | 5,000 | 25,000 | Unlimited |
| Users | 1 | 3 | 15 | Unlimited |
| Storage | 1 GB | 10 GB | 50 GB | Custom |
| AI Search | 100/mo | 1,000/mo | 10,000/mo | Unlimited |
| Sharing | Basic | Advanced | White-label | Custom |
| Support | Community | Email | Priority | Dedicated |
| API Access | No | Yes | Yes | Yes |
| SSO | No | No | No | Yes |

### Usage-Based Pricing (Alternative)

```
Base: $19/mo
+ $0.01 per pattern over 1,000
+ $0.001 per AI search
+ $2 per additional user
+ $1 per GB storage over 5 GB
```

### Implementation

```typescript
// Check plan limits
async function checkPlanLimits(tenantId: string, action: string): Promise<void> {
  const tenant = await getTenant(tenantId);
  const usage = await getUsage(tenantId);
  const limits = PLAN_LIMITS[tenant.plan];

  switch (action) {
    case 'upload_pattern':
      if (limits.maxPatterns && usage.patterns >= limits.maxPatterns) {
        throw new PlanLimitError('Pattern limit reached. Upgrade to add more.');
      }
      break;
    case 'ai_search':
      if (limits.maxAiSearches && usage.aiSearches >= limits.maxAiSearches) {
        throw new PlanLimitError('AI search limit reached for this month.');
      }
      break;
    // ...
  }
}
```

---

## Migration Strategy

### Phase 1: Foundation (Non-Breaking)

1. Create `tenants` and `tenant_members` tables
2. Create a default tenant for existing data
3. Add `tenant_id` columns (nullable initially)
4. Backfill `tenant_id` on all existing records
5. Update RLS policies to check tenant membership
6. Add tenant context to middleware

**Existing users see no change** - they're auto-added to the default tenant.

### Phase 2: Multi-Tenant Features

1. Add tenant creation flow for new signups
2. Implement tenant switching UI
3. Add member invitation system
4. Update all queries to filter by tenant
5. Implement storage isolation

### Phase 3: Billing & Plans

1. Integrate Stripe
2. Implement plan limits
3. Add usage tracking
4. Build billing UI
5. Add upgrade prompts

### Phase 4: Scale & Polish

1. Add subdomain routing
2. Implement white-label options
3. Add API key authentication
4. Build platform admin dashboard
5. Add enterprise features (SSO, audit logs)

---

## Technical Concerns

### Performance

**Vector Search**: Each tenant's patterns need separate HNSW indexes or careful query planning.

```sql
-- Option 1: Partial indexes per tenant (maintenance heavy)
CREATE INDEX idx_patterns_embedding_tenant_123
  ON patterns USING hnsw (embedding vector_cosine_ops)
  WHERE tenant_id = '123';

-- Option 2: Filter after index scan (simpler, slightly slower)
SELECT * FROM search_patterns_semantic(embedding, 0.2, 100)
WHERE tenant_id = $1;
```

**Query Performance**: All queries now have `WHERE tenant_id = ?`. Ensure indexes.

```sql
-- Compound indexes for common queries
CREATE INDEX idx_patterns_tenant_created ON patterns(tenant_id, created_at DESC);
CREATE INDEX idx_keywords_tenant_value ON keywords(tenant_id, value);
```

### Data Isolation Risks

**RLS is critical**. One mistake exposes data across tenants.

```sql
-- Defense in depth: function to get current tenant
CREATE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT tenant_id FROM tenant_members
  WHERE user_id = auth.uid()
  LIMIT 1;  -- Or use session variable
$$ LANGUAGE sql SECURITY DEFINER;

-- All policies use this function
CREATE POLICY "tenant_isolation" ON patterns
  FOR ALL USING (tenant_id = current_tenant_id());
```

**Testing**: Need comprehensive tests for isolation.

```typescript
describe('Tenant Isolation', () => {
  it('user cannot see patterns from other tenant', async () => {
    const tenantA = await createTenant();
    const tenantB = await createTenant();
    const userA = await createUserInTenant(tenantA);
    const patternB = await createPatternInTenant(tenantB);

    const patterns = await getPatterns(userA.token);
    expect(patterns).not.toContainEqual(expect.objectContaining({ id: patternB.id }));
  });
});
```

### Backup & Restore

Need per-tenant backup capability:

```bash
# Export tenant data
pg_dump --table='patterns' --where="tenant_id='xxx'" > tenant_xxx_backup.sql

# Or use application-level export
GET /api/tenants/:id/export → ZIP of all data
```

---

## Third-Party Integrations

### Authentication Providers

Current: Google OAuth only

Multi-tenant options:
- Keep Google + add email/password
- Add Microsoft (enterprise)
- SAML/SSO for enterprise (Auth0, Okta integration)

### Payment Processing

**Stripe** is the standard choice:

```typescript
// Create customer on tenant creation
const customer = await stripe.customers.create({
  email: owner.email,
  metadata: { tenantId: tenant.id }
});

// Subscription
const subscription = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: PRICE_IDS[plan] }],
  metadata: { tenantId: tenant.id }
});

// Webhook handler
POST /api/webhooks/stripe
  → customer.subscription.updated
  → customer.subscription.deleted
  → invoice.payment_failed
```

### Email

Current: Resend for admin notifications

Multi-tenant needs:
- Welcome emails
- Invitation emails
- Billing notifications
- Usage alerts

### Analytics

Consider adding:
- **PostHog** or **Mixpanel** for product analytics
- **Segment** for event routing
- Per-tenant analytics dashboards

---

## Estimated Effort

| Phase | Effort | Description |
|-------|--------|-------------|
| Phase 1: Foundation | 2-3 weeks | DB schema, tenant context, RLS policies |
| Phase 2: Multi-Tenant | 3-4 weeks | Onboarding, switching, invitations, storage |
| Phase 3: Billing | 2-3 weeks | Stripe integration, plans, limits |
| Phase 4: Polish | 2-4 weeks | Subdomains, white-label, enterprise |

**Total: 9-14 weeks** for full multi-tenant SaaS

### Quick Start Alternative

To validate demand faster, could do a simpler version:

1. Manual tenant provisioning (you create accounts)
2. Single plan (flat monthly fee)
3. No self-serve billing
4. Basic isolation

**Effort: 3-4 weeks**

---

## Open Questions

1. **Subdomain vs Path routing?**
   - Subdomains (`acme.patterns.com`) feel more professional
   - Path (`patterns.com/t/acme`) is simpler to implement
   - Could support both

2. **Should patterns be shareable across tenants?**
   - Marketplace for selling/sharing patterns?
   - Global "community" patterns?
   - Import from other tenants?

3. **What about the existing 15,651 patterns?**
   - Keep as a "starter library" tenants can import?
   - Your mom's tenant keeps them exclusively?
   - Offer as a paid add-on?

4. **Self-serve or sales-led?**
   - Self-serve: Users sign up, pay, go
   - Sales-led: Contact us, demo, custom pricing
   - Hybrid: Self-serve for small, sales for enterprise

5. **Mobile apps?**
   - React Native using same API?
   - PWA first?

6. **Offline support?**
   - Quilters might want patterns offline
   - Service worker + IndexedDB?
   - Desktop app (Electron/Tauri)?

---

## Market Opportunity

### Competitive Landscape

Based on user feedback, the current quilting pattern management software market:
- **Charges ~$400/year** for existing solutions
- **Offers inferior UX** compared to this modern web-based approach
- **Is underserved** - quilters are hungry for better tooling

**Competitor 1 - Statler (per industry insider):**
- Windows 95-era interface
- Constant compatibility issues with modern Windows
- **Currently broken due to TPM issues** (Windows 11 security)
- **No thumbnail previews** - text descriptions only
- Users have to guess what patterns look like from names/keywords
- Still charging ~$400/year for this experience

**Translation:** Paying customers are RIGHT NOW unable to use the software they paid for, with no modern alternative. This is the window.

**Competitor 2 - Gammill Pattern Manager / PatternCloud:**
- Built into CreativeStudio 7 (their quilting machine software)
- Cloud-based storage (PatternCloud.com)
- Search by keyword, price, type, date
- **Locked to Gammill machines** - only works with their hardware ecosystem
- DRM/encryption tiers restrict which machines can use patterns
- Free, but requires Gammill machine purchase ($15K-$50K+)

**Key insight:** Gammill's solution is tied to their hardware. If you have a different brand machine (Handi Quilter, APQS, etc.), you can't use it. Your app is **machine-agnostic** - works with any quilting setup.

**Related: Pattern Marketplaces (not competitors, but context)**

**Intelligent Quilting (intelligentquilting.com):**
- Pattern *store*, not management software
- 14,000+ digitized designs for sale ($7-$25 each)
- Supports 14 file formats (GPF, BQM, QCC, MQR, etc.)
- Works with Statler, IntelliQuilter, Quilt Path, Handi Quilter Pro Stitcher
- 70+ designers selling through the platform

**Insight:** Quilters are buying patterns from multiple sources, then need somewhere to organize them. Your app solves the "I bought patterns from 10 places, now what?" problem.

**Your position in the ecosystem:** Pattern stores sell ZIPs with 14 file formats. Quilters upload those ZIPs to your app. You're the "last mile" that makes purchased patterns actually usable - searchable, previewable, organized. You don't compete with pattern stores; you make their products more valuable.

**Future opportunity: "Send to Pattern Manager" API**

Pain point (per mom): Downloading ZIPs and uploading them is a huge friction point for non-technical quilters.

Solution: Give pattern stores an API. After purchase:
1. Customer clicks "Send to Pattern Manager"
2. Pattern appears in their library instantly
3. No downloads, no ZIPs, no file management

This is the **"Sign in with Google" moment for quilting patterns.** Every store wants to reduce friction for their customers. You become the infrastructure layer.

**Implementation:**
```
POST /api/v1/patterns/import
Authorization: Bearer {store_api_key}
{
  "user_email": "quilter@example.com",
  "pattern_name": "Butterfly Swirls",
  "file_url": "https://store.com/patterns/123.qli",
  "thumbnail_url": "https://store.com/thumbs/123.png",
  "source": "Intelligent Quilting",
  "purchase_date": "2026-01-20",
  "keywords": ["butterfly", "swirls", "border"]
}
```

**Business model addition:** Charge stores a small per-pattern fee ($0.05-0.10) for API access. They save on support costs from confused customers; you get revenue + user acquisition.

---

### Pain Point #2: Backups (validated by Veronica, Jan 2026)

**The problem:** Quilters store patterns on thumb drives and local computers. When drives fail or get lost, they have to **re-purchase patterns they already bought.**

Veronica has re-purchased lost patterns **twice already in 2026** (and it's January 20th).

At $7-25 per pattern, losing a collection of 500+ patterns could mean **$3,500-$12,500 in re-purchase costs.**

**Your solution:** Cloud storage with automatic backup. Patterns are never "on a thumb drive" - they're in the cloud, accessible from any device, forever.

**Marketing angle:** "Never lose a pattern again. Never pay twice for the same design."

**ROI pitch:** If your subscription is $200/year and it prevents even ONE re-purchase incident, it pays for itself. Veronica would have saved money if she'd been using your app since January 1st.

This is insurance quilters don't know they need until they lose everything.

---

### Pain Point #3: File Format Conversion (pending details from Veronica)

**The problem:** Different machines need different file formats. Quilters currently:
1. Download pattern from store
2. Open a separate Windows app ("Karen's Technical Quilting" - last updated 2001)
3. Convert to Gammill-compatible format
4. Transfer to machine

**The opportunity:** Build conversion into your app. "Download for Gammill" / "Download for Handi Quilter" / etc.

**Research findings:**
- **.QLI format** is Gammill/Statler's proprietary format
- **KimQuilt** has open-source (GPL v3) Python code that can convert QLI ↔ SVG
- Multiple formats exist: QLI, CQP, DXF, HQF, IQP, PAT, PLT, QCC, SSD, BQM, TXT
- Pro-Stitcher Designer can read/write most formats (but it's paid software)

**Implementation path:**
1. Research the conversion algorithms (some are open source)
2. Add "Export for [Machine Brand]" to download flow
3. One-click download in the right format for their machine

**Value prop:** "One library. Every format. Any machine."

*Waiting for more details from Veronica on the specific conversion workflow.*

---

### Pain Point #4: Quilt Business Management (validated by Mom & Veronica)

**The problem:** Professional quilters run a business but track everything in separate Windows apps:
- Finished quilt photos → one app
- Customer names → another app (or spreadsheet)
- Pricing/revenue → another app
- Material costs → another app
- **All require manual backups** → frequent data loss complaints in Facebook groups

**Typical collection size:** 1,000 - 5,000 patterns per quilter

**The opportunity:** Expand from "pattern manager" to "quilting business manager"

**Quilt Portfolio Feature:**
```
Quilt Record:
- Photo(s) of finished quilt
- Customer name & contact
- Date completed
- Patterns used (link to pattern library!)
- Materials cost
- Price charged
- Profit margin (auto-calculated)
- Notes
```

**Value adds:**
1. **Link patterns to finished work** - "Show me all quilts I made with this pattern"
2. **Customer history** - "Show me all quilts for customer Jane Smith"
3. **Business analytics** - Revenue, costs, margins over time
4. **Portfolio** - Shareable gallery of finished work for marketing
5. **Tax time** - Export income/expenses for accountant

**This changes the positioning:**

| Before | After |
|--------|-------|
| Pattern Manager | Quilting Business Hub |
| $200/year | $300-400/year (more value) |
| Competes with: pattern tools | Competes with: nothing (blue ocean) |

**Implementation phases:**
1. **Phase 1:** Pattern management (you have this)
2. **Phase 2:** Multi-tenant (in progress)
3. **Phase 3:** Quilt portfolio & customer tracking
4. **Phase 4:** Business analytics & reporting

**The stress angle:** "Backup anxiety" applies to business records too. Quilters are one hard drive failure away from losing their entire customer history, portfolio, and financial records. Cloud-based = peace of mind.

This is remarkable. You have:
- Instant visual thumbnails (15,350 of them)
- AI search that understands "butterflies with swirls"
- Works on any device (web-based)
- Modern, clean UI
- Pattern sharing built-in

**You're not 10% better - you're a generational leap.**

### Revenue Potential

**Direct quote from Mom & Veronica:** *"Michael, if you could make all of this in one app, people would pay you $1,000 a year."*

**Customer profile:**
- Already invested $25K-$40K in a longarm machine
- Predominantly boomers with deep pockets
- Running real businesses (not hobbyists)
- Value their time over money
- Desperate for solutions that "just work"

**Revised revenue projections:**

| Scenario | Users | Price/yr | ARR |
|----------|-------|----------|-----|
| Conservative | 1,000 | $500 | $500K |
| Moderate | 3,000 | $600 | $1.8M |
| Optimistic | 5,000 | $800 | $4.0M |
| Premium all-in-one | 5,000 | $1,000 | $5.0M |

**Pricing insight:** You were thinking $200/year competing on price. But these customers:
- Already pay $400/year for broken software
- Have $40K machines
- Said they'd pay $1,000/year for the right solution

**Don't leave money on the table.** A quilter who spent $40K on a machine won't blink at $500-800/year for software that actually works.

**Recommended pricing (revised):**

| Tier | Price | Features |
|------|-------|----------|
| **Starter** | $299/year | 2,000 patterns, basic search, cloud backup |
| **Professional** | $599/year | Unlimited patterns, AI search, customer sharing, quilt portfolio |
| **Business** | $999/year | Everything + customer management, business analytics, tax exports, priority support |

Even at **half** the competitor's price ($200/year), you'd be significantly undercutting while offering:
- Modern web UI (no Windows-only software)
- AI-powered natural language search
- Pattern sharing with customers
- Mobile-friendly (quilters at shops, shows)
- Cloud-based (no machine dependency)
- Real-time collaboration potential

### Pricing Strategy Options

**Option A: Undercut and Scale**
- $199/year (half the competition)
- Focus on volume
- "Switch from [competitor] and save 50%"

**Option B: Value-Based Premium**
- $349/year (slightly under competition)
- Emphasize AI search, modern UX, mobile
- Position as "the modern choice"

**Option C: Tiered with Free Trial**
- Free: 100 patterns, basic features
- Pro: $249/year - 5,000 patterns, AI search
- Business: $449/year - unlimited, team features, API
- 14-day free trial of Pro

**Option D: Usage-Based**
- $99/year base + $0.02 per pattern stored
- Scales naturally with collection size
- Low barrier to entry

### Go-to-Market Considerations

**Quilting Community Characteristics:**
- Strong word-of-mouth networks (guilds, shows, shops)
- Facebook groups are major hubs
- YouTube quilting channels have huge followings
- Quilting magazines and blogs
- Annual quilt shows (Houston, Paducah) are major events

**Distribution Channels:**
1. **Quilting guilds** - One enthusiastic member can bring dozens
2. **Longarm dealers** - They sell machines + recommend software
3. **Pattern designers** - They need to share with customers
4. **Quilt shops** - Could be resellers or referrers
5. **Online communities** - Facebook groups, Reddit r/quilting

**First Mover Advantages:**
- Lock in the early adopter quilters
- They become evangelists
- Build the largest pattern library through imports
- Network effects if you add community features

### Detailed Feature Comparison

**Note:** Statler and Gammill are the same company. CreativeStudio is the Statler software.

| Feature | Patterns (You) | Gammill/Statler (CreativeStudio + PatternCloud) |
|---------|----------------|------------------------------------------------|
| **Platform** | Web browser (any device) | Windows only (TPM issues on Win 11) |
| **Mobile** | Yes (responsive web) | No |
| **Machine Lock-in** | None - works with any quilting setup | Gammill/Statler machines only ($43K-$58K) |
| **Thumbnails** | **15K+ instant visual previews** | Has thumbnails in their ecosystem |
| **Search** | **AI natural language** ("butterflies with swirls") | Keyword, designer, type, tags, price |
| **Pattern Library** | 15,651 patterns included | 11,000+ in store (must purchase individually) |
| **Cloud Backup** | Automatic | Yes (PatternCloud - free) |
| **Sharing** | Built-in customer links, 30-day expiry | No sharing features |
| **Multi-device Sync** | Yes (web-based) | Yes (across registered machines) |
| **Offline** | Not yet | Yes (local software) |
| **Pattern Formats** | .qli, .csq, .dxf, .pat | .qli, .pat (encrypted) |
| **DRM/Encryption** | None | 3 tiers (Any/Machine/User locked) |
| **Price** | TBD (~$200/yr target) | Free with $43K-$58K machine purchase |
| **UI Era** | 2025 modern web | Windows desktop (dated) |

### Key Insights from Research

1. **Gammill owns Statler** - same company, same ecosystem
2. **PatternCloud has 11K+ patterns** but you must purchase each one from designers
3. **Your 15,651 patterns are included** - huge value vs buying individually
4. **Their DRM is restrictive** - patterns can be locked to specific machines
5. **No sharing features** - "Your patterns are yours and yours alone" (privacy, but no collaboration)
6. **Hardware lock-in is real** - must own Gammill/Statler machine ($43K-$58K)

### Your Competitive Advantages

1. **Machine-agnostic**: Works with Handi Quilter, APQS, Bernina, any brand
2. **AI search**: Natural language beats keyword filtering
3. **Included library**: 15K patterns vs buying individually
4. **Sharing built-in**: Customer links for professional quilters
5. **No DRM**: Patterns aren't locked to hardware
6. **Modern UX**: 2025 web app vs dated Windows software
7. **Lower cost**: ~$200/year vs tied to $50K machine purchase

---

## Conclusion

Converting to multi-tenant is significant but achievable work. The current codebase has good foundations:

**Strengths for scaling:**
- Clean separation of concerns
- Comprehensive RLS policies already
- Good error handling infrastructure
- Activity logging for audit trails
- API route structure that maps to tenant-scoping

**Areas needing work:**
- All queries need tenant filtering
- Storage needs restructuring
- Auth needs role-per-tenant model
- Need onboarding and billing flows
- UI needs tenant context throughout

**Recommended approach:**

Given the strong market signal ($400/year competitors, 10K+ potential users, "almost fell out of her seat" reaction), I'd accelerate:

1. **Week 1-2**: Get 5-10 more quilters to try it, collect specific feedback
2. **Week 3-6**: Phase 1 (foundation) - tenant tables, RLS, basic isolation
3. **Week 7-10**: Phase 2 (basic multi-tenant) - onboarding, invitations
4. **Week 11-12**: Soft launch to beta users (manual provisioning)
5. **Week 13-16**: Stripe integration, self-serve signup
6. **Month 5+**: Scale based on what you learn

**Critical early decisions:**
- Domain name (quilters.app? patternvault.com? something memorable)
- Pricing tier structure (test with beta users)
- What happens to the existing 15K patterns (starter library? exclusive?)

**The "almost fell out of her seat" reaction is your validation.** This is someone in the industry who knows the pain points. Trust that signal.

---

## Beta Program (Confirmed Jan 2026)

**Founding testers:** Mom & Veronica can recruit 7-10 trusted industry contacts

**Beta cohort profile:**
- Professional longarm quilters
- Trusted within the community (credibility for later testimonials)
- Likely to provide honest, detailed feedback
- Potential evangelists once product launches

**Beta program structure:**

| Phase | Duration | Goal |
|-------|----------|------|
| **Alpha** (now) | 2-4 weeks | Mom + Veronica stress-test current features |
| **Private Beta** | 6-8 weeks | 7-10 testers, multi-tenant foundation, collect feedback |
| **Expanded Beta** | 4-6 weeks | Fix issues, add quilt portfolio, invite 20-30 more |
| **Launch** | TBD | Public availability, Stripe billing live |

**What to ask beta testers:**
1. What machine brand do you use?
2. How many patterns do you have?
3. Where do you buy patterns from?
4. What's your current workflow for organizing patterns?
5. What's your biggest daily frustration?
6. What would make you switch from your current tools?
7. What would you pay for the "all-in-one" solution?
8. Can we use your testimonial when we launch?

**Beta benefits to offer:**
- Free access during beta
- Founding member pricing ($399/year locked in for life vs $599 regular?)
- Input on feature priorities
- "Founding Member" badge in app
- First access to new features

**Critical:** Get permission to use their testimonials and feedback for marketing. A quote like *"I've been quilting for 20 years and this is the first software that actually understands what I need"* is worth its weight in gold.

---

## The Villages Opportunity (Holy Grail)

**Location:** The Villages, FL - one of the largest retirement communities in the US (130,000+ residents)

**The quilting group:**
- **700 members**
- Meet **weekly**
- All within a mile of each other
- All have money (The Villages demographic = affluent retirees)
- Mom, Veronica, and beta testers are all members

**This is a dream go-to-market scenario:**

| Factor | Why It Matters |
|--------|----------------|
| Concentrated | 700 potential customers in one zip code |
| Wealthy | Can afford $500-1,000/year without blinking |
| Social | Weekly meetings = word spreads fast |
| Trusted network | Veronica's endorsement carries weight |
| Tech-challenged | Will pay premium for "it just works" |
| Time-rich | Will actually use the product and give feedback |

**Math:**
- 700 quilters × 30% adoption = 210 customers
- 210 × $599/year = **$125,790 ARR from ONE quilting group**

**And The Villages has multiple quilting groups.** Plus scrapbooking, sewing, crafting...

**Go-to-market strategy:**

1. **Nail it for the beta testers** (7-10 people)
2. **Let them demo at weekly meeting** ("Look what Michael built")
3. **Offer "Villages Founding Member" pricing** ($399/year for life)
4. **Word of mouth does the rest**

You don't need Facebook ads. You don't need a marketing budget. You need 7 happy quilters in The Villages telling their 700 friends.

**This is the bowling pin strategy.** Dominate one tight community, then expand to other quilting guilds nationwide.

**Other large retirement communities with quilting groups:**
- Sun City, AZ
- Laguna Woods, CA
- On Top of the World, FL
- Del Webb communities nationwide

If you can crack The Villages, you can crack them all.

---

## Infrastructure & Costs (Budget: $10-18K)

### Current Setup
- **Hosting:** Single VPS at patterns.tachyonfuture.com
- **Database:** Self-hosted Supabase at base.tachyonfuture.com
- **Storage:** Supabase Storage (thumbnails + pattern files)
- **Cost:** Minimal (existing infrastructure)

### Scaling Phases

#### Phase 1: Beta (10-50 users) - **~$100-200/month**

Current infrastructure is probably fine. Main costs:

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| VPS (existing) | $20-50 | May need RAM upgrade |
| Supabase (self-hosted) | $0 | Already running |
| Voyage AI (embeddings) | $5-20 | ~$0.12/1M tokens, minimal for search |
| Domain name | $15/year | Need a real domain |
| **Total** | **~$100-150/mo** | |

**One-time costs:**
- Domain purchase: $15-50
- SSL: Free (Let's Encrypt)

#### Phase 2: Early Growth (50-500 users) - **~$300-600/month**

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| VPS upgrade | $100-200 | 8-16GB RAM, 4 vCPU |
| Database | $50-100 | May need dedicated Postgres or Supabase Pro |
| Storage | $50-100 | ~50GB per 100 users (patterns + thumbnails) |
| Voyage AI | $20-50 | More searches |
| Backups | $20-50 | Automated daily backups |
| Monitoring (Sentry) | $26 | Already have |
| **Total** | **~$300-600/mo** | |

**Storage math:**
- 500 users × 3,000 patterns avg × 50KB per pattern = 75GB pattern files
- 500 users × 3,000 patterns × 10KB thumbnail = 15GB thumbnails
- Total: ~100GB, growing

#### Phase 3: Growth (500-2,000 users) - **~$800-1,500/month**

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| App servers (2x) | $200-400 | Load balanced, redundancy |
| Managed Postgres | $100-300 | Supabase Pro or AWS RDS |
| Object storage | $100-200 | S3 or equivalent, ~500GB |
| CDN | $50-100 | CloudFlare Pro for thumbnails |
| Voyage AI | $50-100 | |
| Redis (caching) | $30-50 | Session/search caching |
| Backups | $50-100 | Multi-region |
| Monitoring | $50-100 | Better observability |
| **Total** | **~$800-1,500/mo** | |

#### Phase 4: Scale (2,000-10,000 users) - **~$2,000-5,000/month**

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| App cluster | $500-1,000 | Kubernetes or managed containers |
| Database cluster | $300-800 | Read replicas, high availability |
| Object storage | $300-500 | 2-5TB |
| CDN | $100-300 | |
| Search infrastructure | $200-500 | Dedicated vector search or scale pgvector |
| Caching layer | $100-200 | |
| Backups & DR | $200-400 | Disaster recovery |
| **Total** | **~$2,000-5,000/mo** | |

### Recommended Providers

**Option A: Stay Simple (Recommended for Beta)**

| Component | Provider | Why |
|-----------|----------|-----|
| App hosting | Hetzner or DigitalOcean | Cheap, reliable, EU/US options |
| Database | Self-hosted Supabase → Supabase Pro | Familiar, scales well |
| Storage | Supabase Storage → S3/R2 | Start simple, migrate later |
| CDN | CloudFlare Free → Pro | Generous free tier |
| Email | Resend | Already using |
| Payments | Stripe | Industry standard |

**Option B: All-in on AWS/Vercel (More expensive, less ops)**

| Component | Provider | Monthly Cost |
|-----------|----------|--------------|
| App | Vercel Pro | $20 + usage |
| Database | Supabase Pro | $25+ |
| Storage | AWS S3 | Pay per GB |
| CDN | CloudFlare | Free-$20 |

**Option C: Budget-Optimized**

| Component | Provider | Monthly Cost |
|-----------|----------|--------------|
| VPS | Hetzner CPX31 | €15 (~$16) |
| Database | Self-hosted Postgres | $0 (on VPS) |
| Storage | Hetzner Storage Box | €4/TB |
| CDN | CloudFlare Free | $0 |
| Backups | Hetzner Snapshots | €3 |
| **Total** | | **~$25/month** |

### Your $10-18K Budget Allocation

**Recommended split:**

| Category | Amount | Purpose |
|----------|--------|---------|
| **Runway (18 months hosting)** | $5,000 | ~$280/mo average for growth phase |
| **Development tools** | $500 | Better monitoring, testing tools |
| **Domain & branding** | $500 | Premium domain, basic logo |
| **Legal** | $1,500 | LLC formation, basic ToS/Privacy |
| **Marketing** | $1,000 | Maybe business cards for quilt shows? |
| **Emergency fund** | $2,000 | Unexpected costs |
| **Reserve for Phase 3** | $5,000-8,000 | When you hit 500+ users |
| **Total** | **$15,500-18,500** | |

### Cost vs Revenue Crossover

| Users | Monthly Revenue | Monthly Cost | Profit |
|-------|-----------------|--------------|--------|
| 10 | $500 | $150 | $350 |
| 50 | $2,500 | $200 | $2,300 |
| 100 | $5,000 | $400 | $4,600 |
| 500 | $25,000 | $1,000 | $24,000 |
| 1,000 | $50,000 | $2,000 | $48,000 |

*(Assuming $50/month average = $600/year)*

**Break-even: ~3-5 paying customers** covers basic hosting.

**Your budget lasts:**
- At 0 customers: 18+ months of runway
- At 50 customers: Profitable, budget becomes reserve
- At 200 customers: $10K+/month profit

### Key Infrastructure Decisions

1. **Stay on self-hosted Supabase or migrate to Supabase Pro?**
   - Self-hosted: Cheaper, more control, more ops work
   - Pro: $25/mo, managed, less hassle
   - Recommendation: Stay self-hosted until 100+ users

2. **Single region or multi-region?**
   - Start single region (US, since customers are US-based)
   - Add regions only if latency becomes an issue (unlikely for this use case)

3. **When to add redundancy?**
   - At 200+ paying customers, add a second app server
   - At 500+ customers, add database read replica

4. **Storage strategy:**
   - Patterns are small (50KB avg), thumbnails are small (10-50KB)
   - 5,000 users × 3,000 patterns = 750GB total (very manageable)
   - S3/R2 at $0.015/GB = ~$12/month for 750GB

### What You DON'T Need (Yet)

- ❌ Kubernetes
- ❌ Multiple regions
- ❌ Dedicated database servers
- ❌ Complex CI/CD pipelines
- ❌ Enterprise monitoring
- ❌ Load balancers (until 500+ concurrent users)

**Keep it simple.** Your VPS + Supabase setup can handle hundreds of users. Don't over-engineer until you have the problem.

### Action Items

1. **Now:** Upgrade VPS RAM if needed (maybe $20/mo more)
2. **Now:** Buy a proper domain name
3. **At 50 users:** Add automated backups, basic monitoring
4. **At 200 users:** Consider Supabase Pro, add second server
5. **At 500 users:** Re-evaluate architecture, maybe hire DevOps help

**Bottom line:** Your $10-18K budget is more than enough. At $150-300/month burn rate, you have 3-5 years of runway before a single paying customer. And you'll be profitable after ~5 customers.

---

## Database Architecture Decision: Schema-per-Tenant

### Three Multi-Tenant Approaches

| Approach | Isolation | Complexity | Cost | Best For |
|----------|-----------|------------|------|----------|
| **Shared tables + tenant_id** | Low | Low | $ | SaaS with many small tenants |
| **Schema-per-tenant** | Medium | Medium | $$ | Your use case - professional users with data sensitivity |
| **Database-per-tenant** | High | High | $$$ | Enterprise, compliance, huge tenants |

### Why Schema-per-Tenant Makes Sense Here

1. **Data isolation** - Quilters' patterns are their business. Accidental data leakage would be catastrophic.
2. **Backup/restore** - Can backup/restore individual tenants without affecting others
3. **Performance** - No "WHERE tenant_id = ?" on every query; indexes are tenant-specific
4. **Migration flexibility** - Can move a heavy tenant to dedicated DB later
5. **Simpler RLS** - Policies are per-schema, not complex tenant_id checks
6. **Psychology** - "Your data is in your own private space" is a selling point for this demographic

### Schema-per-Tenant Implementation

```sql
-- Create tenant schema
CREATE SCHEMA tenant_pam;
CREATE SCHEMA tenant_veronica;

-- Each schema has identical tables
CREATE TABLE tenant_pam.patterns (...);
CREATE TABLE tenant_pam.keywords (...);
CREATE TABLE tenant_pam.pattern_keywords (...);
-- etc.

-- Shared/global tables stay in public schema
CREATE TABLE public.tenants (...);
CREATE TABLE public.profiles (...);
CREATE TABLE public.tenant_members (...);
```

**Connection routing:**
```typescript
// Middleware sets search_path based on authenticated user's tenant
const tenantSchema = await getTenantSchemaForUser(userId);
await supabase.rpc('set_config', {
  parameter: 'search_path',
  value: `tenant_${tenantSchema}, public`
});
```

### Supabase vs Standalone Postgres

| Factor | Self-Hosted Supabase | Standalone Postgres | Supabase Pro/Enterprise |
|--------|---------------------|---------------------|------------------------|
| **Schema-per-tenant** | ✅ Works | ✅ Works | ⚠️ May hit limits |
| **Auth integration** | ✅ Built-in | ❌ DIY (or use Auth0/Clerk) | ✅ Built-in |
| **Storage integration** | ✅ Built-in | ❌ DIY (S3) | ✅ Built-in |
| **RLS support** | ✅ Full | ✅ Full | ✅ Full |
| **Realtime** | ✅ Built-in | ❌ DIY | ✅ Built-in |
| **Ops burden** | Medium | High | Low |
| **Cost (500 users)** | ~$50-100/mo | ~$50-100/mo | ~$300-500/mo |
| **Clustering** | Manual setup | Manual or managed | Managed |
| **Backups** | Manual | Manual | Automatic |

### Recommendation: Phased Approach

**Phase 1 (Beta, 0-100 users): Self-Hosted Supabase**
- You already have it running
- Schema-per-tenant works fine
- Keep auth, storage, realtime benefits
- Cost: ~$50/month for beefy VPS

**Phase 2 (Growth, 100-500 users): Dedicated Postgres + Keep Supabase for Auth/Storage**
- Separate database server (Hetzner/DO dedicated)
- Supabase still handles auth and storage
- Point Supabase client at external DB
- Cost: ~$100-200/month

**Phase 3 (Scale, 500+ users): Managed Postgres Cluster**
- Options: AWS RDS, Google Cloud SQL, Crunchy Bridge, Neon, Supabase Enterprise
- Primary + read replicas
- Automated failover
- Cost: ~$300-800/month

### Database Server Sizing

| Users | Patterns (est.) | DB Size | Recommended Server |
|-------|-----------------|---------|-------------------|
| 50 | 150K | ~5GB | 4GB RAM, 2 vCPU |
| 200 | 600K | ~20GB | 8GB RAM, 4 vCPU |
| 500 | 1.5M | ~50GB | 16GB RAM, 4 vCPU |
| 1,000 | 3M | ~100GB | 32GB RAM, 8 vCPU |
| 5,000 | 15M | ~500GB | 64GB RAM, 16 vCPU + replicas |

**Vector embeddings are the big factor:**
- 1024-dim float32 = 4KB per pattern
- 1M patterns × 4KB = 4GB just for embeddings
- Need good RAM for vector search performance

### Specific Provider Options

**Option A: Hostinger KVM4 (Current provider - Recommended)**
```
KVM4: ~$10/mo (24-month term)
- 4 vCPU (Intel Xeon / AMD EPYC)
- 16GB RAM
- 200GB NVMe SSD
- 16TB bandwidth
- Locations: US, Germany, France, UK, Lithuania, Brazil, India
- Weekly automatic backups included
- Good for 200-500 users
```

**Why this works for your use case:**
- 16GB RAM handles pgvector well (embeddings fit in memory)
- NVMe gives fast query response
- 200GB storage covers ~500 users easily
- You're already on Hostinger (familiar tooling)
- $10/mo is trivial cost

**Option B: Hostinger KVM8 (Scale-up path)**
```
KVM8: ~$15-20/mo
- 8 vCPU
- 32GB RAM
- 400GB NVMe SSD
- Good for 500-1000 users
```

**Option C: Hetzner Dedicated (If you outgrow Hostinger)**
```
AX41-NVMe: €49/mo
- AMD Ryzen 5 3600
- 64GB RAM
- 2x 512GB NVMe SSD (RAID1)
- Good for 1000+ users
```

**Option D: Managed Postgres (If you want less ops)**
```
DigitalOcean: $60-240/mo
Crunchy Bridge: $100-300/mo
Supabase Pro: $25+/mo
+ Automatic backups, failover, monitoring
- More expensive than DIY
```

### Recommendation for Your Budget

**Start (now):**
- Stay on self-hosted Supabase
- Upgrade VPS to 8GB RAM (~$30/mo)
- Implement schema-per-tenant

**At 50 users ($2,500/mo revenue):**
- Move to Hetzner AX41 for DB (~$50/mo)
- Keep Supabase for auth/storage on separate VPS
- Total: ~$100/mo infra

**At 200 users ($10K/mo revenue):**
- Add read replica or upgrade to AX51 (128GB RAM, ~$80/mo)
- Or switch to managed (DigitalOcean, Crunchy) for less ops
- Total: ~$200-300/mo infra

**At 500+ users ($25K+/mo revenue):**
- Managed Postgres cluster
- Consider Supabase Enterprise or Crunchy Bridge
- Total: ~$500-800/mo infra
- You can afford it easily at this point

### Schema-per-Tenant: Operational Considerations

**Pros:**
- `pg_dump -n tenant_pam` backups individual tenant
- Can GRANT/REVOKE per schema
- Easier to reason about data location
- Can move schema to different DB if needed

**Cons:**
- Schema creation on signup (small overhead)
- Migrations must run per-schema (script this)
- More schemas = more pg_catalog entries (fine up to thousands)
- Connection pooling needs schema awareness

**Migration script pattern:**
```python
def run_migration_all_tenants(migration_sql):
    tenants = get_all_tenant_schemas()
    for schema in tenants:
        execute(f"SET search_path TO {schema}, public")
        execute(migration_sql)
```

### Vector Search Considerations

pgvector with schema-per-tenant:
- Each schema gets its own HNSW index
- Pro: Index size per tenant is smaller, faster queries
- Con: More indexes to maintain
- At 500 users × 3K patterns = 1.5M vectors total, but split across 500 schemas = 3K vectors per index (trivial)

This actually **helps** performance vs one giant 1.5M vector index.

### Bottom Line

1. **Schema-per-tenant is the right choice** for this use case
2. **Self-hosted Supabase** for beta, then **dedicated Postgres** as you grow
3. **Hetzner dedicated servers** are best price/performance for your scale
4. **$10-18K budget** easily covers 2-3 years of infrastructure even at 500 users
5. **Don't over-engineer** - a single beefy server handles 500+ users fine

---

## Pre-Migration Checklist (No New Hardware Needed)

Work that can be done on the current codebase while waiting for infrastructure.

### Code Refactoring

- [ ] **Remove user approval workflow** - Delete `/admin/users` page, approval API routes, `admin_emails` table usage
- [ ] **Remove `is_admin` checks** - Replace with simpler owner check (current user = tenant owner)
- [ ] **Abstract database queries** - Add a `getTenantSchema()` helper that returns `'public'` for now, will return `'tenant_xyz'` later
- [ ] **Audit all Supabase queries** - List every table access, flag ones that need tenant scoping
- [ ] **Extract hardcoded URLs** - Replace `patterns.tachyonfuture.com` with env var for future subdomain support

### Build Share Link Feature (Works on Current Infra)

This is the highest-impact prep work - useful for Mom now, validates the customer voting model, and code transfers directly to multi-tenant.

- [ ] **Create `share_links` table** - Can add to current Supabase now
- [ ] **Create `share_link_patterns` table** - Junction table for patterns in a share link
- [ ] **Create `share_link_votes` table** - For guest voting
- [ ] **Build "Create Share Link" UI** - Select patterns → set expiration → generate link
- [ ] **Build share link public page** - `/share/[token]` - no auth required
- [ ] **Build voting UI** - Guest enters name, clicks favorites
- [ ] **Build "My Share Links" management page** - Owner sees all links + vote results
- [ ] **Add link expiration** - Default 30 days, show expired state gracefully

### Database Migrations to Write

- [ ] **Write tenant schema template** - SQL script that creates a tenant schema with all tables
- [ ] **Plan ID strategy** - Tenant-scoped pattern IDs (1, 2, 3 per tenant) or global UUIDs?
- [ ] **Write `profiles` migration** - Add `is_platform_admin` column (just for you)
- [ ] **Write `tenants` table migration** - Can create table now, populate later

### UI/UX Changes

- [ ] **Remove "Users" from admin nav** - Won't exist in multi-tenant
- [ ] **Rename "Admin" section** - Becomes "Settings" or "Manage Patterns"
- [ ] **Add "Share" button to pattern grid** - Entry point for creating share links
- [ ] **Design share link results view** - How owner sees aggregated customer votes

### Documentation

- [ ] **Document current API routes** - Which stay, which change, which are removed
- [ ] **Map current tables → tenant schema** - What moves into tenant schema vs stays global
- [ ] **Write tenant onboarding flow** - What happens when a new quilter signs up?

### Nice-to-Have (If Time)

- [ ] **Add Stripe integration skeleton** - Pricing page UI, subscription model hooks
- [ ] **Build "My Account" page** - Where owner manages their subscription/billing
- [ ] **Add usage tracking** - Pattern count, storage used (needed for billing later)
- [ ] **Research Gammill file format** - Can we export patterns directly to their machines?

### Priority Order

1. **Share link feature** - Immediate value, validates model
2. **Code refactoring** - Remove dead code, simplify auth
3. **Database migrations** - Prep schemas for multi-tenant
4. **UI/UX changes** - Clean up admin section
5. **Stripe integration** - Only after beta validates pricing
