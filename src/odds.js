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
  const item = snapshot?.markets?.[String(matchId)];
  if (!item || item.available === false) return item || null;
  const markets = Object.fromEntries(Object.entries(item.markets || {}).map(([key, market]) => [key, {
    ...market,
    probabilities: market.probabilities || normalizeProbabilities(market.odds),
  }]));
  return { ...item, markets };
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
