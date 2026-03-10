const fs = require('fs');
const d = JSON.parse(fs.readFileSync('public/substations.geojson'));
const south = d.features.filter(f => f.geometry.coordinates[1] < 37);
console.log('Total:', d.features.length, '| South of 37:', south.length);
