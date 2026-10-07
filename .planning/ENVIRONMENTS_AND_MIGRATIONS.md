# Environments & Migration Conventions (Phase 0)

## 1. Environments
- **Development (Local):** Local Supabase CLI / Docker container with pgTAP test suite.
- **Staging:** Remote preview environment linked to GitHub PRs with isolated test database.
- **Production:** Production Supabase project with automated point-in-time recovery (PITR) and nightly snapshot verification.

---

## 2. Migration Naming Convention
All database migrations stored in `supabase/migrations/` follow the standard timestamped naming format:

```
YYYYMMDDHHMMSS_<brief_descriptive_name>.sql
```

**Examples:**
- `20261008000001_create_extensions_and_base_types.sql`
- `20261008000002_create_profiles_and_workspaces.sql`
- `20261008000003_create_ledger_and_lines.sql`

### Migration Rules:
1. Every migration must be idempotent and transactional (`BEGIN; ... COMMIT;`).
2. Every table must enable Row Level Security (`ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`).
3. Every view exposed to clients must be defined with `WITH (security_invoker = true)`.
4. Down migrations or rollbacks must be tested against clean seeds before merging to `main`.
5. No manual database schema edits in production — only migrations applied via Supabase CLI.

---

## 3. Seed Data Strategy
- `supabase/seed/`:
  - `seed_currencies.sql`: ISO 4217 currency registry with minor units.
  - `seed_categories.sql`: Standard personal, household, and business hierarchical category trees.
  - `seed_demo_workspace.sql`: 60+ realistic transactions spanning 4-6 months with `is_demo = true` tag for quick reset.
