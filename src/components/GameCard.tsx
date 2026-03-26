import { formatOdds } from '../lib/formatOdds';
import type { NbaGame, NbaTeam, OddsFormat } from '../types';

interface GameCardProps {
  game: NbaGame;
  homeTeam: NbaTeam;
  awayTeam: NbaTeam;
  selectedWinnerId: number | undefined;
  oddsFormat: OddsFormat;
  justPicked: boolean;
  onPick: (gameId: number, teamId: number) => void;
}

export function GameCard({
  game,
  homeTeam,
  awayTeam,
  selectedWinnerId,
  oddsFormat,
  justPicked,
  onPick,
}: GameCardProps) {
  const winnerId = game.isCompleted ? game.actualWinnerId : selectedWinnerId;
  const awayProbability = 1 - game.pHomeWins;
  const homeProbability = game.pHomeWins;

  return (
    <article
      className={
        justPicked ? 'game-card game-card--just-picked' : game.isCompleted ? 'game-card game-card--completed' : 'game-card'
      }
    >
      {game.isCompleted ? <span className="game-card__final">Final</span> : null}

      <button
        type="button"
        className={rowClassName(awayTeam.id, winnerId)}
        onClick={() => onPick(game.gameId, awayTeam.id)}
        disabled={game.isCompleted}
      >
        <img className="team-logo" src={awayTeam.logoUrl} alt={awayTeam.name} loading="lazy" />
        <div className="team-row__identity">
          <span className="team-row__abbr">{awayTeam.abbr}</span>
          <span className="team-row__name">{awayTeam.name}</span>
        </div>
        <span className="team-row__odds">{formatOdds(awayProbability, oddsFormat)}</span>
      </button>

      <button
        type="button"
        className={rowClassName(homeTeam.id, winnerId)}
        onClick={() => onPick(game.gameId, homeTeam.id)}
        disabled={game.isCompleted}
      >
        <img className="team-logo" src={homeTeam.logoUrl} alt={homeTeam.name} loading="lazy" />
        <div className="team-row__identity">
          <span className="team-row__abbr">{homeTeam.abbr}</span>
          <span className="team-row__name">{homeTeam.name}</span>
          <span className="team-row__home">Home</span>
        </div>
        <span className="team-row__odds">{formatOdds(homeProbability, oddsFormat)}</span>
      </button>
    </article>
  );
}

function rowClassName(teamId: number, winnerId: number | undefined): string {
  if (!winnerId) {
    return 'team-row';
  }

  if (winnerId === teamId) {
    return 'team-row team-row--winner';
  }

  return 'team-row team-row--loser';
}
