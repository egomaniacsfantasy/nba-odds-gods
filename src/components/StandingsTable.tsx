import { Fragment } from 'react';
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

          const classes = ['standings-row', changedTeamIds.includes(row.teamId) ? 'standings-row--changed' : '']
            .filter(Boolean)
            .join(' ');

          return (
            <Fragment key={row.teamId}>
              <div className={classes} data-seed={index + 1}>
                <span className="logo-col">
                  <span className="team-logo-wrap">
                    <img
                      className="standings-logo"
                      src={team.logoUrl}
                      alt={team.name}
                      loading="lazy"
                      onError={(event: { currentTarget: HTMLImageElement }) => {
                        event.currentTarget.style.display = 'none';
                        const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;

                        if (fallback) {
                          fallback.style.display = 'flex';
                        }
                      }}
                    />
                    <span className="logo-fallback standings-logo-fallback" style={{ display: 'none' }}>
                      {team.abbr}
                    </span>
                  </span>
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

              {index === 5 ? <div className="tier-divider">Play-In</div> : null}
              {index === 9 ? <div className="tier-divider">Eliminated</div> : null}
            </Fragment>
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
