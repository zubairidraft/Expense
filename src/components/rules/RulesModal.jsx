import { useState } from 'react';
import { useRules } from '../../context/RuleContext';
import { useCategories } from '../../context/CategoryContext';

export default function RulesModal({ isOpen, onClose }) {
  const { rules, loading, createRule, updateRule, deleteRule } = useRules();
  const { categories, tags } = useCategories();

  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create'

  // New Rule Form State
  const [ruleName, setRuleName] = useState('');
  const [priority, setPriority] = useState(50);
  const [conditions, setConditions] = useState([
    { field: 'payee_name', operator: 'contains', value: '' },
  ]);
  const [actions, setActions] = useState([
    { type: 'set_category', value: categories[0]?.id || '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleAddCondition = () => {
    setConditions((prev) => [
      ...prev,
      { field: 'payee_name', operator: 'contains', value: '' },
    ]);
  };

  const handleRemoveCondition = (index) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCondition = (index, field, val) => {
    setConditions((prev) =>
      prev.map((cond, i) => (i === index ? { ...cond, [field]: val } : cond))
    );
  };

  const handleAddAction = () => {
    setActions((prev) => [
      ...prev,
      { type: 'set_category', value: categories[0]?.id || '' },
    ]);
  };

  const handleRemoveAction = (index) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateAction = (index, field, val) => {
    setActions((prev) =>
      prev.map((act, i) => (i === index ? { ...act, [field]: val } : act))
    );
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!ruleName.trim()) {
      setErrorMsg('Please specify a descriptive rule name.');
      return;
    }

    const validConditions = conditions.filter((c) => String(c.value).trim().length > 0);
    if (validConditions.length === 0) {
      setErrorMsg('At least one condition with a match value is required.');
      return;
    }

    const validActions = actions.filter((a) => String(a.value).trim().length > 0);
    if (validActions.length === 0) {
      setErrorMsg('At least one valid action is required.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await createRule({
        name: ruleName.trim(),
        priority: Number(priority),
        active: true,
        conditions: validConditions,
        actions: validActions,
      });

      if (error) {
        setErrorMsg(error.message || 'Failed to save rule.');
      } else {
        setSuccessMsg('Rule created and active!');
        setRuleName('');
        setPriority(50);
        setConditions([{ field: 'payee_name', operator: 'contains', value: '' }]);
        setActions([{ type: 'set_category', value: categories[0]?.id || '' }]);
        setTimeout(() => {
          setActiveTab('list');
          setSuccessMsg('');
        }, 900);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (rule) => {
    await updateRule(rule.id, { active: !rule.active });
  };

  const handleDeleteRule = async (ruleId) => {
    if (window.confirm('Delete this categorization rule?')) {
      await deleteRule(ruleId);
    }
  };

  const getCategoryName = (catId) => {
    const found = categories.find((c) => c.id === catId);
    return found ? `${found.icon || '🏷️'} ${found.name}` : catId;
  };

  const getTagName = (tagId) => {
    const found = tags.find((t) => t.id === tagId);
    return found ? `#${found.name}` : tagId;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">⚡ Auto-Categorization Rules</h2>
            <p className="modal-subtitle">
              Deterministic pattern-matching triggers that run before AI fallback.
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <button
            type="button"
            className={`acc-filter-btn ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            📋 All Rules ({rules.length})
          </button>
          <button
            type="button"
            className={`acc-filter-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            ➕ New Rule
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            ✅ {successMsg}
          </div>
        )}

        {/* TAB 1: RULES LIST */}
        {activeTab === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {rules.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  color: 'var(--text-muted, #94a3b8)',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚡</div>
                <p>No active rules configured yet.</p>
                <button
                  type="button"
                  className="submit-btn primary-glow"
                  style={{ marginTop: '1rem' }}
                  onClick={() => setActiveTab('create')}
                >
                  Create First Rule
                </button>
              </div>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    background: rule.active ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.01)',
                    border: rule.active ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.04)',
                    opacity: rule.active ? 1 : 0.6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          background: 'rgba(99, 102, 241, 0.2)',
                          color: '#818cf8',
                          fontWeight: 600,
                        }}
                      >
                        Priority #{rule.priority ?? 100}
                      </span>
                      <strong style={{ fontSize: '1rem', color: 'var(--text-main, #f8fafc)' }}>
                        {rule.name}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(rule)}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          background: rule.active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                          color: rule.active ? '#34d399' : '#94a3b8',
                        }}
                      >
                        {rule.active ? 'Active' : 'Disabled'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '0.3rem',
                        }}
                        title="Delete Rule"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Conditions & Actions pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem' }}>
                    {rule.conditions?.map((c, i) => (
                      <span
                        key={i}
                        style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          background: 'rgba(56, 189, 248, 0.12)',
                          color: '#38bdf8',
                        }}
                      >
                        IF {c.field} {c.operator} &ldquo;{c.value}&rdquo;
                      </span>
                    ))}
                    <span style={{ color: 'var(--text-muted, #94a3b8)', alignSelf: 'center' }}>➔</span>
                    {rule.actions?.map((a, i) => (
                      <span
                        key={i}
                        style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          background: 'rgba(168, 85, 247, 0.12)',
                          color: '#c084fc',
                        }}
                      >
                        {a.type === 'set_category' && `Assign: ${getCategoryName(a.value)}`}
                        {a.type === 'add_tag' && `Tag: ${getTagName(a.value)}`}
                        {a.type === 'mark_cleared' && `Cleared: ${a.value}`}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: CREATE RULE */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <div>
                <label className="input-label" htmlFor="rule-name">
                  Rule Name *
                </label>
                <input
                  id="rule-name"
                  type="text"
                  className="input-field"
                  placeholder="e.g. Netflix / Spotify Subscription"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="input-label" htmlFor="rule-priority">
                  Evaluation Priority
                </label>
                <input
                  id="rule-priority"
                  type="number"
                  className="input-field"
                  placeholder="10"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  min="1"
                  max="1000"
                />
              </div>
            </div>

            {/* Conditions Section */}
            <div
              style={{
                padding: '1rem',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                }}
              >
                <strong style={{ fontSize: '0.9rem', color: '#38bdf8' }}>
                  Conditions (ALL must match)
                </strong>
                <button
                  type="button"
                  onClick={handleAddCondition}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  ➕ Add Condition
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {conditions.map((cond, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.5fr 1.5fr 2fr auto',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <select
                      className="input-field"
                      value={cond.field}
                      onChange={(e) => handleUpdateCondition(idx, 'field', e.target.value)}
                    >
                      <option value="payee_name">Payee / Merchant</option>
                      <option value="notes">Notes / Memo</option>
                      <option value="amount">Amount</option>
                    </select>

                    <select
                      className="input-field"
                      value={cond.operator}
                      onChange={(e) => handleUpdateCondition(idx, 'operator', e.target.value)}
                    >
                      <option value="contains">Contains</option>
                      <option value="equals">Equals</option>
                      <option value="starts_with">Starts with</option>
                      <option value="greater_than">Greater than (&gt;)</option>
                      <option value="less_than">Less than (&lt;)</option>
                    </select>

                    <input
                      type="text"
                      className="input-field"
                      placeholder="Keyword or value..."
                      value={cond.value}
                      onChange={(e) => handleUpdateCondition(idx, 'value', e.target.value)}
                      required
                    />

                    {conditions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCondition(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions Section */}
            <div
              style={{
                padding: '1rem',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                }}
              >
                <strong style={{ fontSize: '0.9rem', color: '#c084fc' }}>
                  Actions (Execute on match)
                </strong>
                <button
                  type="button"
                  onClick={handleAddAction}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#c084fc',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  ➕ Add Action
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {actions.map((act, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.5fr 2.5fr auto',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <select
                      className="input-field"
                      value={act.type}
                      onChange={(e) => handleUpdateAction(idx, 'type', e.target.value)}
                    >
                      <option value="set_category">Assign Category</option>
                      <option value="add_tag">Add Tag</option>
                      <option value="mark_cleared">Mark Cleared</option>
                    </select>

                    {act.type === 'set_category' && (
                      <select
                        className="input-field"
                        value={act.value}
                        onChange={(e) => handleUpdateAction(idx, 'value', e.target.value)}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.icon || '🏷️'} {c.name}
                          </option>
                        ))}
                      </select>
                    )}

                    {act.type === 'add_tag' && (
                      <select
                        className="input-field"
                        value={act.value}
                        onChange={(e) => handleUpdateAction(idx, 'value', e.target.value)}
                      >
                        {tags.map((t) => (
                          <option key={t.id} value={t.id}>
                            #{t.name}
                          </option>
                        ))}
                      </select>
                    )}

                    {act.type === 'mark_cleared' && (
                      <select
                        className="input-field"
                        value={act.value}
                        onChange={(e) => handleUpdateAction(idx, 'value', e.target.value)}
                      >
                        <option value="true">Cleared (True)</option>
                        <option value="false">Pending (False)</option>
                      </select>
                    )}

                    {actions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAction(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setActiveTab('list')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="submit-btn primary-glow"
                disabled={submitting}
              >
                {submitting ? 'Saving...' : '⚡ Save Rule'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
