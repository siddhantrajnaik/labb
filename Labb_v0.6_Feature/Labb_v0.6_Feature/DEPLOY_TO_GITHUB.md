# Deploy Labb to GitHub Pages

1. Create a GitHub repository, for example `labb`.
2. Copy the contents of this folder to the repository root.
3. Configure `config.js` with the Supabase project URL and publishable key.
4. Commit and push to `main`.
5. In GitHub: Settings → Pages → Build and deployment → Source → **GitHub Actions**.
6. Open Actions and wait for “Deploy Labb to GitHub Pages” to complete.
7. Open the Pages URL.
8. Add that final URL to Supabase Authentication redirect URLs.

The included workflow uses GitHub's current Pages actions and deploys the repository as a static site.

## Repository visibility
Remember that `config.js` is publicly downloadable from a public Pages site. This is expected for the publishable key. Security must come from Supabase RLS. Never commit a secret/service-role key.
