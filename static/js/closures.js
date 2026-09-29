/**
 * ==========================================================================
 * AERO-ROUTE AI - ROAD CLOSURES & HAZARD CONTROLLER (closures.js)
 * Active blockades, Construction zones, Map click-to-block, & Detour triggers
 * ==========================================================================
 */

let activeClosuresList = [];

/**
 * Load & Display Active Road Closures from Database
 */
async function loadRoadClosures() {
  try {
    const res = await fetch('/api/closures');
    const closures = await res.json();
    activeClosuresList = closures;
    renderClosuresOnMap(closures);
  } catch (err) {
    console.error("Failed to load closures:", err);
  }
}

/**
 * Render Closures on Leaflet Map
 */
function renderClosuresOnMap(closures) {
  AppState.closuresLayerGroup.clearLayers();

  if (!AppState.showClosures) return;

  closures.forEach(c => {
    if (!c.is_active) return;

    // 1. Danger Radius Circle
    const circle = L.circle([c.lat, c.lon], {
      radius: c.radius_meters || 350,
      color: '#EF4444',
      weight: 2,
      fillColor: '#F87171',
      fillOpacity: 0.28,
      dashArray: '6, 6'
    }).addTo(AppState.closuresLayerGroup);

    // 2. Custom Warning Marker
    const icon = L.divIcon({
      className: 'closure-hazard-pin',
      html: `
        <div style="background:#DC2626; width:30px; height:30px; border-radius:50%; border:2px solid #fff; box-shadow:0 3px 10px rgba(220,38,38,0.5); display:flex; align-items:center; justify-content:center; color:#fff; font-size:13px;">
          <i class="fa-solid fa-road-barrier"></i>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const marker = L.marker([c.lat, c.lon], { icon: icon }).addTo(AppState.closuresLayerGroup);

    const popupHtml = `
      <div style="font-family: var(--font-family); min-width: 180px;">
        <div style="display:flex; align-items:center; gap:6px; color:#DC2626; font-weight:800; font-size:0.92rem;">
          <i class="fa-solid fa-triangle-exclamation"></i> ROAD CLOSED
        </div>
        <b style="display:block; margin:4px 0; color:#0F172A; font-size:0.86rem;">${c.title}</b>
        <div style="font-size:0.75rem; color:#64748B;">Reason: ${c.reason}</div>
        <div style="font-size:0.72rem; color:#DC2626; font-weight:700; margin:3px 0;">Severity: ${c.severity.toUpperCase()} (${c.radius_meters}m zone)</div>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button onclick="deleteRoadClosure(${c.id})" style="flex:1; background:#FEE2E2; color:#DC2626; border:1px solid #FECACA; padding:4px 6px; border-radius:4px; font-size:0.72rem; font-weight:700; cursor:pointer;">
            <i class="fa-solid fa-trash"></i> Remove
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);
  });
}

/**
 * Toggle Road Closures Display on Map
 */
document.getElementById('btnToggleClosures').addEventListener('click', () => {
  AppState.showClosures = !AppState.showClosures;
  const btn = document.getElementById('btnToggleClosures');
  btn.classList.toggle('active', AppState.showClosures);
  
  if (AppState.showClosures) {
    renderClosuresOnMap(activeClosuresList);
    speakVoice("Road closures visible on map.");
  } else {
    AppState.closuresLayerGroup.clearLayers();
    speakVoice("Road closures hidden.");
  }
});

/**
 * Activate "Report / Place Road Closure" Mode
 */
const btnAddClosure = document.getElementById('btnAddClosureTool');
btnAddClosure.addEventListener('click', () => {
  AppState.isAddClosureActive = !AppState.isAddClosureActive;
  btnAddClosure.classList.toggle('active', AppState.isAddClosureActive);

  if (AppState.isAddClosureActive) {
    speakVoice("Click anywhere on the map to place a road closure or barrier.");
  }
});

/**
 * Prompt User & Add Road Closure
 */
async function promptAddRoadClosure(lat, lon) {
  AppState.isAddClosureActive = false;
  btnAddClosure.classList.remove('active');

  const title = prompt("Enter Road Closure Title / Street Name:", "Main Street Construction Zone");
  if (!title) return;

  const reason = prompt("Enter Reason for Closure (e.g. Flood, Pipe Burst, Accident):", "Emergency Road Work");
  const radius = parseFloat(prompt("Enter Closure Radius in meters (e.g. 300, 500):", "400")) || 350.0;

  try {
    const res = await fetch('/api/closures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        reason: reason || "Road Work",
        severity: "critical",
        lat,
        lon,
        radius_meters: radius
      })
    });

    const data = await res.json();
    if (data.status === 'added') {
      speakVoice(`Road closure reported on map. Recalculating routes to ensure dynamic detour.`);
      await loadRoadClosures();
      // Re-trigger routing if an active route exists so it avoids this closure!
      if (AppState.activeRouteData) {
        triggerRouteCalculation();
      }
    }
  } catch (err) {
    console.error("Failed to add closure:", err);
  }
}

/**
 * Delete a Road Closure
 */
window.deleteRoadClosure = async function(closureId) {
  try {
    const res = await fetch(`/api/closures/${closureId}`, { method: 'DELETE' });
    if (res.ok) {
      speakVoice("Road closure removed.");
      await loadRoadClosures();
      if (AppState.activeRouteData) {
        triggerRouteCalculation();
      }
    }
  } catch (e) {
    console.error("Delete closure failed:", e);
  }
};

// Initial load on page ready
document.addEventListener('DOMContentLoaded', () => {
  loadRoadClosures();
});
