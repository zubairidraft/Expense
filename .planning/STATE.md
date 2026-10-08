# Project State: Universal Expense Tracker (v2.0)

**Current Stage:** Stage B — Ledger Core  
**Completed Phases:**
- **Phase 0 — Product & Architecture Foundation (Complete & Verified)**
- **Phase 1 — Backend Infrastructure (Complete & Verified)**
- **Phase 2 — Authentication & Profiles (Complete & Verified)**
- **Phase 3 — Workspaces, Membership & Permissions (Complete & Verified)**
- **Phase 4 — App Shell & Design System (Complete & Verified)**
- **Phase 5 — Accounts (Complete & Verified)**
- **Phase 6 — Categories, Tags & Merchants (Complete & Verified)**

**Next Phase:** **Phase 7 — Transaction Ledger (Header + lines model, splits, transfers, triggers)**

---

### Phase 6 Deliverables Verified:
- [x] Database Migration applied to live Supabase (`nmbxopltqeilhzplwcgs`):
  - Created `public.categories` table with hierarchical parents, `kind IN ('income', 'expense')`, `is_essential` flag (50/30/20 Needs vs Wants), and system seed categories (`workspace_id = NULL`).
  - Created `public.tags` table with workspace isolation and unique names per workspace.
  - Created `public.merchants` table with statement aliases array (`aliases TEXT[]`), default category pointers, and logo support.
  - Multi-tenant RLS policies on `categories`, `tags`, and `merchants` ensuring workspace isolation and role-based manager edit capabilities.
  - pgTAP test suite created: `supabase/tests/05_categories_and_merchants.test.sql`.
- [x] Core Domain Types & Schemas extended:
  - `Category`, `Tag`, `Merchant`, and `CategoryKind` types added in `packages/core/src/types/index.ts`.
  - `CategoryCreateSchema`, `CategoryUpdateSchema`, `TagCreateSchema`, and `MerchantCreateSchema` in `packages/core/src/schemas/index.ts`.
  - Vitest test suite `packages/core/tests/categories-and-merchants.test.ts` (all 31/31 tests passing).
- [x] Frontend Catalog System:
  - `src/context/CategoryContext.jsx` handling real-time categories, tags, and merchants with offline/guest fallback.
  - `src/components/categories/CategoriesView.jsx` featuring dual-column Needs vs Wants layout, income streams, merchant directory with aliases, and tag cloud.
  - Modals: `CreateCategoryModal.jsx`, `CreateMerchantModal.jsx`, and `CreateTagModal.jsx`.
  - App shell navigation updated with `Categories & Tags` (`🏷️`) tab in `Sidebar.jsx`.
- [x] Quality & Verification:
  - Production build clean verification passed (`npm.cmd run build`).
  - Vitest test suite in `packages/core` (31/31 passed).
