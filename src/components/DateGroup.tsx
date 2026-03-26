import { useEffect, useState } from 'react';
import { GameCard } from './GameCard';
import type { LockedPicks, NbaGame, NbaTeam, OddsFormat } from '../types';

interface DateGroupProps {
  date: string;
  games: NbaGame[];
  lockedPicks: LockedPicks;
  teamsById: Map<number, NbaTeam>;
  oddsFormat: OddsFormat;
  justPickedKey: string | null;
  firstHintGameId: number | null;
  showPickHint: boolean;
  simSweepDelays: Map<number, number>;
  disableInteractions: boolean;
  onPick: (gameId: number, teamId: number) => void;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00`));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DateGroup({
  date,
  games,
  lockedPicks,
  teamsById,
  oddsFormat,
  justPickedKey,
  firstHintGameId,
  showPickHint,
  simSweepDelays,
  disableInteractions,
  onPick,
}: DateGroupProps) {
  const resolvedCount = games.filter((game) => game.isCompleted || lockedPicks.has(game.gameId)).length;
  const allResolved = resolvedCount === games.length;
  const [isCollapsed, setIsCollapsed] = useState(() => allResolved && date < todayIso());
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    if (!allResolved) {
      setIsCollapsed(false);
      setManualOpen(false);
      return;
    }

    if (manualOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsCollapsed(true);
    }, 600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [allResolved, manualOpen]);

  function toggleCollapsed() {
    if (allResolved && isCollapsed) {
      setManualOpen(true);
    }

    setIsCollapsed((current) => !current);
  }

  return (
    <section className="date-group">
      <button type="button" className="date-group__header" onClick={toggleCollapsed}>
        <div>
          <div className="date-group__title">{formatDate(date)}</div>
          <div className="date-group__meta">
            {allResolved ? `${resolvedCount}/${games.length} ✓` : `${resolvedCount}/${games.length} picked`}
          </div>
        </div>
        <span className="date-group__chevron">{isCollapsed ? '▸' : '▾'}</span>
      </button>

      <div className={isCollapsed ? 'date-group-body date-group-body--collapsed' : 'date-group-body date-group-body--expanded'}>
        <div className="date-group__grid">
          {games.map((game) => {
            const homeTeam = teamsById.get(game.homeTeamId);
            const awayTeam = teamsById.get(game.awayTeamId);

            if (!homeTeam || !awayTeam) {
              return null;
            }

            return (
              <GameCard
                key={game.gameId}
                game={game}
                homeTeam={homeTeam}
                awayTeam={awayTeam}
                selectedWinnerId={lockedPicks.get(game.gameId)}
                oddsFormat={oddsFormat}
                justPickedKey={justPickedKey}
                showHint={showPickHint && firstHintGameId === game.gameId}
                simSweepDelayMs={simSweepDelays.get(game.gameId) ?? null}
                disableInteractions={disableInteractions}
                onPick={onPick}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
