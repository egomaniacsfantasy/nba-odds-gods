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
        <h2>{unlocked ? 'Playoff bracket coming soon' : 'Playoffs locked'}</h2>
        <p className="playoff-locked__copy">
          {unlocked
            ? 'All regular season games are picked. Sprint 2 will turn this into the full interactive bracket.'
            : 'Pick all remaining regular season games to unlock the NBA playoff bracket.'}
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
          <div className="playoff-preview">
            <div>
              <h3>East Top 8</h3>
              <ul>
                {east.slice(0, 8).map((row, index) => (
                  <li key={row.teamId}>
                    {index + 1}. {teamsById.get(row.teamId)?.abbr ?? row.teamId}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>West Top 8</h3>
              <ul>
                {west.slice(0, 8).map((row, index) => (
                  <li key={row.teamId}>
                    {index + 1}. {teamsById.get(row.teamId)?.abbr ?? row.teamId}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
