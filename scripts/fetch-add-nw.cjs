/**
 * fetch-add-nw.cjs — fetch only NW chunk and add to existing data
 * node scripts/fetch-add-nw.cjs
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'substations.geojson');

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

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
  const existing = JSON.parse(fs.readFileSync(OUT));
  const existingIds = new Set(existing.features.map(f => f.properties.osm_id));
  console.log(`Existing: ${existing.features.length} features`);

  // Check what lat ranges we have
  const lats = existing.features.map(f => f.geometry.coordinates[1]);
  const lons = existing.features.map(f => f.geometry.coordinates[0]);
  console.log(`Lat range: ${Math.min(...lats).toFixed(1)} to ${Math.max(...lats).toFixed(1)}`);
  console.log(`Lon range: ${Math.min(...lons).toFixed(1)} to ${Math.max(...lons).toFixed(1)}`);

  // NW chunk: lat 37-50, lon -125 to -100
  const bbox = '37,-125,50,-100';
  const query = `[out:json][timeout:90];way["power"="substation"](${bbox});out center;`;

  let features = null;
  for (const mirror of MIRRORS) {
    process.stdout.write(`Trying ${mirror.replace('https://', '').split('/')[0]}... `);
    try {
      await sleep(3000);
      const url = mirror + '?data=' + encodeURIComponent(query);
      const raw = await fetchUrl(url);
      if (!raw.trim().startsWith('{')) {
        console.log('rate limited');
        continue;
      }
      const json = JSON.parse(raw);
      features = json.elements
        .filter(e => e.center && e.center.lat && e.center.lon)
        .map(e => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [e.center.lon, e.center.lat] },
          properties: { ...e.tags, osm_id: e.id },
        }));
      console.log(`OK — ${features.length} features`);
      break;
    } catch (e) {
      console.log(`error: ${e.message}`);
    }
  }

  if (!features) {
    console.log('All mirrors failed. Try again later.');
    process.exit(1);
  }

  const newFeatures = features.filter(f => !existingIds.has(f.properties.osm_id));
  console.log(`New unique NW features: ${newFeatures.length}`);

  const merged = [...existing.features, ...newFeatures];
  fs.writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features: merged }));
  console.log(`Done: ${merged.length} total features saved.`);
})();
