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

export function isMatchLive(match) {
  return match?.status?.state === 'in';
}

export function isMatchFinished(match) {
  return Boolean(match?.winner || match?.status?.state === 'post');
}

export function isMatchUpcoming(match, now = new Date()) {
  return !isMatchFinished(match) && new Date(match.kickoffUtc).getTime() >= now.getTime();
}

export function selectTodayMatches(matches, todayKey, dateKeyForMatch, now = new Date()) {
  const nowTime = now.getTime();
  return matches.filter((match) => {
    if (dateKeyForMatch(match) !== todayKey) return false;
    if (isMatchLive(match)) return true;
    if (isMatchFinished(match)) return false;
    return new Date(match.kickoffUtc).getTime() >= nowTime;
  });
}
