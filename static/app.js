const $=id=>document.getElementById(id);
const map=L.map('map').setView([40.7580,-73.9855],12);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{attribution:'© OpenStreetMap © CARTO'}).addTo(map);
let routeLayer=L.layerGroup().addTo(map),poiLayer=L.layerGroup().addTo(map),closureLayer=L.layerGroup().addTo(map);
let current=null,blocking=false;
const api=async(url,opt)=>{const r=await fetch(url,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||r.statusText);return d};
const post=(url,body)=>api(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const msg=t=>$('msg').textContent=t||'';

async function plan(){
  msg();$('go').textContent='Planning...';
  try{
    const d=await post('/api/route',{start:$('start').value,end:$('end').value,priority:$('priority').value});
    current=d;routeLayer.clearLayers();
    d.alternatives.forEach(a=>L.polyline(a.route,{color:'#94a3b8',weight:4,opacity:.6}).addTo(routeLayer));
    const line=L.polyline(d.route,{color:'#2563eb',weight:6}).addTo(routeLayer);
    L.marker(d.start).bindPopup(d.start_name).addTo(routeLayer);
    L.marker(d.end).bindPopup(d.end_name).addTo(routeLayer);
    map.fitBounds(line.getBounds(),{padding:[40,40]});
    const a=d.analytics||{},b=d.algorithm_benchmark||{};
    $('result').innerHTML=`<div class="stats">
      <div class="card"><b>${d.total_distance_km} km</b>Distance</div>
      <div class="card"><b>${d.route_duration_min} min</b>Duration</div>
      <div class="card"><b>${a.co2_emissions_kg??'-'} kg</b>CO₂</div>
      <div class="card"><b>${a.estimated_fuel_liters??'-'} L</b>Fuel</div></div>
      <div class="card">A*: ${b.a_star_time_ms} ms (${b.a_star_nodes_visited} nodes) vs Dijkstra: ${b.dijkstra_time_ms} ms</div>
      ${d.has_road_closures?'<div class="card">🚧 Route avoids active closures</div>':''}
      <h3>Directions</h3>`+(d.steps||[]).map(s=>`<div class="card">${s.instruction} <small>(${s.type} ${s.modifier}, ${s.distance_m} m)</small></div>`).join('');
  }catch(e){msg(e.message)}
  $('go').textContent='Plan Route';
}

async function nearby(cat){
  const c=map.getCenter();poiLayer.clearLayers();$('nearby').innerHTML='Loading...';
  try{
    const d=await api(`/api/nearby?lat=${c.lat}&lon=${c.lng}&category=${cat}`);
    $('nearby').innerHTML=d.results.length?'':'No results found.';
    d.results.forEach(p=>{
      L.marker([p.lat,p.lon]).bindPopup(`<b>${p.name}</b><br>${p.distance_km} km`).addTo(poiLayer);
      const el=document.createElement('div');el.className='card';
      el.innerHTML=`<b>${p.name}</b><br>${p.distance_km} km · ★${p.rating} · ${p.open_status}<br><a href="#">Route here</a>`;
      el.querySelector('a').onclick=e=>{e.preventDefault();$('start').value=`${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;$('end').value=p.name;
        current=null;post('/api/route',{start:[c.lat,c.lng],end:[p.lat,p.lon],end_name:p.name,priority:$('priority').value}).then(()=>{$('start').value='';$('end').value=p.name;$('go').click()}).catch(x=>msg(x.message))};
      $('nearby').appendChild(el);
    });
  }catch(e){$('nearby').innerHTML='';msg(e.message)}
}

async function loadClosures(){
  closureLayer.clearLayers();
  try{(await api('/api/closures')).forEach(c=>{
    L.circle([c.lat,c.lon],{radius:c.radius_meters||350,color:'#dc2626',fillOpacity:.25})
     .bindPopup(`<b>${c.title}</b><br>${c.reason}<br><a href="#" onclick="delClosure(${c.id});return false">Remove</a>`).addTo(closureLayer)})}catch(e){}
}
window.delClosure=async id=>{await api('/api/closures/'+id,{method:'DELETE'});loadClosures()};

async function loadSaved(){
  try{const r=await api('/api/saved-routes');
    $('saved').innerHTML=r.length?'':'<div class="card">Nothing saved yet.</div>';
    r.forEach(x=>{const el=document.createElement('div');el.className='card';
      el.innerHTML=`<b>${x.name}</b><br>${x.start_name} → ${x.end_name}<br>${x.distance_km} km · ${x.duration_min} min <a href="#">Delete</a>`;
      el.querySelector('a').onclick=async e=>{e.preventDefault();await api('/api/saved-routes/'+x.id,{method:'DELETE'});loadSaved()};
      $('saved').appendChild(el)})}catch(e){}
}

$('go').onclick=plan;
$('save').onclick=async()=>{
  if(!current)return msg('Plan a route first.');
  try{await post('/api/saved-routes',{name:`${current.start_name} → ${current.end_name}`,start_name:current.start_name,end_name:current.end_name,
    start_coords:current.start,end_coords:current.end,priority:current.priority,distance_km:current.total_distance_km,
    duration_min:current.route_duration_min,co2_kg:(current.analytics||{}).co2_emissions_kg||0,path_coords:current.route});
    msg();loadSaved()}catch(e){msg(e.message)}
};
$('block').onclick=()=>{blocking=!blocking;$('block').classList.toggle('on',blocking);$('block').textContent=blocking?'Click map to place closure':'🚧 Add closure'};
map.on('click',async e=>{
  if(!blocking)return;
  try{await post('/api/closures',{title:'Reported closure',reason:'Road blocked',severity:'critical',lat:e.latlng.lat,lon:e.latlng.lng,radius_meters:400});loadClosures()}catch(x){msg(x.message)}
  blocking=false;$('block').classList.remove('on');$('block').textContent='🚧 Add closure';
});
document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>nearby(b.dataset.cat));
loadClosures();loadSaved();
