# Manual Verification Plan: Dynamic Domain Awareness for Leader Invitations

## Purpose
This document provides exact, step-by-step instructions for the user to manually verify that leader invitation email links dynamically resolve to the active host domain (e.g. `https://tlc.goodplusfast.com` or local dev `http://localhost:5173`), respect the least-privilege allowlist, and meet baseline accessibility standards.

---

## Prerequisites
1. Deploy the updated Supabase Edge Function:
   ```powershell
   npx supabase functions deploy invite-user
   ```
2. Ensure you have access to a Troop Admin or Roster Manager account in the app.

---

## Verification Scenarios

### Scenario 1: Local Development Verification (`http://localhost:5173`)
1. Start the frontend locally:
   ```powershell
   cd frontend
   npm run dev
   ```
2. Open your browser and navigate to `http://localhost:5173`.
3. Log in as a Troop Admin or Roster Manager.
4. Navigate to your troop's Leadership Roster: `http://localhost:5173/#/troop/SC-0110/roster/leaders`.
5. Open your browser's Developer Tools (press `F12` and switch to the **Network** tab).
6. In the "Invite Leader" section, enter a test email address and click **Send Invites**.
7. In the Network tab, find the request to `functions/v1/invite-user`:
   - Inspect the **Request Payload**: verify it includes `"site_url": "http://localhost:5173"`.
   - Inspect the **Headers**: verify `origin` is `http://localhost:5173`.
8. Check the received invitation email in your test inbox:
   - Verify the "Accept Invitation" button links to `http://localhost:5173/#/accept-invite?token=...`.
   - Verify the plain-text URL displayed beneath the button matches `http://localhost:5173/#/accept-invite?token=...`.

---

### Scenario 2: Production Domain Verification (`https://tlc.goodplusfast.com`)
1. Access the deployed application at `https://tlc.goodplusfast.com`.
2. Navigate to your troop's leadership roster (`https://tlc.goodplusfast.com/#/troop/SC-0110/roster/leaders`).
3. Send an invitation to a test email.
4. Check the resulting email in your inbox:
   - Confirm the button points to `https://tlc.goodplusfast.com/#/accept-invite?token=...`.
   - Confirm it no longer directs to `localhost:5173`.
5. Click the link in the email and verify it loads the `/accept-invite` page on `https://tlc.goodplusfast.com`.

---

### Scenario 3: Future Domain Mutation Verification (e.g. `https://something_else.goodplusfast.com`)
1. When hosting the app under another subdomain such as `something_else.goodplusfast.com`:
2. Send an invite from that domain.
3. Verify the link points to `https://something_else.goodplusfast.com/#/accept-invite?token=...`.
4. No changes to environment secrets or Edge Function code are required.

---

### Scenario 4: Security / Least-Privilege Allowlist Verification
1. To confirm rogue origins are blocked:
   - An origin outside `*.goodplusfast.com` or `localhost` (e.g., `https://evil-site.com`) is rejected by the allowlist and falls back to `APP_SITE_URL` / `http://localhost:5173`.
   - This prevents open redirects or phishing link generation via the transactional email service.

---

### Scenario 5: Accessibility Verification
1. **Plain-Text Link Fallback**: Inspect the received email in an email client or webmail (e.g. Gmail / Outlook). Verify the full URL is visible as clickable plain text beneath the main CTA button. This ensures that users with email clients configured to block button styles/images or users with screen readers can read and copy the full URL directly.
2. **Contrast & Styling**: Confirm the "Accept Invitation" button text is high-contrast white text on brand blue (`#0284c7`), easily distinguishable and readable.
3. **Screen Reader Announcement**: Confirm toast notifications in the UI announce success or error states when sending invitations.
