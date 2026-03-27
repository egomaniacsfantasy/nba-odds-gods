// Auto-generated AdvancementPanel.tsx — do not edit manually
// Updated: 2026-03-27
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
  { key: 'pMakesPlayoffs', label: 'Playoffs' },
  { key: 'pWinsR1', label: 'R2' },
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
  return (
    <section
      className={isSimulating ? 'side-panel-section advancement-panel advancement-panel--simulating' : 'side-panel-section advancement-panel'}
    >
      <div className="panel-header">
        <div>
          <p className="advancement-panel-header">Oracle Futures</p>
          <h2 className="panel-title">Advancement Probabilities</h2>
        </div>
        <span className={isSimulating ? 'sim-badge is-busy' : 'sim-badge'}>
          {isSimulating ? 'Simulating' : 'Live'}
        </span>
      </div>

      <div className="advancement-table-wrap">
        <table className="advancement-table">
          <thead>
            <tr>
              <th className={sortHeaderClass(sortKey, 'team')} onClick={() => onSort('team')}>
                Team
                {sortIndicator(sortKey, 'team', sortDirection)}
              </th>
              <th className={sortHeaderClass(sortKey, 'seed')} onClick={() => onSort('seed')}>
                Seed
                {sortIndicator(sortKey, 'seed', sortDirection)}
              </th>
              {PROBABILITY_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className={sortHeaderClass(sortKey, column.key)}
                  onClick={() => onSort(column.key)}
                >
                  {column.label}
                  {sortIndicator(sortKey, column.key, sortDirection)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const team = teamsById.get(row.teamId);

              if (!team) {
                return null;
              }

              return (
                <tr key={row.teamId}>
                  <td className="advancement-team-cell">
                    <span className="team-logo-wrap">
                      <img
                        className="advancement-logo"
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
                      <span className="logo-fallback advancement-logo-fallback" style={{ display: 'none' }}>
                        {team.abbr}
                      </span>
                    </span>
                    <span>{team.abbr}</span>
                  </td>
                  <td>{formatSeed(row)}</td>
                  {PROBABILITY_COLUMNS.map((column) => (
                    <td
                      key={column.key}
                      className={`${probabilityClassName(row[column.key as keyof TeamAdvancement] as number)} ${
                        column.key === 'pChampion' ? 'champ-cell' : ''
                      }`}
                    >
                      <span>{formatProbabilityCell(row[column.key as keyof TeamAdvancement] as number, oddsFormat)}</span>
                      {renderDelta(deltaMap.get(`${row.teamId}:${column.key}`), oddsFormat)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function sortHeaderClass(activeSort: AdvancementSortKey, headerKey: AdvancementSortKey): string {
  return activeSort === headerKey ? 'sorted' : '';
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
  if (value >= 0.5) {
    return 'prob-high';
  }

  if (value >= 0.2) {
    return 'prob-medium';
  }

  if (value >= 0.05) {
    return 'prob-low';
  }

  return value < 0.01 ? 'prob-zero' : '';
}

function renderDelta(delta: number | undefined, oddsFormat: OddsFormat) {
  if (!delta || Math.abs(delta) < 0.005) {
    return null;
  }

  return <span className={delta >= 0 ? 'delta-badge delta-up' : 'delta-badge delta-down'}>{formatDelta(delta, oddsFormat)}</span>;
}

function formatSeed(row: TeamAdvancement): string {
  if (row.seed === null) {
    return '—';
  }

  if (row.seed >= 7 && row.seed <= 10) {
    return 'PI';
  }

  return `${row.seed}`;
}
