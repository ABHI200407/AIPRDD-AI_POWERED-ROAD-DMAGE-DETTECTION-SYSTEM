import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, LayersControl, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Navigation, RefreshCw, Route } from 'lucide-react'

function MapController({ coords }) {
  const map = useMap()
  useEffect(() => {
    if (coords && coords.length > 1) {
      map.fitBounds(coords, { padding: [50, 50], animate: true })
    }
  }, [coords, map])
  return null
}

export default function RepairRouteTab() {
  const [crewLat, setCrewLat] = useState(19.076)
  const [crewLon, setCrewLon] = useState(72.877)
  const [maxStops, setMaxStops] = useState(10)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const generateRoute = async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/api/v1/gov/repair-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crew_lat: crewLat, crew_lon: crewLon, max_stops: maxStops })
      })
      const data = await res.json()
      setResult(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const allPathCoords = result?.route?.flatMap(stop => stop.path_to.map(p => [p.lat, p.lng])) || []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, height: '600px' }}>
      {/* ... (controls unchanged) ... */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="glass-card">
          <h3 style={{ marginBottom: 16 }}>Smart Repair Route</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 16 }}>
            Calculates the optimal TSP order for a crew to visit all open tickets, following actual road geometry.
          </p>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Crew Start Latitude</label>
          <input type="number" value={crewLat} onChange={e => setCrewLat(parseFloat(e.target.value))}
            style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'white', marginBottom: 12 }} />
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Crew Start Longitude</label>
          <input type="number" value={crewLon} onChange={e => setCrewLon(parseFloat(e.target.value))}
            style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'white', marginBottom: 12 }} />
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Max Stops: {maxStops}</label>
          <input type="range" min={3} max={20} value={maxStops} onChange={e => setMaxStops(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--primary-accent)', marginBottom: 16 }} />
          <button onClick={generateRoute} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? <><RefreshCw size={14} className="spin" /> Optimising…</> : <><Route size={14} /> Generate Road Route</>}
          </button>
        </div>

        {result && (
          <div className="glass-card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div style={{ textAlign: 'center', padding: '10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{result.total_distance_km} km</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Distance</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{result.estimated_repair_hours}h</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Est. Duration</div>
              </div>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 180 }}>
              {result.route.map(stop => (
                <div key={stop.stop} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--glass-border)', fontSize: '0.82rem' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>{stop.stop}</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>Severity {stop.base_severity} — Score {stop.priority_score?.toFixed(0)}</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{stop.path_to.length} segments road-following</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <MapContainer center={[crewLat, crewLon]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <MapController coords={allPathCoords} />
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Dark Matter">
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="CartoDB" />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="OpenStreetMap">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" />
            </LayersControl.BaseLayer>
          </LayersControl>
          {result?.route?.map((stop, idx) => (
            <Polyline key={`seg-${idx}`} positions={stop.path_to.map(p => [p.lat, p.lng])} pathOptions={{ color: '#8b5cf6', weight: 4, opacity: 0.8 }} />
          ))}
          {result?.route?.map(stop => (
            <CircleMarker key={stop.stop} center={[stop.latitude, stop.longitude]}
              radius={10} pathOptions={{ color: '#8b5cf6', fillOpacity: 0.85 }}>
              <Popup>
                <strong style={{ color: 'black' }}>Stop #{stop.stop}</strong><br />
                Priority: {stop.priority_score?.toFixed(1)} | Severity: {stop.base_severity}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
