// Initialize map
var map = L.map('map').setView([52.37, 4.90], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

// Panes: polygons under markers, markers on top
map.createPane('polygons');
map.getPane('polygons').style.zIndex = 200;

map.createPane('markers');
map.getPane('markers').style.zIndex = 400;

var orgMarkers = [];
var categoriesSet = new Set();
var stadsdelenSet = new Set();
var wijkenSet = new Set();

// Category color mapping (same as before, with merges in normalizeCategory)
var categoryColors = {
  'Basisscholen': '#ff7f00',
  'Bewonersgroepen': '#1b9e77',
  'Buurtcentrum': '#e41a1c',
  'Buurt media': '#377eb8',
  'Cultureel centrum': '#984ea3',
  'Hogescholen/Universiteiten': '#4daf4a',
  'Informele zorgdragers': '#ffff33',
  'Jongeren organisaties': '#a65628',
  'MBO': '#8dd3c7',
  'Opvang': '#fb8072',
  'Sportverenigingen': '#f781bf',
  'Voortgezet onderwijs': '#999999',
  'Vrouwen organisaties': '#fb9a99',
  'Woonzorg centrum': '#1f78b4',
  'App': '#6a3d9a',
   'Meiden organisaties': '#e7298a',
  'Religieuze organisaties': '#b15928'
};

function getCategoryColor(cat) {
  cat = (cat || '').trim();
  if (categoryColors[cat]) return categoryColors[cat];
  // deterministic fallback color
  var hash = 0;
  for (var i = 0; i < cat.length; i++) {
    hash = cat.charCodeAt(i) + ((hash << 5) - hash);
  }
  var r = (hash >> 0) & 0xFF;
  var g = (hash >> 8) & 0xFF;
  var b = (hash >> 16) & 0xFF;
  return 'rgb(' + (r % 200) + ',' + (g % 200) + ',' + (b % 200) + ')';
}

// Normalize categories (merge variants)
function normalizeCategory(cat) {
  cat = (cat || '').trim();
// --- CATEGORY MERGES ---

// Religieuze: singular -> plural
if (cat === 'Religieuze organisatie')
  return 'Religieuze organisaties';

// Buurtcentrum + (Informele) Zorgdragers -> Buurtcentrum
if (cat === 'Buurtcentrum/(Informele) Zorgdragers')
  return 'Buurtcentrum';

// Sport: spelling variant -> plural
if (cat === 'Sport vereniging')
  return 'Sportverenigingen';


  if (cat === 'Buurt centrum') return 'Buurtcentrum';
  if (cat === 'Buurt meda') return 'Buurt media';

  if (cat === 'Bewonersgroep/organisatie') return 'Bewonersgroepen';

  if (cat === 'Bibliotheek/Buurt centrum') return 'Buurtcentrum';
  if (cat === 'Buurtcentrum/Informele zorgdragers') return 'Buurtcentrum';
  if (cat === 'Opvang') return 'Buurtcentrum';
  if (cat === 'Woonzorg centrum') return 'Buurtcentrum';
  if (cat === 'Cultureel centrum' || cat === 'Cultureelcentrum') return 'Buurtcentrum';

  if (cat === 'App') return 'Jongeren organisaties';

  if (cat === 'Jongeren organisatie' || cat === 'Jongeren organsiatie')
    return 'Jongeren organisaties';

  if (cat === 'Meiden Organisaties' || cat === 'Meiden organisaties')
    return 'Vrouwen organisaties';

  if (cat === 'Voortgezet Onderwijs')
    return 'Voortgezet onderwijs';
  if (cat === 'Vrouwen Organisaties')
    return 'Vrouwen organisaties';

  return cat;
}

// Pastel color for wijken
function pastelColor(name) {
  name = name || '';
  var hash = 0;
  for (var i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  var h = Math.abs(hash) % 360;
  return 'hsl(' + h + ', 60%, 80%)';
}

// Load CSV with organisations
Papa.parse("Organisaties.csv", {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: function(results) {
    var data = results.data || [];
    var seen = {};

    data.forEach(function(row) {
      var name = (row['Vestigingnaam'] || row['Vestigingnaam '] || row['Naam'] || '').trim();
      var pc6  = (row['PC6'] || '').trim();
      if (!name && !pc6) return;

      var key = (name.toLowerCase() || '') + '|' + (pc6.toLowerCase() || '');
      if (seen[key]) return;
      seen[key] = true;

      var gemeente = (row['Gemeente'] || '').trim();
      if (gemeente === 'Diemen') return;

      var wijk = (row['Wijk'] || '').trim();
      var sd   = (row['Stadsdeel'] || '').trim();
      var buurt = (row['Buurten'] || '').trim();

      if (sd)   stadsdelenSet.add(sd);
      if (wijk) wijkenSet.add(wijk);

      var catRaw = (row['Instelling/Categorie'] || '').trim();
      var cat = normalizeCategory(catRaw);
      categoriesSet.add(cat);

      var lat = parseFloat(row['Latitude']);
      var lon = parseFloat(row['Longitude']);
      if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;

      var popupLines = [];
      if (name) popupLines.push('<b>' + name + '</b>');
      if (catRaw) popupLines.push(catRaw);

      var locParts = [];
      if (buurt) locParts.push(buurt);
      if (wijk)  locParts.push(wijk);
      if (sd)    locParts.push(sd);
      if (locParts.length) popupLines.push(locParts.join(', '));
      if (pc6) popupLines.push('PC6: ' + pc6);

      var color = getCategoryColor(cat);
      var marker = L.circleMarker([lat, lon], {
        radius: 6,
        color: color,
        fillColor: color,
        weight: 1,
        fillOpacity: 0.85,
        pane: 'markers'
      }).bindPopup(popupLines.join('<br>'));

      marker.addTo(map);

      var idx = orgMarkers.length;
      orgMarkers.push({
        idx: idx,
        marker: marker,
        category: cat,
        rawCategory: catRaw,
        name: name,
        pc6: pc6,
        stadsdeel: sd,
        wijk: wijk,
        buurt: buurt,
        lat: lat,
        lon: lon
      });
    });

    buildCategories();
    buildAreaFilters();
    buildLegend();
    applyFilter();
    updateOrgList();
  }
});

function buildCategories() {
  var box = document.getElementById('categories');
  box.innerHTML = '';
  Array.from(categoriesSet).sort().forEach(function(cat) {
    var color = getCategoryColor(cat);
    var div = document.createElement('div');
    div.className = 'cat-row';
    div.innerHTML =
      '<label>' +
        '<input type="checkbox" class="cat-filter" checked value="' + cat + '"> ' +
        '<span class="cat-color-dot" style="background:' + color + '"></span>' +
        cat +
      '</label>';
    box.appendChild(div);
  });

  box.querySelectorAll('input.cat-filter').forEach(function(cb) {
    cb.addEventListener('change', applyFilter);
  });
}

function buildAreaFilters() {
  var sdSelect   = document.getElementById('filter-stadsdeel');
  var wijkSelect = document.getElementById('filter-wijk');
  if (!sdSelect || !wijkSelect) return;

  Array.from(stadsdelenSet).sort().forEach(function(sd) {
    var opt = document.createElement('option');
    opt.value = sd;
    opt.textContent = sd;
    sdSelect.appendChild(opt);
  });

  Array.from(wijkenSet).sort().forEach(function(wijk) {
    var opt = document.createElement('option');
    opt.value = wijk;
    opt.textContent = wijk;
    wijkSelect.appendChild(opt);
  });

  sdSelect.addEventListener('change', applyFilter);
  wijkSelect.addEventListener('change', applyFilter);
}

function buildLegend() {
  var legend = document.getElementById('legend');
  legend.innerHTML = '<div class=\"title\">Kleuren per categorie</div>';
  Array.from(categoriesSet).sort().forEach(function(cat) {
    var color = getCategoryColor(cat);
    var div = document.createElement('div');
    div.className = 'item';
    div.innerHTML =
      '<div class=\"color\" style=\"background:' + color + '\"></div>' +
      '<span>' + cat + '</span>';
    legend.appendChild(div);
  });
}

function applyFilter() {
  var active = [];
  document.querySelectorAll('#categories input.cat-filter:checked')
    .forEach(function(cb) { active.push(cb.value); });

  var sdSelect   = document.getElementById('filter-stadsdeel');
  var wijkSelect = document.getElementById('filter-wijk');

  var selectedSd   = sdSelect   ? sdSelect.value   : '';
  var selectedWijk = wijkSelect ? wijkSelect.value : '';

  orgMarkers.forEach(function(obj) {
    var catOk  = (active.length === 0) || active.indexOf(obj.category) !== -1;
    var sdOk   = !selectedSd   || obj.stadsdeel === selectedSd;
    var wijkOk = !selectedWijk || obj.wijk      === selectedWijk;

    if (catOk && sdOk && wijkOk) {
      if (!map.hasLayer(obj.marker)) obj.marker.addTo(map);
    } else {
      if (map.hasLayer(obj.marker)) map.removeLayer(obj.marker);
    }
  });

  updateOrgList();
}

function updateOrgList() {
  var container = document.getElementById('org-list-content');
  if (!container) return;

  var bounds = map.getBounds();

  var groupModeInput = document.querySelector('input[name=\"group-mode\"]:checked');
  var groupMode = groupModeInput ? groupModeInput.value : 'category';

  var activeCats = [];
  document.querySelectorAll('#categories input.cat-filter:checked')
    .forEach(function(cb) { activeCats.push(cb.value); });

  var sdSelect   = document.getElementById('filter-stadsdeel');
  var wijkSelect = document.getElementById('filter-wijk');

  var selectedSd   = sdSelect   ? sdSelect.value   : '';
  var selectedWijk = wijkSelect ? wijkSelect.value : '';

  var groups = {};

  orgMarkers.forEach(function(obj) {
    if (!map.hasLayer(obj.marker)) return;
    if (!bounds.contains(obj.marker.getLatLng())) return;

    var catOk  = (activeCats.length === 0) || activeCats.indexOf(obj.category) !== -1;
    var sdOk   = !selectedSd   || obj.stadsdeel === selectedSd;
    var wijkOk = !selectedWijk || obj.wijk      === selectedWijk;
    if (!catOk || !sdOk || !wijkOk) return;

    var key;
    if (groupMode === 'wijk') {
      key = obj.wijk || 'Onbekende wijk';
    } else {
      key = obj.category || 'Onbekende categorie';
    }

    if (!groups[key]) groups[key] = [];
    groups[key].push(obj);
  });

  var keys = Object.keys(groups).sort();
  if (keys.length === 0) {
    container.innerHTML = '<i>Geen organisaties in beeld.</i>';
    return;
  }

  var html = '';
  keys.forEach(function(key) {
    var list = groups[key];
    html += '<div class=\"org-category\">';
    html += '<div class=\"org-category-title\">' +
            key + ' (' + list.length + ')</div>';
    list.forEach(function(obj) {
      var line = obj.name || '(naam onbekend)';
      if (groupMode === 'category' && obj.wijk) {
        line += ' – ' + obj.wijk;
      }
      if (groupMode === 'wijk' && obj.category) {
        line += ' – ' + obj.category;
      }
      html += '<div class=\"org-item\" data-idx=\"' + obj.idx + '\">' +
              line +
              '</div>';
    });
    html += '</div>';
  });

  container.innerHTML = html;

  container.querySelectorAll('.org-item').forEach(function(el) {
    el.addEventListener('click', function() {
      var idx = parseInt(el.getAttribute('data-idx'), 10);
      var obj = orgMarkers[idx];
      if (obj && obj.marker) {
        map.setView(obj.marker.getLatLng(), 15);
        obj.marker.openPopup();
      }
    });
  });
}

// When group mode changes, rebuild org list
document.querySelectorAll('input[name=\"group-mode\"]').forEach(function(radio) {
  radio.addEventListener('change', updateOrgList);
});

// Sidebar toggle
document.getElementById('toggle-btn').onclick = function() {
  var sidebar = document.getElementById('sidebar');
  var mapDiv = document.getElementById('map');
  sidebar.classList.toggle('collapsed');
  if (sidebar.classList.contains('collapsed')) {
    mapDiv.style.left = '40px';
    this.textContent = '⮞';
  } else {
    mapDiv.style.left = '300px';
    this.textContent = '⮜';
  }
  setTimeout(function() {
    map.invalidateSize();
  }, 320);
};

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
          color: '#777777',
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

        layer.bindTooltip(label, {
          sticky: true,
          className: 'wijk-label',
          direction: 'top',
          offset: [0, -10]
        });

        layer.on('click', function () {
          map.fitBounds(layer.getBounds(), { padding: [20, 20] });
        });
      }
    }).addTo(map);
  });

// --- Load stadsdeel borders + labels + zoom on click ---
fetch('geojson_lnglat_stadsdelen.json')
  .then(function (r) { return r.json(); })
  .then(function (data) {
    L.geoJSON(data, {
      pane: 'polygons',
      style: {
        color: '#000000',
        weight: 4,
        dashArray: '4 3',
        fillOpacity: 0
      },
      onEachFeature: function (feature, layer) {
        var sd = feature.properties.Stadsdeel || feature.properties.stadsdeel || 'Onbekend stadsdeel';

        layer.bindTooltip(sd, {
          sticky: true,
          className: 'stadsdeel-label',
          direction: 'top',
          offset: [0, -12]
        });

        layer.on('click', function () {
          map.fitBounds(layer.getBounds(), { padding: [30, 30] });
        });
      }
    }).addTo(map);
  });

// Update org list when map moves
map.on('moveend', updateOrgList);
