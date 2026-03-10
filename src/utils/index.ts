import type { GenerationMix, GridSnapshot } from '@/types';

// ── Number Formatting ──

export function formatMW(mw: number): string {
  if (Math.abs(mw) >= 1_000_000) return `${(mw / 1_000_000).toFixed(1)} TW`;
  if (Math.abs(mw) >= 1_000) return `${(mw / 1_000).toFixed(1)} GW`;
  return `${Math.round(mw)} MW`;
}

export function formatMWh(mwh: number): string {
  if (Math.abs(mwh) >= 1_000_000) return `${(mwh / 1_000_000).toFixed(1)} TWh`;
  if (Math.abs(mwh) >= 1_000) return `${(mwh / 1_000).toFixed(1)} GWh`;
  return `${Math.round(mwh)} MWh`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

// ── Color System ──

export const SEVERITY_COLORS = {
  critical: { bg: 'rgba(255,50,50,0.12)', border: '#ff3232', text: '#ff6b6b', glow: '0 0 20px rgba(255,50,50,0.3)' },
  high:     { bg: 'rgba(255,140,0,0.10)', border: '#ff8c00', text: '#ffaa33', glow: '0 0 15px rgba(255,140,0,0.2)' },
  medium:   { bg: 'rgba(255,220,0,0.08)', border: '#ffdc00', text: '#ffe066', glow: 'none' },
  low:      { bg: 'rgba(0,200,150,0.08)', border: '#00c896', text: '#00e6a8', glow: 'none' },
  info:     { bg: 'rgba(0,150,255,0.08)', border: '#0096ff', text: '#66bbff', glow: 'none' },
};

export const FUEL_COLORS: Record<string, string> = {
  solar:   '#FFB800',
  wind:    '#00D4AA',
  nuclear: '#8B5CF6',
  gas:     '#64748B',
  coal:    '#374151',
  hydro:   '#3B82F6',
  oil:     '#92400E',
  other:   '#6B7280',
};

export const FUEL_LABELS: Record<string, string> = {
  solar: 'Solar', wind: 'Wind', nuclear: 'Nuclear',
  gas: 'Natural Gas', coal: 'Coal', hydro: 'Hydro',
  oil: 'Oil', other: 'Other',
};

// ── Generation Mix Helpers ──

export function mixToPercentages(mix: GenerationMix): Record<string, number> {
  const total = mix.total || (mix.solar + mix.wind + mix.nuclear + mix.gas + mix.coal + mix.hydro + mix.oil + mix.other);
  if (total === 0) return {};
  return {
    solar:   (mix.solar / total) * 100,
    wind:    (mix.wind / total) * 100,
    nuclear: (mix.nuclear / total) * 100,
    gas:     (mix.gas / total) * 100,
    coal:    (mix.coal / total) * 100,
    hydro:   (mix.hydro / total) * 100,
    oil:     (mix.oil / total) * 100,
    other:   (mix.other / total) * 100,
  };
}

export function renewablePercent(mix: GenerationMix): number {
  const total = mix.total || 1;
  return ((mix.solar + mix.wind + mix.hydro) / total) * 100;
}

// ── Grid Stress Index ──

export function computeGridStressIndex(snapshot: GridSnapshot): number {
  const { demand, netGeneration, generationMix: mix } = snapshot;

  // Component 1: Demand/Generation ratio (30%)
  const ratio = netGeneration > 0 ? demand / netGeneration : 1.5;
  const demandScore = Math.min(100, Math.max(0, (ratio - 0.7) / 0.5 * 100));

  // Component 2: Renewable intermittency proxy (20%)
  const renPct = renewablePercent(mix);
  // Higher renewable % = more intermittency risk (simplified)
  const intermittencyScore = renPct > 60 ? 40 : renPct > 40 ? 25 : 10;

  // Component 3: Coal dependency (environmental risk) (15%)
  const coalPct = mix.total > 0 ? (mix.coal / mix.total) * 100 : 0;
  const coalScore = Math.min(100, coalPct * 2);

  // Component 4: Reserve margin (35%)
  const reserveMargin = netGeneration > 0 ? ((netGeneration - demand) / netGeneration) * 100 : 0;
  const reserveScore = reserveMargin < 5 ? 90 :
                       reserveMargin < 10 ? 60 :
                       reserveMargin < 15 ? 35 :
                       reserveMargin < 20 ? 15 : 5;

  const gsi = demandScore * 0.30 + intermittencyScore * 0.20 + coalScore * 0.15 + reserveScore * 0.35;
  return Math.round(Math.min(100, Math.max(0, gsi)));
}

export function gsiSeverity(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

// ── Time Helpers ──

export function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatUTCTime(date: Date): string {
  return date.toISOString().slice(11, 19) + ' UTC';
}
