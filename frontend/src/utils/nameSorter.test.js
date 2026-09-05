import test from 'node:test';
import assert from 'node:assert/strict';
import { compareMemberName } from './nameSorter.js';

test('compareMemberName - sorts by First Name ascending with Last Initial tie-break', () => {
  const members = [
    { member: { first_name: 'Charlie', last_initial: 'M' } },
    { member: { first_name: 'Aaron', last_initial: 'K' } },
    { member: { first_name: 'Beau', last_initial: 'B' } },
    { member: { first_name: 'Aaron', last_initial: 'A' } },
    { member: { first_name: 'Asher', last_initial: 'G' } },
  ];

  const sorted = [...members].sort((a, b) => compareMemberName(a, b, 'first', 'asc'));
  const names = sorted.map(m => `${m.member.first_name} ${m.member.last_initial}`);

  assert.deepEqual(names, [
    'Aaron A',
    'Aaron K',
    'Asher G',
    'Beau B',
    'Charlie M',
  ]);
});

test('compareMemberName - sorts by First Name descending', () => {
  const members = [
    { member: { first_name: 'Aaron', last_initial: 'K' } },
    { member: { first_name: 'Charlie', last_initial: 'M' } },
    { member: { first_name: 'Beau', last_initial: 'B' } },
  ];

  const sorted = [...members].sort((a, b) => compareMemberName(a, b, 'first', 'desc'));
  const names = sorted.map(m => `${m.member.first_name} ${m.member.last_initial}`);

  assert.deepEqual(names, [
    'Charlie M',
    'Beau B',
    'Aaron K',
  ]);
});

test('compareMemberName - sorts by Last Initial ascending with First Name tie-break', () => {
  const members = [
    { member: { first_name: 'Eben', last_initial: 'M' } },
    { member: { first_name: 'Aaron', last_initial: 'K' } },
    { member: { first_name: 'Charlie', last_initial: 'M' } },
    { member: { first_name: 'Beau', last_initial: 'B' } },
    { member: { first_name: 'Asher', last_initial: 'G' } },
  ];

  const sorted = [...members].sort((a, b) => compareMemberName(a, b, 'last', 'asc'));
  const names = sorted.map(m => `${m.member.first_name} ${m.member.last_initial}`);

  assert.deepEqual(names, [
    'Beau B',    // B
    'Asher G',   // G
    'Aaron K',   // K
    'Charlie M', // M (tie-break Charlie before Eben)
    'Eben M',    // M
  ]);
});

test('compareMemberName - sorts by Last Initial descending', () => {
  const members = [
    { member: { first_name: 'Eben', last_initial: 'M' } },
    { member: { first_name: 'Aaron', last_initial: 'K' } },
    { member: { first_name: 'Charlie', last_initial: 'M' } },
    { member: { first_name: 'Beau', last_initial: 'B' } },
  ];

  const sorted = [...members].sort((a, b) => compareMemberName(a, b, 'last', 'desc'));
  const names = sorted.map(m => `${m.member.first_name} ${m.member.last_initial}`);

  assert.deepEqual(names, [
    'Eben M',    // M (descending tie-break Eben before Charlie)
    'Charlie M', // M
    'Aaron K',   // K
    'Beau B',    // B
  ]);
});

test('compareMemberName - works with direct roster objects without .member wrapper', () => {
  const roster = [
    { first_name: 'Zach', last_initial: 'A' },
    { first_name: 'Adam', last_initial: 'Z' },
  ];

  const sortedByFirst = [...roster].sort((a, b) => compareMemberName(a, b, 'first', 'asc'));
  assert.equal(sortedByFirst[0].first_name, 'Adam');

  const sortedByLast = [...roster].sort((a, b) => compareMemberName(a, b, 'last', 'asc'));
  assert.equal(sortedByLast[0].first_name, 'Zach');
});

test('compareMemberName - handles missing/null/empty names gracefully', () => {
  const items = [
    { member: null },
    { member: { first_name: 'Beau', last_initial: 'B' } },
    {},
  ];

  // Should not throw
  const sorted = [...items].sort((a, b) => compareMemberName(a, b, 'first', 'asc'));
  assert.equal(sorted.length, 3);
});
