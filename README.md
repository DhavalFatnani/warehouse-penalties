# warehouse-penalties

Manager-facing warehouse penalties system built on Supabase + Next.js.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create/update `.env`:

```bash
cp .env.example .env
```

Required variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_DB_URL` (for migrations / `psql`)

The browser client reads **`NEXT_PUBLIC_*`** values that are **filled from `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`** in [`next.config.mjs`](next.config.mjs), so you usually do **not** need duplicate `NEXT_PUBLIC_*` lines in `.env`. After editing `.env`, restart `npm run dev`.

**Vercel / production:** set `NEXT_PUBLIC_APP_URL` to your real origin (e.g. `https://warehouse-payroll.vercel.app`, no trailing slash). If it is left as `http://localhost:3000` in the Vercel project, invite links could point at localhost; the API now falls back to `VERCEL_URL` when it detects that misconfiguration, but you should still set `NEXT_PUBLIC_APP_URL` and **Supabase → Authentication → URL Configuration** (`Site URL` + **Redirect URLs** including `{your-origin}/auth/callback`).

Signup policy:

- `NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP=false` (recommended for prod): users must be created/invited by admins.
- `NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP=true` (dev/test): enables `/signup` self-registration.

### Auth email with free SMTP (recommended)

Supabase’s built-in email is very rate-limited. For invites (`/dashboard/admin/invite`), enable **custom SMTP** in Supabase and use a **free transactional provider** (credentials live only in the Supabase Dashboard, not in this app’s `.env`).

**Option A — [Brevo](https://www.brevo.com/)** (free tier, no card for signup)

1. Sign up → **SMTP & API** → create an **SMTP key** (and add/verify a sender email or domain per their checklist).
2. **Supabase Dashboard** → **Authentication** → **Emails** → **SMTP settings**:
   - **Host:** `smtp-relay.brevo.com`
   - **Port:** `587` (TLS) or `465` (SSL)
   - **Username:** your Brevo SMTP login (often the email you signed up with—see Brevo’s SMTP page)
   - **Password:** the **SMTP key** (not the Marketing API key)
   - **Sender email / name:** an address Brevo accepts for your account
3. Save. Invites and password resets then use Brevo instead of Supabase’s shared cap.

**Invite says OK but no email?** This app does not call Brevo’s HTTP API—only Supabase does via SMTP. You do **not** put a Brevo API key in this Next.js project for invites. In Supabase’s SMTP **password** field, paste Brevo’s **SMTP key** (from **SMTP & API** → SMTP), not the long `xkeysib-…` marketing API key. Then check **Supabase Dashboard → Authentication → Logs** for mail errors, **Brevo → Transactional** (or email logs) for delivery, and the recipient’s **spam** folder. Toggle custom SMTP off/on once if settings didn’t apply.

**Brevo log: “sender … is not valid”?** The **From** address in Supabase (sender email) must be allowed in Brevo. In Brevo go to **Senders & IP** → **Senders** (or **Domains**) and either **add and verify** that exact address (confirmation email) or **authenticate the domain** (e.g. `knotnow.co`) with DNS (SPF/DKIM). Then set Supabase’s SMTP sender to an address on that verified domain (e.g. `noreply@knotnow.co` after the domain is authenticated).

Brevo SMTP reference: [Transactional emails via Brevo SMTP](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP).

**Other free-tier SMTP options** (same Supabase flow, different host/user/pass from each vendor): [Mailjet](https://www.mailjet.com/pricing/), [Elastic Email](https://elasticemail.com/resources/settings/smtp-settings/). [Resend](https://resend.com/pricing) also includes a free monthly allowance if you prefer it once a domain is verified.

Supabase overview: [Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

4. Apply migrations:

```bash
supabase db push
```

5. Seed sample data:

```bash
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

6. Run app:

```bash
npm run dev
```

Open the URL printed in the terminal (default **http://localhost:3000**). To use port 3001 instead:

```bash
npm run dev:3001
```

### If you see `404` on `/_next/static/chunks/...` or `.css`

This almost always means the **port does not match the running dev server** (e.g. HTML from `3000` but assets requested on `3001`), or a **stale tab** after a rebuild.

1. Stop all `next dev` processes, then start again from the project root: `npm run dev` (or `npm run dev:3001`).
2. Use **exactly** the host and port shown in the terminal line `Local: http://localhost:…`.
3. Hard refresh the page (or clear site data for `localhost`) so the browser drops old chunk filenames.
4. If it persists: `rm -rf .next && npm run dev` (or `npm run clean && npm run dev`).

5. **`Cannot find module './948.js'`** (or another numbered file) from `webpack-runtime.js`: the dev cache is out of sync—stop `next dev`, run `npm run clean`, then start the dev server again.

## Routes

- `/login`
- `/signup` (only when `NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP=true`)
- `/dashboard` — overview metrics & recent activity
- `/dashboard/apply` — apply penalty (primary flow)
- `/dashboard/records` — list, filter, settle
- `/dashboard/settlement` — cycle summary & bulk settle
- `/dashboard/staff` — staff directory
- `/dashboard/staff/:id` — edit staff
- `/dashboard/penalties` — penalty definitions
- `/dashboard/imports` — bulk staff import
- `/dashboard/admin/users` (admin)
- `/dashboard/admin/access` (admin)
- `/dashboard/admin/invite` (admin)

## API endpoints

- `GET /api/me`
- `GET /api/dashboard/stats`
- `GET/POST /api/staff`
- `GET/PATCH /api/staff/:id`
- `GET /api/staff-types`
- `GET/POST /api/penalty-definitions`
- `PATCH /api/penalty-definitions/:id`
- `GET/POST /api/penalty-records`
- `PATCH /api/penalty-records/:id/status` (settle one)
- `POST /api/penalty-records/settle-batch`
- `GET /api/settlement/preview`
- `POST /api/uploads/proof`
- `GET/POST/PUT /api/imports`
- `GET /api/imports/:batchId/rows`
- `GET /api/warehouses`
- `GET /api/admin/users` (admin)
- `PATCH /api/admin/users/:id` (admin)
- `GET /api/admin/users/:id/warehouses` (admin)
- `PUT /api/admin/users/:id/warehouses` (admin)
- `POST /api/admin/invitations` (admin)

**Penalty lifecycle:** records use statuses `created` (open, unpaid) and `settled` (closed for payroll). Apply migration `202604100001_penalty_settlement_lifecycle.sql` if upgrading an existing database.

## Warehouse access

Managers are scoped to warehouses via `public.user_warehouse_access` (see migration `202604090001_warehouse_tenancy_import_rpc.sql`). The seed/migration grants managers access to the `DEFAULT` warehouse when present.

Bulk import commit runs in a single DB transaction via `public.commit_staff_import_batch` (service role only).

## Verification

- Query plans: `psql "$SUPABASE_DB_URL" -f supabase/tests/query_plans.sql`
- Unit tests: `npm test`
- Release checklist: `docs/release-checklist.md`
