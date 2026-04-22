// Initialises and manages the Leaflet map.
const MapView = (() => {
  let _map = null;
  const _markers = {};

  const ICON_BLUE   = _makeIcon('#2563eb');
  const ICON_ORANGE = _makeIcon('#f97316');

  function _makeIcon(color) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="24" height="32">
      <path d="M12 0C7.6 0 4 3.6 4 8c0 6 8 16 8 16s8-10 8-16c0-4.4-3.6-8-8-8z"
            fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="12" cy="8" r="3" fill="white"/>
    </svg>`;
    return L.divIcon({
      html: svg,
      className: '',
      iconSize:   [24, 32],
      iconAnchor: [12, 32],
      popupAnchor:[0, -32],
    });
  }

  function init() {
    if (_map) return;
    _map = L.map('map').setView([54.5, -3], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(_map);
  }

  function _setMarker(key, lat, lon, icon, label) {
    if (_markers[key]) {
      _markers[key].setLatLng([lat, lon])
        .setIcon(icon)
        .setPopupContent(label);
    } else {
      _markers[key] = L.marker([lat, lon], { icon })
        .bindPopup(label)
        .addTo(_map);
    }
  }

  function _removeMarker(key) {
    if (_markers[key]) { _map.removeLayer(_markers[key]); delete _markers[key]; }
  }

  function update(primary, compare) {
    if (!_map) init();

    if (primary) {
      const { lat, lon, name } = primary.meta;
      _setMarker('primary', lat, lon, ICON_BLUE, name);
    } else {
      _removeMarker('primary');
    }

    if (compare) {
      const { lat, lon, name } = compare.meta;
      _setMarker('compare', lat, lon, ICON_ORANGE, name);
    } else {
      _removeMarker('compare');
    }

    // Fit bounds to visible markers
    const positions = Object.values(_markers).map(m => m.getLatLng());
    if (positions.length === 1) {
      _map.setView(positions[0], 8);
    } else if (positions.length > 1) {
      _map.fitBounds(L.latLngBounds(positions).pad(0.3));
    } else {
      _map.setView([54.5, -3], 5);
    }

    _map.invalidateSize();
  }

  return { init, update };
})();
