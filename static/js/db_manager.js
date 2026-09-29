/**
 * ==========================================================================
 * AERO-ROUTE AI - DATABASE & SAVED ROUTES MANAGER (db_manager.js)
 * Persistent SQLite route storage, favorites, reload, and GeoJSON export
 * ==========================================================================
 */

/**
 * Save Currently Active Route to SQLite Database
 */
async function saveCurrentRoute() {
  if (!AppState.activeRouteData) {
    alert("Please plan a route first before saving.");
    return;
  }

  const data = AppState.activeRouteData;
  const routeName = prompt("Name this saved route:", `${AppState.startName.split(',')[0]} to ${AppState.destName.split(',')[0]}`) || "Optimized Route";

  const payload = {
    name: routeName,
    start_name: AppState.startName,
    end_name: AppState.destName,
    start_coords: AppState.startCoords,
    end_coords: AppState.destCoords,
    priority: AppState.currentPriority,
    distance_km: data.total_distance_km,
    duration_min: data.route_duration_min,
    co2_kg: data.analytics?.co2_emissions_kg || 0.0,
    waypoints: AppState.waypoints,
    path_coords: data.path,
    is_favorite: 1
  };

  try {
    const res = await fetch('/api/saved-routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.status === 'saved') {
      const btn = document.getElementById('btnSaveCurrentRoute');
      btn.innerHTML = `<i class="fa-solid fa-bookmark" style="color:var(--emerald-green);"></i>`;
      speakVoice("Route saved to persistent database.");
      loadSavedRoutesList();
    }
  } catch (err) {
    console.error("Save route failed:", err);
    alert("Failed to save route to database.");
  }
}

document.getElementById('btnSaveCurrentRoute').addEventListener('click', saveCurrentRoute);

/**
 * Load List of Saved Routes from SQLite DB
 */
async function loadSavedRoutesList() {
  const listContainer = document.getElementById('savedRoutesList');
  const countBadge = document.getElementById('savedCount');

  try {
    const res = await fetch('/api/saved-routes');
    const routes = await res.json();

    countBadge.textContent = routes.length;
    listContainer.innerHTML = '';

    if (routes.length === 0) {
      listContainer.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:0.85rem;"><i class="fa-regular fa-folder-open fa-2x"></i><p style="margin-top:8px;">No saved routes in database yet.<br>Click the bookmark icon to save any route.</p></div>`;
      return;
    }

    routes.forEach(r => {
      const card = document.createElement('div');
      card.className = 'saved-route-card';
      card.innerHTML = `
        <div class="saved-card-header">
          <span class="saved-card-title">${r.name}</span>
          <button class="btn-star-fav ${r.is_favorite ? 'favorited' : ''}" onclick="toggleFav(${r.id}, event)" title="Toggle Favorite">
            <i class="fa-solid fa-star"></i>
          </button>
        </div>
        <div style="font-size:0.75rem; color:var(--text-muted); display:flex; flex-direction:column; gap:2px;">
          <div><i class="fa-solid fa-circle-dot" style="color:var(--emerald-green); font-size:9px;"></i> ${r.start_name}</div>
          <div><i class="fa-solid fa-location-dot" style="color:var(--emergency-red); font-size:9px;"></i> ${r.end_name}</div>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.78rem; font-weight:700; color:var(--text-main); margin-top:2px;">
          <span>${r.distance_km} km • ${r.duration_min} min</span>
          <span style="font-size:0.7rem; color:var(--primary-blue); text-transform:uppercase;">${r.priority}</span>
        </div>
        <div style="display:flex; gap:6px; margin-top:6px;">
          <button class="btn-poi-action primary" onclick="loadSavedRouteOnMap(${r.id})">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Load Route
          </button>
          <button class="btn-poi-action" onclick="exportGeoJSON(${r.id})" title="Export GeoJSON">
            <i class="fa-solid fa-file-export"></i> GeoJSON
          </button>
          <button class="btn-poi-action" onclick="deleteSavedRoute(${r.id})" style="color:var(--emergency-red);" title="Delete Route">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;
      listContainer.appendChild(card);
    });

  } catch (err) {
    console.error("Failed to load saved routes:", err);
  }
}

/**
 * Load a Saved Route from Database and Render on Map
 */
window.loadSavedRouteOnMap = async function(routeId) {
  try {
    const res = await fetch(`/api/saved-routes/${routeId}`);
    const r = await res.json();
    if (!r) return;

    AppState.startCoords = r.start_coords;
    AppState.destCoords = r.end_coords;
    AppState.startName = r.start_name;
    AppState.destName = r.end_name;

    document.getElementById('inputStart').value = r.start_name;
    document.getElementById('inputDest').value = r.end_name;
    setPriority(r.priority);

    // If path coordinates are saved in database
    if (r.path_coords && r.path_coords.length > 0) {
      const mockRouteData = {
        path: r.path_coords,
        start: r.start_coords,
        end: r.end_coords,
        total_distance_km: r.distance_km,
        route_duration_min: r.duration_min,
        priority: r.priority,
        alternatives: [],
        steps: []
      };

      AppState.activeRouteData = mockRouteData;
      renderRoutePolylines(mockRouteData);
      updateRouteSummaryCard(mockRouteData);
      speakVoice(`Loaded saved route: ${r.name}`);
    } else {
      triggerRouteCalculation();
    }

    document.getElementById('savedRoutesDrawer').style.display = 'none';
  } catch (e) {
    console.error("Load route failed:", e);
  }
};

/**
 * Toggle Favorite Route
 */
window.toggleFav = async function(routeId, event) {
  if (event) event.stopPropagation();
  try {
    await fetch(`/api/saved-routes/${routeId}/favorite`, { method: 'POST' });
    loadSavedRoutesList();
  } catch (e) {
    console.error("Favorite toggle failed:", e);
  }
};

/**
 * Delete a Saved Route
 */
window.deleteSavedRoute = async function(routeId) {
  if (!confirm("Are you sure you want to delete this saved route?")) return;
  try {
    await fetch(`/api/saved-routes/${routeId}`, { method: 'DELETE' });
    loadSavedRoutesList();
  } catch (e) {
    console.error("Delete route failed:", e);
  }
};

/**
 * Export Active or Saved Route as GeoJSON file
 */
window.exportGeoJSON = function(routeId) {
  const route = AppState.activeRouteData;
  if (!route || !route.path) {
    alert("No active route path to export.");
    return;
  }

  const geojson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: route.path.map(c => [c[1], c[0]]) // GeoJSON is [lon, lat]
        },
        properties: {
          name: `${AppState.startName} to ${AppState.destName}`,
          distance_km: route.total_distance_km,
          duration_min: route.route_duration_min,
          priority: AppState.currentPriority,
          exported_at: new Date().toISOString()
        }
      }
    ]
  };

  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `AeroRoute_${AppState.currentPriority}_${Date.now()}.geojson`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  speakVoice("GeoJSON file downloaded.");
};

/**
 * Saved Routes Drawer Toggle Handlers
 */
const savedDrawer = document.getElementById('savedRoutesDrawer');

document.getElementById('btnOpenSavedRoutes').addEventListener('click', () => {
  savedDrawer.style.display = 'flex';
  loadSavedRoutesList();
});

document.getElementById('btnCloseSavedRoutes').addEventListener('click', () => {
  savedDrawer.style.display = 'none';
});
