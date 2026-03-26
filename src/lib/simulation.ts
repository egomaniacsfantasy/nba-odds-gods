// Auto-generated simulation.ts — do not edit manually
// Fixed RNG seed (nba-season-2026) prevents pick-volatility.
// Playoff picks in lockedPicks use game IDs 9001-9214.
//   East play-in: 9001=7v8, 9002=9v10, 9003=final
//   West play-in: 9011=7v8, 9012=9v10, 9013=final
//   East R1: 9201=1v8, 9202=4v5, 9203=2v7, 9204=3v6
//   West R1: 9211=1v8, 9212=4v5, 9213=2v7, 9214=3v6
// Updated: 2026-03-26
import { getHomeWinProbability, getTeamRating } from '../data/nbaTeams';
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
  east: [9201, 9202, 9203, 9204] as const,  // [1v8, 4v5, 2v7, 3v6]
  west: [9211, 9212, 9213, 9214] as const,
} as const;

interface SeededTeam {
  seed: number;
  teamId: number;
}

function pickHash(lockedPicks: LockedPicks): string {
  return JSON.stringify(Array.from(lockedPicks.entries()).sort((a, b) => a[0] - b[0]));
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

function simulateSingleGame(
  teamAId: number,
  teamBId: number,
  homeTeamId: number,
  random: () => number,
): number {
  const awayTeamId = homeTeamId === teamAId ? teamBId : teamAId;
  const homeWins = random() < getHomeWinProbability(homeTeamId, awayTeamId);
  return homeWins ? homeTeamId : awayTeamId;
}

function decideHomeCourt(
  teamA: SeededTeam,
  teamB: SeededTeam,
  regularSeasonWins: Map<number, number>,
): number {
  if (teamA.seed !== teamB.seed) {
    return teamA.seed < teamB.seed ? teamA.teamId : teamB.teamId;
  }
  const teamAWins = regularSeasonWins.get(teamA.teamId) ?? 0;
  const teamBWins = regularSeasonWins.get(teamB.teamId) ?? 0;
  if (teamAWins !== teamBWins) {
    return teamAWins > teamBWins ? teamA.teamId : teamB.teamId;
  }
  return getTeamRating(teamA.teamId) >= getTeamRating(teamB.teamId) ? teamA.teamId : teamB.teamId;
}

function simulateSeries(
  teamA: SeededTeam,
  teamB: SeededTeam,
  regularSeasonWins: Map<number, number>,
  random: () => number,
): number {
  const homeCourtTeamId = decideHomeCourt(teamA, teamB, regularSeasonWins);
  const otherTeamId = homeCourtTeamId === teamA.teamId ? teamB.teamId : teamA.teamId;
  const homePattern = [
    homeCourtTeamId, homeCourtTeamId, otherTeamId, otherTeamId,
    homeCourtTeamId, otherTeamId, homeCourtTeamId,
  ];
  let homeCourtWins = 0;
  let challengerWins = 0;
  for (const homeTeamId of homePattern) {
    const winnerId = simulateSingleGame(homeCourtTeamId, otherTeamId, homeTeamId, random);
    if (winnerId === homeCourtTeamId) homeCourtWins += 1;
    else challengerWins += 1;
    if (homeCourtWins === 4 || challengerWins === 4) break;
  }
  return homeCourtWins === 4 ? homeCourtTeamId : otherTeamId;
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

  // 7v8: winner → seed 7; loser → plays final for seed 8
  const locked7v8 = lockedPicks.get(piIds.sevenVEight);
  const firstPlayInWinner = locked7v8 !== undefined
    ? locked7v8
    : simulateSingleGame(playIn[0].teamId, playIn[1].teamId, playIn[0].teamId, random);
  const firstPlayInLoser = firstPlayInWinner === playIn[0].teamId ? playIn[1].teamId : playIn[0].teamId;

  // 9v10: loser eliminated; winner → plays final for seed 8
  const locked9v10 = lockedPicks.get(piIds.nineVTen);
  const secondPlayInWinner = locked9v10 !== undefined
    ? locked9v10
    : simulateSingleGame(playIn[2].teamId, playIn[3].teamId, playIn[2].teamId, random);

  // Final: loser of 7v8 (hosts) vs winner of 9v10 → winner is seed 8
  const lockedFinal = lockedPicks.get(piIds.final);
  const eighthSeedWinner = lockedFinal !== undefined
    ? lockedFinal
    : simulateSingleGame(firstPlayInLoser, secondPlayInWinner, firstPlayInLoser, random);

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
  const r1Ids = isEast ? R1_GAME_IDS.east : R1_GAME_IDS.west;
  // Quarterfinals order matches R1_GAME_IDS: [1v8, 4v5, 2v7, 3v6]
  const quarterfinals = [
    [seededTeams[0], seededTeams[7]],
    [seededTeams[3], seededTeams[4]],
    [seededTeams[1], seededTeams[6]],
    [seededTeams[2], seededTeams[5]],
  ] as const;

  const roundOneWinners = quarterfinals.map(([teamA, teamB], i) => {
    const lockedWinner = lockedPicks.get(r1Ids[i]);
    let winnerId: number;
    if (lockedWinner !== undefined &&
        (lockedWinner === teamA.teamId || lockedWinner === teamB.teamId)) {
      winnerId = lockedWinner;
    } else {
      winnerId = simulateSeries(teamA, teamB, regularSeasonWins, random);
    }
    const counter = counters.get(winnerId);
    if (counter) counter.r1Count += 1;
    return {
      seed: winnerId === teamA.teamId ? teamA.seed : teamB.seed,
      teamId: winnerId,
    };
  });

  const semifinals = [
    [roundOneWinners[0], roundOneWinners[1]],
    [roundOneWinners[2], roundOneWinners[3]],
  ] as const;

  const conferenceFinalists = semifinals.map(([teamA, teamB]) => {
    const winnerId = simulateSeries(teamA, teamB, regularSeasonWins, random);
    const counter = counters.get(winnerId);
    if (counter) counter.confFinalsCount += 1;
    return {
      seed: winnerId === teamA.teamId ? teamA.seed : teamB.seed,
      teamId: winnerId,
    };
  });

  const conferenceChampionId = simulateSeries(
    conferenceFinalists[0],
    conferenceFinalists[1],
    regularSeasonWins,
    random,
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
    });

    iterationStandings.west.forEach((row, index) => {
      const counter = counters.get(row.teamId);
      if (!counter) return;
      const seedValue = index + 1;
      incrementSeedCount(counter, seedValue);
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

  return {
    advancements,
    standings: { east: projection.east, west: projection.west },
  };
}
