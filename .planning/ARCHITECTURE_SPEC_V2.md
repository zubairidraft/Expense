# Universal Expense Tracker — AI Agent Implementation & Product Architecture Guide (v2.0)

**Document Version:** 2.0 (Revised Edition)  
**Target:** Production-ready, scalable expense and money-management platform for personal, household, family, freelance, and business use. Built on a correct ledger, with first-class support for shared expenses, personal debts (udhaar), installments (EMI/BNPL), liabilities, multi-currency, and offline-first mobile entry.

---

## 1. Technology Decision Matrix

| Area | Recommended Choice |
| :--- | :--- |
| **Frontend** | React + TypeScript + Vite (Installable PWA) |
| **UI** | Tailwind CSS + shadcn/ui + Lucide Icons |
| **Backend** | Supabase (PostgreSQL, Auth, Storage, Edge Functions, Realtime) |
| **Database** | PostgreSQL (`numeric` money types, ledger header + lines) |
| **Authentication** | Supabase Auth (Email, Password, Password Reset; optional Social) |
| **Authorization** | PostgreSQL Row Level Security (RLS) — including `security_invoker` views |
| **API / Server Logic** | Supabase APIs + PostgreSQL RPC + Edge Functions |
| **Scheduled Jobs [v2]** | `pg_cron` + Edge Functions (Idempotent execution) |
| **Storage** | Supabase Storage (Private buckets, short-lived signed URLs) |
| **Forms / Validation** | React Hook Form + Zod (Shared schemas in `packages/core`) |
| **Money Arithmetic (Client) [v2]** | `decimal.js` / `dinero.js` — **NEVER JS floating-point numbers** |
| **Server State / Client State** | TanStack Query / Zustand |
| **Offline [v2]** | Service Worker + IndexedDB outbox queue |
| **Tables / Charts / Dates** | TanStack Table / Recharts / `date-fns` + `date-fns-tz` |
| **AI Layer** | LLM provider via server-side functions behind a provider abstraction |
| **Testing** | Vitest (Core/Unit) + Playwright (E2E) + `pgTAP` [v2] (DB, RLS, Ledger) |
| **Monitoring / Analytics** | Sentry / PostHog |

**Handoff Rule:** Must implement in vertical slices, verify each phase, and never sacrifice financial correctness or security for visual speed.

---

## 2. Core Product Definition & Principles

### Core UX Principle
> *"Simple on the surface, powerful underneath."*  
> A basic expense takes seconds to record — even offline. Advanced business/accounting fields appear only when relevant.

### Supported Use Cases
1. **Personal Finance:** Daily expenses, cash flow, categories, merchants.
2. **Household / Family:** Shared expenses, budgets, with private accounts within shared workspaces.
3. **Roommates / Friends [v2]:** Shared bills, who-owes-whom, and settle-up.
4. **Personal Lending & Borrowing [v2]:** Udhaar tracking, partial repayments, and reminders.
5. **Installments & EMI [v2]:** Buy-now-pay-later (BNPL), interest/markup, schedules.
6. **Freelancers & Contractors:** Income by client, project cost centers, tax helpers.
7. **Small & Project-Based Businesses:** Reimbursements, cost centers, clients, projects.
8. **Account Types:** Cash, bank accounts, **credit cards and loans as liabilities [v2]**, wallets/e-wallets (JazzCash, Easypaisa, etc.).
9. **Multi-Currency:** Spending and reporting in PKR, AED, USD, GBP, AUD, etc.
10. **Data Capture:** Receipt OCR, CSV/PDF statement imports, **bank SMS parsing [v2]**.

### Non-Negotiable Product Principles
- **PostgreSQL is the source of truth.**
- **Never rely on frontend calculations** for authoritative balances.
- **Transfers are NEVER income or expenses** (including credit-card payments and goal contributions).
- **Original currency and original amount must always be preserved.**
- **Money stored as `numeric`** (or integer minor units) — never floating point in DB or client.
- **Idempotent writes [v2]:** Every write that moves money requires a client-generated `idempotency_key`.
- **AI must never have unrestricted DB access:** Whitelisted, workspace-scoped tools only; AI never writes directly.
- **Tenant Isolation:** Protected by RLS on every table and security checks in every RPC/view.
- **UX States:** Every major feature requires Loading, Empty, Error, and Success states.
- **Financial actions require confirmation & auditability.**

---

## 3. Recommended Project Structure

```
apps/web/src/
  components/    ui/ charts/ transactions/ accounts/ budgets/ analytics/ shared-expenses/ debts/
  pages/         overview/ transactions/ accounts/ budgets/ recurring/ bills/ analytics/ goals/
                 shared/ debts/ reports/ settings/
  hooks/ lib/ services/ stores/ offline/
packages/core/   # [v2] Framework-free pure TypeScript (reusable for future React Native mobile app)
  money/ schemas/ types/ ledger-rules/ recurrence/ parsers/ (sms, csv, statement)
supabase/
  migrations/    tests/ (pgTAP) seed/
  functions/     recurring/ fx-rates/ imports/ ocr/ sms-parse/ notifications/ reports/ ai/
```

---

## 4. Database Schema & Data Model

### Core Entity Relationships
`User` → `Profile` → `Workspace` → `Accounts` → `Transactions` → `Transaction Lines`  
Connected to: Categories, Merchants, Tags, Budgets, Goals, Recurring Series, Contacts, Shared Expenses, Debts, Installment Plans, Projects, Clients, Attachments.

### Table Definitions & Key Fields
1. **`profiles`**: `user_id`, `full_name`, `default_currency`, `locale`, `number_format` (lakh/intl), `theme`
2. **`workspaces`**: `name`, `type`, `base_currency`, `owner_id`, `timezone` [v2], `month_start_day`, `budgeting_style`
3. **`workspace_members`**: `workspace_id`, `user_id`, `role` (owner|admin|manager|member|viewer), `status`
4. **`currencies` [v2]**: `code`, `minor_units` (0/2/3), `symbol`, `active`
5. **`accounts`**: `name`, `type`, `nature` [v2] (`asset`|`liability`), `currency`, `opening_balance`, `opening_date`, `credit_limit`, `visibility` [v2] (`shared`|`private`), `owner_member_id`, `archived_at`
6. **`transactions`**: `type`, `date` (DATE), `status` [v2] (`pending`|`cleared`|`reconciled`), `merchant_id`, `payee_contact_id`, `notes`, `idempotency_key` [v2], `version`, `source` (`manual`|`recurring`|`import`|`sms`|`ai`|`ocr`), `deleted_at`
7. **`transaction_lines` [v2]**: `transaction_id`, `account_id`, `category_id`, `direction` (`in`|`out`), `amount` (`numeric(19,4)`), `currency`, `fx_rate` (`numeric(20,10)`), `base_amount`, `project_id`, `cost_center_id`, `member_id`, `billable`, `reimbursable`, `tax_amount`
8. **`categories`**: `name`, `parent_id`, `kind` (`income`|`expense`), `essential` flag, `icon`, `color`, `system_key`
9. **`tags` / `transaction_tags`**: `name`, `workspace_id` / `transaction_id`, `tag_id`
10. **`merchants`**: `name`, `aliases[]`, `default_category_id`, `logo_url`
11. **`rules` [v2]**: `conditions` (jsonb), `actions` (jsonb), `priority`, `active`
12. **`recurring_series`**: `rrule`, `anchor_date`, `end_date`, `template` (jsonb), `next_run`, `status`
13. **`recurring_occurrences` [v2]**: `series_id`, `occurrence_date` `UNIQUE(series_id, occurrence_date)`, `transaction_id`, `status`
14. **`budgets` / `budget_lines`**: `period`, `start`, `rollover`, `threshold`, `scope`, `amount`
15. **`goals` / `goal_contributions`**: `target_amount`, `target_date`, `linked_account_id` / `goal_id`, `transaction_id` (progress is derived)
16. **`contacts` [v2]**: `name`, `phone`, `linked_user_id` (optional)
17. **`shared_expenses` / `expense_shares` [v2]**: `transaction_id`, `split_method` (`equal`|`exact`|`percent`|`shares`), `contact_or_member`, `share_amount`
18. **`settlements` [v2]**: `from_party`, `to_party`, `amount`, `currency`, `transaction_id`
19. **`debts` / `debt_events` [v2]**: `contact_id`, `direction` (`lent`|`borrowed`), `principal`, `due_date` / `event` (`disburse`|`repay`|`forgive`), `amount`
20. **`installment_plans` [v2]**: `liability_account_id`, `principal`, `installments`, `interest/markup`, `schedule`
21. **`clients` / `projects` / `cost_centers`**: Contact data, `status`, `client_id`, `budget`, `dates`, `code`, `active`
22. **`attachments`**: `transaction_id`, `storage_path`, `mime_type`, `ocr_status`, `ocr_payload`
23. **`exchange_rates`**: `base`, `quote`, `rate`, `effective_date`, `source` [v2]
24. **`balance_snapshots` [v2]**: `account_id`, `as_of_date`, `balance`, `line_count`, `checksum`
25. **`import_batches` / `import_rows` [v2]**: `source` (`csv`|`pdf`|`ofx`|`sms`), `mapping`, `status`, `raw`, `parsed`, `dedupe_hash`, `result`
26. **`notifications`**: `type`, `payload`, `read_at`
27. **`plans` / `entitlements` / `ai_usage` [v2]**: `plan`, `features`, `limits`, `period`, `tokens`, `cost`
28. **`audit_logs`**: `actor`, `action`, `entity`, `entity_id`, `before`, `after`, `at`

---

## 5. Financial Ledger Engine Rules

### Transaction Types
`expense` · `income` · `transfer` · `refund` · `adjustment` · `debt` (lend/borrow/repay) [v2] · `settlement` · `opening`

### Mathematical Formulas
- **Asset Balance:**  
  $$\text{Asset Balance} = \text{opening\_balance} + \sum(\text{lines in}) - \sum(\text{lines out})$$
- **Liability Balance:**  
  $$\text{Liability Balance} = \text{opening\_balance} + \sum(\text{charges}) - \sum(\text{payments/refunds})$$
- **Net Worth:**  
  $$\text{Net Worth} = \sum(\text{Asset Balances in Base}) - \sum(\text{Liability Balances in Base})$$
- **Refund:** `'in'` line on original account + category; reduces category spend.
- **Adjustment:** Explicit direction + reason; excluded from income/expense analytics.

### Transfer Rule
- Exactly one `out` line on source account and one `in` line on destination account (`Source ≠ Destination`).
- **Cross-currency [v2]:** Stores each side in its own currency (e.g. 1,000 AED out, 75,800 PKR in) with implied rate recorded.
- **Fees [v2]:** Booked as a 3rd line as an expense (Category: Bank Fees).
- Transfers, settlements, and goal contributions are **excluded from income/expense totals**.

### Money Representation & Precision
- **SQL:** `numeric(19,4)` for money, `numeric(20,10)` for FX rates.
- **Rounding:** Half-even (banker's) rounding applied once at line level according to `currency.minor_units`.
- **Client:** Arithmetic via `decimal.js`/`dinero.js`. JSON values travel as strings, never JS numbers.
- **Display:** Supports international (`1,250,000`) and South-Asian (`12,50,000`) formatting.

### Concurrency, Dates & Soft Deletion
- `transaction.date` is a `DATE` in workspace timezone. `created_at`/`updated_at` are `timestamptz`.
- Idempotency enforced via `UNIQUE(workspace_id, idempotency_key)` on `transactions`.
- Optimistic locking via `version` column.
- Soft delete only (`deleted_at`) with undo grace window.
- Reconciled transactions are locked; explicit unlock requires auditing.

---

## 6. Phased Implementation Roadmap (28 Vertical Slices)

### STAGE A — FOUNDATION
- **Phase 0:** Product & Architecture Foundation (Permissions matrix, financial formulas, `packages/core`).
- **Phase 1:** Backend Infrastructure (Supabase, PostgreSQL, `pg_cron`, `pgTAP` in CI).
- **Phase 2:** Authentication & Profiles (Auth flow, user profiles, locale, currency).
- **Phase 3:** Workspaces, Membership & Permissions (Roles: owner, admin, manager, member, viewer; isolation tests).
- **Phase 4:** App Shell & Design System (Tailwind + shadcn/ui + Lucide, responsive shell, money inputs/displays, PWA skeleton).

### STAGE B — LEDGER CORE
- **Phase 5:** Accounts (Asset & liability nature, opening balance, running balances).
- **Phase 6:** Categories, Tags & Merchants (Hierarchical categories, essential flags, seed catalog).
- **Phase 7:** Transaction Ledger (Header + lines, splits, transfers, DB triggers, `balance_snapshots`).
- **Phase 8:** Quick Add & Offline (<10 sec UX, IndexedDB outbox queue, background sync).
- **Phase 9:** Rules Engine & Reconciliation (Deterministic rules before AI, statement reconciliation flow).

### STAGE C — PLANNING FEATURES
- **Phase 10:** Receipts, Attachments & OCR (Private signed bucket, OCR extraction into drafts).
- **Phase 11:** Recurring, Subscriptions & Bills Calendar (RRULE recurrence, cash-flow projections).
- **Phase 12:** Budgets (Limit-based & zero-based envelope budgeting, rollover).
- **Phase 13:** Goals (Target tracking, derived progress from transfer allocations).

### STAGE D — PEOPLE & OBLIGATIONS
- **Phase 14:** Shared Expenses, Debts & Installments (Split bills, debt simplification, udhaar, EMI/BNPL schedules).
- **Phase 15:** Business & Household Modules (Clients, projects, cost centers, VAT/tax, private accounts in shared spaces).

### STAGE E — DATA IN & OUT
- **Phase 16:** Multi-Currency Services (FX rate scheduled service, historical rates).
- **Phase 17:** Import & Export (CSV, OFX, PDF bank statements, SMS parsing for HBL, Meezan, JazzCash, Easypaisa, UAE banks).

### STAGE F — INSIGHT
- **Phase 18:** Analytics Data Layer (`security_invoker = true` views, indexing).
- **Phase 19:** Smart Analytics & Forecasting (Unusual spending, cash-flow forecasts, spending velocity).
- **Phase 20:** Reports (Print/PDF friendly, tax/VAT statements, export).
- **Phase 21:** Notifications (Thresholds, upcoming bills, in-app notifications).
- **Phase 22:** Regional Features (Zakat calculator, Urdu/Arabic RTL, lakh/crore formatting, freelancer taxes).

### STAGE G — INTELLIGENCE, BUSINESS & LAUNCH
- **Phase 23:** AI Layer (Server-side provider abstraction, prompt-injection defense, natural language drafting).
- **Phase 24:** Monetization (Free/Pro/Business entitlements enforced server-side).
- **Phase 25:** Security & Privacy (Full RLS audit, data export, account deletion anonymization).
- **Phase 26:** Testing & Quality (Vitest, pgTAP, Playwright end-to-end tests).
- **Phase 27:** Performance, Monitoring & Production (Query optimization, caching, Sentry, PostHog, backups).

---

## 7. AI Agent Execution Rules (1 - 19)

1. Read the document completely before making architectural changes.
2. Implement one phase at a time as a vertical slice (database + server + UI + tests).
3. Inspect current project/database state before each phase and reuse correct work.
4. Never destroy working features to implement a new feature.
5. Use migrations for every schema change; no undocumented DB changes.
6. Verify constraints, indexes, RLS policies, view `security_invoker`, and RPC checks after every DB change.
7. Add/update unit and `pgTAP` tests for financial formulas after every financial change.
8. Keep financial calculations server/database side; frontend is for presentation.
9. **Never use floating-point numbers for money.** Use `numeric` in SQL and `decimal.js`/`dinero.js` in TypeScript.
10. Every money-creating write carries an `idempotency_key`; every update carries a `version`.
11. Do not introduce a second database without documented architectural reasoning.
12. Place business logic in `packages/core`.
13. Do not hard-code dashboard totals or chart data; use real queries/functions.
14. Do not allow AI/OCR/SMS to silently create transactions; always require user confirmation.
15. Maintain workspace isolation and private-account rules at all times.
16. Mark incomplete features clearly; never mock fake functionality.
17. Verify desktop, mobile, and offline behavior for every phase.
18. Report at the end of each phase: implemented items, DB changes, security changes, tests, limitations, next phase.
19. Perform a full security and financial-correctness review before production.
