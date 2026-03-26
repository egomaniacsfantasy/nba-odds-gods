import { formatDelta, formatProbabilityCell } from '../lib/formatOdds';
import type {
  AdvancementSortKey,
  NbaTeam,
  OddsFormat,
  SortDirection,
  TeamAdvancement,
} from '../types';

interface AdvancementPanelProps {
  rows: TeamAdvancement[];
  teamsById: Map<number, NbaTeam>;
  oddsFormat: OddsFormat;
  sortKey: AdvancementSortKey;
  sortDirection: SortDirection;
  deltaMap: Map<string, number>;
  isSimulating: boolean;
  onSort: (sortKey: AdvancementSortKey) => void;
}

const PROBABILITY_COLUMNS: Array<{
  key: AdvancementSortKey;
  label: string;
}> = [
  { key: 'pTop6', label: 'Top 6' },
  { key: 'pPlayIn', label: 'Play-In' },
  { key: 'pMakesPlayoffs', label: 'Playoffs' },
  { key: 'pWinsR1', label: 'R1' },
  { key: 'pConfFinals', label: 'Conf' },
  { key: 'pFinals', label: 'Finals' },
  { key: 'pChampion', label: 'Champ' },
];

export function AdvancementPanel({
  rows,
  teamsById,
  oddsFormat,
  sortKey,
  sortDirection,
  deltaMap,
  isSimulating,
  onSort,
}: AdvancementPanelProps) {
  const confidenceBand = rows.slice(0, 8);

  return (
    <section className="side-panel-section">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Monte Carlo</p>
          <h2 className="panel-title">Advancement Probabilities</h2>
        </div>
        <span className={isSimulating ? 'sim-badge is-busy' : 'sim-badge'}>{isSimulating ? 'Simulating' : 'Live'}</span>
      </div>

      <div className="advancement-table-wrap">
        <div className="advancement-table">
          <div className="advancement-table__header">
            <button type="button" className={sortHeaderClass(sortKey, 'team')} onClick={() => onSort('team')}>
              Team
              {sortIndicator(sortKey, 'team', sortDirection)}
            </button>
            <button type="button" className={sortHeaderClass(sortKey, 'seed')} onClick={() => onSort('seed')}>
              Seed
              {sortIndicator(sortKey, 'seed', sortDirection)}
            </button>
            {PROBABILITY_COLUMNS.map((column) => (
              <button
                key={column.key}
                type="button"
                className={sortHeaderClass(sortKey, column.key)}
                onClick={() => onSort(column.key)}
              >
                {column.label}
                {sortIndicator(sortKey, column.key, sortDirection)}
              </button>
            ))}
          </div>

          {rows.map((row) => {
            const team = teamsById.get(row.teamId);

            if (!team) {
              return null;
            }

            return (
              <div key={row.teamId} className="advancement-row">
                <div className="advancement-team">
                  <img className="advancement-logo" src={team.logoUrl} alt={team.name} loading="lazy" />
                  <span>{team.abbr}</span>
                </div>
                <div className="advancement-seed">{row.seedLabel}</div>
                {PROBABILITY_COLUMNS.map((column) => (
                  <div
                    key={column.key}
                    className={probabilityClassName(row[column.key as keyof TeamAdvancement] as number)}
                  >
                    <span>{formatProbabilityCell(row[column.key as keyof TeamAdvancement] as number, oddsFormat)}</span>
                    {renderDelta(deltaMap.get(`${row.teamId}:${column.key}`), oddsFormat)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="confidence-band">
        {confidenceBand.map((row) => {
          const team = teamsById.get(row.teamId);

          if (!team) {
            return null;
          }

          return (
            <p key={row.teamId} className="confidence-band__row">
              {team.abbr}: Currently {row.seedLabel} seed · {Math.round(row.pTop6 * 100)}% top-6 ·{' '}
              {Math.round(row.pPlayIn * 100)}% play-in
            </p>
          );
        })}
      </div>
    </section>
  );
}

function sortHeaderClass(activeSort: AdvancementSortKey, headerKey: AdvancementSortKey): string {
  return activeSort === headerKey ? 'advancement-header is-active' : 'advancement-header';
}

function sortIndicator(
  activeSort: AdvancementSortKey,
  headerKey: AdvancementSortKey,
  direction: SortDirection,
): string | null {
  if (activeSort !== headerKey) {
    return null;
  }

  return direction === 'desc' ? ' ▼' : ' ▲';
}

function probabilityClassName(value: number): string {
  if (value >= 0.75) {
    return 'advancement-cell probability-band probability-band--high';
  }

  if (value >= 0.5) {
    return 'advancement-cell probability-band probability-band--mid-high';
  }

  if (value >= 0.25) {
    return 'advancement-cell probability-band probability-band--mid';
  }

  if (value >= 0.05) {
    return 'advancement-cell probability-band probability-band--low';
  }

  return 'advancement-cell advancement-cell--dim';
}

function renderDelta(delta: number | undefined, oddsFormat: OddsFormat) {
  if (!delta || Math.abs(delta) < 0.001) {
    return null;
  }

  return (
    <span className={delta >= 0 ? 'delta-indicator delta-indicator--positive' : 'delta-indicator delta-indicator--negative'}>
      {formatDelta(delta, oddsFormat)}
    </span>
  );
}
