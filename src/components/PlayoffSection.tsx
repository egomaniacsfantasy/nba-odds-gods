// Auto-generated PlayoffSection.tsx — do not edit manually
// Updated: 2026-03-26
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { DateGroup } from './DateGroup';
import { getMatchupProb } from '../data/nbaMatchupProbs';
import { getPlayinProb } from '../data/nbaPlayinProbs';
import {
  CF_GAME_IDS, FINALS_GAME_ID, PLAYIN_GAME_IDS, R1_GAME_IDS, R2_GAME_IDS,
} from '../lib/simulation';
import type { LockedPicks, NbaGame, NbaTeam, OddsFormat, StandingsRow, TeamAdvancement } from '../types';

interface PlayoffSectionProps {
  lockedPicks: LockedPicks;
  east: StandingsRow[];
  west: StandingsRow[];
  teamsById: Map<number, NbaTeam>;
  advancements: Map<number, TeamAdvancement>;
  allGamesPicked: boolean;
  oddsFormat: OddsFormat;
  justPickedKey: string | null;
  onPick: (gameId: number, teamId: number) => void;
}

// NBA 2-2-1-1-1 format: games 1,2,5,7 at higher seed's arena
const _HS_HOME_R = new Set([1, 2, 5, 7]);

function _mkGame(id: number, date: string, dn: number, hId: number, aId: number, pH: number): NbaGame {
  return { gameId: id, gameDate: date, daynum: dn, homeTeamId: hId, awayTeamId: aId, pHomeWins: pH, isCompleted: false };
}

function _wins(ids: readonly number[], aId: number, bId: number, picks: LockedPicks): [number, number] {
  let aw = 0, bw = 0;
  for (const id of ids) { const p = picks.get(id); if (p === aId) aw++; else if (p === bId) bw++; }
  return [aw, bw];
}

function _buildSeries(
  gameIds: readonly number[], hsId: number | null, lsId: number | null,
  dates: readonly string[], days: readonly number[], picks: LockedPicks,
): NbaGame[] {
  if (!hsId || !lsId) return [];
  const out: NbaGame[] = [];
  for (let i = 0; i < 7; i++) {
    const priorIds = gameIds.slice(0, i);
    const [aw, bw] = _wins(priorIds, hsId, lsId, picks);
    if (aw >= 4 || bw >= 4) break;
    const g = i + 1;
    const hId = _HS_HOME_R.has(g) ? hsId : lsId;
    const aId = _HS_HOME_R.has(g) ? lsId : hsId;
    out.push(_mkGame(gameIds[i], dates[i], days[i], hId, aId, getMatchupProb(hId, aId, 'home')));
  }
  return out;
}

function _seriesDone(gameIds: readonly number[], hsId: number | null, lsId: number | null, picks: LockedPicks): boolean {
  if (!hsId || !lsId) return false;
  const [aw, bw] = _wins(gameIds, hsId, lsId, picks);
  return aw >= 4 || bw >= 4;
}

function _seriesWinner(gameIds: readonly number[], hsId: number | null, lsId: number | null, picks: LockedPicks): number | null {
  if (!hsId || !lsId) return null;
  const [aw, bw] = _wins(gameIds, hsId, lsId, picks);
  return aw >= 4 ? hsId : bw >= 4 ? lsId : null;
}

const _E_R1_DATES: readonly string[] = ['2026-04-19','2026-04-21','2026-04-23','2026-04-25','2026-04-27','2026-04-29','2026-05-01'];
const _W_R1_DATES: readonly string[] = ['2026-04-20','2026-04-22','2026-04-24','2026-04-26','2026-04-28','2026-04-30','2026-05-02'];
const _E_R1_DAYS:  readonly number[] = [180,182,184,186,188,190,192];
const _W_R1_DAYS:  readonly number[] = [181,183,185,187,189,191,193];

// ── PlayoffCard for R2/CF/Finals (series-winner picks, old card style) ────────
function fmt(v: number): string {
  if (v >= 0.995) return '>99%';
  if (v < 0.005) return '<1%';
  return `${Math.round(v * 100)}%`;
}

/** P(hsId wins best-of-7 series, hsId has home court). */
function seriesWinPct(hsId: number, lsId: number): number {
  const pH = getMatchupProb(hsId, lsId, 'home');
  const pA = getMatchupProb(hsId, lsId, 'away');
  const memo = new Map<string, number>();
  function dp(hw: number, lw: number): number {
    if (hw === 4) return 1.0;
    if (lw === 4) return 0.0;
    const k = `${hw}_${lw}`;
    if (memo.has(k)) return memo.get(k)!;
    const p = _HS_HOME_R.has(hw + lw + 1) ? pH : pA;
    const v = p * dp(hw + 1, lw) + (1 - p) * dp(hw, lw + 1);
    memo.set(k, v);
    return v;
  }
  return dp(0, 0);
}

function seriesWinPctNeutral(aId: number, bId: number): number {
  const pN = getMatchupProb(aId, bId, 'neutral');
  const memo = new Map<string, number>();
  function dp(aw: number, bw: number): number {
    if (aw === 4) return 1.0;
    if (bw === 4) return 0.0;
    const k = `${aw}_${bw}`;
    if (memo.has(k)) return memo.get(k)!;
    const v = pN * dp(aw + 1, bw) + (1 - pN) * dp(aw, bw + 1);
    memo.set(k, v);
    return v;
  }
  return dp(0, 0);
}

function PlayoffCard({
  gameId, teamAId, teamBId, label, probA,
  lockedPicks, teamsById, advancements, onPick,
}: {
  gameId: number;
  teamAId: number | null;
  teamBId: number | null;
  label: string;
  probA: number;
  lockedPicks: LockedPicks;
  teamsById: Map<number, NbaTeam>;
  advancements: Map<number, TeamAdvancement>;
  onPick: (gameId: number, teamId: number) => void;
}) {
  const teamA = teamAId != null ? teamsById.get(teamAId) ?? null : null;
  const teamB = teamBId != null ? teamsById.get(teamBId) ?? null : null;
  const picked = lockedPicks.get(gameId);
  const canPick = teamAId != null && teamBId != null;
  const advA = teamAId != null ? advancements.get(teamAId) : null;
  const advB = teamBId != null ? advancements.get(teamBId) : null;
  return (
    <div className={`po-card${picked !== undefined ? ' po-card--picked' : ''}`}>
      <span className="po-card__label">{label}</span>
      <div className="po-card__row">
        <button type="button"
          className={`po-card__team${picked === teamAId ? ' po-card__team--win' : ''}${picked !== undefined && picked !== teamAId ? ' po-card__team--loss' : ''}`}
          onClick={() => canPick && teamAId != null && onPick(gameId, teamAId)} disabled={!canPick}>
          {teamA ? <img className="po-card__logo" src={teamA.logoUrl} alt={teamA.abbr} loading="lazy"
            onError={(e: { currentTarget: HTMLImageElement }) => { e.currentTarget.style.display = 'none'; }} /> : null}
          <span className="po-card__abbr">{teamA?.abbr ?? 'TBD'}</span>
          <span className="po-card__prob">{fmt(probA)}</span>
          {advA ? <span className="po-card__champ">{fmt(advA.pChampion)} champ</span> : null}
        </button>
        <span className="po-card__vs">vs</span>
        <button type="button"
          className={`po-card__team${picked === teamBId ? ' po-card__team--win' : ''}${picked !== undefined && picked !== teamBId ? ' po-card__team--loss' : ''}`}
          onClick={() => canPick && teamBId != null && onPick(gameId, teamBId)} disabled={!canPick}>
          {teamB ? <img className="po-card__logo" src={teamB.logoUrl} alt={teamB.abbr} loading="lazy"
            onError={(e: { currentTarget: HTMLImageElement }) => { e.currentTarget.style.display = 'none'; }} /> : null}
          <span className="po-card__abbr">{teamB?.abbr ?? 'TBD'}</span>
          <span className="po-card__prob">{fmt(1 - probA)}</span>
          {advB ? <span className="po-card__champ">{fmt(advB.pChampion)} champ</span> : null}
        </button>
      </div>
      {picked !== undefined ? (
        <div className="po-card__result">{teamsById.get(picked)?.abbr ?? '?'} advances</div>
      ) : null}
    </div>
  );
}

function PlayoffRound({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="po-round">
      <h3 className="po-round__title">{title}</h3>
      <div className="po-round__games">{children}</div>
    </div>
  );
}

export function PlayoffSection({
  lockedPicks, east, west, teamsById, advancements,
  allGamesPicked, oddsFormat, justPickedKey, onPick,
}: PlayoffSectionProps) {
  const groups = useMemo(() => {
    const hp = (id: number) => lockedPicks.has(id);
    const pk = (id: number) => lockedPicks.get(id) ?? null;

    // Play-in team IDs from standings
    const es7 = east[6]?.teamId ?? null, es8 = east[7]?.teamId ?? null;
    const es9 = east[8]?.teamId ?? null, es10 = east[9]?.teamId ?? null;
    const ws7 = west[6]?.teamId ?? null, ws8 = west[7]?.teamId ?? null;
    const ws9 = west[8]?.teamId ?? null, ws10 = west[9]?.teamId ?? null;

    // Play-in final teams: loser of 7v8 hosts vs winner of 9v10
    const e7p = pk(PLAYIN_GAME_IDS.east.sevenVEight);
    const e9p = pk(PLAYIN_GAME_IDS.east.nineVTen);
    const eFinHome = e7p != null ? (e7p === es7 ? es8 : es7) : null;
    const eFinAway = e9p;

    const w7p = pk(PLAYIN_GAME_IDS.west.sevenVEight);
    const w9p = pk(PLAYIN_GAME_IDS.west.nineVTen);
    const wFinHome = w7p != null ? (w7p === ws7 ? ws8 : ws7) : null;
    const wFinAway = w9p;

    // Resolved seeds after play-in
    const eSeed7 = e7p, eSeed8 = pk(PLAYIN_GAME_IDS.east.final);
    const wSeed7 = w7p, wSeed8 = pk(PLAYIN_GAME_IDS.west.final);

    const eS = [east[0]?.teamId??null, east[1]?.teamId??null, east[2]?.teamId??null,
                east[3]?.teamId??null, east[4]?.teamId??null, east[5]?.teamId??null, eSeed7, eSeed8];
    const wS = [west[0]?.teamId??null, west[1]?.teamId??null, west[2]?.teamId??null,
                west[3]?.teamId??null, west[4]?.teamId??null, west[5]?.teamId??null, wSeed7, wSeed8];

    const ePlayinDone = hp(PLAYIN_GAME_IDS.east.sevenVEight) && hp(PLAYIN_GAME_IDS.east.nineVTen) && hp(PLAYIN_GAME_IDS.east.final);
    const wPlayinDone = hp(PLAYIN_GAME_IDS.west.sevenVEight) && hp(PLAYIN_GAME_IDS.west.nineVTen) && hp(PLAYIN_GAME_IDS.west.final);
    const playinDone = ePlayinDone && wPlayinDone;

    const result: Array<{ date: string; games: NbaGame[] }> = [];
    function addGroup(date: string, games: NbaGame[]) { if (games.length > 0) result.push({ date, games }); }

    // ── April 14: Play-In 7v8 ─────────────────────────────────────
    const apr14: NbaGame[] = [];
    if (es7 && es8) apr14.push(_mkGame(PLAYIN_GAME_IDS.east.sevenVEight, '2026-04-14', 175, es7, es8, getPlayinProb('7v8', es7, es8)));
    if (ws7 && ws8) apr14.push(_mkGame(PLAYIN_GAME_IDS.west.sevenVEight, '2026-04-14', 175, ws7, ws8, getPlayinProb('7v8', ws7, ws8)));
    addGroup('2026-04-14', apr14);

    // ── April 15: Play-In 9v10 ────────────────────────────────────
    const apr15: NbaGame[] = [];
    if (es9 && es10) apr15.push(_mkGame(PLAYIN_GAME_IDS.east.nineVTen, '2026-04-15', 176, es9, es10, getPlayinProb('9v10', es9, es10)));
    if (ws9 && ws10) apr15.push(_mkGame(PLAYIN_GAME_IDS.west.nineVTen, '2026-04-15', 176, ws9, ws10, getPlayinProb('9v10', ws9, ws10)));
    addGroup('2026-04-15', apr15);

    // ── April 17: Play-In finals (loser of 7v8 vs winner of 9v10) ─
    const apr17: NbaGame[] = [];
    if (eFinHome != null && eFinAway != null)
      apr17.push(_mkGame(PLAYIN_GAME_IDS.east.final, '2026-04-17', 178, eFinHome, eFinAway, getPlayinProb('final', eFinHome, eFinAway)));
    if (wFinHome != null && wFinAway != null)
      apr17.push(_mkGame(PLAYIN_GAME_IDS.west.final, '2026-04-17', 178, wFinHome, wFinAway, getPlayinProb('final', wFinHome, wFinAway)));
    addGroup('2026-04-17', apr17);

    if (!playinDone) return result;

    // ── R1: group all series games by date ────────────────────────
    const byDate = new Map<string, NbaGame[]>();
    function addSeries(ids: readonly number[], hs: number | null, ls: number | null, dates: readonly string[], days: readonly number[]) {
      for (const g of _buildSeries(ids, hs, ls, dates, days, lockedPicks)) {
        const arr = byDate.get(g.gameDate) ?? []; arr.push(g); byDate.set(g.gameDate, arr);
      }
    }
    addSeries(R1_GAME_IDS.east.s1v8, eS[0], eS[7], _E_R1_DATES, _E_R1_DAYS);
    addSeries(R1_GAME_IDS.east.s4v5, eS[3], eS[4], _E_R1_DATES, _E_R1_DAYS);
    addSeries(R1_GAME_IDS.east.s2v7, eS[1], eS[6], _E_R1_DATES, _E_R1_DAYS);
    addSeries(R1_GAME_IDS.east.s3v6, eS[2], eS[5], _E_R1_DATES, _E_R1_DAYS);
    addSeries(R1_GAME_IDS.west.s1v8, wS[0], wS[7], _W_R1_DATES, _W_R1_DAYS);
    addSeries(R1_GAME_IDS.west.s4v5, wS[3], wS[4], _W_R1_DATES, _W_R1_DAYS);
    addSeries(R1_GAME_IDS.west.s2v7, wS[1], wS[6], _W_R1_DATES, _W_R1_DAYS);
    addSeries(R1_GAME_IDS.west.s3v6, wS[2], wS[5], _W_R1_DATES, _W_R1_DAYS);

    const r1Dates = [...new Set([..._E_R1_DATES, ..._W_R1_DATES])].sort();
    for (const d of r1Dates) addGroup(d, byDate.get(d) ?? []);

    return result;
  }, [east, west, lockedPicks]);

  // R1 done = all 8 series have a winner (for R2/CF/Finals display)
  const hp = (id: number) => lockedPicks.has(id);
  const pk = (id: number) => lockedPicks.get(id) ?? null;

  const eSeed7 = pk(PLAYIN_GAME_IDS.east.sevenVEight);
  const eSeed8 = pk(PLAYIN_GAME_IDS.east.final);
  const wSeed7 = pk(PLAYIN_GAME_IDS.west.sevenVEight);
  const wSeed8 = pk(PLAYIN_GAME_IDS.west.final);

  const eS = [east[0]?.teamId??null, east[1]?.teamId??null, east[2]?.teamId??null,
              east[3]?.teamId??null, east[4]?.teamId??null, east[5]?.teamId??null, eSeed7, eSeed8];
  const wS = [west[0]?.teamId??null, west[1]?.teamId??null, west[2]?.teamId??null,
              west[3]?.teamId??null, west[4]?.teamId??null, west[5]?.teamId??null, wSeed7, wSeed8];

  const playinDone = hp(PLAYIN_GAME_IDS.east.sevenVEight) && hp(PLAYIN_GAME_IDS.east.nineVTen) && hp(PLAYIN_GAME_IDS.east.final) &&
                     hp(PLAYIN_GAME_IDS.west.sevenVEight) && hp(PLAYIN_GAME_IDS.west.nineVTen) && hp(PLAYIN_GAME_IDS.west.final);

  const eR1w = {
    s1v8: _seriesWinner(R1_GAME_IDS.east.s1v8, eS[0], eS[7], lockedPicks),
    s4v5: _seriesWinner(R1_GAME_IDS.east.s4v5, eS[3], eS[4], lockedPicks),
    s2v7: _seriesWinner(R1_GAME_IDS.east.s2v7, eS[1], eS[6], lockedPicks),
    s3v6: _seriesWinner(R1_GAME_IDS.east.s3v6, eS[2], eS[5], lockedPicks),
  };
  const wR1w = {
    s1v8: _seriesWinner(R1_GAME_IDS.west.s1v8, wS[0], wS[7], lockedPicks),
    s4v5: _seriesWinner(R1_GAME_IDS.west.s4v5, wS[3], wS[4], lockedPicks),
    s2v7: _seriesWinner(R1_GAME_IDS.west.s2v7, wS[1], wS[6], lockedPicks),
    s3v6: _seriesWinner(R1_GAME_IDS.west.s3v6, wS[2], wS[5], lockedPicks),
  };

  const r1Done = playinDone &&
    _seriesDone(R1_GAME_IDS.east.s1v8, eS[0], eS[7], lockedPicks) &&
    _seriesDone(R1_GAME_IDS.east.s4v5, eS[3], eS[4], lockedPicks) &&
    _seriesDone(R1_GAME_IDS.east.s2v7, eS[1], eS[6], lockedPicks) &&
    _seriesDone(R1_GAME_IDS.east.s3v6, eS[2], eS[5], lockedPicks) &&
    _seriesDone(R1_GAME_IDS.west.s1v8, wS[0], wS[7], lockedPicks) &&
    _seriesDone(R1_GAME_IDS.west.s4v5, wS[3], wS[4], lockedPicks) &&
    _seriesDone(R1_GAME_IDS.west.s2v7, wS[1], wS[6], lockedPicks) &&
    _seriesDone(R1_GAME_IDS.west.s3v6, wS[2], wS[5], lockedPicks);

  const r2Done = r1Done && [...R2_GAME_IDS.east, ...R2_GAME_IDS.west].every((id) => hp(id));
  const cfDone = r2Done && hp(CF_GAME_IDS.east) && hp(CF_GAME_IDS.west);
  const r2w = (id: number) => pk(id);
  const eastChamp = pk(CF_GAME_IDS.east);
  const westChamp = pk(CF_GAME_IDS.west);

  if (!allGamesPicked) return null;

  return (
    <section className="playoff-section">
      <div className="playoff-section__header">
        <h2 className="playoff-section__title">2026 NBA Playoffs</h2>
        <p className="playoff-section__sub">Pick each game — odds update live after each pick</p>
      </div>

      {/* Play-In and R1: date-grouped GameCard style (same as schedule) */}
      {groups.map((group) => (
        <DateGroup
          key={group.date}
          date={group.date}
          games={group.games}
          lockedPicks={lockedPicks}
          teamsById={teamsById}
          oddsFormat={oddsFormat}
          justPickedKey={justPickedKey}
          firstHintGameId={null}
          showPickHint={false}
          simSweepDelays={new Map()}
          disableInteractions={false}
          onPick={onPick}
        />
      ))}

      {/* R2/CF/Finals: series-winner picks (appear after R1 complete) */}
      {r1Done ? (
        <div className="po-conf-row">
          <PlayoffRound title="Eastern Semifinals">
            <PlayoffCard gameId={R2_GAME_IDS.east[0]} label="1/8 winner vs 4/5 winner"
              teamAId={eR1w.s1v8} teamBId={eR1w.s4v5}
              probA={eR1w.s1v8 != null && eR1w.s4v5 != null ? seriesWinPctNeutral(eR1w.s1v8, eR1w.s4v5) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick} />
            <PlayoffCard gameId={R2_GAME_IDS.east[1]} label="2/7 winner vs 3/6 winner"
              teamAId={eR1w.s2v7} teamBId={eR1w.s3v6}
              probA={eR1w.s2v7 != null && eR1w.s3v6 != null ? seriesWinPctNeutral(eR1w.s2v7, eR1w.s3v6) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick} />
          </PlayoffRound>
          <PlayoffRound title="Western Semifinals">
            <PlayoffCard gameId={R2_GAME_IDS.west[0]} label="1/8 winner vs 4/5 winner"
              teamAId={wR1w.s1v8} teamBId={wR1w.s4v5}
              probA={wR1w.s1v8 != null && wR1w.s4v5 != null ? seriesWinPctNeutral(wR1w.s1v8, wR1w.s4v5) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick} />
            <PlayoffCard gameId={R2_GAME_IDS.west[1]} label="2/7 winner vs 3/6 winner"
              teamAId={wR1w.s2v7} teamBId={wR1w.s3v6}
              probA={wR1w.s2v7 != null && wR1w.s3v6 != null ? seriesWinPctNeutral(wR1w.s2v7, wR1w.s3v6) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick} />
          </PlayoffRound>
        </div>
      ) : null}

      {r2Done ? (
        <div className="po-conf-row">
          <PlayoffRound title="Eastern Conference Finals">
            <PlayoffCard gameId={CF_GAME_IDS.east} label="East Conference Finals"
              teamAId={r2w(R2_GAME_IDS.east[0])} teamBId={r2w(R2_GAME_IDS.east[1])}
              probA={r2w(R2_GAME_IDS.east[0]) != null && r2w(R2_GAME_IDS.east[1]) != null ? seriesWinPctNeutral(r2w(R2_GAME_IDS.east[0])!, r2w(R2_GAME_IDS.east[1])!) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick} />
          </PlayoffRound>
          <PlayoffRound title="Western Conference Finals">
            <PlayoffCard gameId={CF_GAME_IDS.west} label="West Conference Finals"
              teamAId={r2w(R2_GAME_IDS.west[0])} teamBId={r2w(R2_GAME_IDS.west[1])}
              probA={r2w(R2_GAME_IDS.west[0]) != null && r2w(R2_GAME_IDS.west[1]) != null ? seriesWinPctNeutral(r2w(R2_GAME_IDS.west[0])!, r2w(R2_GAME_IDS.west[1])!) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick} />
          </PlayoffRound>
        </div>
      ) : null}

      {cfDone ? (
        <div className="po-finals-row">
          <PlayoffRound title="NBA Finals">
            <PlayoffCard gameId={FINALS_GAME_ID} label="NBA Finals"
              teamAId={eastChamp} teamBId={westChamp}
              probA={eastChamp != null && westChamp != null ? seriesWinPctNeutral(eastChamp, westChamp) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick} />
          </PlayoffRound>
        </div>
      ) : null}
    </section>
  );
}
