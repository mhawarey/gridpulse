import { useState, useEffect, useCallback, useRef } from 'react';
import type { GridSnapshot, TimeSeriesPoint, GenerationMix } from '@/types';
import {
  getGridSnapshot,
  getRegionDemand,
  getRegionForecast,
  getGenerationMix,
  hasEIAKey,
} from '@/api/eia';

/**
 * Hook: Poll a region's grid snapshot at a configurable interval.
 */
export function useGridSnapshot(regionId: string | null, pollIntervalMs = 60_000) {
  const [snapshot, setSnapshot] = useState<GridSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetch = useCallback(async () => {
    if (!regionId || !hasEIAKey()) return;
    setLoading(true);
    setError(null);
    try {
      const snap = await getGridSnapshot(regionId);
      setSnapshot(snap);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch grid data');
    } finally {
      setLoading(false);
    }
  }, [regionId]);

  useEffect(() => {
    fetch();
    intervalRef.current = setInterval(fetch, pollIntervalMs);
    return () => clearInterval(intervalRef.current);
  }, [fetch, pollIntervalMs]);

  return { snapshot, loading, error, refetch: fetch };
}

/**
 * Hook: Get 24h demand time series for a region.
 */
export function useDemandSeries(regionId: string | null, hours = 24) {
  const [data, setData] = useState<TimeSeriesPoint[]>([]);
  const [forecast, setForecast] = useState<TimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!regionId || !hasEIAKey()) return;
    setLoading(true);
    Promise.all([
      getRegionDemand(regionId, hours),
      getRegionForecast(regionId, hours),
    ])
      .then(([d, f]) => { setData(d); setForecast(f); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [regionId, hours]);

  return { data, forecast, loading };
}

/**
 * Hook: Get generation mix for a region.
 */
export function useGenerationMix(regionId: string | null) {
  const [mix, setMix] = useState<GenerationMix | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!regionId || !hasEIAKey()) return;
    setLoading(true);
    getGenerationMix(regionId)
      .then(setMix)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [regionId]);

  return { mix, loading };
}

/**
 * Hook: Simple clock for UTC display in header.
 */
export function useClock(intervalMs = 1000) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return time;
}
