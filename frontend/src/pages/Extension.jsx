import React, { useState, useEffect } from 'react';
import { Download, Monitor, AlertTriangle, CheckCircle2, Puzzle } from 'lucide-react';

const ChromeSvg = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
      <path d="M5.7954035,8.36130434 C16.9522782,-4.62351526 37.639151,-2.06037988 45.3727574,13.1072081 C39.9288251,13.1091897 31.4040328,13.1055761 26.786937,13.1072081 C23.4382318,13.1083738 21.2761308,13.0322537 18.9347285,14.2648621 C16.1820632,15.7138239 14.1051274,18.3997073 13.3801164,21.5544341 L5.7954035,8.36130434 Z" fill="#EA4335" />
      <path d="M16.015461,23.9991346 C16.015461,28.3998753 19.5936811,31.9800817 23.9919804,31.9800817 C28.3901632,31.9800817 31.9683834,28.3998753 31.9683834,23.9991346 C31.9683834,19.5985104 28.3901632,16.0181875 23.9919804,16.0181875 C19.5936811,16.0181875 16.015461,19.5985104 16.015461,23.9991346 Z" fill="#4285F4" />
      <path d="M27.0876366,34.4456482 C22.6105798,35.7761751 17.371347,34.3006354 14.5014777,29.3468879 C12.3108329,25.5655987 6.52286114,15.4823164 3.89206021,10.8973955 C-5.32185953,25.0194695 2.61924235,44.2642006 19.3464574,47.5489026 L27.0876366,34.4456482 Z" fill="#34A853" />
      <path d="M31.4014697,16.0181875 C35.1303309,19.4863704 35.9427207,25.102234 33.4168909,29.4566966 C31.5138971,32.7374352 25.4402549,42.9884614 22.4966379,47.9523505 C39.730883,49.0147671 52.2944399,32.1238121 46.6195946,16.0181875 L31.4014697,16.0181875 Z" fill="#FBBC05" />
    </g>
  </svg>
);

const EdgeSvg = () => (
  <svg width="18" height="18" viewBox="0 0 256 256">
    <defs>
      <linearGradient id="edge-linear-1" gradientUnits="userSpaceOnUse" x1="63.3343" y1="757.83" x2="241.6165" y2="757.83" gradientTransform="matrix(1 0 0 1 -4.63 -580.8098)">
        <stop offset="0" stopColor="#0C59A4"/>
        <stop offset="1" stopColor="#114A8B"/>
      </linearGradient>
      <radialGradient id="edge-radial-1" cx="161.83" cy="788.4008" r="95.38" gradientTransform="matrix(0.9999 0 0 0.9498 -4.6217 -570.3868)" gradientUnits="userSpaceOnUse">
        <stop offset="0.72" stopColor="#000000" stopOpacity="0"/>
        <stop offset="0.95" stopColor="#000000" stopOpacity="0.53"/>
        <stop offset="1" stopColor="#000000"/>
      </radialGradient>
      <linearGradient id="edge-linear-2" gradientUnits="userSpaceOnUse" x1="157.4013" y1="680.5561" x2="46.0276" y2="801.8683" gradientTransform="matrix(1 0 0 1 -4.63 -580.8098)">
        <stop offset="0" stopColor="#1B9DE2"/>
        <stop offset="0.16" stopColor="#1595DF"/>
        <stop offset="0.67" stopColor="#0680D7"/>
        <stop offset="1" stopColor="#0078D4"/>
      </linearGradient>
      <radialGradient id="edge-radial-2" cx="-773.6357" cy="746.7146" r="143.24" gradientTransform="matrix(0.15 -0.9898 0.8 0.12 -410.7182 -656.3412)" gradientUnits="userSpaceOnUse">
        <stop offset="0.76" stopColor="#000000" stopOpacity="0"/>
        <stop offset="0.95" stopColor="#000000" stopOpacity="0.5"/>
        <stop offset="1" stopColor="#000000"/>
      </radialGradient>
      <radialGradient id="edge-radial-3" cx="230.5926" cy="-106.0381" r="202.4299" gradientTransform="matrix(-3.999750e-02 0.9998 -2.1299 -7.998414e-02 -190.7749 -191.6354)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#35C1F1"/>
        <stop offset="0.11" stopColor="#34C1ED"/>
        <stop offset="0.23" stopColor="#2FC2DF"/>
        <stop offset="0.31" stopColor="#2BC3D2"/>
        <stop offset="0.67" stopColor="#36C752"/>
      </radialGradient>
      <radialGradient id="edge-radial-4" cx="536.3567" cy="-117.7029" r="97.34" gradientTransform="matrix(0.28 0.9598 -0.78 0.23 -1.9279 -410.3179)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#66EB6E"/>
        <stop offset="1" stopColor="#66EB6E" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <g>
      <path fill="url(#edge-linear-1)" d="M231,190.5c-3.4,1.8-6.9,3.4-10.5,4.7c-11.5,4.3-23.6,6.5-35.9,6.5c-47.3,0-88.5-32.5-88.5-74.3 c0.1-11.4,6.4-21.9,16.4-27.3c-42.8,1.8-53.8,46.4-53.8,72.5c0,73.9,68.1,81.4,82.8,81.4c7.9,0,19.8-2.3,27-4.6l1.3-0.4 c27.6-9.5,51-28.1,66.6-52.8c1.2-1.9,0.6-4.3-1.2-5.5C233.9,189.9,232.3,189.8,231,190.5z"/>
      <path opacity="0.35" fill="url(#edge-radial-1)" d="M231,190.5c-3.4,1.8-6.9,3.4-10.5,4.7 c-11.5,4.3-23.6,6.5-35.9,6.5c-47.3,0-88.5-32.5-88.5-74.3c0.1-11.4,6.4-21.9,16.4-27.3c-42.8,1.8-53.8,46.4-53.8,72.5 c0,73.9,68.1,81.4,82.8,81.4c7.9,0,19.8-2.3,27-4.6l1.3-0.4c27.6-9.5,51-28.1,66.6-52.8c1.2-1.9,0.6-4.3-1.2-5.5 C233.9,189.9,232.3,189.8,231,190.5z"/>
      <path fill="url(#edge-linear-2)" d="M105.7,241.4c-8.9-5.5-16.6-12.8-22.7-21.3c-26.3-36-18.4-86.5,17.6-112.8c3.8-2.7,7.7-5.2,11.9-7.2 c3.1-1.5,8.4-4.1,15.5-4c10.1,0.1,19.6,4.9,25.7,13c4,5.4,6.3,11.9,6.4,18.7c0-0.2,24.5-79.6-80-79.6c-43.9,0-80,41.7-80,78.2 c-0.2,19.3,4,38.5,12.1,56c27.6,58.8,94.8,87.6,156.4,67.1C147.5,256.1,124.5,253.2,105.7,241.4L105.7,241.4z"/>
      <path opacity="0.41" fill="url(#edge-radial-2)" d="M105.7,241.4c-8.9-5.5-16.6-12.8-22.7-21.3 c-26.3-36-18.4-86.5,17.6-112.8c3.8-2.7,7.7-5.2,11.9-7.2c3.1-1.5,8.4-4.1,15.5-4c10.1,0.1,19.6,4.9,25.7,13 c4,5.4,6.3,11.9,6.4,18.7c0-0.2,24.5-79.6-80-79.6c-43.9,0-80,41.7-80,78.2c-0.2,19.3,4,38.5,12.1,56 c27.6,58.8,94.8,87.6,156.4,67.1C147.5,256.1,124.5,253.2,105.7,241.4L105.7,241.4z"/>
      <path fill="url(#edge-radial-3)" d="M152.3,148.9c-0.8,1-3.3,2.5-3.3,5.7c0,2.6,1.7,5.1,4.7,7.2c14.4,10,41.5,8.7,41.6,8.7 c10.7,0,21.1-2.9,30.3-8.3c18.8-11,30.4-31.1,30.4-52.9c0.3-22.4-8-37.3-11.3-43.9C223.5,23.9,177.7,0,128,0C58,0,1,56.2,0,126.2 c0.5-36.5,36.8-66,80-66c3.5,0,23.5,0.3,42,10.1c16.3,8.6,24.9,18.9,30.8,29.2c6.2,10.7,7.3,24.1,7.3,29.5 C160.1,134.3,157.4,142.3,152.3,148.9z"/>
      <path fill="url(#edge-radial-4)" d="M152.3,148.9c-0.8,1-3.3,2.5-3.3,5.7c0,2.6,1.7,5.1,4.7,7.2c14.4,10,41.5,8.7,41.6,8.7 c10.7,0,21.1-2.9,30.3-8.3c18.8-11,30.4-31.1,30.4-52.9c0.3-22.4-8-37.3-11.3-43.9C223.5,23.9,177.7,0,128,0C58,0,1,56.2,0,126.2 c0.5-36.5,36.8-66,80-66c3.5,0,23.5,0.3,42,10.1c16.3,8.6,24.9,18.9,30.8,29.2c6.2,10.7,7.3,24.1,7.3,29.5 C160.1,134.3,157.4,142.3,152.3,148.9z"/>
    </g>
  </svg>
);

export function Extension() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isMobileUA || isSmallScreen);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

      {isMobile ? (
        /* Mobile Only Warning Banner */
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
      ) : (
        /* Desktop Only Content (Download & Instructions) */
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span>Supported:</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.53rem', borderRadius: '6px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', fontWeight: '600', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                    <ChromeSvg />
                    Google Chrome
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.53rem', borderRadius: '6px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', fontWeight: '600', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                    <EdgeSvg />
                    Microsoft Edge
                  </span>
                </div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1.5rem 0' }} />

            {/* Installation Instructions */}
            <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Monitor size={20} />
              Installation & Setup Instructions
            </h2>
            <p style={{ margin: '0 0 1.25rem 0', color: 'var(--text-secondary)', fontSize: '0.925rem' }}>
              Note: The extension only works on <strong>Google Chrome</strong> and <strong>Microsoft Edge</strong> desktop browsers.
            </p>

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
      )}
    </div>
  );
}

