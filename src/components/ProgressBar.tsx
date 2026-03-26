interface ProgressBarProps {
  pickedCount: number;
  totalCount: number;
  unlocked: boolean;
  onGoToPlayoffs: () => void;
}

export function ProgressBar({ pickedCount, totalCount, unlocked, onGoToPlayoffs }: ProgressBarProps) {
  const percentage = totalCount === 0 ? 0 : Math.round((pickedCount / totalCount) * 100);

  return (
    <div className="progress-panel">
      <div className="progress-track">
        <div
          className={unlocked ? 'progress-fill is-complete' : 'progress-fill'}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="progress-copy">
        {unlocked ? (
          <button type="button" className="playoffs-cta playoffs-unlocked-cta" onClick={onGoToPlayoffs}>
            The Oracle has spoken — Playoffs unlocked! →
          </button>
        ) : (
          `${pickedCount} / ${totalCount} games picked (${percentage}%)`
        )}
      </p>
    </div>
  );
}
