# Supabase local foundation

This directory contains the Travel Book Edge Function, reproducible database migrations, seed data, and database tests.

The first migration creates the private application schema and removes browser-role access. Business tables are introduced only with their corresponding vertical slice.

Local commands after installing the Supabase CLI:

```bash
supabase start
supabase db reset
supabase test db
supabase functions serve travel-book-api --no-verify-jwt
```

`verify_jwt` is disabled because Travel Book does not use Supabase Auth. Shared routes must validate the high-entropy private trip token inside `travel-book-api` before accessing data.
