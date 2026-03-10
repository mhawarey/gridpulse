/**
 * fetch-substations.cjs — clean full re-fetch in 4 geographic chunks
 * node scripts/fetch-substations.cjs
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const OUT = path.join(PUBLIC, 'substations.geojson');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function chunkToFeatures(elements) {
  return elements
    .filter(e => e.center && e.center.lat && e.center.lon)
    .map(e => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.center.lon, e.center.lat] },
      properties: { ...e.tags, osm_id: e.id },
    }));
}

// 4 clean non-overlapping chunks covering contiguous US
const CHUNKS = [
  { name: 'SW', bbox: '24,-125,37,-100' },
  { name: 'SE', bbox: '24,-100,37,-65'  },
  { name: 'NW', bbox: '37,-125,50,-100' },
  { name: 'NE', bbox: '37,-100,50,-65'  },
];

(async () => {
  const allFeatures = [];

  for (const chunk of CHUNKS) {
    process.stdout.write(`  chunk ${chunk.name} (${chunk.bbox})... `);
    try {
      const query = `[out:json][timeout:90];way["power"="substation"](${chunk.bbox});out center;`;
      const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
      const raw = await fetchUrl(url);

      if (raw.includes('rate_limited') || raw.startsWith('The data')) {
        console.log('RATE LIMITED — wait a few minutes and retry.');
        process.exit(1);
      }

      const json = JSON.parse(raw);
      const features = chunkToFeatures(json.elements);
      allFeatures.push(...features);
      console.log(`${features.length} features (running total: ${allFeatures.length})`);

      await sleep(8000); // 8s pause between chunks to respect rate limit
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      process.exit(1);
    }
  }

  // Deduplicate by osm_id just in case
  const seen = new Set();
  const unique = allFeatures.filter(f => {
    const id = f.properties.osm_id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  fs.writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features: unique }));
  console.log(`\nDone: ${unique.length} unique substations saved to substations.geojson`);
})();
