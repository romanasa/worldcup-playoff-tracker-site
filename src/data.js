export const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260628-20260719';

export const ROUNDS = [
  { key: 'r32', label: '1/16 финала', ids: [73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88] },
  { key: 'r16', label: '1/8 финала', ids: [89,90,91,92,93,94,95,96] },
  { key: 'qf', label: '1/4 финала', ids: [97,98,99,100] },
  { key: 'sf', label: '1/2 финала', ids: [101,102] },
  { key: 'finals', label: 'Финалы', ids: [103,104] },
];

const team = (name, espnName = name, espnTeamId = null) => ({ type: 'team', name, espnName, espnTeamId });
const winner = (id) => ({ type: 'winner', id });
const loser = (id) => ({ type: 'loser', id });

export const MATCHES = [
  { id: 73, espnId: '760486', round: 'r32', kickoffUtc: '2026-06-28T19:00:00Z', venue: 'SoFi Stadium', teamA: team('ЮАР', 'South Africa', '467'), teamB: team('Канада', 'Canada', '206') },
  { id: 74, espnId: '760489', round: 'r32', kickoffUtc: '2026-06-29T20:30:00Z', venue: 'Gillette Stadium', teamA: team('Германия', 'Germany', '481'), teamB: team('Парагвай', 'Paraguay', '210') },
  { id: 75, espnId: '760488', round: 'r32', kickoffUtc: '2026-06-30T01:00:00Z', venue: 'Estadio BBVA', teamA: team('Нидерланды', 'Netherlands', '449'), teamB: team('Марокко', 'Morocco', '2869') },
  { id: 76, espnId: '760487', round: 'r32', kickoffUtc: '2026-06-29T17:00:00Z', venue: 'NRG Stadium', teamA: team('Бразилия', 'Brazil', '205'), teamB: team('Япония', 'Japan', '627') },
  { id: 77, espnId: '760492', round: 'r32', kickoffUtc: '2026-06-30T21:00:00Z', venue: 'MetLife Stadium', teamA: team('Франция', 'France', '478'), teamB: team('Швеция', 'Sweden', '466') },
  { id: 78, espnId: '760490', round: 'r32', kickoffUtc: '2026-06-30T17:00:00Z', venue: 'AT&T Stadium', teamA: team('Кот-д’Ивуар', 'Ivory Coast', '4789'), teamB: team('Норвегия', 'Norway', '464') },
  { id: 79, espnId: '760491', round: 'r32', kickoffUtc: '2026-07-01T01:00:00Z', venue: 'Estadio Banorte', teamA: team('Мексика', 'Mexico', '203'), teamB: team('Эквадор', 'Ecuador', '209') },
  { id: 80, espnId: '760495', round: 'r32', kickoffUtc: '2026-07-01T16:00:00Z', venue: 'Mercedes-Benz Stadium', teamA: team('Англия', 'England', '448'), teamB: team('ДР Конго', 'Congo DR', '2850') },
  { id: 81, espnId: '760494', round: 'r32', kickoffUtc: '2026-07-02T00:00:00Z', venue: "Levi's Stadium", teamA: team('США', 'United States', '660'), teamB: team('Босния и Герцеговина', 'Bosnia-Herzegovina', '452') },
  { id: 82, espnId: '760493', round: 'r32', kickoffUtc: '2026-07-01T20:00:00Z', venue: 'Lumen Field', teamA: team('Бельгия', 'Belgium', '459'), teamB: team('Сенегал', 'Senegal', '654') },
  { id: 83, espnId: '760496', round: 'r32', kickoffUtc: '2026-07-02T23:00:00Z', venue: 'BMO Field', teamA: team('Португалия', 'Portugal', '482'), teamB: team('Хорватия', 'Croatia', '477') },
  { id: 84, espnId: '760497', round: 'r32', kickoffUtc: '2026-07-02T19:00:00Z', venue: 'SoFi Stadium', teamA: team('Испания', 'Spain', '164'), teamB: team('Австрия', 'Austria', '474') },
  { id: 85, espnId: '760498', round: 'r32', kickoffUtc: '2026-07-03T03:00:00Z', venue: 'BC Place', teamA: team('Швейцария', 'Switzerland', '475'), teamB: team('Алжир', 'Algeria', '624') },
  { id: 86, espnId: '760500', round: 'r32', kickoffUtc: '2026-07-03T22:00:00Z', venue: 'Hard Rock Stadium', teamA: team('Аргентина', 'Argentina', '202'), teamB: team('Кабо-Верде', 'Cape Verde', '2597') },
  { id: 87, espnId: '760501', round: 'r32', kickoffUtc: '2026-07-04T01:30:00Z', venue: 'GEHA Field at Arrowhead Stadium', teamA: team('Колумбия', 'Colombia', '208'), teamB: team('Гана', 'Ghana', '4469') },
  { id: 88, espnId: '760499', round: 'r32', kickoffUtc: '2026-07-03T18:00:00Z', venue: 'AT&T Stadium', teamA: team('Австралия', 'Australia', '628'), teamB: team('Египет', 'Egypt', '2620') },
  { id: 89, espnId: '760502', round: 'r16', kickoffUtc: '2026-07-04T17:00:00Z', venue: 'NRG Stadium', teamA: winner(73), teamB: winner(75) },
  { id: 90, espnId: '760503', round: 'r16', kickoffUtc: '2026-07-04T21:00:00Z', venue: 'Lincoln Financial Field', teamA: winner(74), teamB: winner(77) },
  { id: 91, espnId: '760504', round: 'r16', kickoffUtc: '2026-07-05T20:00:00Z', venue: 'MetLife Stadium', teamA: winner(76), teamB: winner(78) },
  { id: 92, espnId: '760505', round: 'r16', kickoffUtc: '2026-07-06T01:00:00Z', venue: 'Estadio Banorte', teamA: winner(79), teamB: winner(80) },
  { id: 93, espnId: '760506', round: 'r16', kickoffUtc: '2026-07-06T19:00:00Z', venue: 'AT&T Stadium', teamA: winner(83), teamB: winner(84) },
  { id: 94, espnId: '760507', round: 'r16', kickoffUtc: '2026-07-07T00:00:00Z', venue: 'Lumen Field', teamA: winner(81), teamB: winner(82) },
  { id: 95, espnId: '760509', round: 'r16', kickoffUtc: '2026-07-07T16:00:00Z', venue: 'Mercedes-Benz Stadium', teamA: winner(86), teamB: winner(88) },
  { id: 96, espnId: '760508', round: 'r16', kickoffUtc: '2026-07-07T20:00:00Z', venue: 'BC Place', teamA: winner(85), teamB: winner(87) },
  { id: 97, espnId: '760510', round: 'qf', kickoffUtc: '2026-07-09T20:00:00Z', venue: 'Gillette Stadium', teamA: winner(90), teamB: winner(89) },
  { id: 98, espnId: '760511', round: 'qf', kickoffUtc: '2026-07-10T19:00:00Z', venue: 'SoFi Stadium', teamA: winner(93), teamB: winner(94) },
  { id: 99, espnId: '760512', round: 'qf', kickoffUtc: '2026-07-11T21:00:00Z', venue: 'Hard Rock Stadium', teamA: winner(91), teamB: winner(92) },
  { id: 100, espnId: '760513', round: 'qf', kickoffUtc: '2026-07-12T01:00:00Z', venue: 'GEHA Field at Arrowhead Stadium', teamA: winner(95), teamB: winner(96) },
  { id: 101, espnId: '760514', round: 'sf', kickoffUtc: '2026-07-14T19:00:00Z', venue: 'AT&T Stadium', teamA: winner(97), teamB: winner(98) },
  { id: 102, espnId: '760515', round: 'sf', kickoffUtc: '2026-07-15T19:00:00Z', venue: 'Mercedes-Benz Stadium', teamA: winner(99), teamB: winner(100) },
  { id: 103, espnId: '760516', round: 'finals', kickoffUtc: '2026-07-18T21:00:00Z', venue: 'Hard Rock Stadium', teamA: loser(101), teamB: loser(102), bronze: true },
  { id: 104, espnId: '760517', round: 'finals', kickoffUtc: '2026-07-19T19:00:00Z', venue: 'MetLife Stadium', teamA: winner(101), teamB: winner(102), final: true },
];
