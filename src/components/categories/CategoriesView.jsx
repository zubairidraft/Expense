import { useState } from 'react';
import { useCategories } from '../../context/CategoryContext';
import StatCard from '../ui/StatCard';

export default function CategoriesView({
  onOpenCreateCategory,
  onOpenCreateMerchant,
  onOpenCreateTag,
}) {
  const {
    categories,
    tags,
    merchants,
    expenseCategories,
    incomeCategories,
    needsCategories,
    wantsCategories,
    archiveCategory,
    deleteTag,
    deleteMerchant,
  } = useCategories();

  const [activeTab, setActiveTab] = useState('expense'); // 'expense' | 'income' | 'merchants' | 'tags'
  const [searchQuery, setSearchQuery] = useState('');

  const handleDeleteCategory = (e, cat) => {
    e.stopPropagation();
    if (!cat.workspace_id) {
      alert('System standard categories cannot be deleted.');
      return;
    }
    if (window.confirm(`Archive category "${cat.name}"?`)) {
      archiveCategory(cat.id);
    }
  };

  const handleDeleteTag = (e, tag) => {
    e.stopPropagation();
    if (window.confirm(`Delete tag "${tag.name}"?`)) {
      deleteTag(tag.id);
    }
  };

  const handleDeleteMerchant = (e, merch) => {
    e.stopPropagation();
    if (window.confirm(`Remove merchant "${merch.name}"?`)) {
      deleteMerchant(merch.id);
    }
  };

  const filteredMerchants = merchants.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchesName = m.name.toLowerCase().includes(q);
    const matchesAlias = m.aliases?.some((a) => a.toLowerCase().includes(q));
    return matchesName || matchesAlias;
  });

  return (
    <div className="categories-view-container">
      {/* Top Stat Summary */}
      <section className="stats-grid" aria-label="Catalog Summary">
        <StatCard
          title="Expense Categories"
          icon="📦"
          variant="expense"
          value={expenseCategories.length}
          meta={`${needsCategories.length} Needs (50%) · ${wantsCategories.length} Wants (30%)`}
        />

        <StatCard
          title="Income Streams"
          icon="⚡"
          variant="income"
          value={incomeCategories.length}
          meta="Primary & secondary income sources"
        />

        <StatCard
          title="Registered Merchants"
          icon="🏢"
          variant="balance"
          value={merchants.length}
          meta="Pattern matching & statement auto-tagging"
        />

        <StatCard
          title="Active Tags"
          icon="🏷️"
          variant="default"
          value={tags.length}
          meta="Cross-cutting ledger classification"
        />
      </section>

      {/* Navigation & Action Header */}
      <div className="accounts-action-bar">
        <div className="accounts-filter-group">
          <button
            className={`acc-filter-btn ${activeTab === 'expense' ? 'active' : ''}`}
            onClick={() => setActiveTab('expense')}
          >
            📉 Expenses ({expenseCategories.length})
          </button>
          <button
            className={`acc-filter-btn ${activeTab === 'income' ? 'active' : ''}`}
            onClick={() => setActiveTab('income')}
          >
            📈 Income ({incomeCategories.length})
          </button>
          <button
            className={`acc-filter-btn ${activeTab === 'merchants' ? 'active' : ''}`}
            onClick={() => setActiveTab('merchants')}
          >
            🏢 Merchants & Payees ({merchants.length})
          </button>
          <button
            className={`acc-filter-btn ${activeTab === 'tags' ? 'active' : ''}`}
            onClick={() => setActiveTab('tags')}
          >
            🏷️ Tags ({tags.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {activeTab === 'merchants' ? (
            <button
              onClick={onOpenCreateMerchant}
              className="submit-btn primary-glow add-acc-btn"
            >
              <span>➕</span> Add Merchant
            </button>
          ) : activeTab === 'tags' ? (
            <button
              onClick={onOpenCreateTag}
              className="submit-btn primary-glow add-acc-btn"
            >
              <span>➕</span> Create Tag
            </button>
          ) : (
            <button
              onClick={onOpenCreateCategory}
              className="submit-btn primary-glow add-acc-btn"
            >
              <span>➕</span> Create Category
            </button>
          )}
        </div>
      </div>

      {/* 1. EXPENSE CATEGORIES TAB (NEEDS vs WANTS) */}
      {activeTab === 'expense' && (
        <div className="cat-dual-grid">
          {/* Needs / Essential Section */}
          <div className="panel cat-group-panel">
            <div className="cat-group-header">
              <div className="cat-group-title">
                <span className="badge badge-needs">🛡️ Needs (Essential)</span>
                <span className="cat-group-sub">50% Rule: Housing, utilities, sustenance, health</span>
              </div>
              <span className="cat-count-badge">{needsCategories.length} items</span>
            </div>

            <div className="cat-card-grid">
              {needsCategories.map((cat) => (
                <div key={cat.id} className="category-item-card">
                  <div className="cat-item-left">
                    <div
                      className="cat-avatar-bubble"
                      style={{ backgroundColor: `${cat.color || '#6366f1'}22`, borderColor: cat.color || '#6366f1' }}
                    >
                      <span className="cat-emoji">{cat.icon || '📦'}</span>
                    </div>
                    <div>
                      <div className="cat-item-name">{cat.name}</div>
                      <div className="cat-item-meta">
                        {cat.workspace_id ? (
                          <span className="badge-custom-pill">Custom</span>
                        ) : (
                          <span className="badge-system-pill">System Standard</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {cat.workspace_id && (
                    <button
                      className="tx-delete-btn"
                      onClick={(e) => handleDeleteCategory(e, cat)}
                      title="Archive category"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Wants / Discretionary Section */}
          <div className="panel cat-group-panel">
            <div className="cat-group-header">
              <div className="cat-group-title">
                <span className="badge badge-wants">✨ Wants (Discretionary)</span>
                <span className="cat-group-sub">30% Rule: Lifestyle, dining out, recreation, tools</span>
              </div>
              <span className="cat-count-badge">{wantsCategories.length} items</span>
            </div>

            <div className="cat-card-grid">
              {wantsCategories.map((cat) => (
                <div key={cat.id} className="category-item-card">
                  <div className="cat-item-left">
                    <div
                      className="cat-avatar-bubble"
                      style={{ backgroundColor: `${cat.color || '#ec4899'}22`, borderColor: cat.color || '#ec4899' }}
                    >
                      <span className="cat-emoji">{cat.icon || '📦'}</span>
                    </div>
                    <div>
                      <div className="cat-item-name">{cat.name}</div>
                      <div className="cat-item-meta">
                        {cat.workspace_id ? (
                          <span className="badge-custom-pill">Custom</span>
                        ) : (
                          <span className="badge-system-pill">System Standard</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {cat.workspace_id && (
                    <button
                      className="tx-delete-btn"
                      onClick={(e) => handleDeleteCategory(e, cat)}
                      title="Archive category"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. INCOME CATEGORIES TAB */}
      {activeTab === 'income' && (
        <div className="panel">
          <div className="cat-group-header" style={{ marginBottom: '1.25rem' }}>
            <div className="cat-group-title">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Income Streams & Inflows</h3>
              <span className="cat-group-sub">Revenue generation, salaries, consulting, capital yields</span>
            </div>
            <span className="cat-count-badge">{incomeCategories.length} streams</span>
          </div>

          <div className="cat-card-grid">
            {incomeCategories.map((cat) => (
              <div key={cat.id} className="category-item-card">
                <div className="cat-item-left">
                  <div
                    className="cat-avatar-bubble"
                    style={{ backgroundColor: `${cat.color || '#10b981'}22`, borderColor: cat.color || '#10b981' }}
                  >
                    <span className="cat-emoji">{cat.icon || '💰'}</span>
                  </div>
                  <div>
                    <div className="cat-item-name">{cat.name}</div>
                    <div className="cat-item-meta">
                      {cat.workspace_id ? (
                        <span className="badge-custom-pill">Custom</span>
                      ) : (
                        <span className="badge-system-pill">System Standard</span>
                      )}
                    </div>
                  </div>
                </div>

                {cat.workspace_id && (
                  <button
                    className="tx-delete-btn"
                    onClick={(e) => handleDeleteCategory(e, cat)}
                    title="Archive category"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. MERCHANTS & PAYEES TAB */}
      {activeTab === 'merchants' && (
        <div className="panel">
          <div className="filter-bar" style={{ marginBottom: '1.5rem' }}>
            <input
              type="text"
              className="input-field filter-input"
              placeholder="Search merchants or aliases (e.g. Careem, AWS, Supermarket)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {filteredMerchants.length === 0 ? (
            <div className="empty-state">
              <span style={{ fontSize: '2.5rem' }}>🏢</span>
              <h3>No merchants registered</h3>
              <p>Register payees and their statement aliases for automated ledger categorization.</p>
              <button
                onClick={onOpenCreateMerchant}
                className="submit-btn primary-glow"
                style={{ marginTop: '1rem', width: 'auto', display: 'inline-flex' }}
              >
                ➕ Register First Merchant
              </button>
            </div>
          ) : (
            <div className="merchants-grid">
              {filteredMerchants.map((merch) => (
                <div key={merch.id} className="merchant-card glass-card">
                  <div className="merch-header">
                    <div className="merch-brand">
                      {merch.logo_url ? (
                        <img src={merch.logo_url} alt="" className="merch-logo-img" />
                      ) : (
                        <div className="merch-logo-placeholder">🏢</div>
                      )}
                      <div>
                        <div className="merch-name">{merch.name}</div>
                        {merch.default_category && (
                          <div className="merch-cat-badge">
                            <span>{merch.default_category.icon}</span>
                            <span>{merch.default_category.name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      className="tx-delete-btn"
                      onClick={(e) => handleDeleteMerchant(e, merch)}
                      title="Delete merchant"
                    >
                      🗑️
                    </button>
                  </div>

                  {merch.aliases && merch.aliases.length > 0 && (
                    <div className="merch-aliases-section">
                      <div className="merch-aliases-label">Recognized Statement Aliases:</div>
                      <div className="merch-aliases-tags">
                        {merch.aliases.map((alias, idx) => (
                          <span key={idx} className="alias-chip">
                            {alias}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. TAGS & LABELS TAB */}
      {activeTab === 'tags' && (
        <div className="panel">
          <div className="cat-group-header" style={{ marginBottom: '1.25rem' }}>
            <div className="cat-group-title">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Cross-Cutting Tags</h3>
              <span className="cat-group-sub">
                Tag expenses across categories for tax deductions, business projects, trips, or reimbursements
              </span>
            </div>
            <button
              onClick={onOpenCreateTag}
              className="submit-btn primary-glow add-acc-btn"
            >
              <span>➕</span> Add Tag
            </button>
          </div>

          {tags.length === 0 ? (
            <div className="empty-state">
              <span style={{ fontSize: '2.5rem' }}>🏷️</span>
              <h3>No tags created yet</h3>
              <p>Create tags like "Tax Deductible" or "Q4 Offsite" to label transactions freely.</p>
            </div>
          ) : (
            <div className="tags-cloud">
              {tags.map((tag) => (
                <div key={tag.id} className="tag-pill-card">
                  <span
                    className="tag-dot"
                    style={{ backgroundColor: tag.color || '#8b5cf6' }}
                  />
                  <span className="tag-name">{tag.name}</span>
                  <button
                    className="tag-remove-btn"
                    onClick={(e) => handleDeleteTag(e, tag)}
                    title={`Delete tag ${tag.name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
