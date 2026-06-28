import { MATCHES } from './data.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

export function createInitialState() {
  return { scores: {}, manualWinners: {}, favorites: [] };
}

export function setScore(state, matchId, scoreA, scoreB) {
  const next = clone(state);
  next.scores[matchId] = {
    a: Number.isFinite(Number(scoreA)) ? Number(scoreA) : null,
    b: Number.isFinite(Number(scoreB)) ? Number(scoreB) : null,
  };
  return next;
}

export function setManualWinner(state, matchId, winnerName) {
  const next = clone(state);
  if (winnerName) next.manualWinners[matchId] = winnerName;
  else delete next.manualWinners[matchId];
  return next;
}

function labelForSlot(slot) {
  if (slot.type === 'team') return slot.name;
  if (slot.type === 'winner') return `Победитель M${slot.id}`;
  return `Проигравший M${slot.id}`;
}

function resolveSlot(slot, winners, losers) {
  if (slot.type === 'team') return { name: slot.name, placeholder: false };
  if (slot.type === 'winner' && winners[slot.id]) return { name: winners[slot.id], placeholder: false };
  if (slot.type === 'loser' && losers[slot.id]) return { name: losers[slot.id], placeholder: false };
  return { name: labelForSlot(slot), placeholder: true };
}

function inferResult(match, state) {
  const score = state.scores[match.id];
  const teamsReady = !match.teamA.placeholder && !match.teamB.placeholder;
  const manual = state.manualWinners[match.id];
  if (score && Number.isFinite(score.a) && Number.isFinite(score.b) && score.a !== score.b && teamsReady) {
    return score.a > score.b
      ? { winner: match.teamA.name, loser: match.teamB.name }
      : { winner: match.teamB.name, loser: match.teamA.name };
  }
  if (manual && teamsReady && [match.teamA.name, match.teamB.name].includes(manual)) {
    return { winner: manual, loser: manual === match.teamA.name ? match.teamB.name : match.teamA.name };
  }
  return { winner: null, loser: null };
}

export function resolveBracket(state) {
  const winners = {};
  const losers = {};
  const resolvedMatches = [];

  for (const base of MATCHES) {
    const match = {
      ...base,
      teamA: resolveSlot(base.teamA, winners, losers),
      teamB: resolveSlot(base.teamB, winners, losers),
      score: state.scores[base.id] ?? null,
      manualWinner: state.manualWinners[base.id] ?? null,
    };
    const result = inferResult(match, state);
    match.winner = result.winner;
    match.loser = result.loser;
    if (result.winner) winners[base.id] = result.winner;
    if (result.loser) losers[base.id] = result.loser;
    resolvedMatches.push(match);
  }

  return { matches: resolvedMatches, winners, losers, state };
}

export function getProgress(resolved) {
  const completed = resolved.matches.filter((m) => Boolean(m.winner)).length;
  const sf101 = resolved.matches.find((m) => m.id === 101);
  const sf102 = resolved.matches.find((m) => m.id === 102);
  return {
    completed,
    total: MATCHES.length,
    percent: Math.round((completed / MATCHES.length) * 100),
    finalists: [sf101?.winner || `${sf101?.teamA.name} / ${sf101?.teamB.name}`, sf102?.winner || `${sf102?.teamA.name} / ${sf102?.teamB.name}`],
    champion: resolved.winners[104] || null,
  };
}

export function getTeams() {
  const names = new Set();
  for (const m of MATCHES.filter((m) => m.round === 'r32')) {
    names.add(m.teamA.name);
    names.add(m.teamB.name);
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'ru'));
}
