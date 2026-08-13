# Invite Link Routing Bug Context

This document summarizes the troubleshooting history for a bug where new users are redirected to the Login page instead of the Complete Profile page when clicking an invitation link. It is intended to provide context for the next agent picking up this issue.

## The Bug
When an admin invites a user, an edge function (`invite-user`) calls `supabaseAdmin.auth.admin.inviteUserByEmail` with `redirectTo: 'http://localhost:5173/#/complete-profile'`. 
The user receives an email with a link like:
`https://[project].supabase.co/auth/v1/verify?token=[token]&type=invite&redirect_to=http%3A%2F%2Flocalhost%3A5173%2F%23%2Fcomplete-profile`

When the user clicks the link, they are briefly routed to the app but ultimately land on `http://localhost:5173/#/login` (unauthenticated), instead of `#/complete-profile`.

## Tech Stack & Architecture
- **Frontend**: React, `react-router-dom` (using `HashRouter`), Vite.
- **Backend/Auth**: Supabase Auth (Implicit Grant Flow), Edge Functions.
- **Key Files**:
  - [`frontend/src/context/AuthContext.jsx`](file:///c:/Users/Jerom/My%20Apps/tlc_attendance_saas/frontend/src/context/AuthContext.jsx): Manages auth state and Supabase listeners.
  - [`frontend/src/App.jsx`](file:///c:/Users/Jerom/My%20Apps/tlc_attendance_saas/frontend/src/App.jsx): Defines the HashRouter and routes.
  - [`frontend/src/pages/CompleteProfile.jsx`](file:///c:/Users/Jerom/My%20Apps/tlc_attendance_saas/frontend/src/pages/CompleteProfile.jsx): The intended destination, protected by session state.
  - [`frontend/src/components/ProtectedRoute.jsx`](file:///c:/Users/Jerom/My%20Apps/tlc_attendance_saas/frontend/src/components/ProtectedRoute.jsx): Route guard that redirects to `/login` if `session` is null.
  - [`supabase/functions/invite-user/index.ts`](file:///c:/Users/Jerom/My%20Apps/tlc_attendance_saas/supabase/functions/invite-user/index.ts): The edge function generating the invite.

## What We Tried & Why It Failed

We hypothesized the issue stems from a conflict between `HashRouter` and Supabase's Implicit Grant flow. Supabase appends auth tokens as a URL fragment (e.g. `#access_token=...&type=invite`). If the `redirect_to` URL already has a fragment (`#/complete-profile`), GoTrue overwrites it. `HashRouter` then sees an invalid route and falls back to `*`, rewriting the URL to `#/login` and destroying the tokens before Supabase can parse them.

**Attempt 1:**
- **Action**: Delayed rendering `HashRouter` (in `AuthContext.jsx`) until `loading` is false.
- **Result**: Failed. Supabase `gotrue-js` cleans the hash after processing, leaving it empty (`""`). The router mounts, sees `/`, and the wildcard route redirects to `/login`.

**Attempt 2:**
- **Action**: Intercepted the `SIGNED_IN` event in `onAuthStateChange`. If `window.location.hash` included `type=invite`, we manually overwrote the hash back to `#/complete-profile`.
- **Result**: Failed. Supabase's `gotrue-js` executes `_removeHash()` *before* emitting the `SIGNED_IN` event, so the `type=invite` string was already gone by the time we checked it.

**Attempt 3:**
- **Action**: Used a React `useRef` to capture `window.location.hash.includes('type=invite')` on initial component mount, *before* Supabase could clean the URL. We then used that ref inside `onAuthStateChange` to rewrite the route.
- **Result**: Failed. The user was still redirected to `#/login`.

## What To Look For Next

Since the UI routing hacks failed, the issue might not be a race condition. It is highly likely the user is **failing authentication entirely**, resulting in `session === null`, which forces `ProtectedRoute` to kick them to `/login`.

1. **Verify Session Creation (Add Logging)**:
   - In `AuthContext.jsx`, add detailed `console.log()` statements for `window.location.href`, `event`, and `session` on initial load and inside `onAuthStateChange`. 
   - Check if Supabase is actually emitting `SIGNED_IN`, or if it's emitting nothing (or an error) because the token verification is failing.
   
2. **Check for Expired Tokens / Verify Endpoint Errors**:
   - If the user clicks a link twice, the second click is an expired token. Supabase redirects to `redirect_to` but appends `#error=access_denied`.
   - Ensure the new agent looks at the browser's network tab or console to see if Supabase's API is returning a 403 or 400.

3. **Consider `BrowserRouter`**:
   - Hash routing is notoriously incompatible with OAuth and Magic Links. If the deployment environment supports it, switching `App.jsx` from `HashRouter` to `BrowserRouter` (and updating the `redirect_to` to standard paths) often eliminates this entire class of bugs.

4. **Edge Function Policy Issues**:
   - Check if `inviteUserByEmail` in `invite-user/index.ts` is correctly issuing the invite without being blocked by hidden RLS or SMTP configuration issues in the Supabase Dashboard.
