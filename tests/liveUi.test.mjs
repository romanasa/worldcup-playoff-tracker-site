import test from 'node:test';
import assert from 'node:assert/strict';
import {
  displayStatusBadge,
  oddsFreshness,
  primaryMatchTiming,
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
