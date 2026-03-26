import { formatGamesBack, formatWinPct } from '../lib/formatOdds';
import type { ConferenceKey, NbaTeam, StandingsRow } from '../types';

interface StandingsTableProps {
  east: StandingsRow[];
  west: StandingsRow[];
  teamsById: Map<number, NbaTeam>;
  activeConference: ConferenceKey;
  changedTeamIds: number[];
  onConferenceChange: (conference: ConferenceKey) => void;
}

export function StandingsTable({
  east,
  west,
  teamsById,
  activeConference,
  changedTeamIds,
  onConferenceChange,
}: StandingsTableProps) {
  const rows = activeConference === 'East' ? east : west;

  return (
    <section className="side-panel-section">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Live Standings</p>
          <h2 className="panel-title">Projected Seeds</h2>
        </div>

        <div className="conference-toggle" role="group" aria-label="Conference selection">
          <button
            type="button"
            className={activeConference === 'East' ? 'conference-toggle__button is-active' : 'conference-toggle__button'}
            onClick={() => onConferenceChange('East')}
          >
            Eastern
          </button>
          <button
            type="button"
            className={activeConference === 'West' ? 'conference-toggle__button is-active' : 'conference-toggle__button'}
            onClick={() => onConferenceChange('West')}
          >
            Western
          </button>
        </div>
      </div>

      <div className="standings-table">
        <div className="standings-table__header">
          <span className="logo-col" />
          <span className="team-col">Team</span>
          <span className="num-col">W</span>
          <span className="num-col">L</span>
          <span className="pct-col">PCT</span>
          <span className="gb-col">GB</span>
          <span className="seed-col">Seed</span>
        </div>

        {rows.map((row, index) => {
          const team = teamsById.get(row.teamId);

          if (!team) {
            return null;
          }

          const classes = [
            'standings-row',
            changedTeamIds.includes(row.teamId) ? 'standings-row--changed' : '',
            index === 5 ? 'standings-row--playoff-line' : '',
            index === 9 ? 'standings-row--playin-line' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={row.teamId} className={classes}>
              <span className="logo-col">
                <img className="standings-logo" src={team.logoUrl} alt={team.name} loading="lazy" />
              </span>
              <span className="team-col">
                <span className="standings-team__abbr">{team.abbr}</span>
                <span className="standings-team__division">{team.division.slice(0, 1)}</span>
              </span>
              <span className="num-col">{row.wins}</span>
              <span className="num-col">{row.losses}</span>
              <span className="pct-col">{formatWinPct(row.winPct)}</span>
              <span className="gb-col">{formatGamesBack(row.gamesBack)}</span>
              <span className={seedClassName(index + 1)}>{row.isPlayIn ? `${index + 1} PI` : `${index + 1}`}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function seedClassName(seed: number): string {
  if (seed <= 6) {
    return 'seed-col seed-col--playoff';
  }

  if (seed <= 10) {
    return 'seed-col seed-col--playin';
  }

  return 'seed-col seed-col--out';
}
