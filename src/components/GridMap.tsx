import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GridRegion } from '@/types';
import { INTERCONNECTION_COLORS } from '@/data/regions';

interface GridMapProps {
  regions: GridRegion[];
  selectedRegion: GridRegion | null;
  onSelectRegion: (region: GridRegion) => void;
}

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/** Exact geographic pin per balancing authority [lng, lat] */
const ANCHORS: Record<string, [number, number]> = {
  CISO: [-121.49, 38.58],  BPAT: [-122.90, 47.04],  PACW: [-123.04, 44.94],
  PACE: [-111.89, 40.76],  PSCO: [-104.99, 39.74],  AZPS: [-112.07, 33.45],
  SRP:  [-111.70, 33.20],  NEVP: [-119.77, 39.16],  WACM: [-104.82, 41.14],
  WALC: [-112.10, 34.57],  ERCO: [-97.74,  30.27],  PJM:  [-76.88,  40.27],
  MISO: [-89.40,  43.07],  ISNE: [-71.06,  42.36],  NYIS: [-73.76,  42.65],
  SOCO: [-86.30,  32.37],  TVA:  [-86.78,  36.16],  DUK:  [-80.84,  35.23],
  FPL:  [-81.38,  28.54],  SWPP: [-97.52,  35.47],  AECI: [-92.17,  38.58],
  SC:   [-79.93,  33.84],  SCEG: [-81.03,  34.00],  CPLE: [-78.64,  35.78],
};

// US electric transmission lines — served locally from public/ folder (no CORS issues)
// Run `node scripts/fetch-transmission.js` once to download the data
const TRANSMISSION_LINES_URL = '/transmission-lines.geojson';

const SOURCE_ID = 'ba-regions';
const LAYER_RING = 'ba-ring';
const LAYER_DOT  = 'ba-dot';
const LAYER_LABEL = 'ba-label';

const TOGGLE_LAYERS = [
  { id: 'transmission-lines', label: 'Transmission Lines', color: '#ffaa00' },
  { id: 'power-plants-layer', label: 'Power Plants',       color: '#00D4AA' },
  { id: 'substations-layer',  label: 'Substations',        color: '#facc15' },
  { id: 'ba-dot',             label: 'Grid Regions',       color: '#3B82F6' },
  { id: 'flow-arrows',        label: 'Flow Arrows',        color: '#00ffcc' },
];

interface FlowCorridor {
  from: string; to: string;
  label: string;           // human-readable corridor name
  interconnection: string; // Western / Eastern / Texas / Cross
  typicalGW: string;       // typical power exchange range
  notes: string;           // brief description
}

/** Neighboring BA pairs that exchange power — defines flow corridors */
const FLOW_CORRIDORS: FlowCorridor[] = [
  // Western Interconnection
  { from:'CISO', to:'BPAT', label:'CAISO ↔ BPA',        interconnection:'Western', typicalGW:'2–8 GW',  notes:'Pacific Northwest hydro exports to California' },
  { from:'CISO', to:'PACW', label:'CAISO ↔ PacifiCorp W', interconnection:'Western', typicalGW:'1–4 GW',  notes:'Oregon/Washington interchange' },
  { from:'CISO', to:'NEVP', label:'CAISO ↔ NV Energy',   interconnection:'Western', typicalGW:'0.5–2 GW',notes:'Nevada–California border flows' },
  { from:'CISO', to:'AZPS', label:'CAISO ↔ APS',         interconnection:'Western', typicalGW:'1–3 GW',  notes:'Southwest–California corridor' },
  { from:'BPAT', to:'PACW', label:'BPA ↔ PacifiCorp W',  interconnection:'Western', typicalGW:'1–5 GW',  notes:'Northwest intra-regional flows' },
  { from:'BPAT', to:'WACM', label:'BPA ↔ WAPA-CM',       interconnection:'Western', typicalGW:'0.5–2 GW',notes:'Pacific–Mountain transfer' },
  { from:'PACW', to:'PACE', label:'PacifiCorp W ↔ E',    interconnection:'Western', typicalGW:'1–3 GW',  notes:'Intra-PacifiCorp east–west tie' },
  { from:'PACE', to:'PSCO', label:'PacifiCorp E ↔ PSCo', interconnection:'Western', typicalGW:'0.5–2 GW',notes:'Utah–Colorado corridor' },
  { from:'PACE', to:'WACM', label:'PacifiCorp E ↔ WAPA', interconnection:'Western', typicalGW:'0.5–1.5 GW',notes:'Mountain West exchange' },
  { from:'PSCO', to:'WACM', label:'PSCo ↔ WAPA-CM',      interconnection:'Western', typicalGW:'0.3–1 GW', notes:'Colorado intra-state interchange' },
  { from:'AZPS', to:'SRP',  label:'APS ↔ SRP',           interconnection:'Western', typicalGW:'0.5–2 GW', notes:'Arizona intra-state flows' },
  { from:'AZPS', to:'WALC', label:'APS ↔ WAPA-DSW',      interconnection:'Western', typicalGW:'0.3–1 GW', notes:'Southwest desert corridor' },
  { from:'NEVP', to:'PACE', label:'NV Energy ↔ PacifiCorp E', interconnection:'Western', typicalGW:'0.2–0.8 GW',notes:'Nevada–Utah tie' },
  // Texas Interconnection
  { from:'ERCO', to:'SWPP', label:'ERCOT ↔ SPP',         interconnection:'Texas',   typicalGW:'0.1–0.3 GW',notes:'Limited DC ties; ERCOT is largely islanded' },
  // Eastern Interconnection
  { from:'SWPP', to:'MISO', label:'SPP ↔ MISO',          interconnection:'Eastern', typicalGW:'2–6 GW',  notes:'Major central US interchange' },
  { from:'SWPP', to:'AECI', label:'SPP ↔ AECI',          interconnection:'Eastern', typicalGW:'0.3–1 GW', notes:'Missouri–Arkansas corridor' },
  { from:'MISO', to:'PJM',  label:'MISO ↔ PJM',          interconnection:'Eastern', typicalGW:'3–8 GW',  notes:'Largest US BA-to-BA interface' },
  { from:'MISO', to:'TVA',  label:'MISO ↔ TVA',          interconnection:'Eastern', typicalGW:'1–4 GW',  notes:'Midwest–Southeast flows' },
  { from:'MISO', to:'AECI', label:'MISO ↔ AECI',         interconnection:'Eastern', typicalGW:'0.5–2 GW', notes:'Missouri–Midwest exchange' },
  { from:'PJM',  to:'NYIS', label:'PJM ↔ NYISO',         interconnection:'Eastern', typicalGW:'1–4 GW',  notes:'Mid-Atlantic–New York corridor' },
  { from:'PJM',  to:'ISNE', label:'PJM ↔ ISO-NE',        interconnection:'Eastern', typicalGW:'0.5–2 GW', notes:'PJM–New England tie via CT/RI' },
  { from:'PJM',  to:'DUK',  label:'PJM ↔ Duke',          interconnection:'Eastern', typicalGW:'1–3 GW',  notes:'Mid-Atlantic–Southeast flows' },
  { from:'TVA',  to:'SOCO', label:'TVA ↔ Southern Co.',  interconnection:'Eastern', typicalGW:'1–3 GW',  notes:'Tennessee–Georgia corridor' },
  { from:'TVA',  to:'DUK',  label:'TVA ↔ Duke',          interconnection:'Eastern', typicalGW:'0.5–2 GW', notes:'Tennessee–Carolina flows' },
  { from:'SOCO', to:'FPL',  label:'Southern ↔ FPL',      interconnection:'Eastern', typicalGW:'1–3 GW',  notes:'Georgia–Florida corridor' },
  { from:'SOCO', to:'DUK',  label:'Southern ↔ Duke',     interconnection:'Eastern', typicalGW:'0.5–2 GW', notes:'Southeast intra-regional' },
  { from:'DUK',  to:'SC',   label:'Duke ↔ Santee Cooper',interconnection:'Eastern', typicalGW:'0.2–0.8 GW',notes:'Carolinas intra-state' },
  { from:'DUK',  to:'CPLE', label:'Duke ↔ DEP-E',        interconnection:'Eastern', typicalGW:'0.3–1 GW', notes:'Duke intra-Carolinas tie' },
  { from:'SC',   to:'SCEG', label:'Santee ↔ DESC',       interconnection:'Eastern', typicalGW:'0.1–0.5 GW',notes:'South Carolina intra-state' },
  { from:'NYIS', to:'ISNE', label:'NYISO ↔ ISO-NE',      interconnection:'Eastern', typicalGW:'0.5–2 GW', notes:'New York–New England flows' },
];

const INTERCONNECTION_LINE_COLORS: Record<string, string> = {
  Western: '#00ffcc',
  Eastern: '#3B82F6',
  Texas:   '#FF8C00',
};

/** Build a GeoJSON FeatureCollection of flow corridor lines */
function buildFlowGeoJSON(anchors: Record<string, [number, number]>): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: FLOW_CORRIDORS
      .filter(c => anchors[c.from] && anchors[c.to])
      .map(c => ({
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: [anchors[c.from], anchors[c.to]] },
        properties: { from: c.from, to: c.to, label: c.label, interconnection: c.interconnection, typicalGW: c.typicalGW, notes: c.notes },
      })),
  };
}

export default function GridMap({ regions, selectedRegion, onSelectRegion }: GridMapProps) {
  // eslint-disable-line
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onSelectRef = useRef(onSelectRegion);
  onSelectRef.current = onSelectRegion;

  const [layerVis, setLayerVis] = useState<Record<string, boolean>>(
    Object.fromEntries(TOGGLE_LAYERS.map(l => [l.id, true]))
  );
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const dashOffsetRef = useRef(0);

  // Build GeoJSON from regions
  const buildGeoJSON = (selId: string | null): GeoJSON.FeatureCollection => ({
    type: 'FeatureCollection',
    features: regions.map(r => ({
      type: 'Feature',
      id: r.id,
      geometry: {
        type: 'Point',
        coordinates: ANCHORS[r.id] ?? [r.lng, r.lat],
      },
      properties: {
        id: r.id,
        label: r.shortName,
        color: INTERCONNECTION_COLORS[r.interconnection],
        selected: r.id === selId ? 1 : 0,
      },
    })),
  });

  // Init map once
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-96, 39],
      zoom: 4.0,
      minZoom: 2,
      maxZoom: 12,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;

    map.on('load', () => {
      setLastUpdated(new Date());
      // ── Transmission lines layer (rendered below BA dots) ──
      map.addSource('transmission', {
        type: 'geojson',
        data: TRANSMISSION_LINES_URL,
      });
      map.addLayer({
        id: 'transmission-lines',
        type: 'line',
        source: 'transmission',
        paint: {
          'line-color': [
            'step', ['get', 'VOLTAGE'],
            'rgba(80,160,255,0.2)',  // < 230 kV
            230,  '#2255aa',         // 230–344 kV
            345,  '#ffaa00',         // 345–499 kV
            500,  '#ff6600',         // 500+ kV
          ],
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            3, 0.4,
            6, 1.0,
            9, 2.0,
          ],
          'line-opacity': 0.45,
        },
      });

      // Add GeoJSON source
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: buildGeoJSON(null),
      });

      // Ring layer (outer circle)
      map.addLayer({
        id: LAYER_RING,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': ['case', ['==', ['get', 'selected'], 1], 18, 14],
          'circle-color': 'transparent',
          'circle-stroke-width': 2,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-opacity': ['case', ['==', ['get', 'selected'], 1], 1.0, 0.5],
          'circle-pitch-alignment': 'map',
        },
      });

      // Dot layer (filled inner circle)
      map.addLayer({
        id: LAYER_DOT,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': ['case', ['==', ['get', 'selected'], 1], 9, 6],
          'circle-color': ['get', 'color'],
          'circle-blur': 0.2,
          'circle-pitch-alignment': 'map',
        },
      });

      // Label layer
      map.addLayer({
        id: LAYER_LABEL,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-anchor': 'bottom',
          'text-offset': [0, -1.2],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(5,12,30,0.9)',
          'text-halo-width': 1.5,
          'text-opacity': ['case', ['==', ['get', 'selected'], 1], 1.0, 0.0],
        },
      });

      // Click handler
      map.on('click', LAYER_DOT, (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const rid = feat.properties?.id as string;
        const region = regions.find(r => r.id === rid);
        if (region) onSelectRef.current(region);
      });

      map.on('mouseenter', LAYER_DOT, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', LAYER_DOT, () => { map.getCanvas().style.cursor = ''; });

      // ── Power plants ──
      map.addSource('power-plants', { type: 'geojson', data: '/power-plants.geojson' });
      map.addLayer({
        id: 'power-plants-layer',
        type: 'circle',
        source: 'power-plants',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3, 8, 6],
          'circle-color': [
            'match', ['get', 'plant:source'],
            'solar',   '#FFD700',
            'wind',    '#00D4AA',
            'nuclear', '#C084FC',
            'gas',     '#FB923C',
            'coal',    '#94A3B8',
            'hydro',   '#38BDF8',
            'biomass', '#86EFAC',
            'oil',     '#F87171',
            /* default */ '#888888',
          ],
          'circle-opacity': 0.85,
          'circle-stroke-width': 0.5,
          'circle-stroke-color': 'rgba(255,255,255,0.2)',
          'circle-pitch-alignment': 'map',
        },
      });

      // ── Substations ──
      map.addSource('substations', { type: 'geojson', data: '/substations.geojson' });
      map.addLayer({
        id: 'substations-layer',
        type: 'circle',
        source: 'substations',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2, 10, 5],
          'circle-color': '#facc15',
          'circle-opacity': 0.7,
          'circle-stroke-width': 0.5,
          'circle-stroke-color': 'rgba(255,255,255,0.3)',
          'circle-pitch-alignment': 'map',
        },
      });

      // ── Flow arrows (animated dashed lines between BA nodes) ──
      map.addSource('flow-corridors', {
        type: 'geojson',
        data: buildFlowGeoJSON(ANCHORS),
      });

      // Background glow line
      map.addLayer({
        id: 'flow-glow',
        type: 'line',
        source: 'flow-corridors',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#00ffcc',
          'line-width': 4,
          'line-opacity': 0.08,
          'line-blur': 4,
        },
      });

      // Animated dashed flow line
      map.addLayer({
        id: 'flow-arrows',
        type: 'line',
        source: 'flow-corridors',
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: {
          'line-color': '#00ffcc',
          'line-width': 1.5,
          'line-opacity': 0.7,
          'line-dasharray': [0, 4, 3],
        },
      });

      // Animate the dash offset to create flowing movement
      const DASH_SEQUENCES = [
        [0, 4, 3], [0.5, 3.5, 3], [1, 3, 3], [1.5, 2.5, 3],
        [2, 2, 3], [2.5, 1.5, 3], [3, 1, 3], [3.5, 0.5, 3],
      ];
      let step = 0;
      let lastTime = 0;
      const FRAME_MS = 80; // speed — lower = faster

      const animateDash = (timestamp: number) => {
        if (timestamp - lastTime > FRAME_MS) {
          lastTime = timestamp;
          step = (step + 1) % DASH_SEQUENCES.length;
          if (map.getLayer('flow-arrows')) {
            map.setPaintProperty('flow-arrows', 'line-dasharray', DASH_SEQUENCES[step]);
          }
        }
        animFrameRef.current = requestAnimationFrame(animateDash);
      };
      animFrameRef.current = requestAnimationFrame(animateDash);

      // ── Popups for power plants & substations ──
      const popupStyle = `
        background: rgba(5,12,30,0.95);
        border: 1px solid rgba(0,180,255,0.2);
        border-radius: 8px;
        padding: 10px 14px;
        color: #fff;
        font-family: 'DM Sans', sans-serif;
        font-size: 12px;
        min-width: 160px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      `;

      const makePopup = (html: string, lngLat: maplibregl.LngLatLike) => {
        new maplibregl.Popup({ closeButton: false, offset: 8 })
          .setLngLat(lngLat)
          .setHTML(`<div style="${popupStyle}">${html}</div>`)
          .addTo(map);
      };

      map.on('click', 'power-plants-layer', (e) => {
        const p = e.features?.[0]?.properties ?? {};
        const source = p['plant:source'] || p['generator:source'] || 'Unknown';
        const output = p['plant:output:electricity'] || p['capacity'] || '';
        const operator = p['operator'] || '';
        const name = p['name'] || 'Power Plant';
        makePopup(
          `<div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#fff">${name}</div>
           <div style="color:rgba(255,255,255,0.5);font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Power Plant</div>
           ${source ? `<div style="margin-bottom:3px">⚡ Source: <span style="color:#00d4ff">${source}</span></div>` : ''}
           ${output ? `<div style="margin-bottom:3px">🔋 Capacity: <span style="color:#00d4ff">${output}</span></div>` : ''}
           ${operator ? `<div style="color:rgba(255,255,255,0.4);font-size:11px">${operator}</div>` : ''}`,
          e.lngLat
        );
      });

      map.on('click', 'substations-layer', (e) => {
        const p = e.features?.[0]?.properties ?? {};
        const name = p['name'] || 'Substation';
        const voltage = p['voltage'] || '';
        const operator = p['operator'] || '';
        const ref = p['ref'] || '';
        makePopup(
          `<div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#fff">${name}</div>
           <div style="color:rgba(255,255,255,0.5);font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Substation</div>
           ${voltage ? `<div style="margin-bottom:3px">⚡ Voltage: <span style="color:#facc15">${voltage} V</span></div>` : ''}
           ${ref ? `<div style="margin-bottom:3px">🏷 Ref: <span style="color:rgba(255,255,255,0.6)">${ref}</span></div>` : ''}
           ${operator ? `<div style="color:rgba(255,255,255,0.4);font-size:11px">${operator}</div>` : ''}`,
          e.lngLat
        );
      });

      map.on('mouseenter', 'power-plants-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'power-plants-layer', () => { map.getCanvas().style.cursor = ''; });
      map.on('mouseenter', 'substations-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'substations-layer', () => { map.getCanvas().style.cursor = ''; });

      // ── Transmission line popups ──
      map.on('click', 'transmission-lines', (e) => {
        const p = e.features?.[0]?.properties ?? {};
        const voltage = p['VOLTAGE'] ? `${p['VOLTAGE']} kV` : 'Unknown';
        const owner   = p['OWNER']  || p['OPER'] || '';
        const type    = p['TYPE']   || '';
        const status  = p['STATUS'] || '';
        const sub1    = p['SUB_1']  || '';
        const sub2    = p['SUB_2']  || '';
        const voltNum = Number(p['VOLTAGE']) || 0;
        const lineColor = voltNum >= 500 ? '#ff6600' : voltNum >= 345 ? '#ffaa00' : '#2255aa';
        makePopup(
          `<div style="font-weight:700;font-size:13px;margin-bottom:6px;color:${lineColor}">⚡ ${voltage} Transmission Line</div>
           ${type   ? `<div style="margin-bottom:3px;color:rgba(255,255,255,0.7)">Type: ${type}</div>` : ''}
           ${status ? `<div style="margin-bottom:3px;color:rgba(255,255,255,0.7)">Status: ${status}</div>` : ''}
           ${(sub1 && sub2) ? `<div style="margin-bottom:3px;color:rgba(255,255,255,0.55);font-size:11px">${sub1} ↔ ${sub2}</div>` : ''}
           ${owner  ? `<div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:4px">${owner}</div>` : ''}`,
          e.lngLat
        );
      });
      map.on('mouseenter', 'transmission-lines', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'transmission-lines', () => { map.getCanvas().style.cursor = ''; });

      // ── Flow arrow popups ──
      map.on('click', 'flow-arrows', (e) => {
        const p = e.features?.[0]?.properties ?? {};
        const ic = p['interconnection'] || 'Eastern';
        const icColor = ic === 'Western' ? '#00ffcc' : ic === 'Texas' ? '#FF8C00' : '#3B82F6';
        makePopup(
          `<div style="font-weight:700;font-size:13px;margin-bottom:4px;color:${icColor}">
             ⚡ ${p['label'] || `${p['from']} ↔ ${p['to']}`}
           </div>
           <div style="color:rgba(255,255,255,0.4);font-size:9px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">
             ${ic} Interconnection
           </div>
           <div style="display:flex;flex-direction:column;gap:5px">
             <div style="display:flex;justify-content:space-between;gap:16px">
               <span style="color:rgba(255,255,255,0.45);font-size:10px">Typical Flow</span>
               <span style="color:#fff;font-size:10px;font-family:'JetBrains Mono',monospace;font-weight:600">${p['typicalGW'] || 'N/A'}</span>
             </div>
             <div style="display:flex;justify-content:space-between;gap:16px">
               <span style="color:rgba(255,255,255,0.45);font-size:10px">From</span>
               <span style="color:#fff;font-size:10px;font-family:'JetBrains Mono',monospace">${p['from']}</span>
             </div>
             <div style="display:flex;justify-content:space-between;gap:16px">
               <span style="color:rgba(255,255,255,0.45);font-size:10px">To</span>
               <span style="color:#fff;font-size:10px;font-family:'JetBrains Mono',monospace">${p['to']}</span>
             </div>
           </div>
           <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);font-size:10px;color:rgba(255,255,255,0.4);font-style:italic">
             ${p['notes'] || ''}
           </div>`,
          e.lngLat
        );
      });
      map.on('mouseenter', 'flow-arrows', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'flow-arrows', () => { map.getCanvas().style.cursor = ''; });
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync layer visibility to map when toggles change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    Object.entries(layerVis).forEach(([id, visible]) => {
      // ba-dot toggle also controls ba-ring and ba-label
      const ids = id === 'ba-dot' ? ['ba-dot', 'ba-ring', 'ba-label']
                : id === 'flow-arrows' ? ['flow-arrows', 'flow-glow']
                : [id];
      ids.forEach(lid => {
        if (map.getLayer(lid)) {
          map.setLayoutProperty(lid, 'visibility', visible ? 'visible' : 'none');
        }
      });
    });
  }, [layerVis]);

  // Update source data when selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(buildGeoJSON(selectedRegion?.id ?? null));
  }, [selectedRegion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fly to selected region
  useEffect(() => {
    if (!mapRef.current || !selectedRegion) return;
    const pos = ANCHORS[selectedRegion.id] ?? [selectedRegion.lng, selectedRegion.lat];
    mapRef.current.flyTo({ center: pos as [number, number], zoom: 5.5, duration: 1200 });
  }, [selectedRegion]);

  const toggle = (id: string) =>
    setLayerVis(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
    >
      {/* Bottom-left stacked panel: Info → Legend → Map Layers */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16, zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 8,
        maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
      }}>

        {/* Legend */}
        <div style={{
          background: 'rgba(5,12,30,0.92)', border: '1px solid rgba(0,180,255,0.12)',
          borderRadius: 10, backdropFilter: 'blur(16px)', padding: '10px 14px', minWidth: 200,
        }}>
          <div style={{ fontSize: 9, color: 'rgba(0,200,255,0.6)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8, fontFamily: "'DM Sans',sans-serif" }}>Legend</div>

          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Transmission (kV)</div>
          {[
            { color: 'rgba(80,160,255,0.6)', label: '< 230 kV' },
            { color: '#2255aa', label: '230–344 kV' },
            { color: '#ffaa00', label: '345–499 kV' },
            { color: '#ff6600', label: '500+ kV' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <div style={{ width: 18, height: 3, background: item.color, borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontFamily: "'DM Sans',sans-serif" }}>{item.label}</span>
            </div>
          ))}

          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5, marginTop: 8 }}>Power Plants</div>
          {[
            { color: '#FFD700', label: 'Solar' },
            { color: '#00D4AA', label: 'Wind' },
            { color: '#C084FC', label: 'Nuclear' },
            { color: '#FB923C', label: 'Gas' },
            { color: '#94A3B8', label: 'Coal' },
            { color: '#38BDF8', label: 'Hydro' },
            { color: '#86EFAC', label: 'Biomass' },
            { color: '#F87171', label: 'Oil' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontFamily: "'DM Sans',sans-serif" }}>{item.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#facc15', flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontFamily: "'DM Sans',sans-serif" }}>Substation</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}>
            <div style={{ width: 18, height: 3, background: 'repeating-linear-gradient(90deg, #00ffcc 0px, #00ffcc 6px, transparent 6px, transparent 10px)', borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontFamily: "'DM Sans',sans-serif" }}>Flow Arrows</span>
          </div>

          {lastUpdated && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: "'JetBrains Mono',monospace" }}>
              ⏱ {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Map Layers */}
        <div style={{
          background: 'rgba(5,12,30,0.92)', border: '1px solid rgba(0,180,255,0.12)',
          borderRadius: 10, backdropFilter: 'blur(16px)', padding: '10px 14px', minWidth: 200,
        }}>
          <div style={{ fontSize: 9, color: 'rgba(0,200,255,0.6)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10, fontFamily: "'DM Sans',sans-serif" }}>Map Layers</div>
          {TOGGLE_LAYERS.map(layer => (
            <div key={layer.id} onClick={() => toggle(layer.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, cursor: 'pointer', opacity: layerVis[layer.id] ? 1 : 0.4, transition: 'opacity 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: layerVis[layer.id] ? layer.color : 'rgba(255,255,255,0.15)', transition: 'background 0.2s', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#fff', fontFamily: "'DM Sans',sans-serif", userSelect: 'none' }}>{layer.label}</span>
              </div>
              <div style={{ width: 28, height: 16, borderRadius: 8, background: layerVis[layer.id] ? layer.color : 'rgba(255,255,255,0.1)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: 2, left: layerVis[layer.id] ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
              </div>
            </div>
          ))}
        </div>

      </div>

      <style>{`
        .maplibregl-ctrl-attrib { font-size: 9px !important; opacity: 0.4; }
        .maplibregl-ctrl-group { background: rgba(5,12,30,0.8) !important; border: 1px solid rgba(0,180,255,0.15) !important; }
        .maplibregl-ctrl button .maplibregl-ctrl-icon { filter: invert(1); }
        .maplibregl-ctrl-group button + button { border-top: 1px solid rgba(0,180,255,0.1) !important; }
        .maplibregl-popup-content { background: transparent !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
        .maplibregl-popup-tip { display: none !important; }
      `}</style>
    </div>
  );
}
