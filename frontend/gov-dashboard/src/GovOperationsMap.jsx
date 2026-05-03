import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  ZoomControl
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AlertTriangle, Layers, LocateFixed, RefreshCw, Satellite, ShieldCheck, Truck } from 'lucide-react'

const BASE_LAYERS = {
  streets: {
    label: 'Street',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO &copy; OpenStreetMap',
    maxZoom: 20
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19
  }
}

function MapFit({ tickets }) {
  const map = useMap()

  useEffect(() => {
    const points = tickets.filter((ticket) => ticket.latitude && ticket.longitude).map((ticket) => [ticket.latitude, ticket.longitude])
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 14 })
  }, [map, tickets])

  return null
}

function createCrewIcon() {
  return L.divIcon({
    html: '<div class="gov-crew-marker"><span></span></div>',
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  })
}

function getPriorityTone(score = 0) {
  if (score >= 80) return { color: '#f43f5e', label: 'Critical' }
  if (score >= 55) return { color: '#fbbf24', label: 'High' }
  return { color: '#10b981', label: 'Normal' }
}

export default function GovOperationsMap({ tickets = [], crews = [], onRunDbscan, onAutoDispatch, loading = {} }) {
  const [baseLayer, setBaseLayer] = useState('streets')
  const [showCrews, setShowCrews] = useState(true)
  const mapRef = useRef(null)
  const activeLayer = BASE_LAYERS[baseLayer]
  const crewIcon = useMemo(() => createCrewIcon(), [])
  const visibleTickets = tickets.filter((ticket) => ticket.latitude && ticket.longitude)
  const criticalCount = visibleTickets.filter((ticket) => (ticket.priority_score || 0) >= 80).length
  const activeCrews = crews.filter((item) => item.clusters?.length)

  return (
    <div className="gov-ops-map-shell">
      <div className="gov-map-toolbar">
        <button type="button" className={baseLayer === 'streets' ? 'active' : ''} onClick={() => setBaseLayer('streets')}>
          <Layers size={16} /> Street
        </button>
        <button type="button" className={baseLayer === 'satellite' ? 'active' : ''} onClick={() => setBaseLayer('satellite')}>
          <Satellite size={16} /> Satellite
        </button>
        <button type="button" className={showCrews ? 'active' : ''} onClick={() => setShowCrews(!showCrews)}>
          <Truck size={16} /> Crews
        </button>
        <button type="button" onClick={onRunDbscan} disabled={loading.cluster}>
          {loading.cluster ? <RefreshCw size={16} className="spin" /> : <ShieldCheck size={16} />} Cluster
        </button>
        <button type="button" onClick={onAutoDispatch} disabled={loading.dispatch}>
          {loading.dispatch ? <RefreshCw size={16} className="spin" /> : <LocateFixed size={16} />} Dispatch
        </button>
      </div>

      <MapContainer
        center={[19.076, 72.877]}
        zoom={12}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <MapFit tickets={visibleTickets} />
        <ZoomControl position="bottomright" />
        <TileLayer key={baseLayer} url={activeLayer.url} attribution={activeLayer.attribution} maxZoom={activeLayer.maxZoom} />
        {baseLayer === 'satellite' && (
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
            attribution="&copy; CARTO"
            maxZoom={20}
          />
        )}

        {visibleTickets.map((ticket) => {
          const tone = getPriorityTone(ticket.priority_score)
          return (
            <CircleMarker
              key={ticket.ticket_id}
              center={[ticket.latitude, ticket.longitude]}
              radius={(ticket.priority_score || 0) >= 80 ? 15 : (ticket.priority_score || 0) >= 55 ? 11 : 8}
              pathOptions={{ color: tone.color, fillColor: tone.color, fillOpacity: 0.72, weight: 2 }}
            >
              <Popup>
                <div className="gov-map-popup">
                  <strong>{tone.label} ticket</strong>
                  <span>Score {ticket.priority_score?.toFixed?.(1) || ticket.priority_score}</span>
                  <span>Severity {ticket.base_severity || '--'} | Duplicates {ticket.duplicate_count || 1}</span>
                  <em>{ticket.status}</em>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}

        {showCrews && activeCrews.map((item, index) => (
          <Marker
            key={item.crew.id}
            position={[19.076 + index * 0.012, 72.877 + index * 0.014]}
            icon={crewIcon}
          >
            <Popup>
              <div className="gov-map-popup">
                <strong>{item.crew.name}</strong>
                <span>{item.crew.specialty}</span>
                <em>{item.clusters.length} assigned clusters</em>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="gov-map-summary">
        <div>
          <AlertTriangle size={18} />
          <span>Critical</span>
          <strong>{criticalCount}</strong>
        </div>
        <div>
          <ShieldCheck size={18} />
          <span>Tickets</span>
          <strong>{visibleTickets.length}</strong>
        </div>
        <div>
          <Truck size={18} />
          <span>Active crews</span>
          <strong>{activeCrews.length}</strong>
        </div>
      </div>
    </div>
  )
}
