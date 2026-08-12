import React from 'react';
import { Download, Monitor, AlertTriangle, CheckCircle2, Puzzle, ExternalLink } from 'lucide-react';

export function Extension() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Puzzle size={32} color="var(--color-primary)" />
          TLC Attendance Browser Extension
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginTop: '0.5rem' }}>
          Streamline your workflow with the official TLC Attendance Chrome & Edge extension.
        </p>
      </header>

      {/* Desktop Only Banner */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '1.25rem 1.5rem', 
          marginBottom: '2rem', 
          borderColor: 'var(--color-warning-border, #f59e0b)',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem'
        }}
      >
        <AlertTriangle size={24} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: '600' }}>
            Desktop Only Feature
          </h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>
            The TLC Attendance extension is designed exclusively for desktop browsers (<strong>Google Chrome</strong> and <strong>Microsoft Edge</strong>). It cannot be installed on mobile browsers or tablets.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        {/* Download Card */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-primary)' }}>Download Extension</h2>
              <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Version 1.0.0 (Zip Package)
              </p>
            </div>
            <a 
              href="/tlc_extension.zip" 
              download="tlc_extension.zip"
              className="primary-btn"
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                fontWeight: '600',
                textDecoration: 'none',
                borderRadius: '8px',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff'
              }}
            >
              <Download size={20} />
              Download TLC Extension (.zip)
            </a>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1.5rem 0' }} />

          {/* Installation Instructions */}
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Monitor size={20} />
            Installation & Setup Instructions
          </h2>

          <ol style={{ paddingLeft: '1.25rem', color: 'var(--text-primary)', lineHeight: '1.8' }}>
            <li style={{ marginBottom: '0.75rem' }}>
              <strong>Download and Extract:</strong> Click the button above to download <code>tlc_extension.zip</code>. Extract the contents to a folder on your computer.
            </li>
            <li style={{ marginBottom: '0.75rem' }}>
              <strong>Open Extensions Page:</strong>
              <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                <li>For Chrome: Navigate to <code>chrome://extensions</code></li>
                <li>For Edge: Navigate to <code>edge://extensions</code></li>
              </ul>
            </li>
            <li style={{ marginBottom: '0.75rem' }}>
              <strong>Enable Developer Mode:</strong> Toggle the <strong>Developer mode</strong> switch:
              <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                <li>For Chrome: Located in the top-right corner of the Extensions page.</li>
                <li>For Edge: Located at the bottom of the left-hand sidebar menu.</li>
              </ul>
            </li>
            <li style={{ marginBottom: '0.75rem' }}>
              <strong>Load Unpacked Extension:</strong> Click the <strong>Load unpacked</strong> button and select the extracted folder containing the extension files.
            </li>
            <li style={{ marginBottom: '0.75rem' }}>
              <strong>Pin to Toolbar:</strong> Click the puzzle icon in your browser's toolbar and pin the <strong>TLC Attendance</strong> extension for quick access.
            </li>
            <li style={{ marginBottom: '0.75rem' }}>
              <strong>Sign In to Extension:</strong> Click the pinned <strong>TLC Attendance</strong> extension icon in your browser toolbar and sign in using your TLC Attendance email and password.
            </li>
          </ol>

          {/* Configuration & Usage */}
          <div style={{ marginTop: '2rem', padding: '1.25rem', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={18} color="var(--color-success, #10b981)" />
              Authentication & Configuration
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.925rem', lineHeight: '1.5' }}>
              Once installed, open the extension popup by clicking its icon in your browser toolbar, and sign in using your TLC Attendance email and password. Once signed in, the extension will connect to your troop sessions and enable automated attendance syncing directly on Trail Life Connect.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
