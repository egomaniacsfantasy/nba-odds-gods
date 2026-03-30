// Auto-generated PredictorTab.tsx — do not edit manually
// Updated: 2026-03-29
import { useMemo, useState, type CSSProperties } from 'react';
import { getMatchupProb } from '../data/nbaMatchupProbs';
import { NBA_TEAMS } from '../data/nbaTeams';
import type { NbaTeam, OddsFormat } from '../types';
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

function probabilityFillStyle(probability: number): CSSProperties {
  return { '--prob-width': `${(probability * 100).toFixed(1)}%` } as CSSProperties;
}

function TeamLogo({
  team,
  className,
  fallbackClassName,
}: {
  team: NbaTeam;
  className: string;
  fallbackClassName: string;
}) {
  return (
    <>
      <img
        className={className}
        src={team.logoUrl}
        alt={team.abbr}
        loading="lazy"
        onError={(event: { currentTarget: HTMLImageElement }) => {
          event.currentTarget.style.display = 'none';
          const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;

          if (fallback) {
            fallback.style.display = 'flex';
          }
        }}
      />
      <span className={`logo-fallback ${fallbackClassName}`} style={{ display: 'none' }}>
        {team.abbr}
      </span>
    </>
  );
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

  const singleGameRows = [
    { team: teamA, probability: pA, isFavorite: pA >= pB },
    { team: teamB, probability: pB, isFavorite: pB > pA },
  ];

  const mostLikelyA = series
    ? OUTCOMES_A.reduce((best, outcome) => ((series[outcome] ?? 0) > (series[best] ?? 0) ? outcome : best), OUTCOMES_A[0])
    : OUTCOMES_A[0];
  const mostLikelyB = series
    ? OUTCOMES_B.reduce((best, outcome) => ((series[outcome] ?? 0) > (series[best] ?? 0) ? outcome : best), OUTCOMES_B[0])
    : OUTCOMES_B[0];

  return (
    <div className="predictor-shell">
      <div className="predictor-container">
        <div className="predictor-select-row">
          <select className="predictor-select" value={teamAId} onChange={(e: { target: { value: string } }) => handleTeamAChange(Number(e.target.value))}>
            {SORTED_TEAMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <span className="predictor-select-vs">vs</span>
          <select className="predictor-select" value={teamBId} onChange={(e: { target: { value: string } }) => handleTeamBChange(Number(e.target.value))}>
            {SORTED_TEAMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="predictor-arena">
          <div className="arena-team arena-team-left">
            <span className="arena-logo-wrap">
              <TeamLogo team={teamA} className="arena-logo" fallbackClassName="arena-logo-fallback" />
            </span>
            <span className="arena-abbr">{teamA.abbr}</span>
            <span className="arena-name">{teamA.city}</span>
          </div>
          <div className="arena-center">
            <span className="arena-vs">VS</span>
          </div>
          <div className="arena-team arena-team-right">
            <span className="arena-logo-wrap">
              <TeamLogo team={teamB} className="arena-logo" fallbackClassName="arena-logo-fallback" />
            </span>
            <span className="arena-abbr">{teamB.abbr}</span>
            <span className="arena-name">{teamB.city}</span>
          </div>
          <div className="arena-prob-bar" aria-hidden="true">
            <div className="arena-prob-fill" style={{ width: `${(pA * 100).toFixed(1)}%` }} />
          </div>
        </div>

        <div className="venue-toggle" role="tablist" aria-label="Venue toggle">
          {(['A', 'neutral', 'B'] as HomeCourt[]).map(hc => (
            <button
              key={hc}
              type="button"
              className={homeCourt === hc ? 'venue-toggle-btn active' : 'venue-toggle-btn'}
              onClick={() => setHomeCourt(hc)}
            >
              {hc === 'A' ? `${teamA.abbr} Home` : hc === 'B' ? `${teamB.abbr} Home` : 'Neutral'}
            </button>
          ))}
        </div>

        <section className="predictor-panel">
          <p className="predictor-section-label">Single Game</p>
          {singleGameRows.map(({ team, probability, isFavorite }) => {
            const values = oddsPair(probability, oddsFormat);
            const className = isFavorite
              ? 'predictor-result-row is-favorite'
              : 'predictor-result-row is-underdog';

            return (
              <div key={team.id} className={className} style={probabilityFillStyle(probability)}>
                <div className="predictor-row-team">
                  <span className="predictor-row-logo-wrap">
                    <TeamLogo team={team} className="team-logo predictor-row-logo" fallbackClassName="predictor-row-logo-fallback" />
                  </span>
                  <div className="predictor-row-copy">
                    <span className="predictor-row-abbr">{team.abbr}</span>
                    <span className="predictor-row-name">{team.name}</span>
                  </div>
                </div>
                <div className="predictor-row-values">
                  <span className="predictor-prob">{values.primary}</span>
                  <span className="predictor-odds">{values.secondary}</span>
                </div>
              </div>
            );
          })}
        </section>

        <section className="predictor-panel">
          <p className="predictor-section-label">Best of 7 Series</p>
          {series ? (
            <div className="predictor-series-stack">
              {([
                { team: teamA, probability: pAWinsSeries, outcomes: OUTCOMES_A, isA: true, mostLikely: mostLikelyA },
                { team: teamB, probability: pBWinsSeries, outcomes: OUTCOMES_B, isA: false, mostLikely: mostLikelyB },
              ]).map(({ team, probability, outcomes, isA, mostLikely }) => {
                const values = oddsPair(probability, oddsFormat);

                return (
                  <div key={team.id} className="predictor-series-card">
                    <div className="predictor-series-header">
                      <div className="predictor-row-team">
                        <span className="predictor-row-logo-wrap">
                          <TeamLogo team={team} className="team-logo predictor-row-logo" fallbackClassName="predictor-row-logo-fallback" />
                        </span>
                        <div className="predictor-row-copy">
                          <span className="predictor-row-abbr">{team.abbr}</span>
                          <span className="predictor-series-title">{team.abbr} wins series</span>
                        </div>
                      </div>
                      <div className="predictor-row-values">
                        <span className="predictor-prob">{values.primary}</span>
                        <span className="predictor-odds">{values.secondary}</span>
                      </div>
                    </div>

                    <div className="series-length-grid">
                      {outcomes.map(outcome => {
                        const [aWins, bWins] = outcome.split('-').map(Number);
                        const games = aWins + bWins;
                        const detail = isA ? `${teamA.abbr} 4-${bWins}` : `${teamB.abbr} 4-${aWins}`;
                        const probabilityValue = series[outcome] ?? 0;
                        const columnClassName = outcome === mostLikely
                          ? 'series-length-col most-likely'
                          : 'series-length-col';

                        return (
                          <div key={outcome} className={columnClassName}>
                            <span className="series-length-label">{games === 4 ? 'Sweep' : `In ${games}`}</span>
                            <span className="series-length-detail">{detail}</span>
                            <span className="series-length-prob">{(probabilityValue * 100).toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="predictor-note">Select a home team above to see series predictions.</p>
          )}
        </section>
      </div>
    </div>
  );
}
