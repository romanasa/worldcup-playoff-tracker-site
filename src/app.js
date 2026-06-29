import { ROUNDS, SCOREBOARD_URL } from './data.js';
import { applyEspnScoreboard, createInitialState, formatTbilisiTime, getBracketScheme, getHomeSummary, getProgress, getTeams, resolveBracket } from './bracket.js';
import { formatOddsTime, getMatchOdds, ODDS_SNAPSHOT_URL } from './odds.js?v=real-odds2';
import { fetchTeamContext, findHeadToHead } from './teamContext.js';

const STORAGE_KEY = 'wc2026-playoff-tracker-v2';
const REFRESH_MS = 60_000;
const LIVE_REFRESH_MS = 15_000;
const ODDS_REFRESH_MS = 5 * 60_000;
const ESPN_SUMMARY_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';
const $ = (id) => document.getElementById(id);

let state = loadState();
let liveStatus = { text: 'Live-счёт: ещё не обновлялся', ok: true };
let refreshTimer = null;
let currentView = 'bracket';
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
function hasTeam(match, name) { return [match.teamA.name, match.teamB.name, match.winner, match.loser].includes(name); }
function visibleMatch(match) {
  const status = $('statusFilter').value;
  const team = $('teamFilter').value;
  if (status === 'completed' && !match.winner) return false;
  if (status === 'upcoming' && match.winner) return false;
  if (team !== 'all' && !hasTeam(match, team)) return false;
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
  for (const match of resolved.matches.filter(visibleMatch)) {
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
    <small>M${match.id} · ${shortTime(match.kickoffUtc)}</small>
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
  $('bracketViewBtn').classList.toggle('active', currentView === 'bracket');
  $('schemeViewBtn').classList.toggle('active', currentView === 'scheme');
  $('scheduleViewBtn').classList.toggle('active', currentView === 'schedule');
}

function formPills(form = []) {
  return form.length ? form.map((r) => `<span class="formPill result-${r}">${r}</span>`).join('') : '<span class="muted">нет данных</span>';
}

function recentList(context) {
  if (!context?.recent?.length) return '<p class="muted">Нет данных ESPN по последним матчам</p>';
  return `<ul class="recentList">${context.recent.slice(0, 3).map((m) => `<li><b>${m.outcome}</b> ${m.score} vs ${m.opponent}</li>`).join('')}</ul>`;
}

function contextHtml(a, b) {
  if (!a || !b) return '<section class="teamContext"><h3>Форма команд</h3><p class="muted">Данные недоступны для одной из команд.</p></section>';
  const h2h = findHeadToHead(a, b);
  return `<section class="teamContext">
    <h3>Форма команд</h3>
    <div class="formGrid"><span>${a.team}</span><div>${formPills(a.form)}</div><span>${b.team}</span><div>${formPills(b.form)}</div></div>
    <h3>Последние матчи</h3>
    <div class="recentGrid"><div><h4>${a.team}</h4>${recentList(a)}</div><div><h4>${b.team}</h4>${recentList(b)}</div></div>
    <h3>Очные встречи</h3>
    ${h2h.length ? `<ul class="recentList">${h2h.map((m) => `<li>${m.score} · ${m.date.slice(0, 10)}</li>`).join('')}</ul>` : '<p class="muted">В последних данных ESPN очных матчей нет.</p>'}
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
    <p class="muted sourceNote">Важно: это не рынок прохода дальше. 90 минут и «победа без ничьей» не равны проходу после овертайма/пенальти.</p>
    <p class="muted sourceNote">Оценки нормализованы из коэффициентов и не являются рекомендацией.</p>
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

function liveEventIcon(type = '') {
  if (type.includes('goal')) return '⚽';
  if (type.includes('yellow-card')) return '🟨';
  if (type.includes('red-card')) return '🟥';
  if (type.includes('substitution')) return '🔁';
  if (type.includes('halftime')) return 'HT';
  if (type.includes('kickoff')) return '▶';
  return '•';
}

function eventText(event) {
  return event.shortText || event.text || event.type?.text || 'Событие';
}

function liveEventsHtml(events = []) {
  if (!events.length) {
    return `<section class="liveEvents"><h3>Live-события</h3><p class="muted">ESPN пока не отдаёт события по этому матчу.</p></section>`;
  }
  return `<section class="liveEvents">
    <h3>Live-события</h3>
    <ol class="eventList">${events.slice(0, 8).map((event) => `
      <li class="eventItem ${event.scoringPlay ? 'scoring' : ''}">
        <span class="eventMinute">${event.clock?.displayValue || '—'}</span>
        <span class="eventIcon">${liveEventIcon(event.type?.type || event.type?.text || '')}</span>
        <span><b>${eventText(event)}</b>${event.team?.displayName ? `<small>${event.team.displayName}</small>` : ''}</span>
      </li>`).join('')}
    </ol>
    <p class="muted sourceNote">Источник: ESPN match summary · последние ключевые события сверху</p>
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
  const events = (data.keyEvents || [])
    .slice()
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
    <dl class="detailGrid">
      <dt>Время</dt><dd>${formatTbilisiTime(match.kickoffUtc)} ТБС</dd>
      <dt>Стадион</dt><dd>${match.venue}</dd>
      <dt>Победитель</dt><dd>${match.winner || (match.status?.state === 'in' && match.score ? `если закончится сейчас: ${Number(match.score.a) > Number(match.score.b) ? match.teamA.name : Number(match.score.b) > Number(match.score.a) ? match.teamB.name : 'ничья / овертайм'}` : 'ещё не определён')}</dd>
      <dt>Источник</dt><dd>${match.status?.source || 'schedule'} · обновлено ${updated}</dd>
      <dt>Статус API</dt><dd>${match.status?.detail || match.status?.badge || '—'}</dd>
    </dl>
    <div id="liveEventsBlock" class="contextLoading">Загружаю live-события…</div>
    ${oddsHtml(match)}
    <div id="teamContextBlock" class="contextLoading">Загружаю форму команд…</div>
  `;
  $('matchDialog').showModal();
  try {
    const events = await loadMatchSummary(match);
    $('liveEventsBlock').outerHTML = liveEventsHtml(events);
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
  $('teamFilter').innerHTML = '<option value="all">Все команды</option>' + getTeams().map((t) => `<option value="${t}">${t}</option>`).join('');
  $('statusFilter').addEventListener('change', render);
  $('teamFilter').addEventListener('change', render);
  $('bracketViewBtn').addEventListener('click', () => { currentView = 'bracket'; render(); });
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
  refreshOddsSnapshot();
  setInterval(refreshOddsSnapshot, ODDS_REFRESH_MS);
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
    liveStatus = { ok: true, text: `ESPN обновлён ${updated} ТБС · авто ${nextInterval / 1000} сек.` };
  } catch (error) {
    scheduleNextRefresh();
    liveStatus = { ok: false, text: `Live-счёт недоступен: ${error.message}` };
  }
  render();
}

initFilters(); render(); scheduleOddsRefresh(); refreshScores();
