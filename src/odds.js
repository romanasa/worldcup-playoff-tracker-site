export const ODDS_SNAPSHOT_URL = './src/odds.json';

export function normalizeProbabilities(odds = {}) {
  const entries = Object.entries(odds)
    .map(([team, value]) => [team, Number(value)])
    .filter(([, value]) => Number.isFinite(value) && value > 1);
  const raw = entries.map(([team, value]) => [team, 1 / value]);
  const total = raw.reduce((sum, [, probability]) => sum + probability, 0);
  if (!total) return {};
  return Object.fromEntries(raw.map(([team, probability]) => [team, Math.round((probability / total) * 100)]));
}

export function getMatchOdds(matchId, snapshot) {
  const market = snapshot?.markets?.[String(matchId)];
  if (!market || market.available === false) return market || null;
  if (market.market !== 'to_qualify') return { ...market, available: false, message: 'Коэффициенты на проход пока недоступны' };
  const odds = market.odds || {};
  const probabilities = market.probabilities || normalizeProbabilities(odds);
  return { ...market, probabilities };
}

export function formatOddsTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Tbilisi',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
