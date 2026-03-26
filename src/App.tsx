import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdvancementPanel } from './components/AdvancementPanel';
import { PlayoffLockedTab } from './components/PlayoffLockedTab';
import { ProgressBar } from './components/ProgressBar';
import { ScheduleView } from './components/ScheduleView';
import { SimControls } from './components/SimControls';
import { StandingsTable } from './components/StandingsTable';
import { ToolNav } from './components/ToolNav';
import { NBA_SCHEDULE } from './data/nbaSchedule';
import { NBA_TEAMS, NBA_TEAM_LOOKUP } from './data/nbaTeams';
import { getSimIterations, simulateNbaFullSeason } from './lib/simulation';
import { cloneLockedPicks, computeProjectedStandings, groupGamesByDate } from './lib/standings';
import type {
  AdvancementSortKey,
  ConferenceKey,
  LockedPicks,
  OddsFormat,
  SimulationResult,
  SortDirection,
  TeamAdvancement,
} from './types';

interface AppProps {
  initialPath: string;
}

const DELTA_FIELDS = [
  'pTop6',
  'pPlayIn',
  'pMakesPlayoffs',
  'pWinsR1',
  'pConfFinals',
  'pFinals',
  'pChampion',
] as const;

function pathToTab(pathname: string): 'schedule' | 'playoffs' {
  return pathname.startsWith('/playoffs') ? 'playoffs' : 'schedule';
}

function hashPicks(lockedPicks: LockedPicks): string {
  return JSON.stringify(Array.from(lockedPicks.entries()).sort((entryA, entryB) => entryA[0] - entryB[0]));
}

function buildFallbackAdvancements(): Map<number, TeamAdvancement> {
  const projected = computeProjectedStandings(new Map(), NBA_SCHEDULE, NBA_TEAMS);
  const rows = [...projected.east, ...projected.west];

  return new Map(
    rows.map((row) => [
      row.teamId,
      {
        teamId: row.teamId,
        seed: row.projectedSeed,
        seedLabel: row.seedLabel,
        pTop6: row.projectedSeed && row.projectedSeed <= 6 ? 1 : 0,
        pPlayIn: row.projectedSeed && row.projectedSeed >= 7 && row.projectedSeed <= 10 ? 1 : 0,
        pMakesPlayoffs: row.projectedSeed ? 1 : 0,
        pWinsR1: 0,
        pConfFinals: 0,
        pFinals: 0,
        pChampion: 0,
      },
    ]),
  );
}

function compareAdvancementRows(
  sortKey: AdvancementSortKey,
  direction: SortDirection,
  rowA: TeamAdvancement,
  rowB: TeamAdvancement,
): number {
  const multiplier = direction === 'desc' ? -1 : 1;

  if (sortKey === 'team') {
    const teamA = NBA_TEAM_LOOKUP.get(rowA.teamId)?.abbr ?? '';
    const teamB = NBA_TEAM_LOOKUP.get(rowB.teamId)?.abbr ?? '';
    return teamA.localeCompare(teamB) * multiplier;
  }

  if (sortKey === 'seed') {
    const seedA = rowA.seed ?? 99;
    const seedB = rowB.seed ?? 99;
    return (seedA - seedB) * (direction === 'desc' ? -1 : 1);
  }

  const valueA = rowA[sortKey] as number;
  const valueB = rowB[sortKey] as number;

  if (valueA === valueB) {
    const teamA = NBA_TEAM_LOOKUP.get(rowA.teamId)?.abbr ?? '';
    const teamB = NBA_TEAM_LOOKUP.get(rowB.teamId)?.abbr ?? '';
    return teamA.localeCompare(teamB);
  }

  return valueA > valueB ? multiplier : -multiplier;
}

export default function App({ initialPath }: AppProps) {
  const [lockedPicks, setLockedPicks] = useState<LockedPicks>(new Map());
  const [undoStack, setUndoStack] = useState<LockedPicks[]>([]);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>(() => {
    const stored = localStorage.getItem('nba-odds-format');
    return stored === 'american' ? 'american' : 'implied';
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeTab, setActiveTab] = useState<'schedule' | 'playoffs'>(() => pathToTab(initialPath));
  const [mobileTab, setMobileTab] = useState<'schedule' | 'standings'>('schedule');
  const [activeConference, setActiveConference] = useState<ConferenceKey>('East');
  const [advancementSort, setAdvancementSort] = useState<AdvancementSortKey>('pChampion');
  const [advancementSortDirection, setAdvancementSortDirection] = useState<SortDirection>('desc');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [resetOpen, setResetOpen] = useState(false);
  const [justPickedGameId, setJustPickedGameId] = useState<number | null>(null);
  const [changedTeamIds, setChangedTeamIds] = useState<number[]>([]);
  const [deltaMap, setDeltaMap] = useState<Map<string, number>>(new Map());
  const [standingsDirty, setStandingsDirty] = useState(false);
  const simCacheRef = useRef(new Map<string, SimulationResult>());
  const previousAdvancementsRef = useRef<Map<number, TeamAdvancement> | null>(null);
  const previousSeedsRef = useRef<Map<number, string> | null>(null);
  const idleHandleRef = useRef<number | null>(null);
  const idleHandleKindRef = useRef<'idle' | 'timeout' | null>(null);
  const deltaTimeoutRef = useRef<number | null>(null);
  const pickFlashTimeoutRef = useRef<number | null>(null);
  const standingsTimeoutRef = useRef<number | null>(null);
  const fallbackAdvancementsRef = useRef(buildFallbackAdvancements());

  const scheduleGroups = useMemo(
    () =>
      Array.from(groupGamesByDate(NBA_SCHEDULE).entries()).map(([date, games]) => ({
        date,
        games,
      })),
    [],
  );
  const projectedStandings = useMemo(
    () => computeProjectedStandings(lockedPicks, NBA_SCHEDULE, NBA_TEAMS),
    [lockedPicks],
  );
  const currentAdvancements = simResult?.advancements ?? fallbackAdvancementsRef.current;
  const advancementRows = useMemo(() => {
    const rows = NBA_TEAMS.map(
      (team) =>
        currentAdvancements.get(team.id) ?? {
          teamId: team.id,
          seed: null,
          seedLabel: '—',
          pTop6: 0,
          pPlayIn: 0,
          pMakesPlayoffs: 0,
          pWinsR1: 0,
          pConfFinals: 0,
          pFinals: 0,
          pChampion: 0,
        },
    );

    return rows.sort((rowA, rowB) =>
      compareAdvancementRows(advancementSort, advancementSortDirection, rowA, rowB),
    );
  }, [advancementSort, advancementSortDirection, currentAdvancements]);
  const pickedCount = lockedPicks.size;
  const totalPickableGames = useMemo(
    () => NBA_SCHEDULE.filter((game) => !game.isCompleted).length,
    [],
  );
  const allGamesPicked = pickedCount === totalPickableGames;
  const picksHash = useMemo(() => hashPicks(lockedPicks), [lockedPicks]);

  const updateAdvancementDeltas = useCallback((advancements: Map<number, TeamAdvancement>) => {
    const previous = previousAdvancementsRef.current;

    if (!previous) {
      previousAdvancementsRef.current = advancements;
      return;
    }

    const nextDeltas = new Map<string, number>();

    for (const [teamId, nextRow] of advancements.entries()) {
      const previousRow = previous.get(teamId);

      if (!previousRow) {
        continue;
      }

      for (const field of DELTA_FIELDS) {
        const delta = nextRow[field] - previousRow[field];

        if (Math.abs(delta) >= 0.001) {
          nextDeltas.set(`${teamId}:${field}`, delta);
        }
      }
    }

    previousAdvancementsRef.current = advancements;
    setDeltaMap(nextDeltas);

    if (deltaTimeoutRef.current) {
      window.clearTimeout(deltaTimeoutRef.current);
    }

    if (nextDeltas.size > 0) {
      deltaTimeoutRef.current = window.setTimeout(() => {
        setDeltaMap(new Map());
      }, 2800);
    }
  }, []);

  const rememberSimulationResult = useCallback((key: string, result: SimulationResult) => {
    const cache = simCacheRef.current;
    cache.delete(key);
    cache.set(key, result);

    if (cache.size > 20) {
      const oldest = cache.keys().next().value;

      if (oldest) {
        cache.delete(oldest);
      }
    }
  }, []);

  const applySimulationResult = useCallback(
    (key: string, result: SimulationResult) => {
      rememberSimulationResult(key, result);
      updateAdvancementDeltas(result.advancements);
      setIsSimulating(false);
      startTransition(() => {
        setSimResult(result);
      });
    },
    [rememberSimulationResult, updateAdvancementDeltas],
  );

  useEffect(() => {
    localStorage.setItem('nba-odds-format', oddsFormat);
  }, [oddsFormat]);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }

    function handleScroll() {
      setIsScrolled(window.scrollY > 10);
    }

    function handlePopState() {
      setActiveTab(pathToTab(window.location.pathname));
    }

    handleScroll();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    const nextSeedMap = new Map(
      [...projectedStandings.east, ...projectedStandings.west].map((row) => [row.teamId, row.seedLabel]),
    );

    if (!previousSeedsRef.current) {
      previousSeedsRef.current = nextSeedMap;
      return;
    }

    const changed = [...nextSeedMap.entries()]
      .filter(([teamId, seedLabel]) => previousSeedsRef.current?.get(teamId) !== seedLabel)
      .map(([teamId]) => teamId);

    previousSeedsRef.current = nextSeedMap;
    setChangedTeamIds(changed);

    if (standingsTimeoutRef.current) {
      window.clearTimeout(standingsTimeoutRef.current);
    }

    if (changed.length > 0) {
      standingsTimeoutRef.current = window.setTimeout(() => {
        setChangedTeamIds([]);
      }, 650);
    }
  }, [projectedStandings]);

  useEffect(() => {
    if (mobileTab === 'standings') {
      setStandingsDirty(false);
    }
  }, [mobileTab]);

  useEffect(() => {
    if (pickFlashTimeoutRef.current) {
      window.clearTimeout(pickFlashTimeoutRef.current);
    }

    if (justPickedGameId === null) {
      return;
    }

    pickFlashTimeoutRef.current = window.setTimeout(() => {
      setJustPickedGameId(null);
    }, 700);
  }, [justPickedGameId]);

  useEffect(() => {
    if (idleHandleRef.current !== null) {
      if (idleHandleKindRef.current === 'idle' && window.cancelIdleCallback) {
        window.cancelIdleCallback(idleHandleRef.current);
      } else {
        window.clearTimeout(idleHandleRef.current);
      }
    }

    const cachedResult = simCacheRef.current.get(picksHash);

    if (cachedResult) {
      applySimulationResult(picksHash, cachedResult);
      return;
    }

    setIsSimulating(true);
    let cancelled = false;

    const runSimulation = () => {
      const result = simulateNbaFullSeason(lockedPicks, NBA_SCHEDULE, NBA_TEAMS, getSimIterations());

      if (cancelled) {
        return;
      }

      applySimulationResult(picksHash, result);
    };

    if (window.requestIdleCallback) {
      idleHandleKindRef.current = 'idle';
      idleHandleRef.current = window.requestIdleCallback(() => {
        runSimulation();
      }, { timeout: 350 });
    } else {
      idleHandleKindRef.current = 'timeout';
      idleHandleRef.current = window.setTimeout(runSimulation, 0);
    }

    return () => {
      cancelled = true;

      if (idleHandleRef.current !== null) {
        if (idleHandleKindRef.current === 'idle' && window.cancelIdleCallback) {
          window.cancelIdleCallback(idleHandleRef.current);
        } else {
          window.clearTimeout(idleHandleRef.current);
        }
      }
    };
  }, [applySimulationResult, lockedPicks, picksHash]);

  const handleNavigate = useCallback((tab: 'schedule' | 'playoffs') => {
    const nextPath = tab === 'playoffs' ? '/playoffs' : '/';
    setActiveTab(tab);
    window.history.pushState({}, '', nextPath);
  }, []);

  const handleOddsFormatChange = useCallback((format: OddsFormat) => {
    setOddsFormat(format);
  }, []);

  const handlePick = useCallback(
    (gameId: number, teamId: number) => {
      const game = NBA_SCHEDULE.find((scheduleGame) => scheduleGame.gameId === gameId);

      if (!game || game.isCompleted) {
        return;
      }

      setUndoStack((current) => [...current, cloneLockedPicks(lockedPicks)]);
      setLockedPicks((current) => {
        const next = cloneLockedPicks(current);

        if (next.get(gameId) === teamId) {
          next.delete(gameId);
        } else {
          next.set(gameId, teamId);
        }

        return next;
      });
      setJustPickedGameId(gameId);

      if (isMobile && mobileTab !== 'standings') {
        setStandingsDirty(true);
      }
    },
    [isMobile, lockedPicks, mobileTab],
  );

  const handleSimulateRest = useCallback(() => {
    if (allGamesPicked) {
      return;
    }

    const random = Math.random;
    setUndoStack((current) => [...current, cloneLockedPicks(lockedPicks)]);
    setLockedPicks((current) => {
      const next = cloneLockedPicks(current);

      for (const game of NBA_SCHEDULE) {
        if (game.isCompleted || next.has(game.gameId)) {
          continue;
        }

        const winnerId = random() < game.pHomeWins ? game.homeTeamId : game.awayTeamId;
        next.set(game.gameId, winnerId);
      }

      return next;
    });

    if (isMobile && mobileTab !== 'standings') {
      setStandingsDirty(true);
    }
  }, [allGamesPicked, isMobile, lockedPicks, mobileTab]);

  const handleUndo = useCallback(() => {
    setUndoStack((current) => {
      if (current.length === 0) {
        return current;
      }

      const next = [...current];
      const previous = next.pop();

      if (previous) {
        setLockedPicks(previous);
      }

      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setLockedPicks(new Map());
    setUndoStack([]);
    setResetOpen(false);
  }, []);

  const handleSort = useCallback(
    (sortKey: AdvancementSortKey) => {
      if (sortKey === advancementSort) {
        setAdvancementSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
        return;
      }

      setAdvancementSort(sortKey);
      setAdvancementSortDirection('desc');
    },
    [advancementSort],
  );

  return (
    <>
      <ToolNav
        activeTab={activeTab}
        oddsFormat={oddsFormat}
        onOddsFormatChange={handleOddsFormatChange}
        onNavigate={handleNavigate}
        isScrolled={isScrolled}
        playoffsUnlocked={allGamesPicked}
      />

      <main className="app-shell">
        <section className="hero-header">
          <h1>NBA Season Predictor</h1>
          <p className="subtitle">
            Pick every game. Watch the playoff picture shift. Every result changes everything.
          </p>
        </section>

        {activeTab === 'schedule' ? (
          <>
            <SimControls
              canUndo={undoStack.length > 0}
              canReset={lockedPicks.size > 0}
              allGamesPicked={allGamesPicked}
              isSimulating={isSimulating}
              isMobile={isMobile}
              onSimulateRest={handleSimulateRest}
              onUndo={handleUndo}
              onReset={() => setResetOpen(true)}
            />

            <ProgressBar
              pickedCount={pickedCount}
              totalCount={totalPickableGames}
              unlocked={allGamesPicked}
              onGoToPlayoffs={() => handleNavigate('playoffs')}
            />

            <div className="main-layout desktop-layout">
              <section className="schedule-panel">
                <ScheduleView
                  groupedGames={scheduleGroups}
                  lockedPicks={lockedPicks}
                  teamsById={NBA_TEAM_LOOKUP}
                  oddsFormat={oddsFormat}
                  justPickedGameId={justPickedGameId}
                  onPick={handlePick}
                />
              </section>

              <aside className="side-panel">
                <StandingsTable
                  east={projectedStandings.east}
                  west={projectedStandings.west}
                  teamsById={NBA_TEAM_LOOKUP}
                  activeConference={activeConference}
                  changedTeamIds={changedTeamIds}
                  onConferenceChange={setActiveConference}
                />
                <AdvancementPanel
                  rows={advancementRows}
                  teamsById={NBA_TEAM_LOOKUP}
                  oddsFormat={oddsFormat}
                  sortKey={advancementSort}
                  sortDirection={advancementSortDirection}
                  deltaMap={deltaMap}
                  isSimulating={isSimulating}
                  onSort={handleSort}
                />
              </aside>
            </div>

            <div className="mobile-layout">
              {mobileTab === 'schedule' ? (
                <section className="mobile-panel">
                  <ScheduleView
                    groupedGames={scheduleGroups}
                    lockedPicks={lockedPicks}
                    teamsById={NBA_TEAM_LOOKUP}
                    oddsFormat={oddsFormat}
                    justPickedGameId={justPickedGameId}
                    onPick={handlePick}
                  />
                </section>
              ) : (
                <section className="mobile-panel">
                  <StandingsTable
                    east={projectedStandings.east}
                    west={projectedStandings.west}
                    teamsById={NBA_TEAM_LOOKUP}
                    activeConference={activeConference}
                    changedTeamIds={changedTeamIds}
                    onConferenceChange={setActiveConference}
                  />
                  <AdvancementPanel
                    rows={advancementRows}
                    teamsById={NBA_TEAM_LOOKUP}
                    oddsFormat={oddsFormat}
                    sortKey={advancementSort}
                    sortDirection={advancementSortDirection}
                    deltaMap={deltaMap}
                    isSimulating={isSimulating}
                    onSort={handleSort}
                  />
                </section>
              )}
            </div>

            <div className="bottom-tab-bar mobile-only">
              <button
                type="button"
                className={mobileTab === 'schedule' ? 'active' : 'inactive'}
                onClick={() => setMobileTab('schedule')}
              >
                Schedule
              </button>
              <button
                type="button"
                className={mobileTab === 'standings' ? 'active' : 'inactive'}
                onClick={() => setMobileTab('standings')}
              >
                Standings
                {standingsDirty ? <span className="tab-dot" /> : null}
              </button>
            </div>
          </>
        ) : (
          <PlayoffLockedTab
            unlocked={allGamesPicked}
            pickedCount={pickedCount}
            totalCount={totalPickableGames}
            east={projectedStandings.east}
            west={projectedStandings.west}
            teamsById={NBA_TEAM_LOOKUP}
            onBack={() => handleNavigate('schedule')}
          />
        )}
      </main>

      {resetOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setResetOpen(false)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            onClick={(event: { stopPropagation: () => void }) => event.stopPropagation()}
          >
            <h2>Reset all picks?</h2>
            <p>This will clear all your game predictions and cannot be undone.</p>
            <div className="modal-actions">
              <button type="button" className="sim-controls__button" onClick={() => setResetOpen(false)}>
                Cancel
              </button>
              <button type="button" className="sim-controls__button sim-controls__button--danger" onClick={handleReset}>
                Reset All
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
