import sqlite3
import json
import os
from datetime import datetime

DB_FILE = "/tmp/route_planner.db" if os.environ.get("VERCEL") else os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "route_planner.db")


def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Table 1: Routes
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            start_name TEXT NOT NULL,
            end_name TEXT NOT NULL,
            start_lat REAL NOT NULL,
            start_lon REAL NOT NULL,
            end_lat REAL NOT NULL,
            end_lon REAL NOT NULL,
            priority TEXT DEFAULT 'balanced',
            distance_km REAL,
            duration_min REAL,
            co2_kg REAL DEFAULT 0.0,
            waypoints_json TEXT DEFAULT '[]',
            path_coords_json TEXT DEFAULT '[]',
            is_favorite INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Table 2: Road Closures & Hazards
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS road_closures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            reason TEXT NOT NULL,
            severity TEXT DEFAULT 'critical',
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            radius_meters REAL DEFAULT 350.0,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Table 3: Saved Places
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS saved_places (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Table 4: Route Telemetry & Intelligence logs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS route_telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            start_name TEXT,
            end_name TEXT,
            priority TEXT,
            algorithm TEXT DEFAULT 'A*',
            execution_time_ms REAL,
            nodes_evaluated INTEGER,
            total_distance_km REAL,
            duration_min REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()

    # Seed default sample road closures if table is empty
    cursor.execute("SELECT COUNT(*) FROM road_closures")
    if cursor.fetchone()[0] == 0:
        sample_closures = [
            ("Central Ave Water Main Burst", "Flooding & Road Work", "critical", 40.730610, -73.935242, 400.0, 1),
            ("Bridge Maintenance & Lane Closure", "Structural Repair", "moderate", 40.758896, -73.985130, 300.0, 1),
            ("Downtown Highway Slip Road Closed", "Emergency Paving", "critical", 51.5074, -0.1278, 450.0, 1),
            ("Broadway Utility Pipeline Overhaul", "Heavy Construction", "critical", 37.7749, -122.4194, 350.0, 1),
            ("Outer Ring Road Flyover Expansion", "Crane Installation", "moderate", 12.9716, 77.5946, 500.0, 1),
            ("Main Gateway Parade Restriction", "Public Event / VIP Movement", "critical", 28.6139, 77.2090, 600.0, 1)
        ]
        cursor.executemany("""
            INSERT INTO road_closures (title, reason, severity, lat, lon, radius_meters, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, sample_closures)

    # Seed sample saved places if empty
    cursor.execute("SELECT COUNT(*) FROM saved_places")
    if cursor.fetchone()[0] == 0:
        sample_places = [
            ("Metropolitan General Hospital", "hospital", 40.7484, -73.9857, "350 5th Ave, Emergency Ward"),
            ("Express Petro Station & EV Supercharger", "fuel", 40.7580, -73.9855, "42nd St & 8th Ave"),
            ("Downtown Central Fire Station 9", "fire", 40.7128, -74.0060, "City Hall Emergency Dispatch"),
            ("Riverside Safe Parking Garage", "parking", 40.7300, -74.0000, "24/7 Monitored Multilevel Parking")
        ]
        cursor.executemany("""
            INSERT INTO saved_places (name, category, lat, lon, address)
            VALUES (?, ?, ?, ?, ?)
        """, sample_places)

    conn.commit()
    conn.close()


# --------------------------------------------------
# CRUD Operations
# --------------------------------------------------

def save_route(name, start_name, end_name, start_lat, start_lon, end_lat, end_lon,
               priority, distance_km, duration_min, co2_kg=0.0,
               waypoints=None, path_coords=None, is_favorite=0):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO routes (
            name, start_name, end_name, start_lat, start_lon, end_lat, end_lon,
            priority, distance_km, duration_min, co2_kg, waypoints_json, path_coords_json, is_favorite
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        name or f"{start_name} -> {end_name}",
        start_name,
        end_name,
        start_lat,
        start_lon,
        end_lat,
        end_lon,
        priority,
        distance_km,
        duration_min,
        co2_kg,
        json.dumps(waypoints or []),
        json.dumps(path_coords or []),
        1 if is_favorite else 0
    ))
    route_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return route_id


def get_all_routes(limit=50):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM routes ORDER BY is_favorite DESC, created_at DESC LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    routes = []
    for r in rows:
        routes.append({
            "id": r["id"],
            "name": r["name"],
            "start_name": r["start_name"],
            "end_name": r["end_name"],
            "start_coords": [r["start_lat"], r["start_lon"]],
            "end_coords": [r["end_lat"], r["end_lon"]],
            "priority": r["priority"],
            "distance_km": r["distance_km"],
            "duration_min": r["duration_min"],
            "co2_kg": r["co2_kg"],
            "waypoints": json.loads(r["waypoints_json"] or "[]"),
            "is_favorite": bool(r["is_favorite"]),
            "created_at": r["created_at"]
        })
    conn.close()
    return routes


def get_route_by_id(route_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM routes WHERE id = ?", (route_id,))
    r = cursor.fetchone()
    conn.close()
    if not r:
        return None
    return {
        "id": r["id"],
        "name": r["name"],
        "start_name": r["start_name"],
        "end_name": r["end_name"],
        "start_coords": [r["start_lat"], r["start_lon"]],
        "end_coords": [r["end_lat"], r["end_lon"]],
        "priority": r["priority"],
        "distance_km": r["distance_km"],
        "duration_min": r["duration_min"],
        "co2_kg": r["co2_kg"],
        "waypoints": json.loads(r["waypoints_json"] or "[]"),
        "path_coords": json.loads(r["path_coords_json"] or "[]"),
        "is_favorite": bool(r["is_favorite"]),
        "created_at": r["created_at"]
    }


def toggle_favorite_route(route_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE routes SET is_favorite = ((is_favorite + 1) % 2) WHERE id = ?", (route_id,))
    conn.commit()
    conn.close()
    return True


def delete_route(route_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM routes WHERE id = ?", (route_id,))
    conn.commit()
    conn.close()
    return True


# --------------------------------------------------
# Road Closures Operations
# --------------------------------------------------

def get_active_closures():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM road_closures WHERE is_active = 1 ORDER BY created_at DESC")
    rows = cursor.fetchall()
    closures = []
    for r in rows:
        closures.append({
            "id": r["id"],
            "title": r["title"],
            "reason": r["reason"],
            "severity": r["severity"],
            "lat": r["lat"],
            "lon": r["lon"],
            "radius_meters": r["radius_meters"],
            "is_active": bool(r["is_active"]),
            "created_at": r["created_at"]
        })
    conn.close()
    return closures


def add_road_closure(title, reason, severity, lat, lon, radius_meters=350.0):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO road_closures (title, reason, severity, lat, lon, radius_meters, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
    """, (title, reason, severity, lat, lon, radius_meters))
    closure_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return closure_id


def delete_road_closure(closure_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM road_closures WHERE id = ?", (closure_id,))
    conn.commit()
    conn.close()
    return True


def toggle_closure_status(closure_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE road_closures SET is_active = ((is_active + 1) % 2) WHERE id = ?", (closure_id,))
    conn.commit()
    conn.close()
    return True


# --------------------------------------------------
# Telemetry Operations
# --------------------------------------------------

def log_telemetry(start_name, end_name, priority, algorithm, execution_time_ms, nodes_evaluated, distance_km, duration_min):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO route_telemetry (
            start_name, end_name, priority, algorithm, execution_time_ms,
            nodes_evaluated, total_distance_km, duration_min
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (start_name, end_name, priority, algorithm, execution_time_ms, nodes_evaluated, distance_km, duration_min))
    conn.commit()
    conn.close()


def get_analytics_summary():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM route_telemetry")
    total_trips = cursor.fetchone()[0]

    cursor.execute("SELECT AVG(execution_time_ms), AVG(nodes_evaluated), SUM(total_distance_km) FROM route_telemetry")
    avg_perf = cursor.fetchone()
    avg_calc_time = round(avg_perf[0] or 0.0, 2)
    avg_nodes = int(avg_perf[1] or 0)
    total_km = round(avg_perf[2] or 0.0, 2)

    cursor.execute("SELECT COUNT(*) FROM road_closures WHERE is_active = 1")
    active_closures_count = cursor.fetchone()[0]

    cursor.execute("""
        SELECT priority, COUNT(*) as cnt FROM route_telemetry
        GROUP BY priority ORDER BY cnt DESC LIMIT 5
    """)
    priority_dist = [{"priority": r["priority"], "count": r["cnt"]} for r in cursor.fetchall()]

    conn.close()
    return {
        "total_routes_planned": total_trips,
        "avg_algorithm_time_ms": avg_calc_time,
        "avg_nodes_explored": avg_nodes,
        "total_distance_optimized_km": total_km,
        "active_road_closures": active_closures_count,
        "priority_distribution": priority_dist
    }


# Initialize DB immediately upon import
init_db()
