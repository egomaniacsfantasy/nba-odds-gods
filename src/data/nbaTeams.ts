// PLACEHOLDER DATA — will be replaced by pipeline output

import type { HeadToHeadRecord, NbaTeam } from '../types';
import { clamp, clampInt, fnv1a, mulberry32 } from '../lib/rng';

interface TeamProfile {
  id: number;
  name: string;
  abbr: string;
  city: string;
  conference: 'East' | 'West';
  division: string;
  logoId: number;
  primaryColor: string;
  elo: number;
  baselineWins: number;
  baselineLosses: number;
}

const TARGET_GAMES_PLAYED = 74;
const CONFERENCE_GAMES_PLAYED = Math.round((TARGET_GAMES_PLAYED * 52) / 82);
const DIVISION_GAMES_PLAYED = Math.round((TARGET_GAMES_PLAYED * 16) / 82);

const NBA_LOGO_MAP: Record<string, string> = {
  ATL: 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png',
  BOS: 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
  BKN: 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
  CHA: 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png',
  CHI: 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png',
  CLE: 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png',
  DET: 'https://a.espncdn.com/i/teamlogos/nba/500/det.png',
  IND: 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png',
  MIA: 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
  MIL: 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
  NYK: 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png',
  ORL: 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png',
  PHI: 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png',
  TOR: 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png',
  WAS: 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png',
  DAL: 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
  DEN: 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
  GSW: 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
  HOU: 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png',
  LAC: 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
  LAL: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
  MEM: 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png',
  MIN: 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
  NOP: 'https://a.espncdn.com/i/teamlogos/nba/500/no.png',
  OKC: 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
  PHX: 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
  POR: 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
  SAC: 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png',
  SAS: 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png',
  UTA: 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png',
};

const TEAM_PROFILES: TeamProfile[] = [
  {
    id: 1,
    name: 'Hawks',
    abbr: 'ATL',
    city: 'Atlanta',
    conference: 'East',
    division: 'Southeast',
    logoId: 1,
    primaryColor: '#e03a3e',
    elo: 1558,
    baselineWins: 34,
    baselineLosses: 34,
  },
  {
    id: 2,
    name: 'Celtics',
    abbr: 'BOS',
    city: 'Boston',
    conference: 'East',
    division: 'Atlantic',
    logoId: 2,
    primaryColor: '#007a33',
    elo: 1696,
    baselineWins: 49,
    baselineLosses: 19,
  },
  {
    id: 3,
    name: 'Nets',
    abbr: 'BKN',
    city: 'Brooklyn',
    conference: 'East',
    division: 'Atlantic',
    logoId: 17,
    primaryColor: '#000000',
    elo: 1506,
    baselineWins: 29,
    baselineLosses: 39,
  },
  {
    id: 4,
    name: 'Hornets',
    abbr: 'CHA',
    city: 'Charlotte',
    conference: 'East',
    division: 'Southeast',
    logoId: 30,
    primaryColor: '#1d1160',
    elo: 1474,
    baselineWins: 22,
    baselineLosses: 46,
  },
  {
    id: 5,
    name: 'Bulls',
    abbr: 'CHI',
    city: 'Chicago',
    conference: 'East',
    division: 'Central',
    logoId: 4,
    primaryColor: '#ce1141',
    elo: 1542,
    baselineWins: 33,
    baselineLosses: 35,
  },
  {
    id: 6,
    name: 'Cavaliers',
    abbr: 'CLE',
    city: 'Cleveland',
    conference: 'East',
    division: 'Central',
    logoId: 5,
    primaryColor: '#860038',
    elo: 1718,
    baselineWins: 50,
    baselineLosses: 18,
  },
  {
    id: 7,
    name: 'Pistons',
    abbr: 'DET',
    city: 'Detroit',
    conference: 'East',
    division: 'Central',
    logoId: 8,
    primaryColor: '#1d42ba',
    elo: 1606,
    baselineWins: 39,
    baselineLosses: 29,
  },
  {
    id: 8,
    name: 'Pacers',
    abbr: 'IND',
    city: 'Indiana',
    conference: 'East',
    division: 'Central',
    logoId: 11,
    primaryColor: '#fdbb30',
    elo: 1592,
    baselineWins: 37,
    baselineLosses: 31,
  },
  {
    id: 9,
    name: 'Heat',
    abbr: 'MIA',
    city: 'Miami',
    conference: 'East',
    division: 'Southeast',
    logoId: 14,
    primaryColor: '#98002e',
    elo: 1569,
    baselineWins: 35,
    baselineLosses: 33,
  },
  {
    id: 10,
    name: 'Bucks',
    abbr: 'MIL',
    city: 'Milwaukee',
    conference: 'East',
    division: 'Central',
    logoId: 15,
    primaryColor: '#00471b',
    elo: 1638,
    baselineWins: 42,
    baselineLosses: 26,
  },
  {
    id: 11,
    name: 'Knicks',
    abbr: 'NYK',
    city: 'New York',
    conference: 'East',
    division: 'Atlantic',
    logoId: 18,
    primaryColor: '#f58426',
    elo: 1658,
    baselineWins: 44,
    baselineLosses: 24,
  },
  {
    id: 12,
    name: 'Magic',
    abbr: 'ORL',
    city: 'Orlando',
    conference: 'East',
    division: 'Southeast',
    logoId: 19,
    primaryColor: '#0077c0',
    elo: 1598,
    baselineWins: 38,
    baselineLosses: 30,
  },
  {
    id: 13,
    name: '76ers',
    abbr: 'PHI',
    city: 'Philadelphia',
    conference: 'East',
    division: 'Atlantic',
    logoId: 20,
    primaryColor: '#006bb6',
    elo: 1492,
    baselineWins: 27,
    baselineLosses: 41,
  },
  {
    id: 14,
    name: 'Raptors',
    abbr: 'TOR',
    city: 'Toronto',
    conference: 'East',
    division: 'Atlantic',
    logoId: 28,
    primaryColor: '#ce1141',
    elo: 1512,
    baselineWins: 30,
    baselineLosses: 38,
  },
  {
    id: 15,
    name: 'Wizards',
    abbr: 'WAS',
    city: 'Washington',
    conference: 'East',
    division: 'Southeast',
    logoId: 27,
    primaryColor: '#002b5c',
    elo: 1448,
    baselineWins: 18,
    baselineLosses: 50,
  },
  {
    id: 16,
    name: 'Mavericks',
    abbr: 'DAL',
    city: 'Dallas',
    conference: 'West',
    division: 'Southwest',
    logoId: 6,
    primaryColor: '#00538c',
    elo: 1578,
    baselineWins: 36,
    baselineLosses: 32,
  },
  {
    id: 17,
    name: 'Nuggets',
    abbr: 'DEN',
    city: 'Denver',
    conference: 'West',
    division: 'Northwest',
    logoId: 7,
    primaryColor: '#0e2240',
    elo: 1652,
    baselineWins: 43,
    baselineLosses: 25,
  },
  {
    id: 18,
    name: 'Warriors',
    abbr: 'GSW',
    city: 'Golden State',
    conference: 'West',
    division: 'Pacific',
    logoId: 9,
    primaryColor: '#1d428a',
    elo: 1614,
    baselineWins: 39,
    baselineLosses: 29,
  },
  {
    id: 19,
    name: 'Rockets',
    abbr: 'HOU',
    city: 'Houston',
    conference: 'West',
    division: 'Southwest',
    logoId: 10,
    primaryColor: '#ce1141',
    elo: 1684,
    baselineWins: 47,
    baselineLosses: 21,
  },
  {
    id: 20,
    name: 'Clippers',
    abbr: 'LAC',
    city: 'Los Angeles',
    conference: 'West',
    division: 'Pacific',
    logoId: 12,
    primaryColor: '#c8102e',
    elo: 1585,
    baselineWins: 37,
    baselineLosses: 31,
  },
  {
    id: 21,
    name: 'Lakers',
    abbr: 'LAL',
    city: 'Los Angeles',
    conference: 'West',
    division: 'Pacific',
    logoId: 13,
    primaryColor: '#552583',
    elo: 1621,
    baselineWins: 40,
    baselineLosses: 28,
  },
  {
    id: 22,
    name: 'Grizzlies',
    abbr: 'MEM',
    city: 'Memphis',
    conference: 'West',
    division: 'Southwest',
    logoId: 29,
    primaryColor: '#5d76a9',
    elo: 1668,
    baselineWins: 45,
    baselineLosses: 23,
  },
  {
    id: 23,
    name: 'Timberwolves',
    abbr: 'MIN',
    city: 'Minnesota',
    conference: 'West',
    division: 'Northwest',
    logoId: 16,
    primaryColor: '#0c2340',
    elo: 1629,
    baselineWins: 41,
    baselineLosses: 27,
  },
  {
    id: 24,
    name: 'Pelicans',
    abbr: 'NOP',
    city: 'New Orleans',
    conference: 'West',
    division: 'Southwest',
    logoId: 3,
    primaryColor: '#0c2340',
    elo: 1486,
    baselineWins: 26,
    baselineLosses: 42,
  },
  {
    id: 25,
    name: 'Thunder',
    abbr: 'OKC',
    city: 'Oklahoma City',
    conference: 'West',
    division: 'Northwest',
    logoId: 25,
    primaryColor: '#007ac1',
    elo: 1744,
    baselineWins: 53,
    baselineLosses: 14,
  },
  {
    id: 26,
    name: 'Suns',
    abbr: 'PHX',
    city: 'Phoenix',
    conference: 'West',
    division: 'Pacific',
    logoId: 21,
    primaryColor: '#1d1160',
    elo: 1536,
    baselineWins: 32,
    baselineLosses: 36,
  },
  {
    id: 27,
    name: 'Trail Blazers',
    abbr: 'POR',
    city: 'Portland',
    conference: 'West',
    division: 'Northwest',
    logoId: 22,
    primaryColor: '#e03a3e',
    elo: 1499,
    baselineWins: 28,
    baselineLosses: 40,
  },
  {
    id: 28,
    name: 'Kings',
    abbr: 'SAC',
    city: 'Sacramento',
    conference: 'West',
    division: 'Pacific',
    logoId: 23,
    primaryColor: '#5a2d81',
    elo: 1549,
    baselineWins: 34,
    baselineLosses: 34,
  },
  {
    id: 29,
    name: 'Spurs',
    abbr: 'SAS',
    city: 'San Antonio',
    conference: 'West',
    division: 'Southwest',
    logoId: 24,
    primaryColor: '#c4ced4',
    elo: 1529,
    baselineWins: 31,
    baselineLosses: 37,
  },
  {
    id: 30,
    name: 'Jazz',
    abbr: 'UTA',
    city: 'Utah',
    conference: 'West',
    division: 'Northwest',
    logoId: 26,
    primaryColor: '#002b5c',
    elo: 1462,
    baselineWins: 20,
    baselineLosses: 48,
  },
];

export function getTeamLogoUrl(abbr: string): string {
  return NBA_LOGO_MAP[abbr] || `https://a.espncdn.com/i/teamlogos/nba/500/${abbr.toLowerCase()}.png`;
}

function logoUrl(profile: TeamProfile): string {
  return getTeamLogoUrl(profile.abbr);
}

function createTeam(profile: TeamProfile): NbaTeam {
  const baselineGames = profile.baselineWins + profile.baselineLosses;
  const winPct = profile.baselineWins / baselineGames;
  const wins = clampInt(winPct * TARGET_GAMES_PLAYED, 15, 62);
  const losses = TARGET_GAMES_PLAYED - wins;
  const confWins = deriveConferenceWins(profile, wins, losses);
  const confLosses = CONFERENCE_GAMES_PLAYED - confWins;
  const divWins = deriveDivisionWins(profile, wins, losses, confWins);
  const divLosses = DIVISION_GAMES_PLAYED - divWins;

  return {
    id: profile.id,
    name: `${profile.city} ${profile.name}`,
    abbr: profile.abbr,
    city: profile.city,
    conference: profile.conference,
    division: profile.division,
    logoUrl: logoUrl(profile),
    primaryColor: profile.primaryColor,
    wins,
    losses,
    divWins,
    divLosses,
    confWins,
    confLosses,
  };
}

function deriveConferenceWins(profile: TeamProfile, wins: number, losses: number): number {
  const winPct = wins / (wins + losses);
  const bonus = clamp((profile.elo - 1500) / 120, -2.5, 2.5);
  const minimum = Math.max(0, CONFERENCE_GAMES_PLAYED - losses);
  const maximum = Math.min(wins, CONFERENCE_GAMES_PLAYED);
  return clampInt(winPct * CONFERENCE_GAMES_PLAYED + bonus, minimum, maximum);
}

function deriveDivisionWins(
  profile: TeamProfile,
  wins: number,
  losses: number,
  conferenceWins: number,
): number {
  const winPct = wins / (wins + losses);
  const bonus = clamp((profile.elo - 1500) / 220, -1.4, 1.4);
  const minimum = Math.max(0, DIVISION_GAMES_PLAYED - (CONFERENCE_GAMES_PLAYED - conferenceWins));
  const maximum = Math.min(conferenceWins, wins, DIVISION_GAMES_PLAYED);
  return clampInt(winPct * DIVISION_GAMES_PLAYED + bonus, minimum, maximum);
}

function pairKey(teamAId: number, teamBId: number): string {
  return teamAId < teamBId ? `${teamAId}-${teamBId}` : `${teamBId}-${teamAId}`;
}

function sameDivision(teamA: TeamProfile, teamB: TeamProfile): boolean {
  return teamA.conference === teamB.conference && teamA.division === teamB.division;
}

function sameConference(teamA: TeamProfile, teamB: TeamProfile): boolean {
  return teamA.conference === teamB.conference;
}

function winProbabilityForNeutralCourt(teamAId: number, teamBId: number): number {
  const ratingA = NBA_TEAM_RATINGS.get(teamAId) ?? 1500;
  const ratingB = NBA_TEAM_RATINGS.get(teamBId) ?? 1500;
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

function buildBaselineHeadToHead(): Map<string, HeadToHeadRecord> {
  const records = new Map<string, HeadToHeadRecord>();

  for (let index = 0; index < TEAM_PROFILES.length; index += 1) {
    for (let opponentIndex = index + 1; opponentIndex < TEAM_PROFILES.length; opponentIndex += 1) {
      const team = TEAM_PROFILES[index];
      const opponent = TEAM_PROFILES[opponentIndex];
      const meetings = sameDivision(team, opponent) ? 3 : sameConference(team, opponent) ? 2 : 1;
      const random = mulberry32(fnv1a(`${team.id}-${opponent.id}-baseline`));
      const expectedWins = winProbabilityForNeutralCourt(team.id, opponent.id) * meetings + (random() - 0.5);
      const winsForLowerId = clampInt(expectedWins, 0, meetings);

      records.set(pairKey(team.id, opponent.id), {
        w: winsForLowerId,
        l: meetings - winsForLowerId,
      });
    }
  }

  return records;
}

export const NBA_TEAMS: NbaTeam[] = TEAM_PROFILES.map(createTeam);

export const NBA_TEAM_LOOKUP = new Map<number, NbaTeam>(
  NBA_TEAMS.map((team) => [team.id, team]),
);

export const NBA_TEAM_RATINGS = new Map<number, number>(
  TEAM_PROFILES.map((profile) => [profile.id, profile.elo]),
);

export const NBA_BASELINE_POINT_DIFF = new Map<number, number>(
  TEAM_PROFILES.map((profile) => [profile.id, Number(clamp((profile.elo - 1500) / 20, -10, 10).toFixed(1))]),
);

export const NBA_BASELINE_HEAD_TO_HEAD = buildBaselineHeadToHead();

export function getTeamRating(teamId: number): number {
  return NBA_TEAM_RATINGS.get(teamId) ?? 1500;
}

export function getHomeWinProbability(homeTeamId: number, awayTeamId: number): number {
  const homeRating = getTeamRating(homeTeamId) + 100;
  const awayRating = getTeamRating(awayTeamId);
  return 1 / (1 + 10 ** ((awayRating - homeRating) / 400));
}

export function getConferenceTeams(conference: 'East' | 'West'): NbaTeam[] {
  return NBA_TEAMS.filter((team) => team.conference === conference);
}
