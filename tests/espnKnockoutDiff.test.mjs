import test from 'node:test';
import assert from 'node:assert/strict';
import { MATCHES } from '../src/data.js';
import { applyEspnScoreboard, createInitialState, resolveBracket } from '../src/bracket.js';

const LOCAL_BY_ESPN = new Map([
  ['South Africa', 'ЮАР'], ['Canada', 'Канада'], ['Germany', 'Германия'], ['Paraguay', 'Парагвай'],
  ['Netherlands', 'Нидерланды'], ['Morocco', 'Марокко'], ['Brazil', 'Бразилия'], ['Japan', 'Япония'],
  ['France', 'Франция'], ['Sweden', 'Швеция'], ['Ivory Coast', 'Кот-д’Ивуар'], ['Norway', 'Норвегия'],
  ['Mexico', 'Мексика'], ['Ecuador', 'Эквадор'], ['England', 'Англия'], ['Congo DR', 'ДР Конго'],
  ['United States', 'США'], ['Bosnia-Herzegovina', 'Босния и Герцеговина'], ['Belgium', 'Бельгия'],
  ['Senegal', 'Сенегал'], ['Portugal', 'Португалия'], ['Croatia', 'Хорватия'], ['Spain', 'Испания'],
  ['Austria', 'Австрия'], ['Switzerland', 'Швейцария'], ['Algeria', 'Алжир'], ['Argentina', 'Аргентина'],
  ['Cape Verde', 'Кабо-Верде'], ['Colombia', 'Колумбия'], ['Ghana', 'Гана'], ['Australia', 'Австралия'],
  ['Egypt', 'Египет'], ['Round of 16 8 Winner', 'Победитель M96'],
  ['Quarterfinal 1 Winner', 'Победитель M97'], ['Quarterfinal 2 Winner', 'Победитель M98'],
  ['Quarterfinal 3 Winner', 'Победитель M99'], ['Quarterfinal 4 Winner', 'Победитель M100'],
  ['Semifinal 1 Winner', 'Победитель M101'], ['Semifinal 2 Winner', 'Победитель M102'],
  ['Semifinal 1 Loser', 'Проигравший M101'], ['Semifinal 2 Loser', 'Проигравший M102'],
]);

const ESPN_KNOCKOUT_FIXTURE = [
  ['760502', '2026-07-04T17:00Z', ['Canada', 'Morocco']],
  ['760503', '2026-07-04T21:00Z', ['Paraguay', 'France']],
  ['760504', '2026-07-05T20:00Z', ['Brazil', 'Norway']],
  ['760505', '2026-07-06T01:00Z', ['Mexico', 'England']],
  ['760506', '2026-07-06T19:00Z', ['Portugal', 'Spain']],
  ['760507', '2026-07-07T00:00Z', ['United States', 'Belgium']],
  ['760509', '2026-07-07T16:00Z', ['Argentina', 'Egypt']],
  ['760508', '2026-07-07T20:00Z', ['Switzerland', 'Colombia']],
  ['760510', '2026-07-09T20:00Z', ['France', 'Morocco']],
  ['760511', '2026-07-10T19:00Z', ['Spain', 'Belgium']],
  ['760512', '2026-07-11T21:00Z', ['Norway', 'England']],
  ['760513', '2026-07-12T01:00Z', ['Argentina', 'Round of 16 8 Winner']],
  ['760514', '2026-07-14T19:00Z', ['Quarterfinal 1 Winner', 'Quarterfinal 2 Winner']],
  ['760515', '2026-07-15T19:00Z', ['Quarterfinal 3 Winner', 'Quarterfinal 4 Winner']],
  ['760516', '2026-07-18T21:00Z', ['Semifinal 1 Loser', 'Semifinal 2 Loser']],
  ['760517', '2026-07-19T19:00Z', ['Semifinal 1 Winner', 'Semifinal 2 Winner']],
];

function fakeEvent([id, date, teams]) {
  return {
    id,
    date,
    status: { type: { state: 'pre', shortDetail: 'Scheduled' } },
    competitions: [{ competitors: teams.map((name, index) => ({ homeAway: index === 0 ? 'home' : 'away', team: { displayName: name } })) }],
  };
}

test('local knockout schedule matches ESPN fixture teams and kickoff times', () => {
  const state = applyEspnScoreboard(createInitialState(), ESPN_KNOCKOUT_FIXTURE.map(fakeEvent));
  const resolved = resolveBracket(state).matches;

  for (const [espnId, date, espnTeams] of ESPN_KNOCKOUT_FIXTURE) {
    const base = MATCHES.find((match) => String(match.espnId) === espnId);
    assert.ok(base, `missing local match for ESPN ${espnId}`);
    assert.equal(base.kickoffUtc, date.replace('Z', ':00Z'), `kickoff mismatch for M${base.id}`);

    const match = resolved.find((item) => item.id === base.id);
    assert.deepEqual(
      [match.teamA.name, match.teamB.name],
      espnTeams.map((name) => LOCAL_BY_ESPN.get(name) || name),
      `team mismatch for M${base.id}`,
    );
  }
});
