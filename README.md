# ⚡ GridPulse

**Real-time US Energy Grid Intelligence Dashboard**

Live demand, generation mix, interchange flows, and grid stress scoring powered by the EIA API.

## Quick Start

```bash
# 1. Clone
git clone <your-repo-url>
cd gridpulse

# 2. Install
npm install

# 3. Get your free EIA API key
#    → https://www.eia.gov/opendata/register.php

# 4. Configure
cp .env.example .env.local
# Edit .env.local and paste your EIA API key

# 5. Run
npm run dev
```

Open http://localhost:5173

## What It Does

- **25 US Balancing Authorities** tracked in real-time via EIA-930 data
- **Generation Mix** — solar, wind, nuclear, gas, coal, hydro breakdown per region
- **Demand Curves** — 24h actual vs forecast with live updates
- **Grid Stress Index** — composite score from demand/capacity ratio, reserve margins, and renewable intermittency
- **Interchange Flows** — see which regions are importing/exporting power

## Data Sources

| Source | What | Update |
|--------|------|--------|
| EIA API v2 | Demand, generation, fuel mix, interchange | Hourly |
| EIA-930 | Balancing authority operational data | Hourly |

## Architecture

```
src/
  api/eia.ts          — EIA API v2 client (typed, rate-limited)
  hooks/useEIA.ts     — React hooks for polling grid data
  data/regions.ts     — US balancing authority definitions + coordinates
  types/index.ts      — TypeScript interfaces for all data models
  utils/index.ts      — Formatting, colors, Grid Stress Index calculation
  App.tsx             — Main dashboard layout
```

## Roadmap

- [ ] Phase 2: ENTSO-E (Europe), UK Carbon Intensity API
- [ ] Phase 2: Groq LLM threat classification
- [ ] Phase 3: MapLibre/deck.gl geospatial map
- [ ] Phase 3: NASA FIRMS, USGS, Cloudflare Radar overlays
- [ ] Phase 3: RSS news feed aggregation

## Author

**Dr. Mosab Hawarey**
PhD, Geodetic & Photogrammetric Engineering (ITU) | MSc, Geomatics (Purdue) | MBA (Wales) | BSc, MSc (METU)

- GitHub: https://github.com/mhawarey
- Personal: https://hawarey.org/mosab
- ORCID: https://orcid.org/0000-0001-7846-951X

## License

MIT
