# Verification — Labb v0.5 Supabase

## Verified in the build environment

The included `verify_package.py` performs deterministic package checks for:
- required GitHub Pages and Supabase files
- JavaScript syntax
- absence of the old localStorage database
- Supabase Auth client wiring
- Realtime subscription wiring
- private Storage client wiring
- secured RPC client calls for consume/order/receive
- database tables and RLS enablement
- Admin helper/RPC functions
- database stock trigger
- database audit trigger
- Storage bucket/policies and lab path scoping
- Realtime publication configuration
- authorization role stored outside editable user metadata
- current GitHub Pages Actions workflow versions
- static HTTP serving of application assets

Result: see `VERIFICATION_RESULT.json`.

## Not verifiable without your Supabase project

A real Supabase project is required to execute PostgreSQL schema installation and prove actual runtime Auth/RLS/Storage/Realtime behavior. After connecting the project, run all cases in `VERIFICATION_CHECKLIST.md`, especially Admin vs Member permissions and cross-lab isolation.

This distinction is intentional: passing static tests does not prove hosted authorization policies until the SQL has actually been executed in Supabase and tested with real JWT sessions.
