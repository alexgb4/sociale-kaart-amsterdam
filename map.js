// Initialize map
var map = L.map('map').setView([52.37, 4.90], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

// Panes: polygons under markers
map.createPane('polygons');
map.getPane('polygons').style.zIndex = 200;

map.createPane('markers');
map.getPane('markers').style.zIndex = 400;

var orgMarkers = [];
var categoriesSet = new Set();
var stadsdelenSet = new Set();
var wijkenSet = new Set();


// simple bright color palette for categories
var categoryColors = {
  'Basisscholen': '#ff7f00',
  'Bewonersgroepen': '#1b9e77',
  'Buurtcentrum': '#e41a1c',
  'Buurt centrum': '#e41a1c',
  'Buurt media': '#377eb8',
  'Cultureel centrum': '#984ea3',
  'Hogescholen/Universiteiten': '#4daf4a',
  'Informele zorgdragers': '#ffff33',
  'Jongeren organisaties': '#a65628',
  'Jongeren organisatie': '#a65628',
  'Jongeren organsiatie': '#a65628',
  'MBO': '#8dd3c7',
  'Meiden Organisaties': '#e7298a',
  'Meiden organisaties': '#e7298a',
  'Opvang': '#fb8072',
  'Sportverenigingen': '#f781bf',
  'Voortgezet Onderwijs': '#999999',
  'Voortgezet onderwijs': '#999999',
  'Vrouwen Organisaties': '#fb9a99',
  'Vrouwen organisaties': '#fb9a99',
  'Woonzorg centrum': '#1f78b4',
  'App': '#6a3d9a'
};

function getCategoryColor(cat) {
  cat = (cat || '').trim();
  if (categoryColors[cat]) return categoryColors[cat];
  // fallback: deterministic color based on hash
  var hash = 0;
  for (var i = 0; i < cat.length; i++) {
    hash = cat.charCodeAt(i) + ((hash << 5) - hash);
  }
  var r = (hash >> 0) & 0xFF;
  var g = (hash >> 8) & 0xFF;
  var b = (hash >> 16) & 0xFF;
  return 'rgb(' + (r % 200) + ',' + (g % 200) + ',' + (b % 200) + ')';
}

// normalize category names a bit so filters match better
function normalizeCategory(cat) {
  cat = (cat || '').trim();

  // Merge small variations and group categories
  if (cat === 'Buurt centrum') return 'Buurtcentrum';
  if (cat === 'Buurt meda') return 'Buurt media';

  // Merge Bewonersgroep/organisatie into Bewonersgroepen
  if (cat === 'Bewonersgroep/organisatie') return 'Bewonersgroepen';

  // Merge several buurt-related categories into Buurtcentrum
  if (cat === 'Bibliotheek/Buurt centrum') return 'Buurtcentrum';
  if (cat === 'Buurtcentrum/Informele zorgdragers') return 'Buurtcentrum';
  if (cat === 'Opvang') return 'Buurtcentrum';
  if (cat === 'Woonzorg centrum') return 'Buurtcentrum';
  if (cat === 'Cultureel centrum' || cat === 'Cultureelcentrum') return 'Buurtcentrum';

  // Map App into Jongeren organisaties so it doesn't show as a separate category
  if (cat === 'App') return 'Jongeren organisaties';

  // Merge jongeren variations
  if (cat === 'Jongeren organisatie' || cat === 'Jongeren organsiatie')
    return 'Jongeren organisaties';

  // Merge meiden into vrouwen organisaties
  if (cat === 'Meiden Organisaties' || cat === 'Meiden organisaties')
    return 'Vrouwen organisaties';

  if (cat === 'Voortgezet Onderwijs')
    return 'Voortgezet onderwijs';
  if (cat === 'Vrouwen Organisaties')
    return 'Vrouwen organisaties';

  return cat;
}


function pastelColor(name) {
  name = name || '';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  let h = Math.abs(hash) % 360;
  return 'hsl(' + h + ', 60%, 80%)';
}


// Load CSV
Papa.parse("Organisaties.csv", {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: function(results) {
    let data = results.data || [];
    let seen = {}; // for de-duplicating by name+PC6

    data.forEach(row => {
      let name = (row['Vestigingnaam'] || row['Vestigingnaam '] || '').trim();
      let pc6 = (row['PC6'] || '').trim();
      if (!name && !pc6) return;

      // key to identify duplicates
      let key = (name.toLowerCase() || '') + '|' + (pc6.toLowerCase() || '');
      if (seen[key]) {
        // duplicate -> skip
        return;
      }
      seen[key] = true;

      // skip obvious non-Amsterdam rows if you ever added them accidentally,
      // but keep Weesp as requested
      let gemeente = (row['Gemeente'] || '').trim();
      if (gemeente === 'Diemen') return;

      let catRaw = (row['Instelling/Categorie'] || '').trim();
      let cat = normalizeCategory(catRaw);
      categoriesSet.add(cat);

      let lat = parseFloat(row['Latitude']);
      let lon = parseFloat(row['Longitude']);
      if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;

      let popupLines = [];
      if (name) popupLines.push('<b>' + name + '</b>');
      if (catRaw) popupLines.push(catRaw);
           let buurt = (row['Buurten'] || '').trim();
      let wijk  = (row['Wijk'] || '').trim();
      let sd    = (row['Stadsdeel'] || '').trim();

      // collect unique stadsdelen & wijken for filters
      if (sd)   stadsdelenSet.add(sd);
      if (wijk) wijkenSet.add(wijk);

      let lineLoc = [];
      if (buurt) lineLoc.push(buurt);
      if (wijk)  lineLoc.push(wijk);
      if (sd)    lineLoc.push(sd);
      if (lineLoc.length) popupLines.push(lineLoc.join(', '));
      if (pc6) popupLines.push('PC6: ' + pc6);


      let color = getCategoryColor(cat || catRaw);
      let marker = L.circleMarker([lat, lon], {
        radius: 6,
        color: color,
        fillColor: color,
        weight: 1,
        fillOpacity: 0.85,
        pane: 'markers'
      }).bindPopup(popupLines.join('<br>'));

      marker.addTo(map);

      orgMarkers.push({
        marker: marker,
        category: cat,
        rawCategory: catRaw,
        name: name,
        pc6: pc6,
        stadsdeel: sd,
        wijk: wijk
      });
    }); // <– closes data.forEach

    // after we processed all rows, build UI + apply filters once
    buildCategories();
    buildAreaFilters();
    applyFilter();
  }
}); // <– closes Papa.parse



function buildCategories(){
  const box = document.getElementById('categories');
  box.innerHTML = '';
  // sort categories alphabetically
  Array.from(categoriesSet).sort().forEach(cat=>{
    let color = getCategoryColor(cat);
    let div = document.createElement('div');
    div.className = 'cat-row';
    div.innerHTML = '<label>'
      + '<input type="checkbox" class="cat-filter" checked value="'+cat+'"> '
      + '<span class="cat-color-dot" style="background:'+color+'"></span> '
      + cat +
      '</label>';
    box.appendChild(div);
  });
  box.querySelectorAll('input.cat-filter').forEach(cb=>{
    cb.addEventListener('change',applyFilter);
  });
}
function buildAreaFilters() {
  var sdSelect   = document.getElementById('filter-stadsdeel');
  var wijkSelect = document.getElementById('filter-wijk');
  if (!sdSelect || !wijkSelect) return;

  // Fill stadsdelen
  Array.from(stadsdelenSet).sort().forEach(function (sd) {
    var opt = document.createElement('option');
    opt.value = sd;
    opt.textContent = sd;
    sdSelect.appendChild(opt);
  });

  // Fill wijken
  Array.from(wijkenSet).sort().forEach(function (wijk) {
    var opt = document.createElement('option');
    opt.value = wijk;
    opt.textContent = wijk;
    wijkSelect.appendChild(opt);
  });

  sdSelect.addEventListener('change', applyFilter);
  wijkSelect.addEventListener('change', applyFilter);
}

function applyFilter() {
  var active = [];
  document
    .querySelectorAll('#categories input.cat-filter:checked')
    .forEach(function (cb) {
      active.push(cb.value);
    });

  var sdSelect   = document.getElementById('filter-stadsdeel');
  var wijkSelect = document.getElementById('filter-wijk');

  var selectedSd   = sdSelect   ? sdSelect.value   : '';
  var selectedWijk = wijkSelect ? wijkSelect.value : '';

  orgMarkers.forEach(function (obj) {
    var catOk  = (active.length === 0) || (active.indexOf(obj.category) !== -1);
    var sdOk   = !selectedSd   || obj.stadsdeel === selectedSd;
    var wijkOk = !selectedWijk || obj.wijk      === selectedWijk;

    if (catOk && sdOk && wijkOk) {
      if (!map.hasLayer(obj.marker)) obj.marker.addTo(map);
    } else {
      if (map.hasLayer(obj.marker)) map.removeLayer(obj.marker);
    }
  });
}



// Sidebar toggle
// Sidebar toggle (OLD, DISABLED)
// document.getElementById('toggle-btn').onclick = function(){
//   document.getElementById('sidebar').classList.toggle('collapsed');
//   if (document.getElementById('sidebar').classList.contains('collapsed')) {
//     document.getElementById('map').style.left = '40px';
//   } else {
//     document.getElementById('map').style.left = '300px';
//   }
// };



// --- Load wijk polygons (pastel areas) ---
// --- Load wijk polygons (pastel areas) + labels + zoom on click ---
// --- Load wijk polygons (pastel areas) + labels + zoom on click ---
fetch('geojson_lnglat.json')
  .then(function (r) { return r.json(); })
  .then(function (data) {
    L.geoJSON(data, {
      pane: 'polygons',
      style: function (feature) {
        var wijknaam =
          (feature.properties && (feature.properties.Wijk || feature.properties.WIJK || feature.properties.Wijknaam || feature.properties.WijkNaam)) ||
          '';
        return {
          color: '#777777',            // wijk border
          weight: 2,
          fillColor: pastelColor(wijknaam),
          fillOpacity: 0.30
        };
      },
      onEachFeature: function (feature, layer) {
        var wijk = feature.properties.Wijk || feature.properties.WIJK || '';
        var sd   = feature.properties.Stadsdeel || feature.properties.stadsdeel || '';

        var label = wijk && sd ? (wijk + ' – ' + sd)
                   : wijk || sd || 'Onbekende wijk';

        // Hover label
       layer.bindTooltip(label, {
  sticky: true,
  className: 'wijk-label',
  direction: 'top',
  offset: [0, -10]   // a bit above the cursor
});


        // Click = zoom to that wijk
        layer.on('click', function () {
          map.fitBounds(layer.getBounds(), { padding: [20, 20] });
        });
      }
    }).addTo(map);
  });


// --- Load stadsdeel borders ---
// --- Load stadsdeel borders + labels + zoom on click ---
// --- Load stadsdeel borders ---
// --- Load stadsdeel borders + labels + zoom on click ---
fetch('geojson_lnglat_stadsdelen.json')
  .then(function (r) { return r.json(); })
  .then(function (data) {
    L.geoJSON(data, {
      pane: 'polygons',
      style: {
        color: '#000000',    // thick black border
        weight: 4,
        dashArray: '4 3',
        fillOpacity: 0
      },
      onEachFeature: function (feature, layer) {
        var sd = feature.properties.Stadsdeel || feature.properties.stadsdeel || '';

        if (sd) {
  layer.bindTooltip(sd, {
  sticky: true,
  className: 'stadsdeel-label',
  direction: 'top',
  offset: [0, -12]
});


        }

        layer.on('click', function () {
          map.fitBounds(layer.getBounds(), { padding: [30, 30] });
        });
      }
    }).addTo(map);
  });




