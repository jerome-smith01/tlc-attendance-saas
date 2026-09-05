# Action Plan: Prevent In-Progress State Loss on App Minimize / Blur

## Status Tracker
- [x] **Step 1**: Create targeted automated unit tests in `tests/authTroopLifecycle.test.mjs` verifying identity stability, troop preservation, and loading transitions.
- [x] **Step 2**: Update `frontend/src/context/TroopContext.jsx`:
  - Depend on `user?.id` instead of `user` object reference.
  - Gate full `loadingTroops = true` so it only fires on initial load, not background revalidation.
  - Preserve existing valid `selectedTroopId` during background troop fetches.
  - Stabilize `refreshDisplayName` trigger dependency.
- [x] **Step 3**: Update `frontend/src/context/AuthContext.jsx` to omit `TOKEN_REFRESHED` from redundant OAuth profile metadata syncing.
- [x] **Step 4**: Update `frontend/src/components/ProtectedRoute.jsx` so background updates do not trigger `<AppSpinner />` and unmount the tree.
- [x] **Step 5**: Update architecture documentation in `docs/architecture/05_frontend_patterns.md`.
- [x] **Step 6**: Run targeted automated unit tests and verify the frontend build.
- [x] **Step 7**: Update status tracker and provide manual verification steps.
