/**
 * ==========================================================================
 * AERO-ROUTE AI - MAIN CONTROLLER (app.js)
 * Map initialization, Global App State, Theme, Audio & Presets
 * ==========================================================================
 */

const AppState = {
  map: null,
  currentTileLayer: null,
  activeTileStyle: 'voyager', // 'voyager' | 'osm' | 'dark'
  
  // Locations & Routing
  startCoords: null,
  startName: "Times Square, New York",
  destCoords: null,
  destName: "Brooklyn Bridge, New York",
  waypoints: [],
  currentPriority: "fastest",
  
  // Active Route Data
  activeRouteData: null,
  activePolyline: null,
  alternativePolylines: [],
  startMarker: null,
  destMarker: null,
  waypointMarkers: [],
  
  // Live Simulation
  vehicleMarker: null,
  simAnimationId: null,
  simProgressIndex: 0,
  isSimulating: false,
  simSpeedMultiplier: 2,
  
  // Settings & Flags
  isEmergencyMode: false,
  isVoiceEnabled: true,
  isPickOnMapActive: false,
  isAddClosureActive: false,
  showClosures: true,
  
  // POI & Closures Layers
  poiLayerGroup: null,
  closuresLayerGroup: null,
  
  // Audio Context for Emergency Siren
  audioCtx: null,
  sirenOsc: null,
  isSirenPlaying: false
};

// Preset City Coordinates
const CITY_PRESETS = {
  nyc: {
    name: "New York City",
    center: [40.730610, -73.935242],
    zoom: 13,
    start: "Times Square, New York",
    dest: "Brooklyn Bridge, New York"
  },
  london: {
    name: "London",
    center: [51.5074, -0.1278],
    zoom: 13,
    start: "Trafalgar Square, London",
    dest: "Tower Bridge, London"
  },
  paris: {
    name: "Paris",
    center: [48.8566, 2.3522],
    zoom: 13,
    start: "Eiffel Tower, Paris",
    dest: "Louvre Museum, Paris"
  },
  sf: {
    name: "San Francisco",
    center: [37.7749, -122.4194],
    zoom: 13,
    start: "Ferry Building, San Francisco",
    dest: "Golden Gate Bridge, San Francisco"
  },
  tokyo: {
    name: "Tokyo",
    center: [35.6762, 139.6503],
    zoom: 13,
    start: "Shibuya Crossing, Tokyo",
    dest: "Tokyo Skytree, Tokyo"
  },
  bangalore: {
    name: "Bangalore",
    center: [12.9716, 77.5946],
    zoom: 13,
    start: "MG Road, Bangalore",
    dest: "Electronic City, Bangalore"
  }
};

// Tile Providers
const TILE_PROVIDERS = {
  voyager: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      maxZoom: 19
    }
  },
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }
  },
  dark: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      className: 'dark-tiles'
    }
  }
};
/**
 * Initialize Leaflet Map
 */
function initMap() {
  const defaultCity = CITY_PRESETS.nyc;
  AppState.map = L.map('map', {
    center: defaultCity.center,
    zoom: defaultCity.zoom,
    zoomControl: false
  });

  // Position Zoom control in bottom right
  L.control.zoom({ position: 'bottomright' }).addTo(AppState.map);

  // Set default tile layer
  AppState.currentTileLayer = L.tileLayer(
    TILE_PROVIDERS.voyager.url,
    TILE_PROVIDERS.voyager.options
  ).addTo(AppState.map);

  // Initialize Layer Groups
  AppState.poiLayerGroup = L.layerGroup().addTo(AppState.map);
  AppState.closuresLayerGroup = L.layerGroup().addTo(AppState.map);

  // Map Click Listener
  AppState.map.on('click', handleMapClick);
}

/**
 * Handle Map Click (Setting locations or placing closures)
 */
function handleMapClick(e) {
  const lat = parseFloat(e.latlng.lat.toFixed(6));
  const lon = parseFloat(e.latlng.lng.toFixed(6));

  // If "Report Road Closure" mode is on
  if (AppState.isAddClosureActive) {
    promptAddRoadClosure(lat, lon);
    return;
  }

  // If "Pick on Map" mode is on
  if (AppState.isPickOnMapActive) {
    if (!AppState.startCoords) {
      AppState.startCoords = [lat, lon];
      AppState.startName = `${lat}, ${lon}`;
      document.getElementById('inputStart').value = AppState.startName;
      updateStartMarker(lat, lon);
      speakVoice("Starting point set on map");
    } else if (!AppState.destCoords) {
      AppState.destCoords = [lat, lon];
      AppState.destName = `${lat}, ${lon}`;
      document.getElementById('inputDest').value = AppState.destName;
      updateDestMarker(lat, lon);
      AppState.isPickOnMapActive = false;
      document.getElementById('btnPickOnMap').classList.remove('active');
      speakVoice("Destination set. Ready to plan route.");
      // Auto-trigger route calculation
      triggerRouteCalculation();
    } else {
      // Add as waypoint
      addWaypoint([lat, lon], `${lat}, ${lon}`);
    }
  }
}

/**
 * Marker Utilities
 */
function updateStartMarker(lat, lon) {
  if (AppState.startMarker) {
    AppState.map.removeLayer(AppState.startMarker);
  }
  const customIcon = L.divIcon({
    className: 'custom-start-marker',
    html: `<div style="background: #10B981; width: 28px; height: 28px; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px;"><i class="fa-solid fa-play"></i></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
  AppState.startMarker = L.marker([lat, lon], { icon: customIcon }).addTo(AppState.map);
  AppState.startMarker.bindPopup(`<b>Start Location</b><br>${AppState.startName}`);
}

function updateDestMarker(lat, lon) {
  if (AppState.destMarker) {
    AppState.map.removeLayer(AppState.destMarker);
  }
  const customIcon = L.divIcon({
    className: 'custom-dest-marker',
    html: `<div style="background: #EF4444; width: 28px; height: 28px; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px;"><i class="fa-solid fa-flag-checkered"></i></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
  AppState.destMarker = L.marker([lat, lon], { icon: customIcon }).addTo(AppState.map);
  AppState.destMarker.bindPopup(`<b>Destination</b><br>${AppState.destName}`);
}

/**
 * Voice Navigation (Web Speech API)
 */
function speakVoice(text) {
  if (!AppState.isVoiceEnabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel(); // Stop current speech
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

/**
 * Emergency Siren Sound Synthesizer (Web Audio API)
 */
function toggleEmergencySiren(activate) {
  if (!activate) {
    if (AppState.sirenOsc) {
      try {
        AppState.sirenOsc.stop();
        AppState.sirenOsc.disconnect();
      } catch (e) {}
      AppState.sirenOsc = null;
    }
    AppState.isSirenPlaying = false;
    return;
  }

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AppState.audioCtx) {
      AppState.audioCtx = new AudioContext();
    }
    if (AppState.audioCtx.state === 'suspended') {
      AppState.audioCtx.resume();
    }

    const osc = AppState.audioCtx.createOscillator();
    const gain = AppState.audioCtx.createGain();

    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.08, AppState.audioCtx.currentTime);

    // Siren wail modulation
    const now = AppState.audioCtx.currentTime;
    osc.frequency.setValueAtTime(650, now);
    for (let i = 0; i < 6; i++) {
      osc.frequency.linearRampToValueAtTime(950, now + i * 0.8 + 0.4);
      osc.frequency.linearRampToValueAtTime(650, now + i * 0.8 + 0.8);
    }

    osc.connect(gain);
    gain.connect(AppState.audioCtx.destination);
    osc.start();
    osc.stop(now + 4.8); // 4.8 seconds siren chime
    AppState.sirenOsc = osc;
    AppState.isSirenPlaying = true;
  } catch (e) {
    console.log("Audio siren not permitted:", e);
  }
}

/**
 * Toggle Emergency Mode
 */
function setEmergencyMode(enable) {
  AppState.isEmergencyMode = enable;
  const btn = document.getElementById('btnEmergencyModeToggle');
  const emergencyChip = document.querySelector('.priority-chip.emergency');

  if (enable) {
    document.body.classList.add('emergency-active');
    btn.classList.add('active');
    btn.innerHTML = `<i class="fa-solid fa-bell fa-shake"></i> <span>EMERGENCY ACTIVE</span>`;
    
    // Set priority to emergency
    setPriority('emergency');
    toggleEmergencySiren(true);
    speakVoice("Emergency Mode Engaged. Priority siren corridor active. Rerouting to emergency priority.");
  } else {
    document.body.classList.remove('emergency-active');
    btn.classList.remove('active');
    btn.innerHTML = `<i class="fa-solid fa-truck-medical"></i> <span>Emergency Mode</span>`;
    toggleEmergencySiren(false);
    setPriority('fastest');
  }
}

/**
 * Setup Event Listeners
 */
function setupGlobalEventListeners() {
  // Emergency Mode Button
  document.getElementById('btnEmergencyModeToggle').addEventListener('click', () => {
    setEmergencyMode(!AppState.isEmergencyMode);
    triggerRouteCalculation();
  });

  // Voice Toggle Button
  const btnVoice = document.getElementById('btnVoiceToggle');
  btnVoice.addEventListener('click', () => {
    AppState.isVoiceEnabled = !AppState.isVoiceEnabled;
    btnVoice.innerHTML = AppState.isVoiceEnabled ? 
      `<i class="fa-solid fa-volume-high"></i>` : 
      `<i class="fa-solid fa-volume-xmark" style="color: #EF4444;"></i>`;
    if (AppState.isVoiceEnabled) speakVoice("Voice guidance enabled.");
  });

  // Theme Toggle Button
  document.getElementById('btnThemeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('btnThemeToggle').innerHTML = isDark ? 
      `<i class="fa-solid fa-sun" style="color: #F59E0B;"></i>` : 
      `<i class="fa-solid fa-moon"></i>`;
  });

  // Map Tile Style Switcher
  document.getElementById('btnMapStyleToggle').addEventListener('click', () => {
    const styles = ['voyager', 'osm', 'dark'];
    let nextIndex = (styles.indexOf(AppState.activeTileStyle) + 1) % styles.length;
    AppState.activeTileStyle = styles[nextIndex];
    AppState.map.removeLayer(AppState.currentTileLayer);
    AppState.currentTileLayer = L.tileLayer(
      TILE_PROVIDERS[AppState.activeTileStyle].url,
      TILE_PROVIDERS[AppState.activeTileStyle].options
    ).addTo(AppState.map);
  });

  // Quick City Selector
  document.getElementById('quickCitySelect').addEventListener('change', (e) => {
    const key = e.target.value;
    if (CITY_PRESETS[key]) {
      const city = CITY_PRESETS[key];
      AppState.map.setView(city.center, city.zoom);
      document.getElementById('inputStart').value = city.start;
      document.getElementById('inputDest').value = city.dest;
      AppState.startCoords = null;
      AppState.destCoords = null;
      triggerRouteCalculation();
    }
  });

  // Swap Locations
  document.getElementById('btnSwapLocations').addEventListener('click', () => {
    const sInput = document.getElementById('inputStart');
    const dInput = document.getElementById('inputDest');
    const tempVal = sInput.value;
    sInput.value = dInput.value;
    dInput.value = tempVal;

    const tempCoords = AppState.startCoords;
    AppState.startCoords = AppState.destCoords;
    AppState.destCoords = tempCoords;

    triggerRouteCalculation();
  });

  // Pick on Map Toggle
  const btnPick = document.getElementById('btnPickOnMap');
  btnPick.addEventListener('click', () => {
    AppState.isPickOnMapActive = !AppState.isPickOnMapActive;
    btnPick.classList.toggle('active', AppState.isPickOnMapActive);
    if (AppState.isPickOnMapActive) {
      AppState.startCoords = null;
      AppState.destCoords = null;
      speakVoice("Click on the map to set Start location, then click destination.");
    }
  });

  // Current GPS Location Button
  document.getElementById('btnGpsStart').addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = parseFloat(pos.coords.latitude.toFixed(6));
          const lon = parseFloat(pos.coords.longitude.toFixed(6));
          AppState.startCoords = [lat, lon];
          AppState.startName = "My Current Location";
          document.getElementById('inputStart').value = AppState.startName;
          updateStartMarker(lat, lon);
          AppState.map.setView([lat, lon], 14);
          speakVoice("Acquired current location.");
        },
        () => alert("Could not fetch GPS location. Please check browser permissions.")
      );
    }
  });

  // Recenter Map
  document.getElementById('btnRecenterMap').addEventListener('click', () => {
    if (AppState.activePolyline) {
      AppState.map.fitBounds(AppState.activePolyline.getBounds(), { padding: [50, 50] });
    }
  });

  // Autocomplete setup for Start & Destination
  setupAutocomplete('inputStart', 'startAutocomplete', (item) => {
    AppState.startCoords = [item.lat, item.lon];
    AppState.startName = item.name;
    document.getElementById('inputStart').value = item.name;
    updateStartMarker(item.lat, item.lon);
  });

  setupAutocomplete('inputDest', 'destAutocomplete', (item) => {
    AppState.destCoords = [item.lat, item.lon];
    AppState.destName = item.name;
    document.getElementById('inputDest').value = item.name;
    updateDestMarker(item.lat, item.lon);
  });
}

/**
 * Autocomplete Input Helper with Debouncing
 */
function setupAutocomplete(inputId, dropdownId, onSelect) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  let debounceTimeout = null;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    const query = input.value.trim();
    if (query.length < 3) {
      dropdown.style.display = 'none';
      return;
    }

    debounceTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(query)}`);
        const suggestions = await res.json();
        dropdown.innerHTML = '';
        if (suggestions.length === 0) {
          dropdown.style.display = 'none';
          return;
        }

        suggestions.forEach(item => {
          const div = document.createElement('div');
          div.className = 'autocomplete-item';
          div.innerHTML = `<i class="fa-solid fa-location-dot" style="color: var(--primary-blue);"></i> <span>${item.name}</span>`;
          div.addEventListener('click', () => {
            onSelect(item);
            dropdown.style.display = 'none';
          });
          dropdown.appendChild(div);
        });
        dropdown.style.display = 'block';
      } catch (err) {
        console.error("Autocomplete error:", err);
      }
    }, 320);
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

// Global bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupGlobalEventListeners();
  // Auto-trigger initial route calculation for default NYC demo
  setTimeout(() => {
    triggerRouteCalculation();
  }, 400);
});
