import { useEffect } from 'react';
import AppearancePanel from './AppearancePanel';
import Icon from '../ui/Icon';

export default function AppearanceModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content modal-large"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appearance-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '1100px', width: '100%', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title" id="appearance-title">Appearance</h2>
            <p className="modal-subtitle">Colours, shape and font are saved on this device for your account.</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={22} />
          </button>
        </div>
        <AppearancePanel />
        <div className="md-dialog-actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="md-btn-filled" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
