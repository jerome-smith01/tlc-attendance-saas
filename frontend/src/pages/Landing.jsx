import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTroop } from '../context/TroopContext';
import { ThemeToggle } from '../components/ThemeToggle';
import './Landing.css';

export function Landing() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { selectedTroop, troops, loadingTroops } = useTroop();
  const [showSignUpModal, setShowSignUpModal] = useState(false);

  // If already logged in (e.g., returning from OAuth), bounce to appropriate home route
  useEffect(() => {
    if (session && !loadingTroops) {
      const userRole = selectedTroop?.currentUserRole || troops?.[0]?.currentUserRole;
      if (userRole === 'badge_scanner') {
        navigate('/events', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [session, loadingTroops, selectedTroop, troops, navigate]);

  // If we have a session, don't render the landing page while waiting to redirect
  if (session) {
    return (
      <div className="landing-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <span className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--color-primary)' }} />
      </div>
    );
  }

  return (
    <div className="landing-page">
      {/* Navigation Header */}
      <header className="landing-header">
        <div className="landing-container landing-header-content">
          <div className="landing-brand">
            <img src="/logo.png" alt="TLC Attendance Logo" className="landing-logo" />
            <span className="landing-brand-name">TLC Attendance</span>
          </div>
          <div className="landing-header-actions">
            <ThemeToggle />
            <button 
              className="btn btn-secondary landing-btn-signin"
              onClick={() => navigate('/login')}
            >
              Sign In
            </button>
            <button 
              className="btn btn-primary landing-btn-signup"
              onClick={() => setShowSignUpModal(true)}
            >
              Sign Up
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="landing-main">
        {/* Hero Section */}
        <section className="landing-hero">
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-text">
              <span className="landing-badge">Smart Attendance Platform</span>
              <h1 className="landing-title">
                Effortless Attendance & Roster Management for Troops
              </h1>
              <p className="landing-subtitle">
                Streamline event check-ins with lightning-fast badge scanning, detailed member rosters, and real-time attendance analytics.
              </p>
              <div className="landing-hero-ctas">
                <button 
                  className="btn btn-primary landing-cta-primary"
                  onClick={() => setShowSignUpModal(true)}
                >
                  Get Started Free
                </button>
                <button 
                  className="btn btn-secondary landing-cta-secondary"
                  onClick={() => navigate('/login')}
                >
                  Sign In to Account
                </button>
              </div>
            </div>
            <div className="landing-hero-image-wrapper">
              <img 
                src="/placeholder-box.svg" 
                alt="App Interface Placeholder" 
                className="landing-hero-image" 
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="landing-features">
          <div className="landing-container">
            <div className="landing-section-header">
              <h2>Powerful Features Built for Leaders</h2>
              <p>Everything you need to keep your meetings, events, and rosters running seamlessly.</p>
            </div>
            <div className="landing-features-grid">
              <div className="landing-feature-card">
                <div className="landing-feature-icon">🔍</div>
                <h3>Badge & QR Scanner</h3>
                <p>Scan member badges or QR codes instantly at events for fast, error-free check-ins on mobile or tablet.</p>
              </div>
              <div className="landing-feature-card">
                <div className="landing-feature-icon">📋</div>
                <h3>Roster Management</h3>
                <p>Easily organize members, track roles, send invitations, and manage troop records in one place.</p>
              </div>
              <div className="landing-feature-card">
                <div className="landing-feature-icon">📊</div>
                <h3>Real-Time Analytics</h3>
                <p>Monitor event attendance metrics live, export reports, and track participation history over time.</p>
              </div>
              <div className="landing-feature-card">
                <div className="landing-feature-icon">📱</div>
                <h3>Mobile First & Responsive</h3>
                <p>Access your troop dashboard anytime, anywhere on smartphone, tablet, or desktop.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="landing-cta-banner">
          <div className="landing-container landing-cta-banner-content">
            <h2>Ready to simplify your troop attendance?</h2>
            <p>Join troops simplifying their event management today.</p>
            <div className="landing-banner-ctas">
              <button 
                className="btn btn-primary landing-cta-primary"
                onClick={() => setShowSignUpModal(true)}
              >
                Sign Up Now
              </button>
              <button 
                className="btn btn-secondary landing-cta-secondary"
                onClick={() => navigate('/login')}
              >
                Existing User Sign In
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Section */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-content">
          <div className="landing-footer-brand">
            <img src="/logo.png" alt="Logo" className="landing-footer-logo" />
            <span>TLC Attendance Platform</span>
          </div>
          <div className="landing-footer-links">
            <button 
              className="landing-footer-link"
              onClick={() => navigate('/privacy')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Privacy Policy
            </button>
            <span style={{ color: 'var(--border-color)', margin: '0 0.25rem' }}>•</span>
            <button 
              className="landing-footer-link"
              onClick={() => navigate('/terms')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Terms of Service
            </button>
            <span style={{ color: 'var(--border-color)', margin: '0 0.25rem' }}>•</span>
            <a 
              href="https://goodplusfast.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="landing-footer-link"
            >
              Created by Good + Fast
            </a>
          </div>
        </div>
      </footer>

      {/* Sign Up Placeholder Modal */}
      {showSignUpModal && (
        <div className="landing-modal-overlay" onClick={() => setShowSignUpModal(false)}>
          <div 
            className="landing-modal" 
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="signup-modal-title"
          >
            <button 
              className="landing-modal-close" 
              onClick={() => setShowSignUpModal(false)}
              aria-label="Close modal"
            >
              &times;
            </button>
            <div className="landing-modal-content">
              <div className="landing-modal-icon">🚀</div>
              <h3 id="signup-modal-title">Sign Up Coming Soon!</h3>
              <p>Self-service signup is currently under construction. Please reach out to your troop administrator for an invite, or check back soon!</p>
              <div className="landing-modal-actions">
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowSignUpModal(false)}
                >
                  Got It
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowSignUpModal(false);
                    navigate('/login');
                  }}
                >
                  Go to Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
