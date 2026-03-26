// PLACEHOLDER DATA — will be replaced by pipeline output

import type { NbaGame, NbaTeam } from '../types';
import { fnv1a, mulberry32 } from '../lib/rng';
import { getHomeWinProbability, getTeamRating, NBA_TEAMS } from './nbaTeams';

const SEASON_START_UTC = Date.UTC(2025, 9, 21);
const START_DATE = '2026-03-24';
const END_DATE = '2026-04-13';
const DAILY_GAME_TARGETS = [6, 6, 5, 6, 6, 5, 6, 6, 5, 6, 6, 5, 6, 6, 5, 6, 6, 5, 6, 6, 6];
const SCHEDULE_SEED = fnv1a('nba-placeholder-schedule-v1');
const COMPLETED_DATE = START_DATE;

function pairKey(teamAId: number, teamBId: number): string {
  return teamAId < teamBId ? `${teamAId}-${teamBId}` : `${teamBId}-${teamAId}`;
}

function buildDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function dayNumber(dateString: string): number {
  const gameDate = new Date(`${dateString}T00:00:00Z`);
  return Math.round((gameDate.getTime() - SEASON_START_UTC) / 86400000) + 1;
}

function sameConference(teamA: NbaTeam, teamB: NbaTeam): boolean {
  return teamA.conference === teamB.conference;
}

function sameDivision(teamA: NbaTeam, teamB: NbaTeam): boolean {
  return sameConference(teamA, teamB) && teamA.division === teamB.division;
}

function maxFutureMeetings(teamA: NbaTeam, teamB: NbaTeam): number {
  if (sameDivision(teamA, teamB)) {
    return 2;
  }

  if (sameConference(teamA, teamB)) {
    return 2;
  }

  return 1;
}

function choosePrimaryTeam(
  teams: NbaTeam[],
  remainingGames: Map<number, number>,
  usedToday: Set<number>,
  lastPlayed: Map<number, number>,
  dateIndex: number,
  random: () => number,
): NbaTeam | null {
  const available = teams.filter(
    (team) => (remainingGames.get(team.id) ?? 0) > 0 && !usedToday.has(team.id),
  );

  if (available.length === 0) {
    return null;
  }

  const ranked = [...available].sort((teamA, teamB) => {
    const restA = dateIndex - (lastPlayed.get(teamA.id) ?? -8);
    const restB = dateIndex - (lastPlayed.get(teamB.id) ?? -8);
    const scoreA = (remainingGames.get(teamA.id) ?? 0) * 10 + Math.min(restA, 4) * 2;
    const scoreB = (remainingGames.get(teamB.id) ?? 0) * 10 + Math.min(restB, 4) * 2;
    return scoreB - scoreA;
  });

  const pool = ranked.slice(0, Math.min(6, ranked.length));
  return pool[Math.floor(random() * pool.length)] ?? ranked[0] ?? null;
}

function chooseOpponent(
  primaryTeam: NbaTeam,
  teams: NbaTeam[],
  remainingGames: Map<number, number>,
  usedToday: Set<number>,
  lastPlayed: Map<number, number>,
  matchupCounts: Map<string, number>,
  dateIndex: number,
  random: () => number,
): NbaTeam | null {
  const candidates = teams
    .filter(
      (team) =>
        team.id !== primaryTeam.id &&
        (remainingGames.get(team.id) ?? 0) > 0 &&
        !usedToday.has(team.id),
    )
    .map((team) => {
      const pair = pairKey(primaryTeam.id, team.id);
      const existingMeetings = matchupCounts.get(pair) ?? 0;
      const limit = maxFutureMeetings(primaryTeam, team);

      if (existingMeetings >= limit) {
        return null;
      }

      const restScore = Math.min(dateIndex - (lastPlayed.get(team.id) ?? -8), 4);
      const strengthGap = Math.abs(getTeamRating(primaryTeam.id) - getTeamRating(team.id));
      const matchupScore =
        (remainingGames.get(team.id) ?? 0) * 8 +
        (sameConference(primaryTeam, team) ? 4 : 0) +
        (sameDivision(primaryTeam, team) ? 5 : 0) +
        (strengthGap < 90 ? 1.5 : 0) +
        restScore * 1.75 -
        existingMeetings * 5 +
        random();

      return {
        score: matchupScore,
        team,
      };
    })
    .filter((candidate): candidate is { score: number; team: NbaTeam } => candidate !== null)
    .sort((candidateA, candidateB) => candidateB.score - candidateA.score);

  if (candidates.length === 0) {
    return null;
  }

  const pool = candidates.slice(0, Math.min(6, candidates.length));
  return pool[Math.floor(random() * pool.length)]?.team ?? candidates[0].team;
}

function chooseHomeTeam(
  teamA: NbaTeam,
  teamB: NbaTeam,
  homeGames: Map<number, number>,
  awayGames: Map<number, number>,
  random: () => number,
): NbaTeam {
  const balanceA = (homeGames.get(teamA.id) ?? 0) - (awayGames.get(teamA.id) ?? 0);
  const balanceB = (homeGames.get(teamB.id) ?? 0) - (awayGames.get(teamB.id) ?? 0);

  if (balanceA < balanceB) {
    return teamA;
  }

  if (balanceB < balanceA) {
    return teamB;
  }

  return random() < 0.5 ? teamA : teamB;
}

function buildScheduleAttempt(seedOffset: number): NbaGame[] | null {
  const random = mulberry32(SCHEDULE_SEED + seedOffset);
  const dateStrings = buildDateRange(START_DATE, END_DATE);
  const remainingGames = new Map<number, number>(
    NBA_TEAMS.map((team) => [team.id, 82 - team.wins - team.losses]),
  );
  const homeGames = new Map<number, number>(NBA_TEAMS.map((team) => [team.id, 0]));
  const awayGames = new Map<number, number>(NBA_TEAMS.map((team) => [team.id, 0]));
  const lastPlayed = new Map<number, number>(NBA_TEAMS.map((team) => [team.id, -6]));
  const matchupCounts = new Map<string, number>();
  const games: NbaGame[] = [];
  let nextGameId = 1;

  for (let dateIndex = 0; dateIndex < dateStrings.length; dateIndex += 1) {
    const targetGames = DAILY_GAME_TARGETS[dateIndex] ?? 5;
    const usedToday = new Set<number>();
    let createdToday = 0;
    let attempts = 0;

    while (createdToday < targetGames && attempts < 3000) {
      attempts += 1;
      const primaryTeam = choosePrimaryTeam(
        NBA_TEAMS,
        remainingGames,
        usedToday,
        lastPlayed,
        dateIndex,
        random,
      );

      if (!primaryTeam) {
        break;
      }

      const opponent = chooseOpponent(
        primaryTeam,
        NBA_TEAMS,
        remainingGames,
        usedToday,
        lastPlayed,
        matchupCounts,
        dateIndex,
        random,
      );

      if (!opponent) {
        continue;
      }

      const homeTeam = chooseHomeTeam(primaryTeam, opponent, homeGames, awayGames, random);
      const awayTeam = homeTeam.id === primaryTeam.id ? opponent : primaryTeam;
      const pair = pairKey(homeTeam.id, awayTeam.id);

      games.push({
        gameId: nextGameId,
        gameDate: dateStrings[dateIndex],
        daynum: dayNumber(dateStrings[dateIndex]),
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        pHomeWins: Number(getHomeWinProbability(homeTeam.id, awayTeam.id).toFixed(4)),
        isCompleted: false,
      });

      nextGameId += 1;
      createdToday += 1;
      usedToday.add(homeTeam.id);
      usedToday.add(awayTeam.id);
      remainingGames.set(homeTeam.id, (remainingGames.get(homeTeam.id) ?? 1) - 1);
      remainingGames.set(awayTeam.id, (remainingGames.get(awayTeam.id) ?? 1) - 1);
      homeGames.set(homeTeam.id, (homeGames.get(homeTeam.id) ?? 0) + 1);
      awayGames.set(awayTeam.id, (awayGames.get(awayTeam.id) ?? 0) + 1);
      matchupCounts.set(pair, (matchupCounts.get(pair) ?? 0) + 1);
      lastPlayed.set(homeTeam.id, dateIndex);
      lastPlayed.set(awayTeam.id, dateIndex);
    }

    if (createdToday !== targetGames) {
      return null;
    }
  }

  if (Array.from(remainingGames.values()).some((value) => value !== 0)) {
    return null;
  }

  const completedRandom = mulberry32(fnv1a('nba-placeholder-completed-v1'));

  return games.map((game) => {
    if (game.gameDate !== COMPLETED_DATE) {
      return game;
    }

    const actualWinnerId =
      completedRandom() < game.pHomeWins ? game.homeTeamId : game.awayTeamId;

    return {
      ...game,
      isCompleted: true,
      actualWinnerId,
    };
  });
}

function buildSchedule(): NbaGame[] {
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const schedule = buildScheduleAttempt(attempt * 101);

    if (schedule) {
      return schedule;
    }
  }

  throw new Error('Unable to generate placeholder NBA schedule.');
}

export const NBA_SCHEDULE: NbaGame[] = buildSchedule();
