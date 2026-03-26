// Auto-generated App.tsx — uses pre-computed MC results by default
// When no picks are locked, shows nba_mc_results data directly.
// After any pick, runs 10,000-iteration MC simulation using model p_home_wins.
// Updated: 2026-03-26
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdvancementPanel } from './components/AdvancementPanel';
import { PlayoffBracketTab } from './components/PlayoffBracketTab';
import { OddsTicker } from './components/OddsTicker';
import { ScheduleView } from './components/ScheduleView';
import { SimControls } from './components/SimControls';
import { StandingsTable } from './components/StandingsTable';
import { ToolNav } from './components/ToolNav';
import { NBA_MC_ADVANCEMENT, NBA_MC_EAST_STANDINGS, NBA_MC_WEST_STANDINGS } from './data/nbaMcResults';
import { NBA_SCHEDULE } from './data/nbaSchedule';
import { NBA_TEAMS, NBA_TEAM_LOOKUP, NBA_TEAM_RATINGS } from './data/nbaTeams';
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

function cloneGameIdSet(gameIds: Set<number>): Set<number> {
  return new Set(gameIds);
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

function buildBaselineTickerItems() {
  const weightedTeams = NBA_TEAMS.map((team) => {
    const rating = NBA_TEAM_RATINGS.get(team.id) ?? 1500;
    return {
      team,
      weight: Math.exp((rating - 1500) / 110),
    };
  });
  const totalWeight = weightedTeams.reduce((sum, row) => sum + row.weight, 0) || 1;

  return weightedTeams
    .sort((rowA, rowB) => rowB.weight - rowA.weight)
    .slice(0, 10)
    .map((row) => ({
      teamId: row.team.id,
      abbr: row.team.abbr,
      logoUrl: row.team.logoUrl,
      probability: row.weight / totalWeight,
    }));
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
  const [showPickHint, setShowPickHint] = useState(() => localStorage.getItem('nba-oracle-hint-seen') !== '1');
  const [resetOpen, setResetOpen] = useState(false);
  const [justPickedKey, setJustPickedKey] = useState<string | null>(null);
  const [changedTeamIds, setChangedTeamIds] = useState<number[]>([]);
  const [deltaMap, setDeltaMap] = useState<Map<string, number>>(new Map());
  const [standingsDirty, setStandingsDirty] = useState(false);
  const [simulatedGameIds, setSimulatedGameIds] = useState<Set<number>>(new Set());
  const [, setSimulatedUndoStack] = useState<Set<number>[]>([]);
  const [simSweepDelays, setSimSweepDelays] = useState<Map<number, number>>(new Map());
  const [isSweepFilling, setIsSweepFilling] = useState(false);
  const [showCompletionReveal, setShowCompletionReveal] = useState(false);
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
  const sweepTimeoutRef = useRef<number | null>(null);
  const revealPendingRef = useRef(false);
  const previousAllGamesPickedRef = useRef(false);
  const fallbackAdvancementsRef = useRef(buildFallbackAdvancements());

  const scheduleGroups = useMemo(
    () => Array.from(groupGamesByDate(NBA_SCHEDULE).entries()).map(([date, games]) => ({ date, games })),
    [],
  );

  const projectedStandings = useMemo(
    () => computeProjectedStandings(lockedPicks, NBA_SCHEDULE, NBA_TEAMS),
    [lockedPicks],
  );

  const noPicks = lockedPicks.size === 0;
  const currentAdvancements = noPicks
    ? NBA_MC_ADVANCEMENT
    : (simResult?.advancements ?? fallbackAdvancementsRef.current);
  const displayEast = noPicks ? NBA_MC_EAST_STANDINGS : projectedStandings.east;
  const displayWest = noPicks ? NBA_MC_WEST_STANDINGS : projectedStandings.west;

  const allAdvancementRows = useMemo(
    () =>
      NBA_TEAMS.map(
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
      ),
    [currentAdvancements],
  );

  const advancementRows = useMemo(() => {
    const visibleRows = allAdvancementRows.filter(
      (row) => row.pMakesPlayoffs > 0 || ((row.seed ?? 99) <= 10 && row.seed !== null),
    );

    return visibleRows
      .sort((rowA, rowB) => compareAdvancementRows(advancementSort, advancementSortDirection, rowA, rowB))
      .slice(0, 20);
  }, [advancementSort, advancementSortDirection, allAdvancementRows]);

  const pickedCount = lockedPicks.size;
  const totalPickableGames = useMemo(() => NBA_SCHEDULE.filter((game) => !game.isCompleted).length, []);
  const allGamesPicked = pickedCount === totalPickableGames;
  const isBusy = isSimulating || isSweepFilling;
  const picksHash = useMemo(() => hashPicks(lockedPicks), [lockedPicks]);

  const firstHintGameId = useMemo(() => {
    if (!showPickHint) {
      return null;
    }

    return NBA_SCHEDULE.find((game) => !game.isCompleted && !lockedPicks.has(game.gameId))?.gameId ?? null;
  }, [lockedPicks, showPickHint]);

  const tickerItems = useMemo(() => {
    const liveTickerItems = allAdvancementRows
      .filter((row) => row.pChampion > 0)
      .sort((rowA, rowB) => rowB.pChampion - rowA.pChampion)
      .slice(0, 10)
      .map((row) => {
        const team = NBA_TEAM_LOOKUP.get(row.teamId);

        if (!team) {
          return null;
        }

        return {
          teamId: row.teamId,
          abbr: team.abbr,
          logoUrl: team.logoUrl,
          probability: row.pChampion,
        };
      })
      .filter((item): item is { teamId: number; abbr: string; logoUrl: string; probability: number } => item !== null);

    return liveTickerItems.length > 0 ? liveTickerItems : buildBaselineTickerItems();
  }, [allAdvancementRows]);

  const projectedChampion = useMemo(() => {
    const sortedByChampionship = [...allAdvancementRows].sort((rowA, rowB) => rowB.pChampion - rowA.pChampion);
    const topRow = sortedByChampionship[0];

    if (!topRow) {
      return null;
    }

    const team = NBA_TEAM_LOOKUP.get(topRow.teamId);
    const standingRow = [...projectedStandings.east, ...projectedStandings.west].find(
      (row) => row.teamId === topRow.teamId,
    );

    if (!team || !standingRow) {
      return null;
    }

    return {
      team,
      standingRow,
      probability: topRow.pChampion,
    };
  }, [allAdvancementRows, projectedStandings]);

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

        if (Math.abs(delta) >= 0.005) {
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

  const cancelScheduledSimulation = useCallback(() => {
    if (idleHandleRef.current === null) {
      return;
    }

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

  const scheduleSimulation = useCallback(
    (picks: LockedPicks) => {
      const key = hashPicks(picks);
      const cached = simCacheRef.current.get(key);

      if (cached) {
        applySimulationResult(key, cached);
        return;
      }

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

  const pushUndoSnapshot = useCallback(() => {
    setUndoStack((current) => [...current, cloneLockedPicks(lockedPicks)]);
    setSimulatedUndoStack((current) => [...current, cloneGameIdSet(simulatedGameIds)]);
  }, [lockedPicks, simulatedGameIds]);

  const beginSimulatedFill = useCallback(
    (basePicks: LockedPicks, existingSimulatedGameIds: Set<number>) => {
      const gamesToFill = NBA_SCHEDULE.filter((game) => !game.isCompleted && !basePicks.has(game.gameId));

      if (gamesToFill.length === 0) {
        return;
      }

      const nextPicks = cloneLockedPicks(basePicks);
      const nextSimulatedGameIds = cloneGameIdSet(existingSimulatedGameIds);
      const delays = new Map<number, number>();

      gamesToFill.forEach((game, index) => {
        const winnerId = Math.random() < game.pHomeWins ? game.homeTeamId : game.awayTeamId;
        nextPicks.set(game.gameId, winnerId);
        nextSimulatedGameIds.add(game.gameId);
        delays.set(game.gameId, Math.min(index * 5, 800));
      });

      if (sweepTimeoutRef.current) {
        window.clearTimeout(sweepTimeoutRef.current);
      }

      setJustPickedKey(null);
      setIsSweepFilling(true);
      setSimSweepDelays(delays);

      sweepTimeoutRef.current = window.setTimeout(() => {
        sweepTimeoutRef.current = null;
        setIsSimulating(true);
        setLockedPicks(nextPicks);
        setSimulatedGameIds(nextSimulatedGameIds);
        setIsSweepFilling(false);
        setSimSweepDelays(new Map());

        if (showPickHint) {
          localStorage.setItem('nba-oracle-hint-seen', '1');
          setShowPickHint(false);
        }

        if (isMobile && mobileTab !== 'standings') {
          setStandingsDirty(true);
        }
      }, 820);
    },
    [isMobile, mobileTab, showPickHint],
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
      }, 800);
    }
  }, [projectedStandings]);

  useEffect(() => {
    if (mobileTab === 'standings') {
      setStandingsDirty(false);
    }
  }, [mobileTab]);

  useEffect(() => {
    if (allGamesPicked && !previousAllGamesPickedRef.current) {
      revealPendingRef.current = true;
    }

    if (!allGamesPicked) {
      revealPendingRef.current = false;
      setShowCompletionReveal(false);
    }

    previousAllGamesPickedRef.current = allGamesPicked;
  }, [allGamesPicked]);

  useEffect(() => {
    if (pickFlashTimeoutRef.current) {
      window.clearTimeout(pickFlashTimeoutRef.current);
    }

    if (justPickedKey === null) {
      return;
    }

    pickFlashTimeoutRef.current = window.setTimeout(() => {
      setJustPickedKey(null);
    }, 500);
  }, [justPickedKey]);

  useEffect(() => {
    if (!allGamesPicked || !revealPendingRef.current || isBusy) {
      return;
    }

    revealPendingRef.current = false;
    setShowCompletionReveal(true);
  }, [allGamesPicked, isBusy, projectedChampion]);

  useEffect(() => {
    if (simTimeoutRef.current) {
      window.clearTimeout(simTimeoutRef.current);
      simTimeoutRef.current = null;
    }

    cancelScheduledSimulation();

    if (lockedPicks.size === 0) {
      previousAdvancementsRef.current = NBA_MC_ADVANCEMENT;
      setDeltaMap(new Map());
      setSimResult(null);
      setIsSimulating(false);
      return;
    }

    pendingPicksRef.current = cloneLockedPicks(lockedPicks);
    const cachedResult = simCacheRef.current.get(picksHash);

    if (cachedResult) {
      applySimulationResult(picksHash, cachedResult);
      return;
    }

    setIsSimulating(true);
    simTimeoutRef.current = window.setTimeout(() => {
      simTimeoutRef.current = null;
      scheduleSimulation(pendingPicksRef.current);
    }, 200);

    return () => {
      if (simTimeoutRef.current) {
        window.clearTimeout(simTimeoutRef.current);
        simTimeoutRef.current = null;
      }

      cancelScheduledSimulation();
    };
  }, [applySimulationResult, cancelScheduledSimulation, lockedPicks, picksHash, scheduleSimulation]);

  useEffect(
    () => () => {
      if (simTimeoutRef.current) {
        window.clearTimeout(simTimeoutRef.current);
      }

      if (deltaTimeoutRef.current) {
        window.clearTimeout(deltaTimeoutRef.current);
      }

      if (pickFlashTimeoutRef.current) {
        window.clearTimeout(pickFlashTimeoutRef.current);
      }

      if (standingsTimeoutRef.current) {
        window.clearTimeout(standingsTimeoutRef.current);
      }

      if (sweepTimeoutRef.current) {
        window.clearTimeout(sweepTimeoutRef.current);
      }

      cancelScheduledSimulation();
    },
    [cancelScheduledSimulation],
  );

  const handleNavigate = useCallback((tab: 'schedule' | 'playoffs') => {
    const nextPath = tab === 'playoffs' ? '/playoffs' : '/';
    setShowCompletionReveal(false);
    setActiveTab(tab);
    window.history.pushState({}, '', nextPath);
  }, []);

  const handleOddsFormatChange = useCallback((format: OddsFormat) => {
    setOddsFormat(format);
  }, []);

  const handlePick = useCallback(
    (gameId: number, teamId: number) => {
      if (isSweepFilling) {
        return;
      }

      // Playoff game IDs (9001+) bypass the regular season schedule lookup.
      if (gameId < 9000) {
        const game = NBA_SCHEDULE.find((scheduleGame) => scheduleGame.gameId === gameId);

        if (!game || game.isCompleted) {
          return;
        }
      }

      const nextPicks = cloneLockedPicks(lockedPicks);
      const shouldUnpick = nextPicks.get(gameId) === teamId;

      if (shouldUnpick) {
        nextPicks.delete(gameId);
      } else {
        nextPicks.set(gameId, teamId);
      }

      pushUndoSnapshot();
      setIsSimulating(true);
      setLockedPicks(nextPicks);
      setJustPickedKey(shouldUnpick ? null : `${gameId}-${teamId}`);
      setSimulatedGameIds((current) => {
        const next = cloneGameIdSet(current);
        next.delete(gameId);
        return next;
      });

      if (showPickHint) {
        localStorage.setItem('nba-oracle-hint-seen', '1');
        setShowPickHint(false);
      }

      if (isMobile && mobileTab !== 'standings') {
        setStandingsDirty(true);
      }
    },
    [isMobile, isSweepFilling, lockedPicks, mobileTab, pushUndoSnapshot, showPickHint],
  );

  const handleSimulateRest = useCallback(() => {
    if (allGamesPicked || isSweepFilling) {
      return;
    }

    pushUndoSnapshot();
    beginSimulatedFill(cloneLockedPicks(lockedPicks), cloneGameIdSet(simulatedGameIds));
  }, [allGamesPicked, beginSimulatedFill, isSweepFilling, lockedPicks, pushUndoSnapshot, simulatedGameIds]);

  const handleReSimulate = useCallback(() => {
    if (!allGamesPicked || simulatedGameIds.size === 0 || isSweepFilling) {
      return;
    }

    const manualPicks = cloneLockedPicks(lockedPicks);
    simulatedGameIds.forEach((gameId) => {
      manualPicks.delete(gameId);
    });

    pushUndoSnapshot();
    beginSimulatedFill(manualPicks, new Set());
  }, [allGamesPicked, beginSimulatedFill, isSweepFilling, lockedPicks, pushUndoSnapshot, simulatedGameIds]);

  const handleUndo = useCallback(() => {
    if (isSweepFilling) {
      return;
    }

    setUndoStack((current) => {
      if (current.length === 0) {
        return current;
      }

      const next = [...current];
      const previous = next.pop();

      if (previous) {
        setIsSimulating(true);
        setLockedPicks(previous);
      }

      return next;
    });

    setSimulatedUndoStack((current) => {
      if (current.length === 0) {
        setSimulatedGameIds(new Set());
        return current;
      }

      const next = [...current];
      const previous = next.pop();
      setSimulatedGameIds(previous ? cloneGameIdSet(previous) : new Set());
      return next;
    });
  }, [isSweepFilling]);

  const handleReset = useCallback(() => {
    if (sweepTimeoutRef.current) {
      window.clearTimeout(sweepTimeoutRef.current);
      sweepTimeoutRef.current = null;
    }

    setLockedPicks(new Map());
    setUndoStack([]);
    setSimulatedGameIds(new Set());
    setSimulatedUndoStack([]);
    setSimSweepDelays(new Map());
    setIsSweepFilling(false);
    setIsSimulating(false);
    revealPendingRef.current = false;
    previousAllGamesPickedRef.current = false;
    setShowCompletionReveal(false);
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

      <OddsTicker items={tickerItems} />

      <main className="app-shell">
        <section className="oracle-hero">
          <div className="hero-ambient" aria-hidden="true" />
          <div className="hero-halo" aria-hidden="true" />
          <p className="hero-eyebrow">Odds Gods</p>
          <h1 className="oracle-title">
            <span className="oracle-title-the">The</span>
            <span className="oracle-title-nba">NBA</span>
            <span className="oracle-title-oracle">Oracle</span>
          </h1>
          <p className="hero-subtitle">Pick every game. Watch the playoff picture shift. The Oracle sees all.</p>
        </section>

        {activeTab === 'schedule' ? (
          <>
            <SimControls
              canUndo={undoStack.length > 0}
              canReset={lockedPicks.size > 0}
              allGamesPicked={allGamesPicked}
              isSimulating={isSimulating}
              isAutoFilling={isSweepFilling}
              isMobile={isMobile}
              isScrolled={isScrolled}
              canResimulate={simulatedGameIds.size > 0}
              pickedCount={pickedCount}
              totalCount={totalPickableGames}
              onSimulateRest={handleSimulateRest}
              onReSimulate={handleReSimulate}
              onUndo={handleUndo}
              onReset={() => setResetOpen(true)}
              onGoToPlayoffs={() => handleNavigate('playoffs')}
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
                  simSweepDelays={simSweepDelays}
                  disableInteractions={isSweepFilling}
                  onPick={handlePick}
                />
              </section>

              <aside className="side-panel">
                <StandingsTable
                  east={displayEast}
                  west={displayWest}
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
                    justPickedKey={justPickedKey}
                    firstHintGameId={firstHintGameId}
                    showPickHint={showPickHint}
                    simSweepDelays={simSweepDelays}
                    disableInteractions={isSweepFilling}
                    onPick={handlePick}
                  />
                </section>
              ) : (
                <section className="mobile-panel">
                  <StandingsTable
                    east={displayEast}
                    west={displayWest}
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
          <PlayoffBracketTab
            lockedPicks={lockedPicks}
            allGamesPicked={allGamesPicked}
            pickedCount={pickedCount}
            totalCount={totalPickableGames}
            east={projectedStandings.east}
            west={projectedStandings.west}
            teamsById={NBA_TEAM_LOOKUP}
            advancements={currentAdvancements}
            onPick={handlePick}
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

      {showCompletionReveal && projectedChampion ? (
        <div className="oracle-reveal-overlay" role="presentation" onClick={() => setShowCompletionReveal(false)}>
          <div
            className="oracle-reveal-content"
            role="dialog"
            aria-modal="true"
            onClick={(event: { stopPropagation: () => void }) => event.stopPropagation()}
          >
            <p className="reveal-eyebrow">The Oracle Has Spoken</p>
            <div className="reveal-champion">
              <img className="reveal-champ-logo" src={projectedChampion.team.logoUrl} alt={projectedChampion.team.name} />
              <p className="reveal-champ-name">{projectedChampion.team.name}</p>
              <p className="reveal-champ-odds">
                Championship Probability: {(projectedChampion.probability * 100).toFixed(1)}%
              </p>
            </div>
            <p className="reveal-summary">
              Your picks project a <strong>{projectedChampion.standingRow.wins}-{projectedChampion.standingRow.losses}</strong>{' '}
              regular season for the {projectedChampion.team.name}, the <strong>#{projectedChampion.standingRow.seedLabel}</strong>{' '}
              seed in the {projectedChampion.team.conference}.
            </p>
            <button type="button" className="reveal-cta" onClick={() => handleNavigate('playoffs')}>
              View Playoff Bracket →
            </button>
            <button type="button" className="reveal-dismiss" onClick={() => setShowCompletionReveal(false)}>
              Continue Editing
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
