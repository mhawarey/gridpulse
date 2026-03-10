/**
 * fetch-transmission.js
 * Run once: node scripts/fetch-transmission.js
 *
 * Downloads US high-voltage transmission lines (>= 230 kV) from the
 * public HIFLD ArcGIS REST API and saves simplified GeoJSON to
 * public/transmission-lines.geojson for local serving (zero CORS issues).
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'transmission-lines.geojson');

const URL =
  'https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/' +
  'Electric_Power_Transmission_Lines/FeatureServer/0/query' +
  '?where=VOLTAGE+%3E%3D+230' +
  '&outFields=VOLTAGE%2CTYPE%2CSTATUS' +
  '&geometryPrecision=4' +
  '&outSR=4326' +
  '&f=geojson' +
  '&resultRecordCount=5000';

console.log('Fetching US transmission lines (>= 230 kV) from HIFLD...');

https.get(URL, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const count = json.features?.length ?? 0;
      if (count === 0) throw new Error('No features returned');
      fs.writeFileSync(OUT, JSON.stringify(json));
      console.log(`Done: ${count} features saved to ${OUT}`);
    } catch (e) {
      console.error('Failed:', e.message);
      console.error('Response preview:', data.slice(0, 500));
    }
  });
}).on('error', err => {
  console.error('Request error:', err.message);
});
