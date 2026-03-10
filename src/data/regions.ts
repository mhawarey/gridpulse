import type { GridRegion } from '@/types';

/**
 * Major US Balancing Authorities tracked by EIA-930
 * Coordinates placed at principal city/state within each service territory.
 */
export const US_REGIONS: GridRegion[] = [
  // ── Western Interconnection ──
  { id: 'CISO', name: 'California Independent System Operator', shortName: 'CAISO',
    lat: 37.5, lng: -120.5, timezone: 'America/Los_Angeles', interconnection: 'western' },
  { id: 'BPAT', name: 'Bonneville Power Administration', shortName: 'BPA',
    lat: 47.0, lng: -120.5, timezone: 'America/Los_Angeles', interconnection: 'western' },
  { id: 'PACW', name: 'PacifiCorp West', shortName: 'PACW',
    lat: 44.0, lng: -123.0, timezone: 'America/Los_Angeles', interconnection: 'western' },
  { id: 'PACE', name: 'PacifiCorp East', shortName: 'PACE',
    lat: 40.8, lng: -111.9, timezone: 'America/Denver', interconnection: 'western' },
  { id: 'PSCO', name: 'Public Service Company of Colorado', shortName: 'PSCo',
    lat: 39.7, lng: -105.0, timezone: 'America/Denver', interconnection: 'western' },
  { id: 'AZPS', name: 'Arizona Public Service', shortName: 'APS',
    lat: 33.8, lng: -112.1, timezone: 'America/Phoenix', interconnection: 'western' },
  { id: 'SRP',  name: 'Salt River Project', shortName: 'SRP',
    lat: 33.3, lng: -111.0, timezone: 'America/Phoenix', interconnection: 'western' },
  { id: 'NEVP', name: 'Nevada Power', shortName: 'NV Energy',
    lat: 39.5, lng: -117.5, timezone: 'America/Los_Angeles', interconnection: 'western' },
  { id: 'WACM', name: 'Western Area Power - CO/MO', shortName: 'WAPA-CM',
    lat: 41.5, lng: -107.5, timezone: 'America/Denver', interconnection: 'western' },
  { id: 'WALC', name: 'Western Area Power - Desert SW', shortName: 'WAPA-DSW',
    lat: 35.5, lng: -114.0, timezone: 'America/Phoenix', interconnection: 'western' },

  // ── Texas Interconnection ──
  { id: 'ERCO', name: 'Electric Reliability Council of Texas', shortName: 'ERCOT',
    lat: 32.0, lng: -97.5, timezone: 'America/Chicago', interconnection: 'texas' },

  // ── Eastern Interconnection ──
  { id: 'PJM',  name: 'PJM Interconnection', shortName: 'PJM',
    lat: 40.0, lng: -77.5, timezone: 'America/New_York', interconnection: 'eastern' },
  { id: 'MISO', name: 'Midcontinent Independent System Operator', shortName: 'MISO',
    lat: 43.0, lng: -89.5, timezone: 'America/Chicago', interconnection: 'eastern' },
  { id: 'ISNE', name: 'ISO New England', shortName: 'ISO-NE',
    lat: 42.4, lng: -71.8, timezone: 'America/New_York', interconnection: 'eastern' },
  { id: 'NYIS', name: 'New York Independent System Operator', shortName: 'NYISO',
    lat: 43.0, lng: -75.5, timezone: 'America/New_York', interconnection: 'eastern' },
  { id: 'SOCO', name: 'Southern Company', shortName: 'Southern',
    lat: 32.4, lng: -86.3, timezone: 'America/New_York', interconnection: 'eastern' },
  { id: 'TVA',  name: 'Tennessee Valley Authority', shortName: 'TVA',
    lat: 35.8, lng: -85.5, timezone: 'America/Chicago', interconnection: 'eastern' },
  { id: 'DUK',  name: 'Duke Energy Carolinas', shortName: 'Duke',
    lat: 35.2, lng: -80.8, timezone: 'America/New_York', interconnection: 'eastern' },
  { id: 'FPL',  name: 'Florida Power & Light', shortName: 'FPL',
    lat: 28.5, lng: -82.5, timezone: 'America/New_York', interconnection: 'eastern' },
  { id: 'SWPP', name: 'Southwest Power Pool', shortName: 'SPP',
    lat: 36.0, lng: -97.5, timezone: 'America/Chicago', interconnection: 'eastern' },
  { id: 'AECI', name: 'Associated Electric Cooperative', shortName: 'AECI',
    lat: 38.0, lng: -92.5, timezone: 'America/Chicago', interconnection: 'eastern' },
  { id: 'SC',   name: 'South Carolina Public Service', shortName: 'Santee Cooper',
    lat: 33.5, lng: -80.5, timezone: 'America/New_York', interconnection: 'eastern' },
  { id: 'SCEG', name: 'Dominion Energy South Carolina', shortName: 'DESC',
    lat: 34.0, lng: -81.0, timezone: 'America/New_York', interconnection: 'eastern' },
  { id: 'CPLE', name: 'Duke Energy Progress East', shortName: 'DEP-E',
    lat: 35.8, lng: -78.6, timezone: 'America/New_York', interconnection: 'eastern' },
];

/** Aggregate regions for summary views */
export const AGGREGATE_REGIONS = [
  { id: 'US48', name: 'US Lower 48', shortName: 'US48', lat: 39.0, lng: -98.0, timezone: 'America/Chicago', interconnection: 'eastern' as const },
  { id: 'CAL',  name: 'California', shortName: 'California', lat: 36.7, lng: -119.8, timezone: 'America/Los_Angeles', interconnection: 'western' as const },
  { id: 'CENT', name: 'Central', shortName: 'Central', lat: 38.0, lng: -92.0, timezone: 'America/Chicago', interconnection: 'eastern' as const },
  { id: 'FLA',  name: 'Florida', shortName: 'Florida', lat: 28.5, lng: -82.5, timezone: 'America/New_York', interconnection: 'eastern' as const },
  { id: 'MIDA', name: 'Mid-Atlantic', shortName: 'Mid-Atlantic', lat: 39.0, lng: -76.0, timezone: 'America/New_York', interconnection: 'eastern' as const },
  { id: 'MIDW', name: 'Midwest', shortName: 'Midwest', lat: 42.0, lng: -87.0, timezone: 'America/Chicago', interconnection: 'eastern' as const },
  { id: 'NE',   name: 'New England', shortName: 'New England', lat: 42.5, lng: -71.8, timezone: 'America/New_York', interconnection: 'eastern' as const },
  { id: 'NW',   name: 'Northwest', shortName: 'Northwest', lat: 47.0, lng: -120.5, timezone: 'America/Los_Angeles', interconnection: 'western' as const },
  { id: 'NY',   name: 'New York', shortName: 'New York', lat: 43.0, lng: -75.5, timezone: 'America/New_York', interconnection: 'eastern' as const },
  { id: 'SE',   name: 'Southeast', shortName: 'Southeast', lat: 33.5, lng: -84.0, timezone: 'America/New_York', interconnection: 'eastern' as const },
  { id: 'SW',   name: 'Southwest', shortName: 'Southwest', lat: 34.0, lng: -112.0, timezone: 'America/Phoenix', interconnection: 'western' as const },
  { id: 'TEN',  name: 'Tennessee', shortName: 'Tennessee', lat: 35.8, lng: -85.5, timezone: 'America/Chicago', interconnection: 'eastern' as const },
  { id: 'TEX',  name: 'Texas', shortName: 'Texas', lat: 32.0, lng: -97.5, timezone: 'America/Chicago', interconnection: 'texas' as const },
];

/** Map interconnection to color */
export const INTERCONNECTION_COLORS = {
  eastern: '#3B82F6',   // blue
  western: '#00D4AA',   // teal
  texas:   '#FF8C00',   // orange
};
