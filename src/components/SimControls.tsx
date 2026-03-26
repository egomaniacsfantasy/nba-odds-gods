interface SimControlsProps {
  canUndo: boolean;
  canReset: boolean;
  allGamesPicked: boolean;
  isSimulating: boolean;
  isMobile: boolean;
  onSimulateRest: () => void;
  onUndo: () => void;
  onReset: () => void;
}

export function SimControls({
  canUndo,
  canReset,
  allGamesPicked,
  isSimulating,
  isMobile,
  onSimulateRest,
  onUndo,
  onReset,
}: SimControlsProps) {
  return (
    <div className="sim-controls">
      <button
        type="button"
        className="sim-controls__button sim-controls__button--primary"
        onClick={onSimulateRest}
        disabled={allGamesPicked}
      >
        {isSimulating ? 'Running…' : isMobile ? 'Sim Rest' : 'Simulate Rest'}
      </button>
      <button type="button" className="sim-controls__button" onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
      <button type="button" className="sim-controls__button" onClick={onReset} disabled={!canReset}>
        Reset
      </button>
    </div>
  );
}
