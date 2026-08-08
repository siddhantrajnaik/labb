# Labb v1.0 Final

Production-oriented browser application for laboratory operations.

**Frontend:** GitHub Pages (`https://siddhantrajnaik.github.io/labb/`)  
**Backend:** Supabase (`https://hsxwsutqpsvrueuohahr.supabase.co`)

## Included modules
- Dashboard and operational notifications
- Inventory, physical container/lot ledger, FEFO usage, stocktake adjustment
- Procurement request → approval → order → partial/full receiving → invoice → close
- Vendors, private documents, audit log, analytics
- Team membership, Admin/Member roles, per-user active state and invitations
- Equipment registry, bookings, calibration/maintenance/repair logs
- Sample registry with hierarchical room/freezer/shelf/rack/box locations
- Camera-assisted barcode/QR scanning when the browser supports BarcodeDetector, with manual and keyboard-wedge scanner fallback
- Supabase Auth, RLS, private Storage and Realtime
- PWA service worker and GitHub Pages deployment workflow

## Upgrade from deployed v0.6
1. Back up the Supabase database.
2. Run `supabase/migrations/v1.0.sql` in Supabase SQL Editor.
3. Deploy `invite-user` again so invited profiles receive the email/active fields.
4. Deploy the frontend files.
5. Run `FINAL_ACCEPTANCE_CHECKLIST.md`.

## Security
Only the Supabase project URL and publishable browser key are present in `config.js`. Never commit a secret/service-role key. Authorization is enforced through Postgres RLS and security-definer RPCs.
