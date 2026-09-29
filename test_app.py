from app import app
import json

client = app.test_client()

print("1. Testing / (Home Page)...")
res = client.get('/')
assert res.status_code == 200, f"Status {res.status_code}"
print("   -> Home page OK!")

print("2. Testing /api/closures...")
res = client.get('/api/closures')
data = json.loads(res.data)
assert len(data) > 0, "No closures loaded"
print(f"   -> Loaded {len(data)} closures OK!")

print("3. Testing /api/nearby (hospitals)...")
res = client.get('/api/nearby?lat=40.7128&lon=-74.0060&category=hospital')
data = json.loads(res.data)
assert data['count'] > 0, "No hospitals returned"
print(f"   -> Loaded {data['count']} nearby hospitals OK!")

print("4. Testing /api/route (Times Square to Brooklyn Bridge, priority=fastest)...")
res = client.post('/api/route', json={
    'start': [40.7580, -73.9855],
    'end': [40.7061, -73.9969],
    'start_name': 'Times Square',
    'end_name': 'Brooklyn Bridge',
    'priority': 'fastest'
})
data = json.loads(res.data)
assert 'path' in data, f"Error: {data}"
print(f"   -> Route computed successfully: {data['total_distance_km']} km, {data['route_duration_min']} min, A* time: {data['algorithm_benchmark']['a_star_time_ms']} ms")

print("5. Testing /api/reroute...")
res = client.post('/api/reroute', json={
    'current_lat': 40.7300,
    'current_lon': -73.9900,
    'dest_lat': 40.7061,
    'dest_lon': -73.9969,
    'dest_name': 'Brooklyn Bridge',
    'priority': 'fastest'
})
data = json.loads(res.data)
assert data['status'] == 'rerouted', f"Error: {data}"
print(f"   -> Dynamic reroute OK: {data['remaining_distance_km']} km, {data['remaining_duration_min']} min")

print("6. Testing /api/saved-routes (save & retrieve)...")
res = client.post('/api/saved-routes', json={
    'name': 'Test Commute',
    'start_name': 'Times Square',
    'end_name': 'Brooklyn Bridge',
    'start_coords': [40.7580, -73.9855],
    'end_coords': [40.7061, -73.9969],
    'priority': 'fastest',
    'distance_km': 6.5,
    'duration_min': 18.2,
    'co2_kg': 0.82
})
data = json.loads(res.data)
assert data['status'] == 'saved', f"Error: {data}"
route_id = data['id']

res = client.get('/api/saved-routes')
saved = json.loads(res.data)
assert any(r['id'] == route_id for r in saved)
print(f"   -> Saved route ID {route_id} persisted in SQLite!")

print("7. Testing /api/analytics/summary...")
res = client.get('/api/analytics/summary')
summary = json.loads(res.data)
print(f"   -> Analytics summary OK! Total routes logged: {summary['total_routes_planned']}")

print("\n*** ALL 7 INTEGRATION TESTS PASSED PERFECTLY! ***")
