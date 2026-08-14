# TLC Attendance — Privacy Policy

> [!CAUTION]
> **AI SYSTEM INSTRUCTIONS**
> 1. You must review this Privacy Policy document when making future code changes (e.g., adding a Firefox add-in) to see if there are any required changes.
> 2. If policy updates are required based on the code changes, you must summarize the change to the policy at the top of this document.
> 3. You **MUST** get explicit approval from the user before changing the language of the policy. You cannot assume the user approved just because they didn't respond.
> 4. AI agents can update these instructions in this document without explicit approval, but **NOT** the policy text itself.



**Last Updated:** [Insert Publish Date]

## 1. Introduction & Scope

TLC Attendance ("the App," "the Service," "we," "us") is an independent software project developed and operated by Jerome Smith, operating under the name **Good Plus Fast** ("Good Plus Fast," "the Operator"). This Privacy Policy explains what information TLC Attendance collects, how it is used, and how it is protected when you use the TLC Attendance web application and its companion browser extension.

TLC Attendance is an **independent project** built to help troop leaders and volunteer badge scanners in Trail Life USA troops (and similar youth organizations) take attendance more efficiently. TLC Attendance is **not an official product of, and is not formally endorsed, sponsored, or operated by, Trail Life USA**. References to "Trail Life Connect" and `traillifeconnect.com` describe the official third-party portal that TLC Attendance is designed to sync with — TLC Attendance does not own, operate, or control that portal.

This policy applies to all users of the TLC Attendance web app and browser extension (available today for Chrome and Edge, with Firefox and other browsers planned), including troop administrators, roster managers, and badge scanners ("Adult Leaders" or "Users"), as well as the youth members ("Trailmen") whose limited attendance data is processed on their behalf by Adult Leaders.

By using TLC Attendance, you agree to the practices described in this policy.

---

## 2. Protection of Children's Privacy (COPPA & Youth Data Minimization)

TLC Attendance is designed **for use by adult troop leaders**, not directly by children. Youth members do not create accounts, log in, or interact with the App or extension themselves.

We take a **data minimization-first approach** to any information relating to minors:

- We do **not** collect names in full — only a youth member's **first name and last initial**.
- We do **not** collect email addresses, phone numbers, home addresses, dates of birth, photos, video, or any biometric data for youth members.
- We do **not** allow youth members to create their own accounts or directly submit information to TLC Attendance.
- All youth attendance data is entered and managed exclusively by **authorized adult troop leaders**, who act under the consent and authority already established between parents/guardians and the troop/organization under its own charter and enrollment process.
- Attendance records tied to a youth member are limited to: first name, last initial, Troop Member ID number, TLC ID number, and check-in timestamps tied to a specific event or session.

Because TLC Attendance does not collect personal information directly from children, and youth data is limited to non-identifying attendance metadata entered by supervising adults, we do not believe TLC Attendance constitutes a service "directed to children" under COPPA. However, we voluntarily apply COPPA-consistent data minimization practices described throughout this policy. If you are a parent or guardian and have questions about your child's attendance record, please see Section 10 (User Rights), which explains how to reach your troop administrator or **support@goodplusfast.com**.

---

## 3. Information We Collect

### A. Youth Members (Trailmen)
- First name and last initial
- Troop Member ID number
- TLC ID number
- Attendance check-in timestamps and associated event/session

No other data is collected for youth members. See Section 2 above.

### B. Adult Leaders & Registered Users
When you create an account as a troop leader, roster manager, or badge scanner, we collect:
- Email address
- Encrypted authentication credentials (password hashing/management is handled by our authentication provider, Supabase Auth — we never store your password in plain text)
- Display name
- Troop role (e.g., badge scanner, roster manager, troop admin, global admin)
- Troop affiliation(s)
- Usage and audit logs: timestamps of scans performed, events created, sessions closed or synced, and roster changes made

### C. Camera & Device Access
TLC Attendance uses your device's camera to scan QR codes on member badges (via the `html5-qrcode` library). This access is used **only** for real-time, on-device barcode recognition.
- Video/camera streams are processed temporarily in your browser's memory.
- **No images, video, or camera recordings are ever saved, stored on your device, or uploaded to our servers.**

### D. Browser Extension
Our browser extension is an optional tool for troop leaders that automates entering finalized attendance into `traillifeconnect.com`. It is built on the Manifest V3 extension standard and is available today for Chrome and Edge, with support for Firefox and other browsers planned. The extension:
- Communicates only with our Supabase database to retrieve approved, closed attendance sessions.
- Requests host permissions scoped specifically to `traillifeconnect.com/attendance` — not the domain as a whole — and interacts only with the DOM of that specific page to check attendance boxes for matching member IDs.
- Does **not** track your general web browsing, browsing history, or search activity, and does not run on or interact with any other website or page.

### E. Local Storage & Cookies
We use browser local storage (not third-party tracking cookies) to store:
- Session/authentication tokens
- UI preferences (e.g., light/dark theme)
- Your currently selected troop
- Offline scan data, cached temporarily until it can sync

We do **not** use third-party advertising trackers, marketing pixels, or data brokers of any kind.

---

## 4. How We Use Information

We use the information described above solely to operate the Service, specifically to:
- Authenticate Users and enforce troop-level access permissions
- Record and manage attendance for troop meetings and events
- Sync approved attendance records to Trail Life Connect on a leader's behalf
- Maintain audit logs for troop administrators to review scan and roster activity
- Diagnose and fix technical issues with the App or extension
- Enable offline scanning with later sync when connectivity is restored

We do not sell data, share data with advertisers, or use youth or leader data for any purpose beyond operating TLC Attendance.

---

## 5. Device Permissions & Camera Usage (QR Scanning)

Camera access is requested only when you actively use the badge-scanning feature and is used exclusively for local, real-time QR code recognition. You can revoke camera permission at any time through your browser or device settings; doing so will disable the scanning feature but will not affect other parts of the App.

---

## 6. Browser Extension Privacy & Data Practices

The TLC Attendance browser extension operates under the principle of least privilege, and this applies equally across every supported browser (Chrome and Edge today, with Firefox planned):
- It requests host permissions limited specifically to `traillifeconnect.com/attendance` — the exact page it needs to interact with — rather than broad access to the entire `traillifeconnect.com` domain or to the web in general.
- It reads approved attendance data from our Supabase backend and writes corresponding check-boxes into the Trail Life Connect attendance page.
- It does not collect, transmit, or store any data beyond what is necessary to complete this sync action.
- Uninstalling the extension at any time immediately stops all of its activity; it retains no data locally beyond what the browser's standard extension storage requires for basic operation.

---

## 7. Data Storage, Multi-Tenancy & Security

- **Hosting:** The web application is hosted on Cloudflare Pages.
- **Database & Authentication:** Data is stored in Supabase (PostgreSQL), with authentication handled via Supabase Auth (JWT-based sessions).
- **Row-Level Security (RLS):** Every troop's data is isolated using database-level Row-Level Security policies. Users can only access data for troops they belong to and only to the extent their assigned role permits.
- **Encryption:** All data in transit is encrypted via TLS/HTTPS. Data at rest is encrypted within the Supabase-managed PostgreSQL database.
- **Future Billing:** If/when troop subscription billing is introduced, payment processing will be handled by Stripe. TLC Attendance does not and will not directly store credit card numbers or full payment credentials.

**Current Deployment Status:** TLC Attendance is currently operated as a small pilot by its developer, covering two troops. The multi-tenant architecture described above (RLS-enforced isolation) is built to support additional troops as the Service grows, and each troop's data remains isolated from the other's regardless of pilot size.

---

## 8. Data Retention & Deletion Policies

- **Attendance Record Lifecycle:** Scan/attendance records are retained only as long as needed to complete synchronization with Trail Life Connect, after which they are subject to periodic purge cycles to minimize how long attendance history is stored in our system.
- **Account Data:** Adult Leader account information (email, display name, role) is retained for as long as the account remains active, or until deletion is requested.
- **Deletion Requests:**
  - **Troop admins** can delete youth attendance records themselves, directly within the App, without needing to contact us.
  - For account deletion, data corrections, or any request a troop admin cannot complete on their own, contact **support@goodplusfast.com**, and the request will be handled manually by the Operator.
  - We aim to fulfill manual deletion requests within 10 business days.

---

## 9. Third-Party Service Providers

We rely on the following infrastructure providers to operate TLC Attendance. Each processes data only as necessary to provide their respective service, under their own privacy and security terms:

| Provider | Purpose | Data Involved |
|---|---|---|
| **Supabase** | Database hosting, authentication | Account data, troop data, attendance records |
| **Cloudflare Pages** | Web application hosting | Standard web traffic/hosting logs |
| **Stripe** *(future)* | Subscription billing | Payment/billing information (not yet active) |
| **Trail Life Connect** (`traillifeconnect.com`) | Destination for synced attendance data (via extension) | Approved attendance records only |

We do not share data with any other third party, including advertisers or data brokers.

---

## 10. User Rights & Managing Your Data

Depending on your role, you have the following rights and options:

- **Troop Admins:** Can directly view, correct, and delete youth attendance records and manage roster data within the App.
- **Adult Leaders:** Can request corrections to their own account information or ask a troop admin/the Operator to do so.
- **Parents/Guardians:** May request to know what limited data (first name, last initial, Troop Member ID, TLC ID, attendance timestamps) is on file for your child and to request its deletion. See "Verifying Parent/Guardian Requests" below for how these requests are handled.
- **All Users (Adult Leaders):** May request a copy of their own account data or full account deletion by emailing **support@goodplusfast.com**. Because these requests come from a registered account holder we can identify directly (by email/account), no additional verification step is needed.

**Verifying Parent/Guardian Requests:** TLC Attendance intentionally does not collect parent or guardian contact information, and does not maintain any record linking a specific adult to a specific youth member — this is a deliberate part of our data minimization approach (see Section 2). As a result, we have no independent way to verify a parent/guardian's identity or relationship to a child directly through the App or by email.

For this reason, **all parent/guardian data requests are routed through the youth member's troop administrator**, who already has independent, real-world knowledge of the families in their troop through the organization's own enrollment and charter process. If you are a parent or guardian:
1. Contact your troop administrator directly — they can look up, share, or delete your child's attendance record on the spot.
2. If you're unsure who your troop administrator is, or are unable to reach them, email **support@goodplusfast.com** and we will help route your request to the correct troop administrator for verification before any data is disclosed or deleted.

We will not disclose or delete a youth member's data based solely on an unverified email claiming a parental relationship, in order to protect against impersonation.

Because TLC Attendance is currently a single-developer independent project, most non-self-service requests (such as full account deletion or troop-admin-assisted deletion) are handled manually by the Operator or the relevant troop administrator upon request.

---

## 11. Changes to This Policy

We may update this Privacy Policy as TLC Attendance evolves — for example, as it grows beyond a single-troop pilot or as new features (like billing) are introduced. Material changes will be reflected by updating the "Last Updated" date at the top of this page. Continued use of the App after changes take effect constitutes acceptance of the revised policy.

---

## 12. Contact Information

For any privacy questions, data requests, or concerns, contact:

**Good Plus Fast**
Email: **support@goodplusfast.com**
Governing Jurisdiction: State of South Carolina, United States

*(Good Plus Fast is currently operated as an individual/sole proprietorship and is not yet a formally registered legal entity. It will be registered in South Carolina upon formalization.)*
