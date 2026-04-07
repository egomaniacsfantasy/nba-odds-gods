// Auto-generated lib/formatOdds.ts — do not edit manually
// Updated: 2026-04-07
import type { OddsFormat } from '../types';

export function formatOdds(probability: number, format: OddsFormat): string {
  if (format === 'implied') {
    return `${(probability * 100).toFixed(1)}%`;
  }

  if (probability >= 0.999) {
    return 'LOCK';
  }

  if (probability <= 0.001) {
    return '—';
  }

  if (probability >= 0.5) {
    const odds = Math.round((-100 * probability) / (1 - probability));
    return `${odds}`;
  }

  const odds = Math.round((100 * (1 - probability)) / probability);
  return `+${odds}`;
}

export function formatWinPct(value: number): string {
  return `${value.toFixed(3).replace(/^0/, '')}`;
}

export function formatGamesBack(value: number): string {
  if (value <= 0) {
    return '—';
  }

  return Number.isInteger(value) ? `${value}` : `${value.toFixed(1)}`;
}

export function formatDelta(probabilityDelta: number, format: OddsFormat): string {
  if (format === 'american') {
    return `${probabilityDelta >= 0 ? '+' : ''}${(probabilityDelta * 100).toFixed(1)}%`;
  }

  return `${probabilityDelta >= 0 ? '+' : ''}${(probabilityDelta * 100).toFixed(1)}%`;
}

export function formatProbabilityCell(probability: number, format: OddsFormat): string {
  if (probability < 0.001) {
    return '—';
  }

  if (probability < 0.01) {
    return format === 'implied' ? '<1%' : '<1%';
  }

  return formatOdds(probability, format);
}
