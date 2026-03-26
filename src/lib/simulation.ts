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

interface SeededTeam {
  seed: number;
  teamId: number;
}

function pickHash(lockedPicks: LockedPicks): string {
  return JSON.stringify(Array.from(lockedPicks.entries()).sort((entryA, entryB) => entryA[0] - entryB[0]));
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

  if (homeWins) {
    return homeTeamId;
  }

  return awayTeamId;
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
  const homePattern = [homeCourtTeamId, homeCourtTeamId, otherTeamId, otherTeamId, homeCourtTeamId, otherTeamId, homeCourtTeamId];
  let homeCourtWins = 0;
  let challengerWins = 0;

  for (const homeTeamId of homePattern) {
    const winnerId = simulateSingleGame(homeCourtTeamId, otherTeamId, homeTeamId, random);

    if (winnerId === homeCourtTeamId) {
      homeCourtWins += 1;
    } else {
      challengerWins += 1;
    }

    if (homeCourtWins === 4 || challengerWins === 4) {
      break;
    }
  }

  return homeCourtWins === 4 ? homeCourtTeamId : otherTeamId;
}

function finalizeConferencePlayoffs(
  conferenceRows: StandingsRow[],
  counters: Map<number, SimulationTeamCounter>,
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

    if (counter) {
      counter.playoffCount += 1;
    }
  }

  if (playIn.length < 4) {
    return topSix;
  }

  const firstPlayInWinner = simulateSingleGame(playIn[0].teamId, playIn[1].teamId, playIn[0].teamId, random);
  const firstPlayInLoser = firstPlayInWinner === playIn[0].teamId ? playIn[1].teamId : playIn[0].teamId;
  const secondPlayInWinner = simulateSingleGame(playIn[2].teamId, playIn[3].teamId, playIn[2].teamId, random);
  const eighthSeedWinner = simulateSingleGame(firstPlayInLoser, secondPlayInWinner, firstPlayInLoser, random);

  const firstWinnerCounter = counters.get(firstPlayInWinner);
  const eighthWinnerCounter = counters.get(eighthSeedWinner);

  if (firstWinnerCounter) {
    firstWinnerCounter.playoffCount += 1;
  }

  if (eighthWinnerCounter) {
    eighthWinnerCounter.playoffCount += 1;
  }

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
  random: () => number,
): number {
  const quarterfinals = [
    [seededTeams[0], seededTeams[7]],
    [seededTeams[3], seededTeams[4]],
    [seededTeams[1], seededTeams[6]],
    [seededTeams[2], seededTeams[5]],
  ] as const;

  const roundOneWinners = quarterfinals.map(([teamA, teamB]) => {
    const winnerId = simulateSeries(teamA, teamB, regularSeasonWins, random);
    const counter = counters.get(winnerId);

    if (counter) {
      counter.r1Count += 1;
    }

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

    if (counter) {
      counter.confFinalsCount += 1;
    }

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

  if (championCounter) {
    championCounter.finalsCount += 1;
  }

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
  if (!seed) {
    return '—';
  }

  if (seed >= 7 && seed <= 10) {
    return `${seed} (PI)`;
  }

  return `${seed}`;
}

function regularSeasonWinMap(east: StandingsRow[], west: StandingsRow[]): Map<number, number> {
  return new Map([...east, ...west].map((row) => [row.teamId, row.wins]));
}

export function getSimIterations(): number {
  const isMobile = window.innerWidth < 768;
  const cores = navigator.hardwareConcurrency || 2;

  if (isMobile || cores <= 2) {
    return 1500;
  }

  if (cores <= 4) {
    return 2500;
  }

  return 10000;
}

export function simulateNbaFullSeason(
  lockedPicks: LockedPicks,
  schedule: NbaGame[],
  teams: NbaTeam[],
  numIterations: number,
): SimulationResult {
  const projection = computeProjectedStandings(lockedPicks, schedule, teams);
  const counters = new Map<number, SimulationTeamCounter>(teams.map((team) => [team.id, createCounter(team.id)]));
  const seed = fnv1a(`${pickHash(lockedPicks)}:${numIterations}`);
  const random = mulberry32(seed);

  for (let iteration = 0; iteration < numIterations; iteration += 1) {
    const iterationStandings = computeSimulatedStandings(lockedPicks, schedule, teams, random);
    const regularSeasonWins = regularSeasonWinMap(iterationStandings.east, iterationStandings.west);

    iterationStandings.east.forEach((row, index) => {
      const counter = counters.get(row.teamId);

      if (!counter) {
        return;
      }

      const seedValue = index + 1;
      incrementSeedCount(counter, seedValue);

      if (seedValue <= 6) {
        counter.top6Count += 1;
      } else if (seedValue <= 10) {
        counter.playInCount += 1;
      }
    });

    iterationStandings.west.forEach((row, index) => {
      const counter = counters.get(row.teamId);

      if (!counter) {
        return;
      }

      const seedValue = index + 1;
      incrementSeedCount(counter, seedValue);

      if (seedValue <= 6) {
        counter.top6Count += 1;
      } else if (seedValue <= 10) {
        counter.playInCount += 1;
      }
    });

    const eastBracket = finalizeConferencePlayoffs(iterationStandings.east, counters, random);
    const westBracket = finalizeConferencePlayoffs(iterationStandings.west, counters, random);
    const eastChampionId = simulateConferenceBracket(eastBracket, regularSeasonWins, counters, random);
    const westChampionId = simulateConferenceBracket(westBracket, regularSeasonWins, counters, random);

    const finalsWinnerId = simulateSeries(
      { seed: 1, teamId: eastChampionId },
      { seed: 1, teamId: westChampionId },
      regularSeasonWins,
      random,
    );

    const championCounter = counters.get(finalsWinnerId);

    if (championCounter) {
      championCounter.championCount += 1;
    }
  }

  const advancements = new Map<number, TeamAdvancement>();

  for (const team of teams) {
    const counter = counters.get(team.id) ?? createCounter(team.id);
    const modalSeed = seedFromCounter(counter);
    const projectedRow = [...projection.east, ...projection.west].find((row) => row.teamId === team.id);

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
    standings: {
      east: projection.east,
      west: projection.west,
    },
  };
}
