const DEFAULT_PAGES_BASE = 'https://romanasa.github.io/worldcup-playoff-tracker-site';
const API_BASE = 'https://api.the-odds-api.com/v4';
const SPORT_KEY = 'soccer_fifa_world_cup';
const REGIONS = 'uk,us,eu';
const MARKETS = 'h2h,draw_no_bet';
const CACHE_KEY = 'odds:snapshot';
const META_KEY = 'odds:meta';
const LOCK_KEY = 'odds:refresh-lock';
const MIN_REFRESH_MS = 60_000;
const LOCK_TTL_SECONDS = 45;

const RU_NAMES = new Map([
  ['South Africa', 'ЮАР'], ['Canada', 'Канада'], ['Germany', 'Германия'], ['Paraguay', 'Парагвай'],
  ['Netherlands', 'Нидерланды'], ['Morocco', 'Марокко'], ['Brazil', 'Бразилия'], ['Japan', 'Япония'],
  ['France', 'Франция'], ['Sweden', 'Швеция'], ['Ivory Coast', 'Кот-д’Ивуар'], ['Norway', 'Норвегия'],
  ['Mexico', 'Мексика'], ['Ecuador', 'Эквадор'], ['England', 'Англия'], ['Congo DR', 'ДР Конго'],
  ['United States', 'США'], ['USA', 'США'], ['Bosnia-Herzegovina', 'Босния и Герцеговина'],
  ['Bosnia and Herzegovina', 'Босния и Герцеговина'], ['Belgium', 'Бельгия'], ['Senegal', 'Сенегал'],
  ['Portugal', 'Португалия'], ['Croatia', 'Хорватия'], ['Spain', 'Испания'], ['Austria', 'Австрия'],
  ['Switzerland', 'Швейцария'], ['Algeria', 'Алжир'], ['Argentina', 'Аргентина'], ['Cape Verde', 'Кабо-Верде'],
  ['Colombia', 'Колумбия'], ['Ghana', 'Гана'], ['Australia', 'Австралия'], ['Egypt', 'Египет'], ['Draw', 'Ничья'],
]);

const BOOKMAKER_PRIORITY = ['pinnacle', 'betfair', 'unibet', 'williamhill', 'bet365', 'virginbet', 'livescorebet', 'betrivers'];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function jsonResponse(body, status = 200, origin = '*') {
  return new Response(JSON.stringify(body, null, 2), { status, headers: corsHeaders(origin) });
}

function normalizeName(name = '') {
  return name.toLowerCase().replace(/&/g, 'and').replace(/[’'`.-]/g, '').replace(/\s+/g, ' ').trim();
}

function eventKey(a, b) {
  return [normalizeName(a), normalizeName(b)].sort().join('|');
}

function parseMatches(source) {
  const teamMap = new Map();
  const teamRegex = /team\('([^']+)',\s*'([^']+)'/g;
  for (const match of source.matchAll(teamRegex)) teamMap.set(normalizeName(match[2]), match[1]);

  const rows = [];
  const rowRegex = /\{ id: (\d+), espnId: '[^']+', round: '([^']+)', kickoffUtc: '([^']+)'[\s\S]*?teamA: team\('([^']+)',\s*'([^']+)'[\s\S]*?teamB: team\('([^']+)',\s*'([^']+)'[\s\S]*?\}/g;
  for (const match of source.matchAll(rowRegex)) {
    rows.push({
      id: Number(match[1]),
      round: match[2],
      kickoffUtc: match[3],
      teamA: { ru: match[4], en: match[5] },
      teamB: { ru: match[6], en: match[7] },
    });
  }
  return { matches: rows, teamMap };
}

function bookmakerRank(bookmaker) {
  const index = BOOKMAKER_PRIORITY.indexOf(String(bookmaker.key || bookmaker.title || '').toLowerCase());
  return index === -1 ? 999 : index;
}

function pickMarket(bookmakers, key) {
  const candidates = [];
  for (const bookmaker of bookmakers || []) {
    const market = (bookmaker.markets || []).find((item) => item.key === key);
    if (market?.outcomes?.length) candidates.push({ bookmaker, market });
  }
  candidates.sort((a, b) => bookmakerRank(a.bookmaker) - bookmakerRank(b.bookmaker));
  return candidates[0] || null;
}

function normalizeProbabilities(odds) {
  const entries = Object.entries(odds).filter(([, value]) => Number.isFinite(value) && value > 1);
  const raw = entries.map(([name, value]) => [name, 1 / value]);
  const total = raw.reduce((sum, [, probability]) => sum + probability, 0);
  if (!total) return {};
  return Object.fromEntries(raw.map(([name, probability]) => [name, Math.round((probability / total) * 100)]));
}

function translateOutcome(name, match, teamMap) {
  if (normalizeName(name) === 'draw') return 'Ничья';
  const normalized = normalizeName(name);
  if (normalizeName(match.teamA.en) === normalized) return match.teamA.ru;
  if (normalizeName(match.teamB.en) === normalized) return match.teamB.ru;
  return teamMap.get(normalized) || RU_NAMES.get(name) || name;
}

function marketSnapshot(event, match, marketKey, label, teamMap) {
  const picked = pickMarket(event.bookmakers, marketKey);
  if (!picked) return null;
  const odds = {};
  for (const outcome of picked.market.outcomes) {
    odds[translateOutcome(outcome.name, match, teamMap)] = Number(outcome.price);
  }
  return {
    available: true,
    key: marketKey === 'h2h' ? 'h2h_3_way' : marketKey,
    label,
    sourceBookmaker: picked.bookmaker.title || picked.bookmaker.key,
    odds,
    probabilities: normalizeProbabilities(odds),
    updatedAt: picked.market.last_update || picked.bookmaker.last_update || event.commence_time,
  };
}

function mergeEvents(target, source) {
  for (const event of source) {
    const key = event.id || eventKey(event.home_team, event.away_team);
    const existing = target.get(key);
    if (!existing) {
      target.set(key, event);
      continue;
    }
    const byBookmaker = new Map((existing.bookmakers || []).map((bookmaker) => [bookmaker.key, bookmaker]));
    for (const bookmaker of event.bookmakers || []) {
      const current = byBookmaker.get(bookmaker.key);
      if (!current) {
        (existing.bookmakers ||= []).push(bookmaker);
        byBookmaker.set(bookmaker.key, bookmaker);
        continue;
      }
      const marketKeys = new Set((current.markets || []).map((market) => market.key));
      for (const market of bookmaker.markets || []) {
        if (!marketKeys.has(market.key)) (current.markets ||= []).push(market);
      }
    }
  }
}

async function fetchOddsMarket(env, market) {
  const url = new URL(`${API_BASE}/sports/${SPORT_KEY}/odds`);
  url.searchParams.set('apiKey', env.THE_ODDS_API_KEY);
  url.searchParams.set('regions', env.ODDS_REGIONS || REGIONS);
  url.searchParams.set('markets', market);
  url.searchParams.set('oddsFormat', 'decimal');
  url.searchParams.set('dateFormat', 'iso');

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 422 && body.includes('INVALID_MARKET')) return [];
    throw new Error(`The Odds API HTTP ${response.status}: ${body}`);
  }
  return response.json();
}

async function fetchOdds(env) {
  const merged = new Map();
  for (const market of (env.ODDS_MARKETS || MARKETS).split(',').map((item) => item.trim()).filter(Boolean)) {
    mergeEvents(merged, await fetchOddsMarket(env, market));
  }
  return [...merged.values()];
}

async function buildSnapshot(env) {
  const pagesBase = (env.PAGES_BASE || DEFAULT_PAGES_BASE).replace(/\/$/, '');
  const dataResponse = await fetch(`${pagesBase}/src/data.js?_=${Date.now()}`, { cache: 'no-store' });
  if (!dataResponse.ok) throw new Error(`Cannot fetch data.js: HTTP ${dataResponse.status}`);

  const { matches, teamMap } = parseMatches(await dataResponse.text());
  const events = await fetchOdds(env);
  const eventsByTeams = new Map(events.map((event) => [eventKey(event.home_team, event.away_team), event]));
  const snapshot = {
    updatedAt: new Date().toISOString(),
    source: 'The Odds API via Cloudflare Worker',
    available: true,
    note: 'The Odds API currently does not expose a true to-qualify market for this sport. Snapshot uses event-specific h2h_3_way and draw_no_bet markets.',
    markets: {},
  };

  for (const match of matches) {
    const event = eventsByTeams.get(eventKey(match.teamA.en, match.teamB.en));
    if (!event) {
      snapshot.markets[String(match.id)] = { available: false, markets: {}, message: 'Коэффициенты пока недоступны' };
      continue;
    }
    const h2h = marketSnapshot(event, match, 'h2h', '90 минут', teamMap);
    const dnb = marketSnapshot(event, match, 'draw_no_bet', 'Победа без ничьей', teamMap);
    const markets = {};
    if (h2h) markets.h2h_3_way = h2h;
    if (dnb) markets.draw_no_bet = dnb;
    snapshot.markets[String(match.id)] = Object.keys(markets).length ? {
      available: true,
      eventId: event.id,
      markets,
      warning: 'Это не рынок прохода дальше: 90 минут и победа без ничьей не учитывают овертайм/пенальти как исход прохода.',
    } : { available: false, eventId: event.id, markets: {}, message: 'Коэффициенты пока недоступны' };
  }
  return snapshot;
}

async function getCachedSnapshot(env) {
  return env.ODDS_CACHE.get(CACHE_KEY, 'json');
}

async function shouldRefresh(env) {
  const meta = await env.ODDS_CACHE.get(META_KEY, 'json');
  if (!meta?.updatedAt) return true;
  return Date.now() - Date.parse(meta.updatedAt) >= MIN_REFRESH_MS;
}

async function handleOdds(request, env) {
  const origin = request.headers.get('Origin') || '*';
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  if (!env.THE_ODDS_API_KEY) return jsonResponse({ error: 'THE_ODDS_API_KEY secret is not set' }, 500, origin);

  const cached = await getCachedSnapshot(env);
  const force = new URL(request.url).searchParams.get('force') === '1';
  if (!force && cached && !(await shouldRefresh(env))) return jsonResponse({ ...cached, cache: { status: 'hit' } }, 200, origin);

  const lock = await env.ODDS_CACHE.get(LOCK_KEY);
  if (lock && cached) return jsonResponse({ ...cached, cache: { status: 'stale-while-refresh' } }, 200, origin);

  await env.ODDS_CACHE.put(LOCK_KEY, String(Date.now()), { expirationTtl: LOCK_TTL_SECONDS });
  try {
    const snapshot = await buildSnapshot(env);
    await env.ODDS_CACHE.put(CACHE_KEY, JSON.stringify(snapshot));
    await env.ODDS_CACHE.put(META_KEY, JSON.stringify({ updatedAt: snapshot.updatedAt }));
    await env.ODDS_CACHE.delete(LOCK_KEY);
    return jsonResponse({ ...snapshot, cache: { status: 'refreshed' } }, 200, origin);
  } catch (error) {
    await env.ODDS_CACHE.delete(LOCK_KEY);
    if (cached) return jsonResponse({ ...cached, cache: { status: 'stale-on-error', error: error.message } }, 200, origin);
    return jsonResponse({ error: error.message }, 502, origin);
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/' || pathname === '/odds') return handleOdds(request, env);
    return jsonResponse({ error: 'Not found' }, 404, request.headers.get('Origin') || '*');
  },
};
