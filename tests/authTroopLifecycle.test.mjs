import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure helper representing TroopContext user change detection.
 * Token refreshes generate a new user object reference with the SAME id.
 * Troop re-fetching should only happen when user identity actually changes.
 */
export function shouldFetchTroopsOnUserChange(prevUserId, nextUserId) {
  // If user is null/undefined or ID hasn't changed, no fetch needed
  if (!nextUserId) return false;
  return prevUserId !== nextUserId;
}

/**
 * Pure helper representing setDefaultTroop / selectedTroopId resolution in TroopContext.
 * Ensures existing valid troop selection is preserved across background revalidation.
 */
export function resolveSelectedTroopId({ currentSelectedId, availableTroops, savedTroopId }) {
  if (!availableTroops || availableTroops.length === 0) return '';

  // 1. If currently selected troop is already valid in available troops, KEEP IT!
  if (currentSelectedId && availableTroops.some(t => t.id === currentSelectedId)) {
    return currentSelectedId;
  }

  // 2. Fall back to saved troop in localStorage if valid
  if (savedTroopId && availableTroops.some(t => t.id === savedTroopId)) {
    return savedTroopId;
  }

  // 3. Fall back to the first available troop
  return availableTroops[0].id;
}

/**
 * Pure helper representing ProtectedRoute loading evaluation.
 * Background troop refreshes must never trigger full-screen unmounting spinners.
 */
export function shouldBlockRouteWithSpinner({ authLoading, session, initialTroopsLoaded, isRefreshingTroops }) {
  if (authLoading) return true;
  if (session && !initialTroopsLoaded) return true;
  // If session is present and initial troops are already loaded, background refreshes must not block
  return false;
}

describe('Auth & Troop Lifecycle Stability', () => {
  describe('User Change Detection (Token Refresh vs Identity Change)', () => {
    test('does NOT trigger troop fetch when token refreshes for the same user ID', () => {
      const prevUserId = 'user_abc_123';
      const nextUserId = 'user_abc_123'; // Same ID from refreshed session object
      assert.equal(shouldFetchTroopsOnUserChange(prevUserId, nextUserId), false);
    });

    test('triggers troop fetch on initial login (null -> valid user ID)', () => {
      const prevUserId = null;
      const nextUserId = 'user_abc_123';
      assert.equal(shouldFetchTroopsOnUserChange(prevUserId, nextUserId), true);
    });

    test('triggers troop fetch when user switches accounts', () => {
      const prevUserId = 'user_abc_123';
      const nextUserId = 'user_xyz_789';
      assert.equal(shouldFetchTroopsOnUserChange(prevUserId, nextUserId), true);
    });

    test('does not trigger troop fetch on logout (handled by cleanup branch)', () => {
      const prevUserId = 'user_abc_123';
      const nextUserId = null;
      assert.equal(shouldFetchTroopsOnUserChange(prevUserId, nextUserId), false);
    });
  });

  describe('Selected Troop Preservation (resolveSelectedTroopId)', () => {
    const availableTroops = [
      { id: 'troop_1', troop_number: 'SC-0110' },
      { id: 'troop_2', troop_number: 'NC-0220' },
      { id: 'troop_3', troop_number: 'GA-0330' }
    ];

    test('preserves currently active troop selection during background revalidation', () => {
      const result = resolveSelectedTroopId({
        currentSelectedId: 'troop_2',
        availableTroops,
        savedTroopId: 'troop_1'
      });
      assert.equal(result, 'troop_2', 'Should keep troop_2 and not force reset to saved troop_1');
    });

    test('uses saved localStorage troop if no current troop is selected', () => {
      const result = resolveSelectedTroopId({
        currentSelectedId: '',
        availableTroops,
        savedTroopId: 'troop_3'
      });
      assert.equal(result, 'troop_3');
    });

    test('falls back to first troop if neither current nor saved troop is valid', () => {
      const result = resolveSelectedTroopId({
        currentSelectedId: 'deleted_troop',
        availableTroops,
        savedTroopId: 'unknown_saved_troop'
      });
      assert.equal(result, 'troop_1');
    });

    test('returns empty string if available troops list is empty', () => {
      const result = resolveSelectedTroopId({
        currentSelectedId: 'troop_1',
        availableTroops: [],
        savedTroopId: 'troop_1'
      });
      assert.equal(result, '');
    });
  });

  describe('ProtectedRoute Loading Guard (shouldBlockRouteWithSpinner)', () => {
    test('blocks route when auth is still loading on initial boot', () => {
      const shouldBlock = shouldBlockRouteWithSpinner({
        authLoading: true,
        session: null,
        initialTroopsLoaded: false,
        isRefreshingTroops: false
      });
      assert.equal(shouldBlock, true);
    });

    test('blocks route when session is active but initial troops are still loading', () => {
      const shouldBlock = shouldBlockRouteWithSpinner({
        authLoading: false,
        session: { user: { id: 'u1' } },
        initialTroopsLoaded: false,
        isRefreshingTroops: false
      });
      assert.equal(shouldBlock, true);
    });

    test('NEVER blocks route when initial troops are already loaded and background refresh occurs', () => {
      const shouldBlock = shouldBlockRouteWithSpinner({
        authLoading: false,
        session: { user: { id: 'u1' } },
        initialTroopsLoaded: true,
        isRefreshingTroops: true // background token refresh
      });
      assert.equal(shouldBlock, false, 'Route must remain mounted to preserve form state');
    });
  });
});
