import { MATCHES, ROUNDS, SCOREBOARD_URL } from './data.js';
import { applyEspnScoreboard, createInitialState, formatTbilisiTime, getBracketScheme, getHomeSummary, getProgress, resolveBracket } from './bracket.js';
import { formatOddsTime, getMatchOdds, ODDS_SNAPSHOT_URL } from './odds.js?v=real-odds2';
import { fetchTeamContext, findHeadToHead } from './teamContext.js';

const STORAGE_KEY = 'wc2026-playoff-tracker-v2';
const REFRESH_MS = 60_000;
const LIVE_REFRESH_MS = 15_000;
const ODDS_REFRESH_MS = 5 * 60_000;
const LIVE_ODDS_REFRESH_MS = 60_000;
const ESPN_SUMMARY_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';
const $ = (id) => document.getElementById(id);

let state = loadState();
let liveStatus = { text: 'Live-счёт: ещё не обновлялся', ok: true };
let refreshTimer = null;
let oddsTimer = null;
let currentView = 'scheme';
const teamContextCache = new Map();
let oddsSnapshot = null;
const matchSummaryCache = new Map();

function loadState() {
  try { return { ...createInitialState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch { return createInitialState(); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function scoreValue(match, side) { return match.score?.[side] ?? ''; }
function penaltyValue(match, side) { return side === 'a' ? match.score?.penA : match.score?.penB; }
function visibleMatch(match) {
  return true;
}

function teamRow(match, side) {
  const team = side === 'a' ? match.teamA : match.teamB;
  const score = side === 'a' ? scoreValue(match, 'a') : scoreValue(match, 'b');
  const penalty = penaltyValue(match, side);
  const isWinner = match.winner === team.name;
  return `<div class="teamRow readonly">
    <div class="team ${team.placeholder ? 'placeholder' : ''} ${isWinner ? 'winner' : ''}">${team.name}</div>
    <div class="scoreBox" aria-label="Счёт ${team.name}">${score === '' ? '—' : score}${penalty != null ? `<small>(${penalty})</small>` : ''}</div>
  </div>`;
}

function statusLine(match) {
  const status = match.status || {};
  const updated = status.updatedAt
    ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tbilisi', hour: '2-digit', minute: '2-digit' }).format(new Date(status.updatedAt))
    : '';
  const parts = [`<span class="badge ${status.badge || 'SCHEDULED'}">${status.badge || 'SCHEDULED'}</span>`];
  if (status.minute) parts.push(status.minute);
  if (updated) parts.push(`ESPN ${updated}`);
  return parts.join(' · ');
}

function matchTitle(match) { return match.final ? 'Финал' : match.bronze ? '3-е место' : `Матч ${match.id}`; }
function roundLabel(match) { return ROUNDS.find((round) => round.key === match.round)?.label || ''; }
function teamsText(match) { return `${match.teamA.name} — ${match.teamB.name}`; }
function formatScore(match) {
  if (!match.score) return '— : —';
  const pens = match.score.penA != null ? ` пен. ${match.score.penA}:${match.score.penB}` : '';
  return `${match.score.a}:${match.score.b}${pens}`;
}
function shortTime(iso) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tbilisi', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
function dateLabel(iso) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tbilisi', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
}
function dateKey(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

function matchCard(match) {
  return `<article class="match ${match.winner ? 'completed' : ''} ${match.final ? 'final' : ''} status-${match.status?.badge || 'SCHEDULED'}" data-match-id="${match.id}" tabindex="0" role="button" aria-label="Детали матча ${match.id}">
    <div class="meta"><strong>${matchTitle(match)}</strong><span>${formatTbilisiTime(match.kickoffUtc)} ТБС</span></div>
    <div class="meta statusMeta">${statusLine(match)}</div>
    ${teamRow(match, 'a')}${teamRow(match, 'b')}
    <div class="meta"><span>${match.venue}</span>${match.winner ? `<span>✓ ${match.winner}</span>` : '<span>ожидает'}</div>
  </article>`;
}

function scheduleRow(match, compact = false) {
  return `<article class="scheduleRow ${match.status?.state === 'in' ? 'liveNow' : ''}" data-match-id="${match.id}" tabindex="0" role="button" aria-label="Детали матча ${match.id}">
    <time>${shortTime(match.kickoffUtc)}</time>
    <div><strong>${teamsText(match)}</strong>${compact ? '' : `<span>${matchTitle(match)} · ${match.venue}</span>`}</div>
    <div class="scheduleStatus">${statusLine(match)}</div>
  </article>`;
}

function renderHome(resolved) {
  const summary = getHomeSummary(resolved);
  const progress = getProgress(resolved);
  const primary = summary.primary.match;
  const isLive = summary.primary.type === 'live';
  const todayList = (summary.today.length ? summary.today : resolved.matches.filter((m) => !m.winner).slice(0, 3)).slice(0, 4);
  $('homeSummary').innerHTML = `
    <article class="panel nowCard ${isLive ? 'liveNow' : ''}">
      <p class="eyebrow">${isLive ? 'Сейчас идёт' : 'Следующий матч'}</p>
      ${primary ? `<h2>${teamsText(primary)}</h2>
      <div class="heroScore">${formatScore(primary)}</div>
      <p>${statusLine(primary)}</p>
      <p class="muted">${dateLabel(primary.kickoffUtc)}, ${shortTime(primary.kickoffUtc)} ТБС · ${summary.countdown}</p>
      <p class="muted">${primary.venue}</p>` : '<h2>Турнир завершён</h2>'}
    </article>
    <article class="panel todayCard">
      <p class="eyebrow">${summary.today.length ? 'Сегодня' : 'Ближайшие'}</p>
      <div class="todayList">${todayList.map((m) => scheduleRow(m, true)).join('') || '<p class="muted">Матчей нет</p>'}</div>
    </article>`;
  $('syncLine').className = `syncLine ${liveStatus.ok ? '' : 'error'}`;
  $('syncLine').textContent = `${liveStatus.text} · ${progress.completed}/${progress.total} завершено`;
}

function renderBracket(resolved) {
  const html = ROUNDS.map((round) => {
    const cards = resolved.matches.filter((m) => round.ids.includes(m.id)).filter(visibleMatch).map(matchCard).join('');
    return `<section class="round"><h2>${round.label}</h2>${cards || '<div class="empty">Нет матчей по фильтру</div>'}</section>`;
  }).join('');
  $('bracket').innerHTML = html;
}

function renderSchedule(resolved) {
  const groups = new Map();
  const sorted = resolved.matches
    .filter(visibleMatch)
    .slice()
    .sort((a, b) => {
      const aDone = a.winner || a.status?.state === 'post' ? 1 : 0;
      const bDone = b.winner || b.status?.state === 'post' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return new Date(a.kickoffUtc) - new Date(b.kickoffUtc);
    });
  for (const match of sorted) {
    const key = dateKey(match.kickoffUtc);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(match);
  }
  $('schedule').innerHTML = [...groups.values()].map((matches) => `
    <section class="scheduleDay">
      <h2>${dateLabel(matches[0].kickoffUtc)}</h2>
      ${matches.map((m) => scheduleRow(m)).join('')}
    </section>`).join('') || '<div class="empty">Нет матчей по фильтру</div>';
}

function schemeNode(match) {
  const score = match.score ? `<span class="schemeScore">${formatScore(match)}</span>` : '';
  return `<article class="schemeMatch ${match.status?.state === 'in' ? 'liveNow' : ''} ${match.winner ? 'completed' : ''}" data-match-id="${match.id}" tabindex="0" role="button" aria-label="Детали матча ${match.id}">
    <small>M${match.id} · ${formatTbilisiTime(match.kickoffUtc)} ТБС</small>
    <strong>${match.teamA.name}</strong>
    <strong>${match.teamB.name}</strong>
    ${score}
  </article>`;
}

function renderScheme(resolved) {
  const scheme = getBracketScheme(resolved);
  $('scheme').innerHTML = `<div class="schemeCanvas">
    ${scheme.map((column) => `<section class="schemeColumn scheme-${column.key}">
      <h2>${column.label}</h2>
      <div class="schemeStack">${column.matches.map(schemeNode).join('')}</div>
    </section>`).join('')}
  </div>`;
}

function render() {
  const resolved = resolveBracket(state);
  renderHome(resolved);
  renderBracket(resolved);
  renderScheme(resolved);
  renderSchedule(resolved);
  $('bracket').classList.toggle('hidden', currentView !== 'bracket');
  $('scheme').classList.toggle('hidden', currentView !== 'scheme');
  $('schedule').classList.toggle('hidden', currentView !== 'schedule');
  $('schemeViewBtn').classList.toggle('active', currentView === 'scheme');
  $('scheduleViewBtn').classList.toggle('active', currentView === 'schedule');
}

const TEAM_NAME_BY_ESPN = new Map(MATCHES.flatMap((match) => [match.teamA, match.teamB])
  .filter((team) => team?.type === 'team')
  .map((team) => [team.espnName, team.name]));
Object.entries({ Iraq: 'Ирак', Tunisia: 'Тунис', Scotland: 'Шотландия', Haiti: 'Гаити', Curaçao: 'Кюрасао' })
  .forEach(([en, ru]) => TEAM_NAME_BY_ESPN.set(en, ru));

function localTeamName(name) { return TEAM_NAME_BY_ESPN.get(name) || name; }

function formPoints(form = []) {
  return form.slice(0, 3).reduce((sum, item) => sum + (item === 'В' ? 3 : item === 'Н' ? 1 : 0), 0);
}

function formStats(context) {
  const recent = context?.recent?.slice(0, 3) || [];
  return {
    points: formPoints(context?.form),
    goalsFor: recent.reduce((sum, match) => sum + (Number(match.ownScore) || 0), 0),
    goalsAgainst: recent.reduce((sum, match) => sum + (Number(match.oppScore) || 0), 0),
    wins: recent.filter((match) => match.outcome === 'В').length,
  };
}

function formDots(form = []) {
  const icons = { 'В': '🟢', 'Н': '⚪', 'П': '🔴' };
  return form.slice(0, 3).map((r) => `<span class="formDot" title="${r}">${icons[r] || '•'}</span>`).join('') || '<span class="muted">нет данных</span>';
}

function compactRecent(context) {
  if (!context?.recent?.length) return '<span class="muted">нет данных</span>';
  return context.recent.slice(0, 3).map((match) => `${match.score} ${localTeamName(match.opponent)}`).join(' · ');
}

function formVerdict(a, b) {
  const aStats = formStats(a);
  const bStats = formStats(b);
  const diff = aStats.points - bStats.points;
  const leader = diff > 1 ? a : diff < -1 ? b : null;
  if (!leader) return `Форма примерно равная · ${aStats.points}:${bStats.points} очков за 3 матча`;
  const stats = leader === a ? aStats : bStats;
  const streak = stats.wins === 3 ? ' · 3 победы подряд' : '';
  return `${leader.team} лучше по последним матчам · ${stats.points}/9 очков${streak} · мячи ${stats.goalsFor}–${stats.goalsAgainst}`;
}

function compactFormRow(context) {
  const stats = formStats(context);
  return `<div class="compactFormRow">
    <strong>${context.team}</strong>
    <span class="formDots">${formDots(context.form)}</span>
    <small>${stats.goalsFor}–${stats.goalsAgainst}</small>
    <p>${compactRecent(context)}</p>
  </div>`;
}

function contextHtml(a, b) {
  if (!a || !b) return '<section class="teamContext"><h3>Форма</h3><p class="muted">Данные недоступны для одной из команд.</p></section>';
  const h2h = findHeadToHead(a, b);
  return `<section class="teamContext compactTeamContext">
    <h3>Форма</h3>
    <div class="formVerdict">${formVerdict(a, b)}</div>
    ${compactFormRow(a)}
    ${compactFormRow(b)}
    ${h2h.length ? `<h3>Очные встречи</h3><ul class="recentList">${h2h.map((m) => `<li>${m.score} · ${m.date.slice(0, 10)}</li>`).join('')}</ul>` : ''}
    <p class="muted sourceNote">Источник: ESPN team schedule</p>
  </section>`;
}

function oddsRows(odds = {}, probabilities = {}) {
  return Object.entries(odds).map(([team, price]) => `
    <div class="oddsRow">
      <span>${team}</span>
      <b>${probabilities[team] ?? '—'}%</b>
      <strong>${Number(price).toFixed(2)}</strong>
    </div>`).join('');
}

function favoriteFromMarket(market) {
  if (!market?.odds) return null;
  return Object.entries(market.odds)
    .filter(([team, price]) => team !== 'Ничья' && Number.isFinite(Number(price)))
    .sort((a, b) => Number(a[1]) - Number(b[1]))[0] || null;
}

function favoriteSummaryHtml(match) {
  const odds = getMatchOdds(match.id, oddsSnapshot);
  const market = odds?.markets?.h2h_3_way || odds?.markets?.draw_no_bet;
  const favorite = favoriteFromMarket(market);
  if (!odds?.available || !market || !favorite) {
    return `<section class="favoriteStrip muted"><b>Фаворит</b><span>коэффициентов пока нет</span></section>`;
  }
  const [team, price] = favorite;
  const probability = market.probabilities?.[team];
  const updated = formatOddsTime(oddsSnapshot?.updatedAt);
  return `<section class="favoriteStrip">
    <b>Фаворит 90 мин</b>
    <strong>${team}</strong>
    <span>${probability ? `${probability}% · ` : ''}${Number(price).toFixed(2)}</span>
    <small>обновлено ${updated} ТБС</small>
  </section>`;
}

function oddsMarketHtml(market) {
  return `<div class="oddsMarket">
    <h4>${market.label}</h4>
    <div class="oddsTable">
      <div class="oddsHead"><span>Исход</span><span>Оценка</span><span>Коэф.</span></div>
      ${oddsRows(market.odds, market.probabilities)}
    </div>
  </div>`;
}

function oddsHtml(match) {
  const odds = getMatchOdds(match.id, oddsSnapshot);
  const source = oddsSnapshot?.source || 'The Odds API';
  const updated = formatOddsTime(oddsSnapshot?.updatedAt);
  if (!odds?.available) {
    return `<section class="oddsBlock">
      <h3>Коэффициенты</h3>
      <p class="muted">${odds?.message || 'Коэффициенты пока недоступны'}</p>
      <p class="muted sourceNote">Источник: ${source}${oddsSnapshot?.updatedAt ? ` · обновлено ${updated} ТБС` : ''}</p>
    </section>`;
  }
  const markets = [odds.markets?.h2h_3_way, odds.markets?.draw_no_bet].filter(Boolean);
  const bookmakers = [...new Set(markets.map((market) => market.sourceBookmaker).filter(Boolean))].join(', ');
  return `<section class="oddsBlock">
    <h3>Коэффициенты</h3>
    ${markets.map(oddsMarketHtml).join('')}
    <p class="muted sourceNote">Источник: ${source}${bookmakers ? ` / ${bookmakers}` : ''} · обновлено ${updated} ТБС</p>
  </section>`;
}

async function loadTeamContext(match) {
  const teams = [match.teamA, match.teamB];
  const loaded = await Promise.all(teams.map(async (team) => {
    if (team.placeholder || !team.espnTeamId) return null;
    if (!teamContextCache.has(team.espnTeamId)) teamContextCache.set(team.espnTeamId, fetchTeamContext(team));
    return teamContextCache.get(team.espnTeamId);
  }));
  return loaded;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function eventType(event) { return event.type?.type || event.type?.text || ''; }
function isServiceEvent(event) { return ['start-delay', 'end-delay', 'kickoff'].includes(eventType(event)); }
function isImportantEvent(event) {
  const type = eventType(event);
  return type.includes('goal') || ['yellow-card', 'red-card', 'substitution', 'halftime'].includes(type);
}

function eventTeamName(event, match) {
  const name = event.team?.displayName;
  if (!name) return '';
  if (name === match.teamA.espnName) return match.teamA.name;
  if (name === match.teamB.espnName) return match.teamB.name;
  return name;
}

function liveEventIcon(type = '') {
  if (type.includes('goal')) return '⚽';
  if (type.includes('yellow-card')) return '🟨';
  if (type.includes('red-card')) return '🟥';
  if (type.includes('substitution')) return '🔁';
  if (type.includes('halftime')) return 'HT';
  return '•';
}

function substitutionText(event) {
  const [incoming, outgoing] = (event.participants || []).map((item) => item.athlete?.displayName).filter(Boolean);
  if (incoming && outgoing) return `${incoming} вместо ${outgoing}`;
  if (incoming) return `${incoming} — замена`;
  const match = (event.text || '').match(/Substitution, .*?\. (.*?) replaces (.*?)(?:\.| because|$)/);
  if (match) return `${match[1]} вместо ${match[2]}`;
  return 'Замена';
}

function goalText(event) {
  const scorer = event.participants?.[0]?.athlete?.displayName || (event.shortText || '').replace(/ Goal.*/, '');
  const header = /header/i.test(event.text || event.shortText || '') || eventType(event).includes('header') ? ', головой' : '';
  return `${scorer} — гол${header}`;
}

function eventText(event) {
  const type = eventType(event);
  if (type === 'substitution') return substitutionText(event);
  if (type.includes('goal')) return goalText(event);
  if (type === 'yellow-card') return `${event.participants?.[0]?.athlete?.displayName || event.shortText?.replace(/ Yellow Card.*/, '') || 'Игрок'} — жёлтая карточка`;
  if (type === 'red-card') return `${event.participants?.[0]?.athlete?.displayName || event.shortText?.replace(/ Red Card.*/, '') || 'Игрок'} — красная карточка`;
  if (type === 'halftime') return 'Перерыв';
  return event.shortText || event.text || event.type?.text || 'Событие';
}

function liveEventsHtml(events = [], match) {
  const visibleEvents = events.filter(isImportantEvent).filter((event) => !isServiceEvent(event));
  if (!visibleEvents.length) {
    return `<section class="liveEvents"><h3>Live-события</h3><p class="muted">ESPN пока не отдаёт важные события по этому матчу.</p></section>`;
  }
  return `<section class="liveEvents">
    <h3>Live-события</h3>
    <ol class="eventList">${visibleEvents.slice(0, 12).map((event) => {
      const team = eventTeamName(event, match);
      return `
      <li class="eventItem ${event.scoringPlay ? 'scoring' : ''}">
        <span class="eventMinute">${escapeHtml(event.clock?.displayValue || '—')}</span>
        <span class="eventIcon">${liveEventIcon(eventType(event))}</span>
        <span><b>${escapeHtml(eventText(event))}</b>${team ? `<small>${escapeHtml(team)}</small>` : ''}</span>
      </li>`;
    }).join('')}
    </ol>
    <p class="muted sourceNote">Источник: ESPN match summary · служебные паузы скрыты</p>
  </section>`;
}

async function loadMatchSummary(match) {
  if (!match.espnId) return [];
  const cached = matchSummaryCache.get(match.espnId);
  const now = Date.now();
  if (cached && now - cached.loadedAt < 15_000) return cached.events;
  const response = await fetch(`${ESPN_SUMMARY_URL}?event=${match.espnId}&_=${now}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const byId = new Map();
  for (const event of data.keyEvents || []) byId.set(event.id || `${event.clock?.displayValue}-${event.text}`, event);
  for (const item of data.commentary || []) {
    const play = item.play;
    if (!play || !isImportantEvent(play)) continue;
    byId.set(play.id || `${item.time?.displayValue}-${item.text}`, play);
  }
  const events = [...byId.values()]
    .sort((a, b) => (new Date(b.wallclock || 0)) - (new Date(a.wallclock || 0)));
  matchSummaryCache.set(match.espnId, { loadedAt: now, events });
  return events;
}

async function showMatchDetails(matchId) {
  const resolved = resolveBracket(state);
  const match = resolved.matches.find((item) => item.id === matchId);
  if (!match) return;
  const updated = match.status?.updatedAt
    ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tbilisi', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(match.status.updatedAt))
    : '—';
  $('matchDetails').innerHTML = `
    <button class="closeBtn" value="cancel" aria-label="Закрыть">×</button>
    <p class="eyebrow">M${match.id} · ${roundLabel(match)}</p>
    <h2>${teamsText(match)}</h2>
    <div class="detailScore">${formatScore(match)}</div>
    <div class="detailStatus">${statusLine(match)}</div>
    ${favoriteSummaryHtml(match)}
    <dl class="detailGrid compactDetails">
      <dt>Время</dt><dd>${formatTbilisiTime(match.kickoffUtc)} ТБС</dd>
      <dt>Стадион</dt><dd>${match.venue}</dd>
    </dl>
    <p class="muted sourceNote">Счёт: ${match.status?.source || 'schedule'} · обновлено ${updated}${match.status?.detail ? ` · ${match.status.detail}` : ''}</p>
    <div id="liveEventsBlock" class="contextLoading">Загружаю live-события…</div>
    ${oddsHtml(match)}
    <div id="teamContextBlock" class="contextLoading">Загружаю форму команд…</div>
  `;
  $('matchDialog').showModal();
  try {
    const events = await loadMatchSummary(match);
    $('liveEventsBlock').outerHTML = liveEventsHtml(events, match);
  } catch (error) {
    $('liveEventsBlock').outerHTML = `<section class="liveEvents"><h3>Live-события</h3><p class="muted">Не удалось загрузить события ESPN: ${error.message}</p></section>`;
  }
  try {
    const [a, b] = await loadTeamContext(match);
    $('teamContextBlock').outerHTML = contextHtml(a, b);
  } catch (error) {
    $('teamContextBlock').outerHTML = `<section class="teamContext"><h3>Форма команд</h3><p class="muted">Не удалось загрузить данные ESPN: ${error.message}</p></section>`;
  }
}

function openMatchFromEvent(event) {
  const card = event.target.closest('[data-match-id]');
  if (card) showMatchDetails(Number(card.dataset.matchId));
}

function initFilters() {
  $('schemeViewBtn').addEventListener('click', () => { currentView = 'scheme'; render(); });
  $('scheduleViewBtn').addEventListener('click', () => { currentView = 'schedule'; render(); });
  document.addEventListener('click', (event) => {
    if (event.target.id === 'matchDialog' || event.target.closest('.closeBtn')) $('matchDialog').close();
    else openMatchFromEvent(event);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('[data-match-id]');
    if (card) { event.preventDefault(); showMatchDetails(Number(card.dataset.matchId)); }
  });
}

function scheduleNextRefresh() {
  clearInterval(refreshTimer);
  const hasLive = resolveBracket(state).matches.some((m) => m.status?.state === 'in');
  const interval = hasLive ? LIVE_REFRESH_MS : REFRESH_MS;
  refreshTimer = setInterval(refreshScores, interval);
  return interval;
}


async function loadOddsSnapshot() {
  try {
    const response = await fetch(`${ODDS_SNAPSHOT_URL}?_=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    oddsSnapshot = await response.json();
  } catch (error) {
    oddsSnapshot = { source: 'The Odds API', markets: {}, error: error.message };
  }
}

async function refreshOddsSnapshot() {
  await loadOddsSnapshot();
  render();
}

function scheduleOddsRefresh() {
  clearInterval(oddsTimer);
  const hasLive = resolveBracket(state).matches.some((m) => m.status?.state === 'in');
  const interval = hasLive ? LIVE_ODDS_REFRESH_MS : ODDS_REFRESH_MS;
  oddsTimer = setInterval(refreshOddsSnapshot, interval);
  return interval;
}

async function refreshScores() {
  try {
    const response = await fetch(`${SCOREBOARD_URL}&_=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state = applyEspnScoreboard(state, data.events || []);
    saveState();
    const updated = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tbilisi', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
    const nextInterval = scheduleNextRefresh();
    scheduleOddsRefresh();
    liveStatus = { ok: true, text: `ESPN обновлён ${updated} ТБС · авто ${nextInterval / 1000} сек.` };
  } catch (error) {
    scheduleNextRefresh();
    liveStatus = { ok: false, text: `Live-счёт недоступен: ${error.message}` };
  }
  render();
}

initFilters(); render(); refreshOddsSnapshot(); scheduleOddsRefresh(); refreshScores();
