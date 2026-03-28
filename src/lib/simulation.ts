// Auto-generated simulation.ts — do not edit manually
// Fixed RNG seed (nba-season-2026) prevents pick-volatility.
// Playoff game IDs (all rounds use per-game picks):
//   East play-in: 9001=7v8, 9002=9v10, 9003=final
//   West play-in: 9011=7v8, 9012=9v10, 9013=final
//   East R1: 9101-9107=1v8, 9111-9117=4v5, 9121-9127=2v7, 9131-9137=3v6
//   West R1: 9141-9147, 9151-9157, 9161-9167, 9171-9177
//   East R2: 9301-9307=sAB, 9321-9327=sCD; West R2: 9341-9347=sAB, 9361-9367=sCD
//   East CF: 9401-9407; West CF: 9411-9417; Finals: 9501-9507
// Updated: 2026-03-28
import { getMatchupProb } from '../data/nbaMatchupProbs';
import { getPlayinProb } from '../data/nbaPlayinProbs';
import type {
  LockedPicks,
  NbaGame,
  NbaTeam,
  SimulationResult,
  SimulationTeamCounter,
  StandingsRow,
  TeamAdvancement,
} from '../types';
import { fnv1a, mulberry32 } from './rng';
import { computeProjectedStandings, computeSimulatedStandings } from './standings';

// Playoff game ID constants — exported for use in PlayoffBracketTab
export const PLAYIN_GAME_IDS = {
  east: { sevenVEight: 9001, nineVTen: 9002, final: 9003 },
  west: { sevenVEight: 9011, nineVTen: 9012, final: 9013 },
} as const;
export const R1_GAME_IDS = {
  east: {
    s1v8: [9101,9102,9103,9104,9105,9106,9107] as const,  // G1-G7
    s4v5: [9111,9112,9113,9114,9115,9116,9117] as const,
    s2v7: [9121,9122,9123,9124,9125,9126,9127] as const,
    s3v6: [9131,9132,9133,9134,9135,9136,9137] as const,
  },
  west: {
    s1v8: [9141,9142,9143,9144,9145,9146,9147] as const,
    s4v5: [9151,9152,9153,9154,9155,9156,9157] as const,
    s2v7: [9161,9162,9163,9164,9165,9166,9167] as const,
    s3v6: [9171,9172,9173,9174,9175,9176,9177] as const,
  },
} as const;
export const R2_GAME_IDS = {
  east: {
    sAB: [9301,9302,9303,9304,9305,9306,9307] as const,  // 1/8w vs 4/5w, G1-G7
    sCD: [9321,9322,9323,9324,9325,9326,9327] as const,  // 2/7w vs 3/6w, G1-G7
  },
  west: {
    sAB: [9341,9342,9343,9344,9345,9346,9347] as const,
    sCD: [9361,9362,9363,9364,9365,9366,9367] as const,
  },
} as const;
export const CF_GAME_IDS = {
  east: [9401,9402,9403,9404,9405,9406,9407] as const,
  west: [9411,9412,9413,9414,9415,9416,9417] as const,
} as const;
export const FINALS_GAME_IDS = [9501,9502,9503,9504,9505,9506,9507] as const;

interface SeededTeam {
  seed: number;
  teamId: number;
}

function createCounter(teamId: number): SimulationTeamCounter {
  return {
    teamId,
    seedCounts: new Map<number, number>(),
    top6Count: 0,
    playInCount: 0,
    playoffCount: 0,
    r1Count: 0,
    confFinalsCount: 0,
    finalsCount: 0,
    championCount: 0,
  };
}

function incrementSeedCount(counter: SimulationTeamCounter, seed: number): void {
  counter.seedCounts.set(seed, (counter.seedCounts.get(seed) ?? 0) + 1);
}

function decideHomeCourt(
  teamA: SeededTeam,
  teamB: SeededTeam,
  regularSeasonWins: Map<number, number>,
  random: () => number,
): number {
  // NBA rule: home court = better regular-season record (matches Python CELL 15/13).
  // Seed used only as tiebreaker when simulated wins are equal.
  const teamAWins = regularSeasonWins.get(teamA.teamId) ?? 0;
  const teamBWins = regularSeasonWins.get(teamB.teamId) ?? 0;
  if (teamAWins !== teamBWins) {
    return teamAWins > teamBWins ? teamA.teamId : teamB.teamId;
  }
  if (teamA.seed !== teamB.seed) {
    return teamA.seed < teamB.seed ? teamA.teamId : teamB.teamId;
  }
  // Final tiebreaker: random (matches Python's random.shuffle tiebreak)
  return random() < 0.5 ? teamA.teamId : teamB.teamId;
}

// Games 1,2,5,7 are at home-court team's arena; games 3,4,6 at challenger's arena.
const _HS_HOME_G = new Set([1, 2, 5, 7]);

function simulateSeries(
  teamA: SeededTeam,
  teamB: SeededTeam,
  regularSeasonWins: Map<number, number>,
  random: () => number,
  lockedPicks?: LockedPicks,
  gameIds?: readonly number[],
): number {
  const homeCourtTeamId = decideHomeCourt(teamA, teamB, regularSeasonWins, random);
  const challengerId = homeCourtTeamId === teamA.teamId ? teamB.teamId : teamA.teamId;
  // Use matchup win probabilities — home/away location follows standard NBA 2-2-1-1-1 pattern.
  // Always run all 7 games to keep RNG stream length constant.
  // Per-game picks (gameIds) override random draws for individual games.
  let hsW = 0;
  let lsW = 0;
  for (let g = 1; g <= 7; g++) {
    const seriesOver = hsW === 4 || lsW === 4;
    const p = seriesOver ? 0.5 : getMatchupProb(homeCourtTeamId, challengerId, _HS_HOME_G.has(g) ? 'home' : 'away');
    const r = random();
    if (!seriesOver) {
      const pick = gameIds && lockedPicks ? lockedPicks.get(gameIds[g - 1]) : undefined;
      const hsWins = pick !== undefined ? pick === homeCourtTeamId : r < p;
      if (hsWins) hsW += 1; else lsW += 1;
    }
  }
  return hsW === 4 ? homeCourtTeamId : challengerId;
}

function finalizeConferencePlayoffs(
  conferenceRows: StandingsRow[],
  counters: Map<number, SimulationTeamCounter>,
  lockedPicks: LockedPicks,
  isEast: boolean,
  random: () => number,
): SeededTeam[] {
  const topSix = conferenceRows.slice(0, 6).map((row, index) => ({
    seed: index + 1,
    teamId: row.teamId,
  }));
  const playIn = conferenceRows.slice(6, 10).map((row, index) => ({
    seed: index + 7,
    teamId: row.teamId,
  }));

  for (const team of topSix) {
    const counter = counters.get(team.teamId);
    if (counter) counter.playoffCount += 1;
  }

  if (playIn.length < 4) return topSix;

  const piIds = isEast ? PLAYIN_GAME_IDS.east : PLAYIN_GAME_IDS.west;

  // Play-in: always consume one RNG draw per game to keep stream aligned,
  // even when the game has been locked by the user.
  // Uses getPlayinProb which encodes actual April 14-17 DayNums (not today's DayNum).
  const r7v8 = random();
  const locked7v8 = lockedPicks.get(piIds.sevenVEight);
  const firstPlayInWinner = locked7v8 !== undefined
    ? locked7v8
    : (r7v8 < getPlayinProb('7v8', playIn[0].teamId, playIn[1].teamId)
        ? playIn[0].teamId : playIn[1].teamId);
  const firstPlayInLoser = firstPlayInWinner === playIn[0].teamId ? playIn[1].teamId : playIn[0].teamId;

  const r9v10 = random();
  const locked9v10 = lockedPicks.get(piIds.nineVTen);
  const secondPlayInWinner = locked9v10 !== undefined
    ? locked9v10
    : (r9v10 < getPlayinProb('9v10', playIn[2].teamId, playIn[3].teamId)
        ? playIn[2].teamId : playIn[3].teamId);

  const rFinal = random();
  const lockedFinal = lockedPicks.get(piIds.final);
  const eighthSeedWinner = lockedFinal !== undefined
    ? lockedFinal
    : (rFinal < getPlayinProb('final', firstPlayInLoser, secondPlayInWinner)
        ? firstPlayInLoser : secondPlayInWinner);

  const firstWinnerCounter = counters.get(firstPlayInWinner);
  const eighthWinnerCounter = counters.get(eighthSeedWinner);
  if (firstWinnerCounter) firstWinnerCounter.playoffCount += 1;
  if (eighthWinnerCounter) eighthWinnerCounter.playoffCount += 1;

  return [
    ...topSix,
    { seed: 7, teamId: firstPlayInWinner },
    { seed: 8, teamId: eighthSeedWinner },
  ];
}

function simulateConferenceBracket(
  seededTeams: SeededTeam[],
  regularSeasonWins: Map<number, number>,
  counters: Map<number, SimulationTeamCounter>,
  lockedPicks: LockedPicks,
  isEast: boolean,
  random: () => number,
): number {
  const r1Keys = isEast ? R1_GAME_IDS.east : R1_GAME_IDS.west;
  const r2Keys = isEast ? R2_GAME_IDS.east : R2_GAME_IDS.west;
  const cfIds = isEast ? CF_GAME_IDS.east : CF_GAME_IDS.west;
  // Quarterfinals order: [1v8, 4v5, 2v7, 3v6] — use per-game picks via simulateSeries
  const quarterfinals: Array<[SeededTeam, SeededTeam, readonly number[]]> = [
    [seededTeams[0], seededTeams[7], r1Keys.s1v8],
    [seededTeams[3], seededTeams[4], r1Keys.s4v5],
    [seededTeams[1], seededTeams[6], r1Keys.s2v7],
    [seededTeams[2], seededTeams[5], r1Keys.s3v6],
  ];

  const roundOneWinners = quarterfinals.map(([teamA, teamB, gameIds]) => {
    const winnerId = simulateSeries(teamA, teamB, regularSeasonWins, random, lockedPicks, gameIds);
    const counter = counters.get(winnerId);
    if (counter) counter.r1Count += 1;
    return {
      seed: winnerId === teamA.teamId ? teamA.seed : teamB.seed,
      teamId: winnerId,
    };
  });

  // R2: per-game picks via simulateSeries (same as R1)
  const semifinals: Array<[SeededTeam, SeededTeam, readonly number[]]> = [
    [roundOneWinners[0], roundOneWinners[1], r2Keys.sAB],
    [roundOneWinners[2], roundOneWinners[3], r2Keys.sCD],
  ];

  const conferenceFinalists = semifinals.map(([teamA, teamB, gameIds]) => {
    const winnerId = simulateSeries(teamA, teamB, regularSeasonWins, random, lockedPicks, gameIds);
    const counter = counters.get(winnerId);
    if (counter) counter.confFinalsCount += 1;
    return {
      seed: winnerId === teamA.teamId ? teamA.seed : teamB.seed,
      teamId: winnerId,
    };
  });

  // Conference Finals — per-game picks
  const conferenceChampionId = simulateSeries(
    conferenceFinalists[0],
    conferenceFinalists[1],
    regularSeasonWins,
    random,
    lockedPicks,
    cfIds,
  );
  const championCounter = counters.get(conferenceChampionId);
  if (championCounter) championCounter.finalsCount += 1;

  return conferenceChampionId;
}

function seedFromCounter(counter: SimulationTeamCounter): number | null {
  let bestSeed: number | null = null;
  let bestCount = -1;
  for (const [seed, count] of counter.seedCounts.entries()) {
    if (count > bestCount) {
      bestSeed = seed;
      bestCount = count;
    }
  }
  return bestSeed;
}

function seedLabel(seed: number | null): string {
  if (!seed) return '—';
  if (seed >= 7 && seed <= 10) return `${seed} (PI)`;
  return `${seed}`;
}

function regularSeasonWinMap(east: StandingsRow[], west: StandingsRow[]): Map<number, number> {
  return new Map([...east, ...west].map((row) => [row.teamId, row.wins]));
}

export function getSimIterations(): number {
  const isMobile = window.innerWidth < 768;
  const cores = navigator.hardwareConcurrency || 2;
  if (isMobile || cores <= 2) return 3000;
  if (cores <= 4) return 5000;
  return 10000;
}

export function simulateNbaFullSeason(
  lockedPicks: LockedPicks,
  schedule: NbaGame[],
  teams: NbaTeam[],
  numIterations: number,
): SimulationResult {
  const projection = computeProjectedStandings(lockedPicks, schedule, teams);
  const counters = new Map<number, SimulationTeamCounter>(
    teams.map((team) => [team.id, createCounter(team.id)]),
  );
  const totalWins = new Map<number, number>(teams.map((team) => [team.id, 0]));
  // Fixed seed — changing a single pick no longer re-randomizes all draws
  const seed = fnv1a(`nba-season-2026:${numIterations}`);
  const random = mulberry32(seed);

  for (let iteration = 0; iteration < numIterations; iteration += 1) {
    const iterationStandings = computeSimulatedStandings(lockedPicks, schedule, teams, random);
    const regularSeasonWins = regularSeasonWinMap(iterationStandings.east, iterationStandings.west);

    iterationStandings.east.forEach((row, index) => {
      const counter = counters.get(row.teamId);
      if (!counter) return;
      const seedValue = index + 1;
      incrementSeedCount(counter, seedValue);
      if (seedValue <= 6) counter.top6Count += 1;
      else if (seedValue <= 10) counter.playInCount += 1;
      totalWins.set(row.teamId, (totalWins.get(row.teamId) ?? 0) + row.wins);
    });

    iterationStandings.west.forEach((row, index) => {
      const counter = counters.get(row.teamId);
      if (!counter) return;
      const seedValue = index + 1;
      incrementSeedCount(counter, seedValue);
      totalWins.set(row.teamId, (totalWins.get(row.teamId) ?? 0) + row.wins);
      if (seedValue <= 6) counter.top6Count += 1;
      else if (seedValue <= 10) counter.playInCount += 1;
    });

    const eastBracket = finalizeConferencePlayoffs(
      iterationStandings.east, counters, lockedPicks, true, random,
    );
    const westBracket = finalizeConferencePlayoffs(
      iterationStandings.west, counters, lockedPicks, false, random,
    );
    const eastChampionId = simulateConferenceBracket(
      eastBracket, regularSeasonWins, counters, lockedPicks, true, random,
    );
    const westChampionId = simulateConferenceBracket(
      westBracket, regularSeasonWins, counters, lockedPicks, false, random,
    );

    const finalsWinnerId = simulateSeries(
      { seed: 1, teamId: eastChampionId },
      { seed: 1, teamId: westChampionId },
      regularSeasonWins,
      random,
      lockedPicks,
      FINALS_GAME_IDS,
    );
    const championCounter = counters.get(finalsWinnerId);
    if (championCounter) championCounter.championCount += 1;
  }

  const advancements = new Map<number, TeamAdvancement>();
  for (const team of teams) {
    const counter = counters.get(team.id) ?? createCounter(team.id);
    const modalSeed = seedFromCounter(counter);
    const projectedRow = [...projection.east, ...projection.west].find(
      (row) => row.teamId === team.id,
    );
    advancements.set(team.id, {
      teamId: team.id,
      seed: projectedRow?.projectedSeed ?? modalSeed,
      seedLabel: projectedRow?.seedLabel ?? seedLabel(modalSeed),
      pTop6: counter.top6Count / numIterations,
      pPlayIn: counter.playInCount / numIterations,
      pMakesPlayoffs: counter.playoffCount / numIterations,
      pWinsR1: counter.r1Count / numIterations,
      pConfFinals: counter.confFinalsCount / numIterations,
      pFinals: counter.finalsCount / numIterations,
      pChampion: counter.championCount / numIterations,
    });
  }

  const expWins = new Map(Array.from(totalWins.entries()).map(([id, tot]) => [id, tot / numIterations]));

  return {
    advancements,
    expWins,
    standings: { east: projection.east, west: projection.west },
  };
}

// ── Deterministic playoff pick builder (for "Simulate Rest") ────────────────
// Picks each game by choosing the team with higher win probability.
// Used when user clicks "Simulate Rest" after all regular-season games are done.

function _pickSeriesDet(
  gameIds: readonly number[],
  hsId: number,
  lsId: number,
  picks: LockedPicks,
): number {
  let hw = 0, lw = 0;
  for (let g = 1; g <= 7; g++) {
    if (hw === 4 || lw === 4) break;
    if (picks.has(gameIds[g - 1])) {
      const w = picks.get(gameIds[g - 1])!;
      if (w === hsId) hw++; else lw++;
      continue;
    }
    const hId = _HS_HOME_G.has(g) ? hsId : lsId;
    const aId = _HS_HOME_G.has(g) ? lsId : hsId;
    const p = getMatchupProb(hId, aId, 'home');
    const winner = Math.random() < p ? hId : aId;
    picks.set(gameIds[g - 1], winner);
    if (winner === hsId) hw++; else lw++;
  }
  return hw >= 4 ? hsId : lsId;
}

function _playinWinner(
  slot: 'final' | '7v8' | '9v10', hId: number, aId: number, picks: LockedPicks, gameId: number,
): number {
  if (picks.has(gameId)) return picks.get(gameId)!;
  const p = getPlayinProb(slot, hId, aId);
  const w = Math.random() < p ? hId : aId;
  picks.set(gameId, w);
  return w;
}

function _detHomeCourt(aId: number, aSeed: number, bId: number, bSeed: number, wins: Map<number, number>): [number, number] {
  const aw = wins.get(aId) ?? 0, bw = wins.get(bId) ?? 0;
  if (aw !== bw) return aw > bw ? [aId, bId] : [bId, aId];
  return aSeed <= bSeed ? [aId, bId] : [bId, aId];
}

function _isDivLeader(teamId: number, confRows: StandingsRow[], teamsById: Map<number, NbaTeam>): boolean {
  const div = teamsById.get(teamId)?.division;
  if (!div) return false;
  const divRows = confRows.filter((r) => teamsById.get(r.teamId)?.division === div);
  if (!divRows.length) return false;
  const leader = divRows.reduce((a, b) => a.wins > b.wins || (a.wins === b.wins && a.losses < b.losses) ? a : b);
  return leader.teamId === teamId;
}

/** Fill all remaining playoff game picks probabilistically (each game drawn from matchup win probability). */
export function buildPlayoffPicks(
  existing: LockedPicks,
  standings: { east: StandingsRow[]; west: StandingsRow[] },
  teamsById: Map<number, NbaTeam>,
): LockedPicks {
  const picks = new Map(existing);
  const wins = new Map([...standings.east, ...standings.west].map((r) => [r.teamId, r.wins]));

  function confPicks(conf: 'east' | 'west') {
    const isEast = conf === 'east';
    const rows = isEast ? standings.east : standings.west;
    const pi = isEast ? PLAYIN_GAME_IDS.east : PLAYIN_GAME_IDS.west;
    const r1k = isEast ? R1_GAME_IDS.east : R1_GAME_IDS.west;
    const r2k = isEast ? R2_GAME_IDS.east : R2_GAME_IDS.west;
    const cfk = isEast ? CF_GAME_IDS.east : CF_GAME_IDS.west;

    const s = rows.map((r, i) => ({ teamId: r.teamId, seed: i + 1 }));
    if (s.length < 10) return null;

    // Play-in
    const w7v8 = _playinWinner('7v8', s[6].teamId, s[7].teamId, picks, pi.sevenVEight);
    _playinWinner('9v10', s[8].teamId, s[9].teamId, picks, pi.nineVTen);
    const finHome = w7v8 === s[6].teamId ? s[7].teamId : s[6].teamId;
    const w9v10 = picks.get(pi.nineVTen)!;
    const w8 = _playinWinner('final', finHome, w9v10, picks, pi.final);

    const bracket = [s[0], s[1], s[2], s[3], s[4], s[5],
      { teamId: w7v8, seed: 7 }, { teamId: w8, seed: 8 }];

    // R1
    const r1Match = [
      { a: bracket[0], b: bracket[7], ids: r1k.s1v8 },
      { a: bracket[3], b: bracket[4], ids: r1k.s4v5 },
      { a: bracket[1], b: bracket[6], ids: r1k.s2v7 },
      { a: bracket[2], b: bracket[5], ids: r1k.s3v6 },
    ];
    const r1w = r1Match.map(({ a, b, ids }) => {
      const [hs, ls] = _detHomeCourt(a.teamId, a.seed, b.teamId, b.seed, wins);
      const hSeed = hs === a.teamId ? a.seed : b.seed;
      const lSeed = hs === a.teamId ? b.seed : a.seed;
      const wId = _pickSeriesDet(ids, hs, ls, picks);
      return { teamId: wId, seed: wId === hs ? hSeed : lSeed };
    });

    // R2
    const r2Match = [
      { a: r1w[0], b: r1w[1], ids: r2k.sAB },
      { a: r1w[2], b: r1w[3], ids: r2k.sCD },
    ];
    const r2w = r2Match.map(({ a, b, ids }) => {
      const [hs, ls] = _detHomeCourt(a.teamId, a.seed, b.teamId, b.seed, wins);
      const hSeed = hs === a.teamId ? a.seed : b.seed;
      const lSeed = hs === a.teamId ? b.seed : a.seed;
      const wId = _pickSeriesDet(ids, hs, ls, picks);
      return { teamId: wId, seed: wId === hs ? hSeed : lSeed };
    });

    // CF
    const [cfHs, cfLs] = _detHomeCourt(r2w[0].teamId, r2w[0].seed, r2w[1].teamId, r2w[1].seed, wins);
    const cfWinnerId = _pickSeriesDet(cfk, cfHs, cfLs, picks);
    const cfSeed = cfWinnerId === r2w[0].teamId ? r2w[0].seed : r2w[1].seed;
    return { teamId: cfWinnerId, seed: cfSeed };
  }

  const eastChamp = confPicks('east');
  const westChamp = confPicks('west');

  if (eastChamp && westChamp) {
    // Finals HCA tiebreakers: wins → division winner → conf win% → east by convention
    const ecRow = standings.east.find((r) => r.teamId === eastChamp.teamId);
    const wcRow = standings.west.find((r) => r.teamId === westChamp.teamId);
    const ew = ecRow?.wins ?? 0, ww = wcRow?.wins ?? 0;
    const ecCG = (ecRow?.confWins ?? 0) + (ecRow?.confLosses ?? 0);
    const wcCG = (wcRow?.confWins ?? 0) + (wcRow?.confLosses ?? 0);
    const ecCWPct = ecCG > 0 ? (ecRow?.confWins ?? 0) / ecCG : 0;
    const wcCWPct = wcCG > 0 ? (wcRow?.confWins ?? 0) / wcCG : 0;
    const ecIsDiv = _isDivLeader(eastChamp.teamId, standings.east, teamsById);
    const wcIsDiv = _isDivLeader(westChamp.teamId, standings.west, teamsById);
    let finHsEast: boolean;
    if (ew !== ww) finHsEast = ew > ww;
    else if (ecIsDiv !== wcIsDiv) finHsEast = ecIsDiv;
    else if (ecCWPct !== wcCWPct) finHsEast = ecCWPct > wcCWPct;
    else finHsEast = true; // east by convention
    const [finHs, finLs] = finHsEast
      ? [eastChamp.teamId, westChamp.teamId]
      : [westChamp.teamId, eastChamp.teamId];
    _pickSeriesDet(FINALS_GAME_IDS, finHs, finLs, picks);
  }

  return picks;
}
