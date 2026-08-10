import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Modal } from './common/Modal';

export function SingleBadgeScannerModal({ isOpen, onClose, onScan, memberName }) {
  const qrEngineRef = useRef(null);
  const hasScannedRef = useRef(false);
  const [error, setError] = useState(null);
  const [showCheckmark, setShowCheckmark] = useState(false);

  const playSuccessSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setShowCheckmark(false);
      hasScannedRef.current = false;
      return;
    }
    
    hasScannedRef.current = false;
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
    setShowCheckmark(false);
    try {
      qrEngineRef.current = new Html5Qrcode('single-badge-reader', { verbose: false });
      await qrEngineRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (hasScannedRef.current) return;

          // Parse TLC ID and Member ID from QR payload
          // TLC format is usually memberId|tlcId or just tlcId
          const parts = decodedText.split('|').map(p => p.trim());
          let memberId = null;
          let tlcId = null;
          if (parts.length > 1) {
            memberId = parts[0];
            tlcId = parts[1];
          } else {
            tlcId = parts[0];
          }

          if (tlcId) {
            hasScannedRef.current = true;
            if (qrEngineRef.current && qrEngineRef.current.isScanning) {
              qrEngineRef.current.stop().catch(err => console.error(err));
            }
            playSuccessSound();
            setShowCheckmark(true);

            setTimeout(() => {
              onScan({ tlcId, memberId });
            }, 800);
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
        <div style={{ position: 'relative', width: '100%', maxWidth: '400px', margin: '0 auto', overflow: 'hidden', borderRadius: 'var(--radius-md)', background: '#000' }}>
          <div 
            id="single-badge-reader" 
            style={{ width: '100%' }} 
          />
          {showCheckmark && (
            <div className="scan-overlay scan-overlay--success">
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '50%', padding: '1rem', display: 'flex', boxShadow: 'var(--glass-shadow)' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
          )}
        </div>
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
