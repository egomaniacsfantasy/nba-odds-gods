// Auto-generated App.tsx — uses pre-computed MC results by default
// When no picks are locked, shows nba_mc_results data directly.
// After any pick, runs 10,000-iteration MC simulation using model p_home_wins.
// Updated: 2026-03-29
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdvancementPanel } from './components/AdvancementPanel';
import { OddsTicker } from './components/OddsTicker';
import { PlayoffSection } from './components/PlayoffSection';
import { ScheduleView } from './components/ScheduleView';
import { SimControls } from './components/SimControls';
import { StandingsTable } from './components/StandingsTable';
import { TeamDataTab } from './components/TeamDataTab';
import { PredictorTab } from './components/PredictorTab';
import { ToolNav } from './components/ToolNav';
import ManagerModePage from './components/ManagerModePage';
import { NBA_MC_ADVANCEMENT, NBA_MC_EAST_STANDINGS, NBA_MC_EXP_WINS, NBA_MC_WEST_STANDINGS } from './data/nbaMcResults';
import { NBA_COMPLETED_PICKS } from './data/nbaCompletedPicks';
import { NBA_SCHEDULE } from './data/nbaSchedule';
import { NBA_TEAMS, NBA_TEAM_LOOKUP } from './data/nbaTeams';
import { buildPlayoffPicks, getSimIterations, simulateNbaFullSeason } from './lib/simulation';
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

// Playoff game IDs start at 9001 — exclude them from standings so that locking
// a playoff game result never changes a team's regular-season win total or seed.
const NBA_REGULAR_SEASON = NBA_SCHEDULE.filter((g) => g.gameId < 9001);

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

function hashPicks(lockedPicks: LockedPicks): string {
  return JSON.stringify(Array.from(lockedPicks.entries()).sort((entryA, entryB) => entryA[0] - entryB[0]));
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

export default function App(_props: AppProps) {
  const [lockedPicks, setLockedPicks] = useState<LockedPicks>(() => new Map(NBA_COMPLETED_PICKS));
  const [undoStack, setUndoStack] = useState<LockedPicks[]>([]);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>(() => {
    const stored = localStorage.getItem('nba-odds-format');
    return stored === 'american' ? 'american' : 'implied';
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const [mainTab, setMainTab] = useState<'oracle' | 'teamdata' | 'predictor' | 'manager'>('oracle');
  const [mobileTab, setMobileTab] = useState<'schedule' | 'standings'>('schedule');
  const [activeConference, setActiveConference] = useState<ConferenceKey>('East');
  const [advancementSort, setAdvancementSort] = useState<AdvancementSortKey>('pChampion');
  const [advancementSortDirection, setAdvancementSortDirection] = useState<SortDirection>('desc');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [showPickHint, setShowPickHint] = useState(() => localStorage.getItem('nba-oracle-hint-seen') !== '1');
  const [resetOpen, setResetOpen] = useState(false);
  const [showOracleReveal, setShowOracleReveal] = useState(false);
  const [justPickedKey, setJustPickedKey] = useState<string | null>(null);
  const [changedTeamIds, setChangedTeamIds] = useState<number[]>([]);
  const [deltaMap, setDeltaMap] = useState<Map<string, number>>(new Map());
  const [standingsDirty, setStandingsDirty] = useState(false);
  const [managerHeaderVisible, setManagerHeaderVisible] = useState(true);
  const simCacheRef = useRef(new Map<string, SimulationResult>());
  const previousAdvancementsRef = useRef<Map<number, TeamAdvancement> | null>(null);
  const previousSeedsRef = useRef<Map<number, string> | null>(null);
  const simTimeoutRef = useRef<number | null>(null);
  const pendingPicksRef = useRef<LockedPicks>(new Map());
  const idleHandleRef = useRef<number | null>(null);
  const idleHandleKindRef = useRef<'idle' | 'timeout' | null>(null);
  const deltaTimeoutRef = useRef<number | null>(null);
  const pickFlashTimeoutRef = useRef<number | null>(null);
  const standingsTimeoutRef = useRef<number | null>(null);
  const sidePanelRef = useRef<HTMLElement | null>(null);
  const desktopPlayoffSectionRef = useRef<HTMLDivElement | null>(null);
  const desktopFuturesPanelRef = useRef<HTMLDivElement | null>(null);
  const mobilePlayoffSectionRef = useRef<HTMLDivElement | null>(null);
  const revealShownRef = useRef(false);
  const [showFuturesTeaser, setShowFuturesTeaser] = useState(false);

  const scheduleGroups = useMemo(
    () => Array.from(groupGamesByDate(NBA_SCHEDULE).entries()).map(([date, games]) => ({ date, games })),
    [],
  );

  const projectedStandings = useMemo(
    () => computeProjectedStandings(lockedPicks, NBA_REGULAR_SEASON, NBA_TEAMS),
    [lockedPicks],
  );

  // No picks: use pre-computed MC data directly (exact match to nba_mc_results.xlsx)
  // After picks: use live simulation results
  const noPicks = lockedPicks.size === 0;
  const currentAdvancements = noPicks ? NBA_MC_ADVANCEMENT : (simResult?.advancements ?? NBA_MC_ADVANCEMENT);
  const currentExpWins = noPicks ? NBA_MC_EXP_WINS : (simResult?.expWins ?? NBA_MC_EXP_WINS);
  const displayEast = noPicks ? NBA_MC_EAST_STANDINGS : projectedStandings.east;
  const displayWest = noPicks ? NBA_MC_WEST_STANDINGS : projectedStandings.west;
  const tickerItems = useMemo(
    () => NBA_TEAMS
      .map((team) => ({
        teamId: team.id,
        abbr: team.abbr,
        logoUrl: team.logoUrl,
        probability: currentAdvancements.get(team.id)?.pChampion ?? 0,
      }))
      .sort((itemA, itemB) => itemB.probability - itemA.probability)
      .slice(0, 12),
    [currentAdvancements],
  );
  const projectedChampion = useMemo(() => {
    const topEntry = [...currentAdvancements.values()]
      .sort((rowA, rowB) => rowB.pChampion - rowA.pChampion)[0];

    if (!topEntry) {
      return null;
    }

    const team = NBA_TEAM_LOOKUP.get(topEntry.teamId);
    const standingsRow = [...displayEast, ...displayWest].find((row) => row.teamId === topEntry.teamId);

    if (!team || !standingsRow) {
      return null;
    }

    const seedValue = topEntry.seed ?? standingsRow.projectedSeed;
    const seedLabel = seedValue ? `No. ${seedValue} seed` : standingsRow.seedLabel;
    return {
      ...topEntry,
      team,
      record: `${standingsRow.wins}-${standingsRow.losses}`,
      summary: `${standingsRow.wins}-${standingsRow.losses} projected record • ${seedLabel} in the ${team.conference}`,
    };
  }, [currentAdvancements, displayEast, displayWest]);

  const advancementRows = useMemo(() => {
    const rows = NBA_TEAMS.map(
      (team) => currentAdvancements.get(team.id) ?? {
        teamId: team.id, seed: null, seedLabel: '—',
        pTop6: 0, pPlayIn: 0, pMakesPlayoffs: 0,
        pWinsR1: 0, pConfFinals: 0, pFinals: 0, pChampion: 0,
      },
    );
    return rows.sort((rowA, rowB) => compareAdvancementRows(advancementSort, advancementSortDirection, rowA, rowB));
  }, [advancementSort, advancementSortDirection, currentAdvancements]);

  const lockedRecord = useMemo(() => {
    const w = new Map<number, number>();
    const l = new Map<number, number>();
    for (const game of NBA_SCHEDULE) {
      if (game.isCompleted || !lockedPicks.has(game.gameId)) continue;
      const winnerId = lockedPicks.get(game.gameId)!;
      const loserId = winnerId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
      w.set(winnerId, (w.get(winnerId) ?? 0) + 1);
      l.set(loserId, (l.get(loserId) ?? 0) + 1);
    }
    return { w, l };
  }, [lockedPicks]);

  const pickedCount = useMemo(
    () => NBA_SCHEDULE.filter((game) => !game.isCompleted && lockedPicks.has(game.gameId)).length,
    [lockedPicks],
  );
  const totalPickableGames = useMemo(() => NBA_SCHEDULE.filter((game) => !game.isCompleted).length, []);
  const allGamesPicked = pickedCount === totalPickableGames;
  const picksHash = useMemo(() => hashPicks(lockedPicks), [lockedPicks]);
  const firstHintGameId = useMemo(() => {
    if (!showPickHint) return null;
    return NBA_SCHEDULE.find((game) => !game.isCompleted && !lockedPicks.has(game.gameId))?.gameId ?? null;
  }, [lockedPicks, showPickHint]);

  const updateAdvancementDeltas = useCallback((advancements: Map<number, TeamAdvancement>) => {
    const previous = previousAdvancementsRef.current;
    if (!previous) { previousAdvancementsRef.current = advancements; return; }
    const nextDeltas = new Map<string, number>();
    for (const [teamId, nextRow] of advancements.entries()) {
      const previousRow = previous.get(teamId);
      if (!previousRow) continue;
      for (const field of DELTA_FIELDS) {
        const delta = nextRow[field] - previousRow[field];
        if (Math.abs(delta) >= 0.005) nextDeltas.set(`${teamId}:${field}`, delta);
      }
    }
    previousAdvancementsRef.current = advancements;
    setDeltaMap(nextDeltas);
    if (deltaTimeoutRef.current) window.clearTimeout(deltaTimeoutRef.current);
    if (nextDeltas.size > 0) {
      deltaTimeoutRef.current = window.setTimeout(() => { setDeltaMap(new Map()); }, 2800);
    }
  }, []);

  const cancelScheduledSimulation = useCallback(() => {
    if (idleHandleRef.current === null) return;
    if (idleHandleKindRef.current === 'idle' && window.cancelIdleCallback) {
      window.cancelIdleCallback(idleHandleRef.current);
    } else {
      window.clearTimeout(idleHandleRef.current);
    }
    idleHandleRef.current = null;
    idleHandleKindRef.current = null;
  }, []);

  const rememberSimulationResult = useCallback((key: string, result: SimulationResult) => {
    const cache = simCacheRef.current;
    cache.delete(key);
    cache.set(key, result);
    if (cache.size > 20) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
  }, []);

  const applySimulationResult = useCallback(
    (key: string, result: SimulationResult) => {
      rememberSimulationResult(key, result);
      updateAdvancementDeltas(result.advancements);
      setIsSimulating(false);
      startTransition(() => { setSimResult(result); });
    },
    [rememberSimulationResult, updateAdvancementDeltas],
  );

  const scheduleSimulation = useCallback(
    (picks: LockedPicks) => {
      const key = hashPicks(picks);
      const cached = simCacheRef.current.get(key);
      if (cached) { applySimulationResult(key, cached); return; }
      const runSimulation = () => {
        idleHandleRef.current = null;
        idleHandleKindRef.current = null;
        const result = simulateNbaFullSeason(picks, NBA_SCHEDULE, NBA_TEAMS, getSimIterations());
        applySimulationResult(key, result);
      };
      if (window.requestIdleCallback) {
        idleHandleKindRef.current = 'idle';
        idleHandleRef.current = window.requestIdleCallback(runSimulation, { timeout: 350 });
      } else {
        idleHandleKindRef.current = 'timeout';
        idleHandleRef.current = window.setTimeout(runSimulation, 0);
      }
    },
    [applySimulationResult],
  );

  useEffect(() => { localStorage.setItem('nba-odds-format', oddsFormat); }, [oddsFormat]);

  useEffect(() => {
    if (!noPicks) {
      return;
    }

    previousAdvancementsRef.current = currentAdvancements;
    setDeltaMap(new Map());

    if (deltaTimeoutRef.current) {
      window.clearTimeout(deltaTimeoutRef.current);
      deltaTimeoutRef.current = null;
    }
  }, [currentAdvancements, noPicks]);

  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth < 768); }
    function handleScroll() { setIsScrolled(window.scrollY > 10); }
    function handlePopState() { /* single-page layout — no tab switching */ }
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
    if (!previousSeedsRef.current) { previousSeedsRef.current = nextSeedMap; return; }
    const changed = [...nextSeedMap.entries()]
      .filter(([teamId, seedLabel]) => previousSeedsRef.current?.get(teamId) !== seedLabel)
      .map(([teamId]) => teamId);
    previousSeedsRef.current = nextSeedMap;
    setChangedTeamIds(changed);
    if (standingsTimeoutRef.current) window.clearTimeout(standingsTimeoutRef.current);
    if (changed.length > 0) {
      standingsTimeoutRef.current = window.setTimeout(() => { setChangedTeamIds([]); }, 800);
    }
  }, [projectedStandings]);

  useEffect(() => { if (mobileTab === 'standings') setStandingsDirty(false); }, [mobileTab]);

  useEffect(() => {
    if (mainTab !== 'manager') {
      setManagerHeaderVisible(true);
    }
  }, [mainTab]);

  useEffect(() => {
    if (mainTab !== 'oracle' || isMobile) {
      setShowFuturesTeaser(false);
      return;
    }

    const root = sidePanelRef.current;
    const target = desktopFuturesPanelRef.current;

    if (!root || !target) {
      setShowFuturesTeaser(false);
      return;
    }

    if (!window.IntersectionObserver) {
      setShowFuturesTeaser(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFuturesTeaser(!entry.isIntersecting);
      },
      {
        root,
        threshold: 0.35,
      },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [isMobile, mainTab]);

  useEffect(() => {
    if (allGamesPicked && !revealShownRef.current) {
      revealShownRef.current = true;
      setShowOracleReveal(true);
      return;
    }

    if (!allGamesPicked) {
      revealShownRef.current = false;
      setShowOracleReveal(false);
    }
  }, [allGamesPicked]);

  useEffect(() => {
    if (pickFlashTimeoutRef.current) window.clearTimeout(pickFlashTimeoutRef.current);
    if (justPickedKey === null) return;
    pickFlashTimeoutRef.current = window.setTimeout(() => { setJustPickedKey(null); }, 500);
  }, [justPickedKey]);

  // Simulation: skip entirely when no picks (show pre-computed MC data)
  useEffect(() => {
    if (simTimeoutRef.current) { window.clearTimeout(simTimeoutRef.current); simTimeoutRef.current = null; }
    cancelScheduledSimulation();

    if (lockedPicks.size === 0) {
      setSimResult(null);
      setIsSimulating(false);
      return;
    }

    pendingPicksRef.current = cloneLockedPicks(lockedPicks);
    const cachedResult = simCacheRef.current.get(picksHash);
    if (cachedResult) { applySimulationResult(picksHash, cachedResult); return; }

    setIsSimulating(true);
    simTimeoutRef.current = window.setTimeout(() => {
      simTimeoutRef.current = null;
      scheduleSimulation(pendingPicksRef.current);
    }, 200);

    return () => {
      if (simTimeoutRef.current) { window.clearTimeout(simTimeoutRef.current); simTimeoutRef.current = null; }
      cancelScheduledSimulation();
    };
  }, [applySimulationResult, cancelScheduledSimulation, lockedPicks, picksHash, scheduleSimulation]);

  useEffect(() => () => {
    if (simTimeoutRef.current) window.clearTimeout(simTimeoutRef.current);
    if (deltaTimeoutRef.current) window.clearTimeout(deltaTimeoutRef.current);
    if (pickFlashTimeoutRef.current) window.clearTimeout(pickFlashTimeoutRef.current);
    if (standingsTimeoutRef.current) window.clearTimeout(standingsTimeoutRef.current);
    cancelScheduledSimulation();
  }, [cancelScheduledSimulation]);

  const handleNavigate = useCallback((tab: 'oracle' | 'teamdata' | 'predictor' | 'manager') => { setMainTab(tab); }, []);

  const handleOddsFormatChange = useCallback((format: OddsFormat) => { setOddsFormat(format); }, []);

  const handlePick = useCallback(
    (gameId: number, teamId: number) => {
      // Playoff game IDs (9001+) bypass the schedule lookup
      if (gameId < 9000) {
        const game = NBA_SCHEDULE.find((scheduleGame) => scheduleGame.gameId === gameId);
        if (!game || game.isCompleted) return;
      }
      const nextPicks = cloneLockedPicks(lockedPicks);
      const shouldUnpick = nextPicks.get(gameId) === teamId;
      if (shouldUnpick) { nextPicks.delete(gameId); } else { nextPicks.set(gameId, teamId); }
      setUndoStack((current) => [...current, cloneLockedPicks(lockedPicks)]);
      setLockedPicks(nextPicks);
      setJustPickedKey(shouldUnpick ? null : `${gameId}-${teamId}`);
      if (showPickHint) { localStorage.setItem('nba-oracle-hint-seen', '1'); setShowPickHint(false); }
      if (isMobile && mobileTab !== 'standings') setStandingsDirty(true);
    },
    [isMobile, lockedPicks, mobileTab, showPickHint],
  );

  const handleSimulateRest = useCallback(() => {
    const random = Math.random;
    setUndoStack((current) => [...current, cloneLockedPicks(lockedPicks)]);
    setLockedPicks((current) => {
      // 1. Fill all remaining regular-season games
      const next = cloneLockedPicks(current);
      for (const game of NBA_SCHEDULE) {
        if (game.isCompleted || next.has(game.gameId)) continue;
        next.set(game.gameId, random() < game.pHomeWins ? game.homeTeamId : game.awayTeamId);
      }
      // 2. Fill all playoff games deterministically (favorite wins each game)
      const standings = computeProjectedStandings(next, NBA_REGULAR_SEASON, NBA_TEAMS);
      return buildPlayoffPicks(next, standings, NBA_TEAM_LOOKUP);
    });
    setJustPickedKey(null);
    if (showPickHint) { localStorage.setItem('nba-oracle-hint-seen', '1'); setShowPickHint(false); }
    if (isMobile && mobileTab !== 'standings') setStandingsDirty(true);
  }, [allGamesPicked, isMobile, lockedPicks, mobileTab, showPickHint]);

  const handleUndo = useCallback(() => {
    setUndoStack((current) => {
      if (current.length === 0) return current;
      const next = [...current];
      const previous = next.pop();
      if (previous) setLockedPicks(previous);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => { setLockedPicks(new Map(NBA_COMPLETED_PICKS)); setUndoStack([]); setResetOpen(false); }, []);

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
  const handleGoToPlayoffs = useCallback(() => {
    const scrollToPlayoffs = () => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const target = (isMobile ? mobilePlayoffSectionRef.current : desktopPlayoffSectionRef.current)
        ?? desktopPlayoffSectionRef.current
        ?? mobilePlayoffSectionRef.current;

      if (target) {
        target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
        return;
      }

      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    };

    setShowOracleReveal(false);
    setMainTab('oracle');

    if (isMobile) {
      setMobileTab('schedule');
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollToPlayoffs);
    });
  }, [isMobile]);

  const handleScrollToFutures = useCallback(() => {
    const target = desktopFuturesPanelRef.current;

    if (!target) {
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  }, []);

  return (
    <>
      <ToolNav
        activeTab={mainTab}
        oddsFormat={oddsFormat}
        onOddsFormatChange={handleOddsFormatChange}
        onNavigate={handleNavigate}
        isScrolled={isScrolled}
      />
      <OddsTicker items={tickerItems} oddsFormat={oddsFormat} />
      <main className="app-shell">
        {mainTab === 'oracle' ? (
          <section className="oracle-hero">
            <div className="hero-glow" aria-hidden="true" />
            <div className="hero-particles" aria-hidden="true" />
            <h1 className="oracle-title">
              <span className="oracle-title-prefix">The NBA</span>
              <span className="oracle-title-name">Oracle</span>
            </h1>
            <p className="hero-subtitle">Pick every game. Watch the playoff picture shift. The Oracle sees all.</p>
          </section>
        ) : mainTab === 'manager' && !managerHeaderVisible ? null : (
          <section className="tab-header">
            <h1 className="tab-header__title">
              {mainTab === 'teamdata' ? 'Team Stats' : mainTab === 'predictor' ? 'Matchup Predictor' : 'Manager Mode'}
            </h1>
          </section>
        )}

        {mainTab === 'manager' ? <ManagerModePage onHeaderVisibilityChange={setManagerHeaderVisible} /> : mainTab === 'predictor' ? <PredictorTab oddsFormat={oddsFormat} /> : mainTab === 'teamdata' ? <TeamDataTab /> : <>
            <SimControls
              canUndo={undoStack.length > 0}
              canReset={lockedPicks.size > 0}
              allGamesPicked={allGamesPicked}
              isSimulating={isSimulating}
              isAutoFilling={false}
              isMobile={isMobile}
              isScrolled={isScrolled}
              canResimulate={false}
              pickedCount={pickedCount}
              totalCount={totalPickableGames}
              onSimulateRest={handleSimulateRest}
              onReSimulate={() => {}}
              onUndo={handleUndo}
              onReset={() => setResetOpen(true)}
              onGoToPlayoffs={handleGoToPlayoffs}
            />
            <div className="main-layout desktop-layout">
              <section className="schedule-panel">
                <ScheduleView
                  groupedGames={scheduleGroups}
                  lockedPicks={lockedPicks}
                  teamsById={NBA_TEAM_LOOKUP}
                  oddsFormat={oddsFormat}
                  justPickedKey={justPickedKey}
                  firstHintGameId={firstHintGameId}
                  showPickHint={showPickHint}
                  simSweepDelays={new Map()}
                  disableInteractions={isSimulating}
                  onPick={handlePick}
                />
                <div ref={desktopPlayoffSectionRef} className="playoff-anchor">
                  <PlayoffSection
                    lockedPicks={lockedPicks}
                    east={projectedStandings.east}
                    west={projectedStandings.west}
                    teamsById={NBA_TEAM_LOOKUP}
                    advancements={currentAdvancements}
                    allGamesPicked={allGamesPicked}
                    oddsFormat={oddsFormat}
                    justPickedKey={justPickedKey}
                    onPick={handlePick}
                  />
                </div>
              </section>
              <aside ref={sidePanelRef} className="side-panel">
                <StandingsTable
                  east={displayEast}
                  west={displayWest}
                  teamsById={NBA_TEAM_LOOKUP}
                  activeConference={activeConference}
                  changedTeamIds={changedTeamIds}
                  lockedRecord={lockedRecord}
                  expWins={currentExpWins}
                  onConferenceChange={setActiveConference}
                />
                <div ref={desktopFuturesPanelRef}>
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
                </div>
                {showFuturesTeaser ? (
                  <button type="button" className="futures-teaser" onClick={handleScrollToFutures}>
                    <span className="futures-teaser-text">Oracle Futures</span>
                    <span className="futures-teaser-arrow">↓</span>
                  </button>
                ) : null}
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
                    justPickedKey={justPickedKey}
                    firstHintGameId={firstHintGameId}
                    showPickHint={showPickHint}
                    simSweepDelays={new Map()}
                    disableInteractions={isSimulating}
                    onPick={handlePick}
                  />
                  <div ref={mobilePlayoffSectionRef} className="playoff-anchor">
                    <PlayoffSection
                      lockedPicks={lockedPicks}
                      east={projectedStandings.east}
                      west={projectedStandings.west}
                      teamsById={NBA_TEAM_LOOKUP}
                      advancements={currentAdvancements}
                      allGamesPicked={allGamesPicked}
                      oddsFormat={oddsFormat}
                      justPickedKey={justPickedKey}
                      onPick={handlePick}
                    />
                  </div>
                </section>
              ) : (
                <section className="mobile-panel">
                  <StandingsTable
                    east={displayEast}
                    west={displayWest}
                    teamsById={NBA_TEAM_LOOKUP}
                    activeConference={activeConference}
                    changedTeamIds={changedTeamIds}
                    lockedRecord={lockedRecord}
                    expWins={currentExpWins}
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
              <button type="button" className={mobileTab === 'schedule' ? 'active' : 'inactive'} onClick={() => setMobileTab('schedule')}>
                Schedule
              </button>
              <button type="button" className={mobileTab === 'standings' ? 'active' : 'inactive'} onClick={() => setMobileTab('standings')}>
                Standings
                {standingsDirty ? <span className="tab-dot" /> : null}
              </button>
            </div>
          </>}
      </main>
      {showOracleReveal && projectedChampion ? (
        <div className="oracle-reveal" role="presentation" onClick={() => setShowOracleReveal(false)}>
          <div className="oracle-reveal-backdrop" />
          <div
            className="oracle-reveal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="oracle-reveal-title"
            onClick={(event: { stopPropagation: () => void }) => event.stopPropagation()}
          >
            <p className="reveal-eyebrow">THE ORACLE HAS SPOKEN</p>
            <div className="reveal-logo-wrap">
              <img
                className="reveal-champ-logo"
                src={projectedChampion.team.logoUrl}
                alt={projectedChampion.team.name}
                onError={(event: { currentTarget: HTMLImageElement }) => {
                  event.currentTarget.style.display = 'none';
                  const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;

                  if (fallback) {
                    fallback.style.display = 'flex';
                  }
                }}
              />
              <span className="logo-fallback reveal-logo-fallback" style={{ display: 'none' }}>
                {projectedChampion.team.abbr}
              </span>
            </div>
            <h2 id="oracle-reveal-title" className="reveal-champ-name">{projectedChampion.team.name}</h2>
            <p className="reveal-champ-odds">{(projectedChampion.pChampion * 100).toFixed(1)}% championship probability</p>
            <p className="reveal-summary">{projectedChampion.summary}</p>
            <button type="button" className="reveal-cta" onClick={handleGoToPlayoffs}>View Playoff Bracket →</button>
            <button type="button" className="reveal-dismiss" onClick={() => setShowOracleReveal(false)}>Continue Editing</button>
          </div>
        </div>
      ) : null}
      {resetOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setResetOpen(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(event: { stopPropagation: () => void }) => event.stopPropagation()}>
            <h2>Reset all picks?</h2>
            <p>This will clear all your game predictions and cannot be undone.</p>
            <div className="modal-actions">
              <button type="button" className="sim-controls__button" onClick={() => setResetOpen(false)}>Cancel</button>
              <button type="button" className="sim-controls__button sim-controls__button--danger" onClick={handleReset}>Reset All</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
