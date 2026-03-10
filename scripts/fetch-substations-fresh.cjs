/**
 * fetch-substations-fresh.cjs — fetches all 4 chunks fresh, saves incrementally
 * node scripts/fetch-substations-fresh.cjs
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'substations.geojson');

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

const CHUNKS = [
  { name: 'SW', bbox: '24,-125,37,-100' },
  { name: 'SE', bbox: '24,-100,37,-65'  },
  { name: 'NW', bbox: '37,-125,50,-100' },
  { name: 'NE', bbox: '37,-100,50,-65'  },
];

(async () => {
  // Start fresh
  fs.writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features: [] }));
  const allFeatures = [];

  for (let i = 0; i < CHUNKS.length; i++) {
    const chunk = CHUNKS[i];
    if (i > 0) {
      console.log('  Waiting 12s...');
      await sleep(12000);
    }

    process.stdout.write(`  chunk ${chunk.name} (${chunk.bbox})... `);
    try {
      const query = `[out:json][timeout:90];way["power"="substation"](${chunk.bbox});out center;`;
      const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
      const raw = await fetchUrl(url);

      if (!raw.trim().startsWith('{')) {
        console.log(`\nRate limited or error. Response: ${raw.substring(0, 120)}`);
        console.log(`Saving ${allFeatures.length} features collected so far...`);
        fs.writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features: allFeatures }));
        process.exit(1);
      }

      const json = JSON.parse(raw);
      const features = json.elements
        .filter(e => e.center && e.center.lat && e.center.lon)
        .map(e => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [e.center.lon, e.center.lat] },
          properties: { ...e.tags, osm_id: e.id },
        }));

      allFeatures.push(...features);

      // Save after every chunk
      fs.writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features: allFeatures }));
      console.log(`${features.length} features (total saved: ${allFeatures.length})`);

    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      console.log(`Saving ${allFeatures.length} features collected so far...`);
      fs.writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features: allFeatures }));
      process.exit(1);
    }
  }

  // Final dedup by osm_id
  const seen = new Set();
  const unique = allFeatures.filter(f => {
    const id = f.properties.osm_id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  fs.writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features: unique }));
  console.log(`\nDone: ${unique.length} unique substations saved.`);
})();
