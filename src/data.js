export const ROUNDS = [
  { key: 'r32', label: '1/32 финала', ids: [73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88] },
  { key: 'r16', label: '1/16 финала', ids: [89,90,91,92,93,94,95,96] },
  { key: 'qf', label: '1/4 финала', ids: [97,98,99,100] },
  { key: 'sf', label: '1/2 финала', ids: [101,102] },
  { key: 'finals', label: 'Финалы', ids: [103,104] },
];

const team = (name) => ({ type: 'team', name });
const winner = (id) => ({ type: 'winner', id });
const loser = (id) => ({ type: 'loser', id });

export const MATCHES = [
  { id: 73, round: 'r32', date: '2026-06-28', venue: 'Los Angeles Stadium', teamA: team('ЮАР'), teamB: team('Канада') },
  { id: 74, round: 'r32', date: '2026-06-29', venue: 'Boston Stadium', teamA: team('Германия'), teamB: team('Парагвай') },
  { id: 75, round: 'r32', date: '2026-06-29', venue: 'Estadio Monterrey', teamA: team('Нидерланды'), teamB: team('Марокко') },
  { id: 76, round: 'r32', date: '2026-06-29', venue: 'Houston Stadium', teamA: team('Бразилия'), teamB: team('Япония') },
  { id: 77, round: 'r32', date: '2026-06-30', venue: 'New York New Jersey Stadium', teamA: team('Франция'), teamB: team('Швеция') },
  { id: 78, round: 'r32', date: '2026-06-30', venue: 'Dallas Stadium', teamA: team('Кот-д’Ивуар'), teamB: team('Норвегия') },
  { id: 79, round: 'r32', date: '2026-06-30', venue: 'Mexico City Stadium', teamA: team('Мексика'), teamB: team('Эквадор') },
  { id: 80, round: 'r32', date: '2026-07-01', venue: 'Atlanta Stadium', teamA: team('Англия'), teamB: team('ДР Конго') },
  { id: 81, round: 'r32', date: '2026-07-01', venue: 'San Francisco Bay Area Stadium', teamA: team('США'), teamB: team('Босния и Герцеговина') },
  { id: 82, round: 'r32', date: '2026-07-01', venue: 'Seattle Stadium', teamA: team('Бельгия'), teamB: team('Сенегал') },
  { id: 83, round: 'r32', date: '2026-07-02', venue: 'Toronto Stadium', teamA: team('Португалия'), teamB: team('Хорватия') },
  { id: 84, round: 'r32', date: '2026-07-02', venue: 'Los Angeles Stadium', teamA: team('Испания'), teamB: team('Австрия') },
  { id: 85, round: 'r32', date: '2026-07-02', venue: 'BC Place Vancouver', teamA: team('Швейцария'), teamB: team('Алжир') },
  { id: 86, round: 'r32', date: '2026-07-03', venue: 'Miami Stadium', teamA: team('Аргентина'), teamB: team('Кабо-Верде') },
  { id: 87, round: 'r32', date: '2026-07-03', venue: 'Kansas City Stadium', teamA: team('Колумбия'), teamB: team('Гана') },
  { id: 88, round: 'r32', date: '2026-07-03', venue: 'Dallas Stadium', teamA: team('Австралия'), teamB: team('Египет') },
  { id: 89, round: 'r16', date: '2026-07-04', venue: 'Philadelphia Stadium', teamA: winner(74), teamB: winner(77) },
  { id: 90, round: 'r16', date: '2026-07-04', venue: 'Houston Stadium', teamA: winner(73), teamB: winner(75) },
  { id: 91, round: 'r16', date: '2026-07-05', venue: 'New York New Jersey Stadium', teamA: winner(76), teamB: winner(78) },
  { id: 92, round: 'r16', date: '2026-07-05', venue: 'Mexico City Stadium', teamA: winner(79), teamB: winner(80) },
  { id: 93, round: 'r16', date: '2026-07-06', venue: 'Dallas Stadium', teamA: winner(83), teamB: winner(84) },
  { id: 94, round: 'r16', date: '2026-07-06', venue: 'Seattle Stadium', teamA: winner(81), teamB: winner(82) },
  { id: 95, round: 'r16', date: '2026-07-07', venue: 'Atlanta Stadium', teamA: winner(86), teamB: winner(88) },
  { id: 96, round: 'r16', date: '2026-07-07', venue: 'BC Place Vancouver', teamA: winner(85), teamB: winner(87) },
  { id: 97, round: 'qf', date: '2026-07-09', venue: 'Boston Stadium', teamA: winner(89), teamB: winner(90) },
  { id: 98, round: 'qf', date: '2026-07-10', venue: 'Los Angeles Stadium', teamA: winner(93), teamB: winner(94) },
  { id: 99, round: 'qf', date: '2026-07-11', venue: 'Miami Stadium', teamA: winner(91), teamB: winner(92) },
  { id: 100, round: 'qf', date: '2026-07-11', venue: 'Kansas City Stadium', teamA: winner(95), teamB: winner(96) },
  { id: 101, round: 'sf', date: '2026-07-14', venue: 'Dallas Stadium', teamA: winner(97), teamB: winner(98) },
  { id: 102, round: 'sf', date: '2026-07-15', venue: 'Atlanta Stadium', teamA: winner(99), teamB: winner(100) },
  { id: 103, round: 'finals', date: '2026-07-18', venue: 'Miami Stadium', teamA: loser(101), teamB: loser(102), bronze: true },
  { id: 104, round: 'finals', date: '2026-07-19', venue: 'New York New Jersey Stadium', teamA: winner(101), teamB: winner(102), final: true },
];
