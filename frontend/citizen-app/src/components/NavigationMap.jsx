import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const ROUTE_BASE_LAYERS = {
  streets: {
    label: 'Map',
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

function MapController({ userPos, destPos, isFollowingUser, setIsFollowingUser, isNavigating, routeData, mapRef }) {
  const map = useMap()

  useEffect(() => {
    mapRef.current = map
  }, [map, mapRef])

  useMapEvents({
    dragstart() {
      if (isFollowingUser) setIsFollowingUser(false)
    }
  })

  useEffect(() => {
    if (!userPos) return

    if (isNavigating && isFollowingUser) {
      map.setView(userPos, 18, { animate: true })
      return
    }

    if (!isNavigating && routeData?.geometry?.length && destPos) {
      const bounds = L.latLngBounds(routeData.geometry.map((point) => [point.lat, point.lng]))
      bounds.extend(userPos)
      bounds.extend(destPos)
      map.fitBounds(bounds, { padding: [52, 52], maxZoom: 17, animate: true })
      return
    }

    if (!isNavigating && isFollowingUser) {
      map.setView(userPos, 16, { animate: true })
    }
  }, [destPos, isFollowingUser, isNavigating, map, routeData, userPos])

  return null
}

function MapClickHandler({ onMapClick, isNavigating }) {
  useMapEvents({
    click(event) {
      if (!isNavigating) onMapClick(event.latlng.lat, event.latlng.lng)
    }
  })
  return null
}

export default function NavigationMap({
  userPos,
  destPos,
  routeData,
  onMapClick,
  isFollowingUser,
  setIsFollowingUser,
  isNavigating
}) {
  const mapRef = useRef(null)
  const [baseLayer, setBaseLayer] = useState('streets')
  const activeLayer = ROUTE_BASE_LAYERS[baseLayer]
  const routePositions = useMemo(
    () => routeData?.geometry?.map((point) => [point.lat, point.lng]) || [],
    [routeData]
  )

  const userIcon = L.divIcon({
    html: '<div class="route-user-marker"><span></span></div>',
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  })

  const destinationIcon = L.divIcon({
    html: '<div class="route-destination-marker"><span></span></div>',
    className: '',
    iconSize: [30, 42],
    iconAnchor: [15, 40]
  })

  return (
    <div className="route-map">
      <MapContainer
        center={userPos}
        zoom={16}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
        aria-label="Live street navigation map"
      >
        <MapController
          userPos={userPos}
          destPos={destPos}
          isFollowingUser={isFollowingUser}
          setIsFollowingUser={setIsFollowingUser}
          isNavigating={isNavigating}
          routeData={routeData}
          mapRef={mapRef}
        />
        <MapClickHandler onMapClick={onMapClick} isNavigating={isNavigating} />
        <ZoomControl position="bottomright" />

        <TileLayer key={baseLayer} url={activeLayer.url} attribution={activeLayer.attribution} maxZoom={activeLayer.maxZoom} />
        {baseLayer === 'satellite' && (
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
            attribution="&copy; CARTO"
            maxZoom={20}
          />
        )}

        {routePositions.length > 0 && (
          <>
            <Polyline
              positions={routePositions}
              pathOptions={{ color: '#ffffff', weight: 10, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
            />
            <Polyline
              positions={routePositions}
              pathOptions={{ color: '#2563eb', weight: 6, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
            />
          </>
        )}

        {userPos && (
          <>
            <CircleMarker
              center={userPos}
              radius={isNavigating ? 28 : 18}
              pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.12, weight: 2 }}
            />
            <Marker position={userPos} icon={userIcon} zIndexOffset={1000} />
          </>
        )}

        {destPos && <Marker position={destPos} icon={destinationIcon} zIndexOffset={900} />}

        {(routeData?.all_hazards || []).map((hazard, index) => (
          <CircleMarker
            key={`${hazard.latitude}-${hazard.longitude}-${index}`}
            center={[hazard.latitude, hazard.longitude]}
            radius={hazard.is_critical ? 7 : 5}
            pathOptions={{
              color: hazard.is_critical ? '#dc2626' : '#f59e0b',
              fillColor: hazard.is_critical ? '#ef4444' : '#fbbf24',
              fillOpacity: 0.85,
              weight: 2
            }}
          />
        ))}
      </MapContainer>

      <div className="route-layer-switch">
        {Object.entries(ROUTE_BASE_LAYERS).map(([id, layer]) => (
          <button
            type="button"
            key={id}
            className={baseLayer === id ? 'active' : ''}
            onClick={() => setBaseLayer(id)}
          >
            {layer.label}
          </button>
        ))}
      </div>

      {!isFollowingUser && (
        <button
          type="button"
          className="route-recenter"
          onClick={() => {
            setIsFollowingUser(true)
            if (mapRef.current && userPos) mapRef.current.setView(userPos, isNavigating ? 18 : 16, { animate: true })
          }}
        >
          Recenter
        </button>
      )}
    </div>
  )
}
