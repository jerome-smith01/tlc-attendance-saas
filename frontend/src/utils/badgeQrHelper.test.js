import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQrPayload, findRosterMatch, getCropRegions } from './badgeQrHelper.js';

test('parseQrPayload - parses dual token format "memberId | tlcId"', () => {
  const res = parseQrPayload('2023-512622 | tlc987654321');
  assert.deepEqual(res, {
    memberId: '2023-512622',
    tlcId: 'tlc987654321',
  });
});

test('parseQrPayload - parses dual token format with whitespace variations', () => {
  const res = parseQrPayload('   2024-762089   |   abc123456789   ');
  assert.deepEqual(res, {
    memberId: '2024-762089',
    tlcId: 'abc123456789',
  });
});

test('parseQrPayload - handles single token format as tlcId', () => {
  const res = parseQrPayload('abc123456789');
  assert.deepEqual(res, {
    memberId: null,
    tlcId: 'abc123456789',
  });
});

test('parseQrPayload - handles empty or null input gracefully', () => {
  assert.deepEqual(parseQrPayload(''), { memberId: null, tlcId: null });
  assert.deepEqual(parseQrPayload(null), { memberId: null, tlcId: null });
  assert.deepEqual(parseQrPayload(undefined), { memberId: null, tlcId: null });
});

test('findRosterMatch - matches by member_id first', () => {
  const roster = [
    { id: 1, first_name: 'Wesley', member_id: '2023-512622', tlc_id: 'tlc-1' },
    { id: 2, first_name: 'Other', member_id: '2020-000000', tlc_id: 'tlc-2' },
  ];
  const match = findRosterMatch(roster, '2023-512622', 'tlc-wrong');
  assert.equal(match.id, 1);
  assert.equal(match.first_name, 'Wesley');
});

test('findRosterMatch - matches by tlc_id when member_id does not match or is null', () => {
  const roster = [
    { id: 1, first_name: 'Wesley', member_id: null, tlc_id: 'tlc-target' },
    { id: 2, first_name: 'Other', member_id: '2020-000000', tlc_id: 'tlc-2' },
  ];
  const match = findRosterMatch(roster, 'non-existent-id', 'tlc-target');
  assert.equal(match.id, 1);
});

test('findRosterMatch - returns null if neither matches', () => {
  const roster = [
    { id: 1, first_name: 'Wesley', member_id: '2023-512622', tlc_id: 'tlc-1' },
  ];
  const match = findRosterMatch(roster, 'non-existent-id', 'non-existent-tlc');
  assert.equal(match, null);
});

test('getCropRegions - calculates correct boundaries for portrait canvas', () => {
  const regions = getCropRegions(1000, 2000);

  assert.deepEqual(regions.bottomRightQuadrant, {
    sx: 500,
    sy: 1000,
    sw: 500,
    sh: 1000,
  });

  assert.deepEqual(regions.bottomHalf, {
    sx: 0,
    sy: 1000,
    sw: 1000,
    sh: 1000,
  });

  assert.deepEqual(regions.full, {
    sx: 0,
    sy: 0,
    sw: 1000,
    sh: 2000,
  });
});

test('getCropRegions - handles odd dimensions correctly', () => {
  const regions = getCropRegions(1001, 2001);

  assert.deepEqual(regions.bottomRightQuadrant, {
    sx: 500,
    sy: 1000,
    sw: 501,
    sh: 1001,
  });
});
