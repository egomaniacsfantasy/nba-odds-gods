import type { NbaTeam, StandingsRow } from '../types';

interface PlayoffLockedTabProps {
  unlocked: boolean;
  pickedCount: number;
  totalCount: number;
  east: StandingsRow[];
  west: StandingsRow[];
  teamsById: Map<number, NbaTeam>;
  onBack: () => void;
}

export function PlayoffLockedTab({
  unlocked,
  pickedCount,
  totalCount,
  east,
  west,
  teamsById,
  onBack,
}: PlayoffLockedTabProps) {
  const percentage = totalCount === 0 ? 0 : Math.round((pickedCount / totalCount) * 100);

  return (
    <section className="playoff-locked">
      <div className="playoff-locked__card">
        <p className="playoff-locked__icon">{unlocked ? 'Ready' : 'Locked'}</p>
        <h2>{unlocked ? 'Playoff bracket coming soon' : '🔒 PLAYOFFS LOCKED'}</h2>
        <p className="playoff-locked__copy">
          {unlocked
            ? 'All regular season games are picked. Sprint 2 will turn this into the full interactive bracket.'
            : 'The Oracle requires all regular season games before revealing the playoff path.'}
        </p>

        {!unlocked ? (
          <>
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
          </>
        ) : (
          <div className="playoffs-preview">
            <h2>Projected Playoff Field</h2>
            <p className="coming-soon">Interactive playoff rounds arrive in the next sprint.</p>

            <div className="playoff-preview">
              <div>
                <h3>Eastern Conference</h3>
                {east.slice(0, 8).map((row, index) => {
                  const team = teamsById.get(row.teamId);

                  return (
                    <div key={row.teamId} className="seed-card">
                      <span className="seed-number">{index + 1}</span>
                      <span className="team-logo-wrap">
                        <img
                          className="seed-logo"
                          src={team?.logoUrl}
                          alt={team?.name ?? String(row.teamId)}
                          loading="lazy"
                          onError={(event: { currentTarget: HTMLImageElement }) => {
                            event.currentTarget.style.display = 'none';
                            const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;

                            if (fallback) {
                              fallback.style.display = 'flex';
                            }
                          }}
                        />
                        <span className="logo-fallback seed-logo-fallback" style={{ display: 'none' }}>
                          {team?.abbr ?? row.teamId}
                        </span>
                      </span>
                      <div className="seed-info">
                        <div className="seed-name">{team?.name ?? row.teamId}</div>
                        {index >= 6 ? <div className="seed-note">Play-In Winner</div> : null}
                      </div>
                      <span className="seed-record">
                        {row.wins}-{row.losses}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div>
                <h3>Western Conference</h3>
                {west.slice(0, 8).map((row, index) => {
                  const team = teamsById.get(row.teamId);

                  return (
                    <div key={row.teamId} className="seed-card">
                      <span className="seed-number">{index + 1}</span>
                      <span className="team-logo-wrap">
                        <img
                          className="seed-logo"
                          src={team?.logoUrl}
                          alt={team?.name ?? String(row.teamId)}
                          loading="lazy"
                          onError={(event: { currentTarget: HTMLImageElement }) => {
                            event.currentTarget.style.display = 'none';
                            const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;

                            if (fallback) {
                              fallback.style.display = 'flex';
                            }
                          }}
                        />
                        <span className="logo-fallback seed-logo-fallback" style={{ display: 'none' }}>
                          {team?.abbr ?? row.teamId}
                        </span>
                      </span>
                      <div className="seed-info">
                        <div className="seed-name">{team?.name ?? row.teamId}</div>
                        {index >= 6 ? <div className="seed-note">Play-In Winner</div> : null}
                      </div>
                      <span className="seed-record">
                        {row.wins}-{row.losses}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
