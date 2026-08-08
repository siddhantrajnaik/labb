# Labb v0.5 — GitHub Pages + Supabase
> Project-specific build: Supabase URL preconfigured to `https://hsxwsutqpsvrueuohahr.supabase.co`. A browser-safe publishable/anon key is still required in `config.js`.


Labb is a browser-based laboratory inventory and procurement application. The frontend is hosted as static HTML/CSS/JavaScript on GitHub Pages. The backend is Supabase: PostgreSQL, Auth, Storage and Realtime.

## Architecture

GitHub Pages
- `index.html`, `styles.css`, `app.js`
- public browser application
- Supabase URL + publishable key only

Supabase
- PostgreSQL: inventory, containers/lots, vendors, procurement, usage and audit
- Auth: real user accounts and sessions
- Row Level Security: Admin/Member authorization in the database
- Storage: private SDS, quotation, invoice and other documents
- Realtime: refreshes shared lab data when another user changes records
- Edge Function: optional secure user invitation

## Important security rule

`config.js` may contain the Supabase project URL and publishable/anon key. These are intended for browser use when RLS is enabled.

**Never place a Supabase secret/service-role key in `config.js`, GitHub Pages, JavaScript, repository variables rendered into the frontend, or any other browser-accessible file.**

## Setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Authentication → Users, create or invite the first administrator.
4. Copy that Auth user's UUID.
5. Edit `supabase/bootstrap_first_admin.sql`, replace `REPLACE_WITH_AUTH_USER_UUID`, and run it.
6. Optional: run `supabase/seed_demo.sql` to add demo inventory/vendors.
7. Copy `config.example.js` to `config.js` and set:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
8. Configure Auth URL settings so your GitHub Pages URL is an allowed redirect URL.
9. Optional Admin invitations: deploy the included `invite-user` Edge Function.
10. Push the project to GitHub and enable Settings → Pages → Source: GitHub Actions.

See `SUPABASE_SETUP.md` and `DEPLOY_TO_GITHUB.md`.

## Roles

Member:
- sign in
- view shared inventory, containers, vendors, procurement and analytics
- create procurement requests
- record chemical/material usage through the secured RPC
- upload/download request or inventory documents

Admin:
- all Member actions
- add/update inventory and vendors
- stocktake adjustments
- create orders
- receive deliveries and create lots/containers
- invoice reconciliation and closure
- laboratory settings
- invite users when the Edge Function is deployed

Authorization is enforced by PostgreSQL RLS and secured RPCs, not merely by UI visibility.

## Data model

Core tables:
- `labs`
- `profiles`
- `inventory_items`
- `containers`
- `vendors`
- `procurement_requests`
- `procurement_items`
- `usage_logs`
- `attachments`
- `audit_logs`

The container ledger is authoritative for physical stock. Database triggers recalculate `inventory_items.current_stock` after container changes.

## Atomic operations

Sensitive multi-record workflows are server-side PostgreSQL functions:
- `consume_inventory(...)` — FEFO usage/depletion
- `adjust_inventory(...)` — Admin stocktake adjustment
- `place_order(...)` — Admin PO assignment/order transition
- `receive_procurement(...)` — Admin receipt + container creation + status transition

This prevents browser-side partial updates from leaving stock and procurement records inconsistent.

## Files

- `index.html` — application shell
- `app.js` — UI/workflows
- `api.js` — Supabase data access
- `supabase-client.js` — browser client initialization
- `config.example.js` — safe configuration template
- `supabase/schema.sql` — database/RLS/RPC/storage/realtime schema
- `supabase/bootstrap_first_admin.sql` — initial lab + admin profile
- `supabase/seed_demo.sql` — optional demo data
- `supabase/functions/invite-user/index.ts` — optional secure Admin invitation function
- `.github/workflows/pages.yml` — GitHub Pages deploy workflow

## Verification status

The static package, JavaScript syntax, GitHub Pages serving, security-key checks, route/assets and schema invariants were tested in the build environment. A live end-to-end Supabase integration test cannot be performed without your Supabase project URL/keys and hosted database; run `VERIFICATION_CHECKLIST.md` after connecting your project.


## v0.6 operational UX
This branch adds Dashboard, Inventory Detail, and Notification Center on top of the verified v0.5 Supabase backend. Apply `supabase/migrations/v0.6.sql` before deploying this branch. See `V0.6_UPGRADE.md`.
