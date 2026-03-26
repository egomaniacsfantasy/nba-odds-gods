import { DateGroup } from './DateGroup';
import type { LockedPicks, NbaGame, NbaTeam, OddsFormat } from '../types';

interface ScheduleViewProps {
  groupedGames: Array<{ date: string; games: NbaGame[] }>;
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

export function ScheduleView({
  groupedGames,
  lockedPicks,
  teamsById,
  oddsFormat,
  justPickedKey,
  firstHintGameId,
  showPickHint,
  simSweepDelays,
  disableInteractions,
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
          justPickedKey={justPickedKey}
          firstHintGameId={firstHintGameId}
          showPickHint={showPickHint}
          simSweepDelays={simSweepDelays}
          disableInteractions={disableInteractions}
          onPick={onPick}
        />
      ))}
    </div>
  );
}
