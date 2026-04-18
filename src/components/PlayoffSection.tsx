// Auto-generated PlayoffSection.tsx — do not edit manually
// Updated: 2026-04-18
import { useMemo } from 'react';
import { DateGroup } from './DateGroup';
import { getPlayinProb } from '../data/nbaPlayinProbs';
import { getSeriesGameProb } from '../data/nbaSeriesGameProbs';
import type { RoundKey } from '../data/nbaSeriesGameProbs';
import {
  CF_GAME_IDS, FINALS_GAME_IDS, PLAYIN_GAME_IDS, R1_GAME_IDS, R2_GAME_IDS,
} from '../lib/simulation';
import type { LockedPicks, NbaGame, NbaTeam, OddsFormat, StandingsRow, TeamAdvancement } from '../types';

interface PlayoffSectionProps {
  lockedPicks: LockedPicks;
  east: StandingsRow[];
  west: StandingsRow[];
  teamsById: Map<number, NbaTeam>;
  advancements?: Map<number, TeamAdvancement>;
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
  teamsById: Map<number, NbaTeam>,
  seedMap: Map<number, number>,
  roundKey: RoundKey,
): NbaGame[] {
  if (!hsId || !lsId) return [];
  const hsAbbr = teamsById.get(hsId)?.abbr ?? '???';
  const lsAbbr = teamsById.get(lsId)?.abbr ?? '???';
  const out: NbaGame[] = [];
  for (let i = 0; i < 7; i++) {
    const priorIds = gameIds.slice(0, i);
    const [aw, bw] = _wins(priorIds, hsId, lsId, picks);
    if (aw >= 4 || bw >= 4) break;
    const g = i + 1;
    const hId = _HS_HOME_R.has(g) ? hsId : lsId;
    const aId = _HS_HOME_R.has(g) ? lsId : hsId;
    // P(hs wins game g | series state) — date-aware, injury reinstatement baked in
    const pHsWins = getSeriesGameProb(roundKey, hsId, lsId, g, aw, bw);
    const pH = hId === hsId ? pHsWins : 1 - pHsWins;
    const game = _mkGame(gameIds[i], dates[i], days[i], hId, aId, pH);
    game.homeSeed = seedMap.get(hId);
    game.awaySeed = seedMap.get(aId);
    if (aw > 0 || bw > 0) {
      if (aw === bw) game.seriesScore = `Tied ${aw}-${bw}`;
      else if (aw > bw) game.seriesScore = `${hsAbbr} leads ${aw}-${bw}`;
      else game.seriesScore = `${lsAbbr} leads ${bw}-${aw}`;
    }
    out.push(game);
  }
  return out;
}

function _isDivLeader(teamId: number | null, confRows: StandingsRow[], teamsById: Map<number, NbaTeam>): boolean {
  if (!teamId) return false;
  const div = teamsById.get(teamId)?.division;
  if (!div) return false;
  const divRows = confRows.filter((r) => teamsById.get(r.teamId)?.division === div);
  if (!divRows.length) return false;
  const leader = divRows.reduce((a, b) => a.wins > b.wins || (a.wins === b.wins && a.losses < b.losses) ? a : b);
  return leader.teamId === teamId;
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

// Approximate game dates/daynums for R2, CF, Finals
const _R2_DATES:  readonly string[] = ['2026-05-05','2026-05-07','2026-05-09','2026-05-11','2026-05-14','2026-05-17','2026-05-19'];
const _R2_DAYS:   readonly number[] = [196,198,200,202,205,208,210];
const _CF_DATES:  readonly string[] = ['2026-05-21','2026-05-23','2026-05-25','2026-05-27','2026-05-30','2026-06-02','2026-06-04'];
const _CF_DAYS:   readonly number[] = [212,214,216,218,221,224,226];
const _FIN_DATES: readonly string[] = ['2026-06-07','2026-06-09','2026-06-11','2026-06-14','2026-06-17','2026-06-20','2026-06-22'];
const _FIN_DAYS:  readonly number[] = [229,231,233,236,239,242,244];

// Determine home-court team (lower seed index = home court)
function _hsOf(aId: number | null, aIdx: number, bId: number | null, bIdx: number): number | null {
  if (!aId || !bId) return aId ?? bId ?? null;
  return aIdx <= bIdx ? aId : bId;
}
function _lsOf(aId: number | null, aIdx: number, bId: number | null, bIdx: number): number | null {
  if (!aId || !bId) return aId ?? bId ?? null;
  return aIdx <= bIdx ? bId : aId;
}

export function PlayoffSection({
  lockedPicks, east, west, teamsById,
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

    const e7p = pk(PLAYIN_GAME_IDS.east.sevenVEight);
    const e9p = pk(PLAYIN_GAME_IDS.east.nineVTen);
    const eFinHome = e7p != null ? (e7p === es7 ? es8 : es7) : null;
    const eFinAway = e9p;

    const w7p = pk(PLAYIN_GAME_IDS.west.sevenVEight);
    const w9p = pk(PLAYIN_GAME_IDS.west.nineVTen);
    const wFinHome = w7p != null ? (w7p === ws7 ? ws8 : ws7) : null;
    const wFinAway = w9p;

    const eSeed7 = e7p, eSeed8 = pk(PLAYIN_GAME_IDS.east.final);
    const wSeed7 = w7p, wSeed8 = pk(PLAYIN_GAME_IDS.west.final);

    const eS = [east[0]?.teamId??null, east[1]?.teamId??null, east[2]?.teamId??null,
                east[3]?.teamId??null, east[4]?.teamId??null, east[5]?.teamId??null, eSeed7, eSeed8];
    const wS = [west[0]?.teamId??null, west[1]?.teamId??null, west[2]?.teamId??null,
                west[3]?.teamId??null, west[4]?.teamId??null, west[5]?.teamId??null, wSeed7, wSeed8];

    // Seed map: teamId → seed (regular-season position 1-10 initially, updated to playoff seed after play-in)
    const seedMap = new Map<number, number>();
    east.slice(0, 10).forEach((row, i) => { if (row?.teamId) seedMap.set(row.teamId, i + 1); });
    west.slice(0, 10).forEach((row, i) => { if (row?.teamId) seedMap.set(row.teamId, i + 1); });

    const ePlayinDone = hp(PLAYIN_GAME_IDS.east.sevenVEight) && hp(PLAYIN_GAME_IDS.east.nineVTen) && hp(PLAYIN_GAME_IDS.east.final);
    const wPlayinDone = hp(PLAYIN_GAME_IDS.west.sevenVEight) && hp(PLAYIN_GAME_IDS.west.nineVTen) && hp(PLAYIN_GAME_IDS.west.final);
    const playinDone = ePlayinDone && wPlayinDone;

    const result: Array<{ date: string; games: NbaGame[] }> = [];
    const byDate = new Map<string, NbaGame[]>();
    function addToDate(g: NbaGame) { const a = byDate.get(g.gameDate) ?? []; a.push(g); byDate.set(g.gameDate, a); }
    function flushDates(dates: readonly string[]) {
      const seen = new Set(dates);
      for (const d of [...seen].sort()) { const gs = byDate.get(d); if (gs?.length) result.push({ date: d, games: gs }); byDate.delete(d); }
    }
    function _mkgS(id: number, date: string, dn: number, hId: number, aId: number, pH: number): NbaGame {
      const g = _mkGame(id, date, dn, hId, aId, pH);
      g.homeSeed = seedMap.get(hId);
      g.awaySeed = seedMap.get(aId);
      return g;
    }

    // ── April 14: Play-In 7v8 ─────────────────────────────────────
    if (es7 && es8) addToDate(_mkgS(PLAYIN_GAME_IDS.east.sevenVEight, '2026-04-14', 175, es7, es8, getPlayinProb('7v8', es7, es8)));
    if (ws7 && ws8) addToDate(_mkgS(PLAYIN_GAME_IDS.west.sevenVEight, '2026-04-14', 175, ws7, ws8, getPlayinProb('7v8', ws7, ws8)));
    // ── April 15: Play-In 9v10 ────────────────────────────────────
    if (es9 && es10) addToDate(_mkgS(PLAYIN_GAME_IDS.east.nineVTen, '2026-04-15', 176, es9, es10, getPlayinProb('9v10', es9, es10)));
    if (ws9 && ws10) addToDate(_mkgS(PLAYIN_GAME_IDS.west.nineVTen, '2026-04-15', 176, ws9, ws10, getPlayinProb('9v10', ws9, ws10)));
    // ── April 17: Play-In finals ──────────────────────────────────
    if (eFinHome != null && eFinAway != null)
      addToDate(_mkgS(PLAYIN_GAME_IDS.east.final, '2026-04-17', 178, eFinHome, eFinAway, getPlayinProb('final', eFinHome, eFinAway)));
    if (wFinHome != null && wFinAway != null)
      addToDate(_mkgS(PLAYIN_GAME_IDS.west.final, '2026-04-17', 178, wFinHome, wFinAway, getPlayinProb('final', wFinHome, wFinAway)));
    flushDates(['2026-04-14','2026-04-15','2026-04-17']);

    if (!playinDone) return result;

    // Update seedMap: play-in winners get their official playoff seeds (7 and 8)
    if (eSeed7) seedMap.set(eSeed7, 7);
    if (eSeed8) seedMap.set(eSeed8, 8);
    if (wSeed7) seedMap.set(wSeed7, 7);
    if (wSeed8) seedMap.set(wSeed8, 8);

    // ── R1: group by date ─────────────────────────────────────────
    function addSeries(ids: readonly number[], hs: number | null, ls: number | null, dates: readonly string[], days: readonly number[], roundKey: RoundKey) {
      for (const g of _buildSeries(ids, hs, ls, dates, days, lockedPicks, teamsById, seedMap, roundKey)) addToDate(g);
    }
    addSeries(R1_GAME_IDS.east.s1v8, eS[0], eS[7], _E_R1_DATES, _E_R1_DAYS, 'east_r1');
    addSeries(R1_GAME_IDS.east.s4v5, eS[3], eS[4], _E_R1_DATES, _E_R1_DAYS, 'east_r1');
    addSeries(R1_GAME_IDS.east.s2v7, eS[1], eS[6], _E_R1_DATES, _E_R1_DAYS, 'east_r1');
    addSeries(R1_GAME_IDS.east.s3v6, eS[2], eS[5], _E_R1_DATES, _E_R1_DAYS, 'east_r1');
    addSeries(R1_GAME_IDS.west.s1v8, wS[0], wS[7], _W_R1_DATES, _W_R1_DAYS, 'west_r1');
    addSeries(R1_GAME_IDS.west.s4v5, wS[3], wS[4], _W_R1_DATES, _W_R1_DAYS, 'west_r1');
    addSeries(R1_GAME_IDS.west.s2v7, wS[1], wS[6], _W_R1_DATES, _W_R1_DAYS, 'west_r1');
    addSeries(R1_GAME_IDS.west.s3v6, wS[2], wS[5], _W_R1_DATES, _W_R1_DAYS, 'west_r1');
    flushDates([..._E_R1_DATES, ..._W_R1_DATES]);

    // ── R1 completion check ───────────────────────────────────────
    const r1Done = _seriesDone(R1_GAME_IDS.east.s1v8, eS[0], eS[7], lockedPicks) &&
      _seriesDone(R1_GAME_IDS.east.s4v5, eS[3], eS[4], lockedPicks) &&
      _seriesDone(R1_GAME_IDS.east.s2v7, eS[1], eS[6], lockedPicks) &&
      _seriesDone(R1_GAME_IDS.east.s3v6, eS[2], eS[5], lockedPicks) &&
      _seriesDone(R1_GAME_IDS.west.s1v8, wS[0], wS[7], lockedPicks) &&
      _seriesDone(R1_GAME_IDS.west.s4v5, wS[3], wS[4], lockedPicks) &&
      _seriesDone(R1_GAME_IDS.west.s2v7, wS[1], wS[6], lockedPicks) &&
      _seriesDone(R1_GAME_IDS.west.s3v6, wS[2], wS[5], lockedPicks);
    if (!r1Done) return result;

    // ── R2: determine matchups + home court ───────────────────────
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
    // index in eS/wS gives original seed (0=seed1,...,7=seed8)
    const eSI = (id: number | null) => id ? eS.indexOf(id) : 99;
    const wSI = (id: number | null) => id ? wS.indexOf(id) : 99;
    // R2 East sAB: 1/8w vs 4/5w
    addSeries(R2_GAME_IDS.east.sAB, _hsOf(eR1w.s1v8, eSI(eR1w.s1v8), eR1w.s4v5, eSI(eR1w.s4v5)), _lsOf(eR1w.s1v8, eSI(eR1w.s1v8), eR1w.s4v5, eSI(eR1w.s4v5)), _R2_DATES, _R2_DAYS, 'east_r2');
    addSeries(R2_GAME_IDS.east.sCD, _hsOf(eR1w.s2v7, eSI(eR1w.s2v7), eR1w.s3v6, eSI(eR1w.s3v6)), _lsOf(eR1w.s2v7, eSI(eR1w.s2v7), eR1w.s3v6, eSI(eR1w.s3v6)), _R2_DATES, _R2_DAYS, 'east_r2');
    addSeries(R2_GAME_IDS.west.sAB, _hsOf(wR1w.s1v8, wSI(wR1w.s1v8), wR1w.s4v5, wSI(wR1w.s4v5)), _lsOf(wR1w.s1v8, wSI(wR1w.s1v8), wR1w.s4v5, wSI(wR1w.s4v5)), _R2_DATES, _R2_DAYS, 'west_r2');
    addSeries(R2_GAME_IDS.west.sCD, _hsOf(wR1w.s2v7, wSI(wR1w.s2v7), wR1w.s3v6, wSI(wR1w.s3v6)), _lsOf(wR1w.s2v7, wSI(wR1w.s2v7), wR1w.s3v6, wSI(wR1w.s3v6)), _R2_DATES, _R2_DAYS, 'west_r2');
    flushDates(_R2_DATES);

    const r2Done = _seriesDone(R2_GAME_IDS.east.sAB, eR1w.s1v8, eR1w.s4v5, lockedPicks) &&
      _seriesDone(R2_GAME_IDS.east.sCD, eR1w.s2v7, eR1w.s3v6, lockedPicks) &&
      _seriesDone(R2_GAME_IDS.west.sAB, wR1w.s1v8, wR1w.s4v5, lockedPicks) &&
      _seriesDone(R2_GAME_IDS.west.sCD, wR1w.s2v7, wR1w.s3v6, lockedPicks);
    if (!r2Done) return result;

    // ── CF ────────────────────────────────────────────────────────
    const eR2wAB = _seriesWinner(R2_GAME_IDS.east.sAB, eR1w.s1v8, eR1w.s4v5, lockedPicks);
    const eR2wCD = _seriesWinner(R2_GAME_IDS.east.sCD, eR1w.s2v7, eR1w.s3v6, lockedPicks);
    const wR2wAB = _seriesWinner(R2_GAME_IDS.west.sAB, wR1w.s1v8, wR1w.s4v5, lockedPicks);
    const wR2wCD = _seriesWinner(R2_GAME_IDS.west.sCD, wR1w.s2v7, wR1w.s3v6, lockedPicks);
    addSeries(CF_GAME_IDS.east, _hsOf(eR2wAB, eSI(eR2wAB), eR2wCD, eSI(eR2wCD)), _lsOf(eR2wAB, eSI(eR2wAB), eR2wCD, eSI(eR2wCD)), _CF_DATES, _CF_DAYS, 'east_cf');
    addSeries(CF_GAME_IDS.west, _hsOf(wR2wAB, wSI(wR2wAB), wR2wCD, wSI(wR2wCD)), _lsOf(wR2wAB, wSI(wR2wAB), wR2wCD, wSI(wR2wCD)), _CF_DATES, _CF_DAYS, 'west_cf');
    flushDates(_CF_DATES);

    const cfDone = _seriesDone(CF_GAME_IDS.east, eR2wAB, eR2wCD, lockedPicks) &&
      _seriesDone(CF_GAME_IDS.west, wR2wAB, wR2wCD, lockedPicks);
    if (!cfDone) return result;

    // ── Finals ────────────────────────────────────────────────────
    const eastChamp = _seriesWinner(CF_GAME_IDS.east, eR2wAB, eR2wCD, lockedPicks);
    const westChamp = _seriesWinner(CF_GAME_IDS.west, wR2wAB, wR2wCD, lockedPicks);
    // Finals HCA tiebreakers: wins → division winner → conf win% → east by convention
    const ecRow = eastChamp ? east.find(r => r.teamId === eastChamp) : null;
    const wcRow = westChamp ? west.find(r => r.teamId === westChamp) : null;
    const ecW = ecRow?.wins ?? 0, wcW = wcRow?.wins ?? 0;
    const ecCG = (ecRow?.confWins ?? 0) + (ecRow?.confLosses ?? 0);
    const wcCG = (wcRow?.confWins ?? 0) + (wcRow?.confLosses ?? 0);
    const ecCWPct = ecCG > 0 ? (ecRow?.confWins ?? 0) / ecCG : 0;
    const wcCWPct = wcCG > 0 ? (wcRow?.confWins ?? 0) / wcCG : 0;
    const ecIsDiv = eastChamp ? _isDivLeader(eastChamp, east, teamsById) : false;
    const wcIsDiv = westChamp ? _isDivLeader(westChamp, west, teamsById) : false;
    let _finHsEast: boolean;
    if (ecW !== wcW) _finHsEast = ecW > wcW;
    else if (ecIsDiv !== wcIsDiv) _finHsEast = ecIsDiv;
    else if (ecCWPct !== wcCWPct) _finHsEast = ecCWPct > wcCWPct;
    else _finHsEast = true; // east by convention
    const finHs = _finHsEast ? eastChamp : westChamp;
    const finLs = finHs === eastChamp ? westChamp : eastChamp;
    addSeries(FINALS_GAME_IDS, finHs, finLs, _FIN_DATES, _FIN_DAYS, 'finals');
    flushDates(_FIN_DATES);

    return result;
  }, [east, west, lockedPicks]);

  if (!allGamesPicked) return null;

  return (
    <section className="playoff-section">
      <div className="playoff-section__header">
        <h2 className="playoff-section__title">2026 NBA Playoffs</h2>
        <p className="playoff-section__sub">Pick each game — odds update live after each pick</p>
      </div>

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
    </section>
  );
}
