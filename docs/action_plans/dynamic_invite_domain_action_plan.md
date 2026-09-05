# Action Plan: Dynamic Domain Awareness for Leader Invitations

## Status Tracker
- [x] **Step 1**: Write targeted automated unit tests in `tests/resolveAppUrl.test.mjs` validating the URL resolution and allowlist logic.
- [x] **Step 2**: Update `frontend/src/components/InviteUser.jsx` to pass `site_url: window.location.origin` in the `invite-user` payload.
- [x] **Step 3**: Update `supabase/functions/invite-user/index.ts` with allowlist-based dynamic URL resolution and plain-text fallback in the email HTML.
- [x] **Step 4**: Update architecture documents:
  - [x] `docs/architecture/00_overview.md`
  - [x] `docs/architecture/02_rls_and_auth.md`
- [x] **Step 5**: Run targeted unit tests asynchronously and verify frontend build.
- [x] **Step 6**: Provide walkthrough and deployment instructions for user verification.
