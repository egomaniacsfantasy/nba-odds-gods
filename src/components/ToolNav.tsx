import { OddsFormatToggle } from './OddsFormatToggle';
import type { OddsFormat } from '../types';

interface ToolNavProps {
  activeTab: 'schedule' | 'playoffs';
  oddsFormat: OddsFormat;
  onOddsFormatChange: (format: OddsFormat) => void;
  onNavigate: (tab: 'schedule' | 'playoffs') => void;
  isScrolled: boolean;
  playoffsUnlocked: boolean;
}

export function ToolNav({
  activeTab,
  oddsFormat,
  onOddsFormatChange,
  onNavigate,
  isScrolled,
  playoffsUnlocked,
}: ToolNavProps) {
  return (
    <header className={isScrolled ? 'og-nav is-scrolled' : 'og-nav'}>
      <div className="og-nav-inner">
        <a className="brand-lockup" href="https://oddsgods.net" aria-label="Odds Gods">
          <img className="brand-logo" src="/logo-icon.png" alt="Odds Gods" width="32" height="32" />
          <span className="og-wordmark">
            <span>ODDS</span>
            <strong>GODS</strong>
          </span>
          <span className="beta-badge">Beta</span>
        </a>

        <nav className="og-nav-tabs desktop-only" aria-label="NBA tabs">
          <button
            type="button"
            className={activeTab === 'schedule' ? 'og-nav-tab is-active' : 'og-nav-tab'}
            onClick={() => onNavigate('schedule')}
          >
            Season Picker
          </button>
          <button
            type="button"
            className={
              activeTab === 'playoffs'
                ? 'og-nav-tab is-active is-locked'
                : playoffsUnlocked
                  ? 'og-nav-tab'
                  : 'og-nav-tab is-locked'
            }
            onClick={() => onNavigate('playoffs')}
          >
            <span className="lock-inline">Lock</span>
            Playoffs
          </button>
        </nav>

        <div className="og-nav-right">
          <OddsFormatToggle oddsFormat={oddsFormat} onChange={onOddsFormatChange} />
          <a className="nav-link desktop-only" href="https://bracket.oddsgods.net">
            The Bracket Lab
          </a>
          <a className="nav-link desktop-only" href="https://wato.oddsgods.net">
            What Are the Odds?
          </a>
        </div>
      </div>

      <nav className="og-nav-tabs og-nav-tabs--mobile mobile-only" aria-label="NBA tabs">
        <button
          type="button"
          className={activeTab === 'schedule' ? 'og-nav-tab is-active' : 'og-nav-tab'}
          onClick={() => onNavigate('schedule')}
        >
          Season Picker
        </button>
        <button
          type="button"
          className={
            activeTab === 'playoffs'
              ? 'og-nav-tab is-active is-locked'
              : playoffsUnlocked
                ? 'og-nav-tab'
                : 'og-nav-tab is-locked'
          }
          onClick={() => onNavigate('playoffs')}
        >
          <span className="lock-inline">Lock</span>
          Playoffs
        </button>
      </nav>
    </header>
  );
}
