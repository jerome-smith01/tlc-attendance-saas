import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle';
import './PrivacyPolicy.css';

export function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="privacy-page">
      {/* Top Header */}
      <header className="privacy-header">
        <div className="privacy-container privacy-header-content">
          <div className="privacy-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <img src="/logo.png" alt="TLC Attendance Logo" className="privacy-logo" />
            <span className="privacy-brand-name">TLC Attendance</span>
          </div>
          <div className="privacy-header-actions">
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
      <main className="privacy-main">
        <div className="privacy-container">
          <div className="privacy-card glass-card">
            <h1 className="privacy-title">TLC Attendance — Privacy Policy</h1>
            <p className="privacy-meta">
              <strong>Last Updated:</strong> August 14, 2026
            </p>

            <div className="privacy-content">
              <section className="privacy-section">
                <h2>1. Introduction & Scope</h2>
                <p>
                  TLC Attendance (&ldquo;the App,&rdquo; &ldquo;the Service,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) is an independent software project developed and operated by Jerome Smith, operating under the name <strong>Good Plus Fast</strong> (&ldquo;Good Plus Fast,&rdquo; &ldquo;the Operator&rdquo;). This Privacy Policy explains what information TLC Attendance collects, how it is used, and how it is protected when you use the TLC Attendance web application and its companion browser extension.
                </p>
                <p>
                  TLC Attendance is an <strong>independent project</strong> built to help troop leaders and volunteer badge scanners in Trail Life USA troops (and similar youth organizations) take attendance more efficiently. TLC Attendance is <strong>not an official product of, and is not formally endorsed, sponsored, or operated by, Trail Life USA</strong>. References to &ldquo;Trail Life Connect&rdquo; and <code>traillifeconnect.com</code> describe the official third-party portal that TLC Attendance is designed to sync with — TLC Attendance does not own, operate, or control that portal.
                </p>
                <p>
                  This policy applies to all users of the TLC Attendance web app and browser extension (available today for Chrome and Edge, with Firefox and other browsers planned), including troop administrators, roster managers, and badge scanners (&ldquo;Adult Leaders&rdquo; or &ldquo;Users&rdquo;), as well as the youth members (&ldquo;Trailmen&rdquo;) whose limited attendance data is processed on their behalf by Adult Leaders.
                </p>
                <p>
                  By using TLC Attendance, you agree to the practices described in this policy.
                </p>
              </section>

              <section className="privacy-section">
                <h2>2. Protection of Children&apos;s Privacy (COPPA & Youth Data Minimization)</h2>
                <p>
                  TLC Attendance is designed <strong>for use by adult troop leaders</strong>, not directly by children. Youth members do not create accounts, log in, or interact with the App or extension themselves.
                </p>
                <p>We take a <strong>data minimization-first approach</strong> to any information relating to minors:</p>
                <ul>
                  <li>We do <strong>not</strong> collect names in full — only a youth member&apos;s <strong>first name and last initial</strong>.</li>
                  <li>We do <strong>not</strong> collect email addresses, phone numbers, home addresses, dates of birth, photos, video, or any biometric data for youth members.</li>
                  <li>We do <strong>not</strong> allow youth members to create their own accounts or directly submit information to TLC Attendance.</li>
                  <li>All youth attendance data is entered and managed exclusively by <strong>authorized adult troop leaders</strong>, who act under the consent and authority already established between parents/guardians and the troop/organization under its own charter and enrollment process.</li>
                  <li>Attendance records tied to a youth member are limited to: first name, last initial, Troop Member ID number, TLC ID number, and check-in timestamps tied to a specific event or session.</li>
                </ul>
                <p>
                  Because TLC Attendance does not collect personal information directly from children, and youth data is limited to non-identifying attendance metadata entered by supervising adults, we do not believe TLC Attendance constitutes a service &ldquo;directed to children&rdquo; under COPPA. However, we voluntarily apply COPPA-consistent data minimization practices described throughout this policy. If you are a parent or guardian and have questions about your child&apos;s attendance record, please see Section 10 (User Rights), which explains how to reach your troop administrator or <a href="mailto:support@goodplusfast.com">support@goodplusfast.com</a>.
                </p>
              </section>

              <section className="privacy-section">
                <h2>3. Information We Collect</h2>

                <h3>A. Youth Members (Trailmen)</h3>
                <ul>
                  <li>First name and last initial</li>
                  <li>Troop Member ID number</li>
                  <li>TLC ID number</li>
                  <li>Attendance check-in timestamps and associated event/session</li>
                </ul>
                <p>No other data is collected for youth members. See Section 2 above.</p>

                <h3>B. Adult Leaders & Registered Users</h3>
                <p>When you create an account as a troop leader, roster manager, or badge scanner, we collect:</p>
                <ul>
                  <li>Email address</li>
                  <li>Encrypted authentication credentials (password hashing/management is handled by our authentication provider, Supabase Auth — we never store your password in plain text)</li>
                  <li>Display name</li>
                  <li>Troop role (e.g., badge scanner, roster manager, troop admin, global admin)</li>
                  <li>Troop affiliation(s)</li>
                  <li>Usage and audit logs: timestamps of scans performed, events created, sessions closed or synced, and roster changes made</li>
                </ul>

                <h3>C. Camera & Device Access</h3>
                <p>
                  TLC Attendance uses your device&apos;s camera to scan QR codes on member badges (via the <code>html5-qrcode</code> library). This access is used <strong>only</strong> for real-time, on-device barcode recognition.
                </p>
                <ul>
                  <li>Video/camera streams are processed temporarily in your browser&apos;s memory.</li>
                  <li><strong>No images, video, or camera recordings are ever saved, stored on your device, or uploaded to our servers.</strong></li>
                </ul>

                <h3>D. Browser Extension</h3>
                <p>
                  Our browser extension is an optional tool for troop leaders that automates entering finalized attendance into <code>traillifeconnect.com</code>. It is built on the Manifest V3 extension standard and is available today for Chrome and Edge, with support for Firefox and other browsers planned. The extension:
                </p>
                <ul>
                  <li>Communicates only with our Supabase database to retrieve approved, closed attendance sessions.</li>
                  <li>Requests host permissions scoped specifically to <code>traillifeconnect.com/attendance</code> — not the domain as a whole — and interacts only with the DOM of that specific page to check attendance boxes for matching member IDs.</li>
                  <li>Does <strong>not</strong> track your general web browsing, browsing history, or search activity, and does not run on or interact with any other website or page.</li>
                </ul>

                <h3>E. Local Storage & Cookies</h3>
                <p>We use browser local storage (not third-party tracking cookies) to store:</p>
                <ul>
                  <li>Session/authentication tokens</li>
                  <li>UI preferences (e.g., light/dark theme)</li>
                  <li>Your currently selected troop</li>
                  <li>Offline scan data, cached temporarily until it can sync</li>
                </ul>
                <p>We do <strong>not</strong> use third-party advertising trackers, marketing pixels, or data brokers of any kind.</p>
              </section>

              <section className="privacy-section">
                <h2>4. How We Use Information</h2>
                <p>We use the information described above solely to operate the Service, specifically to:</p>
                <ul>
                  <li>Authenticate Users and enforce troop-level access permissions</li>
                  <li>Record and manage attendance for troop meetings and events</li>
                  <li>Sync approved attendance records to Trail Life Connect on a leader&apos;s behalf</li>
                  <li>Maintain audit logs for troop administrators to review scan and roster activity</li>
                  <li>Diagnose and fix technical issues with the App or extension</li>
                  <li>Enable offline scanning with later sync when connectivity is restored</li>
                </ul>
                <p>We do not sell data, share data with advertisers, or use youth or leader data for any purpose beyond operating TLC Attendance.</p>
              </section>

              <section className="privacy-section">
                <h2>5. Device Permissions & Camera Usage (QR Scanning)</h2>
                <p>
                  Camera access is requested only when you actively use the badge-scanning feature and is used exclusively for local, real-time QR code recognition. You can revoke camera permission at any time through your browser or device settings; doing so will disable the scanning feature but will not affect other parts of the App.
                </p>
              </section>

              <section className="privacy-section">
                <h2>6. Browser Extension Privacy & Data Practices</h2>
                <p>
                  The TLC Attendance browser extension operates under the principle of least privilege, and this applies equally across every supported browser (Chrome and Edge today, with Firefox planned):
                </p>
                <ul>
                  <li>It requests host permissions limited specifically to <code>traillifeconnect.com/attendance</code> — the exact page it needs to interact with — rather than broad access to the entire <code>traillifeconnect.com</code> domain or to the web in general.</li>
                  <li>It reads approved attendance data from our Supabase backend and writes corresponding check-boxes into the Trail Life Connect attendance page.</li>
                  <li>It does not collect, transmit, or store any data beyond what is necessary to complete this sync action.</li>
                  <li>Uninstalling the extension at any time immediately stops all of its activity; it retains no data locally beyond what the browser&apos;s standard extension storage requires for basic operation.</li>
                </ul>
              </section>

              <section className="privacy-section">
                <h2>7. Data Storage, Multi-Tenancy & Security</h2>
                <ul>
                  <li><strong>Hosting:</strong> The web application is hosted on Cloudflare Pages.</li>
                  <li><strong>Database & Authentication:</strong> Data is stored in Supabase (PostgreSQL), with authentication handled via Supabase Auth (JWT-based sessions).</li>
                  <li><strong>Row-Level Security (RLS):</strong> Every troop&apos;s data is isolated using database-level Row-Level Security policies. Users can only access data for troops they belong to and only to the extent their assigned role permits.</li>
                  <li><strong>Encryption:</strong> All data in transit is encrypted via TLS/HTTPS. Data at rest is encrypted within the Supabase-managed PostgreSQL database.</li>
                  <li><strong>Future Billing:</strong> If/when troop subscription billing is introduced, payment processing will be handled by Stripe. TLC Attendance does not and will not directly store credit card numbers or full payment credentials.</li>
                </ul>
                <p>
                  <strong>Current Deployment Status:</strong> TLC Attendance is currently operated as a small pilot by its developer, covering two troops. The multi-tenant architecture described above (RLS-enforced isolation) is built to support additional troops as the Service grows, and each troop&apos;s data remains isolated from the other&apos;s regardless of pilot size.
                </p>
              </section>

              <section className="privacy-section">
                <h2>8. Data Retention & Deletion Policies</h2>
                <ul>
                  <li><strong>Attendance Record Lifecycle:</strong> Scan/attendance records are retained only as long as needed to complete synchronization with Trail Life Connect, after which they are subject to periodic purge cycles to minimize how long attendance history is stored in our system.</li>
                  <li><strong>Account Data:</strong> Adult Leader account information (email, display name, role) is retained for as long as the account remains active, or until deletion is requested.</li>
                  <li>
                    <strong>Deletion Requests:</strong>
                    <ul>
                      <li><strong>Troop admins</strong> can delete youth attendance records themselves, directly within the App, without needing to contact us.</li>
                      <li>For account deletion, data corrections, or any request a troop admin cannot complete on their own, contact <a href="mailto:support@goodplusfast.com">support@goodplusfast.com</a>, and the request will be handled manually by the Operator.</li>
                      <li>We aim to fulfill manual deletion requests within 10 business days.</li>
                    </ul>
                  </li>
                </ul>
              </section>

              <section className="privacy-section">
                <h2>9. Third-Party Service Providers</h2>
                <p>We rely on the following infrastructure providers to operate TLC Attendance. Each processes data only as necessary to provide their respective service, under their own privacy and security terms:</p>
                <div className="privacy-table-wrapper">
                  <table className="privacy-table">
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Purpose</th>
                        <th>Data Involved</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Supabase</strong></td>
                        <td>Database hosting, authentication</td>
                        <td>Account data, troop data, attendance records</td>
                      </tr>
                      <tr>
                        <td><strong>Cloudflare Pages</strong></td>
                        <td>Web application hosting</td>
                        <td>Standard web traffic/hosting logs</td>
                      </tr>
                      <tr>
                        <td><strong>Stripe</strong> <em>(future)</em></td>
                        <td>Subscription billing</td>
                        <td>Payment/billing information (not yet active)</td>
                      </tr>
                      <tr>
                        <td><strong>Trail Life Connect</strong> (<code>traillifeconnect.com</code>)</td>
                        <td>Destination for synced attendance data (via extension)</td>
                        <td>Approved attendance records only</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p>We do not share data with any other third party, including advertisers or data brokers.</p>
              </section>

              <section className="privacy-section">
                <h2>10. User Rights & Managing Your Data</h2>
                <p>Depending on your role, you have the following rights and options:</p>
                <ul>
                  <li><strong>Troop Admins:</strong> Can directly view, correct, and delete youth attendance records and manage roster data within the App.</li>
                  <li><strong>Adult Leaders:</strong> Can request corrections to their own account information or ask a troop admin/the Operator to do so.</li>
                  <li><strong>Parents/Guardians:</strong> May request to know what limited data (first name, last initial, Troop Member ID, TLC ID, attendance timestamps) is on file for your child and to request its deletion. See &ldquo;Verifying Parent/Guardian Requests&rdquo; below for how these requests are handled.</li>
                  <li><strong>All Users (Adult Leaders):</strong> May request a copy of their own account data or full account deletion by emailing <a href="mailto:support@goodplusfast.com">support@goodplusfast.com</a>. Because these requests come from a registered account holder we can identify directly (by email/account), no additional verification step is needed.</li>
                </ul>

                <div className="privacy-callout">
                  <p><strong>Verifying Parent/Guardian Requests:</strong> TLC Attendance intentionally does not collect parent or guardian contact information, and does not maintain any record linking a specific adult to a specific youth member — this is a deliberate part of our data minimization approach (see Section 2). As a result, we have no independent way to verify a parent/guardian&apos;s identity or relationship to a child directly through the App or by email.</p>
                  <p>For this reason, <strong>all parent/guardian data requests are routed through the youth member&apos;s troop administrator</strong>, who already has independent, real-world knowledge of the families in their troop through the organization&apos;s own enrollment and charter process. If you are a parent or guardian:</p>
                  <ol>
                    <li>Contact your troop administrator directly — they can look up, share, or delete your child&apos;s attendance record on the spot.</li>
                    <li>If you&apos;re unsure who your troop administrator is, or are unable to reach them, email <a href="mailto:support@goodplusfast.com">support@goodplusfast.com</a> and we will help route your request to the correct troop administrator for verification before any data is disclosed or deleted.</li>
                  </ol>
                  <p>We will not disclose or delete a youth member&apos;s data based solely on an unverified email claiming a parental relationship, in order to protect against impersonation.</p>
                </div>

                <p>
                  Because TLC Attendance is currently a single-developer independent project, most non-self-service requests (such as full account deletion or troop-admin-assisted deletion) are handled manually by the Operator or the relevant troop administrator upon request.
                </p>
              </section>

              <section className="privacy-section">
                <h2>11. Changes to This Policy</h2>
                <p>
                  We may update this Privacy Policy as TLC Attendance evolves — for example, as it grows beyond a single-troop pilot or as new features (like billing) are introduced. Material changes will be reflected by updating the &ldquo;Last Updated&rdquo; date at the top of this page. Continued use of the App after changes take effect constitutes acceptance of the revised policy.
                </p>
              </section>

              <section className="privacy-section">
                <h2>12. Contact Information</h2>
                <p>For any privacy questions, data requests, or concerns, contact:</p>
                <div className="privacy-contact-box">
                  <p><strong>Good Plus Fast</strong></p>
                  <p>Email: <a href="mailto:support@goodplusfast.com">support@goodplusfast.com</a></p>
                  <p>Governing Jurisdiction: State of South Carolina, United States</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    <em>(Good Plus Fast is currently operated as an individual/sole proprietorship and is not yet a formally registered legal entity. It will be registered in South Carolina upon formalization.)</em>
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="privacy-footer">
        <div className="privacy-container privacy-footer-content">
          <span>&copy; {new Date().getFullYear()} TLC Attendance / Good Plus Fast</span>
          <div className="privacy-footer-links">
            <button className="privacy-footer-link-btn" onClick={() => navigate('/')}>Home</button>
            <button className="privacy-footer-link-btn" onClick={() => navigate('/login')}>Sign In</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
