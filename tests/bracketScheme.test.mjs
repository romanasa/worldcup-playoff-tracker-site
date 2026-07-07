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

test('M97 uses the official ESPN home/away order France vs Morocco', () => {
  const m97 = MATCHES.find((match) => match.id === 97);

  assert.equal(m97.teamA.type, 'winner');
  assert.equal(m97.teamA.id, 90);
  assert.equal(m97.teamB.type, 'winner');
  assert.equal(m97.teamB.id, 89);
});
