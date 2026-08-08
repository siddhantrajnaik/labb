# Security model

## Browser keys
The frontend may contain only the Supabase project URL and a publishable/legacy anon key. These identify the project but do not grant unrestricted database access.

Never expose a secret/service-role key. Secret keys bypass Row Level Security.

## Authentication
Users authenticate through Supabase Auth. Sessions are managed by `supabase-js` in the browser.

## Authorization
Admin/Member authorization is enforced in PostgreSQL Row Level Security and server-side functions. Hiding a button is not considered a security boundary.

The user's role is stored in `public.profiles.role`, which ordinary users cannot update through RLS. Authorization does not trust editable user metadata.

## RLS
All public application tables have RLS enabled. Policies constrain rows to `current_lab_id()` and constrain privileged writes to `is_admin()`.

## Atomic inventory operations
Consumption, stock adjustment, ordering and receiving use PostgreSQL RPC functions so cross-table changes occur transactionally on the backend.

## Files
The `labb-documents` bucket is private. Storage RLS scopes object paths to the signed-in user's lab. Downloads use short-lived signed URLs.

## User invitations
Inviting Auth users is an administrative Auth API operation. The optional Edge Function performs it server-side after verifying that the caller has an Admin profile. Browser JavaScript never receives the secret key.

## Audit
Database triggers write audit events for operational tables. Clients receive SELECT-only access to audit records.

## Production recommendations
- Require email verification.
- Use strong passwords or an organization SSO provider.
- Configure SMTP for reliable invitations/password recovery.
- Review Supabase Auth rate limits.
- Restrict allowed redirect URLs.
- Test every RLS policy with Admin, Member and unauthenticated sessions.
- Enable database backups appropriate to the laboratory's retention requirements.
- For sensitive regulated data, perform an institutional security/compliance review before production use.

## v1.0 additions
- Deactivated profiles are excluded by `current_lab_id()` / `current_role()`, causing normal lab RLS access to fail.
- Procurement ordering requires an Admin-approved request through `approve_request()` before `place_order()`.
- Equipment, bookings, service logs, storage locations, and samples have lab-scoped RLS.
- Cross-table lab integrity is checked for procurement items, equipment service records, storage parent locations, and sample locations.
- Confirmed equipment bookings have a database overlap exclusion constraint.
