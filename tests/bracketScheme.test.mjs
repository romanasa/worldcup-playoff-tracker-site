import test from 'node:test';
import assert from 'node:assert/strict';
import { MATCHES } from '../src/data.js';
import { ROUNDS } from '../src/data.js';
import { createInitialState, getBracketScheme, resolveBracket } from '../src/bracket.js';

function baseMatch(id) {
  return MATCHES.find((match) => match.id === id);
}

function feederIds(matchId) {
  const match = baseMatch(matchId);
  return [match.teamA.id, match.teamB.id];
}

test('scheme uses correct knockout stage labels for a 32-team bracket', () => {
  const scheme = getBracketScheme(resolveBracket(createInitialState()));

  assert.deepEqual(scheme.map((column) => column.label), [
    '1/16 финала',
    '1/8 финала',
    '1/4 финала',
    '1/2 финала',
    'Финалы',
  ]);
  assert.deepEqual(ROUNDS.map((round) => round.label), [
    '1/16 финала',
    '1/8 финала',
    '1/4 финала',
    '1/2 финала',
    'Финалы',
  ]);
});

test('scheme columns are ordered by real feeder links, not match numbers', () => {
  const scheme = getBracketScheme(resolveBracket(createInitialState()));
  const r32 = scheme.find((column) => column.key === 'r32');
  const r16 = scheme.find((column) => column.key === 'r16');
  const qf = scheme.find((column) => column.key === 'qf');
  const sf = scheme.find((column) => column.key === 'sf');

  assert.deepEqual(qf.ids, [97, 98, 99, 100]);
  assert.deepEqual(r16.ids, [90, 89, 93, 94, 91, 92, 95, 96]);
  assert.deepEqual(
    r32.ids,
    [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
  );

  for (const [index, match] of qf.matches.entries()) {
    assert.deepEqual(
      r16.ids.slice(index * 2, index * 2 + 2),
      feederIds(match.id),
      `M${match.id} must sit beside its real 1/8 feeders`,
    );
  }

  for (const [index, match] of r16.matches.entries()) {
    assert.deepEqual(
      r32.ids.slice(index * 2, index * 2 + 2),
      feederIds(match.id),
      `M${match.id} must sit beside its real 1/16 feeders`,
    );
  }

  assert.deepEqual(
    sf.matches.map((match) => [match.id, match.teamA.name, match.teamB.name]),
    [
      [101, 'Победитель M97', 'Победитель M98'],
      [102, 'Победитель M99', 'Победитель M100'],
    ],
  );
});

test('M97 uses the official ESPN home/away order France vs Morocco', () => {
  const m97 = MATCHES.find((match) => match.id === 97);

  assert.equal(m97.teamA.type, 'winner');
  assert.equal(m97.teamA.id, 90);
  assert.equal(m97.teamB.type, 'winner');
  assert.equal(m97.teamB.id, 89);
});
