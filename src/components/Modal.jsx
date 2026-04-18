import React, { useState, useCallback } from 'react';

export function Modal({ modal, onClose }) {
  if (!modal) return null;

  const close = () => {
    if (modal.onCancel) modal.onCancel();
    onClose();
  };

  const handleConfirm = async () => {
    const value = modal.hasInput ? (modal.inputValue ?? '') : undefined;
    if (modal.requireInput && !String(value).trim()) return;
    onClose();
    if (modal.onConfirm) await modal.onConfirm(value);
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && (modal.onConfirm || !modal.hasInput)) {
      e.preventDefault();
      if (modal.onConfirm) handleConfirm();
      else onClose();
    }
    if (e.key === 'Escape') close();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={close}
      onKeyDown={onKey}
    >
      <div
        className="card"
        style={{ maxWidth: modal.maxWidth || 360, width: '90vw', textAlign: modal.hasInput ? 'left' : 'center', padding: 24 }}
        onClick={e => e.stopPropagation()}
      >
        {modal.title && <h3 style={{ marginBottom: 12 }}>{modal.title}</h3>}
        <p style={{ marginBottom: modal.hasInput ? 12 : 20, fontSize: 15, fontWeight: modal.hasInput ? 600 : 400 }}>{modal.msg}</p>

        {modal.hasInput && (
          <input
            autoFocus
            type={modal.inputType || 'text'}
            value={modal.inputValue ?? ''}
            onChange={e => modal.setInputValue(e.target.value)}
            onKeyDown={onKey}
            placeholder={modal.placeholder || ''}
            style={{ width: '100%', marginBottom: 16 }}
          />
        )}

        {modal.onConfirm ? (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn-secondary" onClick={close}>{modal.cancelLabel || 'Cancelar'}</button>
            <button
              className={modal.danger ? 'btn-danger' : 'btn-primary'}
              onClick={handleConfirm}
            >
              {modal.confirmLabel || 'Confirmar'}
            </button>
          </div>
        ) : (
          <button className="btn-primary" onClick={onClose}>OK</button>
        )}
      </div>
    </div>
  );
}

export function useModal() {
  const [modal, setModalState] = useState(null);

  const close = useCallback(() => setModalState(null), []);

  const setInputValue = useCallback((v) => {
    setModalState(m => m ? { ...m, inputValue: v } : m);
  }, []);

  const showAlert = useCallback((msg, opts = {}) => {
    if (typeof document !== 'undefined') document.activeElement?.blur?.();
    setModalState({ msg, ...opts });
  }, []);

  const askConfirm = useCallback((msg, onConfirm, opts = {}) => {
    if (typeof document !== 'undefined') document.activeElement?.blur?.();
    setModalState({ msg, onConfirm, danger: opts.danger ?? true, ...opts });
  }, []);

  const askInput = useCallback((msg, onConfirm, opts = {}) => {
    if (typeof document !== 'undefined') document.activeElement?.blur?.();
    setModalState({
      msg,
      onConfirm,
      hasInput: true,
      inputValue: opts.defaultValue ?? '',
      setInputValue,
      requireInput: opts.required ?? false,
      placeholder: opts.placeholder,
      inputType: opts.type,
      confirmLabel: opts.confirmLabel,
      danger: opts.danger ?? false,
      ...opts,
    });
  }, [setInputValue]);

  const modalEl = <Modal modal={modal} onClose={close} />;

  return { modal, setModal: setModalState, showAlert, askConfirm, askInput, close, modalEl };
}

export default Modal;
