import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Modal } from './common/Modal';

export function SingleBadgeScannerModal({ isOpen, onClose, onScan, memberName }) {
  const qrEngineRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    
    // Slight delay to ensure the modal DOM is painted before mounting the scanner
    const timer = setTimeout(() => {
      startScanner();
    }, 100);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  async function startScanner() {
    setError(null);
    try {
      qrEngineRef.current = new Html5Qrcode('single-badge-reader', { verbose: false });
      await qrEngineRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Parse TLC ID from QR payload
          // TLC format is usually memberId|tlcId or just tlcId
          const parts = decodedText.split('|');
          const tlcId = parts.length > 1 ? parts[1] : parts[0];
          
          if (tlcId) {
            onScan(tlcId.trim());
          }
        },
        (err) => {
          // Ignore routine frame processing errors
        }
      );
    } catch (err) {
      console.error('Error starting scanner', err);
      setError('Could not access camera. Please ensure camera permissions are granted.');
    }
  }

  async function stopScanner() {
    if (qrEngineRef.current && qrEngineRef.current.isScanning) {
      try {
        await qrEngineRef.current.stop();
        qrEngineRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner', err);
      }
    }
  }

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Scan Badge for ${memberName || 'Member'}`}>
      <div style={{ padding: '1rem' }}>
        {error ? (
          <div style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>{error}</div>
        ) : (
          <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Point your camera at the member's Trail Life Connect ID badge.
          </p>
        )}
        <div 
          id="single-badge-reader" 
          style={{ width: '100%', maxWidth: '400px', margin: '0 auto', overflow: 'hidden', borderRadius: 'var(--radius-md)', background: '#000' }} 
        />
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
