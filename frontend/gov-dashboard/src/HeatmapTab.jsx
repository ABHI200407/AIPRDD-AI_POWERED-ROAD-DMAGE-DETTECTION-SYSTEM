import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Marker, LayersControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import 'leaflet.heat'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { Layers, Map as MapIcon, ShieldAlert } from 'lucide-react'

const { BaseLayer, Overlay } = LayersControl

// Inner component to render the heatmap layer
function HeatLayer({ points }) {
  const map = useMap()
  const layerRef = useRef(null)

  useEffect(() => {
    if (!points || points.length === 0) return
    
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
    }

    const heatData = points.map(p => [p.lat, p.lon, p.intensity || 0.5])
    layerRef.current = L.heatLayer(heatData, {
      radius: 40,
      blur: 30,
      maxZoom: 15,
      gradient: { 0.4: '#10b981', 0.6: '#f59e0b', 0.8: '#ef4444', 1.0: '#b91c1c' }
    }).addTo(map)

    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current)
    }
  }, [points, map])
  return null
}

export default function HeatmapTab() {
  const [heatData, setHeatData] = useState([])
  const [namedRoads, setNamedRoads] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('HEATMAP') // HEATMAP | CLUSTERS

  useEffect(() => {
    fetch('http://localhost:8000/api/v1/routing/road-health/all')
      .then(r => r.json())
      .then(d => {
        setHeatData(d.heatmap_points || [])
        setNamedRoads(d.named_roads || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const starColor = (score) => score >= 4 ? '#10b981' : score >= 3 ? '#f59e0b' : '#ef4444'

  const customIcon = (intensity) => {
    const color = intensity > 0.7 ? '#ef4444' : intensity > 0.4 ? '#f59e0b' : '#10b981'
    return L.divIcon({
      html: `<div style="background: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
      className: 'dot-icon',
      iconSize: [12, 12]
    })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 24, height: '700px' }}>
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden', position: 'relative', border: '1px solid var(--glass-border)' }}>
        
        {/* Toggle Controls */}
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 1000, display: 'flex', gap: 8 }}>
          <button onClick={() => setViewMode('HEATMAP')} 
            style={{ padding: '8px 16px', borderRadius: 'var(--radius-pill)', border: 'none', background: viewMode === 'HEATMAP' ? 'var(--primary)' : 'rgba(0,0,0,0.7)', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(10px)' }}>
            <Layers size={14} /> Heatmap
          </button>
          <button onClick={() => setViewMode('CLUSTERS')} 
            style={{ padding: '8px 16px', borderRadius: 'var(--radius-pill)', border: 'none', background: viewMode === 'CLUSTERS' ? 'var(--primary)' : 'rgba(0,0,0,0.7)', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(10px)' }}>
            <ShieldAlert size={14} /> Report Clusters
          </button>
        </div>

        <MapContainer center={[19.076, 72.877]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <LayersControl position="topright">
            <BaseLayer checked name="Dark Mode">
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="CartoDB" />
            </BaseLayer>
            <BaseLayer name="Satellite">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Esri" />
            </BaseLayer>
            <BaseLayer name="Street">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="OSM" />
            </BaseLayer>
          </LayersControl>
          
          {viewMode === 'HEATMAP' && <HeatLayer points={heatData} />}
          
          {viewMode === 'CLUSTERS' && (
            <MarkerClusterGroup chunkedLoading>
              {heatData.map((p, i) => (
                <Marker key={i} position={[p.lat, p.lon]} icon={customIcon(p.intensity)}>
                  <Popup>
                    <div style={{ color: 'black' }}>
                      <strong>Road Damage Report</strong><br />
                      Intensity: {(p.intensity * 10).toFixed(1)} / 10<br />
                      <button style={{ marginTop: 8, padding: '4px 8px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>View Details</button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          )}
        </MapContainer>
      </div>

      <div className="glass-card" style={{ overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
           <MapIcon size={24} color="var(--primary)" />
           <h3 style={{ margin: 0 }}>Network Analytics</h3>
        </div>

        {loading && <p style={{ color: 'var(--text-muted)' }}>Analyzing road network…</p>}
        
        {!loading && (
          <>
            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
               <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>TOTAL REPORTS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{heatData.length}</div>
               </div>
               <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>AVG HEALTH</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>3.2★</div>
               </div>
            </div>

            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority Road Segments</h4>
            
            {namedRoads.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No segment data available.</p>
            ) : (
              namedRoads.map(road => (
                <div key={road.road_name} style={{ padding: '16px 0', borderBottom: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{road.road_name}</span>
                    <span style={{ color: starColor(road.health_score), fontWeight: 800 }}>{road.health_score}★</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                       <div style={{ width: `${(road.health_score / 5) * 100}%`, height: '100%', background: starColor(road.health_score) }}></div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: 60, textAlign: 'right' }}>
                      {road.report_count} reports
                    </span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                     <span className={`badge ${road.stars <= 2 ? 'badge-critical' : road.stars === 3 ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                        {road.stars <= 2 ? 'URGENT REPAIR' : road.stars === 3 ? 'MAINTENANCE DUE' : 'OPTIMAL'}
                     </span>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}
