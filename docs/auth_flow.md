# Auth Flow — TLC Attendance MVP-1

## 1. Supabase JWT Lifecycle
- Access token TTL: 1 hour (Supabase default)
- Refresh token: stored in localStorage; auto-refreshed by supabase-js before expiry
- No action needed in app code — supabase-js handles this transparently

## 2. AuthContext Session Lifecycle
- On app boot: `getSession()` reads localStorage → sets `session` → `loading = false`
- `onAuthStateChange` subscription catches: LOGIN, LOGOUT, TOKEN_REFRESH, SIGNED_OUT
- `session = undefined` during boot (loading); `null` = confirmed logged out; `Session` = logged in

## 3. Protected Routes
- `ProtectedRoute` blocks render until `loading = false`
- If `session = null`, silent redirect to `/login` (Plan A)
- All authenticated routes wrapped in `<ProtectedRoute>`

## 4. PWA / "Add to Home Screen" Behavior
- localStorage persists across PWA restarts on iOS and Android
- No re-login required after closing and reopening the PWA
- Session expires per Supabase token TTL (auto-refreshed if app is open)

## 5. Chrome Extension Auth (Preview — Phase 5)
- Extension popup will call `supabase.auth.signInWithPassword()` independently
- JWT stored in `chrome.storage.local` (not localStorage — different security boundary)
- Content script reads JWT from `chrome.storage.local` before showing Sync button
- Extension and web app share the same Supabase project but manage sessions separately

## 6. Security Notes
- Anon key is a *public* key (safe to bundle); it only permits operations allowed by RLS
- Service Role key is NEVER used client-side
- Auth error messages shown to users are generic — raw errors logged to console only
- Supabase URL and keys are not exposed in production error messages
