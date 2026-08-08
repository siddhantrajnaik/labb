# Publish Labb v1.0 final

Recommended safe release flow:

```bash
git checkout main
git pull origin main
git checkout -b release/v1.0
# copy the contents of Labb_v1.0_Final into the repository root
git add .
git commit -m "Release Labb v1.0 final laboratory operations platform"
git push -u origin release/v1.0
```

Apply `supabase/migrations/v1.0.sql`, redeploy the `invite-user` Edge Function, then run `FINAL_ACCEPTANCE_CHECKLIST.md` against the release deployment. Merge to `main` only after those live checks pass.
