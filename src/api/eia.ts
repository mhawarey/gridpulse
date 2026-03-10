// ═══════════════════════════════════════════════════════
// GridPulse — EIA API v2 Client
// ═══════════════════════════════════════════════════════
//
// Fetches real-time US grid data from the EIA Open Data API.
// Docs: https://www.eia.gov/opendata/documentation.php
//
// Key endpoints used:
//   /electricity/rto/region-data/data/        → demand, generation, interchange
//   /electricity/rto/fuel-type-data/data/     → generation by fuel type
//   /electricity/rto/interchange-data/data/   → cross-region power flows
//   /nuclear-outages/facility-nuclear-outages/ → nuclear plant outages
//
// Rate limits: auto-throttle if key is suspended temporarily.

import type {
  EIAResponse,
  EIADataPoint,
  GridSnapshot,
  GenerationMix,
  TimeSeriesPoint,
  EIA_FUEL_MAP,
} from '@/types';

const EIA_BASE = 'https://api.eia.gov/v2';

// Store API key — user provides via .env.local or settings UI
let apiKey = import.meta.env.VITE_EIA_API_KEY || '';

export function setEIAKey(key: string) {
  apiKey = key;
}

export function hasEIAKey(): boolean {
  return apiKey.length > 0;
}

// ── Core fetch wrapper ──

interface EIAQueryParams {
  path: string;
  data?: string[];
  facets?: Record<string, string[]>;
  start?: string;
  end?: string;
  frequency?: string;
  sort?: { column: string; direction: 'asc' | 'desc' }[];
  length?: number;
  offset?: number;
}

async function eiaFetch<T = EIADataPoint>(params: EIAQueryParams): Promise<EIAResponse<T>> {
  const url = new URL(`${EIA_BASE}/${params.path}`);
  url.searchParams.set('api_key', apiKey);

  if (params.frequency) url.searchParams.set('frequency', params.frequency);
  if (params.start) url.searchParams.set('start', params.start);
  if (params.end) url.searchParams.set('end', params.end);
  if (params.length) url.searchParams.set('length', String(params.length));
  if (params.offset) url.searchParams.set('offset', String(params.offset));

  if (params.data) {
    params.data.forEach(d => url.searchParams.append('data[]', d));
  }
  if (params.facets) {
    Object.entries(params.facets).forEach(([key, values]) => {
      values.forEach(v => url.searchParams.append(`facets[${key}][]`, v));
    });
  }
  if (params.sort) {
    params.sort.forEach((s, i) => {
      url.searchParams.append(`sort[${i}][column]`, s.column);
      url.searchParams.append(`sort[${i}][direction]`, s.direction);
    });
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`EIA API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ── Public API Methods ──

/**
 * Get latest hourly demand + generation for a balancing authority
 * Returns the most recent 24 hours of data.
 */
export async function getRegionDemand(
  respondent: string,
  hours: number = 24
): Promise<TimeSeriesPoint[]> {
  const res = await eiaFetch({
    path: 'electricity/rto/region-data/data/',
    data: ['value'],
    facets: {
      respondent: [respondent],
      type: ['D'],  // D = Demand
    },
    frequency: 'hourly',
    sort: [{ column: 'period', direction: 'desc' }],
    length: hours,
  });

  return res.response.data.map(d => ({
    timestamp: d.period,
    value: Number(d.value) || 0,
  })).reverse();
}

/**
 * Get latest demand forecast for a balancing authority
 */
export async function getRegionForecast(
  respondent: string,
  hours: number = 24
): Promise<TimeSeriesPoint[]> {
  const res = await eiaFetch({
    path: 'electricity/rto/region-data/data/',
    data: ['value'],
    facets: {
      respondent: [respondent],
      type: ['DF'],  // DF = Demand Forecast
    },
    frequency: 'hourly',
    sort: [{ column: 'period', direction: 'desc' }],
    length: hours,
  });

  return res.response.data.map(d => ({
    timestamp: d.period,
    value: Number(d.value) || 0,
  })).reverse();
}

/**
 * Get net generation for a balancing authority
 */
export async function getRegionGeneration(
  respondent: string,
  hours: number = 24
): Promise<TimeSeriesPoint[]> {
  const res = await eiaFetch({
    path: 'electricity/rto/region-data/data/',
    data: ['value'],
    facets: {
      respondent: [respondent],
      type: ['NG'],  // NG = Net Generation
    },
    frequency: 'hourly',
    sort: [{ column: 'period', direction: 'desc' }],
    length: hours,
  });

  return res.response.data.map(d => ({
    timestamp: d.period,
    value: Number(d.value) || 0,
  })).reverse();
}

/**
 * Get net interchange (imports/exports) for a balancing authority
 */
export async function getRegionInterchange(
  respondent: string,
  hours: number = 24
): Promise<TimeSeriesPoint[]> {
  const res = await eiaFetch({
    path: 'electricity/rto/region-data/data/',
    data: ['value'],
    facets: {
      respondent: [respondent],
      type: ['TI'],  // TI = Total Interchange
    },
    frequency: 'hourly',
    sort: [{ column: 'period', direction: 'desc' }],
    length: hours,
  });

  return res.response.data.map(d => ({
    timestamp: d.period,
    value: Number(d.value) || 0,
  })).reverse();
}

/**
 * Get generation breakdown by fuel type for a balancing authority.
 * Returns the most recent hour's mix.
 */
export async function getGenerationMix(
  respondent: string
): Promise<GenerationMix> {
  const res = await eiaFetch({
    path: 'electricity/rto/fuel-type-data/data/',
    data: ['value'],
    facets: { respondent: [respondent] },
    frequency: 'hourly',
    sort: [{ column: 'period', direction: 'desc' }],
    length: 20,  // Get enough rows to cover all fuel types for latest hour
  });

  const mix: GenerationMix = {
    solar: 0, wind: 0, nuclear: 0, gas: 0,
    coal: 0, hydro: 0, oil: 0, other: 0, total: 0,
  };

  // EIA fuel type codes → our keys
  const fuelMap: Record<string, keyof GenerationMix> = {
    'SUN': 'solar', 'WND': 'wind', 'NUC': 'nuclear',
    'NG': 'gas', 'COL': 'coal', 'WAT': 'hydro',
    'OIL': 'oil', 'OTH': 'other', 'ALL': 'total',
  };

  // Group by period, take the latest
  if (res.response.data.length > 0) {
    const latestPeriod = res.response.data[0].period;
    res.response.data
      .filter(d => d.period === latestPeriod)
      .forEach(d => {
        const key = d.fueltype ? fuelMap[d.fueltype] : undefined;
        if (key) {
          mix[key] = Number(d.value) || 0;
        }
      });
  }

  // If total wasn't reported, sum components
  if (mix.total === 0) {
    mix.total = mix.solar + mix.wind + mix.nuclear + mix.gas +
                mix.coal + mix.hydro + mix.oil + mix.other;
  }

  return mix;
}

/**
 * Get fuel-type generation time series (24h) for a specific fuel
 */
export async function getFuelTimeSeries(
  respondent: string,
  fuelType: string,
  hours: number = 24
): Promise<TimeSeriesPoint[]> {
  const res = await eiaFetch({
    path: 'electricity/rto/fuel-type-data/data/',
    data: ['value'],
    facets: {
      respondent: [respondent],
      fueltype: [fuelType],
    },
    frequency: 'hourly',
    sort: [{ column: 'period', direction: 'desc' }],
    length: hours,
  });

  return res.response.data.map(d => ({
    timestamp: d.period,
    value: Number(d.value) || 0,
  })).reverse();
}

/**
 * Get interchange details between two balancing authorities
 */
export async function getInterchangeDetail(
  fromRegion: string,
  toRegion: string,
  hours: number = 24
): Promise<TimeSeriesPoint[]> {
  const res = await eiaFetch({
    path: 'electricity/rto/interchange-data/data/',
    data: ['value'],
    facets: {
      fromba: [fromRegion],
      toba: [toRegion],
    },
    frequency: 'hourly',
    sort: [{ column: 'period', direction: 'desc' }],
    length: hours,
  });

  return res.response.data.map(d => ({
    timestamp: d.period,
    value: Number(d.value) || 0,
  })).reverse();
}

/**
 * Build a full GridSnapshot for a region from multiple API calls.
 * This is the main "get everything" call for the dashboard.
 */
export async function getGridSnapshot(respondent: string): Promise<GridSnapshot> {
  const [demandData, forecastData, genData, interchangeData, mix] = await Promise.all([
    getRegionDemand(respondent, 1),
    getRegionForecast(respondent, 1),
    getRegionGeneration(respondent, 1),
    getRegionInterchange(respondent, 1),
    getGenerationMix(respondent),
  ]);

  return {
    regionId: respondent,
    timestamp: demandData[0]?.timestamp || new Date().toISOString(),
    demand: demandData[0]?.value || 0,
    forecastDemand: forecastData[0]?.value || 0,
    netGeneration: genData[0]?.value || 0,
    interchange: interchangeData[0]?.value || 0,
    generationMix: mix,
  };
}

/**
 * Get US Lower 48 aggregate demand (useful for the header ticker)
 */
export async function getUS48Demand(hours: number = 24): Promise<TimeSeriesPoint[]> {
  return getRegionDemand('US48', hours);
}

/**
 * Get all major regions' latest demand in a single batch.
 * Note: EIA API doesn't support multi-respondent in one call,
 * so we fan out and Promise.all.
 */
export async function getAllRegionSnapshots(
  regionIds: string[]
): Promise<Map<string, GridSnapshot>> {
  const snapshots = new Map<string, GridSnapshot>();

  // Batch in groups of 5 to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < regionIds.length; i += batchSize) {
    const batch = regionIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(id => getGridSnapshot(id))
    );
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        snapshots.set(batch[idx], result.value);
      }
    });

    // Small delay between batches
    if (i + batchSize < regionIds.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return snapshots;
}
