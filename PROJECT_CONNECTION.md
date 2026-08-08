# Production connection

- GitHub repository: `https://github.com/siddhantrajnaik/labb.git`
- GitHub Pages: `https://siddhantrajnaik.github.io/labb/`
- Supabase project: `https://hsxwsutqpsvrueuohahr.supabase.co`
- Browser publishable key: configured in `config.js`

This release is already project-specific. Do not place any `sb_secret_...`, service-role key, database password, or JWT signing secret in the repository.

For the existing deployment, run `supabase/migrations/v1.0.sql` before deploying the v1.0 frontend. For a new blank Supabase project, use the integrated `supabase/schema.sql` instead.
