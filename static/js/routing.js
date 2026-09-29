/**
 * ==========================================================================
 * AERO-ROUTE AI - ROUTING & DYNAMIC REROUTE CONTROLLER (routing.js)
 * Path calculation, Priority profiles, Live driving simulation & Detours
 * ==========================================================================
 */

// Priority Color Schemes
const PRIORITY_COLORS = {
  fastest: '#6366F1',      // Electric Indigo
  safest: '#10B981',       // Vivid Emerald
  emergency: '#EF4444',    // Emergency Hot Red
  balanced: '#8B5CF6',     // Royal Violet
  accessible: '#06B6D4',   // Neon Cyan
  avoid_crowd: '#F59E0B',  // Amber Flame
  scenic: '#059669',       // Forest Green
  budget: '#84CC16'        // Fresh Lime
};

/**
 * Handle Priority Selection
 */
function setPriority(priority) {
  AppState.currentPriority = priority;
  
  // Update Priority Chips
  document.querySelectorAll('.priority-chip').forEach(chip => {
    const p = chip.getAttribute('data-priority');
    chip.classList.toggle('active', p === priority);
  });

  // Update Badge
  const badge = document.getElementById('activePriorityBadge');
  badge.textContent = priority.toUpperCase();
  badge.style.color = PRIORITY_COLORS[priority] || '#2563EB';

  // Sync Emergency button
  const emergencyBtn = document.getElementById('btnEmergencyModeToggle');
  if (priority === 'emergency') {
    emergencyBtn.classList.add('active');
  } else {
    emergencyBtn.classList.remove('active');
    document.body.classList.remove('emergency-active');
  }
}

/**
 * Setup Priority Click Handlers
 */
document.querySelectorAll('.priority-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const priority = chip.getAttribute('data-priority');
    setPriority(priority);
    triggerRouteCalculation();
  });
});

/**
 * Calculate & Optimize Route
 */
async function triggerRouteCalculation() {
  const startVal = document.getElementById('inputStart').value.trim();
  const destVal = document.getElementById('inputDest').value.trim();

  if (!startVal || !destVal) {
    alert("Please enter both a starting location and destination.");
    return;
  }

  const btnCalc = document.getElementById('btnCalculateRoute');
  const originalText = btnCalc.innerHTML;
  btnCalc.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Optimizing A* Route...</span>`;
  btnCalc.disabled = true;

  try {
    const payload = {
      start: AppState.startCoords ? AppState.startCoords : startVal,
      end: AppState.destCoords ? AppState.destCoords : destVal,
      start_name: startVal,
      end_name: destVal,
      priority: AppState.currentPriority,
      waypoints: AppState.waypoints.map(w => w.coords)
    };

    const response = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      alert(data.error || "Route optimization failed. Please check locations.");
      btnCalc.innerHTML = originalText;
      btnCalc.disabled = false;
      return;
    }

    // Store active route data in state
    AppState.activeRouteData = data;
    AppState.startCoords = data.start;
    AppState.destCoords = data.end;

    // Render Polylines on Leaflet Map
    renderRoutePolylines(data);

    // Update Summary Card
    updateRouteSummaryCard(data);

    // Update Turn-by-Turn list
    renderTurnByTurnSteps(data.steps);

    // Update Route Intelligence Analytics & Charts
    if (window.updateAnalyticsCharts) {
      window.updateAnalyticsCharts(data);
    }

    // Voice announcement
    const durMin = data.route_duration_min;
    const distKm = data.total_distance_km;
    speakVoice(`Route optimized with ${AppState.currentPriority} priority. Distance is ${distKm} kilometers, estimated time ${durMin} minutes.`);

    // If route avoided closures, alert user
    if (data.has_road_closures) {
      showRerouteBanner(`⚠️ Active Road Hazard Detected: Dynamic Detour Bypassed ${data.avoided_closures.length} closed sector(s).`);
    }

  } catch (err) {
    console.error("Routing error:", err);
    alert("Connection error to route optimization server.");
  } finally {
    btnCalc.innerHTML = originalText;
    btnCalc.disabled = false;
  }
}

// Bind Calculate button
document.getElementById('btnCalculateRoute').addEventListener('click', triggerRouteCalculation);

/**
 * Render Main Route & Alternative Polylines on Map
 */
function renderRoutePolylines(data) {
  // Clear previous polylines
  if (AppState.activePolyline) {
    AppState.map.removeLayer(AppState.activePolyline);
  }
  AppState.alternativePolylines.forEach(p => AppState.map.removeLayer(p));
  AppState.alternativePolylines = [];

  const mainPath = data.path;
  const primaryColor = PRIORITY_COLORS[data.priority] || '#2563EB';

  // Render Alternative routes faintly in background
  if (data.alternatives && data.alternatives.length > 1) {
    data.alternatives.slice(1).forEach((alt, idx) => {
      const altPolyline = L.polyline(alt.route, {
        color: '#94A3B8',
        weight: 5,
        opacity: 0.5,
        dashArray: '4, 8'
      }).addTo(AppState.map);
      
      altPolyline.bindTooltip(`${alt.name}: ${alt.duration_min} min (${alt.distance_km} km)`);
      AppState.alternativePolylines.push(altPolyline);
    });
  }

  // Render Primary Optimized Route with Vibrant Glow
  AppState.activePolyline = L.polyline(mainPath, {
    color: primaryColor,
    weight: 7,
    opacity: 0.95,
    lineJoin: 'round',
    lineCap: 'round'
  }).addTo(AppState.map);

  // Update Markers
  updateStartMarker(data.start[0], data.start[1]);
  updateDestMarker(data.end[0], data.end[1]);

  // Fit Map Bounds
  AppState.map.fitBounds(AppState.activePolyline.getBounds(), { padding: [50, 50] });
}

/**
 * Update Left Sidebar Route Summary Card
 */
function updateRouteSummaryCard(data) {
  const card = document.getElementById('routeSummaryCard');
  card.style.display = 'flex';

  document.getElementById('valEta').textContent = `${data.route_duration_min} min`;
  
  // Calculate arrival time
  const now = new Date();
  now.setMinutes(now.getMinutes() + Math.round(data.route_duration_min));
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById('valArrivalTime').textContent = `ETA: ${timeStr} • ${data.priority.toUpperCase()}`;

  document.getElementById('valDistance').textContent = `${data.total_distance_km} km`;
  
  const co2 = data.analytics?.co2_emissions_kg || (data.total_distance_km * 0.12).toFixed(2);
  document.getElementById('valCO2').textContent = `${co2} kg`;

  const safety = data.analytics?.safety_index || 92;
  document.getElementById('valSafety').textContent = `${safety}/100`;

  // Render Alternatives List
  const altContainer = document.getElementById('alternativesList');
  altContainer.innerHTML = '';

  if (data.alternatives && data.alternatives.length > 0) {
    data.alternatives.forEach((alt, idx) => {
      const isSelected = (idx === 0);
      const row = document.createElement('div');
      row.className = `alt-route-card ${isSelected ? 'selected' : ''}`;
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="width:10px; height:10px; border-radius:50%; background: ${isSelected ? (PRIORITY_COLORS[data.priority] || '#2563EB') : '#94A3B8'};"></span>
          <span>${alt.name}</span>
        </div>
        <span style="font-size:0.78rem; color:var(--text-muted); font-weight:700;">${alt.duration_min}m • ${alt.distance_km}km</span>
      `;
      altContainer.appendChild(row);
    });
  }
}

/**
 * Render Turn-by-Turn Steps
 */
function renderTurnByTurnSteps(steps) {
  const list = document.getElementById('turnByTurnList');
  const countBadge = document.getElementById('stepsCount');
  list.innerHTML = '';

  if (!steps || steps.length === 0) {
    countBadge.textContent = '0';
    list.innerHTML = '<div style="color:var(--text-muted); padding:6px;">Direct navigation path active.</div>';
    return;
  }

  countBadge.textContent = steps.length;

  steps.forEach((step, idx) => {
    const item = document.createElement('div');
    item.style.padding = '8px 0';
    item.style.borderBottom = '1px solid var(--border-light)';
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '10px';

    let icon = 'fa-arrow-up';
    if (step.modifier?.includes('right')) icon = 'fa-arrow-right';
    if (step.modifier?.includes('left')) icon = 'fa-arrow-left';
    if (step.type === 'arrive') icon = 'fa-flag-checkered';

    item.innerHTML = `
      <div style="width:24px; height:24px; border-radius:50%; background:#EEF2FF; color:var(--primary-blue); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:11px;">
        <i class="fa-solid ${icon}"></i>
      </div>
      <div style="flex:1;">
        <div style="font-weight:700; color:var(--text-main);">${step.instruction}</div>
        <div style="font-size:0.72rem; color:var(--text-muted);">${step.distance_m}m • ~${Math.round(step.duration_s)}s</div>
      </div>
    `;

    // Clicking step pans map to maneuver location
    item.addEventListener('click', () => {
      if (step.location && step.location[0]) {
        AppState.map.setView(step.location, 16);
      }
    });

    list.appendChild(item);
  });
}

// Toggle steps accordion
document.getElementById('toggleStepsHeader').addEventListener('click', () => {
  const list = document.getElementById('turnByTurnList');
  const chevron = document.getElementById('stepsChevron');
  const isHidden = list.style.display === 'none';
  list.style.display = isHidden ? 'block' : 'none';
  chevron.className = isHidden ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
});

/**
 * --------------------------------------------------
 * LIVE NAVIGATION DRIVER SIMULATION
 * --------------------------------------------------
 */
function startLiveSimulation() {
  if (!AppState.activeRouteData || !AppState.activeRouteData.path) {
    alert("Please calculate a route first.");
    return;
  }

  const path = AppState.activeRouteData.path;
  if (path.length < 2) return;

  // Toggle play/pause
  if (AppState.isSimulating) {
    pauseLiveSimulation();
    return;
  }

  AppState.isSimulating = true;
  document.getElementById('btnStartSim').innerHTML = `<i class="fa-solid fa-pause"></i> Pause Drive`;
  speakVoice("Starting trip navigation. Safe travels.");

  if (!AppState.vehicleMarker) {
    const carIcon = L.divIcon({
      className: 'vehicle-marker-icon',
      html: `<div class="vehicle-marker"><i class="fa-solid fa-location-arrow fa-rotate-by" style="--fa-rotate-angle: 45deg;"></i></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
    AppState.vehicleMarker = L.marker(path[0], { icon: carIcon }).addTo(AppState.map);
  }

  runSimulationLoop();
}

function pauseLiveSimulation() {
  AppState.isSimulating = false;
  if (AppState.simAnimationId) {
    clearTimeout(AppState.simAnimationId);
  }
  document.getElementById('btnStartSim').innerHTML = `<i class="fa-solid fa-play"></i> Resume Drive`;
}

function runSimulationLoop() {
  if (!AppState.isSimulating || !AppState.activeRouteData) return;

  const path = AppState.activeRouteData.path;
  if (AppState.simProgressIndex >= path.length) {
    AppState.isSimulating = false;
    AppState.simProgressIndex = 0;
    document.getElementById('btnStartSim').innerHTML = `<i class="fa-solid fa-rotate-left"></i> Replay Drive`;
    speakVoice("You have arrived at your destination.");
    return;
  }

  const currentPoint = path[AppState.simProgressIndex];
  AppState.vehicleMarker.setLatLng(currentPoint);

  // Auto-pan gently with car
  if (AppState.simProgressIndex % 5 === 0) {
    AppState.map.panTo(currentPoint, { animate: true, duration: 0.5 });
  }

  AppState.simProgressIndex += 1;

  // Speed interval: 150ms / multiplier
  const interval = Math.max(30, Math.round(180 / AppState.simSpeedMultiplier));
  AppState.simAnimationId = setTimeout(runSimulationLoop, interval);
}

document.getElementById('btnStartSim').addEventListener('click', startLiveSimulation);

/**
 * --------------------------------------------------
 * DYNAMIC REROUTING: SIMULATE ROADBLOCK AHEAD
 * --------------------------------------------------
 */
async function triggerObstacleDynamicReroute() {
  if (!AppState.activeRouteData || !AppState.activeRouteData.path) {
    alert("Please calculate a route first before simulating dynamic rerouting.");
    return;
  }

  const path = AppState.activeRouteData.path;
  // Pick a point ahead of current vehicle position
  const currIndex = Math.min(AppState.simProgressIndex, path.length - 2);
  const vehiclePos = path[currIndex];
  
  // Pick roadblock location 4-6 nodes ahead
  const blockIndex = Math.min(currIndex + 5, path.length - 1);
  const blockPoint = path[blockIndex];

  // Visual Roadblock Marker
  const blockIcon = L.divIcon({
    className: 'roadblock-marker',
    html: `<div style="background:#EF4444; width:34px; height:34px; border-radius:50%; border:3px solid #fff; display:flex; align-items:center; justify-content:center; color:#fff; font-size:16px; box-shadow:0 0 15px rgba(239,68,68,0.8); animation:pulse-emergency 1s infinite;"><i class="fa-solid fa-triangle-exclamation"></i></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
  const blockMarker = L.marker(blockPoint, { icon: blockIcon }).addTo(AppState.map);
  blockMarker.bindPopup("<b>⚠️ Road Block Encountered!</b><br>Major lane closure ahead. AI dynamic reroute recalculating...").openPopup();

  // Add closure circle
  const closureCircle = L.circle(blockPoint, {
    radius: 350,
    color: '#EF4444',
    fillColor: '#F87171',
    fillOpacity: 0.4
  }).addTo(AppState.map);

  // Alert Banner
  showRerouteBanner("🚨 Obstacle ahead! Calculating real-time dynamic bypass detour...");
  speakVoice("Traffic alert: Sudden road obstruction ahead. Recalculating dynamic detour.");

  try {
    const destCoords = AppState.destCoords;
    const res = await fetch('/api/reroute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_lat: vehiclePos[0],
        current_lon: vehiclePos[1],
        dest_lat: destCoords[0],
        dest_lon: destCoords[1],
        dest_name: AppState.destName,
        priority: AppState.currentPriority,
        incident_title: "Water Main Burst & Road Work"
      })
    });

    const rerouteData = await res.json();
    if (rerouteData.status === 'rerouted') {
      // Splice original path up to vehicle position + new bypass path
      const traversed = path.slice(0, currIndex);
      const updatedFullPath = traversed.concat(rerouteData.new_path);

      AppState.activeRouteData.path = updatedFullPath;
      AppState.activeRouteData.route_duration_min = rerouteData.remaining_duration_min;
      AppState.activeRouteData.total_distance_km = rerouteData.remaining_distance_km;

      // Re-draw polyline with glowing amber/cyan detour
      if (AppState.activePolyline) {
        AppState.map.removeLayer(AppState.activePolyline);
      }
      AppState.activePolyline = L.polyline(updatedFullPath, {
        color: '#06B6D4',
        weight: 7,
        opacity: 0.95
      }).addTo(AppState.map);

      // Update ETA
      document.getElementById('valEta').textContent = `${rerouteData.remaining_duration_min} min`;
      document.getElementById('valDistance').textContent = `${rerouteData.remaining_distance_km} km`;
      renderTurnByTurnSteps(rerouteData.steps);

      showRerouteBanner(`✅ Dynamic Detour Active: Avoided obstacle. ETA: ${rerouteData.remaining_duration_min} min remaining.`);
      speakVoice(`Dynamic detour locked. Recalculated remaining travel time: ${rerouteData.remaining_duration_min} minutes.`);
    }
  } catch (e) {
    console.error("Dynamic reroute failed:", e);
  }
}

document.getElementById('btnTriggerObstacle').addEventListener('click', triggerObstacleDynamicReroute);

/**
 * Reroute Banner Popup helper
 */
function showRerouteBanner(text) {
  const banner = document.getElementById('rerouteBanner');
  const bannerText = document.getElementById('rerouteBannerText');
  bannerText.textContent = text;
  banner.style.display = 'flex';

  setTimeout(() => {
    banner.style.display = 'none';
  }, 6500);
}

/**
 * Add Waypoint Helper
 */
function addWaypoint(coords, name) {
  const wpIndex = AppState.waypoints.length + 1;
  AppState.waypoints.push({ coords, name });

  const container = document.getElementById('waypointsContainer');
  const row = document.createElement('div');
  row.className = 'location-input-row';
  row.id = `wp-row-${wpIndex}`;
  row.innerHTML = `
    <span class="loc-dot waypoint" title="Waypoint ${wpIndex}"></span>
    <div class="location-input-wrapper">
      <input type="text" class="location-input" value="${name}" readonly>
      <button class="btn-input-icon btn-remove-wp" title="Remove Waypoint">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;

  row.querySelector('.btn-remove-wp').addEventListener('click', () => {
    row.remove();
    AppState.waypoints = AppState.waypoints.filter(w => w.name !== name);
    triggerRouteCalculation();
  });

  container.appendChild(row);
  triggerRouteCalculation();
}

document.getElementById('btnAddWaypoint').addEventListener('click', () => {
  speakVoice("Click on the map to place a waypoint stop.");
  AppState.isPickOnMapActive = true;
  document.getElementById('btnPickOnMap').classList.add('active');
});
