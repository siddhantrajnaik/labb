# Supabase setup — Labb v1.0

## Existing deployed Labb database
Run `supabase/migrations/v1.0.sql` in the Supabase SQL Editor. This assumes the existing v0.6 database is already installed.

Redeploy the `invite-user` Edge Function after migration:

```bash
supabase login
supabase link --project-ref hsxwsutqpsvrueuohahr
supabase functions deploy invite-user
```

Keep the GitHub Pages URL in Supabase Authentication Site URL / Redirect URLs:

`https://siddhantrajnaik.github.io/labb/`

Then run `FINAL_ACCEPTANCE_CHECKLIST.md`.

## New blank Supabase project
Run `supabase/schema.sql`, create the first Auth user, replace `REPLACE_WITH_AUTH_USER_UUID` in `supabase/bootstrap_first_admin.sql`, and run the bootstrap SQL. Optionally run `supabase/seed_demo.sql`.

## Security
The browser uses only the project URL and publishable key. Privileged Auth administration stays in Supabase Edge Functions; secret/service-role credentials must never be copied into the frontend repository.
