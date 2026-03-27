// Auto-generated GameCard.tsx — do not edit manually
// Updated: 2026-03-27
import { formatOdds } from '../lib/formatOdds';
import type { NbaGame, NbaTeam, OddsFormat } from '../types';

interface GameCardProps {
  game: NbaGame;
  homeTeam: NbaTeam;
  awayTeam: NbaTeam;
  selectedWinnerId: number | undefined;
  oddsFormat: OddsFormat;
  justPickedKey: string | null;
  showHint: boolean;
  simSweepDelayMs: number | null;
  disableInteractions: boolean;
  onPick: (gameId: number, teamId: number) => void;
}

export function GameCard({
  game,
  homeTeam,
  awayTeam,
  selectedWinnerId,
  oddsFormat,
  justPickedKey,
  showHint,
  simSweepDelayMs,
  disableInteractions,
  onPick,
}: GameCardProps) {
  const winnerId = game.isCompleted ? game.actualWinnerId : selectedWinnerId;
  const awayProbability = 1 - game.pHomeWins;
  const homeProbability = game.pHomeWins;
  const cardClassName = ['game-card'];

  if (winnerId) {
    cardClassName.push('game-card--picked');
  }

  if (game.isCompleted) {
    cardClassName.push('game-card--completed');
  }

  if (simSweepDelayMs !== null) {
    cardClassName.push('game-card--sim-filling');
  }

  const cardStyle =
    simSweepDelayMs === null ? undefined : ({ '--sim-delay': `${simSweepDelayMs}ms` } as { [key: string]: string });
  const awayDisplayName = awayTeam.name.replace(`${awayTeam.city} `, '');
  const homeDisplayName = homeTeam.name.replace(`${homeTeam.city} `, '');

  return (
    <article className={cardClassName.join(' ')} style={cardStyle}>
      {game.isCompleted ? <span className="game-card__final">Final</span> : null}
      {game.seriesScore ? (
        <div className="game-card__series-score">
          {game.seriesScore}
        </div>
      ) : null}
      {showHint && !winnerId && !game.isCompleted ? <div className="pick-hint">Click a team to pick the winner</div> : null}

      <button
        type="button"
        className={rowClassName(awayTeam.id, winnerId, justPickedKey === `${game.gameId}-${awayTeam.id}`)}
        onClick={() => onPick(game.gameId, awayTeam.id)}
        disabled={game.isCompleted || disableInteractions}
        style={{ '--prob-width': `${(awayProbability * 100).toFixed(1)}%` } as { [key: string]: string }}
      >
        <div className="team-logo-wrap">
          <img
            className="team-logo"
            src={awayTeam.logoUrl}
            alt={awayTeam.name}
            loading="lazy"
            onError={(event: { currentTarget: HTMLImageElement }) => {
              event.currentTarget.style.display = 'none';
              const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;

              if (fallback) {
                fallback.style.display = 'flex';
              }
            }}
          />
          <div className="logo-fallback" style={{ display: 'none' }}>
            {awayTeam.abbr}
          </div>
        </div>
        <div className="team-row__identity">
          <span className="team-row__abbr team-abbr">{awayTeam.abbr}{game.awaySeed != null ? ` (${game.awaySeed})` : ''}</span>
          <span className="team-row__city">{awayTeam.city}</span>
          <span className="team-row__name">{awayDisplayName}</span>
        </div>
        <span className="team-row__odds">{formatOdds(awayProbability, oddsFormat)}</span>
      </button>

      <button
        type="button"
        className={rowClassName(homeTeam.id, winnerId, justPickedKey === `${game.gameId}-${homeTeam.id}`)}
        onClick={() => onPick(game.gameId, homeTeam.id)}
        disabled={game.isCompleted || disableInteractions}
        style={{ '--prob-width': `${(homeProbability * 100).toFixed(1)}%` } as { [key: string]: string }}
      >
        <div className="team-logo-wrap">
          <img
            className="team-logo"
            src={homeTeam.logoUrl}
            alt={homeTeam.name}
            loading="lazy"
            onError={(event: { currentTarget: HTMLImageElement }) => {
              event.currentTarget.style.display = 'none';
              const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;

              if (fallback) {
                fallback.style.display = 'flex';
              }
            }}
          />
          <div className="logo-fallback" style={{ display: 'none' }}>
            {homeTeam.abbr}
          </div>
        </div>
        <div className="team-row__identity">
          <span className="team-row__abbr team-abbr">{homeTeam.abbr}{game.homeSeed != null ? ` (${game.homeSeed})` : ''}</span>
          <span className="team-row__city">{homeTeam.city}</span>
          <span className="team-row__name">{homeDisplayName}</span>
          <span className="team-row__home">Home</span>
        </div>
        <span className="team-row__odds">{formatOdds(homeProbability, oddsFormat)}</span>
      </button>
    </article>
  );
}

function rowClassName(teamId: number, winnerId: number | undefined, isJustPicked: boolean): string {
  const classNames = ['team-row'];

  if (isJustPicked) {
    classNames.push('team-row--just-picked');
  }

  if (!winnerId) {
    return classNames.join(' ');
  }

  if (winnerId === teamId) {
    classNames.push('team-row--winner');
    return classNames.join(' ');
  }

  classNames.push('team-row--loser');
  return classNames.join(' ');
}
