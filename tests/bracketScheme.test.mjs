import test from 'node:test';
import assert from 'node:assert/strict';
import { MATCHES } from '../src/data.js';
import { createInitialState, getBracketScheme, resolveBracket } from '../src/bracket.js';

test('quarterfinal scheme uses official order so semifinals read correctly', () => {
  const scheme = getBracketScheme(resolveBracket(createInitialState()));
  const qf = scheme.find((column) => column.key === 'qf');
  const sf = scheme.find((column) => column.key === 'sf');

  assert.deepEqual(qf.ids, [97, 98, 99, 100]);
  assert.deepEqual(
    sf.matches.map((match) => [match.id, match.teamA.name, match.teamB.name]),
    [
      [101, 'Победитель M97', 'Победитель M98'],
      [102, 'Победитель M99', 'Победитель M100'],
    ],
  );
});


test('round of 32 scheme groups real feeders for each round of 16 match', () => {
  const scheme = getBracketScheme(resolveBracket(createInitialState()));
  const r32 = scheme.find((column) => column.key === 'r32');
  const r16 = scheme.find((column) => column.key === 'r16');

  assert.deepEqual(r16.ids, [89, 90, 91, 92, 93, 94, 95, 96]);
  assert.deepEqual(
    r32.ids,
    [73, 75, 74, 77, 76, 78, 79, 80, 83, 84, 81, 82, 86, 88, 85, 87],
  );

  for (const [index, match] of r16.matches.entries()) {
    const base = MATCHES.find((item) => item.id === match.id);
    assert.deepEqual(
      r32.ids.slice(index * 2, index * 2 + 2),
      [base.teamA.id, base.teamB.id],
      `M${match.id} must sit beside its real 1/32 feeders`,
    );
  }
});

test('M97 uses the official ESPN home/away order France vs Morocco', () => {
  const m97 = MATCHES.find((match) => match.id === 97);

  assert.equal(m97.teamA.type, 'winner');
  assert.equal(m97.teamA.id, 90);
  assert.equal(m97.teamB.type, 'winner');
  assert.equal(m97.teamB.id, 89);
});
