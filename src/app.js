import { ROUNDS, SCOREBOARD_URL } from './data.js';
import { applyEspnScoreboard, createInitialState, formatTbilisiTime, getMatchPath, getProgress, getTeams, resolveBracket } from './bracket.js';

const STORAGE_KEY = 'wc2026-playoff-tracker-v2';
const REFRESH_MS = 60_000;
const LIVE_REFRESH_MS = 15_000;
const $ = (id) => document.getElementById(id);

let state = loadState();
let liveStatus = { text: 'Live-счёт: ещё не обновлялся', ok: true };
let refreshTimer = null;

function loadState() {
  try { return { ...createInitialState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch { return createInitialState(); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function renderStats(resolved) {
  const p = getProgress(resolved);
  $('stats').innerHTML = `<div class="statGrid">
    <div class="stat"><b>${p.completed}/${p.total}</b><span>матчей завершено</span></div>
    <div class="stat"><b>${p.percent}%</b><span>прогресс</span></div>
    <div class="stat"><b>${p.champion || '—'}</b><span>чемпион</span></div>
    <div class="stat"><b>${p.finalists.join(' × ')}</b><span>потенциальный финал</span></div>
  </div>
  <p class="live ${liveStatus.ok ? '' : 'error'}">${liveStatus.text}</p>`;
}

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

function matchCard(match) {
  const title = match.final ? 'Финал' : match.bronze ? '3-е место' : `Матч ${match.id}`;
  return `<article class="match ${match.winner ? 'completed' : ''} ${match.final ? 'final' : ''} status-${match.status?.badge || 'SCHEDULED'}" data-match-id="${match.id}" tabindex="0" role="button" aria-label="Детали матча ${match.id}">
    <div class="meta"><strong>${title}</strong><span>${formatTbilisiTime(match.kickoffUtc)} ТБС</span></div>
    <div class="meta statusMeta">${statusLine(match)}</div>
    ${teamRow(match, 'a')}${teamRow(match, 'b')}
    <div class="meta"><span>${match.venue}</span>${match.winner ? `<span>✓ ${match.winner}</span>` : '<span>ожидает'}</div>
  </article>`;
}

function render() {
  const resolved = resolveBracket(state);
  renderStats(resolved);
  const html = ROUNDS.map((round) => {
    const cards = resolved.matches.filter((m) => round.ids.includes(m.id)).filter(visibleMatch).map(matchCard).join('');
    return `<section class="round"><h2>${round.label}</h2>${cards || '<div class="empty">Нет матчей по фильтру</div>'}</section>`;
  }).join('');
  $('bracket').innerHTML = html;
}

function roundLabel(match) {
  return ROUNDS.find((round) => round.key === match.round)?.label || '';
}

function formatScore(match) {
  if (!match.score) return '— : —';
  const pens = match.score.penA != null ? ` пен. ${match.score.penA}:${match.score.penB}` : '';
  return `${match.score.a}:${match.score.b}${pens}`;
}

function slotLabel(slot) {
  return slot === 'teamA' ? 'верхний слот' : 'нижний слот';
}

function renderPath(path) {
  const lines = [];
  if (path.winnerTo) lines.push(`Победитель → M${path.winnerTo.matchId} (${slotLabel(path.winnerTo.slot)})`);
  else lines.push('Победитель → чемпион / турнир завершён');
  if (path.loserTo) lines.push(`Проигравший → M${path.loserTo.matchId} (${slotLabel(path.loserTo.slot)})`);
  else lines.push('Проигравший → вылетает');
  if (path.feedsFrom.length) lines.push(`Сюда приходят победители: ${path.feedsFrom.map((id) => `M${id}`).join(', ')}`);
  return lines.map((line) => `<li>${line}</li>`).join('');
}

function showMatchDetails(matchId) {
  const resolved = resolveBracket(state);
  const match = resolved.matches.find((item) => item.id === matchId);
  if (!match) return;
  const path = getMatchPath(match.id);
  const updated = match.status?.updatedAt
    ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tbilisi', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(match.status.updatedAt))
    : '—';
  $('matchDetails').innerHTML = `
    <button class="closeBtn" value="cancel" aria-label="Закрыть">×</button>
    <p class="eyebrow">M${match.id} · ${roundLabel(match)}</p>
    <h2>${match.teamA.name} — ${match.teamB.name}</h2>
    <div class="detailScore">${formatScore(match)}</div>
    <div class="detailStatus">${statusLine(match)}</div>
    <dl class="detailGrid">
      <dt>Время</dt><dd>${formatTbilisiTime(match.kickoffUtc)} ТБС</dd>
      <dt>Стадион</dt><dd>${match.venue}</dd>
      <dt>Победитель</dt><dd>${match.winner || (match.status?.state === 'in' && match.score ? `если закончится сейчас: ${Number(match.score.a) > Number(match.score.b) ? match.teamA.name : Number(match.score.b) > Number(match.score.a) ? match.teamB.name : 'ничья / овертайм'}` : 'ещё не определён')}</dd>
      <dt>Источник</dt><dd>${match.status?.source || 'schedule'} · обновлено ${updated}</dd>
      <dt>Статус API</dt><dd>${match.status?.detail || match.status?.badge || '—'}</dd>
    </dl>
    <h3>Путь по сетке</h3>
    <ul class="pathList">${renderPath(path)}</ul>
  `;
  $('matchDialog').showModal();
}

function initFilters() {
  $('teamFilter').innerHTML = '<option value="all">Все команды</option>' + getTeams().map((t) => `<option value="${t}">${t}</option>`).join('');
  $('statusFilter').addEventListener('change', render);
  $('teamFilter').addEventListener('change', render);
  $('bracket').addEventListener('click', (event) => {
    const card = event.target.closest('[data-match-id]');
    if (card) showMatchDetails(Number(card.dataset.matchId));
  });
  $('bracket').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('[data-match-id]');
    if (card) { event.preventDefault(); showMatchDetails(Number(card.dataset.matchId)); }
  });
  $('matchDialog').addEventListener('click', (event) => {
    if (event.target.id === 'matchDialog' || event.target.closest('.closeBtn')) $('matchDialog').close();
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
    liveStatus = { ok: true, text: `Live-счёт ESPN обновлён в ${updated} Тбилиси · автообновление раз в ${nextInterval / 1000} сек.` };
  } catch (error) {
    scheduleNextRefresh();
    liveStatus = { ok: false, text: `Live-счёт недоступен: ${error.message}` };
  }
  render();
}

initFilters(); render(); refreshScores();
