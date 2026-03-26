// Auto-generated PlayoffBracketTab.tsx — do not edit manually
// Updated: 2026-03-26
import { useMemo } from 'react';
import { getMatchupProb } from '../data/nbaMatchupProbs';
import { PLAYIN_GAME_IDS, R1_GAME_IDS } from '../lib/simulation';
import type { LockedPicks, NbaTeam, StandingsRow, TeamAdvancement } from '../types';

interface PlayoffBracketTabProps {
  lockedPicks: LockedPicks;
  east: StandingsRow[];
  west: StandingsRow[];
  teamsById: Map<number, NbaTeam>;
  advancements: Map<number, TeamAdvancement>;
  allGamesPicked: boolean;
  pickedCount: number;
  totalCount: number;
  onPick: (gameId: number, teamId: number) => void;
  onBack: () => void;
}

// P(teamA wins best-of-7) from per-game neutral win probability (DP)
function seriesWinProb(pGame: number): number {
  const m: number[][] = Array.from({ length: 5 }, () => new Array(5).fill(-1));
  function f(a: number, b: number): number {
    if (a === 4) return 1;
    if (b === 4) return 0;
    if (m[a][b] >= 0) return m[a][b];
    return (m[a][b] = pGame * f(a + 1, b) + (1 - pGame) * f(a, b + 1));
  }
  return f(0, 0);
}

function fmt(v: number): string {
  if (v >= 0.995) return '>99%';
  if (v < 0.005) return '<1%';
  return `${Math.round(v * 100)}%`;
}

function PlayInGame({
  label, teamAId, teamBId, gameId, lockedPicks, teamsById, onPick,
}: {
  label: string;
  teamAId: number | null;
  teamBId: number | null;
  gameId: number;
  lockedPicks: LockedPicks;
  teamsById: Map<number, NbaTeam>;
  onPick: (gameId: number, teamId: number) => void;
}) {
  const teamA = teamAId != null ? teamsById.get(teamAId) : null;
  const teamB = teamBId != null ? teamsById.get(teamBId) : null;
  const picked = lockedPicks.get(gameId);
  const probA =
    teamAId != null && teamBId != null ? getMatchupProb(teamAId, teamBId, 'home') : 0.5;
  const canPick = teamAId != null && teamBId != null;

  return (
    <div className={`bracket-game${picked !== undefined ? ' bracket-game--picked' : ''}`}>
      <span className="bracket-game__label">{label}</span>
      <div className="bracket-game__teams">
        <button
          type="button"
          className={`bracket-team${picked === teamAId ? ' bracket-team--winner' : ''}${picked !== undefined && picked !== teamAId ? ' bracket-team--loser' : ''}`}
          onClick={() => canPick && onPick(gameId, teamAId!)}
          disabled={!canPick}
        >
          <span className="bracket-team__abbr">{teamA?.abbr ?? 'TBD'}</span>
          <span className="bracket-team__prob">{fmt(probA)}</span>
        </button>
        <span className="bracket-game__vs">vs</span>
        <button
          type="button"
          className={`bracket-team${picked === teamBId ? ' bracket-team--winner' : ''}${picked !== undefined && picked !== teamBId ? ' bracket-team--loser' : ''}`}
          onClick={() => canPick && onPick(gameId, teamBId!)}
          disabled={!canPick}
        >
          <span className="bracket-team__abbr">{teamB?.abbr ?? 'TBD'}</span>
          <span className="bracket-team__prob">{fmt(1 - probA)}</span>
        </button>
      </div>
      {picked !== undefined && (
        <div className="bracket-game__result">
          {teamsById.get(picked)?.abbr ?? '?'} advances
        </div>
      )}
    </div>
  );
}

function R1Series({
  seedA, teamAId, seedB, teamBId, gameId, lockedPicks, teamsById, advancements, onPick,
}: {
  seedA: number;
  teamAId: number | null;
  seedB: number;
  teamBId: number | null;
  gameId: number;
  lockedPicks: LockedPicks;
  teamsById: Map<number, NbaTeam>;
  advancements: Map<number, TeamAdvancement>;
  onPick: (gameId: number, teamId: number) => void;
}) {
  const teamA = teamAId != null ? teamsById.get(teamAId) : null;
  const teamB = teamBId != null ? teamsById.get(teamBId) : null;
  const picked = lockedPicks.get(gameId);
  const canPick = teamAId != null && teamBId != null;
  const pGame =
    teamAId != null && teamBId != null ? getMatchupProb(teamAId, teamBId, 'neutral') : 0.5;
  const pA = seriesWinProb(pGame);
  const advA = teamAId != null ? advancements.get(teamAId) : null;
  const advB = teamBId != null ? advancements.get(teamBId) : null;

  return (
    <div className={`bracket-series${picked !== undefined ? ' bracket-series--picked' : ''}`}>
      <div className="bracket-series__matchup">
        <button
          type="button"
          className={`bracket-team${picked === teamAId ? ' bracket-team--winner' : ''}${picked !== undefined && picked !== teamAId ? ' bracket-team--loser' : ''}`}
          onClick={() => canPick && onPick(gameId, teamAId!)}
          disabled={!canPick}
        >
          <span className="bracket-team__seed">{seedA}</span>
          <span className="bracket-team__abbr">{teamA?.abbr ?? 'TBD'}</span>
          <span className="bracket-team__prob">{fmt(pA)}</span>
          {advA && <span className="bracket-team__champ">{fmt(advA.pChampion)} champ</span>}
        </button>
        <span className="bracket-series__vs">vs</span>
        <button
          type="button"
          className={`bracket-team${picked === teamBId ? ' bracket-team--winner' : ''}${picked !== undefined && picked !== teamBId ? ' bracket-team--loser' : ''}`}
          onClick={() => canPick && onPick(gameId, teamBId!)}
          disabled={!canPick}
        >
          <span className="bracket-team__seed">{seedB}</span>
          <span className="bracket-team__abbr">{teamB?.abbr ?? 'TBD'}</span>
          <span className="bracket-team__prob">{fmt(1 - pA)}</span>
          {advB && <span className="bracket-team__champ">{fmt(advB.pChampion)} champ</span>}
        </button>
      </div>
    </div>
  );
}

export function PlayoffBracketTab({
  lockedPicks,
  east,
  west,
  teamsById,
  advancements,
  allGamesPicked,
  pickedCount,
  totalCount,
  onPick,
  onBack,
}: PlayoffBracketTabProps) {
  const percentage =
    totalCount === 0 ? 0 : Math.round((pickedCount / totalCount) * 100);

  // Derive play-in participants from projected seeds + locked picks
  const { eb, wb } = useMemo(() => {
    function resolveBracket(
      rows: StandingsRow[],
      piIds: (typeof PLAYIN_GAME_IDS)[keyof typeof PLAYIN_GAME_IDS],
    ) {
      const s7 = rows[6]?.teamId ?? null;
      const s8 = rows[7]?.teamId ?? null;
      const s9 = rows[8]?.teamId ?? null;
      const s10 = rows[9]?.teamId ?? null;
      const locked7v8 = lockedPicks.get(piIds.sevenVEight) ?? null;
      const seed7Winner = locked7v8;
      const seed7Loser =
        locked7v8 === s7 ? s8 : locked7v8 === s8 ? s7 : null;
      const locked9v10 = lockedPicks.get(piIds.nineVTen) ?? null;
      const seed9Winner = locked9v10;
      const finalTeamA = seed7Loser;
      const finalTeamB = seed9Winner;
      const lockedFinal = lockedPicks.get(piIds.final) ?? null;
      const seed8Winner = lockedFinal;
      return { s7, s8, s9, s10, seed7Winner, seed8Winner, finalTeamA, finalTeamB };
    }
    return {
      eb: resolveBracket(east, PLAYIN_GAME_IDS.east),
      wb: resolveBracket(west, PLAYIN_GAME_IDS.west),
    };
  }, [east, west, lockedPicks]);

  if (!allGamesPicked) {
    return (
      <section className="playoff-locked">
        <div className="playoff-locked__card">
          <p className="playoff-locked__icon">🔒</p>
          <h2>PLAYOFFS LOCKED</h2>
          <p className="playoff-locked__copy">
            Pick all regular season games to unlock the interactive playoff bracket.
          </p>
          <div className="playoff-locked__progress">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${percentage}%` }} />
            </div>
            <p className="progress-copy">
              {pickedCount} / {totalCount} games picked
            </p>
          </div>
          <button type="button" className="sim-controls__button" onClick={onBack}>
            Back to Schedule
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="playoff-bracket">
      <h2 className="playoff-bracket__title">2026 NBA Playoff Bracket</h2>
      <p className="playoff-bracket__subtitle">
        Pick each matchup — championship odds update live
      </p>
      <div className="playoff-bracket__grid">
        {/* East Conference */}
        <div className="playoff-conf">
          <h3 className="playoff-conf__title">Eastern Conference</h3>
          <div className="playoff-playin">
            <h4 className="playoff-section__title">Play-In Tournament</h4>
            <PlayInGame
              label="7 vs 8"
              teamAId={eb.s7}
              teamBId={eb.s8}
              gameId={PLAYIN_GAME_IDS.east.sevenVEight}
              lockedPicks={lockedPicks}
              teamsById={teamsById}
              onPick={onPick}
            />
            <PlayInGame
              label="9 vs 10"
              teamAId={eb.s9}
              teamBId={eb.s10}
              gameId={PLAYIN_GAME_IDS.east.nineVTen}
              lockedPicks={lockedPicks}
              teamsById={teamsById}
              onPick={onPick}
            />
            <PlayInGame
              label="For 8 seed"
              teamAId={eb.finalTeamA}
              teamBId={eb.finalTeamB}
              gameId={PLAYIN_GAME_IDS.east.final}
              lockedPicks={lockedPicks}
              teamsById={teamsById}
              onPick={onPick}
            />
          </div>
          <div className="playoff-r1">
            <h4 className="playoff-section__title">First Round</h4>
            <R1Series
              seedA={1} teamAId={east[0]?.teamId ?? null}
              seedB={8} teamBId={eb.seed8Winner}
              gameId={R1_GAME_IDS.east[0]}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick}
            />
            <R1Series
              seedA={4} teamAId={east[3]?.teamId ?? null}
              seedB={5} teamBId={east[4]?.teamId ?? null}
              gameId={R1_GAME_IDS.east[1]}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick}
            />
            <R1Series
              seedA={2} teamAId={east[1]?.teamId ?? null}
              seedB={7} teamBId={eb.seed7Winner}
              gameId={R1_GAME_IDS.east[2]}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick}
            />
            <R1Series
              seedA={3} teamAId={east[2]?.teamId ?? null}
              seedB={6} teamBId={east[5]?.teamId ?? null}
              gameId={R1_GAME_IDS.east[3]}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick}
            />
          </div>
        </div>

        {/* West Conference */}
        <div className="playoff-conf">
          <h3 className="playoff-conf__title">Western Conference</h3>
          <div className="playoff-playin">
            <h4 className="playoff-section__title">Play-In Tournament</h4>
            <PlayInGame
              label="7 vs 8"
              teamAId={wb.s7}
              teamBId={wb.s8}
              gameId={PLAYIN_GAME_IDS.west.sevenVEight}
              lockedPicks={lockedPicks}
              teamsById={teamsById}
              onPick={onPick}
            />
            <PlayInGame
              label="9 vs 10"
              teamAId={wb.s9}
              teamBId={wb.s10}
              gameId={PLAYIN_GAME_IDS.west.nineVTen}
              lockedPicks={lockedPicks}
              teamsById={teamsById}
              onPick={onPick}
            />
            <PlayInGame
              label="For 8 seed"
              teamAId={wb.finalTeamA}
              teamBId={wb.finalTeamB}
              gameId={PLAYIN_GAME_IDS.west.final}
              lockedPicks={lockedPicks}
              teamsById={teamsById}
              onPick={onPick}
            />
          </div>
          <div className="playoff-r1">
            <h4 className="playoff-section__title">First Round</h4>
            <R1Series
              seedA={1} teamAId={west[0]?.teamId ?? null}
              seedB={8} teamBId={wb.seed8Winner}
              gameId={R1_GAME_IDS.west[0]}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick}
            />
            <R1Series
              seedA={4} teamAId={west[3]?.teamId ?? null}
              seedB={5} teamBId={west[4]?.teamId ?? null}
              gameId={R1_GAME_IDS.west[1]}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick}
            />
            <R1Series
              seedA={2} teamAId={west[1]?.teamId ?? null}
              seedB={7} teamBId={wb.seed7Winner}
              gameId={R1_GAME_IDS.west[2]}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick}
            />
            <R1Series
              seedA={3} teamAId={west[2]?.teamId ?? null}
              seedB={6} teamBId={west[5]?.teamId ?? null}
              gameId={R1_GAME_IDS.west[3]}
              lockedPicks={lockedPicks} teamsById={teamsById} advancements={advancements} onPick={onPick}
            />
          </div>
        </div>
      </div>

      <button type="button" className="sim-controls__button playoff-bracket__back" onClick={onBack}>
        ← Back to Schedule
      </button>
    </section>
  );
}
