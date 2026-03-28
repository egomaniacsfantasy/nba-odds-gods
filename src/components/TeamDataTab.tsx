// Auto-generated TeamDataTab.tsx — do not edit manually
// Updated: 2026-03-27
import { useState } from 'react';
import type { NbaTeamData } from '../data/nbaTeamData';
import { NBA_TEAM_DATA } from '../data/nbaTeamData';
import { NBA_TEAM_LOOKUP } from '../data/nbaTeams';

type SortKey = keyof Omit<NbaTeamData, 'id' | 'abbr'>;

const COL_GROUPS: { label: string; cols: SortKey[] }[] = [
  { label: 'Base',         cols: ['gp', 'elo', 'eloTrend', 'eloSos'] },
  { label: 'Season Rtg',   cols: ['offRtg', 'defRtg', 'netRtg'] },
  { label: 'Last 10',      cols: ['l10Off', 'l10Def', 'l10Net', 'l10Pts', 'l10Margin'] },
  { label: 'Four Factors', cols: ['efgPct', 'tovPct', 'orebPct', 'ftRate', 'threePaRate', 'tsPct'] },
  { label: 'Scoring',      cols: ['pts', 'margin', 'pace'] },
  { label: 'Preseason',    cols: ['psNet', 'psOff', 'psDef'] },
  { label: 'Schedule',     cols: ['restDays', 'gamesLast7'] },
  { label: 'BPM',          cols: ['bpm'] },
];

const COL_LABELS: Record<SortKey, string> = {
  gp: 'GP', elo: 'Elo', eloTrend: 'Trend', eloSos: 'SOS',
  offRtg: 'Off', defRtg: 'Def', netRtg: 'Net',
  l10Off: 'Off', l10Def: 'Def', l10Net: 'Net', l10Pts: 'PPG', l10Margin: 'Diff',
  efgPct: 'eFG%', tovPct: 'TOV%', orebPct: 'ORB%', ftRate: 'FTr', threePaRate: '3PAr', tsPct: 'TS%',
  pts: 'PPG', margin: 'Diff', pace: 'Pace',
  psNet: 'Net', psOff: 'Off', psDef: 'Def',
  restDays: 'Rest', gamesLast7: 'GL7',
  bpm: 'BPM',
};

const PCT_COLS = new Set<SortKey>(['efgPct', 'tovPct', 'orebPct', 'tsPct']);
const RATE_COLS = new Set<SortKey>(['ftRate', 'threePaRate']);
const INT_COLS = new Set<SortKey>(['elo', 'eloSos', 'gp', 'restDays', 'gamesLast7']);
const SIGNED_COLS = new Set<SortKey>(['eloTrend', 'netRtg', 'l10Net', 'l10Margin', 'margin', 'psNet', 'bpm']);

function fmt(key: SortKey, val: number): string {
  if (PCT_COLS.has(key)) return (val * 100).toFixed(1) + '%';
  if (RATE_COLS.has(key)) return val.toFixed(3);
  if (INT_COLS.has(key)) return Math.round(val).toString();
  if (SIGNED_COLS.has(key)) return (val >= 0 ? '+' : '') + val.toFixed(1);
  return val.toFixed(1);
}

const ALL_COLS: SortKey[] = COL_GROUPS.flatMap((g) => g.cols);

export function TeamDataTab() {
  const [sortKey, setSortKey] = useState<SortKey>('elo');
  const [sortAsc, setSortAsc] = useState(false);

  function handleSort(key: SortKey) {
    if (key === sortKey) { setSortAsc((a) => !a); }
    else { setSortKey(key); setSortAsc(false); }
  }

  const sorted = [...NBA_TEAM_DATA].sort((a, b) => {
    const d = (a[sortKey] as number) - (b[sortKey] as number);
    return sortAsc ? d : -d;
  });

  return (
    <section className="team-data-tab">
      <div className="team-data-tab__header">
        <h2 className="team-data-tab__title">Team Stats</h2>
        <p className="team-data-tab__sub">Model features snapshot · click any column to sort</p>
      </div>
      <div className="team-data-scroll">
        <table className="team-data-table">
          <thead>
            <tr>
              <th className="td-team-hdr" rowSpan={2}>Team</th>
              {COL_GROUPS.map((g) => (
                <th key={g.label} colSpan={g.cols.length} className="td-group-hdr">{g.label}</th>
              ))}
            </tr>
            <tr>
              {ALL_COLS.map((col) => (
                <th
                  key={col}
                  className={'td-col-hdr' + (sortKey === col ? ' td-sorted' : '')}
                  onClick={() => handleSort(col)}
                >
                  {COL_LABELS[col]}{sortKey === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const team = NBA_TEAM_LOOKUP.get(row.id);
              return (
                <tr key={row.id} className="td-row">
                  <td className="td-team-cell">
                    {team ? (
                      <>
                        <img className="td-logo" src={team.logoUrl} alt={team.abbr} width="18" height="18" loading="lazy" />
                        <span>{team.abbr}</span>
                      </>
                    ) : row.abbr}
                  </td>
                  {ALL_COLS.map((col) => (
                    <td key={col} className={'td-val' + (sortKey === col ? ' td-sorted' : '')}>
                      {fmt(col, row[col] as number)}
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
