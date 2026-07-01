export const LIVE_ODDS_STALE_MS = 2 * 60_000;

const STATUS_LABELS = {
  LIVE: 'Live',
  HT: 'Перерыв',
  SCHEDULED: 'Запланирован',
  FT: 'Завершён',
  PEN: 'Пен.',
  AET: 'После доп. времени',
};

function validDate(timestamp) {
  const date = timestamp ? new Date(timestamp) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

export function displayStatusBadge(status = {}) {
  const badge = status.badge || 'SCHEDULED';
  return STATUS_LABELS[badge] || badge;
}

export function primaryMatchTiming(summary) {
  const match = summary.primary.match;
  if (!match) return '';
  if (summary.primary.type === 'live') {
    return match.status?.minute ? `идёт сейчас · ${match.status.minute}` : 'идёт сейчас';
  }
  if (match.status?.state === 'post' || match.winner) return 'завершён';
  return summary.countdown;
}

export function oddsFreshness(match, market, staleMs = LIVE_ODDS_STALE_MS) {
  const marketTime = validDate(market?.updatedAt);
  const scoreTime = validDate(match.status?.updatedAt);
  if (match.status?.state !== 'in' || !marketTime || !scoreTime) {
    return { stale: false, marketTime, scoreTime, lagMs: 0 };
  }
  const lagMs = scoreTime.getTime() - marketTime.getTime();
  return { stale: lagMs > staleMs, marketTime, scoreTime, lagMs };
}
