// ═══════════════════════════════════════════════════════
// GridPulse — Core Types
// ═══════════════════════════════════════════════════════

/** EIA Balancing Authority region */
export interface GridRegion {
  id: string;               // EIA respondent code e.g. "CISO", "ERCO", "PJM"
  name: string;             // Human name e.g. "California ISO"
  shortName: string;        // Abbreviated e.g. "CAISO"
  lat: number;
  lng: number;
  timezone: string;
  interconnection: 'eastern' | 'western' | 'texas';
}

/** Real-time grid telemetry snapshot */
export interface GridSnapshot {
  regionId: string;
  timestamp: string;        // ISO 8601
  demand: number;           // MW
  forecastDemand: number;   // MW
  netGeneration: number;    // MW
  interchange: number;      // MW (positive = export)
  generationMix: GenerationMix;
}

/** Generation breakdown by fuel type */
export interface GenerationMix {
  solar: number;    // MWh
  wind: number;
  nuclear: number;
  gas: number;      // natural gas
  coal: number;
  hydro: number;
  oil: number;
  other: number;    // biomass, geothermal, etc.
  total: number;
}

/** Time series data point */
export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

/** Alert / signal event */
export interface GridAlert {
  id: string;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  region: string;
  type: AlertType;
  title: string;
  message: string;
  value?: number;
  threshold?: number;
}

export type AlertType =
  | 'frequency'
  | 'demand_spike'
  | 'generation_drop'
  | 'renewable_curtailment'
  | 'interchange_reversal'
  | 'outage'
  | 'weather'
  | 'infrastructure'
  | 'nuclear'
  | 'price_spike';

/** Grid Stress Index for a region */
export interface GridStressIndex {
  regionId: string;
  score: number;           // 0–100
  trend: 'rising' | 'falling' | 'stable';
  components: {
    demandCapacityRatio: number;
    renewableIntermittency: number;
    newsVelocity: number;
    weatherStress: number;
    infraIncidents: number;
  };
}

/** Data source health */
export interface DataSourceStatus {
  name: string;
  status: 'live' | 'stale' | 'error' | 'disabled';
  lastUpdate: string;
  latency: string;
  url: string;
}

/** EIA API v2 response shape */
export interface EIAResponse<T = EIADataPoint> {
  response: {
    total: number;
    dateFormat: string;
    frequency: string;
    data: T[];
    description?: string;
  };
}

export interface EIADataPoint {
  period: string;
  respondent: string;
  'respondent-name': string;
  fueltype?: string;
  'type-name'?: string;
  value: string | number;
  'value-units': string;
}

/** Fuel type mapping from EIA codes */
export const EIA_FUEL_MAP: Record<string, keyof GenerationMix> = {
  'SUN': 'solar',
  'WND': 'wind',
  'NUC': 'nuclear',
  'NG':  'gas',
  'COL': 'coal',
  'WAT': 'hydro',
  'OIL': 'oil',
  'OTH': 'other',
  'ALL': 'total',
};
