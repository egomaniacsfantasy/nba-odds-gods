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
  isMobile: boolean;
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
  isMobile,
  onPick,
}: ScheduleViewProps) {
  return (
    <div className="schedule-view">
      {showPickHint && isMobile ? (
        <div className="mobile-hint-toast">Tap a team to pick the winner of each game</div>
      ) : null}

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
          showPickHint={showPickHint && !isMobile}
          onPick={onPick}
        />
      ))}
    </div>
  );
}
