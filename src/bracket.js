import { MATCHES } from './data.js?v=bracket-fix1';

const clone = (value) => JSON.parse(JSON.stringify(value));
const KNOWN_TEAMS = new Map(MATCHES.flatMap((match) => [match.teamA, match.teamB])
  .filter((team) => team.type === 'team')
  .map((team) => [team.name, team]));

export function createInitialState() {
  return { scores: {}, manualWinners: {}, statuses: {}, favorites: [] };
}

export function setScore(state, matchId, scoreA, scoreB) {
  const next = clone(state);
  if (scoreA === '' || scoreB === '' || scoreA == null || scoreB == null) {
    delete next.scores[matchId];
    return next;
  }
  next.scores[matchId] = {
    a: Number.isFinite(Number(scoreA)) ? Number(scoreA) : null,
    b: Number.isFinite(Number(scoreB)) ? Number(scoreB) : null,
  };
  return next;
}

function setScoreDetails(state, matchId, scoreA, scoreB, penA = null, penB = null) {
  const next = setScore(state, matchId, scoreA, scoreB);
  if (penA !== null && penB !== null && next.scores[matchId]) {
    next.scores[matchId].penA = Number(penA);
    next.scores[matchId].penB = Number(penB);
  }
  return next;
}

export function setManualWinner(state, matchId, winnerName) {
  const next = clone(state);
  if (winnerName) next.manualWinners[matchId] = winnerName;
  else delete next.manualWinners[matchId];
  return next;
}

function setMatchStatus(state, matchId, status) {
  const next = clone(state);
  next.statuses ||= {};
  next.statuses[matchId] = status;
  return next;
}

function normalizeEspnStatus(event, hasPenalties = false) {
  const type = event.status?.type || {};
  const state = type.state || 'pre';
  const detail = type.shortDetail || type.detail || type.description || '';
  let minute = event.status?.displayClock || detail.match(/\d+'/)?.[0] || '';
  let badge = 'SCHEDULED';
  if (state !== 'in') minute = '';
  if (state === 'in') badge = /half/i.test(detail) || detail === 'HT' ? 'HT' : 'LIVE';
  if (state === 'post') badge = hasPenalties || /pen/i.test(detail) ? 'PEN' : /AET|Extra/i.test(detail) ? 'AET' : 'FT';
  return { state, badge, detail, minute, source: 'ESPN', updatedAt: new Date().toISOString() };
}

function labelForSlot(slot) {
  if (slot.type === 'team') return slot.name;
  if (slot.type === 'winner') return `Победитель M${slot.id}`;
  return `Проигравший M${slot.id}`;
}

function resolveSlot(slot, winners, losers) {
  if (slot.type === 'team') return { name: slot.name, espnName: slot.espnName, espnTeamId: slot.espnTeamId, placeholder: false };
  if (slot.type === 'winner' && winners[slot.id]) {
    const base = KNOWN_TEAMS.get(winners[slot.id]);
    return { name: winners[slot.id], espnName: base?.espnName, espnTeamId: base?.espnTeamId, placeholder: false };
  }
  if (slot.type === 'loser' && losers[slot.id]) {
    const base = KNOWN_TEAMS.get(losers[slot.id]);
    return { name: losers[slot.id], espnName: base?.espnName, espnTeamId: base?.espnTeamId, placeholder: false };
  }
  return { name: labelForSlot(slot), placeholder: true };
}

export function getMatchPath(matchId, matchMap = MATCHES) {
  const feedsFrom = [];
  let winnerTo = null;
  let loserTo = null;

  for (const match of matchMap) {
    for (const slotName of ['teamA', 'teamB']) {
      const slot = match[slotName];
      if (slot?.id !== matchId) continue;
      const target = { matchId: match.id, slot: slotName };
      if (slot.type === 'winner') winnerTo = target;
      if (slot.type === 'loser') loserTo = target;
    }
    for (const slot of [match.teamA, match.teamB]) {
      if (slot?.type === 'winner' && match.id === matchId) feedsFrom.push(slot.id);
    }
  }

  return { winnerTo, loserTo, feedsFrom };
}

function inferResult(match, state) {
  const score = state.scores[match.id];
  const teamsReady = !match.teamA.placeholder && !match.teamB.placeholder;
  const manual = state.manualWinners[match.id];
  if (manual && teamsReady && [match.teamA.name, match.teamB.name].includes(manual)) {
    return { winner: manual, loser: manual === match.teamA.name ? match.teamB.name : match.teamA.name };
  }
  if (match.status?.source === 'ESPN' && match.status.state !== 'post') {
    return { winner: null, loser: null };
  }
  if (score && Number.isFinite(score.a) && Number.isFinite(score.b) && score.a !== score.b && teamsReady) {
    return score.a > score.b
      ? { winner: match.teamA.name, loser: match.teamB.name }
      : { winner: match.teamB.name, loser: match.teamA.name };
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
      status: state.statuses?.[base.id] ?? { state: 'pre', badge: 'SCHEDULED', detail: 'Scheduled', source: 'schedule' },
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

export function getBracketScheme(resolved) {
  const columns = [
    { key: 'r32', label: '1/32 финала' },
    { key: 'r16', label: '1/16 финала' },
    { key: 'qf', label: '1/4 финала' },
    { key: 'sf', label: '1/2 финала' },
    { key: 'finals', label: 'Финалы' },
  ];
  return columns.map((column) => {
    const matches = resolved.matches.filter((m) => column.key === 'finals' ? (m.final || m.bronze) : m.round === column.key);
    return { ...column, ids: matches.map((m) => m.id), matches };
  });
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
  return [...KNOWN_TEAMS.keys()].sort((a, b) => a.localeCompare(b, 'ru'));
}

export function formatTbilisiTime(iso) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Tbilisi',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function tbilisiDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatCountdown(ms) {
  if (ms <= 0) return 'начинается сейчас';
  const totalMinutes = Math.round(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `через ${days} д ${hours} ч`;
  if (hours > 0) return `через ${hours} ч${minutes ? ` ${minutes} мин` : ''}`;
  return `через ${minutes} мин`;
}

export function getHomeSummary(resolved, now = new Date()) {
  const matches = [...resolved.matches].sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc));
  const nowTime = now.getTime();
  const todayKey = tbilisiDateKey(now);
  const live = matches.filter((m) => m.status?.state === 'in');
  const upcoming = matches.filter((m) => !m.winner && new Date(m.kickoffUtc).getTime() >= nowTime);
  const next = live[0] || upcoming[0] || null;
  const today = matches.filter((m) => tbilisiDateKey(new Date(m.kickoffUtc)) === todayKey);
  return {
    live,
    today,
    next,
    countdown: next ? formatCountdown(new Date(next.kickoffUtc).getTime() - nowTime) : '',
    primary: live[0] ? { type: 'live', match: live[0] } : next ? { type: 'next', match: next } : { type: 'done', match: matches.at(-1) || null },
  };
}

function translatedEspnTeam(espnName) {
  return MATCHES.flatMap((m) => [m.teamA, m.teamB])
    .find((team) => team.type === 'team' && team.espnName === espnName);
}

function resolvedMatchForScoreboard(matchId, state) {
  return resolveBracket(state).matches.find((item) => item.id === matchId);
}

function displayNameForSlot(slot) {
  return slot?.espnName || translatedEspnTeam(slot?.name)?.espnName || slot?.name;
}

function localNameForEspnTeam(espnName, match) {
  if (displayNameForSlot(match.teamA) === espnName) return match.teamA.name;
  if (displayNameForSlot(match.teamB) === espnName) return match.teamB.name;
  return translatedEspnTeam(espnName)?.name || null;
}

export function applyEspnScoreboard(state, events, matchMap = MATCHES) {
  let next = clone(state);
  const byEspn = new Map(matchMap.map((m) => [String(m.espnId), m]));

  for (const event of events || []) {
    const baseMatch = byEspn.get(String(event.id));
    if (!baseMatch) continue;
    const competition = event.competitions?.[0];
    const home = competition?.competitors?.find((c) => c.homeAway === 'home');
    const away = competition?.competitors?.find((c) => c.homeAway === 'away');
    const hasPenalties = home?.shootoutScore != null || away?.shootoutScore != null;
    next = setMatchStatus(next, baseMatch.id, normalizeEspnStatus(event, hasPenalties));
    const status = event.status?.type || {};
    if (!competition || status.state === 'pre') continue;

    // Later knockout rounds are declared as winner(Mxx) placeholders in MATCHES.
    // Resolve the bracket with already-applied ESPN finals before matching ESPN
    // display names, otherwise M89+ cannot get scores or official winners.
    const match = resolvedMatchForScoreboard(baseMatch.id, next) || baseMatch;
    const scoreByName = new Map([
      [home?.team?.displayName, Number(home?.score)],
      [away?.team?.displayName, Number(away?.score)],
    ]);
    const pensByName = new Map([
      [home?.team?.displayName, home?.shootoutScore],
      [away?.team?.displayName, away?.shootoutScore],
    ]);

    const teamAName = displayNameForSlot(match.teamA);
    const teamBName = displayNameForSlot(match.teamB);
    const scoreA = scoreByName.get(teamAName);
    const scoreB = scoreByName.get(teamBName);
    const penA = pensByName.get(teamAName);
    const penB = pensByName.get(teamBName);
    if (Number.isFinite(scoreA) && Number.isFinite(scoreB)) {
      next = setScoreDetails(next, baseMatch.id, scoreA, scoreB, penA ?? null, penB ?? null);
    }

    if (status.state === 'post') {
      const espnWinner = competition.competitors?.find((c) => c.winner)?.team?.displayName;
      const winnerName = localNameForEspnTeam(espnWinner, match);
      if (winnerName) next = setManualWinner(next, baseMatch.id, winnerName);
    }
  }
  return next;
}
