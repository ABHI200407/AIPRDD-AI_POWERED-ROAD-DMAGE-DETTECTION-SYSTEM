import { useState } from 'react'
import { MapPin, Bell, Clock, Star, TrendingUp, AlertCircle } from 'lucide-react'

const MOCK_COMMUTES = [
  { id: '1', name: 'Work Route', from: 'Home', to: 'Business District', hazards: 2, lastChecked: '10 mins ago', status: 'WARNING' },
  { id: '2', name: 'School Drop', from: 'Home', to: 'Sunshine Academy', hazards: 0, lastChecked: '1 hour ago', status: 'CLEAR' },
]

export default function CommuteView() {
  const [commutes, setCommutes] = useState(MOCK_COMMUTES)
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Commute Monitoring</h3>
        <button className="badge-chip" onClick={() => setShowAdd(!showAdd)} style={{ border: 'none', cursor: 'pointer' }}>
          + Track Route
        </button>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: -10 }}>
        Save your regular routes. We'll alert you if new road damage is reported before you leave.
      </p>

      {commutes.map(c => (
        <div key={c.id} className="glass" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{c.name}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 4 }}>{c.from} → {c.to}</div>
            </div>
            <span className={`badge ${c.status === 'CLEAR' ? 'badge-success' : 'badge-warning'}`}>
              {c.status}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                {c.hazards > 0 ? (
                  <><AlertCircle size={14} color="var(--warning)" /> {c.hazards} Hazards Reported</>
                ) : (
                  <><Star size={14} color="var(--success)" /> Road is Clear</>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last Scan</div>
              <div style={{ fontSize: '0.8rem', marginTop: 2 }}>{c.lastChecked}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn" style={{ flex: 1, padding: '8px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)' }}>
              <Clock size={14} /> Schedule Alerts
            </button>
            <button className="btn" style={{ flex: 1, padding: '8px', fontSize: '0.8rem', background: 'var(--primary)', color: 'white', border: 'none' }}>
              <TrendingUp size={14} /> Check Now
            </button>
          </div>
        </div>
      ))}

      <div className="glass" style={{ padding: 16, border: '1px dashed var(--glass-border)', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          💡 Tip: Set up "Morning Briefing" in Settings to get an automated report at 8:00 AM daily.
        </div>
      </div>
    </div>
  )
}
