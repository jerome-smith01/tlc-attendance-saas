import test from 'node:test';
import assert from 'node:assert/strict';
import { compareExpirationDate } from './dateSorter.js';

test('compareExpirationDate - sorts dates ascending (earliest first)', () => {
  const members = [
    { membership_exp: '2026-10-15' },
    { membership_exp: '2024-05-01' },
    { membership_exp: '2025-01-20' },
  ];

  const sorted = [...members].sort((a, b) => compareExpirationDate(a, b, 'asc'));
  assert.deepEqual(
    sorted.map(m => m.membership_exp),
    ['2024-05-01', '2025-01-20', '2026-10-15']
  );
});

test('compareExpirationDate - sorts dates descending (latest first)', () => {
  const members = [
    { membership_exp: '2025-01-20' },
    { membership_exp: '2026-10-15' },
    { membership_exp: '2024-05-01' },
  ];

  const sorted = [...members].sort((a, b) => compareExpirationDate(a, b, 'desc'));
  assert.deepEqual(
    sorted.map(m => m.membership_exp),
    ['2026-10-15', '2025-01-20', '2024-05-01']
  );
});

test('compareExpirationDate - places null and empty dates at the bottom during asc sort', () => {
  const members = [
    { name: 'No Exp 1', membership_exp: null },
    { name: 'Active 2026', membership_exp: '2026-10-15' },
    { name: 'No Exp 2', membership_exp: '' },
    { name: 'Active 2024', membership_exp: '2024-05-01' },
  ];

  const sorted = [...members].sort((a, b) => compareExpirationDate(a, b, 'asc'));
  assert.deepEqual(
    sorted.map(m => m.name),
    ['Active 2024', 'Active 2026', 'No Exp 1', 'No Exp 2']
  );
});

test('compareExpirationDate - places null and empty dates at the bottom during desc sort', () => {
  const members = [
    { name: 'No Exp 1', membership_exp: null },
    { name: 'Active 2026', membership_exp: '2026-10-15' },
    { name: 'No Exp 2', membership_exp: '' },
    { name: 'Active 2024', membership_exp: '2024-05-01' },
  ];

  const sorted = [...members].sort((a, b) => compareExpirationDate(a, b, 'desc'));
  assert.deepEqual(
    sorted.map(m => m.name),
    ['Active 2026', 'Active 2024', 'No Exp 1', 'No Exp 2']
  );
});

test('compareExpirationDate - works with raw date strings', () => {
  const dates = ['2026-12-31', '2024-01-01', '2025-06-15'];
  const sorted = [...dates].sort((a, b) => compareExpirationDate(a, b, 'asc'));
  assert.deepEqual(sorted, ['2024-01-01', '2025-06-15', '2026-12-31']);
});
