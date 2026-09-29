/**
 * ==========================================================================
 * AERO-ROUTE AI - NEARBY SERVICES CONTROLLER (nearby.js)
 * High-visibility POI search for Hospitals, Fuel, Fire Stations, Parking, & Dining
 * ==========================================================================
 */

const POI_META = {
  hospital: {
    title: "Nearby Hospitals & Clinics",
    icon: "fa-hospital",
    color: "#EF4444",
    bgGradient: "linear-gradient(135deg, #EF4444, #DC2626)",
    badgeText: "24/7 Trauma"
  },
  fuel: {
    title: "Nearby Petrol & EV Stations",
    icon: "fa-gas-pump",
    color: "#10B981",
    bgGradient: "linear-gradient(135deg, #10B981, #059669)",
    badgeText: "Fuel & EV"
  },
  fire: {
    title: "Nearby Fire & Rescue Hubs",
    icon: "fa-fire-extinguisher",
    color: "#F97316",
    bgGradient: "linear-gradient(135deg, #F97316, #EA580C)",
    badgeText: "Emergency"
  },
  parking: {
    title: "Nearby Parking Garages & Lots",
    icon: "fa-square-parking",
    color: "#3B82F6",
    bgGradient: "linear-gradient(135deg, #3B82F6, #2563EB)",
    badgeText: "Monitored"
  },
  restaurant: {
    title: "Nearby Restaurants & Cafes",
    icon: "fa-utensils",
    color: "#F59E0B",
    bgGradient: "linear-gradient(135deg, #F59E0B, #D97706)",
    badgeText: "Top Rated"
  }
};

let currentNearbyCategory = null;

/**
 * Fetch & Display Nearby POIs
 */
async function fetchNearbyServices(category) {
  currentNearbyCategory = category;
  const meta = POI_META[category] || POI_META.hospital;

  // Determine search center (route midpoint or map center)
  let centerLat, centerLon;
  if (AppState.activeRouteData && AppState.activeRouteData.path && AppState.activeRouteData.path.length > 0) {
    const midIdx = Math.floor(AppState.activeRouteData.path.length / 2);
    centerLat = AppState.activeRouteData.path[midIdx][0];
    centerLon = AppState.activeRouteData.path[midIdx][1];
  } else {
    const center = AppState.map.getCenter();
    centerLat = center.lat;
    centerLon = center.lng;
  }

  // Update active pill button
  document.querySelectorAll('.btn-nearby-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-category') === category);
  });

  // Clear previous POI markers
  AppState.poiLayerGroup.clearLayers();

  // Show loading in POI drawer
  const drawer = document.getElementById('poiDrawer');
  const drawerTitle = document.getElementById('poiDrawerTitle');
  const poiList = document.getElementById('poiList');
  
  drawerTitle.innerHTML = `<i class="fa-solid ${meta.icon}" style="color:${meta.color};"></i> ${meta.title}`;
  poiList.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p style="margin-top:8px;">Scanning ${meta.title}...</p></div>`;
  drawer.style.display = 'flex';

  speakVoice(`Locating nearby ${category} services.`);

  try {
    const res = await fetch(`/api/nearby?lat=${centerLat}&lon=${centerLon}&category=${category}&radius=6.0`);
    const data = await res.json();
    const results = data.results || [];

    poiList.innerHTML = '';

    if (results.length === 0) {
      poiList.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">No ${category} locations found in this radius.</div>`;
      return;
    }

    // Render Markers on Map & Cards in Drawer
    results.forEach((poi, idx) => {
      // 1. Custom Leaflet Marker
      const customIcon = L.divIcon({
        className: 'nearby-poi-marker',
        html: `
          <div style="background: ${meta.bgGradient}; width: 32px; height: 32px; border-radius: 50%; border: 2.5px solid #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 13px; cursor: pointer; transition: transform 0.2s;">
            <i class="fa-solid ${meta.icon}"></i>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([poi.lat, poi.lon], { icon: customIcon }).addTo(AppState.poiLayerGroup);
      
      const popupContent = `
        <div style="font-family: var(--font-family); min-width: 170px;">
          <b style="color: ${meta.color}; font-size: 0.95rem;">${poi.name}</b>
          <div style="font-size: 0.78rem; color: #64748B; margin: 3px 0;">${poi.address}</div>
          <div style="font-size: 0.78rem; font-weight: 700;">★ ${poi.rating} • ${poi.open_status}</div>
          <button onclick="routeToPOI(${poi.lat}, ${poi.lon}, '${escapeHtml(poi.name)}')" style="margin-top: 8px; width: 100%; background: #2563EB; color: #fff; border: none; padding: 5px 8px; border-radius: 6px; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-diamond-turn-right"></i> Navigate Here
          </button>
        </div>
      `;
      marker.bindPopup(popupContent);

      // 2. Card in Drawer
      const card = document.createElement('div');
      card.className = 'poi-card';
      card.innerHTML = `
        <div class="poi-card-title">
          <span>${poi.name}</span>
          <span class="poi-badge" style="background: ${meta.color}20; color: ${meta.color};">${poi.open_status}</span>
        </div>
        <div class="poi-meta">
          <span><i class="fa-solid fa-location-arrow" style="color:${meta.color};"></i> ${poi.distance_km} km</span>
          <span><i class="fa-solid fa-star" style="color:#F59E0B;"></i> ${poi.rating}</span>
        </div>
        <div style="font-size:0.75rem; color:var(--text-muted);">${poi.address}</div>
        <div class="poi-btn-row">
          <button class="btn-poi-action primary" onclick="routeToPOI(${poi.lat}, ${poi.lon}, '${escapeHtml(poi.name)}')">
            <i class="fa-solid fa-diamond-turn-right"></i> Route Here
          </button>
          <button class="btn-poi-action" onclick="addPOIASWaypoint(${poi.lat}, ${poi.lon}, '${escapeHtml(poi.name)}')">
            <i class="fa-solid fa-plus"></i> Add Stop
          </button>
        </div>
      `;

      // Hover card focuses marker on map
      card.addEventListener('mouseenter', () => {
        marker.openPopup();
      });

      poiList.appendChild(card);
    });

  } catch (err) {
    console.error("Nearby fetch error:", err);
    poiList.innerHTML = `<div style="text-align:center; padding:20px; color:#EF4444;">Failed to fetch nearby services.</div>`;
  }
}

/**
 * Route Directly to Selected POI
 */
window.routeToPOI = function(lat, lon, name) {
  AppState.destCoords = [lat, lon];
  AppState.destName = name;
  document.getElementById('inputDest').value = name;
  updateDestMarker(lat, lon);
  document.getElementById('poiDrawer').style.display = 'none';
  speakVoice(`Navigating to ${name}`);
  triggerRouteCalculation();
};

/**
 * Add POI as Intermediate Waypoint
 */
window.addPOIASWaypoint = function(lat, lon, name) {
  addWaypoint([lat, lon], name);
  speakVoice(`Added ${name} as a stop.`);
};

/**
 * Clear Nearby POIs
 */
function clearNearbyPOIs() {
  AppState.poiLayerGroup.clearLayers();
  document.getElementById('poiDrawer').style.display = 'none';
  document.querySelectorAll('.btn-nearby-pill').forEach(btn => btn.classList.remove('active'));
}

/**
 * Helper to escape single quotes in strings
 */
function escapeHtml(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

/**
 * Setup Event Listeners for Nearby Dock
 */
document.querySelectorAll('.btn-nearby-pill[data-category]').forEach(btn => {
  btn.addEventListener('click', () => {
    const category = btn.getAttribute('data-category');
    fetchNearbyServices(category);
  });
});

document.getElementById('btnClearNearby').addEventListener('click', clearNearbyPOIs);
document.getElementById('btnClosePoiDrawer').addEventListener('click', () => {
  document.getElementById('poiDrawer').style.display = 'none';
});
