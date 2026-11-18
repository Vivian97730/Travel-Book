# Supabase foundation

This directory contains the Travel Book Edge Function, reproducible database migrations, seed data, and database tests.

The migrations create a private application schema, the stage 1 access tables, resource versions, token verification/reset/revocation functions, and browser-role restrictions. Raw private tokens are never stored in the database.

Local commands after installing the Supabase CLI and Docker／Podman:

```bash
supabase start
supabase db reset
supabase test db
supabase functions serve travel-book-api --no-verify-jwt
```

## Database tests from Codex

The Codex desktop environment used for this project does not provide Docker or Podman. Do not try `supabase start`, `supabase db reset`, or `supabase test db` there before testing the linked project; those commands will fail while trying to start a local stack or test runner.

Run the pgTAP files directly against the linked hosted project instead. Every test file opens a transaction and rolls it back, so test data is not persisted:

```bash
supabase db query --file supabase/tests/private_schema_test.sql --remote --yes
supabase db query --file supabase/tests/access_foundation_test.sql --remote --yes
supabase db query --file supabase/tests/itinerary_read_model_test.sql --remote --yes
```

When another database test file is added, execute it with the same `supabase db query --file <path> --remote --yes` form. Confirm the target is the linked Travel Book project before proceeding, and report each file's final pgTAP assertion count.

`verify_jwt` is disabled because Travel Book does not use Supabase Auth. Shared routes must validate the high-entropy private trip token inside `travel-book-api` before accessing data.

## Stay photo cleanup

Apply `20261118010000_stay_photo_cleanup.sql` before deploying the updated Edge Function and frontend. The stay transaction queues replaced/removed photos; after commit the API claims unreferenced photos, deletes them through Storage, and marks cleanup complete. Claims share the stay mutation lock and fence late attachments. Referenced/shared photos are never claimed. Failed deletes remain queued and are retried after subsequent successful stay mutations (up to 20 per request); they do not turn a committed save into a failure.

`DELETE /v1/stay-photos/{id}` uses the verified trip and returns `{ removed: boolean }` for failed-save compensation. Ambiguous mutation failures retain their original photo ID and idempotency key rather than deleting a possibly committed photo. The database regression is `supabase/tests/stay_photo_cleanup_test.sql` (one TAP result containing transaction assertions).

There is no scheduled full-bucket collector. Interrupted uploads, abandoned ambiguous saves, revoked links, and trip-level deletion can still require an operator inventory. Do not delete `storage.objects` rows directly or remove the cleanup deletion fences. To retry queued work, use the same claim → Storage delete → completion sequence; never mark completion when Storage deletion failed.

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
