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
import { API_BASE, fetchWithAuth } from './api'

const API = API_BASE
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

import 'leaflet.heat'

function HeatmapLayer({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points || points.length === 0) return
    const heat = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      gradient: { 0.4: 'rgba(56, 189, 248, 0.4)', 0.65: 'rgba(245, 158, 11, 0.7)', 1: 'rgba(239, 68, 68, 0.9)' }
    }).addTo(map)
    return () => { if (map && heat) map.removeLayer(heat) }
  }, [map, points])
  return null
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

function MapBridge({ onMove, onTap, onInteraction, onLocationFound, onStatusChange, mapRef }) {
  const map = useMap()

  useMapEvents({
    movestart() {
      onInteraction()
    },
    moveend() {
      onMove(map)
    },
    zoomstart() {
      onInteraction()
    },
    zoomend() {
      onMove(map)
    },
    click(event) {
      onTap(event.latlng, map)
    },
    locationfound(e) {
      onLocationFound([e.latlng.lat, e.latlng.lng]);
      onStatusChange('granted');
    },
    locationerror(e) {
      onStatusChange('denied');
    }
  })

  useEffect(() => {
    mapRef.current = map
    // Force map to recognize its size
    setTimeout(() => {
      map.invalidateSize()
      map.locate({ setView: true, maxZoom: 15, enableHighAccuracy: true })
    }, 250)
    
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
  const [enabledDetails, setEnabledDetails] = useState({ hazards: true, heatmap: true, transit: false, biking: false, labels: true })
  const [isFreeLook, setIsFreeLook] = useState(false)
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
  const [locationStatus, setLocationStatus] = useState('unknown')
  const [status, setStatus] = useState('Move the map to load nearby reports.')
  const mapRef = useRef(null)
  const fetchId = useRef(0)

  const activeBase = BASE_LAYERS.find((layer) => layer.id === baseLayer) || BASE_LAYERS[1]
  const normalizedLocalReports = useMemo(
    () => myReports.map(normalizeReport).filter(Boolean),
    [myReports]
  )
  const displayedReports = reports.length ? reports : normalizedLocalReports
  const [measureDistance, setMeasureDistance] = useState(null)
  const userIcon = useMemo(() => createUserIcon(), [])
  const pinIcon = useMemo(() => createPinIcon(), [])

  const heatmapPoints = useMemo(() => {
    return displayedReports.map(r => [r.latitude, r.longitude, r.severity * 0.2]);
  }, [displayedReports]);

  const suspensionStats = useMemo(() => {
    if (!routeData) return null;
    const safetyScore = Math.max(0, 100 - (routeData.hazardCount * 15 / (routeData.distance / 1000 + 0.1))).toFixed(0);
    const wearCost = ((routeData.distance / 1000) * 1.5 + (routeData.hazardCount * 8)).toFixed(0);
    return { safetyScore, wearCost };
  }, [routeData]);

  const nearestHazard = useMemo(() => {
    if (!routeData || !routeData.geometry || !isNavigating) return null
    let closest = null
    let minDist = Infinity
    
    displayedReports.forEach(report => {
      const dist = L.latLng(userPos).distanceTo([report.latitude, report.longitude])
      if (dist < 1000 && dist > 10) { 
        let onRoute = false
        for (let i=0; i<routeData.geometry.length; i+=10) {
           if (L.latLng(routeData.geometry[i]).distanceTo([report.latitude, report.longitude]) < 60) {
             onRoute = true; break;
           }
        }
        if (onRoute && dist < minDist) {
          minDist = dist
          closest = { ...report, distance: Math.round(dist) }
        }
      }
    })
    return closest
  }, [routeData, userPos, displayedReports, isNavigating])

  const lastAnnouncedHazard = useRef(null)
  useEffect(() => {
    if (isNavigating && nearestHazard && window.speechSynthesis) {
       if (nearestHazard.distance <= 250 && nearestHazard.id !== lastAnnouncedHazard.current) {
          lastAnnouncedHazard.current = nearestHazard.id
          const type = (nearestHazard.type || 'hazard').replace('_', ' ').toLowerCase()
          const severityText = nearestHazard.severity >= 4 ? 'severe ' : ''
          const text = `Caution: ${severityText}${type} ${nearestHazard.distance} meters ahead.`
          window.speechSynthesis.cancel()
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
       }
    }
  }, [isNavigating, nearestHazard])

  useEffect(() => {
    if (isNavigating && mapRef.current && !isFreeLook) {
      mapRef.current.setView(userPos, 17, { animate: true })
    }
  }, [isNavigating, userPos, isFreeLook])

  const refreshReports = useCallback(async (map = mapRef.current) => {
    if (!map) return

    const requestId = fetchId.current + 1
    fetchId.current = requestId
    setLoading(true)
    try {
      const response = await fetchWithAuth(`${API}/reports?${getBoundsQuery(map).toString()}`)
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

  const watchId = useRef(null)
  const isFirstFix = useRef(true)

  const locateUser = useCallback((setView = true) => {
    if (!('geolocation' in navigator)) {
      setStatus('Live location is not available in this browser.')
      return
    }

    if (watchId.current) navigator.geolocation.clearWatch(watchId.current)

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const next = [position.coords.latitude, position.coords.longitude]
        setUserPos(next)
        
        if (setView && (isFirstFix.current || !isFreeLook)) {
          mapRef.current?.setView(next, isFirstFix.current ? 16 : mapRef.current.getZoom(), { animate: true })
          isFirstFix.current = false
        }
        
        setStatus(`Live tracking active (±${Math.round(position.coords.accuracy)}m)`)
        setLocationStatus('granted')
      },
      (error) => {
        console.error('GPS Error:', error)
        setStatus('GPS signal lost or denied.')
        setLocationStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }, [isFreeLook])

  useEffect(() => {
    locateUser(true)
    return () => { if (watchId.current) navigator.geolocation.clearWatch(watchId.current) }
  }, [locateUser])

  const calculateRoute = useCallback(async (nextDestination, nextVehicle = vehicle, nextRouteMode = routeMode) => {
    if (!nextDestination) return

    setLoading(true)
    setStatus('Calculating road travel time...')
    try {
      const url = `${OSRM}/${userPos[1]},${userPos[0]};${nextDestination.lon},${nextDestination.lat}?overview=full&geometries=geojson&steps=false&alternatives=true&radiuses=150;150`
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
      setIsNavigating(true)
      setIsFreeLook(false)
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
    if (travelMode) {
      setDestination({ lat: latlng.lat, lon: latlng.lng, name: 'Pinned destination' })
      calculateRoute({ lat: latlng.lat, lon: latlng.lng, name: 'Pinned destination' })
      setMeasurePoints([])
      setIsFreeLook(false)
    } else if (measureMode) {
      const newPoints = [...measurePoints, [latlng.lat, latlng.lng]]
      setMeasurePoints(newPoints)
      if (newPoints.length > 1) {
        const dist = L.latLng(newPoints[newPoints.length - 2]).distanceTo(newPoints[newPoints.length - 1])
        setMeasureDistance((prev) => (prev || 0) + dist)
      }
    }
  }

  const handleMapInteraction = () => {
    if (isNavigating) setIsFreeLook(true)
  }

  const toggleDetail = (id) => {
    setEnabledDetails((current) => ({ ...current, [id]: !current[id] }))
  }

  return (
    <div className="advanced-map-container" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 16, left: 12, right: 12, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {locationStatus === 'denied' && (
          <div style={{ pointerEvents: 'auto', background: 'rgba(239, 68, 68, 0.9)', backdropFilter: 'blur(10px)', padding: '12px 20px', borderRadius: '12px', color: 'white', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <AlertTriangle size={20} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>Location Access Denied</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Enable GPS in your browser settings to see your live position.</div>
            </div>
            <button onClick={() => setLocationStatus('unknown')} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
        )}
      </div>

      <MapContainer
        center={userPos}
        zoom={14}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
        aria-label="Advanced road safety map"
      >
        <MapBridge 
          onMove={refreshReports} 
          onTap={handleMapTap} 
          onInteraction={handleMapInteraction}
          onLocationFound={setUserPos} 
          onStatusChange={setLocationStatus}
          mapRef={mapRef} 
        />
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
        {enabledDetails.heatmap && <HeatmapLayer points={heatmapPoints} />}
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
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); fetchWithAuth(`${API}/reports/${report.id}/verify`, {method:'POST'}).then(() => refreshReports()) }}
                    className="verify-btn mini"
                  >
                    Verify
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); fetchWithAuth(`${API}/reports/${report.id}/fix-verify`, {method:'POST'}).then(() => refreshReports()) }}
                    className="verify-btn mini fixed"
                  >
                    Fixed
                  </button>
                </div>
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
        {nearestHazard && (
          <div className={`live-alert-panel ${nearestHazard.severity >= 4 ? '' : 'warning'}`}>
            <AlertTriangle className="icon" size={24} />
            <div>
              <strong>⚠️ {nearestHazard.severity >= 4 ? 'Severe ' : ''}{nearestHazard.type.replaceAll('_', ' ')} Ahead</strong>
              <span>Est. distance: {nearestHazard.distance}m</span>
            </div>
          </div>
        )}
      </div>

      <div className="advanced-bottom-wrapper" style={{ pointerEvents: 'none' }}>
        <div style={{ width: '100%', pointerEvents: 'auto' }}>
          <div className="advanced-map-toolbar">
            <button type="button" onClick={() => { locateUser(); setIsFreeLook(false) }} className={(!isFreeLook && isNavigating) ? 'active' : ''} aria-label="Recenter live location">
              {isFreeLook ? <Navigation size={20} /> : <LocateFixed size={20} />}
            </button>
            <button type="button" className={drawerOpen ? 'active' : ''} onClick={() => setDrawerOpen(true)} aria-label="Map details"><Layers size={20} /></button>
            <button type="button" className={travelMode ? 'active' : ''} onClick={() => { setTravelMode(!travelMode); setMeasureMode(false) }} aria-label="Travel time"><Navigation size={20} /></button>
            <button type="button" className={measureMode ? 'active' : ''} onClick={() => { setMeasureMode(!measureMode); setTravelMode(false); setMeasurePoints([]) }} aria-label="Measure distance"><Ruler size={20} /></button>
          </div>
        </div>

        <div className="advanced-report-row" style={{ pointerEvents: 'auto' }}>
          <button type="button" className="advanced-report-btn" onClick={onReport}>
            <Camera size={20} />
            <span>+ Report</span>
          </button>
        </div>

        {routeData && (
          <div className="advanced-nav-card" style={{ pointerEvents: 'auto' }}>
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

        <div className="advanced-status-card" style={{ pointerEvents: 'auto' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, marginTop: 4 }}>
                <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{suspensionStats.safetyScore}% Smooth</span>
                <span style={{ color: '#fca5a5' }}>₹{suspensionStats.wearCost} wear</span>
              </div>
              <span>{formatDistance(routeData.distance)} | {routeData.hazardCount} risks | {routeData.roadQuality}/5</span>
            </div>
          )}
        </div>
      </div>

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
