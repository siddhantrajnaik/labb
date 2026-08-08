# Labb v0.6 changelog

## Added
- Dashboard as the default signed-in landing page.
- Inventory value, low-stock, expiry, procurement, monthly spend and active-container KPIs.
- Recent usage and procurement-status dashboard panels.
- Inventory Detail screen with item metadata, stock health, lot/container ledger and consumption history.
- Notification Center with low-stock, expiry, delayed procurement, pending-request and delivered-without-invoice alerts.
- Per-user persistent acknowledgement state.
- RLS-protected `notification_acknowledgements` table.
- Realtime updates for notification acknowledgements.
- Notification badges in sidebar and header.

## Preserved
- Supabase Auth and profile-driven roles.
- Existing v0.5 inventory, container, vendor, procurement, usage, attachment and audit data models.
- FEFO consumption RPC.
- Atomic ordering/receiving RPCs.
- Private Storage and lab-scoped RLS.
- GitHub Pages deployment workflow.

## Migration
Run `supabase/migrations/v0.6.sql` before deploying the frontend.
