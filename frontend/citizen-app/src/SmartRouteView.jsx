import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Bike,
  Car,
  Clock,
  LocateFixed,
  MapPin,
  Navigation,
  Play,
  Search,
  ShieldCheck,
  Square,
  Truck,
  X
} from 'lucide-react'
import L from 'leaflet'
import NavigationMap from './components/NavigationMap'
import 'leaflet/dist/leaflet.css'

const API = 'http://192.168.253.155:8000/api/v1'
const OSRM = 'https://router.project-osrm.org/route/v1'

const VEHICLES = [
  { id: 'BIKE', label: 'Bike', icon: Bike, profile: 'bike', etaFactor: 1.45, hazardFactor: 1.8, warningMeters: 260, safeSpeed: 15 },
  { id: 'CAR', label: 'Car', icon: Car, profile: 'driving', etaFactor: 1, hazardFactor: 1, warningMeters: 220, safeSpeed: 20 },
  { id: 'TRUCK', label: 'Truck', icon: Truck, profile: 'driving', etaFactor: 1.25, hazardFactor: 0.7, warningMeters: 300, safeSpeed: 18 }
]

const ROUTE_MODES = [
  { id: 'FASTEST', label: 'Fastest', icon: Clock },
  { id: 'SAFEST', label: 'Safest', icon: ShieldCheck },
  { id: 'BALANCED', label: 'Balanced', icon: Navigation }
]

const getVehicle = (id) => VEHICLES.find((vehicle) => vehicle.id === id) || VEHICLES[1]
const getMode = (id) => ROUTE_MODES.find((mode) => mode.id === id) || ROUTE_MODES[2]

function toRad(value) {
  return value * Math.PI / 180
}

function metersBetween(a, b) {
  return L.latLng(a).distanceTo(b)
}

function distancePointToSegmentMeters(point, start, end) {
  const avgLat = toRad((point.lat + start.lat + end.lat) / 3)
  const metersPerLat = 111320
  const metersPerLon = Math.max(1, 111320 * Math.cos(avgLat))

  const px = (point.lng - start.lng) * metersPerLon
  const py = (point.lat - start.lat) * metersPerLat
  const ex = (end.lng - start.lng) * metersPerLon
  const ey = (end.lat - start.lat) * metersPerLat
  const lengthSq = ex * ex + ey * ey

  if (lengthSq === 0) return Math.sqrt(px * px + py * py)

  const t = Math.max(0, Math.min(1, (px * ex + py * ey) / lengthSq))
  const dx = px - ex * t
  const dy = py - ey * t
  return Math.sqrt(dx * dx + dy * dy)
}

function distanceToRouteMeters(hazard, geometry) {
  if (!geometry?.length) return Infinity

  const point = { lat: hazard.latitude, lng: hazard.longitude }
  let best = Infinity
  for (let index = 0; index < geometry.length - 1; index += 1) {
    const dist = distancePointToSegmentMeters(point, geometry[index], geometry[index + 1])
    if (dist < best) best = dist
  }
  return best
}

function formatStep(step) {
  const type = step?.maneuver?.type || 'continue'
  const modifier = step?.maneuver?.modifier || ''
  const road = step?.name ? ` on ${step.name}` : ''

  if (type === 'arrive') return 'Arrive at destination'
  if (type === 'depart') return `Head${road || ' to the route'}`
  if (type === 'roundabout' || type === 'rotary') return `Enter roundabout${road}`
  if (type === 'merge') return `Merge ${modifier}${road}`.trim()
  if (type === 'new name') return `Continue${road || ' ahead'}`

  const turnText = {
    left: 'Turn left',
    right: 'Turn right',
    straight: 'Continue straight',
    'slight left': 'Keep slightly left',
    'slight right': 'Keep slightly right',
    'sharp left': 'Take a sharp left',
    'sharp right': 'Take a sharp right',
    uturn: 'Make a U-turn'
  }[modifier]

  return `${turnText || 'Continue'}${road}`
}

function nearestGeometryIndex(location, geometry) {
  let nearest = 0
  let best = Infinity
  geometry.forEach((point, index) => {
    const dist = metersBetween(location, [point.lat, point.lng])
    if (dist < best) {
      best = dist
      nearest = index
    }
  })
  return nearest
}

function normalizeRoadRoute(route, origin, destination, safetyData, vehicleId, modeId) {
  const vehicle = getVehicle(vehicleId)
  const geometry = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
  const safetyHazards = safetyData?.all_hazards || []
  const routeHazards = safetyHazards
    .map((hazard) => ({
      ...hazard,
      distance_to_route_m: distanceToRouteMeters(hazard, geometry)
    }))
    .filter((hazard) => hazard.distance_to_route_m <= 45)

  const hazardWeight = routeHazards.reduce((sum, hazard) => {
    const severity = hazard.severity || 3
    return sum + severity * vehicle.hazardFactor
  }, 0)
  const hazardDelayMin = hazardWeight * 0.35
  const etaMin = Math.max(1, (route.duration / 60) * vehicle.etaFactor + hazardDelayMin)
  const qualityScore = Math.max(1, Math.min(5, 5 - hazardWeight * 0.18))
  const geometryWithInstructions = geometry.map((point) => ({ ...point, instruction: 'Continue on the road' }))

  const steps = (route.legs || []).flatMap((leg) => leg.steps || []).map((step) => {
    const location = [step.maneuver.location[1], step.maneuver.location[0]]
    return {
      lat: location[0],
      lng: location[1],
      geometry_index: nearestGeometryIndex(location, geometry),
      instruction: formatStep(step),
      distance_m: step.distance,
      duration_s: step.duration
    }
  })

  steps.forEach((step) => {
    if (geometryWithInstructions[step.geometry_index]) {
      geometryWithInstructions[step.geometry_index].instruction = step.instruction
    }
  })

  return {
    geometry: geometryWithInstructions,
    steps,
    route_mode: modeId,
    vehicle_type: vehicleId,
    source: 'OSRM road network',
    distance_km: Number((route.distance / 1000).toFixed(2)),
    adjusted_travel_min: Number(etaMin.toFixed(1)),
    base_travel_min: Number((route.duration / 60).toFixed(1)),
    road_quality_score: Number(qualityScore.toFixed(1)),
    estimated_delay_min: Number(hazardDelayMin.toFixed(1)),
    hazards_on_route: routeHazards.length,
    all_hazards: routeHazards,
    hazard_weight: hazardWeight,
    google_maps_url: `https://www.google.com/maps/dir/?api=1&origin=${origin[0]},${origin[1]}&destination=${destination.lat},${destination.lon}`
  }
}

function rankRoute(route, modeId) {
  if (modeId === 'SAFEST') return route.hazard_weight * 10000 + route.base_travel_min
  if (modeId === 'BALANCED') return route.base_travel_min + route.hazard_weight * 2.5
  return route.base_travel_min + route.hazard_weight * 0.25
}

async function fetchRoadRoutes(origin, destination, vehicleId, modeId, safetyData) {
  const vehicle = getVehicle(vehicleId)
  const profiles = vehicle.profile === 'bike' ? ['bike', 'driving'] : ['driving']
  let lastError = null

  for (const profile of profiles) {
    try {
      const url = `${OSRM}/${profile}/${origin[1]},${origin[0]};${destination.lon},${destination.lat}?overview=full&geometries=geojson&steps=true&alternatives=true`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Road router failed with HTTP ${response.status}`)
      const data = await response.json()
      if (!data?.routes?.length) throw new Error('No road route returned')

      const normalized = data.routes.map((route) => normalizeRoadRoute(route, origin, destination, safetyData, vehicleId, modeId))
      return normalized.sort((a, b) => rankRoute(a, modeId) - rankRoute(b, modeId))[0]
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('Road routing unavailable')
}

async function fetchSafetyMetadata(origin, destination, vehicleId, modeId) {
  try {
    const response = await fetch(`${API}/routing/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin_lat: origin[0],
        origin_lon: origin[1],
        dest_lat: destination.lat,
        dest_lon: destination.lon,
        vehicle_type: vehicleId,
        route_mode: modeId
      })
    })

    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

export default function SmartRouteView() {
  const [destination, setDestination] = useState(null)
  const [destSearch, setDestSearch] = useState('')
  const [userPos, setUserPos] = useState([19.076, 72.877])
  const [vehicle, setVehicle] = useState('CAR')
  const [routeMode, setRouteMode] = useState('BALANCED')
  const [locationStatus, setLocationStatus] = useState(() => (
    'geolocation' in navigator
      ? 'Finding your live location...'
      : 'Live location is not available in this browser.'
  ))
  const [routeData, setRouteData] = useState(null)
  const [isNavigating, setIsNavigating] = useState(false)
  const [isFollowingUser, setIsFollowingUser] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [isRouting, setIsRouting] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [message, setMessage] = useState('')
  const [currentInstruction, setCurrentInstruction] = useState('Choose a destination')
  const [navProgress, setNavProgress] = useState(0)

  const watchId = useRef(null)
  const routeRequest = useRef(0)
  const lastVoicePrompt = useRef('')

  const selectedVehicle = useMemo(() => getVehicle(vehicle), [vehicle])
  const selectedMode = useMemo(() => getMode(routeMode), [routeMode])

  const speak = useCallback((text) => {
    if (!window.speechSynthesis || !text || lastVoicePrompt.current === text) return
    lastVoicePrompt.current = text
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
  }, [])

  const calculateRoute = useCallback(async (
    nextDestination = destination,
    nextUserPos = userPos,
    nextVehicle = vehicle,
    nextRouteMode = routeMode
  ) => {
    if (!nextDestination || !nextUserPos) return

    const requestId = routeRequest.current + 1
    routeRequest.current = requestId
    setIsRouting(true)
    setMessage('')
    setCurrentInstruction('Finding a drivable road route...')

    try {
      const safetyData = await fetchSafetyMetadata(nextUserPos, nextDestination, nextVehicle, nextRouteMode)
      const roadRoute = await fetchRoadRoutes(nextUserPos, nextDestination, nextVehicle, nextRouteMode, safetyData)
      if (routeRequest.current !== requestId) return

      setRouteData(roadRoute)
      setCurrentInstruction(`Take the ${getMode(nextRouteMode).label.toLowerCase()} road route to ${nextDestination.name}`)
      setIsFollowingUser(false)
      if (!safetyData) setMessage('Using road routing now. Start the backend to add live pothole safety scoring.')
    } catch (error) {
      if (routeRequest.current !== requestId) return
      setRouteData(null)
      setMessage('Could not get a road-following route. Check internet/backend, or open the route in Maps.')
      setCurrentInstruction(`Road route unavailable for ${nextDestination.name}`)
      console.error(error)
    } finally {
      if (routeRequest.current === requestId) setIsRouting(false)
    }
  }, [destination, routeMode, userPos, vehicle])

  const handleNavigationUpdate = useCallback((pos) => {
    if (!routeData?.geometry?.length) return

    let minDist = Infinity
    let nearestIdx = 0
    routeData.geometry.forEach((point, index) => {
      const dist = metersBetween(pos, [point.lat, point.lng])
      if (dist < minDist) {
        minDist = dist
        nearestIdx = index
      }
    })

    const progress = Math.round((nearestIdx / Math.max(routeData.geometry.length - 1, 1)) * 100)
    const remaining = destination ? metersBetween(pos, [destination.lat, destination.lon]) : 0
    const nextStep = [...(routeData.steps || [])].reverse().find((step) => step.geometry_index <= nearestIdx + 4)
    const nearbyHazard = (routeData.all_hazards || [])
      .map((hazard) => ({ ...hazard, distance_m: metersBetween(pos, [hazard.latitude, hazard.longitude]) }))
      .filter((hazard) => hazard.distance_m <= selectedVehicle.warningMeters)
      .sort((a, b) => a.distance_m - b.distance_m)[0]

    const hazardInstruction = nearbyHazard
      ? `${nearbyHazard.is_critical ? 'Severe ' : ''}${(nearbyHazard.type || 'road damage').toLowerCase()} in ${Math.round(nearbyHazard.distance_m)}m. Slow to ${selectedVehicle.safeSpeed} km/h.`
      : ''

    const nextInstruction = remaining < 45
      ? 'You have arrived'
      : hazardInstruction || (minDist > 80
        ? 'You are off the road route. Recalculate from your live location.'
        : nextStep?.instruction || 'Continue on the highlighted road route')

    setNavProgress(progress)
    setCurrentInstruction((previous) => {
      if (previous !== nextInstruction) speak(nextInstruction)
      return nextInstruction
    })
  }, [destination, routeData, selectedVehicle, speak])

  useEffect(() => {
    if (!('geolocation' in navigator)) return

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextPos = [position.coords.latitude, position.coords.longitude]
        setUserPos(nextPos)
        setLocationStatus(`Live location active, accuracy ${Math.round(position.coords.accuracy)}m`)
        if (isNavigating) handleNavigationUpdate(nextPos)
      },
      () => setLocationStatus('Allow location access to start from your live position.'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 }
    )

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    }
  }, [handleNavigationUpdate, isNavigating])

  const handleSearch = async () => {
    const query = destSearch.trim()
    if (!query) return

    setIsSearching(true)
    setMessage('')
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`)
      const data = await response.json()
      setSearchResults(data || [])
      setShowResults(true)
      if (!data?.length) setMessage('No destination found. Try a more specific place name.')
    } catch {
      setMessage('Search failed. Check your internet connection and try again.')
    } finally {
      setIsSearching(false)
    }
  }

  const selectDestination = (item) => {
    const nextDestination = {
      lat: Number(item.lat),
      lon: Number(item.lon),
      name: item.name || item.display_name.split(',')[0],
      address: item.display_name
    }

    if (Number.isNaN(nextDestination.lat) || Number.isNaN(nextDestination.lon)) return

    setDestination(nextDestination)
    setDestSearch(nextDestination.name)
    setShowResults(false)
    setSearchResults([])
    setIsNavigating(false)
    calculateRoute(nextDestination, userPos)
  }

  const clearDestination = () => {
    setDestination(null)
    setDestSearch('')
    setRouteData(null)
    setSearchResults([])
    setShowResults(false)
    setIsNavigating(false)
    setCurrentInstruction('Choose a destination')
    setMessage('')
    setNavProgress(0)
    setIsFollowingUser(true)
  }

  const changeVehicle = (nextVehicle) => {
    setVehicle(nextVehicle)
    if (destination) calculateRoute(destination, userPos, nextVehicle, routeMode)
  }

  const changeRouteMode = (nextRouteMode) => {
    setRouteMode(nextRouteMode)
    if (destination) calculateRoute(destination, userPos, vehicle, nextRouteMode)
  }

  const googleMapsUrl = routeData?.google_maps_url || (
    destination
      ? `https://www.google.com/maps/dir/?api=1&origin=${userPos[0]},${userPos[1]}&destination=${destination.lat},${destination.lon}&travelmode=driving`
      : ''
  )

  return (
    <div className="route-screen">
      <NavigationMap
        userPos={userPos}
        destPos={destination ? [destination.lat, destination.lon] : null}
        routeData={routeData}
        onMapClick={(lat, lon) => {
          const pinnedDestination = { lat, lon, name: 'Pinned destination', address: `${lat.toFixed(5)}, ${lon.toFixed(5)}` }
          setDestination(pinnedDestination)
          setDestSearch(pinnedDestination.name)
          setIsNavigating(false)
          calculateRoute(pinnedDestination, userPos)
        }}
        isFollowingUser={isFollowingUser}
        setIsFollowingUser={setIsFollowingUser}
        isNavigating={isNavigating}
      />

      <div className="route-search-shell">
        <div className="route-search-card">
          <div className="route-location-row">
            <LocateFixed size={16} />
            <span>{locationStatus}</span>
          </div>
          <div className="route-search-row">
            <MapPin size={20} />
            <input
              type="text"
              value={destSearch}
              onChange={(event) => setDestSearch(event.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
              placeholder="Search destination"
              aria-label="Search destination"
            />
            {destSearch && (
              <button type="button" className="route-icon-btn" onClick={clearDestination} aria-label="Clear destination">
                <X size={18} />
              </button>
            )}
            <button type="button" className="route-search-btn" onClick={handleSearch} aria-label="Search">
              {isSearching ? <span className="route-spinner" /> : <Search size={20} />}
            </button>
          </div>

          <div className="route-option-groups">
            <div className="route-choice-row" aria-label="Route mode">
              {ROUTE_MODES.map((mode) => {
                const Icon = mode.icon
                return (
                  <button
                    type="button"
                    key={mode.id}
                    className={routeMode === mode.id ? 'active' : ''}
                    onClick={() => changeRouteMode(mode.id)}
                  >
                    <Icon size={15} />
                    <span>{mode.label}</span>
                  </button>
                )
              })}
            </div>
            <div className="route-choice-row" aria-label="Vehicle type">
              {VEHICLES.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={vehicle === item.id ? 'active' : ''}
                    onClick={() => changeVehicle(item.id)}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {showResults && searchResults.length > 0 && (
          <div className="route-results">
            {searchResults.map((item) => (
              <button type="button" key={`${item.place_id}-${item.lat}`} onClick={() => selectDestination(item)}>
                <strong>{item.name || item.display_name.split(',')[0]}</strong>
                <span>{item.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {message && (
        <div className="route-message">
          <AlertCircle size={16} />
          <span>{message}</span>
        </div>
      )}

      {(destination || isNavigating) && (
        <div className="route-bottom-sheet">
          <div>
            <p>{isNavigating ? 'Live navigation' : isRouting ? 'Calculating road route' : `${selectedMode.label} route for ${selectedVehicle.label}`}</p>
            <h3>{currentInstruction}</h3>
            {destination && <span>{destination.address}</span>}
          </div>

          {routeData && (
            <div className="route-summary">
              <div>
                <strong>{routeData.distance_km ?? '--'} km</strong>
                <span>Distance</span>
              </div>
              <div>
                <strong>{routeData.adjusted_travel_min ? `${routeData.adjusted_travel_min} min` : '--'}</strong>
                <span>ETA</span>
              </div>
              <div>
                <strong>{routeData.hazards_on_route ?? 0}</strong>
                <span>Hazards</span>
              </div>
              <div>
                <strong>{routeData.road_quality_score ? `${routeData.road_quality_score}/5` : '--'}</strong>
                <span>Quality</span>
              </div>
            </div>
          )}

          {routeData?.estimated_delay_min > 0 && (
            <div className="route-delay-note">
              Damage avoidance adds about {routeData.estimated_delay_min} min.
            </div>
          )}

          {isNavigating && (
            <div className="route-progress">
              <span style={{ width: `${navProgress}%` }} />
            </div>
          )}

          <div className="route-actions">
            {googleMapsUrl && (
              <a href={googleMapsUrl} target="_blank" rel="noreferrer">
                Open in Maps
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                if (isNavigating) {
                  setIsNavigating(false)
                  setCurrentInstruction(destination ? `Route preview to ${destination.name}` : 'Choose a destination')
                } else if (routeData) {
                  setIsNavigating(true)
                  setIsFollowingUser(true)
                  speak('Navigation started. Follow the highlighted road route.')
                }
              }}
              disabled={!routeData || isRouting}
            >
              {isNavigating ? <Square size={18} /> : <Play size={18} />}
              {isNavigating ? 'End' : 'Start'}
            </button>
          </div>
        </div>
      )}

      {!destination && (
        <div className="route-empty-hint">
          <Navigation size={18} />
          <span>Search a destination or tap the map. Routes now follow actual roads for vehicle navigation.</span>
        </div>
      )}
    </div>
  )
}
