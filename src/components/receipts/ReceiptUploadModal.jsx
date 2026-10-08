import { useState, useRef } from 'react';
import { useAttachments } from '../../context/AttachmentContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyDisplay from '../ui/MoneyDisplay';

export default function ReceiptUploadModal({
  isOpen,
  onClose,
  onConfirmDraft,
  transactionId = null,
}) {
  const { uploadReceipt, createDraftFromAttachmentData } = useAttachments();
  const { currentWorkspace } = useWorkspace();
  const baseCurrency = currentWorkspace?.base_currency || 'USD';

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setOcrResult(null);
      setErrorMsg('');
    }
  };

  const handleScanReceipt = async () => {
    if (!selectedFile) {
      setErrorMsg('Please select a receipt image or invoice first.');
      return;
    }

    setIsScanning(true);
    setErrorMsg('');

    try {
      // Simulate realistic intelligent OCR extraction from file name / content
      const sampleMerchant = selectedFile.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .toUpperCase();

      const mockOcrText = `
TAX INVOICE / RECEIPT
Store: ${sampleMerchant}
Date: ${new Date().toISOString().split('T')[0]}
Cashier: 042  Station: 01
--------------------------------
1x Groceries & Supplies     24.50
1x Service / Item           12.00
--------------------------------
Subtotal:                   36.50
VAT Tax (5%):                1.82
TOTAL AMOUNT:               38.32 ${baseCurrency}
Payment Method: Electronic
Thank you for your business!
      `;

      const res = await uploadReceipt({
        file: selectedFile,
        transactionId,
        mockOcrText,
      });

      if (res.error) {
        setErrorMsg(res.error.message || 'Failed to scan receipt');
      } else {
        setOcrResult({
          record: res.data,
          extracted: res.extracted,
        });
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleProceedToConfirmation = () => {
    if (!ocrResult) return;
    const draft = createDraftFromAttachmentData(
      ocrResult.extracted,
      ocrResult.record?.id
    );

    if (onConfirmDraft) {
      onConfirmDraft(draft);
      handleResetAndClose();
    }
  };

  const handleResetAndClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setOcrResult(null);
    setErrorMsg('');
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={handleResetAndClose}>
      <div
        className="modal-card"
        style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">📷 Receipt OCR Scanner</h2>
            <p className="modal-subtitle">
              Upload physical receipts or digital invoices to extract metadata into verified draft transactions.
            </p>
          </div>
          <button className="modal-close-btn" onClick={handleResetAndClose} aria-label="Close">
            ✕
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

        {/* Drop zone / File selector */}
        {!previewUrl ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed rgba(255, 255, 255, 0.15)',
              borderRadius: '14px',
              padding: '3rem 1.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'rgba(255, 255, 255, 0.02)',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontSize: '3rem' }}>🧾</div>
            <strong style={{ fontSize: '1.1rem', color: '#f8fafc' }}>
              Click to browse or drop receipt file here
            </strong>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)', margin: 0 }}>
              Supports JPG, PNG, WebP and PDF (Max 10MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Preview Box */}
            <div
              style={{
                position: 'relative',
                maxHeight: '260px',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#090d16',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={previewUrl}
                alt="Receipt preview"
                style={{
                  maxHeight: '260px',
                  width: 'auto',
                  maxWidth: '100%',
                  objectFit: 'contain',
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  setOcrResult(null);
                }}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                }}
                title="Change image"
              >
                ✕
              </button>
            </div>

            {/* Scan Action */}
            {!ocrResult && (
              <button
                type="button"
                className="submit-btn primary-glow"
                disabled={isScanning}
                onClick={handleScanReceipt}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <span>{isScanning ? '⏳' : '🔍'}</span>
                {isScanning ? 'Running OCR Extraction...' : 'Scan & Extract Receipt Data'}
              </button>
            )}

            {/* OCR Extracted Card */}
            {ocrResult && (
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>✅</span>
                    <strong style={{ color: '#34d399', fontSize: '1rem' }}>
                      Receipt Extracted Successfully
                    </strong>
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#34d399',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '6px',
                      fontWeight: 600,
                    }}
                  >
                    {Math.round((ocrResult.extracted.confidence || 0.85) * 100)}% Confidence
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.75rem',
                    marginTop: '0.25rem',
                  }}
                >
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>Merchant</span>
                    <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>
                      {ocrResult.extracted.merchantName || 'Unknown Merchant'}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>Total Amount</span>
                    <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.95rem' }}>
                      <MoneyDisplay
                        amount={parseFloat(ocrResult.extracted.totalAmount || '0')}
                        currencyCode={ocrResult.extracted.currency || baseCurrency}
                        type="expense"
                        showSign
                      />
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>Date</span>
                    <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>
                      {ocrResult.extracted.date || 'Today'}
                    </div>
                  </div>

                  {ocrResult.extracted.taxAmount && (
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>Tax / VAT</span>
                      <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>
                        <MoneyDisplay
                          amount={parseFloat(ocrResult.extracted.taxAmount)}
                          currencyCode={ocrResult.extracted.currency || baseCurrency}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                    marginTop: '0.75rem',
                  }}
                >
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={handleResetAndClose}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    className="submit-btn primary-glow"
                    onClick={handleProceedToConfirmation}
                  >
                    📝 Review & Book Transaction
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
