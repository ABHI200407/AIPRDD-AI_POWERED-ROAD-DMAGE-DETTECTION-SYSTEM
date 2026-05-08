import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, useMap, ScaleControl, LayersControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import LoginView from './LoginView'
import Onboarding from './Onboarding'
import { useAuth } from './AuthContext'
import RewardsView from './RewardsView'
import DashcamView from './DashcamView'
import SentinelView from './SentinelView'
import SmartRouteView from './SmartRouteView'
import AdvancedMapView from './AdvancedMapView'
import PersonalDashboard from './PersonalDashboard'
import ZonesView from './ZonesView'
import LeaderboardView from './LeaderboardView'
import ClaimHelper from './ClaimHelper'
import CommuteView from './CommuteView'
import ARView from './ARView'
import { Map, Camera, User, AlertTriangle, CheckCircle, Upload, Mic, Clock, Star, Shield, Wifi, WifiOff, Navigation, Layout, Trophy, MapPin, FileText, Settings, X, Gift, LogIn, Play } from 'lucide-react'
import { API_BASE, fetchWithAuth, getWebSocketUrl } from './api'
import './App.css'

const API = API_BASE

// ─── OFFLINE QUEUE (IndexedDB-like via localStorage) ───────────────────────
const QUEUE_KEY = 'rd_offline_queue'
const getQueue = () => JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
const addToQueue = (report) => {
  const q = getQueue(); q.push({ ...report, _offline: true, _id: Date.now() }); localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}
const clearQueue = () => localStorage.setItem(QUEUE_KEY, '[]')


// ─── BADGES CONFIG ──────────────────────────────────────────────────────────
const BADGES = [
  { id: 'newcomer',   name: 'Watcher Class',   icon: 'T1', minPts: 0 },
  { id: 'reporter',   name: 'Analyst Class',   icon: 'T2', minPts: 100 },
  { id: 'guardian',   name: 'Guardian Class',  icon: 'T3', minPts: 250 },
  { id: 'champion',   name: 'Expert Class',    icon: 'T4', minPts: 500 },
  { id: 'hero',       name: 'Elite Class',     icon: 'T5', minPts: 750 },
]

const getBadge = (pts) => [...BADGES].reverse().find(b => pts >= b.minPts) || BADGES[0]
const getNextBadge = (pts) => BADGES.find(b => pts < b.minPts) || null

const getCurrentReportLocation = () => new Promise((resolve) => {
  if (!('geolocation' in navigator)) {
    resolve({ latitude: 19.076, longitude: 72.877, accuracy_meters: null })
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => resolve({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy_meters: position.coords.accuracy
    }),
    () => resolve({ latitude: 19.076, longitude: 72.877, accuracy_meters: null }),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
  )
})

const MOCK_HAZARDS = [
  { id: 'h1', lat: 19.082, lon: 72.874, severity: 5, type: 'POTHOLE' },
  { id: 'h2', lat: 19.071, lon: 72.881, severity: 3, type: 'CRACK' },
  { id: 'h3', lat: 19.079, lon: 72.869, severity: 4, type: 'UNEVEN_SURFACE' },
  { id: 'h4', lat: 19.085, lon: 72.878, severity: 5, type: 'POTHOLE' },
  { id: 'h5', lat: 19.086, lon: 72.879, severity: 4, type: 'POTHOLE' },
  { id: 'h6', lat: 19.084, lon: 72.877, severity: 3, type: 'DEBRIS' },
]

const getHazardIcon = (type, severity) => {
  const color = severity >= 4 ? '#ef4444' : '#f59e0b'
  return L.divIcon({
    html: `<div class="w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center shadow-lg" style="border-color: ${color}">
            <div class="w-2.5 h-2.5 rounded-full" style="background: ${color}"></div>
          </div>`,
    className: 'hazard-marker-pro',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  })
}

function LocateButton() {
  const map = useMap()
  const handleLocate = () => {
    map.locate({ setView: true, maxZoom: 16 })
  }
  return (
    <div style={{ position: 'absolute', bottom: 80, right: 10, zIndex: 1000 }}>
      <button onClick={handleLocate} className="glass" style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid var(--primary)', background: 'rgba(0,0,0,0.6)', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)' }}>
        <MapPin size={22} />
      </button>
    </div>
  )
}

export default function App() {
  const { user, logout, loginAsGuest } = useAuth()
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('alive_onboarded'))
  
  const [activeTab, setActiveTab] = useState('map')
  const [activeSubTab, setActiveSubTab] = useState('main')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [offlineQueue, setOfflineQueue] = useState(getQueue())
  const [userPoints, setUserPoints] = useState(() => parseInt(localStorage.getItem('rd_points') || '40'))
  const [myReports, setMyReports] = useState(() => JSON.parse(localStorage.getItem('rd_reports') || '[]'))

  const [severity, setSeverity] = useState(3)
  const [damageType, setDamageType] = useState('POTHOLE')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitState, setSubmitState] = useState('idle')
  const [verifyTarget, setVerifyTarget] = useState(null)
  const [isDashcamOpen, setIsDashcamOpen] = useState(false)
  const [isSentinelOpen, setIsSentinelOpen] = useState(false)
  const [liveAlert, setLiveAlert] = useState(null)
  const [verificationReports, setVerificationReports] = useState([])
  const [verificationStatus, setVerificationStatus] = useState('Loading nearby reports...')

  const loadNearbyReports = useCallback(async () => {
    setVerificationStatus('Searching for nearby reports...')
    try {
      const loc = await getCurrentReportLocation()
      const radius = 0.05
      const params = new URLSearchParams({
        min_lat: String(loc.latitude - radius),
        max_lat: String(loc.latitude + radius),
        min_lon: String(loc.longitude - radius),
        max_lon: String(loc.longitude + radius),
      })
      const res = await fetchWithAuth(`${API}/reports?${params.toString()}`)
      const data = await res.json()
      const items = (data.data || []).filter(r => !r.is_flagged)
      setVerificationReports(items)
      setVerificationStatus(items.length ? `${items.length} reports nearby.` : 'No reports found nearby.')
    } catch {
      setVerificationStatus('Failed to load nearby reports.')
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'community') loadNearbyReports()
  }, [activeTab, loadNearbyReports])

  async function applyVerification(reportId, action) {
    try {
      await fetchWithAuth(`${API}/reports/${reportId}/${action}`, { method: 'POST' })
      loadNearbyReports()
    } catch {
      alert('Verification failed.')
    }
  }
  
  const handleOnboardingComplete = () => {
    localStorage.setItem('alive_onboarded', 'true')
    setShowOnboarding(false)
  }
  
  // Tier-1: Shadow Drive & AR State
  const [isShadowActive, setIsShadowActive] = useState(false)
  const [accelVariance, setAccelVariance] = useState(0.05)
  const [lastShadowFix, setLastShadowFix] = useState(null)

  useEffect(() => {
    if (!isShadowActive) return
    
    const handleMotion = (event) => {
      const { x, y, z } = event.accelerationIncludingGravity || { x: 0, y: 0, z: 0 }
      const variance = Math.sqrt(x*x + y*y + z*z) / 9.8 - 1 // Normalized variance
      setAccelVariance(Math.abs(variance))
      
      if (Math.abs(variance) > 0.75) {
        // High vibration detected — potentially a pothole!
        const now = Date.now()
        if (now - (lastShadowFix || 0) > 8000) { // 8-second throttle
          setLastShadowFix(now)
          handleAutoReport(variance)
        }
      }
    }

    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', handleMotion)
    } else {
      // Simulator Fallback for Desktop
      const interval = setInterval(() => {
        setAccelVariance(0.05 + Math.random() * 0.1)
      }, 500)
      return () => clearInterval(interval)
    }

    return () => window.removeEventListener('devicemotion', handleMotion)
  }, [isShadowActive])

  useEffect(() => {
    const socket = new WebSocket(getWebSocketUrl());
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'HAZARD_ALERT') {
        setLiveAlert(msg);
        setTimeout(() => setLiveAlert(null), 10000); // 10s warning
      }
    };
    return () => socket.close();
  }, [])

  const handleAutoReport = async (severityOrIntensity, forcedType = null) => {
    const isAi = forcedType !== null;
    console.log(isAi ? `🤖 AI_VISION: ${forcedType} detected. Logging...` : "🚀 SENSOR_IMU: Sudden impact detected. Auto-reporting...")
    
    const loc = await getCurrentReportLocation()
    const earned = isAi ? 20 : 15 
    
    const finalSeverity = isAi ? severityOrIntensity : (severityOrIntensity > 1.2 ? 5 : 3);
    const finalType = forcedType || 'UNEVEN_SURFACE';

    const report = {
      id: (isAi ? 'AI-' : 'IMU-') + Date.now(),
      type: finalType,
      severity: finalSeverity,
      lat: loc.latitude,
      lon: loc.longitude,
      submitted_at: new Date().toLocaleString(),
      status: navigator.onLine ? 'SUBMITTED' : 'QUEUED_OFFLINE',
      points: earned,
      source: isAi ? 'AI_VISION' : 'SENSOR_IMU'
    }

    if (navigator.onLine) {
      try {
        await fetchWithAuth(`${API}/reports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user?.id || 'anonymous',
            timestamp_captured: new Date().toISOString(),
            location: loc,
            assessment: { damage_type: finalType, ai_suggested_severity: finalSeverity },
            telemetry: isAi ? {} : { g_force_z: severityOrIntensity }
          })
        })
      } catch (e) {
        addToQueue(report)
      }
    } else {
      addToQueue(report)
    }

    // Update UI state
    setMyReports(prev => {
      const updated = [report, ...prev];
      localStorage.setItem('rd_reports', JSON.stringify(updated));
      return updated;
    });
    setUserPoints(prev => {
      const newPts = prev + earned;
      localStorage.setItem('rd_points', newPts);
      return newPts;
    });
  }

  useEffect(() => {
    const goOnline = () => { setIsOnline(true); syncOfflineQueue() }
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])

  const syncOfflineQueue = async () => {
    const queue = getQueue()
    if (queue.length === 0) return
    let synced = 0
    for (const report of queue) {
      const { _offline, _id, ...payload } = report
      try {
        await fetchWithAuth(`${API}/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        synced++
      } catch {}
    }
    if (synced > 0) { clearQueue(); setOfflineQueue([]) }
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const submitReport = async () => {
    setSubmitState('loading')
    const reportLocation = await getCurrentReportLocation()
    const payload = {
      user_id: 'citizen_user_001',
      timestamp_captured: new Date().toISOString(),
      location: reportLocation,
      assessment: { damage_type: damageType, user_confirmed_severity: severity }
    }

    try {
      if (isOnline) {
        const res = await fetchWithAuth(`${API}/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!res.ok) throw new Error()
      } else {
        addToQueue(payload)
        setOfflineQueue(getQueue())
      }

      const earned = severity >= 4 ? 25 : 10
      const newPts = userPoints + earned
      setUserPoints(newPts)
      localStorage.setItem('rd_points', newPts)

      const newReport = {
        id: Date.now(), type: damageType, severity, lat: reportLocation.latitude, lon: reportLocation.longitude,
        submitted_at: new Date().toLocaleString(), status: isOnline ? 'SUBMITTED' : 'QUEUED_OFFLINE', points: earned
      }
      const updated = [newReport, ...myReports]
      setMyReports(updated)
      localStorage.setItem('rd_reports', JSON.stringify(updated))

      setSubmitState('success')
      setTimeout(() => { setSubmitState('idle'); setPhotoPreview(null); setActiveTab('profile') }, 2000)
    } catch {
      setSubmitState('error')
      setTimeout(() => setSubmitState('idle'), 2000)
    }
  }

  const currentBadge = getBadge(userPoints)
  const nextBadge = getNextBadge(userPoints)
  const progress = nextBadge ? ((userPoints - (getBadge(userPoints - 1)?.minPts || 0)) / (nextBadge.minPts - (getBadge(userPoints - 1)?.minPts || 0))) * 100 : 100

  const DAMAGE_TYPES = ['POTHOLE', 'CRACK', 'DEBRIS', 'UNEVEN_SURFACE']

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  if (!user) {
    return <LoginView onGuest={loginAsGuest} />
  }

  return (
    <div className="app">
      {!isOnline && (
        <div className="offline-banner">
          <WifiOff size={12} style={{ display: 'inline', marginRight: 4 }} />
          Offline Mode — {offlineQueue.length} report(s) queued for sync
        </div>
      )}

      {activeTab !== 'map' && (
      <header className="glass px-6 py-4 flex justify-between items-center" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', background: 'rgba(15, 23, 42, 0.95)' }}>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl tracking-tighter text-white font-black">ROADSAFE<span className="text-primary">AI</span></h2>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Infrastructure Node v2.4.0</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isOnline ? 'Network Live' : 'Offline'}</span>
          </div>
          <div className="glass px-4 py-2 flex items-center gap-3 border-slate-700">
            <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary border border-primary/30">{currentBadge.icon}</div>
            <span className="text-xs font-black text-white">{userPoints} PTS</span>
          </div>
        </div>
      </header>
      )}

      <div className="content">
        {false && activeTab === 'route' && <SmartRouteView />}
        {activeTab === 'dashboard' && <PersonalDashboard myReports={myReports} />}
        {activeTab === 'zones' && <ZonesView />}
        {activeTab === 'leaderboard' && <LeaderboardView />}
        {activeTab === 'safety' && <ClaimHelper myReports={myReports} />}
        {activeTab === 'commute' && <CommuteView />}
        {false && activeTab === 'ar' && <ARView />}

        {activeTab === 'map' && (
          <AdvancedMapView myReports={myReports} onReport={() => setActiveTab('report')} />
        )}

        {false && activeTab === 'map' && (
          <div style={{ height: '100%', position: 'relative' }}>
            <MapContainer center={[19.076, 72.877]} zoom={14} style={{ height: '100%', width: '100%' }}>
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
              <ScaleControl position="bottomleft" />
              <LocateButton />
              
              <CircleMarker center={[19.076, 72.877]} radius={8} pathOptions={{ color: '#3b82f6', fillOpacity: 0.9, weight: 3 }}>
                <Popup><strong style={{ color: 'black' }}>📍 You are here</strong></Popup>
              </CircleMarker>

              <MarkerClusterGroup chunkedLoading>
                {MOCK_HAZARDS.map(h => (
                  <Marker key={h.id} position={[h.lat, h.lon]} icon={getHazardIcon(h.type, h.severity)}>
                    <Popup>
                      <div style={{ color: 'black', padding: '4px' }}>
                        <strong style={{ fontSize: '1.1rem' }}>{h.type.replace('_', ' ')}</strong><br />
                        <span style={{ color: h.severity >= 4 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                          Severity: {'★'.repeat(h.severity)}
                        </span>
                        <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                          Verified by 12 citizens
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            </MapContainer>

            <div style={{ position: 'absolute', top: 16, left: 12, right: 12, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="alert-bar alert-danger" style={{ backdropFilter: 'blur(10px)', background: 'rgba(239, 68, 68, 0.25)', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                <AlertTriangle size={16} /> <strong>Severe Hazard:</strong> Pothole detected 200m ahead on Main St.
              </div>
              <div className="alert-bar alert-info" style={{ backdropFilter: 'blur(10px)', background: 'rgba(59, 130, 246, 0.25)', border: '1px solid rgba(59, 130, 246, 0.4)' }} onClick={() => setActiveTab('commute')}>
                <Clock size={16} /> <strong>Morning Commute:</strong> 2 new reports on "Work Route". Tap to view.
              </div>
              
              {/* Shadow Drive HUD Overlay */}
              <div className="glass p-4 border-l-4 border-l-emerald-500 flex flex-col gap-3" style={{ minWidth: '300px' }}>
                <div className="flex justify-between items-center w-full">
                  <div className="flex items-center gap-3">
                    <Shield size={18} className={isShadowActive ? 'text-sky-400 animate-pulse' : 'text-slate-500'} />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-300">Shadow Drive Telemetry</span>
                  </div>
                  <button onClick={() => setIsShadowActive(!isShadowActive)} 
                    className={`badge ${isShadowActive ? 'badge-success' : 'badge-warning'}`}
                    style={{ cursor: 'pointer', border: 'none', padding: '6px 12px' }}>
                    {isShadowActive ? 'System Active' : 'Offline'}
                  </button>
                </div>
                {isShadowActive && (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-1.5 bg-slate-800/50 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-400 transition-all duration-300" style={{ width: `${Math.min(100, accelVariance * 500)}%` }}></div>
                    </div>
                    <span className="text-[10px] font-mono text-sky-400 font-bold" style={{ width: '60px', textAlign: 'right' }}>
                      {accelVariance.toFixed(3)} G
                    </span>
                  </div>
                )}
                {lastShadowFix && (
                  <div className="text-[10px] text-emerald-400 font-black uppercase tracking-tight animate-pulse flex items-center gap-2 mt-1">
                    <CheckCircle size={12} /> {lastShadowFix} — Zero-Click Sync Sent
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 100 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>New Road Report</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={() => setIsDashcamOpen(true)}
                  className="glass" 
                  style={{ background: 'rgba(56,189,248,0.1)', color: 'var(--primary)', border: '1px solid rgba(56,189,248,0.2)', padding: '8px 16px', borderRadius: 12, fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                >
                  <Play size={16} fill="currentColor" /> Dashcam
                </button>
                <button 
                  onClick={() => setIsSentinelOpen(true)}
                  className="glass" 
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', padding: '8px 16px', borderRadius: 12, fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                >
                  <Shield size={16} fill="currentColor" /> SENTINEL
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="glass" style={{ flex: 1, padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => { setSubmitState('loading'); setTimeout(() => { submitReport() }, 1500) }}>
                <Camera size={18} /> Quick Capture
              </button>
              <button className="glass" style={{ flex: 1, padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#a78bfa', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => { alert('Listening for: "Report Pothole"...') }}>
                <Mic size={18} /> Voice Report
              </button>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: '0.9rem' }}>1. Capture Photo</label>
              {!photoPreview ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <label style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 12px', cursor: 'pointer', borderRadius: 'var(--radius-md)', border: '2px dashed var(--glass-border)', background: 'rgba(255,255,255,0.02)', transition: 'var(--transition)' }}>
                    <Camera size={32} color="var(--primary)" />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Camera</div>
                    </div>
                    <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} style={{ display: 'none' }} />
                  </label>
                  <label style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 12px', cursor: 'pointer', borderRadius: 'var(--radius-md)', border: '2px dashed var(--glass-border)', background: 'rgba(255,255,255,0.02)', transition: 'var(--transition)' }}>
                    <Upload size={32} color="var(--text-secondary)" />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Gallery</div>
                    </div>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                  </label>
                </div>
              ) : (
                <div style={{ position: 'relative', width: '100%' }}>
                  <img src={photoPreview} alt="preview" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }} />
                  <button onClick={() => { setPhotoPreview(null); setPhotoFile(null) }} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', transition: 'var(--transition)' }}>
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: '0.9rem' }}>2. Damage Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {DAMAGE_TYPES.map(t => (
                  <button key={t} onClick={() => setDamageType(t)}
                    style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: `2px solid ${damageType === t ? 'var(--primary)' : 'var(--glass-border)'}`, background: damageType === t ? 'rgba(59,130,246,0.1)' : 'transparent', color: damageType === t ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'var(--transition)' }}>
                    {t.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: '0.9rem' }}>3. Severity Level</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onClick={() => setSeverity(s)}
                    className={`severity-btn ${severity === s ? `active s${s}` : ''}`}>
                    {s}
                  </button>
                ))}
              </div>
              <p style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {severity >= 4 ? '⚠️ High severity — earns bonus points!' : severity <= 2 ? 'Minor damage — still helps the community' : 'Moderate damage — important report'}
              </p>
            </div>
            <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Mic size={18} color="var(--primary)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Voice Note</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Say "Report pothole" hands-free</div>
              </div>
              <span className="badge-chip" style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>Plugin Ready 🔌</span>
            </div>
            <button
              className={`btn ${submitState === 'success' ? 'btn-success' : 'btn-blue'}`}
              onClick={submitReport}
              disabled={submitState === 'loading' || submitState === 'success'}
            >
              {submitState === 'loading' && '🔄 Processing AI…'}
              {submitState === 'success' && <><CheckCircle size={18} /> Reported! +{severity >= 4 ? 25 : 10} pts</>}
              {submitState === 'error' && '❌ Error — try again'}
              {submitState === 'idle' && (isOnline ? '📤 Submit Report' : '💾 Save Offline')}
            </button>
          </div>
        )}

        {activeTab === 'community' && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 100 }}>
            <div className="flex justify-between items-center">
              <h3>Community Verification</h3>
              <button onClick={loadNearbyReports} className="badge badge-info" style={{ border: 'none', cursor: 'pointer' }}>Refresh</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{verificationStatus}</p>
            {verificationReports.map(r => (
              <div key={r.report_id} className="glass" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{(r.damage_type || 'ROAD_DAMAGE').replace('_', ' ')}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 4 }}>
                      Severity {r.user_confirmed_severity || r.ai_suggested_severity || 3} • {r.verification_count || 0} confirmations
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button 
                    onClick={() => applyVerification(r.report_id, 'verify')}
                    style={{ flex: 1, padding: '9px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'rgba(56,189,248,0.1)', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                    ⚠️ Still There
                  </button>
                  <button 
                    onClick={() => applyVerification(r.report_id, 'fix-verify')}
                    style={{ flex: 1, padding: '9px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'rgba(16,185,129,0.1)', color: 'var(--success)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                    ✅ Fixed Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'profile' && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 100 }}>
            <div className="glass" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', border: '2px solid rgba(255,255,255,0.2)' }}>
                {currentBadge.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{currentBadge.name}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Citizen #4782 • {userPoints} pts</div>
              </div>
              <Settings size={20} color="var(--text-muted)" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { id: 'dashboard',   label: 'Impact Stats',  icon: Layout,      color: 'var(--primary)' },
                { id: 'zones',       label: 'My Zones',      icon: MapPin,      color: 'var(--warning)' },
                { id: 'leaderboard', label: 'Leaderboard',   icon: Trophy,      color: 'var(--success)' },
                { id: 'rewards',     label: 'Marketplace',   icon: Gift,        color: 'var(--primary)' },
                { id: 'commute',     label: 'Commutes',      icon: Clock,       color: '#3b82f6' },
                { id: 'safety',      label: 'Safety Claim',  icon: Shield,      color: 'var(--danger)' },
                { id: 'community',   label: 'Verification',  icon: CheckCircle, color: '#a78bfa' },
                { id: 'timeline',    label: 'My Timeline',   icon: Clock,       color: 'var(--text-secondary)' },
              ].map(action => (
                <button key={action.id} onClick={() => setActiveTab(action.id)}
                  className="glass" style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer', border: '1px solid var(--glass-border)', transition: 'var(--transition)' }}>
                  <div style={{ padding: 10, borderRadius: 12, background: `${action.color}15`, color: action.color }}>
                    <action.icon size={22} />
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{action.label}</span>
                </button>
              ))}
            </div>
            <div className="glass" style={{ padding: 16 }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: 12 }}>Notification Settings</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', marginBottom: 10 }}>
                <span>Morning Commute Briefing</span>
                <div style={{ width: 40, height: 20, borderRadius: 10, background: 'var(--primary)', position: 'relative' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', right: 2, top: 2 }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span>Urgent Hazard Proximity</span>
                <div style={{ width: 40, height: 20, borderRadius: 10, background: 'var(--primary)', position: 'relative' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', right: 2, top: 2 }} />
                </div>
              </div>
            </div>
            <button 
              onClick={logout}
              className="glass" 
              style={{ width: '100%', padding: '16px', marginTop: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#fca5a5', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(239, 68, 68, 0.05)' }}
            >
              <LogIn size={18} style={{ transform: 'rotate(180deg)' }} />
              Secure Logout
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10 }}>
              Member since Jan 2024 • Version 2.4.0
            </p>
          </div>
        )}

        {activeTab === 'rewards' && (
          <RewardsView points={userPoints} onRedeem={(cost) => {
            const newPts = userPoints - cost;
            setUserPoints(newPts);
            localStorage.setItem('rd_points', newPts);
          }} />
        )}

        {activeTab === 'timeline' && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 100 }}>
            <h3>My Reports Timeline</h3>
            {myReports.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No reports yet. Be the first to report in your area!</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {myReports.map(r => {
                const steps = ['SUBMITTED', 'VERIFIED', 'CREW_ASSIGNED', 'FIXED']
                const currentStep = steps.indexOf(r.status === 'QUEUED_OFFLINE' ? 'SUBMITTED' : r.status)
                return (
                  <div key={r.id} className="glass" style={{ padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{r.type.replace('_', ' ')}</span>
                        {r.status === 'QUEUED_OFFLINE' && <span className="badge-chip" style={{ marginLeft: 8 }}>Offline Queue</span>}
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>+{r.points} pts</span>
                    </div>
                    {steps.map((step, i) => (
                      <div key={step} className="timeline-step">
                        <div className={`timeline-dot ${i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending'}`}>
                          {i < currentStep ? '✓' : i + 1}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{step.replace('_', ' ')}</div>
                          {i === currentStep && <div style={{ fontSize: '0.78rem', color: 'var(--primary)', marginTop: 2 }}>Current status</div>}
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: 16, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Reported on {r.submitted_at}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {isDashcamOpen && (
        <DashcamView 
          onClose={() => setIsDashcamOpen(false)} 
          onDetect={(detection) => {
            handleAutoReport(detection.severity, detection.type);
          }} 
        />
      )}

      {isSentinelOpen && (
        <SentinelView 
          onClose={() => setIsSentinelOpen(false)} 
          onDetect={(detection) => {
             // Sentinel handles its own reporting for Elite features
          }} 
        />
      )}

      {activeTab !== 'map' && (
        <button className="fab" onClick={() => setActiveTab('report')}>
          <Camera size={26} />
        </button>
      )}

      <nav className="bottom-nav">
        {[
          { id: 'map',         icon: Map,        label: 'Road Map' },
          { id: 'dashboard',   icon: Layout,     label: 'Stats' },
          { id: 'leaderboard', icon: Trophy,     label: 'Top' },
          { id: 'profile',     icon: User,       label: 'Me' },
        ].map(tab => (
          <button key={tab.id} className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={20} />
            <span style={{ fontSize: '0.65rem', marginTop: 4 }}>{tab.label}</span>
          </button>
        ))}
        <div style={{ width: 64 }} />
      </nav>
    </div>
  )
}
