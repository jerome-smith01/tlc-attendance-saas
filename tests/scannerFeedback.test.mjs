import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatMemberName, getScannerDisplayData } from '../frontend/src/utils/scannerFeedback.js';

describe('Scanner Feedback & Corner Status Logic', () => {
  describe('formatMemberName', () => {
    test('formats first name and last initial with period', () => {
      assert.equal(formatMemberName({ first_name: 'John', last_initial: 'D' }), 'John D.');
      assert.equal(formatMemberName({ first_name: 'Sarah', last_initial: 'M.' }), 'Sarah M.');
    });

    test('falls back to first char of last_name if last_initial is missing', () => {
      assert.equal(formatMemberName({ first_name: 'Alex', last_name: 'Smith' }), 'Alex S.');
    });

    test('handles missing or empty member gracefully', () => {
      assert.equal(formatMemberName(null), '');
      assert.equal(formatMemberName({}), '');
      assert.equal(formatMemberName({ first_name: 'SingleName' }), 'SingleName');
    });
  });

  describe('getScannerDisplayData', () => {
    const testMember = { first_name: 'David', last_initial: 'P' };

    test('ready/idle state returns white ready corners and blank text', () => {
      const result = getScannerDisplayData({ status: 'ready' });
      assert.equal(result.cornerStatus, 'ready');
      assert.equal(result.displayText, '');
      assert.equal(result.type, null);
      assert.equal(result.ariaAnnouncement, '');
    });

    test('scanned in returns green corner and member first name + last initial', () => {
      const result = getScannerDisplayData({
        status: 'success',
        mode: 'IN',
        member: testMember
      });
      assert.equal(result.cornerStatus, 'in');
      assert.equal(result.displayText, 'David P.');
      assert.equal(result.type, 'success');
      assert.equal(result.ariaAnnouncement, 'David P. scanned in');
    });

    test('scanned out returns blue corner and member first name + last initial', () => {
      const result = getScannerDisplayData({
        status: 'success',
        mode: 'OUT',
        member: testMember
      });
      assert.equal(result.cornerStatus, 'out');
      assert.equal(result.displayText, 'David P.');
      assert.equal(result.type, 'success');
      assert.equal(result.ariaAnnouncement, 'David P. scanned out');
    });

    test('duplicate scan returns yellow corner, warning type, and member name', () => {
      const result = getScannerDisplayData({
        status: 'duplicate',
        mode: 'IN',
        member: testMember
      });
      assert.equal(result.cornerStatus, 'duplicate');
      assert.equal(result.displayText, 'David P.');
      assert.equal(result.type, 'warning');
      assert.equal(result.ariaAnnouncement, 'Duplicate scan: David P.');
    });

    test('unknown member scan returns ready corner and "Member not found" text', () => {
      const result = getScannerDisplayData({
        status: 'unknown',
        mode: 'IN',
        member: null
      });
      assert.equal(result.cornerStatus, 'ready');
      assert.equal(result.displayText, 'Member not found');
      assert.equal(result.type, 'warning');
      assert.equal(result.ariaAnnouncement, 'Member not found');
    });
  });
});
