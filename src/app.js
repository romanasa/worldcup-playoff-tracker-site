import { ROUNDS, SCOREBOARD_URL } from './data.js';
import { applyEspnScoreboard, createInitialState, formatTbilisiTime, getProgress, getTeams, resolveBracket } from './bracket.js';

const STORAGE_KEY = 'wc2026-playoff-tracker-v2';
const REFRESH_MS = 60_000;
const $ = (id) => document.getElementById(id);

let state = loadState();
let liveStatus = { text: 'Live-счёт: ещё не обновлялся', ok: true };

function loadState() {
  try { return { ...createInitialState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch { return createInitialState(); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function renderStats(resolved) {
  const p = getProgress(resolved);
  $('stats').innerHTML = `<div class="statGrid">
    <div class="stat"><b>${p.completed}/${p.total}</b><span>матчей заполнено</span></div>
    <div class="stat"><b>${p.percent}%</b><span>прогресс</span></div>
    <div class="stat"><b>${p.champion || '—'}</b><span>чемпион</span></div>
    <div class="stat"><b>${p.finalists.join(' × ')}</b><span>потенциальный финал</span></div>
  </div>
  <p class="live ${liveStatus.ok ? '' : 'error'}">${liveStatus.text}</p>`;
}

function scoreValue(match, side) { return match.score?.[side] ?? ''; }
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
  const isWinner = match.winner === team.name;
  return `<div class="teamRow readonly">
    <div class="team ${team.placeholder ? 'placeholder' : ''} ${isWinner ? 'winner' : ''}">${team.name}</div>
    <div class="scoreBox" aria-label="Счёт ${team.name}">${score === '' ? '—' : score}</div>
  </div>`;
}

function matchCard(match) {
  const title = match.final ? 'Финал' : match.bronze ? '3-е место' : `Матч ${match.id}`;
  return `<article class="match ${match.winner ? 'completed' : ''} ${match.final ? 'final' : ''}">
    <div class="meta"><strong>${title}</strong><span>${formatTbilisiTime(match.kickoffUtc)} ТБС</span></div>
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

function initFilters() {
  $('teamFilter').innerHTML = '<option value="all">Все команды</option>' + getTeams().map((t) => `<option value="${t}">${t}</option>`).join('');
  $('statusFilter').addEventListener('change', render);
  $('teamFilter').addEventListener('change', render);
}

async function refreshScores() {
  try {
    const response = await fetch(`${SCOREBOARD_URL}&_=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state = applyEspnScoreboard(state, data.events || []);
    saveState();
    const updated = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tbilisi', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
    liveStatus = { ok: true, text: `Live-счёт ESPN обновлён в ${updated} Тбилиси · автообновление раз в ${REFRESH_MS / 1000} сек.` };
  } catch (error) {
    liveStatus = { ok: false, text: `Live-счёт недоступен: ${error.message}` };
  }
  render();
}

function bindActions() {
  $('resetBtn').addEventListener('click', () => { if (confirm('Сбросить локальный кеш? Live-счёт подтянется заново.')) { state = createInitialState(); saveState(); refreshScores(); } });
  $('refreshBtn').addEventListener('click', refreshScores);
  $('exportBtn').addEventListener('click', () => { $('exportText').value = JSON.stringify(state, null, 2); $('exportDialog').showModal(); });
  $('importFile').addEventListener('change', async (event) => {
    const file = event.target.files[0]; if (!file) return;
    state = { ...createInitialState(), ...JSON.parse(await file.text()) };
    saveState(); render(); event.target.value = '';
  });
}

initFilters(); bindActions(); render(); refreshScores(); setInterval(refreshScores, REFRESH_MS);
