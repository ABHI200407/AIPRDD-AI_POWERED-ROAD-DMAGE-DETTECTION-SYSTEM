import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Star, Award, Clock, CheckCircle } from 'lucide-react'

// Mock trend data — replace with API calls
const TREND_DATA = [
  { week: 'W1', score: 2.1 }, { week: 'W2', score: 2.4 },
  { week: 'W3', score: 2.2 }, { week: 'W4', score: 3.0 },
  { week: 'W5', score: 3.3 }, { week: 'W6', score: 3.8 },
]

const maxScore = Math.max(...TREND_DATA.map(d => d.score))

export default function PersonalDashboard({ myReports, userPoints }) {
  const total = myReports.length
  const fixed = myReports.filter(r => r.status === 'FIXED').length
  const resolutionRate = total > 0 ? Math.round((fixed / total) * 100) : 0
  const peopleHelped = total * 26
  const savingsINR = total * 1200
  const cityRankPct = total > 5 ? 12 : total > 2 ? 25 : 40

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 100 }}>
      <h3>My Impact Dashboard</h3>

      {/* Impact hero */}
      <div className="glass" style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', fontWeight: 700, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {peopleHelped.toLocaleString()}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 6 }}>
          People helped avoid road damage
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>
          Based on your {total} verified report{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Stats grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-val" style={{ color: 'var(--success)' }}>{resolutionRate}%</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>Resolution Rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-val" style={{ color: 'var(--primary)' }}>Top {cityRankPct}%</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>City Rank</div>
        </div>
        <div className="stat-card">
          <div className="stat-val" style={{ color: 'var(--warning)' }}>₹{(savingsINR / 1000).toFixed(1)}K</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>Est. Savings</div>
        </div>
        <div className="stat-card">
          <div className="stat-val" style={{ color: 'var(--success)' }}>{fixed}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>Repairs Done</div>
        </div>
      </div>

      {/* Neighborhood trend chart */}
      <div className="glass" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h4>Neighborhood Road Quality Trend</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontSize: '0.82rem', fontWeight: 600 }}>
            <TrendingUp size={14} /> Improving
          </div>
        </div>
        {/* Simple SVG bar chart */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
          {TREND_DATA.map((d, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: '100%',
                height: `${(d.score / maxScore) * 64}px`,
                background: d.score >= 3.5 ? 'var(--success)' : d.score >= 2.5 ? 'var(--warning)' : 'var(--danger)',
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.6s ease'
              }} />
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{d.week}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <span>6 weeks ago</span>
          <span style={{ fontWeight: 600, color: 'var(--success)' }}>
            {TREND_DATA[TREND_DATA.length - 1].score}★ current
          </span>
        </div>
      </div>

      {/* Report timeline summary */}
      <div className="glass" style={{ padding: 16 }}>
        <h4 style={{ marginBottom: 14 }}>Recent Reports</h4>
        {myReports.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No reports yet. Hit the camera button to get started!</p>
        )}
        {myReports.slice(0, 4).map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--glass-border)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{r.type?.replace('_', ' ')}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>{r.submitted_at}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600 }}>+{r.points} pts</span>
              <span className={`badge ${r.status === 'FIXED' ? 'badge-success' : r.status === 'QUEUED_OFFLINE' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: '0.65rem' }}>
                {r.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
