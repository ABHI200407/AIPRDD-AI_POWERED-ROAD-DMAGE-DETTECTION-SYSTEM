import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from 'recharts'
import {
  Map, List, TrendingUp, Users, DollarSign, Thermometer,
  Shield, Plane, RefreshCw, CheckCircle, Clock, Route, History, Zap, AlertTriangle, Bot
} from 'lucide-react'
import HeatmapTab from './HeatmapTab'
import RepairRouteTab from './RepairRouteTab'
import MaintenanceHistoryTab from './MaintenanceHistoryTab'
import AdversarialCenter from './AdversarialCenter'
import GovCommandCenter from './GovCommandCenter'
import GovOperationsMap from './GovOperationsMap'
import { apiFetch, getWebSocketUrl } from './api'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('command')
  const [tickets, setTickets] = useState([])
  const [crews, setCrews] = useState([])
  const [sla, setSla] = useState(null)
  const [budget, setBudget] = useState(null)
  const [fraud, setFraud] = useState(null)
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState({})
  const [droneSurveyResult, setDroneSurveyResult] = useState(null)
  
  // Tier-1: Live Activity & Security
  const [liveActivities, setLiveActivities] = useState([])
  const [securityAlerts, setSecurityAlerts] = useState(0)

  const setLoad = (key, val) => setLoading(l => ({ ...l, [key]: val }))

  const fetchTickets = async () => {
    setLoad('tickets', true)
    try { const r = await apiFetch('/tickets'); const d = await r.json(); setTickets(d.data) } catch {}
    setLoad('tickets', false)
  }

  const fetchCrews = async () => {
    try { const r = await apiFetch('/crews'); const d = await r.json(); setCrews(d.data) } catch {}
  }

  const fetchSla = async () => {
    try { const r = await apiFetch('/sla'); const d = await r.json(); setSla(d) } catch {}
  }

  const fetchBudget = async () => {
    try { const r = await apiFetch('/budget'); const d = await r.json(); setBudget(d) } catch {}
  }

  const fetchFraud = async () => {
    try { const r = await apiFetch('/fraud'); const d = await r.json(); setFraud(d) } catch {}
  }

  const fetchWeather = async () => {
    try { const r = await apiFetch('/weather'); const d = await r.json(); setWeather(d) } catch {}
  }

  const runDbscan = async () => {
    setLoad('cluster', true)
    await apiFetch('/clusters/generate', { method: 'POST' })
    await fetchTickets()
    setLoad('cluster', false)
  }

  const autoDispatch = async () => {
    setLoad('dispatch', true)
    await apiFetch('/dispatch', { method: 'POST' })
    await fetchCrews()
    setLoad('dispatch', false)
  }

  const runDroneSurvey = async () => {
    setLoad('drone', true)
    const r = await apiFetch('/drone-survey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ center_lat: 19.076, center_lon: 72.877, radius_km: 3.0 })
    })
    const d = await r.json()
    setDroneSurveyResult(d)
    await fetchTickets()
    setLoad('drone', false)
  }

  useEffect(() => {
    fetchTickets(); fetchCrews(); fetchSla(); fetchBudget(); fetchFraud(); fetchWeather()

    const ws = new WebSocket(getWebSocketUrl('/ws'))
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'NEW_REPORT') {
          fetchTickets()
          setLiveActivities(prev => [{
            id: Date.now(),
            type: 'NEW_REPORT',
            text: `New hazard reported: ${data.report_id.substring(0, 8)}`,
            time: 'Just now'
          }, ...prev].slice(0, 10))
        } else if (data.type === 'SHADOW_VERIFICATION') {
          setLiveActivities(prev => [{
            id: Date.now(),
            type: 'FIX',
            text: `Shadow Verification: Pothole Resolved`,
            time: 'Just now'
          }, ...prev].slice(0, 10))
          fetchTickets()
        }
      } catch (e) {}
    }
    return () => ws.close()
  }, [])

  const predictionData = [
    { road: 'Hwy 4', risk: 85 }, { road: 'Main St', risk: 60 },
    { road: 'School Rd', risk: 95 }, { road: 'Industrial', risk: 40 }, { road: 'River Rd', risk: 70 },
  ]

  const trendData = [
    { week: 'W1', reports: 12, resolved: 8 }, { week: 'W2', reports: 19, resolved: 14 },
    { week: 'W3', reports: 9, resolved: 11 }, { week: 'W4', reports: 24, resolved: 18 },
  ]

  const contractorPerformanceData = [
    { name: 'Contr. A', durability: 72, cost: 4500 },
    { name: 'Contr. B', durability: 94, cost: 6200 },
    { name: 'Contr. C', durability: 88, cost: 5100 },
    { name: 'Contr. D', durability: 65, cost: 3800 },
  ]

  const navItems = [
    { id: 'command',  icon: Bot,         label: 'AI Command Center', section: 'Control' },
    { id: 'queue',    icon: List,        label: 'Priority Queue',   section: 'Operations' },
    { id: 'map',      icon: Map,         label: 'Cluster Map',      section: null },
    { id: 'heatmap',  icon: Thermometer, label: 'Damage Heatmap',   section: null },
    { id: 'route',    icon: Route,       label: 'Repair Route',     section: null },
    { id: 'history',  icon: History,     label: 'Maintenance Log',  section: null },
    { id: 'dispatch', icon: Users,       label: 'Crew Dispatch',    section: null },
    { id: 'drone',    icon: Plane,       label: 'Drone Inspection', section: null },
    { id: 'analytics',icon: TrendingUp,  label: 'Analytics',        section: 'Intelligence' },
    { id: 'predictive',icon: Clock,      label: 'Predictive Maint.',section: null },
    { id: 'sla',      icon: Clock,       label: 'SLA Monitor',      section: null },
    { id: 'adversarial', icon: Shield,   label: 'Adversarial Center', section: 'Security' },
    { id: 'fraud',    icon: Shield,      label: 'Fraud Detection',  section: null },
    { id: 'budget',   icon: DollarSign,  label: 'Budget',           section: null },
    { id: 'transparency',icon: Shield,   label: 'Transparency',     section: 'Public' },
  ]

  let lastSection = null

  return (
    <div className="dashboard-layout">
      {/* ─── SIDEBAR ─── */}
      <aside className="sidebar">
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ color: 'var(--primary)', fontSize: '1.4rem' }}>GovDash AI</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>Infrastructure Control</p>
        </div>

        <nav style={{ flex: 1 }}>
          {navItems.map(item => {
            const sectionHeader = item.section && item.section !== lastSection
              ? (lastSection = item.section, <div key={`sec-${item.section}`} className="nav-section-label" style={{ marginTop: 24 }}>{item.section}</div>)
              : null
            return (
              <div key={item.id}>
                {sectionHeader}
                <button onClick={() => setActiveTab(item.id)} className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}>
                  <item.icon size={16} /> {item.label}
                </button>
              </div>
            )
          })}
        </nav>

        {/* Live Activity Sidebar Section */}
        <div className="glass p-5 mt-8 flex flex-col gap-4 overflow-hidden" style={{ minHeight: '240px' }}>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-amber-400 animate-pulse" />
            <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-300">Live Activity</h4>
          </div>
          <div className="flex flex-col gap-4">
            {liveActivities.length === 0 && <p className="text-[10px] text-slate-500 italic font-bold">Awaiting network signals...</p>}
            {liveActivities.map(act => (
              <div key={act.id} className="flex flex-col gap-1 border-l-2 border-sky-500/30 pl-3">
                <span className="text-[11px] text-white font-bold leading-tight">{act.text}</span>
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-tighter">{act.time}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ─── MAIN ─── */}
      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 }}>
          <div>
            <h1 style={{ fontSize: '2.2rem' }}>
              { {
                queue:'Priority Queue',
                command:'AI Command Center',
                map:'Cluster Map',
                heatmap:'Damage Heatmap',
                route:'Smart Repair Route',
                history:'Maintenance Log',
                dispatch:'Crew Dispatch',
                drone:'Drone Inspection',
                analytics:'System Analytics',
                predictive:'Predictive Maint.',
                sla:'SLA Monitor',
                adversarial:'Adversarial Defense',
                fraud:'Fraud Detection',
                budget:'Budget Management',
                transparency:'Transparency Portal'
              }[activeTab] }
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: '1rem' }}>Tier-1 Self-Healing Engine Status: Operational</p>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div className="metric-card">
              <div className="label">Open Tickets</div>
              <div className="value">{tickets.length}</div>
            </div>
            {budget && (
              <div className="metric-card">
                <div className="label">Budget Used</div>
                <div className="value" style={{ color: budget.burn_rate_percent > 70 ? 'var(--danger)' : 'var(--warning)' }}>
                  {budget.burn_rate_percent}%
                </div>
              </div>
            )}
          </div>
        </header>

        {activeTab === 'adversarial' && <AdversarialCenter />}

        {activeTab === 'command' && (
          <GovCommandCenter
            tickets={tickets}
            crews={crews}
            budget={budget}
            sla={sla}
            fraud={fraud}
            weather={weather}
            loading={loading}
            onRunDbscan={runDbscan}
            onAutoDispatch={autoDispatch}
            onRunDroneSurvey={runDroneSurvey}
          />
        )}

        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div className="grid grid-cols-2 gap-4">
              <div className="glass p-8">
                <h3 className="mb-6 text-slate-400 uppercase text-[10px] tracking-[0.2em] font-black">Material Lifecycle (Avg. Durability)</h3>
                <div style={{ height: 350 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={contractorPerformanceData}>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={14} fontWeight={700} dy={10} />
                      <YAxis stroke="#64748b" fontSize={14} fontWeight={700} />
                      <Tooltip 
                        contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                        cursor={{ fill: 'rgba(56,189,248,0.05)' }}
                      />
                      <Bar dataKey="durability" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="glass p-8">
                <h3 className="mb-6 text-slate-400 uppercase text-[10px] tracking-[0.2em] font-black">Contractor Cost per Unit ($)</h3>
                <div style={{ height: 350 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={contractorPerformanceData}>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={14} fontWeight={700} dy={10} />
                      <YAxis stroke="#64748b" fontSize={14} fontWeight={700} />
                      <Tooltip 
                        contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                        cursor={{ fill: 'rgba(139,92,246,0.05)' }}
                      />
                      <Bar dataKey="cost" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div className="flex items-center gap-3">
                <List size={20} className="text-primary" />
                <h3>Live Master Tickets</h3>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={fetchTickets} className="btn-secondary">
                  <RefreshCw size={14} className={loading.tickets ? 'spin' : ''} /> Refresh
                </button>
                <button onClick={runDbscan} className="btn-primary" disabled={loading.cluster}>
                  {loading.cluster ? <RefreshCw size={14} className="spin" /> : <TrendingUp size={14} />} Run AI DBSCAN
                </button>
              </div>
            </div>
            <table className="data-table">
              <thead><tr>
                <th>Ticket ID</th><th>Coordinates</th><th>Severity</th><th>AI Score</th><th>Duplicates</th><th>Status</th>
              </tr></thead>
              <tbody>
                {tickets.length === 0 && (
                  <tr><td colSpan="6" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No tickets yet. Waiting for live telemetry signals...
                  </td></tr>
                )}
                {tickets.map(t => (
                  <tr key={t.ticket_id}>
                    <td style={{ fontWeight: 800, fontFamily: 'monospace', color: 'var(--primary)' }}>{t.ticket_id.slice(0, 8)}</td>
                    <td className="text-slate-400">{t.latitude?.toFixed(4)}, {t.longitude?.toFixed(4)}</td>
                    <td>
                      <div className="flex gap-1 text-amber-400">
                        {'★'.repeat(Math.round(t.base_severity || 0))}
                      </div>
                    </td>
                    <td style={{ fontWeight: 800, color: t.priority_score > 80 ? 'var(--danger)' : 'var(--warning)' }}>
                      {t.priority_score?.toFixed(1)}
                    </td>
                    <td>{t.duplicate_count}</td>
                    <td><span className={`badge ${t.status === 'OPEN' ? 'badge-critical' : t.status === 'IN_PROGRESS' ? 'badge-warning' : 'badge-success'}`}>{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'map' && (
          <GovOperationsMap
            tickets={tickets}
            crews={crews}
            onRunDbscan={runDbscan}
            onAutoDispatch={autoDispatch}
            loading={loading}
          />
        )}

        {false && activeTab === 'map' && (
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden', height: 650 }}>
            <MapContainer center={[19.076, 72.877]} zoom={12} style={{ height: '100%', width: '100%' }}>
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Dark Matter">
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="CartoDB" />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Street">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="OSM" />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Satellite">
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Esri" />
                </LayersControl.BaseLayer>
              </LayersControl>
              {tickets.map(t => (
                <CircleMarker key={t.ticket_id} center={[t.latitude, t.longitude]}
                  radius={t.priority_score > 80 ? 14 : t.priority_score > 50 ? 10 : 7}
                  pathOptions={{ color: t.priority_score > 80 ? '#f43f5e' : t.priority_score > 50 ? '#fbbf24' : '#10b981', fillOpacity: 0.7, weight: 2 }}>
                  <Popup>
                    <div style={{ color: 'white' }}>
                      <strong>Score: {t.priority_score?.toFixed(1)}</strong><br />
                      Status: {t.status}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        )}

        {activeTab === 'heatmap' && <HeatmapTab />}
        {activeTab === 'route' && <RepairRouteTab />}
        {activeTab === 'history' && <MaintenanceHistoryTab tickets={tickets} />}

        {activeTab === 'dispatch' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24, gap: 12 }}>
              <button onClick={autoDispatch} className="btn-primary" disabled={loading.dispatch}>
                {loading.dispatch ? <RefreshCw size={14} className="spin" /> : <Users size={14} />} Auto-Dispatch Optimized Crews
              </button>
            </div>
            <div className="grid grid-cols-3 gap-24">
              {crews.map(({ crew, clusters, total_hours }) => (
                <div key={crew.id} className="glass-card">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h4 className="text-lg">{crew.name}</h4>
                      <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">{crew.specialty}</p>
                    </div>
                    <span className={`badge ${clusters.length > 0 ? 'badge-warning' : 'badge-success'}`}>
                      {clusters.length > 0 ? 'Active' : 'Standby'}
                    </span>
                  </div>
                  <div className="mb-6">
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-slate-400">Workload</span>
                      <span className="text-primary">{clusters.length} Jobs ({total_hours?.toFixed(1)}h)</span>
                    </div>
                    <div className="progress-bar-track" style={{ height: 4, background: '#1e293b' }}>
                      <div className="progress-bar-fill" style={{ 
                        width: `${Math.min(100, (clusters.length / crew.capacity) * 100)}%`, 
                        background: clusters.length >= crew.capacity ? 'var(--danger)' : 'var(--primary)',
                        height: '100%'
                      }} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {clusters.slice(0, 2).map(c => (
                      <div key={c} className="text-[10px] bg-slate-800/50 p-2 rounded border border-white/5 text-slate-300">
                        • Cluster {c?.slice(0, 8)}
                      </div>
                    ))}
                    {clusters.length > 2 && <div className="text-[10px] text-center text-slate-500">+{clusters.length - 2} more...</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'drone' && (
          <div className="glass-card text-center py-24">
            <Plane size={64} className="mx-auto text-primary mb-6 animate-pulse" />
            <h2 className="text-3xl mb-4">Autonomous Drone Survey</h2>
            <p className="text-slate-400 max-w-md mx-auto mb-12">
              Launch a simulated 3km radius AI-driven aerial survey to detect potholes and road damage automatically.
            </p>
            <button onClick={runDroneSurvey} className="btn-primary" style={{ padding: '16px 48px', borderRadius: '99px' }} disabled={loading.drone}>
              {loading.drone ? <><RefreshCw size={20} className="spin" /> Scanning Terrain...</> : 'Launch AI Survey Drone'}
            </button>
            {droneSurveyResult && (
              <div className="mt-12 text-emerald-400 font-bold animate-bounce">
                ✅ Survey Complete: {droneSurveyResult.detected_count} new hazards synced to Priority Queue.
              </div>
            )}
          </div>
        )}

        {activeTab === 'predictive' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="glass-card">
              <h3>Failure Prediction Calendar</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginTop: 20 }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>{d}</div>
                ))}
                {Array.from({ length: 31 }).map((_, i) => {
                  const risk = i % 7 === 0 ? 'high' : i % 5 === 0 ? 'med' : 'low'
                  return (
                    <div key={i} style={{ height: 60, background: 'var(--bg-elevated)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', border: '1px solid var(--glass-border)' }}>
                      <span style={{ fontSize: '0.8rem' }}>{i + 1}</span>
                      {risk !== 'low' && (
                        <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%', background: risk === 'high' ? 'var(--danger)' : 'var(--warning)' }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="glass-card">
              <h3>Upcoming Preventive Actions</h3>
              {[
                { road: 'Airport Link', action: 'Seal Coating', due: '3 days', cost: '₹45,000' },
                { road: 'Central Mall Rd', action: 'Resurfacing', due: '12 days', cost: '₹2,10,000' },
                { road: 'Old Town Lane', action: 'Patchwork', due: '5 days', cost: '₹12,000' },
              ].map(p => (
                <div key={p.road} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--glass-border)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.road}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Action: {p.action}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--warning)', fontWeight: 700 }}>Due in {p.due}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Est. {p.cost}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sla' && sla && (
          <div>
            <div className="metric-grid">
              <div className="metric-card"><div className="label">Compliance Rate</div><div className="value" style={{ color: sla.compliance_rate > 80 ? 'var(--success)' : 'var(--danger)' }}>{sla.compliance_rate}%</div></div>
              <div className="metric-card"><div className="label">SLA Breached</div><div className="value" style={{ color: 'var(--danger)' }}>{sla.breached.length}</div></div>
              <div className="metric-card"><div className="label">At Risk</div><div className="value" style={{ color: 'var(--warning)' }}>{sla.at_risk.length}</div></div>
              <div className="metric-card"><div className="label">On Track</div><div className="value" style={{ color: 'var(--success)' }}>{sla.on_track.length}</div></div>
            </div>
            <div className="glass-card">
              <h3 style={{ marginBottom: 16 }}>Breached & At-Risk Tickets</h3>
              <table className="data-table">
                <thead><tr><th>Ticket ID</th><th>Severity</th><th>SLA Status</th><th>Hours Remaining</th></tr></thead>
                <tbody>
                  {[...sla.breached, ...sla.at_risk].length === 0 && (
                    <tr><td colSpan="4" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>All SLAs on track 🎉</td></tr>
                  )}
                  {[...sla.breached, ...sla.at_risk].map(t => (
                    <tr key={t.ticket_id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{t.ticket_id.slice(0,8)}…</td>
                      <td>Severity {t.severity}</td>
                      <td><span className={`badge ${t.sla_status === 'BREACHED' ? 'badge-critical' : t.sla_status === 'WARNING' ? 'badge-warning' : 'badge-success'}`}>{t.sla_status}</span></td>
                      <td style={{ color: t.hours_remaining < 0 ? 'var(--danger)' : 'var(--warning)', fontWeight: 700 }}>
                        {t.hours_remaining < 0 ? `${Math.abs(t.hours_remaining).toFixed(0)}h overdue` : `${t.hours_remaining.toFixed(1)}h left`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'fraud' && fraud && (
          <div>
            <div className="metric-grid">
              <div className="metric-card"><div className="label">Flagged Reports</div><div className="value" style={{ color: 'var(--danger)' }}>{fraud.flagged_count}</div></div>
            </div>
            <div className="glass-card">
              <h3 style={{ marginBottom: 16 }}>Suspicious Reports</h3>
              <table className="data-table">
                <thead><tr><th>Report ID</th><th>User ID</th><th>Fraud Score</th><th>Flags</th></tr></thead>
                <tbody>
                  {fraud.data.length === 0 && (
                    <tr><td colSpan="4" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No suspicious activity detected ✅</td></tr>
                  )}
                  {fraud.data.map(f => (
                    <tr key={f.report_id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{f.report_id.slice(0,8)}…</td>
                      <td>{f.user_id}</td>
                      <td style={{ fontWeight: 700, color: f.fraud_score > 0.7 ? 'var(--danger)' : 'var(--warning)' }}>{(f.fraud_score * 100).toFixed(0)}%</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{f.flags.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'budget' && budget && (
          <div>
            <div className="metric-grid">
              <div className="metric-card">
                <div className="label">Total Budget</div>
                <div className="value">₹{(budget.total_budget_inr / 100000).toFixed(1)}L</div>
              </div>
              <div className="metric-card">
                <div className="label">Spent</div>
                <div className="value" style={{ color: 'var(--danger)' }}>₹{(budget.spent_inr / 100000).toFixed(1)}L</div>
              </div>
              <div className="metric-card">
                <div className="label">Remaining</div>
                <div className="value" style={{ color: 'var(--success)' }}>₹{(budget.remaining_inr / 100000).toFixed(1)}L</div>
              </div>
              <div className="metric-card">
                <div className="label">Repairs Done</div>
                <div className="value">{budget.repairs_completed}</div>
              </div>
            </div>
            <div className="glass-card">
              <h3 style={{ marginBottom: 16 }}>Budget Burn Rate</h3>
              <div className="progress-bar-track" style={{ height: 12 }}>
                <div className="progress-bar-fill" style={{ width: `${budget.burn_rate_percent}%`, background: budget.burn_rate_percent > 80 ? 'var(--danger)' : 'linear-gradient(90deg, #8b5cf6, #7c3aed)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>{budget.burn_rate_percent}% used</span>
                <span>Avg ₹{budget.average_cost_per_repair.toLocaleString()} / repair</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transparency' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="metric-grid">
              <div className="metric-card"><div className="label">Citizen Satisfaction</div><div className="value" style={{ color: 'var(--success)' }}>4.2/5</div></div>
              <div className="metric-card"><div className="label">Public Trust Index</div><div className="value">88%</div></div>
              <div className="metric-card"><div className="label">Transparency Score</div><div className="value">A+</div></div>
            </div>
            <div className="glass-card">
              <h3>Public Spending Transparency</h3>
              <div style={{ marginTop: 20 }}>
                {[
                  { ward: 'Ward 4 (North)', budget: '₹12.5L', spent: '₹11.2L', status: 'On Track' },
                  { ward: 'Ward 12 (Central)', budget: '₹25.0L', spent: '₹24.8L', status: 'Warning' },
                  { ward: 'Ward 7 (West)', budget: '₹18.2L', spent: '₹9.4L', status: 'Under' },
                ].map(w => (
                  <div key={w.ward} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 600 }}>{w.ward}</span>
                      <span className={`badge ${w.status === 'Warning' ? 'badge-warning' : 'badge-success'}`}>{w.status}</span>
                    </div>
                    <div className="progress-bar-track">
                      <div className="progress-bar-fill" style={{ width: `${(parseFloat(w.spent.replace('₹','').replace('L','')) / parseFloat(w.budget.replace('₹','').replace('L',''))) * 100}%`, background: w.status === 'Warning' ? 'var(--danger)' : 'var(--primary-accent)' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      <span>Spent: {w.spent}</span>
                      <span>Total: {w.budget}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
