# Final upgrade sequence

1. Keep `main` at the last known-good deployment until acceptance passes.
2. Apply `supabase/migrations/v1.0.sql` to the configured Supabase project.
3. Redeploy the `invite-user` Edge Function.
4. Deploy the v1.0 frontend to a release branch or merge after review.
5. Verify Admin and Member sessions separately.
6. Verify cross-lab isolation before production use.

The v1.0 migration is additive to v0.6. It changes procurement ordering so a request must be **Approved** before `place_order()` succeeds.
