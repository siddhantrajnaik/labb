# Supabase project connection

Configured project URL:

`https://hsxwsutqpsvrueuohahr.supabase.co`

## Still required

Set `SUPABASE_PUBLISHABLE_KEY` in `config.js` to the project's browser-safe **publishable key** (or legacy anon key).

Do not place any `service_role`, `sb_secret_...`, or other secret key in this GitHub Pages repository.

After the publishable key is configured:
1. Run `supabase/schema.sql` in the Supabase SQL editor.
2. Bootstrap the first admin using `supabase/bootstrap_first_admin.sql` as documented in `SUPABASE_SETUP.md`.
3. Deploy the repository to GitHub Pages.
4. Run the live checks in `VERIFICATION_CHECKLIST.md`.
