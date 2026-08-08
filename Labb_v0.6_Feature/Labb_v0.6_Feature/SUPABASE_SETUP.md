# Supabase setup

## 1. Create project
Create a Supabase project and keep the database password somewhere secure.

## 2. Install database schema
Open Supabase → SQL Editor and execute:

`supabase/schema.sql`

The schema enables Row Level Security on every application table exposed to the browser.

## 3. Create first administrator
In Supabase → Authentication → Users, create or invite your first user. Copy the user's UUID.

Open `supabase/bootstrap_first_admin.sql`, replace:

`REPLACE_WITH_AUTH_USER_UUID`

with that UUID and run the SQL.

This creates the initial laboratory and maps the Auth user to an `admin` profile.

## 4. Optional demo records
Run `supabase/seed_demo.sql` after the first lab exists.

## 5. Configure browser client
Copy `config.example.js` to `config.js` and paste the project's URL and **publishable** key.

Do not use a secret/service-role key.

## 6. Auth URLs
In Authentication URL settings:
- set the Site URL to the production GitHub Pages URL when appropriate
- add the production GitHub Pages URL to Redirect URLs

This is required for invitation/password-recovery links that redirect back to the app.

## 7. Optional Admin user invitations
The frontend has an Admin “Invite user” control. It requires the Edge Function:

`supabase/functions/invite-user/index.ts`

Deploy with the Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy invite-user
```

The function verifies the caller is an Admin profile before using a server-side secret key to invoke the Supabase Auth Admin API. The secret key remains inside Supabase and is never sent to GitHub Pages.

## 8. Storage
`schema.sql` creates a private bucket named `labb-documents` and RLS policies. Files are stored under paths beginning with the user's `lab_id`, for example:

`<lab-uuid>/inventory/42/<uuid>-sds.pdf`

The application uses short-lived signed URLs for downloads.

## 9. Realtime
`schema.sql` adds inventory, container, vendor, procurement, usage and attachment tables to the `supabase_realtime` publication. The browser subscribes to its lab and refreshes when records change.
