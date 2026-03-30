// Auto-generated PredictorTab.tsx — do not edit manually
// Updated: 2026-03-29
import { useState, useMemo } from 'react';
import { getMatchupProb } from '../data/nbaMatchupProbs';
import { NBA_TEAMS } from '../data/nbaTeams';
import type { OddsFormat } from '../types';
import { formatOdds } from '../lib/formatOdds';

interface PredictorTabProps {
  oddsFormat: OddsFormat;
}

type HomeCourt = 'A' | 'neutral' | 'B';

const _HC_HOME = new Set([1, 2, 5, 7]); // NBA 2-2-1-1-1 games at home-court arena

function computeSeriesOutcomes(
  aId: number, bId: number, homeCourt: HomeCourt,
): Record<string, number> {
  const aHC = homeCourt === 'A';
  const res: Record<string, number> = {};
  function walk(aw: number, bw: number, p: number): void {
    if (aw === 4 || bw === 4) { res[`${aw}-${bw}`] = (res[`${aw}-${bw}`] ?? 0) + p; return; }
    const g = aw + bw + 1;
    const aHome = aHC ? _HC_HOME.has(g) : !_HC_HOME.has(g);
    const pa = getMatchupProb(aId, bId, aHome ? 'home' : 'away');
    walk(aw + 1, bw, p * pa);
    walk(aw, bw + 1, p * (1 - pa));
  }
  walk(0, 0, 1.0);
  return res;
}

const SORTED_TEAMS = [...NBA_TEAMS].sort((a, b) => a.name.localeCompare(b.name));

function alternateOddsFormat(oddsFormat: OddsFormat): OddsFormat {
  return oddsFormat === 'implied' ? 'american' : 'implied';
}

function oddsPair(probability: number, oddsFormat: OddsFormat): { primary: string; secondary: string } {
  return {
    primary: formatOdds(probability, oddsFormat),
    secondary: formatOdds(probability, alternateOddsFormat(oddsFormat)),
  };
}

export function PredictorTab({ oddsFormat }: PredictorTabProps) {
  const defaultA = SORTED_TEAMS.find(t => t.abbr === 'OKC')?.id ?? SORTED_TEAMS[0].id;
  const defaultB = SORTED_TEAMS.find(t => t.abbr === 'BOS')?.id ?? SORTED_TEAMS[1].id;
  const [teamAId, setTeamAId] = useState(defaultA);
  const [teamBId, setTeamBId] = useState(defaultB);
  const [homeCourt, setHomeCourt] = useState<HomeCourt>('A');

  function handleTeamAChange(id: number) {
    setTeamAId(id);
    if (id === teamBId) setTeamBId(SORTED_TEAMS.find(t => t.id !== id)?.id ?? teamBId);
  }
  function handleTeamBChange(id: number) {
    setTeamBId(id);
    if (id === teamAId) setTeamAId(SORTED_TEAMS.find(t => t.id !== id)?.id ?? teamAId);
  }

  const teamA = NBA_TEAMS.find(t => t.id === teamAId)!;
  const teamB = NBA_TEAMS.find(t => t.id === teamBId)!;

  const loc = homeCourt === 'A' ? 'home' : homeCourt === 'B' ? 'away' : 'neutral';
  const pA = useMemo(() => getMatchupProb(teamAId, teamBId, loc), [teamAId, teamBId, loc]);
  const pB = 1 - pA;

  const series = useMemo(
    () => teamAId !== teamBId && homeCourt !== 'neutral'
      ? computeSeriesOutcomes(teamAId, teamBId, homeCourt)
      : null,
    [teamAId, teamBId, homeCourt],
  );

  const pAWinsSeries = series
    ? ['4-0','4-1','4-2','4-3'].reduce((s, k) => s + (series[k] ?? 0), 0)
    : 0.5;
  const pBWinsSeries = 1 - pAWinsSeries;

  const OUTCOMES_A = ['4-0','4-1','4-2','4-3'] as const;
  const OUTCOMES_B = ['0-4','1-4','2-4','3-4'] as const;

  const cellStyle = {
    background: 'var(--bg-subtle)', borderRadius: 6, padding: '8px 4px', textAlign: 'center' as const,
  };

  return (
    <div className="predictor-shell">
      <section className="side-panel-section">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Oracle Analytics</p>
            <h2 className="panel-title">Matchup Predictor</h2>
          </div>
        </div>

        {/* Team selectors */}
        <div className="predictor-select-row">
          <select className="predictor-select" value={teamAId} onChange={(e: { target: { value: string } }) => handleTeamAChange(Number(e.target.value))}>
            {SORTED_TEAMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <span className="predictor-select-vs">vs</span>
          <select className="predictor-select" value={teamBId} onChange={(e: { target: { value: string } }) => handleTeamBChange(Number(e.target.value))}>
            {SORTED_TEAMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="predictor-matchup">
          <div className="predictor-team">
            <span className="predictor-logo-wrap">
              <img
                className="predictor-logo"
                src={teamA.logoUrl}
                alt={teamA.abbr}
                loading="lazy"
                onError={(event: { currentTarget: HTMLImageElement }) => {
                  event.currentTarget.style.display = 'none';
                  const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;

                  if (fallback) {
                    fallback.style.display = 'flex';
                  }
                }}
              />
              <span className="logo-fallback predictor-logo-fallback" style={{ display: 'none' }}>
                {teamA.abbr}
              </span>
            </span>
            <span className="predictor-team-copy">
              <span className="predictor-name">{teamA.name}</span>
              <span className="predictor-abbr">{teamA.abbr}</span>
            </span>
          </div>
          <span className="predictor-vs">vs</span>
          <div className="predictor-team predictor-team--reverse">
            <span className="predictor-team-copy">
              <span className="predictor-name">{teamB.name}</span>
              <span className="predictor-abbr">{teamB.abbr}</span>
            </span>
            <span className="predictor-logo-wrap">
              <img
                className="predictor-logo"
                src={teamB.logoUrl}
                alt={teamB.abbr}
                loading="lazy"
                onError={(event: { currentTarget: HTMLImageElement }) => {
                  event.currentTarget.style.display = 'none';
                  const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;

                  if (fallback) {
                    fallback.style.display = 'flex';
                  }
                }}
              />
              <span className="logo-fallback predictor-logo-fallback" style={{ display: 'none' }}>
                {teamB.abbr}
              </span>
            </span>
          </div>
        </div>

        {/* Home court toggle */}
        <div className="predictor-homecourt-toggle">
          {(['A', 'neutral', 'B'] as HomeCourt[]).map(hc => (
            <button
              key={hc}
              type="button"
              className={homeCourt === hc ? 'conference-toggle__button is-active' : 'conference-toggle__button'}
              onClick={() => setHomeCourt(hc)}
            >
              {hc === 'A' ? `${teamA.abbr} Home` : hc === 'B' ? `${teamB.abbr} Home` : 'Neutral'}
            </button>
          ))}
        </div>

        {/* Single game */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Single Game</p>
          {([{ team: teamA, p: pA }, { team: teamB, p: pB }]).map(({ team, p }) => {
            const values = oddsPair(p, oddsFormat);

            return (
              <div key={team.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={team.logoUrl} alt={team.abbr} width={24} height={24} style={{ display: 'block' }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{team.abbr}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{team.name.replace(team.city + ' ', '')}</span>
                </div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-amber)', minWidth: 52, textAlign: 'right' }}>{values.primary}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)', minWidth: 52, textAlign: 'right' }}>{values.secondary}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Series */}
        {series ? (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>Best of 7 Series</p>
            {([
              { team: teamA, p: pAWinsSeries, outs: OUTCOMES_A, isA: true },
              { team: teamB, p: pBWinsSeries, outs: OUTCOMES_B, isA: false },
            ]).map(({ team, p, outs, isA }) => {
              const values = oddsPair(p, oddsFormat);

              return (
                <div key={team.id} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img src={team.logoUrl} alt={team.abbr} width={20} height={20} style={{ display: 'block' }} />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{team.abbr} wins series</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-amber)', minWidth: 52, textAlign: 'right' }}>{values.primary}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)', minWidth: 52, textAlign: 'right' }}>{values.secondary}</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {outs.map(k => {
                      const [hw, lw] = k.split('-').map(Number);
                      const games = hw + lw;
                      const score = isA ? `${teamA.abbr} 4-${lw}` : `${teamB.abbr} 4-${hw}`;
                      return (
                        <div key={k} style={cellStyle}>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                            {games === 4 ? 'Sweep' : `In ${games}`}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>{score}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {((series[k] ?? 0) * 100).toFixed(1)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
            Select a home team above to see series predictions.
          </p>
        )}
      </section>
    </div>
  );
}
