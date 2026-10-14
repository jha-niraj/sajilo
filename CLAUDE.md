# Sajilo (on the Basecodebase starter monorepo)

Production-ready Next.js monorepo. Clone, fill `.env` files, run `pnpm --filter @repo/db db:push && pnpm --filter @repo/db db:seed`, then `pnpm dev`.

## Writing conventions

- Use hyphens (`-`) not em-dashes (`—`) everywhere in copy, comments, and JSX text.
- No comments unless explaining a non-obvious WHY.
- All buttons must have `cursor-pointer` (global CSS rule in globals.css handles this).
- Git: never add Claude as co-author. No `Co-Authored-By: Claude` trailer and no "Generated with Claude Code" line in commits or PRs.

## Stack

| Layer | Tool |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Framework | Next.js 16.3 App Router |
| Database ORM | Drizzle ORM (`@repo/db`, Neon HTTP driver) |
| Authentication | Better Auth (`@repo/auth`) |
| File storage | Cloudflare R2 (`@repo/storage`) |
| Image hosting | Cloudinary (unsigned for avatars, signed API for bulk) |
| Email | Resend (via `@repo/auth` - `resend` dep) |
| UI components | Shadcn/ui + Radix UI (`@repo/ui`) |
| Loaders | `DotmSquare11` (inline), `PageLoader` (full-page) |
| Styling | Tailwind CSS v4 |
| Language | TypeScript 5.9 |
| DB driver | @neondatabase/serverless (neon-http) |
| Package manager | pnpm 9 |

## Workspace layout

```
basecodebase/
├── apps/
│   ├── main/          # Customer-facing Next.js app  (port 3100)
│   └── admin/         # Admin dashboard              (port 3001)
└── packages/
    ├── auth/          # @repo/auth  - Better Auth config, email templates, session helpers
    ├── db/            # @repo/db    - Drizzle schema, DB client, seed script
    ├── storage/       # @repo/storage - Cloudflare R2 helpers
    ├── ui/            # @repo/ui    - Shadcn components, loaders, DataTable, hooks
    ├── eslint-config/
    └── typescript-config/
```

## Environment variables

Each app has its own `.env` file. Root `.env` is empty (env moved to apps).

### `apps/main/.env`
```bash
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=<32-char secret>
BETTER_AUTH_URL=http://localhost:3100
NEXT_PUBLIC_SITE_URL=http://localhost:3100
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL="AppName <noreply@domain.com>"
MAIN_APP_URL=http://localhost:3100
ADMIN_APP_URL=http://localhost:3001
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=   # Unsigned preset for profile pictures
CLOUDINARY_API_KEY=                     # For signed/bulk uploads
CLOUDINARY_API_SECRET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

### `apps/admin/.env`
Same as above minus `GOOGLE_CLIENT_ID/SECRET` and `NEXT_PUBLIC_APP_URL`. `BETTER_AUTH_URL=http://localhost:3001`.

## Getting started

```bash
pnpm install

# First time or after schema changes
pnpm --filter @repo/db db:push

# Seed super admin account
pnpm --filter @repo/db db:seed
# Creates: superadmin@admin.com / Admin@1234

pnpm dev   # main :3100, admin :3001
```

## Database (`packages/db`)

Schema in `packages/db/src/schema/` - `auth.ts`, `admin.ts`, `collection.ts`, `settings.ts`, `lending.ts`, `scan.ts`, `ai.ts`, `relations.ts`.

### Tables

**Better Auth core:** `user`, `session`, `account`, `verification`

**User fields (beyond Better Auth defaults):**
- `role` - enum('USER', 'ADMIN'), default 'USER'
- `address` - text, nullable
- `isActive` - boolean, default true
- `bio` - text, nullable

**User notifications:** `notification`
- id, userId (FK), title, message, type (info/success/warning/error), isRead, readAt, actionUrl, metadata, createdAt

**Admin tables:** `adminAccess`, `adminInvitation`, `adminAuditLog`, `adminDashboardStats`, `adminNotification`, `adminSystemSettings`

**Comms:** `announcement`, `broadcast`

**Admin roles:** `SUPER_ADMIN` | `TEAM_MEMBER`

**Admin statuses:** `ACTIVE` | `INACTIVE` | `SUSPENDED`

### DB commands

```bash
pnpm --filter @repo/db db:push      # push schema (dev)
pnpm --filter @repo/db db:generate  # generate SQL migrations (prod)
pnpm --filter @repo/db db:migrate   # apply migrations (prod)
pnpm --filter @repo/db db:studio    # Drizzle Studio UI
pnpm --filter @repo/db db:seed      # seed superadmin@admin.com / Admin@1234
```

### Using the DB client

```typescript
import { db } from '@repo/db'
import { user, notification } from '@repo/db/schema'
import { eq, desc, ilike } from '@repo/db'  // re-exported from drizzle-orm

// Relational query (reads)
const record = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    with: { adminAccess: true },
})

// Core API (writes)
await db.update(user).set({ name: 'New Name' }).where(eq(user.id, userId))
```

## Authentication (`packages/auth`)

Better Auth with email+password and Google OAuth.

### Exports

```typescript
// Server components / server actions (never import in client components)
import { auth, getServerSession, requireServerSession } from '@repo/auth'
import { welcomeEmail, passwordChangedEmail, resetPasswordEmail } from '@repo/auth'

// Client components ("use client")
import { authClient, signIn, signOut, signUp, useSession } from '@repo/auth/client'

// Middleware (Edge Runtime)
import { authMiddleware } from '@repo/auth/middleware'
```

### Server session pattern

```typescript
// In server components or server actions:
const session = await getServerSession()
if (!session) redirect('/signin')
const { user } = session
// user.id, user.email, user.name, user.role, user.image, user.isActive
```

### Client session pattern

```typescript
// In "use client" components:
const { data: session, isPending } = useSession()
```

### Emails sent automatically (need RESEND_API_KEY)

| Trigger | Template |
|---|---|
| New signup | `welcomeEmail` - fires via `databaseHooks.user.create.after` |
| Forgot password | `resetPasswordEmail` |
| Email verification | `verifyEmailTemplate` |
| Password change | `passwordChangedEmail` - call `notifyPasswordChanged()` server action |

Emails silently skip when `RESEND_API_KEY` is not set.

## Main App (`apps/main`) - Sajilo, port 3100

Sajilo is an offline-first PWA for a bank daily-savings collector (Phase 1: daily collection) and his lending book (Phase 2). Plans and task lists: `plan/phase-1-daily-collection.md`, `plan/phase-2-lending.md`, `plan/phase-3-profiles-bank-loans.md` (planned, not built). DB choice rationale: `plan/database-hyperdrive-vs-neon.pdf`.

### Rules
- English by default, Nepali toggle (`lib/dict.ts`, `useI18n()`); every user-facing string goes through the dictionary in both languages.
- Scrolling containers use the shadcn `ScrollArea` from `@repo/ui` (long lists: `components/progressive-list.tsx`, loads 10 more as you reach the bottom). Never hand-roll `overflow-auto`.
- Fonts: Bricolage Grotesque for Latin, Mukta for Devanagari (`--font-sajilo`).
- Landing page after login is `/munshi`.
- No native form controls: use `components/choice.tsx` (shadcn Select), `@repo/ui` Textarea/Input, `components/pin-input.tsx` (InputOTP), `NepaliDatePicker`, `useConfirm`. Never `<select>`, `type="date"`, `window.confirm`.
- All dates are Nepal-local AD strings `YYYY-MM-DD` in the DB; Bikram Sambat comes from `@repo/calendar` (`adToBs`, `bsToAd`, `bsMonthRange`). Never use `new Date('YYYY-MM-DD')` for calendar maths.
- Money logic is pure and tested: `lib/money/ledger.ts` (dues, catch-up oldest-first, advance) and `lib/money/interest.ts` (Rs X per 100 per month, real BS month lengths, compounding toggle, interest-first repayments). Run `pnpm --filter main test`.
- DB driver is Neon HTTP (no interactive transactions). Multi-row writes use `db.batch([...])`; ticks are single-row upserts guarded by `markedAt`.
- Keep the file name `middleware.ts` (edge). OpenNext on Workers does not run Node "proxy" yet. Next is pinned to 16.3.x until OpenNext supports 16.4.

### Routes
`/login`, `/signup` (phone + 4-digit PIN via Better Auth phoneNumber plugin), `/munshi`, `/today` (tick list, offline), `/today/finish`, `/month`, `/print/month` (landscape A4 register: customers x BS days), `/customers/[id]`, `/manage`, `/scan`, `/loans`, `/loans/new`, `/loans/[id]`, `/loans/calculator`, `/cash`, `/more`, `/settings`, `/offline`.

### Offline
`lib/offline/store.ts` (Dexie: day snapshots + outbox) and `lib/offline/sync.ts` (flush on online/visibility/30s). `public/sw.js` caches the app shell and pages (network-first). Server actions in `actions/` are the only API.

### Munshi (AI bookkeeper, `/munshi`)
- Voice: Sarvam Saaras v4 STT (customer/borrower names as keyterms) -> agent -> Sarvam Bulbul v3 TTS (Hindi voice reads Nepali Devanagari; no Nepali TTS yet). Chat uses the same agent.
- Agent: Vercel AI SDK `generateText` with tools built by `makeTool` (`@repo/ai/agent`), same layout as Gurukul Saathi: `lib/munshi/agenttools/<area>/<area>-reads.ts|-writes.ts`, registry in `agenttools/index.ts`.
- Model: GPT (`OPENAI_API_KEY`) or, without it, Sarvam `sarvam-105b-conversations` via the AI SDK OpenAI-compatible provider (`lib/munshi/model.ts`).
- Write tools follow preview/confirm: `confirm=false` saves nothing and shows a Confirm card; `confirm=true` only after he says yes; one write per turn (`claimWriteSlot`). Writes wrap existing server actions.
- Turns go through `POST /api/munshi` (JSON = chat, multipart = voice). Confirm button -> `confirmProposal` server action.
- New tool: add a def in the right area file and list it in `agenttools/index.ts`.

### Auth flow
`/login` is PIN-only when the phone is remembered on the device (`lib/device-account.ts`); otherwise it asks the number once (joined +977 boxes, `components/auth/phone-input.tsx`). `/signup` = name -> number -> PIN -> confirm -> `/munshi?welcome=1`.

### Scan import
Photo -> `@repo/sarvamai` digitise (ne-IN, handwritten, md) -> `lib/scan/structure.ts` (gpt-4o-mini JSON; falls back to a line parser without `OPENAI_API_KEY`) -> review screen -> `applyScan`. Photo kept in R2 when `R2_*` is set.

### Env (`apps/main/.env`)
`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `AUTH_COOKIE_PREFIX=sajilo`, `SARVAM_API_KEY`, optional `OPENAI_API_KEY`, `R2_*`, `RESEND_*`.

### Deploy (Cloudflare Workers via OpenNext)
```bash
cd apps/main
pnpm deploy:build                      # opennextjs-cloudflare build
npx wrangler dev --port 8787 --local   # run in workerd locally (uses .dev.vars)
npx wrangler secret put DATABASE_URL   # repeat for BETTER_AUTH_SECRET, SARVAM_API_KEY, OPENAI_API_KEY, R2_*
pnpm deploy
```
Set the real domain in `wrangler.jsonc` `vars` (BETTER_AUTH_URL etc.) before deploying.

## Admin App (`apps/admin`) - port 3001

### Credentials (seeded)

```
Email:    superadmin@admin.com
Password: Admin@1234
```

Re-seed anytime: `pnpm --filter @repo/db db:seed`

### Middleware (`apps/admin/middleware.ts`)

Cookie-based. Protects all dashboard routes. Logged-in users hitting `/` redirect to `/dashboard`.

### Admin roles

| Role | Access |
|---|---|
| `SUPER_ADMIN` | Full access to all pages and actions |
| `TEAM_MEMBER` | Only modules explicitly granted in the permissions matrix |

### Invite flow (SUPER_ADMIN only)

1. Go to `/admins` → "Invite Admin"
2. Enter email + select role (SUPER_ADMIN or TEAM_MEMBER)
3. Invitation email sent with link: `{ADMIN_APP_URL}/join?token=ADMIN-XXXXXXXX`
4. Invitee opens `/join?token=...` → sets password → auto-signed in
5. Without Resend: copy the code from the invitations table, manually share `localhost:3001/join?token=ADMIN-XXXXXXXX`

### Permissions system

Two-layer enforcement:

**Layer 1 - Sidebar filtering:**
```typescript
// navigation.ts exports getNavigationForPermissions(permissions)
// SUPER_ADMIN: sees everything
// TEAM_MEMBER: sees only modules in their permissions object
const filteredNav = isSuperAdmin ? adminNavigation : getNavigationForPermissions(permissions)
```

**Layer 2 - Page gates:**
```tsx
import { PermissionGate } from "@/components/permission-gate"

export default function MyPage() {
    return (
        <PermissionGate module="analytics" level="read">
            {/* page content - shows "Access restricted" if unauthorized */}
        </PermissionGate>
    )
}
```

**Available modules:** `"users"` | `"analytics"` | `"communications"` | `"admin_management"` | `"system"`

**Available levels:** `"read"` | `"write"` | `"delete"` | `"full"`

**Granting permissions:** `/admins/access` - permission matrix per admin, save to apply immediately.

**Inline checks:**
```typescript
import { useAdminAccess } from "@/context/admin-access-context"
const { isSuperAdmin, can, adminRole } = useAdminAccess()
if (can('analytics', 'write')) { /* ... */ }
```

### Admin route map

| Route | Permission | Description |
|---|---|---|
| `/` | public | Landing page (video background, sign-in sheet) |
| `/join` | public | Accept invitation, set password |
| `/dashboard` | any | Stats overview, quick links, recent activity |
| `/analytics` | `analytics:read` | Platform metrics, charts |
| `/admins` | `admin_management:read` | Admin list + pending invitations |
| `/admins/access` | `admin_management:write` | Per-admin permissions matrix |
| `/admins/audit` | `admin_management:read` | Audit log with filters + detail sheet |
| `/admins/profile` | any | My profile, change password |
| `/users` | `users:read` | User list - click row opens detail sheet |
| `/system/settings` | `system:read` | System health + settings |
| `/reports/activity` | `analytics:read` | Activity log with CSV export |
| `/reports/admin-activity` | `analytics:read` | Per-admin breakdown |
| `/reports/financial` | `analytics:read` | Financial placeholder |
| `/communications/announcements` | `communications:read` | Create/publish/archive |
| `/communications/broadcasts` | `communications:read` | Draft bulk messages |

### Admin server actions

**`apps/admin/actions/admin.action.ts`**
- `checkAdminAccess()` - verify current user has active admin record
- `getCurrentAdmin()` - full admin profile for current user
- `getAdminUsers()` - list all admins
- `createAdminInvitation(input)` - create invite + send email with join link
- `getInvitationByToken(token)` - validate invite token (for join page)
- `joinAdminInvitation(token, password)` - accept invite, create account
- `getPendingInvitations()` - pending invites list
- `revokeInvitation(id)` - revoke a pending invite
- `updateAdminStatus(id, status)` - ACTIVE/INACTIVE/SUSPENDED
- `updateAdminPermissions(id, permissions)` - update permission matrix
- `getDashboardStats()` - totals for stat cards
- `getAuditLogs(page, limit)` - paginated audit log
- `setAdminPassword(newPassword)` - first-time password setup
- `changeAdminPassword(current, new)` - change with current password verification

**`apps/admin/actions/user.action.ts`**
- `getUsers(page, limit, search)` - paginated user list with search
- `getUserById(userId)` - full user details
- `updateUserStatus(userId, isActive)` - activate/deactivate (SUPER_ADMIN only)

**`apps/admin/actions/system.action.ts`**
- `getSystemSettings()`, `getSystemSetting(key)`, `updateSystemSetting(key, data)`
- `getSystemHealth()` - DB status + recent error count
- `clearCache(keys?)` - revalidate paths
- `getAdminNotifications(params)` - notification list with pagination
- `markNotificationAsRead(id)`, `markAllNotificationsAsRead()`

**`apps/admin/actions/analytics.action.ts`**
- `getAnalyticsData()` - platform metrics, 7-day chart data

**`apps/admin/actions/communications.action.ts`**
- `getAnnouncements()`, `createAnnouncement(input)`, `updateAnnouncementStatus(id, status)`, `deleteAnnouncement(id)`
- `getBroadcasts()`, `createBroadcast(input)`

### Admin context

```typescript
// Available inside any (main) layout child via AdminAccessProvider
import { useAdminAccess } from "@/context/admin-access-context"

const { adminRole, permissions, isSuperAdmin, loading, can } = useAdminAccess()
```

Fetches current admin's role + permissions once on mount. Sidebar and PermissionGate consume it.

### Notification bell

Sidebar shows bell icon with unread count badge. Polls every 60s. Dropdown with mark-as-read.
The `adminNotification` table + CRUD actions are in `system.action.ts`.

## Shared packages

### `@repo/ui` - UI component library

All imports follow the pattern: `import { X } from "@repo/ui/components/ui/x"`

**Shadcn components (standard):**
accordion, alert, alert-dialog, avatar, badge, button, calendar, card, carousel, checkbox, dialog, dropdown-menu, form, input, label, pagination, popover, progress, radio-group, scroll-area, select, separator, sheet, skeleton, slider, sonner (toast), switch, table, tabs, textarea, tooltip

**Custom components:**
- `confirm-dialog` - confirmation modal with destructive variant
- `data-table` - generic sortable/searchable/paginated table (see below)
- `dotm-square-11` - animated dot-grid loader for inside buttons
- `empty-state` - consistent empty list state
- `loader` - `PageLoader` (full-page) + `InlineLoader` (standalone spinner)
- `page-header` - page title + breadcrumb + description + action slot

**Hooks:** `import { useDebounce } from "@repo/ui/hooks/use-debounce"`

**Utilities:** `import { cn } from "@repo/ui/lib/utils"` (tailwind-merge + clsx)

### DataTable component

Generic controlled table. The table is pure display - data management stays in the caller.

```typescript
import { DataTable, type DataTableColumn } from "@repo/ui/components/ui/data-table"

// Define columns with custom render functions
const columns: DataTableColumn<MyType>[] = [
    {
        key: "name",
        header: "Name",
        sortable: true,
        render: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge active={row.isActive} />,
    },
]

// In JSX - all data management (fetch, sort, search) is in the caller
<DataTable<MyType>
    data={rows}
    columns={columns}
    loading={loading}
    getRowId={(row) => row.id}

    // Row click - caller decides: open sheet, navigate, select
    onRowClick={(row) => openDetailSheet(row)}
    highlightRowId={selectedId}  // highlights the selected row

    // Per-row action buttons - caller renders whatever's needed
    renderRowActions={(row) => (
        <button onClick={() => handleAction(row)}>...</button>
    )}

    // Controlled search - caller debounces + re-fetches
    searchValue={search}
    onSearchChange={setSearch}

    // Controlled sort - caller re-fetches with new sort params
    sortKey={sortKey}
    sortDir={sortDir}
    onSort={handleSort}

    // Controlled pagination - caller updates page + re-fetches
    page={page}
    totalPages={pages}
    totalItems={total}
    onPageChange={setPage}

    // Extra toolbar slots
    toolbarLeft={<FilterChips />}
    toolbarRight={<ExportButton />}

    emptyTitle="No results"
    emptyIcon={<Icon className="w-12 h-12" />}
/>
```

### Loaders

Replace all `Loader2` from lucide-react with these:

```typescript
import { DotmSquare11 } from "@repo/ui/components/ui/dotm-square-11"
import { PageLoader, InlineLoader } from "@repo/ui/components/ui/loader"

// Full-page loading:
if (loading) return <PageLoader />

// Inside a button while submitting:
<button disabled={loading}>
    {loading ? <DotmSquare11 size={16} dotSize={2} speed={1.5} /> : "Submit"}
</button>

// Standalone spinner anywhere:
<InlineLoader size={24} />
```

### `@repo/auth`

```typescript
// Server-side (never in client components)
import { auth, getServerSession, requireServerSession } from '@repo/auth'
import { welcomeEmail, passwordChangedEmail, resetPasswordEmail, verifyEmailTemplate } from '@repo/auth'
import { toNextJsHandler } from '@repo/auth'  // for API routes

// Client-side ("use client")
import { authClient, signIn, signOut, signUp, useSession, getSession } from '@repo/auth/client'
// authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions })
// authClient.listSessions() / authClient.revokeSession({ token }) / authClient.revokeOtherSessions()
// authClient.requestPasswordReset({ email, redirectTo })
// authClient.resetPassword({ newPassword, token })
// authClient.sendVerificationEmail({ email, callbackURL })
```

### `@repo/storage` (Cloudflare R2)

```typescript
import { getUploadUrl, getDownloadUrl, deleteFile, getPublicUrl, generateKey } from '@repo/storage'
// Wire up: add "@repo/storage": "workspace:*" to the app's package.json deps
```

## Adding a new feature

1. **New DB table** - add to `packages/db/src/schema.ts`, run `pnpm --filter @repo/db db:push`
2. **New server actions** - create in `apps/<app>/actions/`
3. **New page** - create under `apps/<app>/app/`
4. **Protected page (main app)** - add route to `protectedRoutes` in `apps/main/middleware.ts`
5. **Protected admin page** - wrap content in `<PermissionGate module="..." level="read">`, add nav item to `apps/admin/lib/navigation.ts` with `requiredPermission`
6. **Reusable UI component** - add to `packages/ui/src/components/ui/`
7. **After schema changes** - always run `db:push`

## UI pattern reference

### Auth pages (main app)
Use `--so-*` CSS variables. All auth pages have a split layout (side panel + form). The side panel has:
- Grid background with mask
- App logo/name (top left) - replace `YourApp` with product name
- Marketing headline and feature list (middle)
- Customer testimonial (bottom)

### Admin pages
Use Tailwind classes. Dark mode via `dark:` variants. Color scheme:
- Cards: `bg-white dark:bg-neutral-900` with `border-neutral-200 dark:border-neutral-800`
- Active/success: emerald
- Danger: red
- Warning: amber
- Admin brand: `from-red-500 to-orange-500` gradient

### Sheet pattern (admin)
Use a right-side sheet for "view details" instead of navigating to a new page. This keeps list context visible.

```tsx
import { Sheet, SheetContent } from "@repo/ui/components/ui/sheet"

// Row click opens sheet; sheet shows detail without losing the list
<DataTable onRowClick={(row) => { setSelected(row); setSheetOpen(true) }} />
<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
    <SheetContent side="right" className="sm:max-w-md ...">
        {/* detail view */}
    </SheetContent>
</Sheet>
```

The `/admins/audit` (log detail) and `/users` (user detail) pages use this pattern.

## Status

| Feature | Status |
|---|---|
| Better Auth (email+password + Google OAuth) | Ready |
| Welcome / reset / verify / password-changed emails | Ready (needs RESEND_API_KEY) |
| User profile (name, Cloudinary avatar, password change) | Ready |
| Session management (list + revoke sessions) | Ready |
| Account deletion (Danger Zone in profile) | Ready |
| User notification CRUD (server actions + DB) | Ready (no UI bell yet) |
| Route protection middleware (main + admin) | Ready |
| Error pages (404, 500, per-layout error boundaries) | Ready |
| loading.tsx files on all routes | Ready |
| SEO baseline (robots.txt, sitemap.xml) | Ready |
| OG image generation (edge runtime) | Ready - update headline/tagline |
| PWA manifest | Ready - update name/icons |
| Terms + Privacy pages | Ready - fill in legal text |
| Env validation at startup | Ready |
| R2 storage helpers | Ready (wire up: add @repo/storage dep) |
| Cloudinary unsigned upload (avatars) | Ready (needs cloud name + preset) |
| Cloudinary signed upload (bulk/large) | Ready (needs API key + secret) |
| `lib/constants.ts` in both apps | Ready |
| DataTable component | Ready |
| useDebounce hook | Ready |
| ConfirmDialog, EmptyState, PageHeader components | Ready |
| Admin signin (video background, sheet) | Ready - replace BG_VIDEO constant |
| Admin super admin seed | Ready (`db:seed`) |
| Admin invite flow (`/join?token=`) | Ready |
| Admin roles: SUPER_ADMIN + TEAM_MEMBER | Ready |
| Admin sidebar permission filtering | Ready |
| Admin page permission gates | Ready |
| Admin notification bell (sidebar) | Ready |
| Admin audit log | Ready |
| Admin access control matrix | Ready |
| Admin user management with DataTable + sheet | Ready |
| Financial reports | Wire up payment provider |
| Broadcast email sending | Configure Resend |
| R2 file upload integration | Add @repo/storage to app deps |
| DB migrations (prod) | Use `db:generate` + `db:migrate` |
