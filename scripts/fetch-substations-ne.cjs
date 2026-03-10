/**
 * fetch-substations-ne.cjs — retry NE chunk only, merge with existing data
 * node scripts/fetch-substations-ne.cjs
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

(async () => {
  // Load existing data
  const existing = JSON.parse(fs.readFileSync(OUT));
  const existingIds = new Set(existing.features.map(f => f.properties.osm_id));
  console.log(`Existing features: ${existing.features.length}`);

  // Retry NE chunk with longer wait
  console.log('Waiting 30s before retrying NE chunk (rate limit cooldown)...');
  await sleep(30000);

  console.log('Fetching NE (37,-100,50,-65)...');
  const query = `[out:json][timeout:90];way["power"="substation"](37,-100,50,-65);out center;`;
  const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
  const raw = await fetchUrl(url);

  if (!raw.startsWith('{')) {
    console.log('Still rate limited. Wait a few more minutes and retry.');
    console.log('Response starts with:', raw.substring(0, 100));
    process.exit(1);
  }

  const json = JSON.parse(raw);
  const newFeatures = json.elements
    .filter(e => e.center && !existingIds.has(e.id))
    .map(e => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.center.lon, e.center.lat] },
      properties: { ...e.tags, osm_id: e.id },
    }));

  console.log(`NE: ${newFeatures.length} new features`);

  const merged = [...existing.features, ...newFeatures];
  fs.writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features: merged }));
  console.log(`Done: ${merged.length} total substations saved.`);
})();
