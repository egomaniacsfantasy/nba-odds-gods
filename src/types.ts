// ============================================================
// TEAM DATA
// ============================================================

export interface NbaTeam {
  id: number;
  name: string;
  abbr: string;
  city: string;
  conference: 'East' | 'West';
  division: string;
  logoUrl: string;
  primaryColor: string;
  wins: number;
  losses: number;
  divWins: number;
  divLosses: number;
  confWins: number;
  confLosses: number;
}

// ============================================================
// SCHEDULE DATA
// ============================================================

export interface NbaGame {
  gameId: number;
  gameDate: string;
  daynum: number;
  homeTeamId: number;
  awayTeamId: number;
  pHomeWins: number;
  isCompleted: boolean;
  actualWinnerId?: number;
  seriesScore?: string;
}

// ============================================================
// STANDINGS
// ============================================================

export interface StandingsRow {
  teamId: number;
  wins: number;
  losses: number;
  winPct: number;
  gamesBack: number;
  divWins: number;
  divLosses: number;
  confWins: number;
  confLosses: number;
  projectedSeed: number | null;
  seedLabel: string;
  isPlayIn: boolean;
  isEliminated: boolean;
  streak: string;
}

// ============================================================
// ADVANCEMENT PROBABILITIES
// ============================================================

export interface TeamAdvancement {
  teamId: number;
  seed: number | null;
  seedLabel: string;
  pTop6: number;
  pPlayIn: number;
  pMakesPlayoffs: number;
  pWinsR1: number;
  pConfFinals: number;
  pFinals: number;
  pChampion: number;
}

// ============================================================
// SIMULATION RESULT
// ============================================================

export interface SimulationResult {
  advancements: Map<number, TeamAdvancement>;
  expWins: Map<number, number>;
  standings: {
    east: StandingsRow[];
    west: StandingsRow[];
  };
}

// ============================================================
// PICK STATE
// ============================================================

export type LockedPicks = Map<number, number>;

// ============================================================
// DISPLAY MODE
// ============================================================

export type OddsFormat = 'implied' | 'american';

// ============================================================
// INTERNAL HELPERS
// ============================================================

export type ConferenceKey = 'East' | 'West';
export type AppTab = 'schedule' | 'standings' | 'playoffs';
export type MobileTab = 'schedule' | 'standings';
export type SortDirection = 'asc' | 'desc';

export type AdvancementSortKey =
  | 'team'
  | 'seed'
  | 'pTop6'
  | 'pPlayIn'
  | 'pMakesPlayoffs'
  | 'pWinsR1'
  | 'pConfFinals'
  | 'pFinals'
  | 'pChampion';

export interface HeadToHeadRecord {
  w: number;
  l: number;
}

export interface ResolvedGame {
  gameId: number;
  gameDate: string;
  homeTeamId: number;
  awayTeamId: number;
  winnerId: number;
  loserId: number;
  wasCompleted: boolean;
  wasLocked: boolean;
  estimatedMargin: number;
}

export interface TeamSeasonState {
  teamId: number;
  conference: ConferenceKey;
  division: string;
  wins: number;
  losses: number;
  divWins: number;
  divLosses: number;
  confWins: number;
  confLosses: number;
  pointDifferential: number;
  recentResults: Array<'W' | 'L'>;
  resultsByOpponent: Map<number, HeadToHeadRecord>;
}

export interface LeagueStandingsState {
  east: StandingsRow[];
  west: StandingsRow[];
  states: Map<number, TeamSeasonState>;
  headToHead: Map<string, HeadToHeadRecord>;
}

export interface SimulationTeamCounter {
  teamId: number;
  seedCounts: Map<number, number>;
  top6Count: number;
  playInCount: number;
  playoffCount: number;
  r1Count: number;
  confFinalsCount: number;
  finalsCount: number;
  championCount: number;
}
