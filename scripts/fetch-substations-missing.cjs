/**
 * fetch-substations-missing.cjs — fetch only missing chunks, try multiple Overpass mirrors
 * node scripts/fetch-substations-missing.cjs
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'substations.geojson');

// Multiple Overpass mirrors to rotate through
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

async function fetchChunk(bbox, chunkName) {
  const query = `[out:json][timeout:90];way["power"="substation"](${bbox});out center;`;
  for (let m = 0; m < MIRRORS.length; m++) {
    const mirror = MIRRORS[m];
    process.stdout.write(`    trying ${mirror.replace('https://', '').split('/')[0]}... `);
    try {
      const url = mirror + '?data=' + encodeURIComponent(query);
      const raw = await fetchUrl(url);
      if (!raw.trim().startsWith('{')) {
        console.log('rate limited');
        await sleep(5000);
        continue;
      }
      const json = JSON.parse(raw);
      const features = json.elements
        .filter(e => e.center && e.center.lat && e.center.lon)
        .map(e => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [e.center.lon, e.center.lat] },
          properties: { ...e.tags, osm_id: e.id },
        }));
      console.log(`OK — ${features.length} features`);
      return features;
    } catch (e) {
      console.log(`error: ${e.message}`);
    }
  }
  return null;
}

// Chunks still needed (SW already done = lat<37, lon<-100)
const MISSING = [
  { name: 'SE', bbox: '24,-100,37,-65'  },
  { name: 'NE', bbox: '37,-100,50,-65'  },
];

(async () => {
  const existing = JSON.parse(fs.readFileSync(OUT));
  const existingIds = new Set(existing.features.map(f => f.properties.osm_id));
  console.log(`Existing: ${existing.features.length} features`);

  const allFeatures = [...existing.features];

  for (let i = 0; i < MISSING.length; i++) {
    const chunk = MISSING[i];
    console.log(`\nFetching ${chunk.name} (${chunk.bbox}):`);
    if (i > 0) { console.log('  Waiting 15s...'); await sleep(15000); }

    const features = await fetchChunk(chunk.bbox, chunk.name);
    if (!features) {
      console.log(`Failed all mirrors for ${chunk.name}. Saving progress and stopping.`);
      break;
    }

    const newFeatures = features.filter(f => !existingIds.has(f.properties.osm_id));
    newFeatures.forEach(f => existingIds.add(f.properties.osm_id));
    allFeatures.push(...newFeatures);

    fs.writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features: allFeatures }));
    console.log(`  Saved. Total: ${allFeatures.length}`);
  }

  console.log(`\nDone: ${allFeatures.length} total features.`);
})();
