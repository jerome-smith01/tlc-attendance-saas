import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle';
import './TermsOfService.css';

export function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="terms-page">
      {/* Top Header */}
      <header className="terms-header">
        <div className="terms-container terms-header-content">
          <div className="terms-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <img src="/logo.png" alt="TLC Attendance Logo" className="terms-logo" />
            <span className="terms-brand-name">TLC Attendance</span>
          </div>
          <div className="terms-header-actions">
            <ThemeToggle />
            <button 
              className="btn btn-secondary"
              onClick={() => navigate(-1)}
            >
              Back
            </button>
          </div>
        </div>
      </header>

      {/* Main Document Content */}
      <main className="terms-main">
        <div className="terms-container">
          <div className="terms-card glass-card">
            <h1 className="terms-title">TLC Attendance — Terms of Service</h1>
            <p className="terms-meta">
              <strong>Last Updated:</strong> August 14, 2026
            </p>

            <div className="terms-content">
              <section className="terms-section">
                <h2>1. Agreement to Terms & Eligibility</h2>
                <p>
                  These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of TLC Attendance (the &ldquo;Service&rdquo;), including the web application hosted at <code>https://tlc.goodplusfast.com</code> and its companion browser extension (together, the &ldquo;App&rdquo;). The Service is operated by Jerome Smith, doing business as <strong>Good Plus Fast</strong> (&ldquo;Good Plus Fast,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;), a sole proprietorship based in South Carolina, USA.
                </p>
                <p>
                  By creating an account, accepting a troop invitation, installing the browser extension, or otherwise using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
                </p>
                <p>
                  <strong>Eligibility:</strong> The Service is intended for use by authorized adult troop leaders, roster managers, and volunteer badge scanners who are <strong>18 years of age or older</strong>. Youth members (&ldquo;Trailmen&rdquo;) do not hold accounts and do not directly interact with the Service; their limited attendance data is entered and managed exclusively by authorized adult Users on their behalf. By using the Service, you represent that you are at least 18 years old and are authorized by your troop or organization to manage attendance data.
                </p>
              </section>

              <section className="terms-section">
                <h2>2. Independent Project & Trademark Disclaimer</h2>
                <p>
                  TLC Attendance is an <strong>independent software project</strong> created and operated by Good Plus Fast. It is <strong>not</strong> an official product of, and is <strong>not</strong> formally endorsed, sponsored, affiliated with, or operated by, Trail Life USA.
                </p>
                <p>
                  &ldquo;Trail Life,&rdquo; &ldquo;Trail Life USA,&rdquo; and &ldquo;Trail Life Connect&rdquo; (<code>traillifeconnect.com</code>) are trademarks of their respective owners, referenced here solely to describe interoperability with that third-party platform. Nothing in these Terms or in the App should be interpreted as an official partnership, sponsorship, or endorsement by Trail Life USA. If you have any doubt about the relationship between TLC Attendance and Trail Life USA, please contact us at <strong><a href="mailto:support@goodplusfast.com">support@goodplusfast.com</a></strong>.
                </p>
              </section>

              <section className="terms-section">
                <h2>3. Description of Service & Third-Party Dependencies</h2>
                <p>
                  TLC Attendance provides a QR-code-based badge scanning tool, roster management, and attendance session tracking for troop meetings and events, along with a browser extension (available today for <strong>Chrome and Edge</strong>, with Firefox support planned) that automates entering finalized attendance records into <code>traillifeconnect.com</code>.
                </p>
                <p>
                  <strong>Third-Party Portal Dependency:</strong> The browser extension operates by interacting with the third-party website <code>traillifeconnect.com</code> through DOM automation to check attendance boxes on your behalf. <strong>We do not own, operate, or control <code>traillifeconnect.com</code>.</strong> Accordingly:
                </p>
                <ul>
                  <li>We are not responsible for failed, delayed, incomplete, or inaccurate syncs caused by changes to Trail Life Connect&apos;s layout, downtime, access restrictions, or changes to its own terms or policies.</li>
                  <li>Use of the extension is subject to Trail Life Connect&apos;s own terms of use, and you are responsible for ensuring your use complies with them.</li>
                  <li><strong>You remain solely responsible for verifying that attendance records in your official troop portal (Trail Life Connect) are accurate</strong>, regardless of what TLC Attendance has synced or attempted to sync.</li>
                </ul>
                <p>
                  <strong>Offline & Field Conditions:</strong> The App includes offline scanning capability intended for use in spotty-connectivity outdoor/field environments. We do not guarantee uninterrupted, error-free, or lossless operation under all network conditions. See Section 8 (Disclaimer of Warranties) for more detail.
                </p>
              </section>

              <section className="terms-section">
                <h2>4. Account Registration, Roles & Security</h2>
                <p>
                  <strong>Creating an Account:</strong> You may create an account by signing up directly, or by accepting an invitation from an existing troop administrator. Each User&apos;s account is associated with one or more troops based on the roles and invitations granted to them.
                </p>
                <p>
                  <strong>One Account, One Troop Subscription:</strong> Each troop must maintain its <strong>own separate troop account/subscription</strong>, even if some of the same adult leaders serve multiple troops. A single leader may hold membership across multiple troops using one personal login, but the underlying <strong>troop-level subscription and data must not be shared, merged, or consolidated across troops</strong> to circumvent per-troop billing or to blur data boundaries between troops. See Section 5 and Section 10 for the consequences of violating this requirement.
                </p>
                <p>
                  <strong>Roles:</strong> The Service supports multiple permission levels (e.g., badge scanner, roster manager, troop admin, global admin). Your troop admin is responsible for assigning appropriate roles to Users within their troop.
                </p>
                <p>
                  <strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately at <strong><a href="mailto:support@goodplusfast.com">support@goodplusfast.com</a></strong> if you suspect unauthorized access to your account.
                </p>
                <p>
                  <strong>Data Accuracy:</strong> Some fields in the App have technical constraints (for example, the &ldquo;last initial&rdquo; field currently accepts a single character). You agree to enter data accurately within these field constraints and not to circumvent field limitations in ways that produce inaccurate or misleading records (for example, entering a full last name into the &ldquo;first name&rdquo; field). We are not responsible for downstream errors, confusion, or discrepancies with official troop records that result from inaccurate data entry by Users.
                </p>
              </section>

              <section className="terms-section">
                <h2>5. Acceptable Use & Prohibited Conduct</h2>
                <p>You agree not to:</p>
                <ul>
                  <li>Reverse engineer, decompile, disassemble, or attempt to derive the source code of the App, except where such restriction is prohibited by law.</li>
                  <li>Scrape, exploit, overload, or attempt to disrupt the Service&apos;s infrastructure.</li>
                  <li>Resell, sublicense, or provide the Service to third parties outside the scope of your troop&apos;s authorized use.</li>
                  <li><strong>Share, split, or consolidate a single troop account/subscription across multiple troops</strong> in order to avoid paying for separate troop subscriptions. Each troop requires its own subscription regardless of shared leadership or shared Users.</li>
                  <li>Enter deliberately false, misleading, or field-limitation-circumventing data (see Section 4) that misrepresents attendance records.</li>
                  <li>Use the Service in any manner that violates applicable law or the terms of any third-party service the App interacts with, including Trail Life Connect.</li>
                  <li>Misrepresent your affiliation with, or the App&apos;s affiliation with, Trail Life USA.</li>
                </ul>
                <p>Violation of this section may result in immediate suspension or termination of your account under Section 10.</p>
              </section>

              <section className="terms-section">
                <h2>6. Intellectual Property & License Grant</h2>
                <p>
                  <strong>Our IP:</strong> The TLC Attendance application, browser extension, source code, design, branding, and underlying technology are the property of Good Plus Fast and are protected by applicable intellectual property laws. Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your troop&apos;s internal attendance-management purposes.
                </p>
                <p>
                  <strong>Your Data:</strong> As between you/your troop and us, <strong>your troop retains ownership of the roster and attendance data you input into the Service</strong> (&ldquo;Troop Data&rdquo;). We act as a service provider processing that data on your behalf to operate the App.
                </p>
                <p>
                  <strong>Product Improvement:</strong> We may use Troop Data in <strong>aggregated and/or anonymized form</strong> (i.e., not reasonably identifiable to a specific troop or individual) to analyze usage, diagnose issues, and improve the Service. <strong>We do not sell, rent, or share Troop Data — aggregated, anonymized, or otherwise — with third parties for their own marketing or commercial purposes.</strong> See our Privacy Policy for further detail on data handling.
                </p>
              </section>

              <section className="terms-section">
                <h2>7. Subscription, Billing & Cancellation (Future-Ready)</h2>
                <p>
                  <strong>Current Status (Pilot):</strong> TLC Attendance is currently offered free of charge as part of a limited pilot covering select troops.
                </p>
                <p>
                  <strong>Planned Subscription Model:</strong> We intend to introduce paid subscriptions priced at <strong>$5 per troop per month</strong>, with unlimited Users included per troop subscription. Each troop requires its own subscription (see Section 4 and Section 5 regarding prohibited account/subscription sharing across troops).
                </p>
                <p>Once subscription billing is active:</p>
                <ul>
                  <li>Payment will be processed through Stripe. We do not directly store your full payment card information.</li>
                  <li>Fees are billed in advance on a recurring monthly basis unless otherwise stated at signup.</li>
                  <li>You may cancel your troop&apos;s subscription at any time; cancellation will take effect at the end of the current billing period, and no partial-month refunds will be issued except where required by law.</li>
                  <li>We reserve the right to modify pricing or introduce new subscription tiers with reasonable advance notice (e.g., 30 days) posted in the App or sent to the troop admin&apos;s registered email.</li>
                </ul>
              </section>

              <section className="terms-section">
                <h2>8. Disclaimer of Warranties (&ldquo;As-Is&rdquo;)</h2>
                <p>
                  THE SERVICE IS PROVIDED ON AN <strong>&ldquo;AS IS&rdquo;</strong> AND <strong>&ldquo;AS AVAILABLE&rdquo;</strong> BASIS, WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                </p>
                <p>Without limiting the foregoing, we do not warrant that:</p>
                <ul>
                  <li>The Service will be uninterrupted, error-free, or available at all times, particularly in low-connectivity or outdoor field conditions.</li>
                  <li>Attendance data will sync to Trail Life Connect completely, accurately, or without delay, given our dependency on that third-party platform (see Section 3).</li>
                  <li>Offline-cached scan data will be preserved without loss under all device or network conditions.</li>
                </ul>
                <p>
                  You acknowledge that TLC Attendance is an independent tool intended to assist with attendance tracking, and that <strong>you remain responsible for confirming the accuracy of official attendance records</strong> in Trail Life Connect or any other system of record your organization relies on.
                </p>
              </section>

              <section className="terms-section">
                <h2>9. Limitation of Liability & Indemnification</h2>
                <p>
                  <strong>Limitation of Liability:</strong> To the fullest extent permitted by law, Good Plus Fast and its operator shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of attendance data, event disruption, or reliance on inaccurate or delayed sync results, arising out of or related to your use of the Service.
                </p>
                <p>
                  <strong>Liability Cap:</strong> Our total aggregate liability to you for any claim arising out of or related to the Service shall not exceed <strong>the greater of (a) $100 USD, or (b) the total subscription fees paid by your troop to us in the twelve (12) months preceding the event giving rise to the claim.</strong>
                </p>
                <p>
                  <strong>Indemnification:</strong> You agree to indemnify and hold harmless Good Plus Fast from any claims, damages, or expenses (including reasonable attorneys&apos; fees) arising from your violation of these Terms, misuse of the Service, or violation of any third party&apos;s rights (including Trail Life USA&apos;s or Trail Life Connect&apos;s terms).
                </p>
              </section>

              <section className="terms-section">
                <h2>10. Account Suspension & Termination</h2>
                <p>
                  We reserve the right to <strong>suspend or terminate your account or your troop&apos;s access to the Service immediately, without prior notice</strong>, if we determine, in our reasonable discretion, that you or your troop have:
                </p>
                <ul>
                  <li>Violated these Terms, including the Acceptable Use provisions in Section 5;</li>
                  <li>Attempted to share, split, or consolidate a troop subscription across multiple troops to avoid per-troop billing (see Sections 4, 5, and 7);</li>
                  <li>Engaged in conduct that we believe poses a security, legal, or reputational risk to the Service or to Trail Life USA/Trail Life Connect;</li>
                  <li>Provided false or misleading information in connection with your account.</li>
                </ul>
                <p>
                  You may cancel your own account or your troop&apos;s subscription at any time by contacting <strong><a href="mailto:support@goodplusfast.com">support@goodplusfast.com</a></strong> or, where self-service tools are available, directly within the App.
                </p>
                <p>
                  Upon termination, your right to access the Service ends immediately. Provisions of these Terms that by their nature should survive termination (including Sections 6, 8, 9, 11, and 12) will survive.
                </p>
              </section>

              <section className="terms-section">
                <h2>11. Governing Law & Dispute Resolution</h2>
                <p>
                  <strong>Governing Law:</strong> These Terms are governed by the laws of the State of South Carolina, USA, without regard to its conflict-of-laws principles.
                </p>
                <p>
                  <strong>Binding Arbitration:</strong> Any dispute, claim, or controversy arising out of or relating to these Terms or the Service shall be resolved by <strong>binding arbitration</strong> administered by the American Arbitration Association (AAA) under its applicable rules, rather than in court, except that either party may bring an individual claim in small claims court if it qualifies. Arbitration will be conducted on an <strong>individual basis only</strong> — you agree to waive any right to participate in a class action or class-wide arbitration. The arbitration will take place in, or be otherwise connected to, South Carolina, unless you and we agree otherwise.
                </p>
              </section>

              <section className="terms-section">
                <h2>12. Modifications to Terms & Contact Information</h2>
                <p>
                  We may update these Terms from time to time, particularly as the Service evolves (e.g., introduction of paid subscriptions, new browser support, expanded features). Material changes will be reflected by updating the &ldquo;Last Updated&rdquo; date at the top of this page, and where appropriate, communicated to troop admins directly. Continued use of the Service after changes take effect constitutes your acceptance of the revised Terms.
                </p>
                <p>For questions about these Terms, contact:</p>
                <div className="terms-contact-box" style={{ background: 'var(--bg-secondary, rgba(255, 255, 255, 0.5))', border: '1px solid var(--border-color)', padding: '1.25rem', borderRadius: 'var(--radius-md, 12px)', marginTop: '0.75rem' }}>
                  <p style={{ marginBottom: '0.35rem' }}><strong>Good Plus Fast</strong></p>
                  <p style={{ marginBottom: '0.35rem' }}>Email: <strong><a href="mailto:support@goodplusfast.com">support@goodplusfast.com</a></strong></p>
                  <p style={{ marginBottom: '0.35rem' }}>Governing Jurisdiction: State of South Carolina, United States</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: 0 }}>
                    <em>(Good Plus Fast is currently operated as an individual/sole proprietorship and is not yet a formally registered legal entity. It will be registered in South Carolina upon formalization.)</em>
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="terms-footer">
        <div className="terms-container terms-footer-content">
          <span>&copy; {new Date().getFullYear()} TLC Attendance / Good Plus Fast</span>
          <div className="terms-footer-links">
            <button className="terms-footer-link-btn" onClick={() => navigate('/')}>Home</button>
            <button className="terms-footer-link-btn" onClick={() => navigate('/login')}>Sign In</button>
            <button className="terms-footer-link-btn" onClick={() => navigate('/privacy')}>Privacy Policy</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
