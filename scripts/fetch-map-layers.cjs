/**
 * fetch-map-layers.cjs
 * Run once: node scripts/fetch-map-layers.cjs
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');

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

function toGeoJSON(elements) {
  const features = elements
    .filter(e => e.lat && e.lon)
    .map(e => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
      properties: { ...e.tags, osm_id: e.id },
    }));
  return { type: 'FeatureCollection', features };
}

// For ways/relations we use the center coordinate
function toGeoJSONWithCenter(elements) {
  const features = elements
    .filter(e => e.center || (e.lat && e.lon))
    .map(e => {
      const lat = e.center ? e.center.lat : e.lat;
      const lon = e.center ? e.center.lon : e.lon;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { ...e.tags, osm_id: e.id },
      };
    });
  return { type: 'FeatureCollection', features };
}

const BBOX = '24,-125,50,-65';

const QUERIES = [
  {
    name: 'power plants',
    file: 'power-plants.geojson',
    // nodes + ways + relations, get center for ways/relations
    query: `[out:json][timeout:90];(node["power"="plant"](${BBOX});way["power"="plant"](${BBOX});relation["power"="plant"](${BBOX}););out center;`,
    useCenter: true,
  },
  {
    name: 'substations',
    file: 'substations.geojson',
    // substations are mostly ways/relations (polygons), get their center
    query: `[out:json][timeout:90];(node["power"="substation"](${BBOX});way["power"="substation"](${BBOX});relation["power"="substation"](${BBOX}););out center;`,
    useCenter: true,
  },
];

(async () => {
  for (const q of QUERIES) {
    process.stdout.write(`Fetching ${q.name}... `);
    try {
      const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q.query);
      const raw = await fetchUrl(url);
      const json = JSON.parse(raw);
      if (!json.elements) throw new Error('No elements in response');
      const geojson = q.useCenter ? toGeoJSONWithCenter(json.elements) : toGeoJSON(json.elements);
      const count = geojson.features.length;
      if (count === 0) { console.log('WARN: 0 features.'); continue; }
      fs.writeFileSync(path.join(PUBLIC, q.file), JSON.stringify(geojson));
      console.log(`${count} features -> ${q.file}`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
  }
  console.log('Done.');
})();
