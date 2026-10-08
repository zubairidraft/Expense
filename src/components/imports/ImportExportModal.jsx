import { useState, useMemo } from 'react';
import { useTransactions } from '../../context/TransactionContext';
import { useAccounts } from '../../context/AccountContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  parseBankSms,
  generateDraftFromSms,
  parseCsv,
  computeDedupeHash,
  exportTransactionsToCsv,
  exportWorkspaceToJson,
} from '@universal-expense/core';

export default function ImportExportModal({ isOpen, onClose, onApplySmsDraft }) {
  const { transactions, addTransaction } = useTransactions();
  const { accounts } = useAccounts();
  const { currentWorkspace } = useWorkspace();

  const [activeTab, setActiveTab] = useState('sms'); // 'sms' | 'csv' | 'export'

  // SMS State
  const [smsText, setSmsText] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');

  // CSV State
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(null);

  if (!isOpen) return null;

  // Live SMS Parse
  const parsedSms = useMemo(() => {
    if (!smsText.trim()) return null;
    return parseBankSms(smsText);
  }, [smsText]);

  // Live CSV Parse
  const parsedCsv = useMemo(() => {
    if (!csvText.trim()) return null;
    return parseCsv(csvText);
  }, [csvText]);

  const handleApplySms = async () => {
    if (!parsedSms) return;
    const draft = generateDraftFromSms(parsedSms);

    if (onApplySmsDraft) {
      onApplySmsDraft({
        ...draft,
        accountId: selectedAccountId || accounts[0]?.id,
      });
      onClose();
      return;
    }

    // Direct book if no custom modal handler passed
    try {
      await addTransaction({
        type: draft.type,
        amount: draft.amount,
        title: draft.title,
        notes: draft.notes,
        date: draft.date,
        accountId: selectedAccountId || accounts[0]?.id,
        source: 'sms',
      });
      alert('Transaction booked from SMS alert successfully!');
      onClose();
    } catch (err) {
      alert('Error booking transaction: ' + err.message);
    }
  };

  const handleImportCsvRows = async () => {
    if (!parsedCsv || parsedCsv.rows.length === 0) return;

    try {
      setImporting(true);
      setImportMessage(null);
      let importedCount = 0;
      let duplicateCount = 0;

      const seenHashes = new Set();
      for (const t of transactions) {
        seenHashes.add(computeDedupeHash(t.date, t.amount, t.payee_name || t.title, t.type));
      }

      for (const row of parsedCsv.rows) {
        const date = row.Date || row.date || new Date().toISOString().split('T')[0];
        const amount = row.Amount || row.amount || '0.00';
        const title = row.Title || row.title || row.Description || row.description || 'Imported Entry';
        const type = (row.Type || row.type || 'expense').toLowerCase();
        const payee = row.Payee || row.payee || title;
        const notes = row.Notes || row.notes || 'Imported via CSV';

        const hash = computeDedupeHash(date, amount, payee, type);
        if (seenHashes.has(hash)) {
          duplicateCount++;
          continue;
        }

        seenHashes.add(hash);
        await addTransaction({
          date,
          amount: parseFloat(amount).toFixed(2),
          title,
          type: ['expense', 'income', 'transfer'].includes(type) ? type : 'expense',
          notes,
          accountId: selectedAccountId || accounts[0]?.id,
          source: 'import',
        });
        importedCount++;
      }

      setImportMessage(`Imported ${importedCount} transactions. Skipped ${duplicateCount} duplicates.`);
    } catch (err) {
      setImportMessage('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleExportCsv = () => {
    const csvData = exportTransactionsToCsv(transactions);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJson = () => {
    const jsonData = exportWorkspaceToJson({
      workspace: currentWorkspace,
      transactions,
      accounts,
    });
    const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `expense_pro_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon">📲</span>
            <h2 className="modal-title">Data In & Out Hub</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Tab Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(255, 255, 255, 0.04)', padding: '0.3rem', borderRadius: '10px', marginTop: '1rem' }}>
          <button
            type="button"
            className={`btn-pill ${activeTab === 'sms' ? 'active' : ''}`}
            onClick={() => setActiveTab('sms')}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'sms' ? 'var(--color-primary, #6366f1)' : 'transparent',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            📱 Bank SMS Parser
          </button>
          <button
            type="button"
            className={`btn-pill ${activeTab === 'csv' ? 'active' : ''}`}
            onClick={() => setActiveTab('csv')}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'csv' ? 'var(--color-primary, #6366f1)' : 'transparent',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            📥 CSV Import
          </button>
          <button
            type="button"
            className={`btn-pill ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'export' ? 'var(--color-primary, #6366f1)' : 'transparent',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            📤 Data Export
          </button>
        </div>

        {/* Tab 1: Bank SMS Parser */}
        {activeTab === 'sms' && (
          <div style={{ marginTop: '1.25rem' }}>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 0.75rem 0' }}>
              Paste any transaction alert SMS from HBL, Meezan, JazzCash, Easypaisa, UBL, Emirates NBD, ADCB, or FAB:
            </p>

            <textarea
              className="form-input"
              rows={3}
              placeholder="e.g. HBL Alert: Dear Customer, PKR 4,500.00 spent on your Debit Card 1234 at AL-FATAH STORE on 08-OCT-2026..."
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              autoFocus
            />

            {/* Quick Demo Buttons */}
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', alignSelf: 'center' }}>Sample SMS:</span>
              <button
                type="button"
                className="btn-text"
                style={{ fontSize: '0.75rem', color: '#6366f1' }}
                onClick={() => setSmsText('HBL Alert: Dear Customer, PKR 4,500.00 spent on your Debit Card 1234 at AL-FATAH STORE on 08-OCT-2026. Avail Bal: PKR 32,150.00')}
              >
                HBL POS
              </button>
              <button
                type="button"
                className="btn-text"
                style={{ fontSize: '0.75rem', color: '#10b981' }}
                onClick={() => setSmsText('JazzCash: Rs. 1,500 sent to 03001234567 (Ali Khan) on 08-10-2026. Fee: Rs. 0. Balance: Rs. 4,200. TID: 198273615')}
              >
                JazzCash
              </button>
              <button
                type="button"
                className="btn-text"
                style={{ fontSize: '0.75rem', color: '#38bdf8' }}
                onClick={() => setSmsText('Emirates NBD: Purchase of AED 250.00 with Credit Card ending 9876 at CARREFOUR DUBAI on 08/10/2026. Available limit: AED 14,750.00')}
              >
                Emirates NBD
              </button>
            </div>

            {/* Live Parsing Result Preview */}
            {parsedSms && (
              <div
                style={{
                  marginTop: '1rem',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(16, 185, 129, 0.1))',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '10px',
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: 'rgba(99, 102, 241, 0.25)',
                      color: '#a5b4fc',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                    }}
                  >
                    ✓ {parsedSms.bankName} Detected
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                    Confidence High
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Amount</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                      {parsedSms.currency} {parsedSms.amount}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Merchant / Payee</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0' }}>
                      {parsedSms.merchantOrPayee || 'Merchant'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Type</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#38bdf8', textTransform: 'capitalize' }}>
                      {parsedSms.type}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <select
                    className="form-input"
                    style={{ width: '190px', padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>Book to: {a.name}</option>
                    ))}
                  </select>

                  <button type="button" className="btn-primary" onClick={handleApplySms}>
                    ⚡ Confirm & Book Transaction
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: CSV Import */}
        {activeTab === 'csv' && (
          <div style={{ marginTop: '1.25rem' }}>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 0.75rem 0' }}>
              Paste CSV text with headers (Date, Title, Amount, Type). Deduplication engine automatically filters duplicate transactions:
            </p>

            <textarea
              className="form-input"
              rows={4}
              placeholder={`Date,Title,Amount,Type\n2026-10-01,Groceries,85.50,expense\n2026-10-02,Client Retainer,3000.00,income`}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />

            {importMessage && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.6rem',
                  borderRadius: '6px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  color: '#e2e8f0',
                  fontSize: '0.85rem',
                }}
              >
                {importMessage}
              </div>
            )}

            {parsedCsv && parsedCsv.rows.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
                  Detected {parsedCsv.rows.length} rows to import:
                </div>
                <div style={{ maxHeight: '140px', overflowY: 'auto', background: 'rgba(15, 23, 42, 0.5)', padding: '0.5rem', borderRadius: '6px' }}>
                  {parsedCsv.rows.slice(0, 5).map((r, idx) => (
                    <div key={idx} style={{ fontSize: '0.78rem', color: '#cbd5e1', padding: '0.2rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      {r.Date || r.date} • {r.Title || r.title || r.Description} • <strong>${r.Amount || r.amount}</strong> ({r.Type || r.type})
                    </div>
                  ))}
                  {parsedCsv.rows.length > 5 && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', marginTop: '0.25rem' }}>
                      + {parsedCsv.rows.length - 5} more rows
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleImportCsvRows}
                    disabled={importing}
                  >
                    {importing ? 'Importing...' : `Import ${parsedCsv.rows.length} Transactions`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Data Export */}
        {activeTab === 'export' && (
          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
              Export complete financial data for reporting, Excel spreadsheets, or self-hosted backup:
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>📊</div>
                  <h4 style={{ margin: '0 0 0.35rem 0', color: '#f8fafc', fontSize: '1rem' }}>CSV Ledger Export</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                    Standard spreadsheet export compatible with Microsoft Excel, Google Sheets, and Apple Numbers.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: '1rem' }}
                  onClick={handleExportCsv}
                >
                  Download CSV ({transactions.length} txs)
                </button>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>💾</div>
                  <h4 style={{ margin: '0 0 0.35rem 0', color: '#f8fafc', fontSize: '1rem' }}>Full JSON Backup</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                    Complete schema archive with workspace settings, accounts vault, transactions, and categories.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ marginTop: '1rem' }}
                  onClick={handleExportJson}
                >
                  Download JSON Backup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
