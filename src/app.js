import { ROUNDS, SCOREBOARD_URL } from './data.js';
import { applyEspnScoreboard, createInitialState, formatTbilisiTime, getBracketScheme, getHomeSummary, getProgress, getTeams, resolveBracket } from './bracket.js';

const STORAGE_KEY = 'wc2026-playoff-tracker-v2';
const REFRESH_MS = 60_000;
const LIVE_REFRESH_MS = 15_000;
const $ = (id) => document.getElementById(id);

let state = loadState();
let liveStatus = { text: 'Live-счёт: ещё не обновлялся', ok: true };
let refreshTimer = null;
let currentView = 'bracket';

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

function showMatchDetails(matchId) {
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
  `;
  $('matchDialog').showModal();
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

initFilters(); render(); refreshScores();
