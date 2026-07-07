import test from 'node:test';
import assert from 'node:assert/strict';
import {
  displayStatusBadge,
  oddsFreshness,
  primaryMatchTiming,
  selectTodayMatches,
} from '../src/liveUi.mjs';

test('displayStatusBadge localizes raw provider statuses', () => {
  assert.equal(displayStatusBadge({ badge: 'SCHEDULED' }), 'Запланирован');
  assert.equal(displayStatusBadge({ badge: 'FT' }), 'Завершён');
  assert.equal(displayStatusBadge({ badge: 'PEN' }), 'Пен.');
  assert.equal(displayStatusBadge({ badge: 'UNKNOWN' }), 'UNKNOWN');
});

test('primaryMatchTiming says live match is in progress instead of starting now', () => {
  const summary = {
    countdown: 'начинается сейчас',
    primary: {
      type: 'live',
      match: { status: { minute: "90'+5'" } },
    },
  };

  assert.equal(primaryMatchTiming(summary), "идёт сейчас · 90'+5'");
});

test('oddsFreshness marks live odds stale when score update is newer than market update', () => {
  const match = { status: { state: 'in', updatedAt: '2026-07-01T21:57:00.000Z' } };
  const market = { updatedAt: '2026-07-01T21:47:00.000Z' };

  const result = oddsFreshness(match, market, 2 * 60_000);

  assert.equal(result.stale, true);
  assert.equal(result.lagMs, 10 * 60_000);
});

test('oddsFreshness keeps scheduled match odds usable even when old', () => {
  const match = { status: { state: 'pre', updatedAt: '2026-07-01T21:57:00.000Z' } };
  const market = { updatedAt: '2026-07-01T21:47:00.000Z' };

  assert.equal(oddsFreshness(match, market, 2 * 60_000).stale, false);
});

test('selectTodayMatches excludes already-passed non-live matches from home today block', () => {
  const matches = [
    { id: 1, kickoffUtc: '2026-07-07T00:00:00.000Z', status: { state: 'pre' } },
    { id: 2, kickoffUtc: '2026-07-07T16:00:00.000Z', status: { state: 'pre' } },
    { id: 3, kickoffUtc: '2026-07-07T20:00:00.000Z', status: { state: 'pre' } },
    { id: 4, kickoffUtc: '2026-07-07T18:30:00.000Z', status: { state: 'in' } },
    { id: 5, kickoffUtc: '2026-07-07T17:00:00.000Z', status: { state: 'post' }, winner: 'A' },
  ];
  const now = new Date('2026-07-07T19:07:00.000Z');
  const sameTbilisiDay = () => '2026-07-07';

  assert.deepEqual(
    selectTodayMatches(matches, '2026-07-07', sameTbilisiDay, now).map((match) => match.id),
    [3, 4],
  );
});
