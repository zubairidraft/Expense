# Workspace Roles & Permission Matrix (Phase 0)

## 1. Workspace Roles
A user belongs to a workspace with one of five standardized roles:

| Role | Description |
| :--- | :--- |
| **Owner** | The workspace creator/owner. Unrestricted administrative, financial, billing, and deletion authority. Cannot be removed from own workspace. |
| **Admin** | Senior collaborator. Full management of accounts, members, budgets, categories, and transactions. Cannot delete workspace or manage ownership billing. |
| **Manager** | Operational lead. Can create/edit transactions, accounts, rules, and categories. Cannot manage members or sensitive workspace settings. |
| **Member** | Regular participant (e.g. household family member or team member). Can create and manage own transactions; read shared accounts and categories. |
| **Viewer** | Read-only collaborator (e.g. accountant, auditor, or advisor). Can view reports, transactions, and dashboards without modification rights. |

---

## 2. Resource × Action × Role Matrix

| Resource | Action | Owner | Admin | Manager | Member | Viewer |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Workspace** | `create` / `delete` | ✅ | ❌ | ❌ | ❌ | ❌ |
| | `update` / `invite` | ✅ | ✅ | ❌ | ❌ | ❌ |
| | `read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `manage_billing` | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Members** | `manage_members` | ✅ | ✅ | ❌ | ❌ | ❌ |
| | `read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Accounts** | `create` / `update` / `delete` | ✅ | ✅ | ✅ | ❌ | ❌ |
| | `read` (shared accounts) | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `read` / `write` (private accounts) | Owner Only* | ❌ | ❌ | Owner-Member Only | ❌ |
| | `reconcile` | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Transactions** | `create` / `update` | ✅ | ✅ | ✅ | ✅ | ❌ |
| | `delete` (soft delete) | ✅ | ✅ | ✅ | ✅ (Own) | ❌ |
| | `read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| | `reconcile` (lock/unlock) | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Categories & Rules** | `create` / `update` / `delete` | ✅ | ✅ | ✅ | ❌ | ❌ |
| | `read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Budgets & Goals** | `create` / `update` / `delete` | ✅ | ✅ | ✅ | ❌ | ❌ |
| | `read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Debts & Shared Exp.**| `create` / `update` | ✅ | ✅ | ✅ | ✅ | ❌ |
| | `read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Reports** | `read` / `export` | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Audit Logs** | `read` / `export` | ✅ | ✅ (Read) | ❌ | ❌ | ❌ |

*\*Private accounts in shared workspaces: A private account is only visible to and writable by its `owner_member_id` (plus workspace owner if specifically configured in workspace privacy settings).*
