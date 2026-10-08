# Product Roadmap: Universal Expense Tracker (v2.0)

Architecture Specification: `.planning/ARCHITECTURE_SPEC_V2.md`
Delivery Model: Vertical Slices (Database + Server Logic + UI + Tests together per phase)

---

### STAGE A — FOUNDATION
- [x] **Phase 0: Product & Architecture Foundation**
  - Scope, workspace types, roles, permission matrix (role × action × resource)
  - Financial semantics, sign conventions, currency precision
  - Set up `packages/core` with shared types, Zod schemas, money utilities
- [x] **Phase 1: Backend Infrastructure**
  - Supabase, PostgreSQL, Auth, Storage, Edge Functions
  - Enable `pg_cron`, set up `pgTAP` test harness in CI
  - Migrations, seed scripts, secrets
- [x] **Phase 2: Authentication & Profiles**
  - Sign-up, login, logout, password reset
  - Profiles: currency, locale, number format (lakh/intl), date format, theme
- [x] **Phase 3: Workspaces, Membership & Permissions**
  - Personal, household, business workspaces; create, switch, archive
  - Roles (owner/admin/manager/member/viewer)
  - Workspace timezone, base currency, `month_start_day`
  - pgTAP cross-workspace isolation tests
- [x] **Phase 4: App Shell & Design System**
  - Tailwind CSS + shadcn/ui + Lucide
  - Responsive shell, sidebar, mobile bottom navigation, workspace switcher
  - Money input and money display components
  - PWA manifest and service worker skeleton

---

### STAGE B — LEDGER CORE
- [x] **Phase 5: Accounts**
  - Bank, cash, card, savings, wallet, e-wallet, investment, loan, BNPL (Asset vs Liability nature)
  - Opening balance, opening date, currency, credit limit, visibility (shared/private)
  - Account list and detail view with running balances
- [x] **Phase 6: Categories, Tags & Merchants**
  - Hierarchical categories with essential/discretionary flags
  - Seed catalog (personal, household, business)
  - Merchants with aliases, tags

- [x] **Phase 7: Transaction Ledger**
  - Header + lines model; expense, income, transfer, refund, adjustment
  - Split transactions, cross-currency transfers, transfer fees
  - Idempotency triggers, balance snapshots
  - Transaction table with filters, pagination, drawer

- [x] **Phase 8: Quick Add & Offline**
  - Sub-10 second entry from any page
  - IndexedDB offline outbox queue with idempotency sync

- [x] **Phase 9: Rules Engine & Reconciliation**
  - Deterministic auto-categorization rules (run before AI)
  - Statement reconciliation flow, lock reconciled items

---

### STAGE C — PLANNING FEATURES
- [ ] **Phase 10: Receipts, Attachments & OCR**
  - Private storage bucket, signed URLs
  - OCR extraction into draft transactions for confirmation
- [ ] **Phase 11: Recurring, Subscriptions & Bills Calendar**
  - RRULE recurrence, idempotent `pg_cron` occurrences
  - 30/60/90-day cash flow projection with low-balance warnings
- [ ] **Phase 12: Budgets**
  - Limit-based and envelope / zero-based budgeting
  - Rollover, threshold alerts
- [ ] **Phase 13: Goals**
  - Savings, emergency fund, debt-payoff goals
  - Progress derived from transfer allocations

---

### STAGE D — PEOPLE & OBLIGATIONS
- [ ] **Phase 14: Shared Expenses, Debts & Installments**
  - Shared expenses (split equal, exact, percent, shares)
  - Settle-up debt simplification
  - Personal lending/borrowing (udhaar) with reminders
  - Installment/EMI/BNPL plans with repayment schedules
- [ ] **Phase 15: Business & Household Modules**
  - Projects, clients, cost centers, tax/VAT, billable/reimbursable
  - Member attribution, private accounts in shared spaces

---

### STAGE E — DATA IN & OUT
- [ ] **Phase 16: Multi-Currency Services**
  - Scheduled FX rates, provider fallbacks, historical rates
- [ ] **Phase 17: Import & Export**
  - CSV, OFX/QIF, PDF bank statements
  - SMS parsing (HBL, Meezan, UBL, JazzCash, Easypaisa, UAE banks)
  - JSON and CSV full export

---

### STAGE F — INSIGHT
- [ ] **Phase 18: Analytics Data Layer**
  - `security_invoker = true` views for spending, net worth, cash flow
- [ ] **Phase 19: Smart Analytics & Forecasting**
  - Anomaly detection, spending velocity, cash flow forecasting
- [ ] **Phase 20: Reports**
  - PDF/print reports, tax summaries, business expense statements
- [ ] **Phase 21: Notifications**
  - In-app notification center, budget alerts, debt reminders
- [ ] **Phase 22: Regional Features**
  - Zakat calculator (assets, liabilities, nisab, hawl)
  - Urdu & Arabic RTL UI, lakh/crore number formatting

---

### STAGE G — INTELLIGENCE, BUSINESS & LAUNCH
- [ ] **Phase 23: AI Layer**
  - Provider abstraction, natural-language transaction drafting
  - Prompt-injection safety, controlled analytics tools only
- [ ] **Phase 24: Monetization**
  - Free, Pro, Business tiers enforced server-side
- [ ] **Phase 25: Security & Privacy**
  - Complete RLS audit, session limits, account deletion anonymization
- [ ] **Phase 26: Testing & Quality**
  - Vitest, pgTAP, Playwright end-to-end tests
- [ ] **Phase 27: Performance, Monitoring & Production Launch**
  - Query optimization, caching, Sentry, PostHog, backup procedures
