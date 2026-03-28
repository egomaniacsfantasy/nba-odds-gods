// Auto-generated ToolNav.tsx — do not edit manually
// Updated: 2026-03-28
import { OddsFormatToggle } from './OddsFormatToggle';
import type { OddsFormat } from '../types';

interface ToolNavProps {
  activeTab: 'oracle' | 'teamdata' | 'predictor' | 'manager';
  oddsFormat: OddsFormat;
  onOddsFormatChange: (format: OddsFormat) => void;
  onNavigate: (tab: 'oracle' | 'teamdata' | 'predictor' | 'manager') => void;
  isScrolled: boolean;
}

export function ToolNav({
  activeTab,
  oddsFormat,
  onOddsFormatChange,
  onNavigate,
  isScrolled,
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
            className={activeTab === 'oracle' ? 'og-nav-tab is-active' : 'og-nav-tab'}
            onClick={() => onNavigate('oracle')}
          >
            The Oracle
          </button>
          <button
            type="button"
            className={activeTab === 'teamdata' ? 'og-nav-tab is-active' : 'og-nav-tab'}
            onClick={() => onNavigate('teamdata')}
          >
            Team Stats
          </button>
          <button
            type="button"
            className={activeTab === 'predictor' ? 'og-nav-tab is-active' : 'og-nav-tab'}
            onClick={() => onNavigate('predictor')}
          >
            Predictor
          </button>
          <button
            type="button"
            className={activeTab === 'manager' ? 'og-nav-tab is-active' : 'og-nav-tab'}
            onClick={() => onNavigate('manager')}
          >
            Manager
          </button>
        </nav>

        <div className="og-nav-right">
          <OddsFormatToggle oddsFormat={oddsFormat} onChange={onOddsFormatChange} />
          <a className="nav-link desktop-only" href="https://bracket.oddsgods.net">
            The Bracket Lab
          </a>
          <a
            className="nav-link desktop-only"
            href="https://wato.oddsgods.net"
            target="_blank"
            rel="noopener noreferrer"
          >
            What Are the Odds?
          </a>
        </div>
      </div>

      <nav className="og-nav-tabs og-nav-tabs--mobile mobile-only" aria-label="NBA tabs">
        <button
          type="button"
          className={activeTab === 'oracle' ? 'og-nav-tab is-active' : 'og-nav-tab'}
          onClick={() => onNavigate('oracle')}
        >
          The Oracle
        </button>
        <button
          type="button"
          className={activeTab === 'teamdata' ? 'og-nav-tab is-active' : 'og-nav-tab'}
          onClick={() => onNavigate('teamdata')}
        >
          Team Stats
        </button>
        <button
          type="button"
          className={activeTab === 'predictor' ? 'og-nav-tab is-active' : 'og-nav-tab'}
          onClick={() => onNavigate('predictor')}
        >
          Predictor
        </button>
      </nav>
    </header>
  );
}
