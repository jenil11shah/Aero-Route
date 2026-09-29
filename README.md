# 🚀 AeroRoute AI — Advanced Route Optimization & Emergency Navigation Suite

AeroRoute AI is a next-generation AI-powered web mapping and navigation platform inspired by Google Maps, built with advanced multi-objective graph optimization, real-time dynamic rerouting, interactive hazard and road closure management, tactical emergency dispatch mode, and a comprehensive route intelligence dashboard.

---

## 🌟 Key Features

### 1. ⚡ Intelligent Route Priority Optimization
Choose between 8 distinct route optimization priority profiles:
- **⚡ Fastest**: Minimizes travel time using highway corridors.
- **🛡️ Safest**: Prefers well-lit multi-lane avenues, avoids accident-prone intersections, and maximizes the road safety index.
- **🚨 Emergency Mode**: Tactical siren corridor clearance, green-wave signal preemption simulation, 35% time reduction, and flashing command HUD.
- **⚖️ Balanced**: Optimal equilibrium between distance, travel duration, and fuel consumption.
- **♿ Accessible**: Minimal gradient variations and smooth road surfaces for wheelchair or low-clearance transit.
- **👥 Avoid Traffic / Congestion**: Real-time traffic avoidance algorithms that bypass bottlenecks through secondary clear arterials.
- **🌲 Scenic Byway**: Maximizes greenery, parks, waterfronts, and pleasant road curvature.
- **🍃 Budget / Eco Fuel**: Minimizes fuel burn and carbon footprint (ideal for hybrid and EV efficiency).

### 2. 🚧 Road Closure Detection & Interactive Hazard Mapping
- Active display of road hazards, waterlogging/floods, construction zones, and blockades.
- **Click-to-Block Map Tool**: Drop custom closures anywhere on the map with configurable danger radius (e.g. 350m–600m).
- **Automated Detour Engine**: The A* graph search applies a 50,000x penalty to edges traversing closed sectors, automatically discovering lateral detour corridors.

### 3. 🔄 Dynamic Real-Time Rerouting
- **Live Navigation Driver Mode**: Interactive simulated driving with real-time animated vehicle marker.
- **Simulate Obstacle Ahead**: With one click, simulate encountering an unexpected accident or flood ahead.
- The system instantly calls `/api/reroute`, computes a dynamic detour, updates the polyline in real-time, displays an alert banner, and announces the detour via speech synthesis (TTS).

### 4. 🏥 Dedicated Nearby Services Hub
Dedicated quick-action buttons for essential services:
- 🏥 **Hospitals & Clinics** (24/7 Trauma centers, cardiology wings, urgent clinics)
- ⛽ **Petrol & EV Stations** (150kW fast chargers, conventional fuel, convenience marts)
- 🚒 **Fire & HazMat Rescue Hubs**
- 🅿️ **Monitored Parking Garages & Multilevel Lots**
- 🍽️ **Top-Rated Restaurants & Cafes**
- Each service card features exact distance, ratings (★ 4.2–4.9), open hours, and 1-click **"Route Here"** or **"Add Stop"** actions.

### 5. 📊 Route Intelligence & Analytics Dashboard
Built with **Chart.js**:
- **Terrain Elevation Profile**: Elevation gradient (meters above sea level) plotted across the entire route distance.
- **Traffic Congestion Distribution**: Flow analysis (% Clear, % Moderate, % Heavy).
- **Carbon Footprint & Eco Economy**: CO₂ emissions in kilograms, estimated fuel liters, fuel cost ($), and equivalent tree offset numbers.
- **AI Algorithmic Benchmark**: Side-by-side comparison of **A* Search (Heuristic)** vs. **Dijkstra**, comparing execution time in milliseconds and nodes evaluated.

### 6. 💾 Persistent SQLite Database Integration
- **`routes` Table**: Persists saved trips, start/end locations, waypoints, distance, duration, CO₂ footprint, and favorite stars.
- **`road_closures` Table**: Stores active closures, severity, lat/lon coordinates, and danger radius.
- **`route_telemetry` Table**: Logs algorithm calculation time (ms), nodes visited, and optimization history.
- **GeoJSON Export**: Download any planned route directly as a standard `.geojson` file for GIS analysis.

---

## 🛠️ Tech Stack & Architecture

- **Backend**: Python 3.13, Flask 3.1, SQLite3
- **Routing Engine**: Project OSRM (Open Source Routing Machine) + A* Graph Optimization Algorithm
- **Geocoding**: OpenStreetMap Nominatim with memory caching + Overpass API
- **Frontend**: Leaflet.js (CartoDB Voyager & Dark Matter tiles), Chart.js 4.4, HTML5 Web Speech API & Web Audio API
- **Design System**: Glassmorphism, modern vibrant color palette, responsive drawer layout

---

## 🚀 Quickstart Guide

### 1. Installation
Clone or navigate to the project directory:
```bash
cd ai-route-planner
pip install -r requirements.txt
```

### 2. Run Locally
```bash
python app.py
```
Open your browser at:
```
http://localhost:5000
```

### 3. Run Automated Tests
```bash
python test_app.py
```

---

## 🌐 Production Deployment

### Option A: Render / Railway / Heroku
1. Push this repository to GitHub.
2. Create a Web Service pointing to `gunicorn app:app` or `python app.py`.
3. Set Environment Variable `PORT=5000`.

### Option B: Docker
```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["python", "app.py"]
```
Build and run:
```bash
docker build -t aeroroute-ai .
docker run -p 5000:5000 aeroroute-ai
```

---

## 📡 REST API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `GET /` | `GET` | Main Web Interface |
| `POST /api/route` | `POST` | Calculate route with Priority, Closures, A* and Analytics |
| `POST /api/reroute` | `POST` | Dynamic detour recalculation from driver position |
| `GET /api/nearby` | `GET` | Fetch nearby POIs (hospital, fuel, fire, parking, restaurant) |
| `GET /api/closures` | `GET` | List active road closures and hazards |
| `POST /api/closures` | `POST` | Report a new road closure on map |
| `DELETE /api/closures/<id>`| `DELETE` | Remove a road closure |
| `GET /api/saved-routes` | `GET` | Retrieve saved routes from SQLite DB |
| `POST /api/saved-routes` | `POST` | Save current route to database |
| `GET /api/analytics/summary`| `GET` | System-wide fleet telemetry statistics |
