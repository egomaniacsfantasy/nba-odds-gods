// Auto-generated TeamDataTab.tsx — do not edit manually
// Updated: 2026-03-28
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
  markovRank: 'Markov ranking (lower = better)',
  elo: 'Elo rating',
  offRtg: 'Season offensive rating', defRtg: 'Season defensive rating', netRtg: 'Season net rating',
  l10Off: 'Last-10 offensive rating', l10Def: 'Last-10 defensive rating', l10Net: 'Last-10 net rating',
  l10EfgPct: 'Last-10 effective FG%',
  efgPct: 'Season effective FG%', orebPct: 'Offensive rebound rate', threePaRate: '3-point attempt rate',
  bpm: 'Team box plus/minus', pace: 'Pace (possessions/48)',
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

const COL_W = 58; // px per stat column

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
  const gridCols = `28px 56px repeat(${ncols}, ${COL_W}px)`;

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
    <div style={{ maxWidth: 100 + 56 + ncols * COL_W + 32, margin: '0 auto', padding: '0 16px 32px' }}>
      <section className="side-panel-section">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Oracle Analytics</p>
            <h2 className="panel-title">Team Stats</h2>
          </div>
        </div>

        {/* Group selector */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
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
        <div className="standings-table">
          {/* Header row */}
          <div
            className="standings-table__header"
            style={{ gridTemplateColumns: gridCols }}
          >
            <span />
            <span style={{ textAlign: 'left', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Team</span>
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
            return (
              <div key={row.id} className="standings-row" style={{ gridTemplateColumns: gridCols }}>
                <span className="logo-col">
                  {team && (
                    <img src={team.logoUrl} alt={row.abbr} width="20" height="20" loading="lazy"
                      style={{ display: 'block' }}
                    />
                  )}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{row.abbr}</span>
                {group.cols.map((col) => (
                  <span
                    key={col}
                    style={{
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: sortKey === col ? 'var(--text-amber)' : 'var(--text-secondary)',
                    }}
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
