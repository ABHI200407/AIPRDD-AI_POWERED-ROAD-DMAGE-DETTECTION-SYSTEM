import { useState } from 'react'
import { MapPin, Bell, BellOff, Home, Briefcase, GraduationCap, Plus } from 'lucide-react'

const DEFAULT_ZONES = [
  { id: 'home',   icon: Home,            label: 'Home Zone',      lat: 19.078, lon: 72.879, subscribed: true,  alerts: 2 },
  { id: 'work',   icon: Briefcase,       label: 'Work Zone',      lat: 19.063, lon: 72.862, subscribed: true,  alerts: 0 },
  { id: 'school', icon: GraduationCap,   label: 'School Zone',    lat: 19.090, lon: 72.891, subscribed: false, alerts: 5 },
]

export default function ZonesView() {
  const [zones, setZones] = useState(DEFAULT_ZONES)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')

  const toggle = (id) => {
    setZones(z => z.map(zone =>
      zone.id === id ? { ...zone, subscribed: !zone.subscribed } : zone
    ))
    if (navigator.vibrate) navigator.vibrate(50)
  }

  const addZone = () => {
    if (!newName.trim()) return
    setZones(z => [...z, {
      id: Date.now().toString(), icon: MapPin, label: newName,
      lat: 19.076 + Math.random() * 0.03, lon: 72.877 + Math.random() * 0.03,
      subscribed: true, alerts: 0
    }])
    setNewName('')
    setShowAdd(false)
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Neighborhood Watch</h3>
        <button onClick={() => setShowAdd(!showAdd)} className="btn" style={{ padding: '8px 14px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.85rem' }}>
          <Plus size={14} /> Add Zone
        </button>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: -10 }}>
        Subscribe to zones to get instant alerts when new road damage is reported nearby.
      </p>

      {showAdd && (
        <div className="glass" style={{ padding: 14 }}>
          <input
            placeholder="Zone name (e.g. Sister's School)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-base)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '10px', color: 'white', marginBottom: 10 }}
          />
          <button onClick={addZone} className="btn btn-blue" style={{ padding: '10px' }}>Add Zone</button>
        </div>
      )}

      {zones.map(zone => {
        const Icon = zone.icon
        return (
          <div key={zone.id} className="glass" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: zone.subscribed ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} color={zone.subscribed ? 'var(--primary)' : 'var(--text-muted)'} />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{zone.label}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    {zone.alerts > 0
                      ? <span style={{ color: 'var(--warning)' }}>⚠️ {zone.alerts} new alert{zone.alerts > 1 ? 's' : ''}</span>
                      : <span style={{ color: 'var(--success)' }}>✅ No new hazards</span>
                    }
                  </div>
                </div>
              </div>
              <button
                onClick={() => toggle(zone.id)}
                style={{ background: zone.subscribed ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${zone.subscribed ? 'rgba(59,130,246,0.3)' : 'var(--glass-border)'}`, borderRadius: 'var(--radius-pill)', padding: '6px 14px', cursor: 'pointer', color: zone.subscribed ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, transition: 'var(--transition)' }}
              >
                {zone.subscribed ? <><Bell size={12} /> On</> : <><BellOff size={12} /> Off</>}
              </button>
            </div>
          </div>
        )
      })}

      {/* How it works */}
      <div className="glass" style={{ padding: 14 }}>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 10 }}>How Neighborhood Watch Works</div>
        {[
          'A citizen reports damage in your zone',
          "AI verifies it's real (not spam)",
          'You get an instant push notification',
          'The zone alert counter updates',
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--primary)', fontWeight: 700, minWidth: 16 }}>{i + 1}.</span>
            <span style={{ color: 'var(--text-secondary)' }}>{step}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
