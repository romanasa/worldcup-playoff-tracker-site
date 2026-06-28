export const TEAM_CONTEXT_API = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams';

function scoreOf(competitor) {
  const score = competitor?.score;
  if (score == null) return null;
  if (typeof score === 'object') return Number(score.value ?? score.displayValue);
  return Number(score);
}

function outcomeFor(team, own, opp) {
  if (!Number.isFinite(own) || !Number.isFinite(opp)) return '—';
  if (own > opp) return 'В';
  if (own < opp) return 'П';
  return 'Н';
}

export function parseTeamSchedule(teamName, espnTeamId, schedule) {
  const events = (schedule?.events || [])
    .filter((event) => event.competitions?.[0]?.status?.type?.state === 'post')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const matches = events.map((event) => {
    const competitors = event.competitions[0].competitors || [];
    const own = competitors.find((c) => String(c.team?.id) === String(espnTeamId) || c.team?.displayName === teamName);
    const opponent = competitors.find((c) => c !== own);
    const ownScore = scoreOf(own);
    const oppScore = scoreOf(opponent);
    return {
      id: event.id,
      date: event.date,
      team: teamName,
      opponent: opponent?.team?.displayName || '—',
      ownScore,
      oppScore,
      score: Number.isFinite(ownScore) && Number.isFinite(oppScore) ? `${ownScore}:${oppScore}` : '—',
      outcome: outcomeFor(teamName, ownScore, oppScore),
    };
  }).filter((match) => match.opponent !== '—');

  return {
    team: teamName,
    espnTeamId,
    form: matches.slice(0, 5).map((match) => match.outcome),
    recent: matches.slice(0, 5),
    source: 'ESPN',
    updatedAt: schedule?.timestamp || new Date().toISOString(),
  };
}

export function findHeadToHead(teamAContext, teamBContext) {
  const b = teamBContext.team;
  return teamAContext.recent
    .filter((match) => match.opponent === b)
    .slice(0, 3);
}

export async function fetchTeamContext(team) {
  if (!team?.espnTeamId) return null;
  const response = await fetch(`${TEAM_CONTEXT_API}/${team.espnTeamId}/schedule`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`ESPN team ${team.name}: HTTP ${response.status}`);
  return parseTeamSchedule(team.name, team.espnTeamId, await response.json());
}
