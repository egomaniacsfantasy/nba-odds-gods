import { DateGroup } from './DateGroup';
import type { LockedPicks, NbaGame, NbaTeam, OddsFormat } from '../types';

interface ScheduleViewProps {
  groupedGames: Array<{ date: string; games: NbaGame[] }>;
  lockedPicks: LockedPicks;
  teamsById: Map<number, NbaTeam>;
  oddsFormat: OddsFormat;
  justPickedGameId: number | null;
  onPick: (gameId: number, teamId: number) => void;
}

export function ScheduleView({
  groupedGames,
  lockedPicks,
  teamsById,
  oddsFormat,
  justPickedGameId,
  onPick,
}: ScheduleViewProps) {
  return (
    <div className="schedule-view">
      {groupedGames.map((group) => (
        <DateGroup
          key={group.date}
          date={group.date}
          games={group.games}
          lockedPicks={lockedPicks}
          teamsById={teamsById}
          oddsFormat={oddsFormat}
          justPickedGameId={justPickedGameId}
          onPick={onPick}
        />
      ))}
    </div>
  );
}
