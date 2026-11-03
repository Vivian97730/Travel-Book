# Supabase foundation

This directory contains the Travel Book Edge Function, reproducible database migrations, seed data, and database tests.

The migrations create a private application schema, the stage 1 access tables, resource versions, token verification/reset/revocation functions, and browser-role restrictions. Raw private tokens are never stored in the database.

Local commands after installing the Supabase CLI:

```bash
supabase start
supabase db reset
supabase test db
supabase functions serve travel-book-api --no-verify-jwt
```

`verify_jwt` is disabled because Travel Book does not use Supabase Auth. Shared routes must validate the high-entropy private trip token inside `travel-book-api` before accessing data.

## Hosted project connection

Do not paste an access token, database password, secret key, or private trip link into source files or chat. Authenticate the CLI through its browser login, then link with the non-secret project reference:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push --dry-run --remote
supabase db push --remote
supabase functions deploy travel-book-api --no-verify-jwt --use-api --remote=<project-ref>
```

Supabase injects `SUPABASE_URL` and hosted secret-key variables into Edge Functions. Set only `ALLOWED_ORIGINS` as an additional Edge Function secret when the default origins are not sufficient. GitHub Pages receives only the public `VITE_API_BASE_URL` value.

After the migrations are applied, create or reset the single private link from the Supabase SQL Editor while signed in as the project owner:

```sql
select public.reset_trip_access_token('11111111-1111-4111-8111-111111111111');
```

The function returns a new URL-safe token once and immediately revokes the previous token. Copy it directly into `https://vivian97730.github.io/Travel-Book/#/access/<token>` without saving it in source control, documentation, screenshots, or chat.

Before pushing migrations to a project that already contains manually-created tables, run `supabase db pull --remote` and review the generated migration first. Never use `supabase db reset --remote` on the hosted project.
