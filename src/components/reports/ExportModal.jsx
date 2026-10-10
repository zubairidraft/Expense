import { useState } from 'react';
import {
  buildReportDataset,
  exportDatasetToCsv,
  exportDatasetToXlsx,
  exportDatasetToPdf,
  buildExportFilename,
} from '../../lib/export';

export default function ExportModal({
  isOpen,
  onClose,
  transactions = [],
  workspace = {},
  user = null,
  profile = {},
  startDate = '',
  endDate = '',
  appliedFilters = {},
  categories = [],
  accounts = [],
  tags = [],
  baseCurrency = 'USD',
}) {
  const [format, setFormat] = useState('xlsx'); // 'xlsx' | 'pdf' | 'csv'
  const [scope, setScope] = useState('full');   // 'full' | 'transactions_only'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  if (!isOpen) return null;

  // Build current report dataset
  const dataset = buildReportDataset(transactions, {
    workspace,
    user,
    profile,
    startDate,
    endDate,
    appliedFilters,
    categories,
    accounts,
    tags,
    baseCurrency,
  });

  const filterTags = (dataset.filters || []).map((f) => f.value);
  const filenamePreview = buildExportFilename({
    prefix: 'Financial_Report',
    startDate,
    endDate,
    filterTags,
    extension: format,
  });

  const handleExport = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      setSuccessToast('');

      // If user chose transactions_only, empty summary or sheets can be trimmed if needed
      const exportData = scope === 'transactions_only'
        ? { ...dataset, byCategory: [], byAccount: [] }
        : dataset;

      if (format === 'xlsx') {
        await exportDatasetToXlsx(exportData, { startDate, endDate });
      } else if (format === 'pdf') {
        await exportDatasetToPdf(exportData, { startDate, endDate });
      } else if (format === 'csv') {
        exportDatasetToCsv(exportData, { startDate, endDate });
      }

      setSuccessToast(`✓ Successfully exported as .${format.toUpperCase()}!`);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.error('[ExportModal] Export failed:', err);
      setErrorMsg(err.message || 'Failed to generate export file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content glass-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px', width: '92%' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📥</span> Export Financial Report
            </h2>
            <p className="modal-subtitle">
              Export high-fidelity spreadsheets and print-ready statements matching your live filters.
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close export dialog">
            ✕
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: 'var(--md-error, #dc2626)',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {errorMsg}
          </div>
        )}

        {successToast && (
          <div
            role="status"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#059669',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              fontWeight: 600,
            }}
          >
            {successToast}
          </div>
        )}

        {/* Format Selector Cards */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Choose File Format:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
            {/* Excel */}
            <button
              type="button"
              onClick={() => setFormat('xlsx')}
              style={{
                padding: '0.85rem 0.65rem',
                borderRadius: '10px',
                border: format === 'xlsx' ? '2px solid #16a34a' : '1px solid rgba(var(--md-on-surface-rgb), 0.12)',
                background: format === 'xlsx' ? 'rgba(22, 163, 74, 0.1)' : 'rgba(var(--md-on-surface-rgb), 0.03)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>📗</div>
              <strong style={{ display: 'block', fontSize: '0.9rem', color: format === 'xlsx' ? '#16a34a' : 'var(--text-primary)' }}>
                Excel (.xlsx)
              </strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Formatted workbook with formulas
              </span>
            </button>

            {/* PDF */}
            <button
              type="button"
              onClick={() => setFormat('pdf')}
              style={{
                padding: '0.85rem 0.65rem',
                borderRadius: '10px',
                border: format === 'pdf' ? '2px solid #dc2626' : '1px solid rgba(var(--md-on-surface-rgb), 0.12)',
                background: format === 'pdf' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(var(--md-on-surface-rgb), 0.03)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>📕</div>
              <strong style={{ display: 'block', fontSize: '0.9rem', color: format === 'pdf' ? '#dc2626' : 'var(--text-primary)' }}>
                PDF (.pdf)
              </strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Print-ready paginated statement
              </span>
            </button>

            {/* CSV */}
            <button
              type="button"
              onClick={() => setFormat('csv')}
              style={{
                padding: '0.85rem 0.65rem',
                borderRadius: '10px',
                border: format === 'csv' ? '2px solid var(--md-primary)' : '1px solid rgba(var(--md-on-surface-rgb), 0.12)',
                background: format === 'csv' ? 'rgba(var(--md-primary-rgb), 0.1)' : 'rgba(var(--md-on-surface-rgb), 0.03)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>📄</div>
              <strong style={{ display: 'block', fontSize: '0.9rem', color: format === 'csv' ? 'var(--md-primary)' : 'var(--text-primary)' }}>
                CSV (.csv)
              </strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Raw data with UTF-8 BOM
              </span>
            </button>
          </div>
        </div>

        {/* Scope Selector */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Content Scope:
          </label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="radio"
                name="exportScope"
                value="full"
                checked={scope === 'full'}
                onChange={() => setScope('full')}
              />
              <span>Full Report (Executive Summary + Breakdown + Transactions)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="radio"
                name="exportScope"
                value="transactions_only"
                checked={scope === 'transactions_only'}
                onChange={() => setScope('transactions_only')}
              />
              <span>Transactions Only</span>
            </label>
          </div>
        </div>

        {/* Live Filter Summary Card */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            background: 'rgba(var(--md-on-surface-rgb), 0.04)',
            border: '1px solid rgba(var(--md-on-surface-rgb), 0.1)',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Active Filter Constraints ({dataset.filters.length}):
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                background: 'rgba(var(--md-primary-rgb), 0.15)',
                color: 'var(--md-primary)',
                fontWeight: 600,
              }}
            >
              {dataset.summary.lineCount} ledger rows
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {dataset.filters.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                All transactions included (No filters applied)
              </span>
            ) : (
              dataset.filters.map((f, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    background: 'rgba(var(--md-on-surface-rgb), 0.06)',
                    color: 'var(--text-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <strong style={{ color: 'var(--text-secondary)' }}>{f.label}:</strong> {f.value}
                </span>
              ))
            )}
          </div>

          <div style={{ marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px dashed rgba(var(--md-on-surface-rgb), 0.1)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            📁 Target Filename: <code style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{filenamePreview}</code>
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1rem' }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="submit-btn primary-glow"
            onClick={handleExport}
            disabled={loading || dataset.rows.length === 0}
            style={{ width: 'auto', minWidth: '160px' }}
          >
            {loading ? (
              <span>⏳ Generating {format.toUpperCase()}...</span>
            ) : (
              <span>⬇️ Download .{format.toUpperCase()}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
