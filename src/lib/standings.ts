import { NBA_BASELINE_HEAD_TO_HEAD, NBA_BASELINE_POINT_DIFF, NBA_TEAM_LOOKUP } from '../data/nbaTeams';
import type {
  HeadToHeadRecord,
  LeagueStandingsState,
  LockedPicks,
  NbaGame,
  NbaTeam,
  ResolvedGame,
  StandingsRow,
  TeamSeasonState,
} from '../types';
import { clamp } from './rng';

function pairKey(teamAId: number, teamBId: number): string {
  return teamAId < teamBId ? `${teamAId}-${teamBId}` : `${teamBId}-${teamAId}`;
}

function parsePairKey(value: string): [number, number] {
  const [teamAId, teamBId] = value.split('-').map(Number);
  return [teamAId, teamBId];
}

function cloneHeadToHeadMap(): Map<string, HeadToHeadRecord> {
  return new Map(
    Array.from(NBA_BASELINE_HEAD_TO_HEAD.entries()).map(([key, record]) => [key, { ...record }]),
  );
}

function createInitialStates(teams: NbaTeam[]): Map<number, TeamSeasonState> {
  return new Map(
    teams.map((team) => [
      team.id,
      {
        teamId: team.id,
        conference: team.conference,
        division: team.division,
        wins: team.wins,
        losses: team.losses,
        divWins: team.divWins,
        divLosses: team.divLosses,
        confWins: team.confWins,
        confLosses: team.confLosses,
        pointDifferential: NBA_BASELINE_POINT_DIFF.get(team.id) ?? 0,
        recentResults: [],
        resultsByOpponent: new Map<number, HeadToHeadRecord>(),
      },
    ]),
  );
}

function hydrateOpponentRecords(
  states: Map<number, TeamSeasonState>,
  headToHead: Map<string, HeadToHeadRecord>,
): void {
  for (const [key, record] of headToHead.entries()) {
    const [lowerId, higherId] = parsePairKey(key);
    const lowerState = states.get(lowerId);
    const higherState = states.get(higherId);

    if (!lowerState || !higherState) {
      continue;
    }

    lowerState.resultsByOpponent.set(higherId, { w: record.w, l: record.l });
    higherState.resultsByOpponent.set(lowerId, { w: record.l, l: record.w });
  }
}

function updateHeadToHead(
  headToHead: Map<string, HeadToHeadRecord>,
  winnerId: number,
  loserId: number,
): void {
  const key = pairKey(winnerId, loserId);
  const current = headToHead.get(key) ?? { w: 0, l: 0 };

  if (winnerId < loserId) {
    current.w += 1;
  } else {
    current.l += 1;
  }

  headToHead.set(key, current);
}

function updateOpponentRecords(
  states: Map<number, TeamSeasonState>,
  winnerId: number,
  loserId: number,
): void {
  const winnerState = states.get(winnerId);
  const loserState = states.get(loserId);

  if (!winnerState || !loserState) {
    return;
  }

  const winnerRecord = winnerState.resultsByOpponent.get(loserId) ?? { w: 0, l: 0 };
  winnerRecord.w += 1;
  winnerState.resultsByOpponent.set(loserId, winnerRecord);

  const loserRecord = loserState.resultsByOpponent.get(winnerId) ?? { w: 0, l: 0 };
  loserRecord.l += 1;
  loserState.resultsByOpponent.set(winnerId, loserRecord);
}

function isSameConference(game: ResolvedGame): boolean {
  const homeTeam = NBA_TEAM_LOOKUP.get(game.homeTeamId);
  const awayTeam = NBA_TEAM_LOOKUP.get(game.awayTeamId);
  return homeTeam?.conference === awayTeam?.conference;
}

function isSameDivision(game: ResolvedGame): boolean {
  const homeTeam = NBA_TEAM_LOOKUP.get(game.homeTeamId);
  const awayTeam = NBA_TEAM_LOOKUP.get(game.awayTeamId);
  return homeTeam?.conference === awayTeam?.conference && homeTeam?.division === awayTeam?.division;
}

function applyResolvedGame(
  states: Map<number, TeamSeasonState>,
  headToHead: Map<string, HeadToHeadRecord>,
  game: ResolvedGame,
): void {
  const winnerState = states.get(game.winnerId);
  const loserState = states.get(game.loserId);

  if (!winnerState || !loserState) {
    return;
  }

  winnerState.wins += 1;
  loserState.losses += 1;
  winnerState.pointDifferential += game.estimatedMargin;
  loserState.pointDifferential -= game.estimatedMargin;
  winnerState.recentResults.push('W');
  loserState.recentResults.push('L');

  if (isSameConference(game)) {
    winnerState.confWins += 1;
    loserState.confLosses += 1;
  }

  if (isSameDivision(game)) {
    winnerState.divWins += 1;
    loserState.divLosses += 1;
  }

  updateHeadToHead(headToHead, game.winnerId, game.loserId);
  updateOpponentRecords(states, game.winnerId, game.loserId);
}

function headToHeadPct(team: TeamSeasonState, group: TeamSeasonState[]): number {
  let wins = 0;
  let losses = 0;

  for (const opponent of group) {
    if (opponent.teamId === team.teamId) {
      continue;
    }

    const record = team.resultsByOpponent.get(opponent.teamId);

    if (!record) {
      continue;
    }

    wins += record.w;
    losses += record.l;
  }

  const games = wins + losses;
  return games === 0 ? 0.5 : wins / games;
}

function winPct(wins: number, losses: number): number {
  const games = wins + losses;
  return games === 0 ? 0 : wins / games;
}

function recordVsProjectedPlayoffTeamsPct(
  team: TeamSeasonState,
  projectedPlayoffIds: Set<number> | null,
): number {
  if (!projectedPlayoffIds) {
    return 0;
  }

  let wins = 0;
  let losses = 0;

  for (const playoffTeamId of projectedPlayoffIds) {
    if (playoffTeamId === team.teamId) {
      continue;
    }

    const record = team.resultsByOpponent.get(playoffTeamId);

    if (!record) {
      continue;
    }

    wins += record.w;
    losses += record.l;
  }

  const games = wins + losses;

  if (games === 0) {
    return winPct(team.confWins, team.confLosses);
  }

  return wins / games;
}

function sortTieGroup(
  group: TeamSeasonState[],
  projectedPlayoffIds: Set<number> | null,
): TeamSeasonState[] {
  const allSameDivision = group.every((team) => team.division === group[0].division);

  return [...group].sort((teamA, teamB) => {
    const teamAHeadToHead = headToHeadPct(teamA, group);
    const teamBHeadToHead = headToHeadPct(teamB, group);

    if (teamAHeadToHead !== teamBHeadToHead) {
      return teamBHeadToHead - teamAHeadToHead;
    }

    if (allSameDivision) {
      const teamADivPct = winPct(teamA.divWins, teamA.divLosses);
      const teamBDivPct = winPct(teamB.divWins, teamB.divLosses);

      if (teamADivPct !== teamBDivPct) {
        return teamBDivPct - teamADivPct;
      }
    }

    const teamAConfPct = winPct(teamA.confWins, teamA.confLosses);
    const teamBConfPct = winPct(teamB.confWins, teamB.confLosses);

    if (teamAConfPct !== teamBConfPct) {
      return teamBConfPct - teamAConfPct;
    }

    const teamAPlayoffPct = recordVsProjectedPlayoffTeamsPct(teamA, projectedPlayoffIds);
    const teamBPlayoffPct = recordVsProjectedPlayoffTeamsPct(teamB, projectedPlayoffIds);

    if (teamAPlayoffPct !== teamBPlayoffPct) {
      return teamBPlayoffPct - teamAPlayoffPct;
    }

    if (teamA.pointDifferential !== teamB.pointDifferential) {
      return teamB.pointDifferential - teamA.pointDifferential;
    }

    return teamA.teamId - teamB.teamId;
  });
}

function groupTiedTeams(sortedTeams: TeamSeasonState[]): TeamSeasonState[][] {
  const groups: TeamSeasonState[][] = [];

  for (const team of sortedTeams) {
    const lastGroup = groups[groups.length - 1];

    if (!lastGroup) {
      groups.push([team]);
      continue;
    }

    const lastTeam = lastGroup[0];

    if (team.wins === lastTeam.wins && team.losses === lastTeam.losses) {
      lastGroup.push(team);
      continue;
    }

    groups.push([team]);
  }

  return groups;
}

function rankConference(
  teams: TeamSeasonState[],
  projectedPlayoffIds: Set<number> | null,
): TeamSeasonState[] {
  const winSorted = [...teams].sort((teamA, teamB) => {
    if (teamA.wins !== teamB.wins) {
      return teamB.wins - teamA.wins;
    }

    return teamA.losses - teamB.losses;
  });

  const groups = groupTiedTeams(winSorted);
  return groups.flatMap((group) =>
    group.length === 1 ? group : sortTieGroup(group, projectedPlayoffIds),
  );
}

function conferenceRows(orderedTeams: TeamSeasonState[]): StandingsRow[] {
  const leader = orderedTeams[0];

  return orderedTeams.map((team, index) => {
    const seed = index + 1;
    const gamesBack =
      leader.teamId === team.teamId
        ? 0
        : (leader.wins - team.wins + team.losses - leader.losses) / 2;
    const streak = deriveStreak(team.recentResults);
    const isPlayIn = seed >= 7 && seed <= 10;
    const isEliminated = seed > 10;

    return {
      teamId: team.teamId,
      wins: team.wins,
      losses: team.losses,
      winPct: winPct(team.wins, team.losses),
      gamesBack,
      divWins: team.divWins,
      divLosses: team.divLosses,
      confWins: team.confWins,
      confLosses: team.confLosses,
      projectedSeed: seed <= 10 ? seed : null,
      seedLabel: isPlayIn ? `${seed} (PI)` : `${seed}`,
      isPlayIn,
      isEliminated,
      streak,
    };
  });
}

function deriveStreak(recentResults: Array<'W' | 'L'>): string {
  if (recentResults.length === 0) {
    return '—';
  }

  const latest = recentResults[recentResults.length - 1];
  let streakLength = 0;

  for (let index = recentResults.length - 1; index >= 0; index -= 1) {
    if (recentResults[index] !== latest) {
      break;
    }

    streakLength += 1;
  }

  return `${latest}${streakLength}`;
}

function buildRows(
  states: Map<number, TeamSeasonState>,
): Pick<LeagueStandingsState, 'east' | 'west'> {
  const eastStates = Array.from(states.values()).filter((state) => state.conference === 'East');
  const westStates = Array.from(states.values()).filter((state) => state.conference === 'West');
  const eastPreliminary = rankConference(eastStates, null);
  const westPreliminary = rankConference(westStates, null);
  const eastPlayoffIds = new Set(eastPreliminary.slice(0, 10).map((team) => team.teamId));
  const westPlayoffIds = new Set(westPreliminary.slice(0, 10).map((team) => team.teamId));
  const east = conferenceRows(rankConference(eastStates, eastPlayoffIds));
  const west = conferenceRows(rankConference(westStates, westPlayoffIds));

  return { east, west };
}

function estimatedMargin(game: NbaGame, winnerId: number): number {
  const winnerProbability =
    winnerId === game.homeTeamId ? game.pHomeWins : 1 - game.pHomeWins;
  return Number(clamp(Math.abs(winnerProbability - 0.5) * 20 + 1.5, 1, 10).toFixed(1));
}

export function cloneLockedPicks(lockedPicks: LockedPicks): LockedPicks {
  return new Map(lockedPicks);
}

export function getMostLikelyWinner(game: NbaGame): number {
  return game.pHomeWins >= 0.5 ? game.homeTeamId : game.awayTeamId;
}

export function buildResolvedGames(
  lockedPicks: LockedPicks,
  schedule: NbaGame[],
  random?: () => number,
): ResolvedGame[] {
  return schedule.map((game) => {
    let winnerId = game.actualWinnerId;
    let wasCompleted = Boolean(game.isCompleted && game.actualWinnerId);
    let wasLocked = false;

    if (!winnerId && lockedPicks.has(game.gameId)) {
      if (random) random(); // keep RNG stream aligned across iterations
      winnerId = lockedPicks.get(game.gameId);
      wasLocked = true;
    }

    if (!winnerId && random) {
      winnerId = random() < game.pHomeWins ? game.homeTeamId : game.awayTeamId;
    }

    if (!winnerId) {
      winnerId = getMostLikelyWinner(game);
    }

    const loserId = winnerId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;

    return {
      gameId: game.gameId,
      gameDate: game.gameDate,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      winnerId,
      loserId,
      wasCompleted,
      wasLocked,
      estimatedMargin: estimatedMargin(game, winnerId),
    };
  });
}

export function computeStandingsFromResolvedGames(
  teams: NbaTeam[],
  resolvedGames: ResolvedGame[],
): LeagueStandingsState {
  const states = createInitialStates(teams);
  const headToHead = cloneHeadToHeadMap();
  hydrateOpponentRecords(states, headToHead);

  for (const game of resolvedGames) {
    applyResolvedGame(states, headToHead, game);
  }

  const rows = buildRows(states);

  return {
    east: rows.east,
    west: rows.west,
    states,
    headToHead,
  };
}

export function computeProjectedStandings(
  lockedPicks: LockedPicks,
  schedule: NbaGame[],
  teams: NbaTeam[],
): LeagueStandingsState {
  return computeStandingsFromResolvedGames(teams, buildResolvedGames(lockedPicks, schedule));
}

export function computeSimulatedStandings(
  lockedPicks: LockedPicks,
  schedule: NbaGame[],
  teams: NbaTeam[],
  random: () => number,
): LeagueStandingsState {
  return computeStandingsFromResolvedGames(teams, buildResolvedGames(lockedPicks, schedule, random));
}

export function groupGamesByDate(schedule: NbaGame[]): Map<string, NbaGame[]> {
  const grouped = new Map<string, NbaGame[]>();

  for (const game of schedule) {
    const games = grouped.get(game.gameDate) ?? [];
    games.push(game);
    grouped.set(game.gameDate, games);
  }

  return grouped;
}
