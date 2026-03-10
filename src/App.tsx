import { useState, useCallback } from 'react';
import { US_REGIONS } from '@/data/regions';
import { useGridSnapshot, useDemandSeries, useClock } from '@/hooks/useEIA';
import { setEIAKey, hasEIAKey } from '@/api/eia';
import { formatMW, formatUTCTime, SEVERITY_COLORS, FUEL_COLORS, FUEL_LABELS,
         mixToPercentages, renewablePercent, computeGridStressIndex, gsiSeverity } from '@/utils';
import GridMap from '@/components/GridMap';
import type { GridRegion } from '@/types';

// ── Sub-components ──

function Header({ time, activeView, onViewChange }: { time: Date; activeView: string; onViewChange: (v: string) => void }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: isMobile ? '8px 12px' : '12px 24px',
      flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 8 : 0,
      background: 'rgba(5,12,30,0.9)',
      borderBottom: '1px solid rgba(0,180,255,0.08)',
      backdropFilter: 'blur(20px)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: 'linear-gradient(135deg, #00d4aa, #0088ff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, boxShadow: '0 0 20px rgba(0,180,255,0.3)',
        }}>⚡</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2, fontFamily: "'Space Grotesk', sans-serif" }}>
            GRIDPULSE
          </div>
          <div style={{ fontSize: 8, color: 'rgba(0,200,255,0.6)', letterSpacing: 3, textTransform: 'uppercase' }}>
            US Energy Grid Intelligence
          </div>
        </div>
      </div>

      {/* Author credit — hidden on mobile */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, ...(isMobile ? { display: 'none' } : {}) }}>
        <div style={{
          fontSize: 9, color: 'rgba(255,255,255,0.3)',
          letterSpacing: 1.5, textTransform: 'uppercase',
          fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
        }}>Created by Dr. Mosab Hawarey</div>
        <a
          href="https://x.com/DrHawarey"
          target="_blank"
          rel="noreferrer"
          style={{
            padding: '3px 12px', borderRadius: 5,
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.45)',
            fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
            textDecoration: 'none', fontFamily: "'JetBrains Mono', monospace",
            transition: 'all 0.2s', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.color='#1d9bf0'; (e.target as HTMLElement).style.borderColor='rgba(29,155,240,0.4)'; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.color='rgba(255,255,255,0.45)'; (e.target as HTMLElement).style.borderColor='rgba(255,255,255,0.1)'; }}
        >
          @DrHawarey
        </a>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 3 }}>
        {[
          { id: 'map', label: '🗺 Map' },
          { id: 'dashboard', label: '📊 Dashboard' },
        ].map(v => (
          <button key={v.id} onClick={() => onViewChange(v.id)} style={{
            padding: '6px 16px', borderRadius: 6, border: 'none',
            background: activeView === v.id ? 'rgba(0,180,255,0.12)' : 'transparent',
            color: activeView === v.id ? '#00d4ff' : 'rgba(255,255,255,0.4)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: "'DM Sans', sans-serif",
          }}>{v.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          padding: '4px 12px', borderRadius: 6,
          background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.2)',
          fontSize: 10, color: '#00e6a8', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e6a8', animation: 'pulse 2s infinite' }} />
          EIA LIVE
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
          color: 'rgba(0,200,255,0.7)', letterSpacing: 1,
        }}>
          {formatUTCTime(time)}
        </div>
      </div>
    </header>
  );
}

function ApiKeyPrompt({ onSubmit }: { onSubmit: (key: string) => void }) {
  const [key, setKey] = useState('');
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'linear-gradient(135deg, #030810, #0a1628)',
      padding: 40,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 8, marginBottom: 16,
        background: 'linear-gradient(135deg, #00d4aa, #0088ff)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        boxShadow: '0 0 30px rgba(0,180,255,0.4)',
      }}>⚡</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 8 }}>
        GRIDPULSE
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 32, textAlign: 'center', maxWidth: 400, lineHeight: 1.6, fontSize: 14 }}>
        Enter your free EIA API key to connect to live US grid data.
        Get one at <a href="https://www.eia.gov/opendata/register.php" target="_blank" rel="noreferrer"
          style={{ color: '#00d4ff', textDecoration: 'underline' }}>eia.gov/opendata</a>
      </p>
      <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 460 }}>
        <input
          type="text"
          placeholder="Paste your EIA API key..."
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && key.length > 10 && onSubmit(key)}
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,180,255,0.15)',
            color: '#fff', fontSize: 14, fontFamily: "'JetBrains Mono', monospace",
            outline: 'none',
          }}
        />
        <button
          onClick={() => key.length > 10 && onSubmit(key)}
          style={{
            padding: '12px 24px', borderRadius: 8, border: 'none',
            background: key.length > 10 ? 'linear-gradient(135deg, #00d4aa, #0088ff)' : 'rgba(255,255,255,0.05)',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: key.length > 10 ? 'pointer' : 'default',
            transition: 'all 0.3s ease',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Connect
        </button>
      </div>
      <button
        onClick={() => onSubmit('DEMO_MODE')}
        style={{
          marginTop: 16, padding: '8px 20px', borderRadius: 6,
          background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Demo Mode (simulated data)
      </button>
    </div>
  );
}

function RegionList({ regions, selected, onSelect }: {
  regions: GridRegion[];
  selected: GridRegion | null;
  onSelect: (r: GridRegion) => void;
}) {
  const groups = {
    western: regions.filter(r => r.interconnection === 'western'),
    texas: regions.filter(r => r.interconnection === 'texas'),
    eastern: regions.filter(r => r.interconnection === 'eastern'),
  };

  const groupColors = { western: '#00D4AA', texas: '#FF8C00', eastern: '#3B82F6' };
  const groupNames = { western: 'Western', texas: 'Texas', eastern: 'Eastern' };

  return (
    <div style={{ padding: '0 12px 16px' }}>
      {(Object.keys(groups) as Array<keyof typeof groups>).map(key => (
        <div key={key} style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 9, color: groupColors[key], letterSpacing: 2,
            textTransform: 'uppercase', padding: '8px 8px 4px', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 8, height: 2, background: groupColors[key], borderRadius: 1 }} />
            {groupNames[key]} Interconnection
          </div>
          {groups[key].map(r => (
            <div
              key={r.id}
              onClick={() => onSelect(r)}
              style={{
                padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                background: selected?.id === r.id ? 'rgba(0,180,255,0.08)' : 'transparent',
                border: selected?.id === r.id ? '1px solid rgba(0,180,255,0.15)' : '1px solid transparent',
                transition: 'all 0.15s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 2,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{r.shortName}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>{r.name}</div>
              </div>
              <div style={{
                fontSize: 9, color: 'rgba(255,255,255,0.3)',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {r.id}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function RingGauge({ value, max, label, unit, color, size = 88 }: {
  value: number; max: number; label: string; unit: string; color: string; size?: number;
}) {
  const pct = Math.min(value / (max || 1), 1);
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 6px ${color}44)` }} />
      </svg>
      <div style={{ marginTop: -size + 8, position: 'relative', height: size - 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>
          {typeof value === 'number' ? formatMW(value).replace(' MW','').replace(' GW','').replace(' TW','') : value}
        </div>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 }}>{unit}</div>
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function EnergyMixBar({ mix }: { mix: Record<string, number> }) {
  const entries = Object.entries(mix).filter(([_, v]) => v > 0.5).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <div style={{ display: 'flex', height: 22, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
        {entries.map(([key, pct]) => (
          <div key={key} style={{
            width: `${pct}%`, background: FUEL_COLORS[key] || '#555',
            transition: 'width 0.8s ease', minWidth: pct > 0 ? 2 : 0,
          }} title={`${FUEL_LABELS[key] || key}: ${pct.toFixed(1)}%`} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px' }}>
        {entries.map(([key, pct]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: FUEL_COLORS[key] || '#555' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{FUEL_LABELS[key] || key}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontFamily: "'JetBrains Mono', monospace" }}>
              {pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemandChart({ data, forecast }: { data: { timestamp: string; value: number }[]; forecast: { timestamp: string; value: number }[] }) {
  if (data.length === 0) return <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, padding: 20 }}>Loading demand curve...</div>;

  const allValues = [...data.map(d => d.value), ...forecast.map(f => f.value)].filter(v => v > 0);
  const maxVal = Math.max(...allValues);
  const minVal = Math.min(...allValues);
  const range = maxVal - minVal || 1;
  const W = 600, H = 110, pad = 2;

  const toY = (v: number) => H - pad - ((v - minVal) / range) * (H - pad * 2);
  const toPath = (pts: typeof data) => pts.filter(p => p.value > 0).map((p, i) =>
    `${(i / Math.max(pts.length - 1, 1)) * W},${toY(p.value)}`
  ).join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1="0" y1={pad + f * (H - pad*2)} x2={W} y2={pad + f * (H - pad*2)} stroke="rgba(255,255,255,0.03)" />
      ))}
      <defs>
        <linearGradient id="dFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {forecast.length > 0 && (
        <polyline points={toPath(forecast)} fill="none" stroke="rgba(255,200,0,0.25)" strokeWidth="1.5" strokeDasharray="4 3" />
      )}
      {data.length > 0 && (
        <>
          <polygon points={`0,${H} ${toPath(data)} ${W},${H}`} fill="url(#dFill)" />
          <polyline points={toPath(data)} fill="none" stroke="#00d4ff" strokeWidth="2" strokeLinejoin="round" />
        </>
      )}
      <text x="4" y={pad + 10} fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="JetBrains Mono">{formatMW(maxVal)}</text>
      <text x="4" y={H - 4} fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="JetBrains Mono">{formatMW(minVal)}</text>
    </svg>
  );
}

function GSIBadge({ score }: { score: number }) {
  const sev = gsiSeverity(score);
  const colors = SEVERITY_COLORS[sev];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 16px', borderRadius: 8,
      background: colors.bg, border: `1px solid ${colors.border}33`,
    }}>
      <div style={{
        fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
        color: colors.text,
      }}>{score}</div>
      <div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>Grid Stress</div>
        <div style={{ fontSize: 11, color: colors.text, fontWeight: 600, textTransform: 'uppercase' }}>{sev}</div>
      </div>
    </div>
  );
}

/** Map info panel overlay — shows selected region details on top of map */
function MapInfoPanel({ region, snapshot, demoMode }: { region: GridRegion; snapshot: any; demoMode: boolean }) {
  const displayMix = snapshot ? mixToPercentages(snapshot.generationMix) : {
    solar: 15, wind: 23, nuclear: 5, gas: 42, coal: 8, hydro: 3, oil: 1, other: 3
  };
  const displayDemand = snapshot?.demand || 76400;
  const displayGeneration = snapshot?.netGeneration || 78200;
  const displayRenewable = snapshot ? renewablePercent(snapshot.generationMix) : 38;
  const gsi = snapshot ? computeGridStressIndex(snapshot) : 62;

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16,
      width: 320, maxHeight: 'calc(100% - 32px)',
      background: 'rgba(5,12,30,0.92)',
      border: '1px solid rgba(0,180,255,0.12)',
      borderRadius: 12,
      backdropFilter: 'blur(20px)',
      overflowY: 'auto',
      zIndex: 10,
    }}>
      <div style={{ padding: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{
              fontSize: 18, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
              background: 'linear-gradient(135deg, #fff, rgba(0,200,255,0.8))',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>{region.shortName}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
              {region.name}
              {demoMode && <span style={{ color: '#ffaa00', marginLeft: 6 }}>DEMO</span>}
            </div>
          </div>
          <GSIBadge score={gsi} />
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Demand', value: formatMW(displayDemand), color: '#00d4ff' },
            { label: 'Generation', value: formatMW(displayGeneration), color: '#8B5CF6' },
            { label: 'Renewable', value: `${Math.round(displayRenewable)}%`, color: '#00e6a8' },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 8, padding: '10px 8px', textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: kpi.color, fontFamily: "'JetBrains Mono', monospace" }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {kpi.label}
              </div>
            </div>
          ))}
        </div>

        {/* Mix */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>
            Generation Mix
          </div>
          <EnergyMixBar mix={displayMix} />
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──

export default function App() {
  const [ready, setReady] = useState(hasEIAKey());
  const [demoMode, setDemoMode] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<GridRegion>(US_REGIONS.find(r => r.id === 'ERCO') || US_REGIONS[0]);
  const [activeView, setActiveView] = useState<string>('map');
  const time = useClock();

  const { snapshot, loading, error } = useGridSnapshot(
    demoMode ? null : selectedRegion.id
  );
  const { data: demandData, forecast: forecastData } = useDemandSeries(
    demoMode ? null : selectedRegion.id
  );

  const handleKeySubmit = useCallback((key: string) => {
    if (key === 'DEMO_MODE') {
      setDemoMode(true);
      setReady(true);
      return;
    }
    setEIAKey(key);
    setReady(true);
  }, []);

  if (!ready) return <ApiKeyPrompt onSubmit={handleKeySubmit} />;

  // Demo data fallback
  const displayMix = snapshot ? mixToPercentages(snapshot.generationMix) : {
    solar: 15, wind: 23, nuclear: 5, gas: 42, coal: 8, hydro: 3, oil: 1, other: 3
  };
  const displayDemand = snapshot?.demand || 76400;
  const displayGeneration = snapshot?.netGeneration || 78200;
  const displayInterchange = snapshot?.interchange || -1800;
  const displayRenewable = snapshot ? renewablePercent(snapshot.generationMix) : 38;
  const gsi = snapshot ? computeGridStressIndex(snapshot) : 62;

  // ── MAP VIEW ──
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (activeView === 'map') {
    return (
      <div style={{
        background: '#030810', height: '100vh', color: '#fff',
        fontFamily: "'DM Sans', -apple-system, sans-serif",
        display: 'flex', flexDirection: 'column',
      }}>
        <Header time={time} activeView={activeView} onViewChange={setActiveView} />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Slim region sidebar — hidden on mobile */}
          {!isMobile && (
            <div style={{
              width: 220, borderRight: '1px solid rgba(0,180,255,0.06)',
              background: 'rgba(5,10,25,0.7)', overflowY: 'auto', flexShrink: 0,
            }}>
              <div style={{
                padding: '12px 14px 6px', fontSize: 9, color: 'rgba(255,255,255,0.3)',
                letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600,
              }}>Regions</div>
              <RegionList regions={US_REGIONS} selected={selectedRegion} onSelect={setSelectedRegion} />
            </div>
          )}

          {/* Map area */}
          <div style={{ flex: 1, position: 'relative' }}>
            <GridMap
              regions={US_REGIONS}
              selectedRegion={selectedRegion}
              onSelectRegion={setSelectedRegion}
            />
            {/* Overlay info panel — top right, full data */}
            <MapInfoPanel region={selectedRegion} snapshot={snapshot} demoMode={demoMode} />
          </div>
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </div>
    );
  }

  // ── DASHBOARD VIEW ──
  return (
    <div style={{
      background: 'linear-gradient(135deg, #030810 0%, #0a1628 40%, #081020 100%)',
      height: '100vh', color: '#fff',
      fontFamily: "'DM Sans', -apple-system, sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      <Header time={time} activeView={activeView} onViewChange={setActiveView} />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', flex: 1, overflow: 'hidden' }}>

        {/* LEFT — Region Selector */}
        <div style={{
          borderRight: '1px solid rgba(0,180,255,0.06)',
          background: 'rgba(5,10,25,0.5)',
          overflowY: 'auto',
        }}>
          <div style={{
            padding: '14px 16px 8px',
            fontSize: 10, color: 'rgba(255,255,255,0.3)',
            letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600,
          }}>
            Balancing Authorities
          </div>
          <RegionList regions={US_REGIONS} selected={selectedRegion} onSelect={setSelectedRegion} />
        </div>

        {/* CENTER — Main Dashboard */}
        <div style={{ overflowY: 'auto', padding: '24px 32px' }}>

          {/* Region title bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{
                fontSize: 26, fontWeight: 700, margin: 0,
                fontFamily: "'Space Grotesk', sans-serif",
                background: 'linear-gradient(135deg, #fff, rgba(0,200,255,0.8))',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {selectedRegion.shortName}
              </h1>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                {selectedRegion.name}
                {demoMode && <span style={{ color: '#ffaa00', marginLeft: 8 }}>• DEMO DATA</span>}
                {loading && <span style={{ color: '#00d4ff', marginLeft: 8 }}>• Fetching...</span>}
                {error && <span style={{ color: '#ff6b6b', marginLeft: 8 }}>• {error}</span>}
              </div>
            </div>
            <GSIBadge score={gsi} />
          </div>

          {/* KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
              <RingGauge value={displayDemand} max={displayGeneration * 1.3} label="Demand" unit={formatMW(displayDemand).split(' ')[1]} color="#00d4ff" />
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
              <RingGauge value={displayGeneration} max={displayGeneration * 1.3} label="Net Generation" unit={formatMW(displayGeneration).split(' ')[1]} color="#8B5CF6" />
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
              <RingGauge value={Math.round(displayRenewable)} max={100} label="Renewable" unit="%" color="#00e6a8" />
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
              <RingGauge value={Math.abs(displayInterchange)} max={Math.abs(displayInterchange) * 3} label={displayInterchange >= 0 ? 'Exporting' : 'Importing'} unit={formatMW(Math.abs(displayInterchange)).split(' ')[1]} color={displayInterchange >= 0 ? '#00D4AA' : '#FF8C00'} />
            </div>
          </div>

          {/* Generation Mix */}
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 12, padding: 20, marginBottom: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                Generation Mix
              </div>
              <div style={{ fontSize: 10, color: 'rgba(0,200,255,0.5)', fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 6 }}>
                LIVE
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e6a8', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              </div>
            </div>
            <EnergyMixBar mix={displayMix} />
          </div>

          {/* Demand Curve */}
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 12, padding: 20, marginBottom: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                24h Demand Curve
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 16, height: 2, background: '#00d4ff', borderRadius: 1 }} />
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>Actual</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 16, height: 2, background: 'rgba(255,200,0,0.4)', borderRadius: 1 }} />
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>Forecast</span>
                </div>
              </div>
            </div>
            <DemandChart data={demandData} forecast={forecastData} />
          </div>

          {/* Data sources footer */}
          <div style={{
            display: 'flex', gap: 20, padding: '12px 0',
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }}>
            {[
              { name: 'EIA API v2', status: 'live' },
              { name: 'Form EIA-930', status: 'live' },
              { name: 'Fuel Type Data', status: 'live' },
              { name: 'Interchange', status: 'live' },
            ].map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e6a8' }} />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
