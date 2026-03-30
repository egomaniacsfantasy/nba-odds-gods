// Auto-generated TeamDataTab.tsx — do not edit manually
// Updated: 2026-03-29
import { useState } from 'react';
import type { NbaTeamData } from '../data/nbaTeamData';
import { NBA_TEAM_DATA } from '../data/nbaTeamData';
import { NBA_TEAM_LOOKUP } from '../data/nbaTeams';

type SortKey = keyof Omit<NbaTeamData, 'id' | 'abbr'>;

const COL_GROUPS: { label: string; cols: SortKey[] }[] = [
  { label: 'Rankings',      cols: ['markovRank'] },
  { label: 'Efficiency',    cols: ['offRtg', 'defRtg', 'netRtg'] },
  { label: 'Last 10',       cols: ['l10Off', 'l10Def', 'l10Net', 'l10EfgPct'] },
  { label: 'Four Factors',  cols: ['efgPct', 'orebPct', 'threePaRate'] },
  { label: 'Advanced',      cols: ['elo', 'bpm', 'pace'] },
];

const COL_LABELS: Record<SortKey, string> = {
  markovRank: 'Markov',
  elo: 'Elo',
  offRtg: 'Off', defRtg: 'Def', netRtg: 'Net',
  l10Off: 'Off', l10Def: 'Def', l10Net: 'Net', l10EfgPct: 'eFG%',
  efgPct: 'eFG%', orebPct: 'ORB%', threePaRate: '3PAr',
  bpm: 'BPM', pace: 'Pace',
};

const COL_DESCS: Record<SortKey, string> = {
  markovRank: 'Markov chain ranking — probabilistic model estimating team strength from game-by-game results; lower is better',
  elo: 'Elo rating — strength estimate updated by opponent quality and game results',
  offRtg: 'Offensive rating — points scored per 100 possessions',
  defRtg: 'Defensive rating — points allowed per 100 possessions',
  netRtg: 'Net rating — offensive rating minus defensive rating',
  l10Off: 'Last 10 games offensive rating — points scored per 100 possessions',
  l10Def: 'Last 10 games defensive rating — points allowed per 100 possessions',
  l10Net: 'Last 10 games net rating — offensive rating minus defensive rating',
  l10EfgPct: 'Last 10 games effective field goal percentage',
  efgPct: 'Effective field goal percentage — adjusts for the added value of 3-pointers',
  orebPct: 'Offensive rebound percentage — share of available offensive rebounds secured',
  threePaRate: '3-point attempt rate — share of field-goal attempts taken from 3',
  bpm: 'Box Plus/Minus — estimated point differential contribution per 100 possessions',
  pace: 'Pace — estimated possessions per 48 minutes',
};

// Columns where lower value = better (sort ascending by default)
const LOWER_BETTER = new Set<SortKey>(['markovRank', 'defRtg', 'l10Def']);

const PCT_COLS   = new Set<SortKey>(['efgPct', 'orebPct', 'l10EfgPct', 'threePaRate']);
const INT_COLS   = new Set<SortKey>(['elo', 'markovRank']);
const SIGNED_COLS = new Set<SortKey>(['netRtg', 'l10Net', 'bpm']);

function fmt(key: SortKey, val: number): string {
  if (PCT_COLS.has(key))    return (val * 100).toFixed(1) + '%';
  if (INT_COLS.has(key))    return Math.round(val).toString();
  if (SIGNED_COLS.has(key)) return (val >= 0 ? '+' : '') + val.toFixed(1);
  return val.toFixed(1);
}

export function TeamDataTab() {
  const [activeGroup, setActiveGroup] = useState(0);
  const [sortKey, setSortKey]   = useState<SortKey>('markovRank');
  const [sortAsc, setSortAsc]   = useState(true);

  function handleGroupChange(idx: number) {
    setActiveGroup(idx);
    const first = COL_GROUPS[idx].cols[0];
    setSortKey(first);
    setSortAsc(LOWER_BETTER.has(first));
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) { setSortAsc((a) => !a); }
    else { setSortKey(key); setSortAsc(LOWER_BETTER.has(key)); }
  }

  const group  = COL_GROUPS[activeGroup];
  const ncols  = group.cols.length;
  const gridCols = `32px minmax(120px, 1.5fr) repeat(${ncols}, minmax(86px, 1fr))`;

  const sorted = [...NBA_TEAM_DATA].sort((a, b) => {
    const d = (a[sortKey] as number) - (b[sortKey] as number);
    return sortAsc ? d : -d;
  });

  const hdrBtn = {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%',
    fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase' as const, textAlign: 'center' as const,
  };

  return (
    <div className="stats-table-container">
      <section className="side-panel-section">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Oracle Analytics</p>
            <h2 className="panel-title">Team Stats</h2>
          </div>
        </div>

        {/* Group selector */}
        <div className="stats-group-selector">
          {COL_GROUPS.map((g, i) => (
            <button
              key={g.label}
              type="button"
              className={i === activeGroup ? 'conference-toggle__button is-active' : 'conference-toggle__button'}
              onClick={() => handleGroupChange(i)}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="standings-table stats-table">
          {/* Header row */}
          <div
            className="standings-table__header stats-table__header"
            style={{ gridTemplateColumns: gridCols }}
          >
            <span />
            <span className="stats-team-header">Team</span>
            {group.cols.map((col) => (
              <button
                key={col}
                type="button"
                title={COL_DESCS[col]}
                onClick={() => handleSort(col)}
                style={{
                  ...hdrBtn,
                  color: sortKey === col ? 'var(--text-amber)' : 'var(--text-tertiary)',
                }}
              >
                {COL_LABELS[col]}{sortKey === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
              </button>
            ))}
          </div>

          {/* Data rows */}
          {sorted.map((row) => {
            const team = NBA_TEAM_LOOKUP.get(row.id);
            const shortName = team ? team.name.replace(`${team.city} `, '') : row.abbr;

            return (
              <div key={row.id} className="standings-row stats-table__row" style={{ gridTemplateColumns: gridCols }}>
                <span className="logo-col">
                  {team && (
                    <span className="team-logo-wrap">
                      <img
                        className="standings-logo"
                        src={team.logoUrl}
                        alt={row.abbr}
                        width="20"
                        height="20"
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
                        {row.abbr}
                      </span>
                    </span>
                  )}
                </span>
                <span className="stats-team-cell">
                  <span className="stats-team-abbr">{row.abbr}</span>
                  <span className="stats-team-name">{shortName}</span>
                </span>
                {group.cols.map((col) => (
                  <span
                    key={col}
                    className={sortKey === col ? 'stats-cell stats-cell--active' : 'stats-cell'}
                  >
                    {fmt(col, row[col] as number)}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
