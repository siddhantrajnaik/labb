# Deploy Labb v0.6 on feature branch

## 1. Database first
In Supabase SQL Editor, run:

`supabase/migrations/v0.6.sql`

## 2. Branch
From the repository root:

```bash
git checkout main
git pull origin main
git checkout -b feature/v0.6
```

Copy/merge the v0.6 package files into the repository, then:

```bash
git add .
git commit -m "Add v0.6 dashboard inventory detail and notification center"
git push -u origin feature/v0.6
```

## 3. Preview safely
Do not merge to `main` until the live acceptance cases in `V0.6_UPGRADE.md` pass.

## 4. Merge after acceptance

```bash
git checkout main
git pull origin main
git merge --no-ff feature/v0.6 -m "Release Labb v0.6"
git push origin main
```
