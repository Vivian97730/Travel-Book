# Travel Book contracts

This workspace package is the shared interface between the React frontend and Supabase Edge Function.

It currently defines:

- Stable API error codes and runtime parsing.
- The active home-page DTO and runtime parsing.
- Shared mutation metadata for resource versions and UUID idempotency keys.

Add each future page contract with its vertical slice. Do not predefine speculative Database rows here, and do not expose Database rows directly to the frontend.
