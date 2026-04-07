# Release Checklist

## Environment and secrets

- `SUPABASE_URL` configured
- `SUPABASE_PUBLISHABLE_KEY` configured in client env
- `SUPABASE_SECRET_KEY` configured server-side only
- `SUPABASE_DB_URL` configured for migration/seed tooling

## Database

- `supabase db push` successful
- `supabase/seed.sql` applied in target environment
- `supabase/tests/query_plans.sql` executed and slow paths reviewed
- RLS policies migration applied (`202604080001_rls_policies.sql`)
- Warehouse tenancy + import RPC migration applied (`202604090001_warehouse_tenancy_import_rpc.sql`)

## Security

- Verify service/secret key not exposed in frontend bundles
- Validate manager/admin role mapping in `public.users`
- Validate policy behavior with authenticated and anonymous sessions

## Quality gates

- Unit tests pass (`npm test`)
- Manual smoke path:
  - login
  - create staff
  - create penalty definition
  - apply penalty
  - revoke penalty
  - upload/import sample CSV

## Operations

- Backup plan confirmed (Supabase PITR/backups)
- Alerts configured for API/db latency and error spikes
- Dashboard query latency baseline captured
