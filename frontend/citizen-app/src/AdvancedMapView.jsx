import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bike,
  Camera,
  Car,
  Clock,
  Layers,
  LocateFixed,
  Map as MapIcon,
  Mountain,
  Navigation,
  RefreshCw,
  Route,
  Ruler,
  Satellite,
  Search,
  ShieldCheck,
  Square,
  TrainFront,
  Truck,
  X
} from 'lucide-react'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  ScaleControl,
  TileLayer,
  useMap,
  useMapEvents,
  ZoomControl
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const API = 'http://localhost:8000/api/v1'
const OSRM = 'https://router.project-osrm.org/route/v1/driving'

const VEHICLES = [
  { id: 'BIKE', label: 'Bike', icon: Bike, etaFactor: 1.45, hazardFactor: 1.7 },
  { id: 'CAR', label: 'Car', icon: Car, etaFactor: 1, hazardFactor: 1 },
  { id: 'TRUCK', label: 'Truck', icon: Truck, etaFactor: 1.25, hazardFactor: 0.7 }
]

const ROUTE_MODES = [
  { id: 'FASTEST', label: 'Fastest', icon: Clock },
  { id: 'SAFEST', label: 'Safest', icon: ShieldCheck },
  { id: 'BALANCED', label: 'Balanced', icon: Navigation }
]

const getVehicle = (id) => VEHICLES.find((item) => item.id === id) || VEHICLES[1]

const BASE_LAYERS = [
  {
    id: 'default',
    label: 'Default',
    icon: MapIcon,
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  },
  {
    id: 'light',
    label: 'Clean',
    icon: MapIcon,
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO &copy; OpenStreetMap',
    maxZoom: 20
  },
  {
    id: 'satellite',
    label: 'Satellite',
    icon: Satellite,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19
  },
  {
    id: 'terrain',
    label: 'Terrain',
    icon: Mountain,
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
    maxZoom: 17
  }
]

const DETAIL_LAYERS = [
  { id: 'hazards', label: 'Road Risk', icon: AlertTriangle },
  { id: 'transit', label: 'Transit', icon: TrainFront },
  { id: 'biking', label: 'Biking', icon: Bike }
]

function createUserIcon() {
  return L.divIcon({
    html: '<div class="advanced-user-marker"><span></span></div>',
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  })
}

function createPinIcon() {
  return L.divIcon({
    html: '<div class="advanced-destination-pin"></div>',
    className: '',
    iconSize: [26, 34],
    iconAnchor: [13, 32]
  })
}

function normalizeReport(report, index) {
  const latitude = Number(report.latitude ?? report.lat)
  const longitude = Number(report.longitude ?? report.lon)
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null

  return {
    id: report.report_id || report.id || `local-${index}`,
    latitude,
    longitude,
    severity: report.user_confirmed_severity || report.ai_suggested_severity || report.severity || 3,
    type: report.damage_type || report.type || 'ROAD_DAMAGE',
    status: report.status || 'ACTIVE',
    source: report.report_id ? 'backend' : 'local'
  }
}

function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '--'
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${Math.round(meters)} m`
}

function routeHazardScore(geometry, reports, vehicleId) {
  const vehicle = getVehicle(vehicleId)
  let hazardCount = 0
  let weightedRisk = 0

  reports.forEach((report) => {
    let closest = Infinity
    for (let index = 0; index < geometry.length; index += 6) {
      const distance = L.latLng(geometry[index]).distanceTo([report.latitude, report.longitude])
      if (distance < closest) closest = distance
    }
    if (closest <= 55) {
      hazardCount += 1
      weightedRisk += (report.severity || 3) * vehicle.hazardFactor
    }
  })

  return {
    hazardCount,
    weightedRisk,
    roadQuality: Math.max(1, Math.min(5, Number((5 - weightedRisk * 0.18).toFixed(1))))
  }
}

function rankRoadRoute(route, mode, hazardMeta) {
  if (mode === 'SAFEST') return hazardMeta.weightedRisk * 10000 + route.duration
  if (mode === 'BALANCED') return route.duration + hazardMeta.weightedRisk * 180
  return route.duration + hazardMeta.weightedRisk * 20
}

function getBoundsQuery(map) {
  const bounds = map.getBounds()
  return new URLSearchParams({
    min_lat: bounds.getSouth().toString(),
    max_lat: bounds.getNorth().toString(),
    min_lon: bounds.getWest().toString(),
    max_lon: bounds.getEast().toString()
  })
}

function MapBridge({ onMove, onTap, mapRef }) {
  const map = useMap()

  useMapEvents({
    moveend() {
      onMove(map)
    },
    zoomend() {
      onMove(map)
    },
    click(event) {
      onTap(event.latlng, map)
    }
  })

  useEffect(() => {
    mapRef.current = map
    window.setTimeout(() => onMove(map), 0)
  }, [map, mapRef, onMove])

  return null
}

function LayerButton({ item, active, onClick }) {
  const Icon = item.icon
  return (
    <button type="button" className={active ? 'active' : ''} onClick={onClick}>
      <Icon size={22} />
      <span>{item.label}</span>
    </button>
  )
}

export default function AdvancedMapView({ myReports = [], onReport }) {
  const [baseLayer, setBaseLayer] = useState('light')
  const [enabledDetails, setEnabledDetails] = useState({ hazards: true, transit: false, biking: false, labels: true })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [measureMode, setMeasureMode] = useState(false)
  const [travelMode, setTravelMode] = useState(false)
  const [measurePoints, setMeasurePoints] = useState([])
  const [reports, setReports] = useState([])
  const [userPos, setUserPos] = useState([19.076, 72.877])
  const [vehicle, setVehicle] = useState('CAR')
  const [routeMode, setRouteMode] = useState('BALANCED')
  const [isNavigating, setIsNavigating] = useState(false)
  const [destination, setDestination] = useState(null)
  const [routeData, setRouteData] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('Move the map to load nearby reports.')
  const mapRef = useRef(null)
  const fetchId = useRef(0)

  const activeBase = BASE_LAYERS.find((layer) => layer.id === baseLayer) || BASE_LAYERS[1]
  const normalizedLocalReports = useMemo(
    () => myReports.map(normalizeReport).filter(Boolean),
    [myReports]
  )
  const displayedReports = reports.length ? reports : normalizedLocalReports
  const measureDistance = measurePoints.length === 2
    ? L.latLng(measurePoints[0]).distanceTo(measurePoints[1])
    : null
  const userIcon = useMemo(() => createUserIcon(), [])
  const pinIcon = useMemo(() => createPinIcon(), [])

  useEffect(() => {
    if (isNavigating && mapRef.current) {
      mapRef.current.setView(userPos, 17, { animate: true })
    }
  }, [isNavigating, userPos])

  const refreshReports = useCallback(async (map = mapRef.current) => {
    if (!map) return

    const requestId = fetchId.current + 1
    fetchId.current = requestId
    setLoading(true)
    try {
      const response = await fetch(`${API}/reports?${getBoundsQuery(map).toString()}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      if (fetchId.current !== requestId) return

      const cleanReports = (data?.data || []).map(normalizeReport).filter(Boolean)
      setReports(cleanReports)
      localStorage.setItem('rd_last_map_reports', JSON.stringify(cleanReports))
      setStatus(cleanReports.length ? `${cleanReports.length} verified road reports nearby.` : 'No active road reports in this map area.')
    } catch {
      const cached = JSON.parse(localStorage.getItem('rd_last_map_reports') || '[]')
      const cleanReports = cached.map(normalizeReport).filter(Boolean)
      setReports(cleanReports)
      setStatus(cleanReports.length ? 'Backend unavailable. Showing cached nearby reports.' : 'Backend unavailable. No cached reports for this area.')
    } finally {
      if (fetchId.current === requestId) setLoading(false)
    }
  }, [])

  const locateUser = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('Live location is not available in this browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = [position.coords.latitude, position.coords.longitude]
        setUserPos(next)
        mapRef.current?.setView(next, 16, { animate: true })
        setStatus(`Live location active, accuracy ${Math.round(position.coords.accuracy)}m.`)
      },
      () => setStatus('Allow location access to recenter the map.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 1000 }
    )
  }, [])

  const calculateRoute = useCallback(async (nextDestination, nextVehicle = vehicle, nextRouteMode = routeMode) => {
    if (!nextDestination) return

    setLoading(true)
    setStatus('Calculating road travel time...')
    try {
      const url = `${OSRM}/${userPos[1]},${userPos[0]};${nextDestination.lon},${nextDestination.lat}?overview=full&geometries=geojson&steps=false&alternatives=true`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      const candidates = data?.routes || []
      if (!candidates.length) throw new Error('No route')

      const scoredRoutes = candidates.map((candidate) => {
        const geometry = candidate.geometry.coordinates.map(([lng, lat]) => [lat, lng])
        const hazardMeta = routeHazardScore(geometry, displayedReports, nextVehicle)
        return { candidate, geometry, hazardMeta, score: rankRoadRoute(candidate, nextRouteMode, hazardMeta) }
      }).sort((a, b) => a.score - b.score)
      const best = scoredRoutes[0]
      const selectedVehicle = getVehicle(nextVehicle)
      const adjustedDuration = best.candidate.duration * selectedVehicle.etaFactor + best.hazardMeta.weightedRisk * 21

      setRouteData({
        geometry: best.geometry,
        distance: best.candidate.distance,
        duration: adjustedDuration,
        baseDuration: best.candidate.duration,
        hazardCount: best.hazardMeta.hazardCount,
        roadQuality: best.hazardMeta.roadQuality,
        mode: nextRouteMode,
        vehicle: nextVehicle
      })
      setDestination(nextDestination)
      setTravelMode(false)
      setStatus(`${nextRouteMode.toLowerCase()} ${selectedVehicle.label.toLowerCase()} route: ${formatDistance(best.candidate.distance)}, ${Math.max(1, Math.round(adjustedDuration / 60))} min, ${best.hazardMeta.hazardCount} risks.`)
      if (mapRef.current && best.geometry.length) {
        mapRef.current.fitBounds(L.latLngBounds(best.geometry), { padding: [48, 48], maxZoom: 17 })
      }
    } catch {
      setRouteData(null)
      setStatus('Could not calculate a road route. Check internet and try again.')
    } finally {
      setLoading(false)
    }
  }, [displayedReports, routeMode, userPos, vehicle])

  const searchDestination = async () => {
    const query = searchText.trim()
    if (!query) return

    setLoading(true)
    setStatus('Searching places...')
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`)
      const data = await response.json()
      setSearchResults(data || [])
      setStatus(data?.length ? 'Select a result to calculate travel time.' : 'No place found. Try a more specific search.')
    } catch {
      setStatus('Place search failed. Check internet and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleMapTap = (latlng) => {
    if (measureMode) {
      setMeasurePoints((points) => points.length >= 2 ? [[latlng.lat, latlng.lng]] : [...points, [latlng.lat, latlng.lng]])
      return
    }

    if (travelMode) {
      calculateRoute({ lat: latlng.lat, lon: latlng.lng, name: 'Pinned destination' })
    }
  }

  const toggleDetail = (id) => {
    setEnabledDetails((current) => ({ ...current, [id]: !current[id] }))
  }

  return (
    <div className="advanced-map-screen">
      <MapContainer
        center={userPos}
        zoom={14}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
        aria-label="Advanced road safety map"
      >
        <MapBridge onMove={refreshReports} onTap={handleMapTap} mapRef={mapRef} />
        <TileLayer key={activeBase.id} url={activeBase.url} attribution={activeBase.attribution} maxZoom={activeBase.maxZoom} />
        {enabledDetails.labels && baseLayer === 'satellite' && (
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
            attribution="&copy; CARTO"
            pane="overlayPane"
            maxZoom={20}
          />
        )}
        {enabledDetails.transit && (
          <TileLayer
            url="https://tile.memomaps.de/tilegen/{z}/{x}/{y}.png"
            attribution="&copy; MemoMaps &copy; OpenStreetMap"
            opacity={0.72}
          />
        )}
        {enabledDetails.biking && (
          <TileLayer
            url="https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png"
            attribution="&copy; CyclOSM &copy; OpenStreetMap"
            opacity={0.68}
          />
        )}
        <ZoomControl position="bottomright" />
        <ScaleControl position="bottomleft" />

        <Marker position={userPos} icon={userIcon}>
          <Popup><span className="map-popup-text">Live location</span></Popup>
        </Marker>

        {enabledDetails.hazards && displayedReports.map((report) => (
          <CircleMarker
            key={report.id}
            center={[report.latitude, report.longitude]}
            radius={Math.max(7, report.severity * 2.2)}
            pathOptions={{
              color: report.severity >= 4 ? '#dc2626' : report.severity >= 3 ? '#d97706' : '#059669',
              fillColor: report.severity >= 4 ? '#ef4444' : report.severity >= 3 ? '#f59e0b' : '#10b981',
              fillOpacity: 0.78,
              weight: 2
            }}
          >
            <Popup>
              <div className="advanced-popup">
                <strong>{report.type.replaceAll('_', ' ')}</strong>
                <span>Severity {report.severity}/5</span>
                <em>{report.source === 'backend' ? 'Verified report' : 'Local report'}</em>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {destination && <Marker position={[destination.lat, destination.lon]} icon={pinIcon} />}
        {routeData?.geometry?.length > 0 && (
          <>
            <Polyline positions={routeData.geometry} pathOptions={{ color: '#ffffff', weight: 10, opacity: 0.9, lineCap: 'round' }} />
            <Polyline positions={routeData.geometry} pathOptions={{ color: '#2563eb', weight: 6, opacity: 0.95, lineCap: 'round' }} />
          </>
        )}
        {measurePoints.length > 0 && <Polyline positions={measurePoints} pathOptions={{ color: '#f59e0b', weight: 4, dashArray: '8 8' }} />}
      </MapContainer>

      <div className="advanced-map-search">
        <div className="advanced-search-row">
          <Search size={18} />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && searchDestination()}
            placeholder="Search a place for travel time"
            aria-label="Search map destination"
          />
          {searchText && (
            <button type="button" onClick={() => { setSearchText(''); setSearchResults([]) }} aria-label="Clear search">
              <X size={17} />
            </button>
          )}
          <button type="button" onClick={searchDestination} aria-label="Search destination">
            {loading ? <RefreshCw size={17} className="animate-spin" /> : <Route size={17} />}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="advanced-search-results">
            {searchResults.map((item) => (
              <button
                type="button"
                key={item.place_id}
                onClick={() => {
                  setSearchResults([])
                  setSearchText(item.name || item.display_name.split(',')[0])
                  calculateRoute({ lat: Number(item.lat), lon: Number(item.lon), name: item.name || 'Destination' })
                }}
              >
                <strong>{item.name || item.display_name.split(',')[0]}</strong>
                <span>{item.display_name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="advanced-route-controls">
          <div>
            {ROUTE_MODES.map((item) => {
              const Icon = item.icon
              return (
                <button
                  type="button"
                  key={item.id}
                  className={routeMode === item.id ? 'active' : ''}
                  onClick={() => {
                    setRouteMode(item.id)
                    if (destination) calculateRoute(destination, vehicle, item.id)
                  }}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
          <div>
            {VEHICLES.map((item) => {
              const Icon = item.icon
              return (
                <button
                  type="button"
                  key={item.id}
                  className={vehicle === item.id ? 'active' : ''}
                  onClick={() => {
                    setVehicle(item.id)
                    if (destination) calculateRoute(destination, item.id, routeMode)
                  }}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="advanced-map-toolbar">
        <button type="button" onClick={locateUser} aria-label="Recenter live location"><LocateFixed size={20} /></button>
        <button type="button" className={drawerOpen ? 'active' : ''} onClick={() => setDrawerOpen(true)} aria-label="Map details"><Layers size={20} /></button>
        <button type="button" className={travelMode ? 'active' : ''} onClick={() => { setTravelMode(!travelMode); setMeasureMode(false) }} aria-label="Travel time"><Navigation size={20} /></button>
        <button type="button" className={measureMode ? 'active' : ''} onClick={() => { setMeasureMode(!measureMode); setTravelMode(false); setMeasurePoints([]) }} aria-label="Measure distance"><Ruler size={20} /></button>
      </div>

      <button type="button" className="advanced-report-btn" onClick={onReport}>
        <Camera size={18} />
        <span>Report</span>
      </button>

      <div className="advanced-status-card">
        <div>
          <strong>{status}</strong>
          <span>
            {measureMode && (measureDistance ? `Measured ${formatDistance(measureDistance)}` : 'Tap two points to measure.')}
            {travelMode && !routeData && 'Tap a destination or search above.'}
            {!measureMode && !travelMode && `${displayedReports.length} visible reports.`}
          </span>
        </div>
        {routeData && (
          <div className="travel-chip">
            <strong>{Math.max(1, Math.round(routeData.duration / 60))} min</strong>
            <span>{formatDistance(routeData.distance)} | {routeData.hazardCount} risks | {routeData.roadQuality}/5</span>
          </div>
        )}
      </div>

      {routeData && (
        <div className="advanced-nav-card">
          <button
            type="button"
            onClick={() => {
              setIsNavigating(!isNavigating)
              if (!isNavigating && mapRef.current) {
                mapRef.current.setView(userPos, 17, { animate: true })
              }
            }}
          >
            {isNavigating ? <Square size={17} /> : <Navigation size={17} />}
            <span>{isNavigating ? 'End navigation' : 'Start navigation'}</span>
          </button>
          <a
            href={`https://www.google.com/maps/dir/?api=1&origin=${userPos[0]},${userPos[1]}&destination=${destination.lat},${destination.lon}&travelmode=driving`}
            target="_blank"
            rel="noreferrer"
          >
            Open Maps
          </a>
        </div>
      )}

      {drawerOpen && (
        <div className="map-details-sheet" role="dialog" aria-label="Map details">
          <div className="details-head">
            <h3>Map details</h3>
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close map details"><X size={22} /></button>
          </div>

          <h4>Details</h4>
          <div className="details-grid">
            {DETAIL_LAYERS.map((item) => (
              <LayerButton key={item.id} item={item} active={enabledDetails[item.id]} onClick={() => toggleDetail(item.id)} />
            ))}
          </div>

          <h4>Map tools</h4>
          <div className="details-grid two">
            <LayerButton item={{ label: 'Travel Time', icon: Navigation }} active={travelMode} onClick={() => { setTravelMode(!travelMode); setMeasureMode(false); setDrawerOpen(false) }} />
            <LayerButton item={{ label: 'Measure', icon: Ruler }} active={measureMode} onClick={() => { setMeasureMode(!measureMode); setTravelMode(false); setMeasurePoints([]); setDrawerOpen(false) }} />
          </div>

          <h4>Map type</h4>
          <div className="details-grid">
            {BASE_LAYERS.map((layer) => (
              <LayerButton key={layer.id} item={layer} active={baseLayer === layer.id} onClick={() => setBaseLayer(layer.id)} />
            ))}
          </div>

          <label className="details-check">
            <input type="checkbox" checked={enabledDetails.labels} onChange={() => toggleDetail('labels')} />
            <span>Labels on satellite</span>
          </label>
        </div>
      )}
    </div>
  )
}
