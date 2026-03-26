// Auto-generated PlayoffSection.tsx — do not edit manually
// Updated: 2026-03-26
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { getMatchupProb } from '../data/nbaMatchupProbs';
import { getPlayinProb } from '../data/nbaPlayinProbs';
import {
  CF_GAME_IDS, FINALS_GAME_ID, PLAYIN_GAME_IDS, R1_GAME_IDS, R2_GAME_IDS,
} from '../lib/simulation';
import type { LockedPicks, NbaTeam, StandingsRow, TeamAdvancement } from '../types';

interface PlayoffSectionProps {
  lockedPicks: LockedPicks;
  east: StandingsRow[];
  west: StandingsRow[];
  teamsById: Map<number, NbaTeam>;
  advancements: Map<number, TeamAdvancement>;
  allGamesPicked: boolean;
  onPick: (gameId: number, teamId: number) => void;
}

function fmt(v: number): string {
  if (v >= 0.995) return '>99%';
  if (v < 0.005) return '<1%';
  return `${Math.round(v * 100)}%`;
}

// Games 1,2,5,7 at home-court team's arena; 3,4,6 at challenger's.
const _HS_HOME_B = new Set([1, 2, 5, 7]);

/** P(hsId wins best-of-7 series, hsId has home court) via DP over matchup probs. */
function seriesWinPct(hsId: number, lsId: number): number {
  const pH = getMatchupProb(hsId, lsId, 'home');
  const pA = getMatchupProb(hsId, lsId, 'away');
  const memo = new Map<string, number>();
  function dp(hw: number, lw: number): number {
    if (hw === 4) return 1.0;
    if (lw === 4) return 0.0;
    const k = `${hw}_${lw}`;
    if (memo.has(k)) return memo.get(k)!;
    const p = _HS_HOME_B.has(hw + lw + 1) ? pH : pA;
    const v = p * dp(hw + 1, lw) + (1 - p) * dp(hw, lw + 1);
    memo.set(k, v);
    return v;
  }
  return dp(0, 0);
}

/** Series win prob when home court is uncertain — use neutral. */
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

// ── Shared game card for both play-in and series picks ──────────
function PlayoffCard({
  gameId, seedA, seedB, teamAId, teamBId, label, probA,
  lockedPicks, teamsById, advancements, showChamp, onPick,
}: {
  gameId: number;
  seedA?: number;
  seedB?: number;
  teamAId: number | null;
  teamBId: number | null;
  label: string;
  probA: number;
  lockedPicks: LockedPicks;
  teamsById: Map<number, NbaTeam>;
  advancements: Map<number, TeamAdvancement>;
  showChamp?: boolean;
  onPick: (gameId: number, teamId: number) => void;
}) {
  const teamA = teamAId != null ? teamsById.get(teamAId) ?? null : null;
  const teamB = teamBId != null ? teamsById.get(teamBId) ?? null : null;
  const picked = lockedPicks.get(gameId);
  const canPick = teamAId != null && teamBId != null;
  const advA = showChamp && teamAId != null ? advancements.get(teamAId) : null;
  const advB = showChamp && teamBId != null ? advancements.get(teamBId) : null;

  return (
    <div className={`po-card${picked !== undefined ? ' po-card--picked' : ''}`}>
      <span className="po-card__label">{label}</span>
      <div className="po-card__row">
        <button
          type="button"
          className={`po-card__team${picked === teamAId ? ' po-card__team--win' : ''}${picked !== undefined && picked !== teamAId ? ' po-card__team--loss' : ''}`}
          onClick={() => canPick && teamAId != null && onPick(gameId, teamAId)}
          disabled={!canPick}
        >
          {seedA !== undefined && <span className="po-card__seed">{seedA}</span>}
          {teamA ? (
            <img className="po-card__logo" src={teamA.logoUrl} alt={teamA.abbr} loading="lazy"
              onError={(e: { currentTarget: HTMLImageElement }) => { e.currentTarget.style.display = 'none'; }} />
          ) : null}
          <span className="po-card__abbr">{teamA?.abbr ?? 'TBD'}</span>
          <span className="po-card__prob">{fmt(probA)}</span>
          {advA ? <span className="po-card__champ">{fmt(advA.pChampion)} champ</span> : null}
        </button>
        <span className="po-card__vs">vs</span>
        <button
          type="button"
          className={`po-card__team${picked === teamBId ? ' po-card__team--win' : ''}${picked !== undefined && picked !== teamBId ? ' po-card__team--loss' : ''}`}
          onClick={() => canPick && teamBId != null && onPick(gameId, teamBId)}
          disabled={!canPick}
        >
          {seedB !== undefined && <span className="po-card__seed">{seedB}</span>}
          {teamB ? (
            <img className="po-card__logo" src={teamB.logoUrl} alt={teamB.abbr} loading="lazy"
              onError={(e: { currentTarget: HTMLImageElement }) => { e.currentTarget.style.display = 'none'; }} />
          ) : null}
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
  lockedPicks, east, west, teamsById, advancements, allGamesPicked, onPick,
}: PlayoffSectionProps) {
  const { eb, wb } = useMemo(() => {
    function resolve(rows: StandingsRow[], piIds: { sevenVEight: number; nineVTen: number; final: number }) {
      const s7 = rows[6]?.teamId ?? null;
      const s8 = rows[7]?.teamId ?? null;
      const s9 = rows[8]?.teamId ?? null;
      const s10 = rows[9]?.teamId ?? null;
      const locked78 = lockedPicks.get(piIds.sevenVEight) ?? null;
      const seed7Winner = locked78;
      const seed7Loser = locked78 === s7 ? s8 : locked78 === s8 ? s7 : null;
      const locked910 = lockedPicks.get(piIds.nineVTen) ?? null;
      const finalTeamA = seed7Loser;
      const finalTeamB = locked910;
      const seed8Winner = lockedPicks.get(piIds.final) ?? null;
      return { s7, s8, s9, s10, seed7Winner, seed8Winner, finalTeamA, finalTeamB };
    }
    return {
      eb: resolve(east, PLAYIN_GAME_IDS.east),
      wb: resolve(west, PLAYIN_GAME_IDS.west),
    };
  }, [east, west, lockedPicks]);

  // Round completion checks
  const hasPick = (id: number) => lockedPicks.has(id);
  const ePlayinDone = hasPick(PLAYIN_GAME_IDS.east.sevenVEight) && hasPick(PLAYIN_GAME_IDS.east.nineVTen) && hasPick(PLAYIN_GAME_IDS.east.final);
  const wPlayinDone = hasPick(PLAYIN_GAME_IDS.west.sevenVEight) && hasPick(PLAYIN_GAME_IDS.west.nineVTen) && hasPick(PLAYIN_GAME_IDS.west.final);
  const playinDone = ePlayinDone && wPlayinDone;
  const r1Done = playinDone && [...R1_GAME_IDS.east, ...R1_GAME_IDS.west].every((id) => hasPick(id));
  const r2Done = r1Done && [...R2_GAME_IDS.east, ...R2_GAME_IDS.west].every((id) => hasPick(id));
  const cfDone = r2Done && hasPick(CF_GAME_IDS.east) && hasPick(CF_GAME_IDS.west);

  // R1 winners for R2 display
  const r1w = (id: number) => lockedPicks.get(id) ?? null;
  // R2 winners for CF display
  const r2w = (id: number) => lockedPicks.get(id) ?? null;
  // CF winners for Finals display
  const eastChamp = lockedPicks.get(CF_GAME_IDS.east) ?? null;
  const westChamp = lockedPicks.get(CF_GAME_IDS.west) ?? null;

  if (!allGamesPicked) return null;

  return (
    <section className="playoff-section">
      <div className="playoff-section__header">
        <h2 className="playoff-section__title">2026 NBA Playoffs</h2>
        <p className="playoff-section__sub">Pick each matchup — odds update live</p>
      </div>

      {/* Play-In */}
      <div className="po-conf-row">
        <PlayoffRound title="Eastern Play-In">
          <PlayoffCard
            gameId={PLAYIN_GAME_IDS.east.sevenVEight} label="7 vs 8 — winner = 7 seed"
            teamAId={eb.s7} teamBId={eb.s8} seedA={7} seedB={8}
            probA={eb.s7 != null && eb.s8 != null ? getPlayinProb('7v8', eb.s7, eb.s8) : 0.5}
            lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick}
          />
          <PlayoffCard
            gameId={PLAYIN_GAME_IDS.east.nineVTen} label="9 vs 10 — winner advances"
            teamAId={eb.s9} teamBId={eb.s10} seedA={9} seedB={10}
            probA={eb.s9 != null && eb.s10 != null ? getPlayinProb('9v10', eb.s9, eb.s10) : 0.5}
            lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick}
          />
          {hasPick(PLAYIN_GAME_IDS.east.sevenVEight) && hasPick(PLAYIN_GAME_IDS.east.nineVTen) ? (
            <PlayoffCard
              gameId={PLAYIN_GAME_IDS.east.final} label="For 8 seed"
              teamAId={eb.finalTeamA} teamBId={eb.finalTeamB}
              probA={eb.finalTeamA != null && eb.finalTeamB != null ? getPlayinProb('final', eb.finalTeamA, eb.finalTeamB) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick}
            />
          ) : null}
        </PlayoffRound>

        <PlayoffRound title="Western Play-In">
          <PlayoffCard
            gameId={PLAYIN_GAME_IDS.west.sevenVEight} label="7 vs 8 — winner = 7 seed"
            teamAId={wb.s7} teamBId={wb.s8} seedA={7} seedB={8}
            probA={wb.s7 != null && wb.s8 != null ? getPlayinProb('7v8', wb.s7, wb.s8) : 0.5}
            lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick}
          />
          <PlayoffCard
            gameId={PLAYIN_GAME_IDS.west.nineVTen} label="9 vs 10 — winner advances"
            teamAId={wb.s9} teamBId={wb.s10} seedA={9} seedB={10}
            probA={wb.s9 != null && wb.s10 != null ? getPlayinProb('9v10', wb.s9, wb.s10) : 0.5}
            lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick}
          />
          {hasPick(PLAYIN_GAME_IDS.west.sevenVEight) && hasPick(PLAYIN_GAME_IDS.west.nineVTen) ? (
            <PlayoffCard
              gameId={PLAYIN_GAME_IDS.west.final} label="For 8 seed"
              teamAId={wb.finalTeamA} teamBId={wb.finalTeamB}
              probA={wb.finalTeamA != null && wb.finalTeamB != null ? getPlayinProb('final', wb.finalTeamA, wb.finalTeamB) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick}
            />
          ) : null}
        </PlayoffRound>
      </div>

      {/* First Round — appears after all 6 play-in games picked */}
      {playinDone ? (
        <div className="po-conf-row">
          <PlayoffRound title="Eastern First Round">
            <PlayoffCard gameId={R1_GAME_IDS.east[0]} label={`1 vs 8`} seedA={1} seedB={8}
              teamAId={east[0]?.teamId ?? null} teamBId={eb.seed8Winner}
              probA={east[0]?.teamId != null && eb.seed8Winner != null ? seriesWinPct(east[0].teamId, eb.seed8Winner) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} showChamp onPick={onPick} />
            <PlayoffCard gameId={R1_GAME_IDS.east[1]} label={`4 vs 5`} seedA={4} seedB={5}
              teamAId={east[3]?.teamId ?? null} teamBId={east[4]?.teamId ?? null}
              probA={east[3]?.teamId != null && east[4]?.teamId != null ? seriesWinPct(east[3].teamId, east[4].teamId) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} showChamp onPick={onPick} />
            <PlayoffCard gameId={R1_GAME_IDS.east[2]} label={`2 vs 7`} seedA={2} seedB={7}
              teamAId={east[1]?.teamId ?? null} teamBId={eb.seed7Winner}
              probA={east[1]?.teamId != null && eb.seed7Winner != null ? seriesWinPct(east[1].teamId, eb.seed7Winner) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} showChamp onPick={onPick} />
            <PlayoffCard gameId={R1_GAME_IDS.east[3]} label={`3 vs 6`} seedA={3} seedB={6}
              teamAId={east[2]?.teamId ?? null} teamBId={east[5]?.teamId ?? null}
              probA={east[2]?.teamId != null && east[5]?.teamId != null ? seriesWinPct(east[2].teamId, east[5].teamId) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} showChamp onPick={onPick} />
          </PlayoffRound>
          <PlayoffRound title="Western First Round">
            <PlayoffCard gameId={R1_GAME_IDS.west[0]} label={`1 vs 8`} seedA={1} seedB={8}
              teamAId={west[0]?.teamId ?? null} teamBId={wb.seed8Winner}
              probA={west[0]?.teamId != null && wb.seed8Winner != null ? seriesWinPct(west[0].teamId, wb.seed8Winner) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} showChamp onPick={onPick} />
            <PlayoffCard gameId={R1_GAME_IDS.west[1]} label={`4 vs 5`} seedA={4} seedB={5}
              teamAId={west[3]?.teamId ?? null} teamBId={west[4]?.teamId ?? null}
              probA={west[3]?.teamId != null && west[4]?.teamId != null ? seriesWinPct(west[3].teamId, west[4].teamId) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} showChamp onPick={onPick} />
            <PlayoffCard gameId={R1_GAME_IDS.west[2]} label={`2 vs 7`} seedA={2} seedB={7}
              teamAId={west[1]?.teamId ?? null} teamBId={wb.seed7Winner}
              probA={west[1]?.teamId != null && wb.seed7Winner != null ? seriesWinPct(west[1].teamId, wb.seed7Winner) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} showChamp onPick={onPick} />
            <PlayoffCard gameId={R1_GAME_IDS.west[3]} label={`3 vs 6`} seedA={3} seedB={6}
              teamAId={west[2]?.teamId ?? null} teamBId={west[5]?.teamId ?? null}
              probA={west[2]?.teamId != null && west[5]?.teamId != null ? seriesWinPct(west[2].teamId, west[5].teamId) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} showChamp onPick={onPick} />
          </PlayoffRound>
        </div>
      ) : null}

      {/* Second Round — appears after all R1 picked */}
      {r1Done ? (
        <div className="po-conf-row">
          <PlayoffRound title="Eastern Semifinals">
            <PlayoffCard gameId={R2_GAME_IDS.east[0]} label="1/8 winner vs 4/5 winner"
              teamAId={r1w(R1_GAME_IDS.east[0])} teamBId={r1w(R1_GAME_IDS.east[1])}
              probA={r1w(R1_GAME_IDS.east[0]) != null && r1w(R1_GAME_IDS.east[1]) != null ? seriesWinPctNeutral(r1w(R1_GAME_IDS.east[0])!, r1w(R1_GAME_IDS.east[1])!) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} showChamp onPick={onPick} />
            <PlayoffCard gameId={R2_GAME_IDS.east[1]} label="2/7 winner vs 3/6 winner"
              teamAId={r1w(R1_GAME_IDS.east[2])} teamBId={r1w(R1_GAME_IDS.east[3])}
              probA={r1w(R1_GAME_IDS.east[2]) != null && r1w(R1_GAME_IDS.east[3]) != null ? seriesWinPctNeutral(r1w(R1_GAME_IDS.east[2])!, r1w(R1_GAME_IDS.east[3])!) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} showChamp onPick={onPick} />
          </PlayoffRound>
          <PlayoffRound title="Western Semifinals">
            <PlayoffCard gameId={R2_GAME_IDS.west[0]} label="1/8 winner vs 4/5 winner"
              teamAId={r1w(R1_GAME_IDS.west[0])} teamBId={r1w(R1_GAME_IDS.west[1])}
              probA={r1w(R1_GAME_IDS.west[0]) != null && r1w(R1_GAME_IDS.west[1]) != null ? seriesWinPctNeutral(r1w(R1_GAME_IDS.west[0])!, r1w(R1_GAME_IDS.west[1])!) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} showChamp onPick={onPick} />
            <PlayoffCard gameId={R2_GAME_IDS.west[1]} label="2/7 winner vs 3/6 winner"
              teamAId={r1w(R1_GAME_IDS.west[2])} teamBId={r1w(R1_GAME_IDS.west[3])}
              probA={r1w(R1_GAME_IDS.west[2]) != null && r1w(R1_GAME_IDS.west[3]) != null ? seriesWinPctNeutral(r1w(R1_GAME_IDS.west[2])!, r1w(R1_GAME_IDS.west[3])!) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} showChamp onPick={onPick} />
          </PlayoffRound>
        </div>
      ) : null}

      {/* Conference Finals — appears after all R2 picked */}
      {r2Done ? (
        <div className="po-conf-row">
          <PlayoffRound title="Eastern Conference Finals">
            <PlayoffCard gameId={CF_GAME_IDS.east} label="East Conf Finals"
              teamAId={r2w(R2_GAME_IDS.east[0])} teamBId={r2w(R2_GAME_IDS.east[1])}
              probA={r2w(R2_GAME_IDS.east[0]) != null && r2w(R2_GAME_IDS.east[1]) != null ? seriesWinPctNeutral(r2w(R2_GAME_IDS.east[0])!, r2w(R2_GAME_IDS.east[1])!) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} showChamp onPick={onPick} />
          </PlayoffRound>
          <PlayoffRound title="Western Conference Finals">
            <PlayoffCard gameId={CF_GAME_IDS.west} label="West Conf Finals"
              teamAId={r2w(R2_GAME_IDS.west[0])} teamBId={r2w(R2_GAME_IDS.west[1])}
              probA={r2w(R2_GAME_IDS.west[0]) != null && r2w(R2_GAME_IDS.west[1]) != null ? seriesWinPctNeutral(r2w(R2_GAME_IDS.west[0])!, r2w(R2_GAME_IDS.west[1])!) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} showChamp onPick={onPick} />
          </PlayoffRound>
        </div>
      ) : null}

      {/* NBA Finals — appears after both CF picked */}
      {cfDone ? (
        <div className="po-finals-row">
          <PlayoffRound title="NBA Finals">
            <PlayoffCard gameId={FINALS_GAME_ID} label="NBA Finals"
              teamAId={eastChamp} teamBId={westChamp}
              probA={eastChamp != null && westChamp != null ? seriesWinPctNeutral(eastChamp, westChamp) : 0.5}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} showChamp onPick={onPick} />
          </PlayoffRound>
        </div>
      ) : null}
    </section>
  );
}
