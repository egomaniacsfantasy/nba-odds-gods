import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NBA_TEAMS } from '../data/nbaTeams';

const BUCKETS = ['G', 'W', 'B'] as const;
const POSITION_FILTERS = ['all', 'G', 'W', 'B'] as const;
const PLAYER_SORTS = [
  { id: 'value', label: 'Value' },
  { id: 'adp', label: 'ADP' },
  { id: 'name', label: 'Name' },
] as const;
type Bkt = typeof BUCKETS[number];
type FilterKey = typeof POSITION_FILTERS[number];
type PlayerSort = typeof PLAYER_SORTS[number]['id'];

interface DraftConfig {
  nTeams: number;
  rosterSize: number;
  nRounds: number;
  reqGuards: number;
  reqWings: number;
  reqBigs: number;
  sigmaNoise: number;
}

interface Player {
  playerIdx: number;
  playerId: number;
  playerName: string;
  teamAbbr: string;
  bucket: string;
  qualC: number;
  adp?: number;
  adpStd?: number;
}

interface DraftPack {
  season: string;
  config: DraftConfig;
  players: Player[];
  teams: string[];
  aiValuations: Record<string, number[]>;
}

interface DraftSlot {
  round: number;
  pickInRound: number;
  overallPick: number;
  team: string;
}

interface Req {
  G: number;
  W: number;
  B: number;
}

interface PickRecord {
  overallPick: number;
  round: number;
  team: string;
  playerIdx: number;
  playerName: string;
  teamAbbr: string;
  bucket: string;
  isUser: boolean;
}

interface SeasonGame {
  gid: number;
  date: string;
  dn: number;
  t1: string;
  t2: string;
  loc: number;
  done: boolean;
  t1w: number | null;
  wp: number[];
}

interface PoState {
  ssd: number;
  wp: number[];
}

interface PoGame {
  gnum: number;
  dn: number;
  loc: number;
  states: PoState[];
}

type PoData = Record<string, PoGame[]>;

interface PlayInGame {
  dn: number;
  loc: number;
  wp: number[];
}

interface SeasonData {
  season: string;
  quality_grid: number[];
  regular_season: SeasonGame[];
  play_in: Record<string, PlayInGame>;
  playoffs: PoData;
}

interface TeamStat {
  w: number;
  l: number;
  projW: number;
  poPct: number;
  r1Pct: number;
  r2Pct: number;
  cfPct: number;
  finPct: number;
  champPct: number;
}

interface RenderSlot {
  label: string;
  player: Player | null;
  bucket: Bkt | null;
}

interface TeamProjection {
  projectedWins: number;
  projectedLosses: number;
  seed: number;
  titleOdds: number;
  rating: number;
  conference: 'East' | 'West';
  qualZ: number;
}

type Phase = 'loading' | 'select' | 'draft' | 'complete' | 'season_load' | 'season';

const EAST = new Set(['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DET', 'IND', 'MIA', 'MIL', 'NYK', 'ORL', 'PHI', 'TOR', 'WAS']);
const WEST = new Set(['DAL', 'DEN', 'GSW', 'HOU', 'LAC', 'LAL', 'MEM', 'MIN', 'NOP', 'OKC', 'PHX', 'POR', 'SAC', 'SAS', 'UTA']);
const TEAM_META_BY_ABBR = new Map(NBA_TEAMS.map((team) => [team.abbr, team]));

function shuffle<T>(arr: T[]): T[] {
  const next = [...arr];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function buildSlots(teams: string[], nRounds: number): DraftSlot[] {
  const slots: DraftSlot[] = [];
  for (let round = 1; round <= nRounds; round += 1) {
    const order = round % 2 === 1 ? teams : [...teams].reverse();
    order.forEach((team, index) => {
      slots.push({
        round,
        pickInRound: index + 1,
        overallPick: (round - 1) * teams.length + index + 1,
        team,
      });
    });
  }
  return slots;
}

function getReq(config: DraftConfig): Req {
  return { G: config.reqGuards, W: config.reqWings, B: config.reqBigs };
}

function neededBuckets(filled: Req, req: Req): Bkt[] {
  return BUCKETS.filter((bucket) => filled[bucket] < req[bucket]);
}

function unfilledCount(filled: Req, req: Req): number {
  return BUCKETS.reduce((sum, bucket) => sum + Math.max(0, req[bucket] - filled[bucket]), 0);
}

function scarcityPrem(
  bucket: Bkt,
  available: Set<number>,
  players: Player[],
  requirements: Record<string, Req>,
  teams: string[],
  req: Req,
  sigma: number,
): number {
  const availableCount = [...available].filter((index) => players[index]?.bucket === bucket).length;
  const needyTeams = teams.filter((team) => (requirements[team]?.[bucket] ?? 0) < req[bucket]).length;
  if (!needyTeams) {
    return 0;
  }
  return Math.max(0, 1 - availableCount / needyTeams / 2) * sigma * 0.5;
}

function aiPickPlayer(
  team: string,
  slot: DraftSlot,
  pack: DraftPack,
  slots: DraftSlot[],
  available: Set<number>,
  requirements: Record<string, Req>,
): number {
  const req = getReq(pack.config);
  const filled = requirements[team] ?? { G: 0, W: 0, B: 0 };
  const needed = neededBuckets(filled, req);
  const picksLeft = slots.filter((draftSlot) => draftSlot.team === team && draftSlot.overallPick >= slot.overallPick).length;
  let eligible = [...available];

  if (picksLeft <= unfilledCount(filled, req) && needed.length > 0) {
    const restricted = eligible.filter((index) => needed.includes(pack.players[index]?.bucket as Bkt));
    if (restricted.length > 0) {
      eligible = restricted;
    }
  }

  const values = pack.aiValuations[team] ?? [];
  let bestIndex = eligible[0] ?? 0;
  let bestValue = -Infinity;

  for (const index of eligible) {
    let value = values[index] ?? 0;
    const bucket = pack.players[index]?.bucket as Bkt;
    if (bucket && needed.includes(bucket)) {
      value += scarcityPrem(bucket, available, pack.players, requirements, pack.teams, req, pack.config.sigmaNoise);
    }
    if (value > bestValue) {
      bestValue = value;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function interpWP(wp: number[], diff: number): number {
  const index = Math.max(0, Math.min(120, (diff + 6) / 0.1));
  const low = Math.floor(index);
  const high = Math.min(120, low + 1);
  const mix = index - low;
  return wp[low] * (1 - mix) + wp[high] * mix;
}

function computeQualZ(rosters: Record<string, number[]>, players: Player[]): Record<string, number> {
  const teams = Object.keys(rosters);
  const totals = teams.map((team) => (rosters[team] ?? []).reduce((sum, index) => sum + (players[index]?.qualC ?? 0), 0));
  const mean = totals.reduce((sum, value) => sum + value, 0) / Math.max(1, totals.length);
  const std = Math.sqrt(totals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, totals.length)) || 1;
  const result: Record<string, number> = {};
  teams.forEach((team, index) => {
    result[team] = (totals[index] - mean) / std;
  });
  return result;
}

function runSeasonStats(games: SeasonGame[], _qualZ: Record<string, number>): Record<string, TeamStat> {
  const allTeams = [...new Set(games.flatMap((game) => [game.t1, game.t2]))];
  const result: Record<string, TeamStat> = {};
  for (const team of allTeams) {
    result[team] = { w: 0, l: 0, projW: 0, poPct: 0, r1Pct: 0, r2Pct: 0, cfPct: 0, finPct: 0, champPct: 0 };
  }
  return result;
}

function bucketClass(bucket: Bkt): 'guard' | 'wing' | 'big' {
  if (bucket === 'G') {
    return 'guard';
  }
  if (bucket === 'W') {
    return 'wing';
  }
  return 'big';
}

function bucketLabel(bucket: Bkt): string {
  if (bucket === 'G') {
    return 'Guard';
  }
  if (bucket === 'W') {
    return 'Wing';
  }
  return 'Big';
}

function formatOracleValue(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
}

function valueTierClass(value: number): 'elite' | 'strong' | 'decent' | 'role' {
  if (value >= 3.5) {
    return 'elite';
  }
  if (value >= 2.5) {
    return 'strong';
  }
  if (value >= 1.5) {
    return 'decent';
  }
  return 'role';
}

function playerInitials(playerName: string): string {
  return playerName
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function headshotUrl(playerId: number): string {
  return `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`;
}

function teamCity(teamAbbr: string): string {
  return TEAM_META_BY_ABBR.get(teamAbbr)?.city ?? teamAbbr;
}

function teamLogoUrl(teamAbbr: string): string | null {
  return TEAM_META_BY_ABBR.get(teamAbbr)?.logoUrl ?? null;
}

function teamDisplayName(teamAbbr: string): string {
  return TEAM_META_BY_ABBR.get(teamAbbr)?.name ?? teamAbbr;
}

function teamConference(teamAbbr: string): 'East' | 'West' {
  const metaConference = TEAM_META_BY_ABBR.get(teamAbbr)?.conference;
  if (metaConference === 'East' || metaConference === 'West') {
    return metaConference;
  }
  return EAST.has(teamAbbr) ? 'East' : 'West';
}

function getBpmLabel(qualZ: number): { label: string; color: string } {
  if (qualZ >= 1.5) {
    return { label: 'Elite', color: 'var(--green-win)' };
  }
  if (qualZ >= 0.5) {
    return { label: 'Strong', color: '#4ade80' };
  }
  if (qualZ >= -0.5) {
    return { label: 'Average', color: 'var(--text-amber)' };
  }
  if (qualZ >= -1.5) {
    return { label: 'Below Average', color: 'var(--red-loss)' };
  }
  return { label: 'Rebuilding', color: 'var(--red-loss)' };
}

function totalRosterValue(playerIndexes: number[], players: Player[]): number {
  return playerIndexes.reduce((sum, index) => sum + (players[index]?.qualC ?? 0), 0);
}

function buildTeamProjection(teamAbbr: string, rosters: Record<string, number[]>, players: Player[]): TeamProjection | null {
  const teams = Object.keys(rosters);
  if (!teams.length || !rosters[teamAbbr]) {
    return null;
  }

  const totals = teams.map((team) => ({
    team,
    total: totalRosterValue(rosters[team] ?? [], players),
  }));

  const sortedOverall = [...totals].sort((teamA, teamB) => teamB.total - teamA.total);
  const userOverall = sortedOverall.find((team) => team.team === teamAbbr);
  if (!userOverall) {
    return null;
  }

  const totalValues = totals.map((team) => team.total);
  const mean = totalValues.reduce((sum, value) => sum + value, 0) / Math.max(1, totalValues.length);
  const variance = totalValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, totalValues.length);
  const std = Math.sqrt(variance) || 1;
  const qualZ = (userOverall.total - mean) / std;

  const minTotal = Math.min(...totalValues);
  const maxTotal = Math.max(...totalValues);
  const normalized = (userOverall.total - minTotal) / Math.max(1, maxTotal - minTotal);
  const rating = Math.max(1, Math.min(100, Math.round(normalized * 99) + 1));

  const conference = teamConference(teamAbbr);
  const conferenceTeams = sortedOverall.filter((team) => teamConference(team.team) === conference);
  const seed = Math.max(1, conferenceTeams.findIndex((team) => team.team === teamAbbr) + 1);

  const projectedWins = Math.max(18, Math.min(64, Math.round(41 + qualZ * 8)));
  const projectedLosses = 82 - projectedWins;
  const overallRank = Math.max(1, sortedOverall.findIndex((team) => team.team === teamAbbr) + 1);
  const titleOdds = Number(Math.max(0.2, (((teams.length - overallRank) / Math.max(1, teams.length - 1)) ** 2) * 18).toFixed(1));

  return {
    projectedWins,
    projectedLosses,
    seed,
    titleOdds,
    rating,
    conference,
    qualZ,
  };
}

function searchMatches(player: Player, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return player.playerName.toLowerCase().includes(normalized) || player.teamAbbr.toLowerCase().includes(normalized);
}

function comparePlayers(a: Player, b: Player, sortBy: PlayerSort): number {
  if (sortBy === 'name') {
    return a.playerName.localeCompare(b.playerName);
  }

  if (sortBy === 'adp') {
    const delta = (a.adp ?? Number.POSITIVE_INFINITY) - (b.adp ?? Number.POSITIVE_INFINITY);
    return delta || b.qualC - a.qualC || a.playerName.localeCompare(b.playerName);
  }

  return b.qualC - a.qualC || (a.adp ?? Number.POSITIVE_INFINITY) - (b.adp ?? Number.POSITIVE_INFINITY) || a.playerName.localeCompare(b.playerName);
}

function buildRosterSlots(playerIndexes: number[], players: Player[], req: Req): { starters: RenderSlot[]; bench: RenderSlot[] } {
  const rosterPlayers = playerIndexes.map((index) => players[index]).filter(Boolean);
  const guards: Player[] = [];
  const wings: Player[] = [];
  const bigs: Player[] = [];
  const bench: Player[] = [];

  for (const player of rosterPlayers) {
    const bucket = player.bucket as Bkt;
    if (bucket === 'G' && guards.length < req.G) {
      guards.push(player);
      continue;
    }
    if (bucket === 'W' && wings.length < req.W) {
      wings.push(player);
      continue;
    }
    if (bucket === 'B' && bigs.length < req.B) {
      bigs.push(player);
      continue;
    }
    bench.push(player);
  }

  return {
    starters: [
      { label: 'G1', player: guards[0] ?? null, bucket: 'G' },
      { label: 'G2', player: guards[1] ?? null, bucket: 'G' },
      { label: 'W1', player: wings[0] ?? null, bucket: 'W' },
      { label: 'W2', player: wings[1] ?? null, bucket: 'W' },
      { label: 'B1', player: bigs[0] ?? null, bucket: 'B' },
    ],
    bench: [
      { label: 'BN1', player: bench[0] ?? null, bucket: null },
      { label: 'BN2', player: bench[1] ?? null, bucket: null },
      { label: 'BN3', player: bench[2] ?? null, bucket: null },
    ],
  };
}

function remainingNeedsText(playerIndexes: number[], players: Player[], req: Req, rosterSize: number): string {
  const rosterPlayers = playerIndexes.map((index) => players[index]).filter(Boolean);
  const counts: Req = { G: 0, W: 0, B: 0 };
  rosterPlayers.forEach((player) => {
    const bucket = player.bucket as Bkt;
    if (counts[bucket] < req[bucket]) {
      counts[bucket] += 1;
    }
  });

  const parts: string[] = [];
  BUCKETS.forEach((bucket) => {
    const missing = Math.max(0, req[bucket] - counts[bucket]);
    if (missing > 0) {
      parts.push(`${bucketLabel(bucket)} x${missing}`);
    }
  });

  const benchMissing = Math.max(0, rosterSize - rosterPlayers.length);
  if (benchMissing > 0) {
    parts.push(`Bench x${benchMissing}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'Roster complete';
}

function PlayerAvatar({
  player,
  size = 40,
  imgClassName = 'player-avatar',
  fallbackClassName = 'player-avatar-fallback',
}: {
  player: Player;
  size?: number;
  imgClassName?: string;
  fallbackClassName?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const bucket = player.bucket as Bkt;
  const bucketClassName = bucketClass(bucket);
  const avatarStyle = { '--avatar-size': `${size}px` } as { [key: string]: string };

  if (!player.playerId || imgFailed) {
    return (
      <div
        className={`${fallbackClassName} ${bucketClassName}`.trim()}
        style={avatarStyle}
      >
        {playerInitials(player.playerName)}
      </div>
    );
  }

  return (
    <img
      src={headshotUrl(player.playerId)}
      alt={player.playerName}
      className={imgClassName}
      style={avatarStyle}
      loading="lazy"
      onError={() => setImgFailed(true)}
    />
  );
}

function nextUserPick(slots: DraftSlot[], pickIndex: number, userTeam: string): { slot: DraftSlot; picksUntil: number } | null {
  for (let index = pickIndex + 1; index < slots.length; index += 1) {
    if (slots[index].team === userTeam) {
      return { slot: slots[index], picksUntil: index - pickIndex };
    }
  }
  return null;
}

function resolveFilledSlotLabel(playerIndexes: number[], players: Player[], req: Req, draftedPlayerIdx: number): string | null {
  const { starters, bench } = buildRosterSlots([...playerIndexes, draftedPlayerIdx], players, req);
  return [...starters, ...bench].find((slot) => slot.player?.playerIdx === draftedPlayerIdx)?.label ?? null;
}

export default function ManagerModePage({
  onHeaderVisibilityChange,
}: {
  onHeaderVisibilityChange?: (visible: boolean) => void;
}) {
  const [pack, setPack] = useState<DraftPack | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [userTeam, setUserTeam] = useState('');
  const [draftSlots, setDraftSlots] = useState<DraftSlot[]>([]);
  const [pickIdx, setPickIdx] = useState(0);
  const [avail, setAvail] = useState<Set<number>>(new Set());
  const [reqs, setReqs] = useState<Record<string, Req>>({});
  const [rosters, setRosters] = useState<Record<string, number[]>>({});
  const [log, setLog] = useState<PickRecord[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<PlayerSort>('value');
  const [seasonData, setSeasonData] = useState<SeasonData | null>(null);
  const [seasonErr, setSeasonErr] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, TeamStat>>({});
  const [qualZ, setBpmZ] = useState<Record<string, number>>({});
  const [seasonTab, setSeasonTab] = useState<'standings' | 'schedule'>('schedule');
  const [selectionTransition, setSelectionTransition] = useState<'idle' | 'exiting'>('idle');
  const [draftEntering, setDraftEntering] = useState(false);
  const [justDraftedPlayerIdx, setJustDraftedPlayerIdx] = useState<number | null>(null);
  const [justFilledSlotLabel, setJustFilledSlotLabel] = useState<string | null>(null);
  const [latestPickOverall, setLatestPickOverall] = useState<number | null>(null);
  const [isYourTurnEntering, setIsYourTurnEntering] = useState(false);
  const [isListResorting, setIsListResorting] = useState(false);
  const [aiSpeed, setAiSpeed] = useState(500);
  const availRef = useRef<Set<number>>(new Set());
  const reqsRef = useRef<Record<string, Req>>({});
  const hasDraftMountedRef = useRef(false);
  const prevUserTurnRef = useRef(false);
  const playersByIdx = useMemo(
    () => new Map((pack?.players ?? []).map((player) => [player.playerIdx, player])),
    [pack],
  );

  availRef.current = avail;
  reqsRef.current = reqs;

  useEffect(() => {
    fetch('/data/mgr_draft_pack.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data: DraftPack) => {
        setPack(data);
        setPhase('select');
      })
      .catch((error: unknown) => setFetchErr(String(error)));
  }, []);

  useEffect(() => {
    onHeaderVisibilityChange?.(phase === 'select');

    return () => {
      onHeaderVisibilityChange?.(true);
    };
  }, [onHeaderVisibilityChange, phase]);

  const startDraft = useCallback((selectedTeam: string) => {
    if (!pack || selectionTransition === 'exiting') {
      return;
    }
    setUserTeam(selectedTeam);
    setSelectionTransition('exiting');

    window.setTimeout(() => {
      const order = shuffle(pack.teams);
      const slots = buildSlots(order, pack.config.nRounds);
      const initialReqs: Record<string, Req> = {};
      const initialRosters: Record<string, number[]> = {};
      for (const team of pack.teams) {
        initialReqs[team] = { G: 0, W: 0, B: 0 };
        initialRosters[team] = [];
      }
      prevUserTurnRef.current = false;
      hasDraftMountedRef.current = false;
      setDraftSlots(slots);
      setReqs(initialReqs);
      setRosters(initialRosters);
      setAvail(new Set(pack.players.map((player) => player.playerIdx)));
      setLog([]);
      setPickIdx(0);
      setFilter('all');
      setSearchQuery('');
      setSortBy('value');
      setJustDraftedPlayerIdx(null);
      setJustFilledSlotLabel(null);
      setLatestPickOverall(null);
      setIsYourTurnEntering(false);
      setIsListResorting(false);
      setUserTeam(selectedTeam);
      setDraftEntering(true);
      setPhase('draft');
    }, 350);
  }, [pack, selectionTransition]);

  const recordPick = useCallback((slotIndex: number, playerIdx: number, slots: DraftSlot[]) => {
    if (!pack) {
      return;
    }
    const slot = slots[slotIndex];
    const player = pack.players[playerIdx];
    const req = getReq(pack.config);
    const bucket = player.bucket as Bkt;

    setAvail((current) => {
      const next = new Set(current);
      next.delete(playerIdx);
      return next;
    });

    setReqs((current) => {
      const filled = current[slot.team] ?? { G: 0, W: 0, B: 0 };
      return filled[bucket] < req[bucket]
        ? { ...current, [slot.team]: { ...filled, [bucket]: filled[bucket] + 1 } }
        : current;
    });

    setRosters((current) => ({
      ...current,
      [slot.team]: [...(current[slot.team] ?? []), playerIdx],
    }));

    setLog((current) => [
      ...current,
      {
        overallPick: slot.overallPick,
        round: slot.round,
        team: slot.team,
        playerIdx,
        playerName: player.playerName,
        teamAbbr: player.teamAbbr,
        bucket: player.bucket,
        isUser: slot.team === userTeam,
      },
    ]);

    const nextIndex = slotIndex + 1;
    setPickIdx(nextIndex);
    if (nextIndex >= slots.length) {
      setPhase('complete');
    }
  }, [pack, userTeam]);

  useEffect(() => {
    if (phase !== 'draft' || !pack || draftSlots.length === 0) {
      return;
    }
    if (pickIdx >= draftSlots.length) {
      return;
    }
    const slot = draftSlots[pickIdx];
    if (slot.team === userTeam) {
      return;
    }

    const timer = window.setTimeout(() => {
      const picked = aiPickPlayer(slot.team, slot, pack, draftSlots, availRef.current, reqsRef.current);
      recordPick(pickIdx, picked, draftSlots);
    }, aiSpeed);

    return () => window.clearTimeout(timer);
  }, [aiSpeed, draftSlots, pack, phase, pickIdx, recordPick, userTeam]);

  useEffect(() => {
    if (!draftEntering) {
      return;
    }
    const timer = window.setTimeout(() => setDraftEntering(false), 500);
    return () => window.clearTimeout(timer);
  }, [draftEntering]);

  useEffect(() => {
    if (!justFilledSlotLabel) {
      return;
    }
    const timer = window.setTimeout(() => setJustFilledSlotLabel(null), 400);
    return () => window.clearTimeout(timer);
  }, [justFilledSlotLabel]);

  useEffect(() => {
    if (log.length === 0) {
      setLatestPickOverall(null);
      return;
    }
    const latestPick = log[log.length - 1]?.overallPick ?? null;
    setLatestPickOverall(latestPick);
    const timer = window.setTimeout(() => {
      setLatestPickOverall((current) => (current === latestPick ? null : current));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [log]);

  useEffect(() => {
    if (phase !== 'draft' || pickIdx >= draftSlots.length) {
      prevUserTurnRef.current = false;
      return;
    }
    const isUserTurn = draftSlots[pickIdx]?.team === userTeam;
    if (isUserTurn && !prevUserTurnRef.current) {
      setIsYourTurnEntering(true);
    }
    prevUserTurnRef.current = isUserTurn;
  }, [draftSlots, phase, pickIdx, userTeam]);

  useEffect(() => {
    if (!isYourTurnEntering) {
      return;
    }
    const timer = window.setTimeout(() => setIsYourTurnEntering(false), 800);
    return () => window.clearTimeout(timer);
  }, [isYourTurnEntering]);

  useEffect(() => {
    if (phase !== 'draft') {
      hasDraftMountedRef.current = false;
      setIsListResorting(false);
      return;
    }
    if (!hasDraftMountedRef.current) {
      hasDraftMountedRef.current = true;
      return;
    }
    setIsListResorting(true);
    const timer = window.setTimeout(() => setIsListResorting(false), 200);
    return () => window.clearTimeout(timer);
  }, [filter, phase, searchQuery, sortBy]);

  const startSeason = useCallback(() => {
    if (!pack) {
      return;
    }
    setPhase('season_load');
    setSeasonErr(null);
    fetch('/data/mgr_season_data.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data: SeasonData) => {
        const zScores = computeQualZ(rosters, pack.players);
        const seasonStats = runSeasonStats(data.regular_season, zScores);
        setBpmZ(zScores);
        setSeasonData(data);
        setStats(seasonStats);
        setPhase('season');
      })
      .catch((error: unknown) => {
        setSeasonErr(String(error));
        setPhase('complete');
      });
  }, [pack, rosters]);

  const handleAnimatedUserPick = useCallback((playerIdx: number) => {
    if (phase !== 'draft' || !pack || justDraftedPlayerIdx !== null) {
      return;
    }
    const slot = draftSlots[pickIdx];
    if (!slot || slot.team !== userTeam) {
      return;
    }
    const req = getReq(pack.config);
    const slotLabel = resolveFilledSlotLabel(rosters[userTeam] ?? [], pack.players, req, playerIdx);
    setJustDraftedPlayerIdx(playerIdx);

    window.setTimeout(() => {
      recordPick(pickIdx, playerIdx, draftSlots);
      setJustDraftedPlayerIdx(null);
      setJustFilledSlotLabel(slotLabel);
    }, 550);
  }, [draftSlots, justDraftedPlayerIdx, pack, phase, pickIdx, recordPick, rosters, userTeam]);

  if (phase === 'loading') {
    return (
      <div className="mgr-page">
        <div className="mgr-loading">
          {fetchErr ? (
            <>
              <p className="mgr-error">{fetchErr}</p>
              <p className="mgr-hint">Run `manager_mode.py` cell 2 to generate the draft pack.</p>
            </>
          ) : (
            <p className="mgr-hint">Loading draft pack...</p>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'season_load') {
    return (
      <div className="mgr-page">
        <div className="mgr-loading">
          <p className="mgr-hint">Loading season data...</p>
          {seasonErr ? <p className="mgr-error">{seasonErr}</p> : null}
        </div>
      </div>
    );
  }

  if (phase === 'select') {
    return (
      <div className="mgr-page">
        <SelectView
          pack={pack!}
          userTeam={userTeam}
          onSelect={startDraft}
          isExiting={selectionTransition === 'exiting'}
        />
      </div>
    );
  }

  if (phase === 'draft') {
    const currentPack = pack!;
    const slot = draftSlots[pickIdx];
    if (!slot) {
      return null;
    }

    const isUser = slot.team === userTeam;
    const req = getReq(currentPack.config);
    const filled = reqs[userTeam] ?? { G: 0, W: 0, B: 0 };
    const needed = neededBuckets(filled, req);
    const picksLeft = draftSlots.filter((draftSlot) => draftSlot.team === userTeam && draftSlot.overallPick >= slot.overallPick).length;
    const mustPick = isUser && picksLeft <= unfilledCount(filled, req) && needed.length > 0;

    const allAvailablePlayers = currentPack.players.filter((player) => avail.has(player.playerIdx));
    const filteredPlayers = allAvailablePlayers.filter((player) => {
      if (mustPick && !needed.includes(player.bucket as Bkt)) {
        return false;
      }
      if (filter !== 'all' && player.bucket !== filter) {
        return false;
      }
      return true;
    });

    const boardPlayers = [...filteredPlayers]
      .filter((player) => searchMatches(player, searchQuery))
      .sort((playerA, playerB) => comparePlayers(playerA, playerB, sortBy));

    const previewPlayers = [...allAvailablePlayers]
      .sort((playerA, playerB) => comparePlayers(playerA, playerB, 'value'))
      .slice(0, 10);

    const recommendedPlayerIds = new Set(
      [...allAvailablePlayers]
        .filter((player) => (needed.length === 0 ? true : needed.includes(player.bucket as Bkt)))
        .sort((playerA, playerB) => comparePlayers(playerA, playerB, 'value'))
        .slice(0, 3)
        .map((player) => player.playerIdx),
    );

    const recent = [...log].reverse().slice(0, 30);
    const totalPicks = currentPack.config.nTeams * currentPack.config.nRounds;
    const userRoster = rosters[userTeam] ?? [];
    const rosterSlots = buildRosterSlots(userRoster, currentPack.players, req);
    const nextPick = nextUserPick(draftSlots, pickIdx, userTeam);
    const needsLabel = remainingNeedsText(userRoster, currentPack.players, req, currentPack.config.rosterSize);
    const userTeamMeta = TEAM_META_BY_ABBR.get(userTeam);
    const isDraftLocked = justDraftedPlayerIdx !== null;
    const boardShellClassName = ['mgr-board-shell', isYourTurnEntering ? 'player-board--your-turn' : ''].filter(Boolean).join(' ');
    const playerBoardClassName = ['mgr-player-board', isListResorting ? 'player-list--resorting' : ''].filter(Boolean).join(' ');
    const currentTeamLabel = teamCity(slot.team);
    const draftSpeedLabel = aiSpeed < 300 ? 'Fast' : aiSpeed < 800 ? 'Normal' : 'Slow';
    const recommendationLabel = needed.length > 0 ? needed.map(bucketLabel).join(' or ') : 'Best available';

    return (
      <div className={draftEntering ? 'mgr-page mgr-page--draft draft-enter' : 'mgr-page mgr-page--draft'}>
        <div className="mgr-draft-bar">
          <div className="mgr-draft-bar-left">
            <span className="mgr-round-badge">Round {slot.round} of {currentPack.config.nRounds}</span>
            <span className="mgr-pick-counter">Pick <strong>#{slot.overallPick}</strong> / {totalPicks}</span>
          </div>
          <div className="mgr-draft-bar-mid">
            {isUser ? (
              <span className={isYourTurnEntering ? 'mgr-turn-you your-pick-badge--entering' : 'mgr-turn-you'}>Your pick: {userTeam}</span>
            ) : (
              <span className="mgr-turn-ai">{slot.team} is on the clock</span>
            )}
          </div>
          <div className="mgr-draft-bar-right">
            <span className="mgr-progress">{avail.size} players left</span>
            <div className="ai-speed-control">
              <span className="speed-label">Draft Speed</span>
              <input
                type="range"
                min="100"
                max="1500"
                step="100"
                value={aiSpeed}
                className="speed-slider"
                onChange={(event: { target: HTMLInputElement }) => setAiSpeed(Number(event.target.value))}
              />
              <span className="speed-value">{draftSpeedLabel}</span>
            </div>
          </div>
        </div>

        <div className="draft-layout">
          <aside className="your-roster-panel">
            <div className="mgr-roster-team">
              <span className="mgr-roster-team-logo">
                {userTeamMeta ? (
                  <>
                    <img
                      className="franchise-logo"
                      src={userTeamMeta.logoUrl}
                      alt={userTeam}
                      loading="lazy"
                      onError={(event: { currentTarget: HTMLImageElement }) => {
                        event.currentTarget.style.display = 'none';
                        const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;

                        if (fallback) {
                          fallback.style.display = 'flex';
                        }
                      }}
                    />
                    <span className="logo-fallback mgr-roster-team-fallback" style={{ display: 'none' }}>
                      {userTeam}
                    </span>
                  </>
                ) : (
                  <span className="logo-fallback mgr-roster-team-fallback">{userTeam}</span>
                )}
              </span>
              <div className="mgr-roster-header">
                <h4 className="roster-panel-title">
                  Your Roster <span className="roster-count">{userRoster.length}/{currentPack.config.rosterSize}</span>
                </h4>
                <p className="roster-panel-kicker">{userTeamMeta ? userTeamMeta.name : userTeam}</p>
              </div>
            </div>

            <div className="mgr-roster-group">
              <span className="roster-section-label">Starters</span>
              {rosterSlots.starters.map((renderSlot) => (
                <div
                  key={renderSlot.label}
                  className={justFilledSlotLabel === renderSlot.label ? 'roster-slot roster-slot--just-filled' : 'roster-slot'}
                >
                  <span
                    className={
                      renderSlot.bucket
                        ? `slot-label roster-slot-label ${bucketClass(renderSlot.bucket)}`
                        : 'slot-label roster-slot-label'
                    }
                  >
                    {renderSlot.label}
                  </span>
                  {renderSlot.player ? <PlayerAvatar player={renderSlot.player} size={28} /> : <span className="roster-slot-spacer" aria-hidden="true" />}
                  <span className={renderSlot.player ? 'slot-name roster-slot-player' : 'slot-name roster-slot-player empty'}>
                    {renderSlot.player?.playerName ?? '—'}
                  </span>
                </div>
              ))}
            </div>

            <div className="mgr-roster-group">
              <span className="roster-section-label">Bench</span>
              {rosterSlots.bench.map((renderSlot) => (
                <div
                  key={renderSlot.label}
                  className={justFilledSlotLabel === renderSlot.label ? 'roster-slot roster-slot--just-filled' : 'roster-slot'}
                >
                  <span className="slot-label roster-slot-label bench">{renderSlot.label}</span>
                  {renderSlot.player ? <PlayerAvatar player={renderSlot.player} size={28} /> : <span className="roster-slot-spacer" aria-hidden="true" />}
                  <span className={renderSlot.player ? 'slot-name roster-slot-player' : 'slot-name roster-slot-player empty'}>
                    {renderSlot.player?.playerName ?? '—'}
                  </span>
                </div>
              ))}
            </div>

            <div className="roster-needs-box">Need: {needsLabel}</div>
            {mustPick ? (
              <p className="mgr-must-alert">This pick must fill: <strong>{needed.map(bucketLabel).join(' or ')}</strong></p>
            ) : null}
          </aside>

          <section className="mgr-draft-main">
            {isUser ? (
              <>
                <div className={boardShellClassName}>
                  <div className="mgr-board-header">
                    <div>
                      <p className="mgr-panel-title">Draft Board</p>
                      <p className="mgr-board-meta">
                        {boardPlayers.length} available
                        {recommendedPlayerIds.size > 0 ? ` • Recommended for ${recommendationLabel}` : ''}
                      </p>
                    </div>
                  </div>

                  <input
                    className="player-search"
                    type="text"
                    placeholder="Search players..."
                    value={searchQuery}
                    onChange={(event: { target: HTMLInputElement }) => setSearchQuery(event.target.value)}
                    disabled={isDraftLocked}
                  />

                  <div className="player-sort-bar">
                    <span className="sort-label">Sort:</span>
                    {PLAYER_SORTS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={sortBy === option.id ? 'sort-btn active' : 'sort-btn'}
                        onClick={() => setSortBy(option.id)}
                        disabled={isDraftLocked}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="player-sort-bar">
                    <span className="sort-label">Filter:</span>
                    {POSITION_FILTERS.map((option) => {
                      const disabled = mustPick && option !== 'all' && !needed.includes(option as Bkt);
                      const label = option === 'all' ? 'All' : option === 'G' ? 'Guards' : option === 'W' ? 'Wings' : 'Bigs';
                      const classNames = ['sort-btn', filter === option ? 'active' : '', disabled ? 'sort-btn--dim' : '']
                        .filter(Boolean)
                        .join(' ');

                      return (
                        <button
                          key={option}
                          type="button"
                          className={`${classNames} filter-btn`}
                          onClick={() => setFilter(option)}
                          disabled={disabled || isDraftLocked}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={playerBoardClassName}>
                  <div className="board-legend">
                    <span className="legend-item">
                      <span className="rec-badge" title="Recommended — fills a position you need">★ REC</span>
                      Fills a position you need
                    </span>
                  </div>

                  <div className="player-list-header player-list-header--board">
                    <span aria-hidden="true" />
                    <span>Pos</span>
                    <span className="player-list-header__name">Player</span>
                    <span className="player-list-header__metric" title="Oracle projected value added. Higher is better, with elite players usually landing around +3 to +5.">Value</span>
                    <span className="player-list-header__metric" title="Average Draft Position. Lower means the player typically comes off the board earlier.">ADP</span>
                    <span aria-hidden="true" />
                  </div>

                  {boardPlayers.map((player) => (
                    <button
                      key={player.playerIdx}
                      type="button"
                      className={[
                        'player-row',
                        'player-row--board',
                        player.playerIdx === justDraftedPlayerIdx ? 'player-row--drafted' : '',
                        recommendedPlayerIds.has(player.playerIdx) ? 'recommended' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => handleAnimatedUserPick(player.playerIdx)}
                      disabled={isDraftLocked}
                    >
                      <div className="player-avatar-cell">
                        <PlayerAvatar
                          player={player}
                          size={48}
                          imgClassName={`player-headshot player-headshot--board ${bucketClass(player.bucket as Bkt)}`}
                          fallbackClassName="player-initials-fallback player-initials-fallback--board"
                        />
                      </div>
                      <span className={`player-pos-badge player-pos-badge--board ${bucketClass(player.bucket as Bkt)}`}>{player.bucket}</span>
                      <div className="player-name-cell player-name-cell--board">
                        <span className="player-name player-name--board">{player.playerName}</span>
                        <span className="player-team-sub player-team-sub--board">{player.teamAbbr}</span>
                      </div>
                      <span className={`player-value player-value--board ${valueTierClass(player.qualC)}`}>{formatOracleValue(player.qualC)}</span>
                      <span className="player-adp">{player.adp != null ? player.adp.toFixed(1) : '—'}</span>
                      <span className="player-rec-cell">
                        {recommendedPlayerIds.has(player.playerIdx) ? (
                          <span className="rec-badge" title="Recommended — fills a position you need">★ REC</span>
                        ) : null}
                      </span>
                    </button>
                  ))}

                  {boardPlayers.length === 0 ? (
                    <div className="mgr-board-empty">
                      <p>No players match your current search and filter.</p>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="mgr-ai-center">
                <div className="ai-turn-info">
                  <p className="ai-turn-message">{currentTeamLabel} is on the clock <span className="thinking-dot" /></p>
                  <p className="ai-turn-countdown">
                    {nextPick
                      ? `Your next pick: #${nextPick.slot.overallPick} (in ${nextPick.picksUntil} pick${nextPick.picksUntil === 1 ? '' : 's'})`
                      : 'Your draft is complete. Watch the board finish.'}
                  </p>
                </div>

                <div className="mgr-ai-preview">
                  <div className="mgr-panel-title">Best Available</div>
                  <div className="player-list-header">
                    <span aria-hidden="true" />
                    <span>Pos</span>
                    <span className="player-list-header__name">Player</span>
                    <span className="player-list-header__metric">Value</span>
                    <span className="player-list-header__metric">ADP</span>
                    <span aria-hidden="true" />
                  </div>
                  {previewPlayers.map((player) => (
                    <div key={player.playerIdx} className="player-row player-row--preview">
                      <div className="player-avatar-cell">
                        <PlayerAvatar
                          player={player}
                          size={44}
                          imgClassName="player-headshot"
                          fallbackClassName="player-initials-fallback"
                        />
                      </div>
                      <span className={`player-pos-badge ${bucketClass(player.bucket as Bkt)}`}>{player.bucket}</span>
                      <div className="player-name-cell">
                        <span className="player-name">{player.playerName}</span>
                        <span className="player-team-sub">{player.teamAbbr}</span>
                      </div>
                      <span className="player-value">{formatOracleValue(player.qualC)}</span>
                      <span className="player-adp">{player.adp != null ? player.adp.toFixed(1) : '—'}</span>
                      <span className="player-rec-cell" aria-hidden="true" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="mgr-draft-side">
            <div className="mgr-panel-title">Recent Picks</div>
            <div className="recent-picks-list">
              {recent.map((pick) => (
                <div
                  key={pick.overallPick}
                  className={[
                    'recent-pick',
                    pick.isUser ? 'recent-pick--you' : '',
                    latestPickOverall === pick.overallPick ? 'recent-pick--new' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="pick-number-cell">
                    <span className="pick-round">R{pick.round}</span>
                    <span className="pick-num">#{pick.overallPick}</span>
                  </div>
                  <div className="pick-headshot-cell">
                    {playersByIdx.get(pick.playerIdx) ? (
                      <PlayerAvatar
                        player={playersByIdx.get(pick.playerIdx)!}
                        size={32}
                        imgClassName="pick-headshot"
                        fallbackClassName="pick-initials"
                      />
                    ) : (
                      <span className="pick-initials">?</span>
                    )}
                  </div>
                  <div className="pick-details">
                    <span className="pick-player-name">{pick.playerName}</span>
                    <div className="pick-meta">
                      {teamLogoUrl(pick.team) ? (
                        <img
                          className="pick-team-logo"
                          src={teamLogoUrl(pick.team) ?? undefined}
                          alt={pick.team}
                          loading="lazy"
                          onError={(event: { currentTarget: HTMLImageElement }) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                      <span className="pick-team-abbr">{pick.team}</span>
                    </div>
                  </div>
                  <span className={`pick-pos-badge player-pos-badge ${bucketClass(pick.bucket as Bkt)}`}>{pick.bucket}</span>
                </div>
              ))}
              {log.length === 0 ? <p className="mgr-empty">Draft starting...</p> : null}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (phase === 'season' && seasonData) {
    return (
      <div className="mgr-page">
        <SeasonView
          pack={pack!}
          userTeam={userTeam}
          rosters={rosters}
          seasonData={seasonData}
          stats={stats}
          qualZ={qualZ}
          activeTab={seasonTab}
          onTabChange={setSeasonTab}
        />
      </div>
    );
  }

  return (
    <div className="mgr-page">
      <CompleteView
        pack={pack!}
        userTeam={userTeam}
        rosters={rosters}
        log={log}
        onStartSeason={startSeason}
        seasonErr={seasonErr}
      />
    </div>
  );
}

function SelectView({
  pack,
  userTeam,
  onSelect,
  isExiting,
}: {
  pack: DraftPack;
  userTeam: string;
  onSelect: (team: string) => void;
  isExiting: boolean;
}) {
  const teams = useMemo(
    () => [...pack.teams].sort((teamA, teamB) => {
      const metaA = TEAM_META_BY_ABBR.get(teamA);
      const metaB = TEAM_META_BY_ABBR.get(teamB);
      return (metaA?.city ?? teamA).localeCompare(metaB?.city ?? teamB);
    }),
    [pack.teams],
  );

  return (
    <div className={isExiting ? 'mgr-select franchise-exit' : 'mgr-select'}>
      <section className="manager-intro">
        <h2>Choose Your Franchise</h2>
        <p>Pick a team. Draft 8 players. Compete against 29 AI GMs in a snake draft.</p>
        <div className="manager-meta">
          <span>{pack.config.nRounds} rounds</span>
          <span>&middot;</span>
          <span>5 starters + 3 bench</span>
          <span>&middot;</span>
          <span>{pack.season} season</span>
        </div>
      </section>

      <div className="franchise-grid">
        {teams.map((abbr, index) => {
          const team = TEAM_META_BY_ABBR.get(abbr);
          const displayName = team?.city ?? abbr;
          const className = userTeam === abbr
            ? 'franchise-card franchise-card--entering selected'
            : 'franchise-card franchise-card--entering';

          return (
            <button
              key={abbr}
              type="button"
              className={className}
              onClick={() => onSelect(abbr)}
              disabled={isExiting}
              style={{ animationDelay: `${index * 25}ms` }}
            >
              <span className="franchise-logo-wrap">
                {team ? (
                  <>
                    <img
                      className="franchise-logo"
                      src={team.logoUrl}
                      alt={abbr}
                      loading="lazy"
                      onError={(event: { currentTarget: HTMLImageElement }) => {
                        event.currentTarget.style.display = 'none';
                        const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;

                        if (fallback) {
                          fallback.style.display = 'flex';
                        }
                      }}
                    />
                    <span className="logo-fallback franchise-logo-fallback" style={{ display: 'none' }}>
                      {abbr}
                    </span>
                  </>
              ) : (
                <span className="logo-fallback franchise-logo-fallback">{abbr}</span>
              )}
              </span>
              <span className="franchise-city">{displayName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompleteView({
  pack,
  userTeam,
  rosters,
  log,
  onStartSeason,
  seasonErr,
}: {
  pack: DraftPack;
  userTeam: string;
  rosters: Record<string, number[]>;
  log: PickRecord[];
  onStartSeason: () => void;
  seasonErr: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const req = getReq(pack.config);
  const userPicks = log.filter((pick) => pick.team === userTeam).sort((pickA, pickB) => pickA.overallPick - pickB.overallPick);
  const userTeamMeta = TEAM_META_BY_ABBR.get(userTeam);
  const projection = buildTeamProjection(userTeam, rosters, pack.players);
  const rosterSections = (() => {
    const counts: Req = { G: 0, W: 0, B: 0 };
    const starters: Array<PickRecord & { value: number }> = [];
    const bench: Array<PickRecord & { value: number }> = [];

    userPicks.forEach((pick) => {
      const bucket = pick.bucket as Bkt;
      const isStarter = counts[bucket] < req[bucket];
      counts[bucket] += 1;
      const enrichedPick = { ...pick, value: pack.players[pick.playerIdx]?.qualC ?? 0 };

      if (isStarter) {
        starters.push(enrichedPick);
      } else {
        bench.push(enrichedPick);
      }
    });

    return { starters, bench };
  })();

  return (
    <div className="mgr-complete">
      <section className="draft-complete-header">
        <p className="dc-eyebrow">Draft Complete</p>
        <div className="dc-team-identity">
          {userTeamMeta ? (
            <img className="dc-team-logo" src={userTeamMeta.logoUrl} alt={userTeamMeta.abbr} loading="lazy" />
          ) : (
            <span className="logo-fallback dc-team-logo-fallback">{userTeam}</span>
          )}
          <h2 className="dc-team-name">{teamDisplayName(userTeam)}</h2>
        </div>
        <p className="dc-subtitle">Your {pack.config.rosterSize}-player roster is locked in.</p>
        {seasonErr ? <p className="mgr-error mgr-error--inline">{seasonErr}</p> : null}
        <button type="button" className="mgr-start-btn" onClick={onStartSeason}>
          Simulate Season &rarr;
        </button>
      </section>

      <section className="mgr-complete-body">
        {projection ? (
          <div className="dc-projection">
            <div className="dc-projection-item">
              <span className="dc-proj-value">{projection.projectedWins}-{projection.projectedLosses}</span>
              <span className="dc-proj-label">Proj. Record</span>
            </div>
            <div className="dc-projection-divider" />
            <div className="dc-projection-item">
              <span className="dc-proj-value">#{projection.seed}</span>
              <span className="dc-proj-label">Proj. Seed</span>
            </div>
            <div className="dc-projection-divider" />
            <div className="dc-projection-item">
              <span className="dc-proj-value">{projection.titleOdds.toFixed(1)}%</span>
              <span className="dc-proj-label">Title Odds</span>
            </div>
          </div>
        ) : null}

        <div className="dc-roster">
          <div className="dc-roster-section">
            <h4 className="dc-section-label">Starters</h4>
            {rosterSections.starters.map((pick, index) => (
              <div className="dc-player-card" style={{ animationDelay: `${index * 80}ms` }} key={pick.overallPick}>
                <div className="dc-player-headshot-wrap">
                  <PlayerAvatar
                    player={pack.players[pick.playerIdx]}
                    size={48}
                    imgClassName="dc-player-headshot"
                    fallbackClassName="dc-player-initials"
                  />
                  <span className={`dc-pos-badge ${pick.bucket.toLowerCase()}`}>{pick.bucket}</span>
                </div>
                <div className="dc-player-info">
                  <span className="dc-player-name">{pick.playerName}</span>
                  <div className="dc-player-meta">
                    {teamLogoUrl(pick.teamAbbr) ? (
                      <img className="dc-player-team-logo" src={teamLogoUrl(pick.teamAbbr) ?? undefined} alt={pick.teamAbbr} loading="lazy" />
                    ) : null}
                    <span className="dc-player-team">{pick.teamAbbr}</span>
                    <span className="dc-player-draft">R{pick.round} · #{pick.overallPick}</span>
                  </div>
                </div>
                <div className="dc-player-value">
                  <span className="dc-value-num">{formatOracleValue(pick.value)}</span>
                  <span className="dc-value-label">Value</span>
                </div>
              </div>
            ))}
          </div>

          <div className="dc-roster-section">
            <h4 className="dc-section-label">Bench</h4>
            {rosterSections.bench.map((pick, index) => (
              <div className="dc-player-card" style={{ animationDelay: `${(rosterSections.starters.length + index) * 80}ms` }} key={pick.overallPick}>
                <div className="dc-player-headshot-wrap">
                  <PlayerAvatar
                    player={pack.players[pick.playerIdx]}
                    size={48}
                    imgClassName="dc-player-headshot"
                    fallbackClassName="dc-player-initials"
                  />
                  <span className={`dc-pos-badge ${pick.bucket.toLowerCase()}`}>{pick.bucket}</span>
                </div>
                <div className="dc-player-info">
                  <span className="dc-player-name">{pick.playerName}</span>
                  <div className="dc-player-meta">
                    {teamLogoUrl(pick.teamAbbr) ? (
                      <img className="dc-player-team-logo" src={teamLogoUrl(pick.teamAbbr) ?? undefined} alt={pick.teamAbbr} loading="lazy" />
                    ) : null}
                    <span className="dc-player-team">{pick.teamAbbr}</span>
                    <span className="dc-player-draft">R{pick.round} · #{pick.overallPick}</span>
                  </div>
                </div>
                <div className="dc-player-value">
                  <span className="dc-value-num">{formatOracleValue(pick.value)}</span>
                  <span className="dc-value-label">Value</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button type="button" className="show-rosters-btn" onClick={() => setShowAll((current) => !current)}>
          {showAll ? 'Hide All 30 Rosters' : 'Show All 30 Rosters'}
        </button>
        {showAll ? (
          <div className="mgr-all-grid">
            {[...pack.teams].sort().map((team) => {
              const teamPicks = log.filter((pick) => pick.team === team).sort((pickA, pickB) => pickA.overallPick - pickB.overallPick);
              return (
                <div key={team} className={team === userTeam ? 'mgr-team-card mgr-team-card--you' : 'mgr-team-card'}>
                  <div className="mgr-team-card-hdr">{team}{team === userTeam ? ' (You)' : ''}</div>
                  <div className="mgr-chip-row">
                    {teamPicks.map((pick) => (
                      <span key={pick.overallPick} className={`mgr-chip mgr-chip-${pick.bucket}`}>
                        {pick.playerName}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SeasonView({
  pack,
  userTeam,
  rosters,
  seasonData,
  stats,
  qualZ,
  activeTab,
  onTabChange,
}: {
  pack: DraftPack;
  userTeam: string;
  rosters: Record<string, number[]>;
  seasonData: SeasonData;
  stats: Record<string, TeamStat>;
  qualZ: Record<string, number>;
  activeTab: 'standings' | 'schedule';
  onTabChange: (tab: 'standings' | 'schedule') => void;
}) {
  const projection = buildTeamProjection(userTeam, rosters, pack.players);
  const myBpmZ = qualZ[userTeam];
  const bpmLabel = getBpmLabel(myBpmZ ?? 0);
  const summaryText = projection
    ? `Projected Record: ${projection.projectedWins}-${projection.projectedLosses} · ${projection.seed}${projection.seed === 1 ? 'st' : projection.seed === 2 ? 'nd' : projection.seed === 3 ? 'rd' : 'th'} Seed ${projection.conference} · ${projection.titleOdds.toFixed(1)}% Title Odds`
    : `Roster Strength: ${bpmLabel.label}`;

  return (
    <div className="mgr-season">
      <section className="mgr-select-hero">
        <p className="mgr-eyebrow">Manager Mode - Season Simulation</p>
        <h1 className="mgr-title">{userTeam}</h1>
        <div className="mgr-season-stats-row">
          <span
            className="mgr-stat-badge mgr-stat-badge--summary"
            title={myBpmZ != null ? `Lineup BPM-Z: ${myBpmZ >= 0 ? '+' : ''}${myBpmZ.toFixed(2)}` : 'Lineup BPM-Z unavailable'}
            style={!projection ? { color: bpmLabel.color } : undefined}
          >
            {summaryText}
          </span>
        </div>
      </section>

      <div className="mgr-season-tabs">
        <button type="button" className={activeTab === 'standings' ? 'mgr-stab mgr-stab--on' : 'mgr-stab'} onClick={() => onTabChange('standings')}>
          Standings
        </button>
        <button type="button" className={activeTab === 'schedule' ? 'mgr-stab mgr-stab--on' : 'mgr-stab'} onClick={() => onTabChange('schedule')}>
          Schedule
        </button>
      </div>

      {activeTab === 'standings' ? <StandingsPanel seasonData={seasonData} stats={stats} userTeam={userTeam} /> : null}
      {activeTab === 'schedule' ? <SchedulePanel seasonData={seasonData} userTeam={userTeam} qualZ={qualZ} /> : null}
    </div>
  );
}

function StandingsPanel({
  seasonData,
  stats: _stats,
  userTeam,
}: {
  seasonData: SeasonData;
  stats: Record<string, TeamStat>;
  userTeam: string;
}) {
  const allTeams = [...new Set(seasonData.regular_season.flatMap((game) => [game.t1, game.t2]))];

  function confTable(conf: Set<string>, label: string) {
    const teams = allTeams.filter((team) => conf.has(team)).sort();
    if (!teams.length) {
      return null;
    }

    return (
      <div className="mgr-conf-block">
        <div className="mgr-conf-label">{label}</div>
        <table className="mgr-standings-table">
          <thead>
            <tr>
              <th className="mgr-th-left">Team</th>
              <th>Proj W</th>
              <th>PO%</th>
              <th>Champ%</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const isUser = team === userTeam;
              return (
                <tr key={team} className={isUser ? 'mgr-tr-you' : ''}>
                  <td className="mgr-th-left mgr-td-name">{isUser ? '▶ ' : ''}{team}</td>
                  <td className="mgr-td-num mgr-po-lo">—</td>
                  <td className="mgr-td-num mgr-po-lo">—</td>
                  <td className="mgr-td-num mgr-po-lo">—</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="mgr-standings-wrap">
      {confTable(EAST, 'Eastern Conference')}
      {confTable(WEST, 'Western Conference')}
      <p className="mgr-standings-note">Season projections coming soon.</p>
    </div>
  );
}

function SchedulePanel({
  seasonData,
  userTeam,
  qualZ,
}: {
  seasonData: SeasonData;
  userTeam: string;
  qualZ: Record<string, number>;
}) {
  const [showAllGames, setShowAllGames] = useState(true);
  const byDate: Record<string, SeasonGame[]> = {};
  for (const game of seasonData.regular_season) {
    if (!byDate[game.date]) {
      byDate[game.date] = [];
    }
    byDate[game.date].push(game);
  }

  const dates = Object.keys(byDate).sort();
  const visibleDates = dates
    .map((date) => ({
      date,
      games: byDate[date]
        .filter((game) => showAllGames || game.t1 === userTeam || game.t2 === userTeam)
        .sort((gameA, gameB) => gameA.gid - gameB.gid),
    }))
    .filter(({ games }) => games.length > 0);

  const strengthLabel = getBpmLabel(qualZ[userTeam] ?? 0);
  if (!dates.length) {
    return (
      <div className="mgr-schedule-wrap">
        <p className="mgr-empty">No schedule data.</p>
      </div>
    );
  }

  return (
    <div className="mgr-schedule-wrap">
      <div className="schedule-filter">
        <button type="button" className={showAllGames ? 'filter-btn active' : 'filter-btn'} onClick={() => setShowAllGames(true)}>
          All Games
        </button>
        <button type="button" className={!showAllGames ? 'filter-btn active' : 'filter-btn'} onClick={() => setShowAllGames(false)}>
          My Games
        </button>
      </div>
      <p className="mgr-schedule-strength" title={qualZ[userTeam] != null ? `Lineup BPM-Z: ${qualZ[userTeam] >= 0 ? '+' : ''}${qualZ[userTeam].toFixed(2)}` : 'Lineup BPM-Z unavailable'}>
        Roster Strength: <span style={{ color: strengthLabel.color }}>{strengthLabel.label}</span>
      </p>
      {visibleDates.map(({ date, games }) => {
        const label = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        return (
          <div key={date} className="mgr-sched-day">
            <div className="sim-date-header">
              {label}
              <span className="sim-date-count">{games.length} games</span>
            </div>
            <div className="mgr-sched-grid">
              {games.map((game) => {
                const qualDiff = (qualZ[game.t1] ?? 0) - (qualZ[game.t2] ?? 0);
                const p1 = interpWP(game.wp, qualDiff);
                const p2 = 1 - p1;
                const isUserGame = game.t1 === userTeam || game.t2 === userTeam;
                const userIsT1 = game.t1 === userTeam;

                return (
                  <div key={game.gid} className={isUserGame ? 'mgr-matchup mgr-matchup--you' : 'mgr-matchup'}>
                    <span className={userIsT1 ? 'mgr-mu-team mgr-mu-team--you' : 'mgr-mu-team'}>
                      {teamLogoUrl(game.t1) ? <img className="chip-logo" src={teamLogoUrl(game.t1) ?? undefined} alt={game.t1} loading="lazy" /> : null}
                      {game.t1}
                    </span>
                    <span className="mgr-mu-prob">{(p1 * 100).toFixed(0)}%</span>
                    <span className="mgr-mu-vs">vs</span>
                    <span className="mgr-mu-prob">{(p2 * 100).toFixed(0)}%</span>
                    <span className={!userIsT1 && game.t2 === userTeam ? 'mgr-mu-team mgr-mu-team--you' : 'mgr-mu-team'}>
                      {teamLogoUrl(game.t2) ? <img className="chip-logo" src={teamLogoUrl(game.t2) ?? undefined} alt={game.t2} loading="lazy" /> : null}
                      {game.t2}
                      {game.loc === 1 ? <span className="mgr-mu-home"> H</span> : null}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
