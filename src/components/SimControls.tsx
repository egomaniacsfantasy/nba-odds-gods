interface SimControlsProps {
  canUndo: boolean;
  canReset: boolean;
  allGamesPicked: boolean;
  isSimulating: boolean;
  isAutoFilling: boolean;
  isMobile: boolean;
  isScrolled: boolean;
  canResimulate: boolean;
  pickedCount: number;
  totalCount: number;
  onSimulateRest: () => void;
  onReSimulate: () => void;
  onUndo: () => void;
  onReset: () => void;
  onGoToPlayoffs: () => void;
}

export function SimControls({
  canUndo,
  canReset,
  allGamesPicked,
  isSimulating,
  isAutoFilling,
  isMobile,
  isScrolled,
  canResimulate,
  pickedCount,
  totalCount,
  onSimulateRest,
  onReSimulate,
  onUndo,
  onReset,
  onGoToPlayoffs,
}: SimControlsProps) {
  const percentage = totalCount === 0 ? 0 : Math.round((pickedCount / totalCount) * 100);
  const showResimulate = allGamesPicked && canResimulate;
  const primaryLabel = isAutoFilling
    ? 'Deciding…'
    : showResimulate
      ? 'Re-Simulate'
      : allGamesPicked
        ? 'All Picked'
        : isMobile
          ? 'Sim Rest'
          : 'Simulate Rest';

  return (
    <div className={isScrolled ? 'sim-controls is-scrolled' : 'sim-controls'}>
      <button
        type="button"
        className="sim-controls__button sim-btn sim-btn--primary"
        onClick={showResimulate ? onReSimulate : onSimulateRest}
        disabled={isAutoFilling || (allGamesPicked && !canResimulate)}
      >
        {primaryLabel}
      </button>
      <button
        type="button"
        className="sim-controls__button sim-btn sim-btn--secondary"
        onClick={onUndo}
        disabled={!canUndo || isAutoFilling}
      >
        Undo
      </button>
      <button
        type="button"
        className="sim-controls__button sim-btn sim-btn--secondary"
        onClick={onReset}
        disabled={!canReset || isAutoFilling}
      >
        Reset
      </button>

      <div className="sim-controls-status">
        <div className="sim-controls-progress-track" aria-hidden="true">
          <div className="sim-controls-progress-fill" style={{ width: `${percentage}%` }} />
        </div>

        {allGamesPicked ? (
          <button type="button" className="playoffs-cta playoffs-unlocked-cta" onClick={onGoToPlayoffs}>
            The Oracle has spoken — Playoffs unlocked! →
          </button>
        ) : (
          <div className="sim-controls-progress">{pickedCount}/{totalCount} ({percentage}%)</div>
        )}
      </div>

      {isSimulating && !isAutoFilling ? <span className="sim-controls-live-indicator">Odds updating…</span> : null}
    </div>
  );
}
