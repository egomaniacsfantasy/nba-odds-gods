// Auto-generated standings.ts — do not edit manually
// Updated: 2026-03-26
// Full NBA tiebreaker: H2H → div leader → div record → conf record → random
// Matches Python CELL 12 _tiebreak() exactly.
import type { LockedPicks, NbaGame, NbaTeam, StandingsRow } from '../types';

function _wlPct(w: number, l: number): number {
  return w + l > 0 ? w / (w + l) : 0;
}

function _h2hKey(a: number, b: number): string {
  return `${Math.min(a, b)}:${Math.max(a, b)}`;
}

function _h2hWinPct(h2h: Map<string, [number, number]>, tid: number, group: number[]): number {
  let w = 0; let total = 0;
  for (const opp of group) {
    if (opp === tid) continue;
    const key = _h2hKey(tid, opp);
    const rec = h2h.get(key);
    if (rec) {
      const tw = tid < opp ? rec[0] : rec[1];
      const tl = tid < opp ? rec[1] : rec[0];
      w += tw; total += tw + tl;
    }
  }
  return total > 0 ? w / total : 0;
}

interface _SimState {
  wins: number; losses: number;
  confWins: number; confLosses: number;
  divWins: number; divLosses: number;
}

function _computeDivLeaders(
  teams: NbaTeam[],
  state: Map<number, _SimState>,
): Set<number> {
  const byDiv = new Map<string, number[]>();
  for (const t of teams) {
    const g = byDiv.get(t.division) ?? [];
    g.push(t.id);
    byDiv.set(t.division, g);
  }
  const leaders = new Set<number>();
  for (const members of byDiv.values()) {
    const maxW = Math.max(...members.map((id) => state.get(id)!.wins));
    const top = members.filter((id) => state.get(id)!.wins === maxW);
    if (top.length === 1) { leaders.add(top[0]); continue; }
    const minL = Math.min(...top.map((id) => state.get(id)!.losses));
    const final = top.filter((id) => state.get(id)!.losses === minL);
    if (final.length === 1) leaders.add(final[0]);
  }
  return leaders;
}

function _tiebreak(
  group: number[],
  state: Map<number, _SimState>,
  h2h: Map<string, [number, number]>,
  divLeaders: Set<number>,
  divMap: Map<number, string>,
  random: () => number,
): number[] {
  if (group.length <= 1) return [...group];

  // Step 1: H2H win% among tied group (remaining schedule only)
  const h2hPcts = group.map((t) => Math.round(_h2hWinPct(h2h, t, group) * 1e8));
  if (new Set(h2hPcts).size > 1) {
    const buckets = new Map<number, number[]>();
    group.forEach((t, i) => { buckets.set(h2hPcts[i], [...(buckets.get(h2hPcts[i]) ?? []), t]); });
    const result: number[] = [];
    for (const k of [...buckets.keys()].sort((a, b) => b - a)) {
      result.push(..._tiebreak(buckets.get(k)!, state, h2h, divLeaders, divMap, random));
    }
    return result;
  }

  // Step 2: Division leader status
  const nLead = group.filter((t) => divLeaders.has(t)).length;
  if (nLead > 0 && nLead < group.length) {
    const lead = group.filter((t) => divLeaders.has(t));
    const rest = group.filter((t) => !divLeaders.has(t));
    return [
      ..._tiebreak(lead, state, h2h, divLeaders, divMap, random),
      ..._tiebreak(rest, state, h2h, divLeaders, divMap, random),
    ];
  }

  // Step 3: Division record (only when all in same division)
  const divs = new Set(group.map((t) => divMap.get(t) ?? ''));
  if (divs.size === 1) {
    const divPcts = group.map((t) => {
      const s = state.get(t)!;
      return Math.round(_wlPct(s.divWins, s.divLosses) * 1e8);
    });
    if (new Set(divPcts).size > 1) {
      const buckets = new Map<number, number[]>();
      group.forEach((t, i) => { buckets.set(divPcts[i], [...(buckets.get(divPcts[i]) ?? []), t]); });
      const result: number[] = [];
      for (const k of [...buckets.keys()].sort((a, b) => b - a)) {
        result.push(..._tiebreak(buckets.get(k)!, state, h2h, divLeaders, divMap, random));
      }
      return result;
    }
  }

  // Step 4: Conference record
  const confPcts = group.map((t) => {
    const s = state.get(t)!;
    return Math.round(_wlPct(s.confWins, s.confLosses) * 1e8);
  });
  if (new Set(confPcts).size > 1) {
    const buckets = new Map<number, number[]>();
    group.forEach((t, i) => { buckets.set(confPcts[i], [...(buckets.get(confPcts[i]) ?? []), t]); });
    const result: number[] = [];
    for (const k of [...buckets.keys()].sort((a, b) => b - a)) {
      result.push(..._tiebreak(buckets.get(k)!, state, h2h, divLeaders, divMap, random));
    }
    return result;
  }

  // Step 5: Random (Fisher-Yates with sim RNG — matches Python random.shuffle)
  const shuffled = [...group];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function _seedConference(
  confTeams: NbaTeam[],
  state: Map<number, _SimState>,
  h2h: Map<string, [number, number]>,
  random: () => number,
): StandingsRow[] {
  const divLeaders = _computeDivLeaders(confTeams, state);
  const divMap = new Map(confTeams.map((t) => [t.id, t.division]));

  // Sort: wins desc, losses asc — group ties together
  const sorted = [...confTeams].sort((a, b) => {
    const sa = state.get(a.id)!; const sb = state.get(b.id)!;
    if (sb.wins !== sa.wins) return sb.wins - sa.wins;
    return sa.losses - sb.losses;
  });

  const result: number[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    const si = state.get(sorted[i].id)!;
    while (j < sorted.length) {
      const sj = state.get(sorted[j].id)!;
      if (sj.wins !== si.wins || sj.losses !== si.losses) break;
      j++;
    }
    result.push(..._tiebreak(
      sorted.slice(i, j).map((t) => t.id),
      state, h2h, divLeaders, divMap, random,
    ));
    i = j;
  }

  const best = state.get(result[0])!.wins;
  return result.map((teamId, idx) => {
    const s = state.get(teamId)!;
    const seed = idx + 1;
    const seedLbl = seed >= 7 && seed <= 10 ? `${seed} (PI)` : `${seed}`;
    const gb = best - s.wins;
    return {
      teamId,
      wins: s.wins,
      losses: s.losses,
      winPct: _wlPct(s.wins, s.losses),
      confWins: s.confWins,
      confLosses: s.confLosses,
      divWins: s.divWins,
      divLosses: s.divLosses,
      gamesBack: gb,
      projectedSeed: seed <= 10 ? seed : null,
      seedLabel: seedLbl,
    };
  });
}

function _runStandings(
  lockedPicks: LockedPicks,
  schedule: NbaGame[],
  teams: NbaTeam[],
  random: (() => number) | null,
): { east: StandingsRow[]; west: StandingsRow[] } {
  const state = new Map<number, _SimState>(
    teams.map((t) => [t.id, {
      wins: t.wins, losses: t.losses,
      confWins: t.confWins, confLosses: t.confLosses,
      divWins: t.divWins, divLosses: t.divLosses,
    }]),
  );

  const teamConf = new Map(teams.map((t) => [t.id, t.conference]));
  const teamDiv  = new Map(teams.map((t) => [t.id, t.division]));
  const h2h = new Map<string, [number, number]>();

  for (const game of schedule) {
    const homeState = state.get(game.homeTeamId);
    const awayState = state.get(game.awayTeamId);
    if (!homeState || !awayState) continue;

    let homeWins: boolean;
    if (lockedPicks.has(game.gameId)) {
      if (random) random(); // keep RNG stream aligned — consume draw even for locked games
      homeWins = lockedPicks.get(game.gameId) === game.homeTeamId;
    } else if (random) {
      homeWins = random() < game.pHomeWins;
    } else {
      homeWins = game.pHomeWins >= 0.5;
    }

    if (homeWins) { homeState.wins++; awayState.losses++; }
    else          { awayState.wins++; homeState.losses++; }

    const sameConf = teamConf.get(game.homeTeamId) === teamConf.get(game.awayTeamId);
    const sameDiv  = teamDiv.get(game.homeTeamId)  === teamDiv.get(game.awayTeamId);

    if (sameConf) {
      if (homeWins) { homeState.confWins++; awayState.confLosses++; }
      else          { awayState.confWins++; homeState.confLosses++; }
    }
    if (sameDiv) {
      if (homeWins) { homeState.divWins++; awayState.divLosses++; }
      else          { awayState.divWins++; homeState.divLosses++; }
    }

    // Track H2H for remaining games (used in tiebreaker)
    if (random) {
      const lo = Math.min(game.homeTeamId, game.awayTeamId);
      const hi = Math.max(game.homeTeamId, game.awayTeamId);
      const key = _h2hKey(lo, hi);
      const rec: [number, number] = h2h.get(key) ?? [0, 0];
      if (homeWins) {
        if (game.homeTeamId === lo) rec[0]++; else rec[1]++;
      } else {
        if (game.awayTeamId === lo) rec[0]++; else rec[1]++;
      }
      h2h.set(key, rec);
    }
  }

  const rng = random ?? (() => Math.random());
  const east = teams.filter((t) => t.conference === 'East');
  const west = teams.filter((t) => t.conference === 'West');
  return {
    east: _seedConference(east, state, h2h, rng),
    west: _seedConference(west, state, h2h, rng),
  };
}

export function computeSimulatedStandings(
  lockedPicks: LockedPicks,
  schedule: NbaGame[],
  teams: NbaTeam[],
  random: () => number,
): { east: StandingsRow[]; west: StandingsRow[] } {
  return _runStandings(lockedPicks, schedule, teams, random);
}

export function computeProjectedStandings(
  lockedPicks: LockedPicks,
  schedule: NbaGame[],
  teams: NbaTeam[],
): { east: StandingsRow[]; west: StandingsRow[] } {
  return _runStandings(lockedPicks, schedule, teams, null);
}

export function cloneLockedPicks(lockedPicks: LockedPicks): LockedPicks {
  return new Map(lockedPicks);
}

export function groupGamesByDate(schedule: NbaGame[]): Map<string, NbaGame[]> {
  const byDate = new Map<string, NbaGame[]>();
  for (const game of schedule) {
    const games = byDate.get(game.gameDate) ?? [];
    games.push(game);
    byDate.set(game.gameDate, games);
  }
  return byDate;
}
