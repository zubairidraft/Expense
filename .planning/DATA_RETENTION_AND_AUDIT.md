# Data Retention, Deletion & Audit Rules (Phase 0)

## 1. Soft Deletion & Recovery Windows
1. **Transactions & Transaction Lines:**
   - Handled via `deleted_at TIMESTAMPTZ DEFAULT NULL`.
   - All standard queries, analytics views, and balance snapshots MUST filter `WHERE deleted_at IS NULL`.
   - **Undo Window:** 30-day soft-delete grace window allows immediate user restoration without data loss.
   - **Hard Purge:** Soft-deleted transactions older than 90 days are permanently purged via a scheduled `pg_cron` cleanup function.

2. **Accounts & Categories:**
   - Accounts with existing transactions CANNOT be deleted; they must be `archived_at TIMESTAMPTZ`.
   - Categories with assigned transactions cannot be hard deleted without explicit reassignment to another valid category.

---

## 2. Audit Trail & Anonymization Rules
1. **Audit Logs Structure (`audit_logs`):**
   - Tracks: `actor_user_id`, `workspace_id`, `action`, `entity_type`, `entity_id`, `before_state (jsonb)`, `after_state (jsonb)`, `created_at`.
   - Sensitive operations audited: Reconciled transactions unlocked, account credit limits edited, membership role changes, workspace transfers.

2. **Account Deletion & GDPR / Privacy Anonymization:**
   - When a user deletes their account:
     - Personal identifying data in `profiles` and `auth.users` is permanently purged.
     - In shared workspaces, the financial transactions must remain intact to preserve the ledger integrity for remaining members.
     - In `audit_logs` and historical records, the `actor_user_id` is replaced with a tombstone / anonymized hash (`00000000-0000-0000-0000-000000000000` / `ANONYMIZED_USER`).
     - Personal receipt files in Supabase Storage are securely wiped.
