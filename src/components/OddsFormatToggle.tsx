import type { OddsFormat } from '../types';

interface OddsFormatToggleProps {
  oddsFormat: OddsFormat;
  onChange: (format: OddsFormat) => void;
}

export function OddsFormatToggle({ oddsFormat, onChange }: OddsFormatToggleProps) {
  return (
    <div className="odds-toggle" role="group" aria-label="Odds display format">
      <button
        type="button"
        className={oddsFormat === 'implied' ? 'odds-toggle__button odds-toggle-btn active' : 'odds-toggle__button odds-toggle-btn'}
        onClick={() => onChange('implied')}
      >
        %
      </button>
      <button
        type="button"
        className={oddsFormat === 'american' ? 'odds-toggle__button odds-toggle-btn active' : 'odds-toggle__button odds-toggle-btn'}
        onClick={() => onChange('american')}
      >
        US
      </button>
    </div>
  );
}
