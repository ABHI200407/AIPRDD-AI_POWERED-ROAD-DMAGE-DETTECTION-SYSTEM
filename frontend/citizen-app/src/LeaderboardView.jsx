import { useState } from 'react'

const MOCK_LEADERS = [
  { rank: 1, name: 'Priya S.',    points: 3240, reports: 112, badge: '🌆', area: 'Andheri' },
  { rank: 2, name: 'Ravi K.',     points: 2980, reports: 98,  badge: '🏆', area: 'Bandra' },
  { rank: 3, name: 'Meera J.',    points: 2560, reports: 87,  badge: '🏆', area: 'Dadar' },
  { rank: 4, name: 'Arjun T.',    points: 1890, reports: 64,  badge: '⭐', area: 'Powai' },
  { rank: 5, name: 'Sunita P.',   points: 1720, reports: 58,  badge: '⭐', area: 'Thane' },
  { rank: 6, name: 'Rahul G.',    points: 1340, reports: 47,  badge: '🛡️', area: 'Kurla' },
  { rank: 7, name: 'You',         points: 1240, reports: 43,  badge: '🛡️', area: 'Local', isMe: true },
  { rank: 8, name: 'Vijay B.',    points: 980,  reports: 32,  badge: '📱', area: 'Mulund' },
  { rank: 9, name: 'Anjali M.',   points: 760,  reports: 25,  badge: '📱', area: 'Borivali' },
  { rank: 10, name: 'Deepak R.', points: 540,  reports: 18,  badge: '📱', area: 'Goregaon' },
]

export default function LeaderboardView({ userPoints }) {
  const [filter, setFilter] = useState('city')

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 100 }}>
      <h3>Community Leaderboard</h3>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, background: 'var(--bg-elevated)', padding: 4, borderRadius: 'var(--radius-pill)' }}>
        {['city', 'ward', 'weekly'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-pill)', border: 'none', background: filter === f ? 'var(--primary)' : 'transparent', color: filter === f ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', textTransform: 'capitalize', transition: 'var(--transition)' }}>
            {f === 'city' ? '🏙️ City' : f === 'ward' ? '📍 Ward' : '📆 Weekly'}
          </button>
        ))}
      </div>

      {/* Top 3 podium */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, padding: '20px 0' }}>
        {[MOCK_LEADERS[1], MOCK_LEADERS[0], MOCK_LEADERS[2]].map((leader, i) => {
          const heights = [80, 100, 64]
          const medals = ['🥈', '🥇', '🥉']
          return (
            <div key={leader.rank} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: '1.2rem' }}>{leader.badge}</div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', textAlign: 'center', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leader.name}</div>
              <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--primary)' }}>{leader.points.toLocaleString()} pts</div>
              <div style={{ width: 64, height: heights[i], background: i === 1 ? 'linear-gradient(180deg,#f59e0b,#d97706)' : i === 0 ? 'linear-gradient(180deg,#94a3b8,#64748b)' : 'linear-gradient(180deg,#92400e,#78350f)', borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
                {medals[i]}
              </div>
            </div>
          )
        })}
      </div>

      {/* Full list */}
      <div className="glass" style={{ overflow: 'hidden' }}>
        {MOCK_LEADERS.map(leader => (
          <div key={leader.rank}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--glass-border)', background: leader.isMe ? 'rgba(59,130,246,0.06)' : 'transparent' }}>
            <div style={{ width: 28, textAlign: 'center', fontWeight: 700, color: leader.rank <= 3 ? 'var(--warning)' : 'var(--text-muted)', fontSize: '0.9rem' }}>
              {leader.rank <= 3 ? ['🥇', '🥈', '🥉'][leader.rank - 1] : leader.rank}
            </div>
            <div style={{ fontSize: '1.2rem' }}>{leader.badge}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: leader.isMe ? 700 : 500, color: leader.isMe ? 'var(--primary)' : 'var(--text-primary)', fontSize: '0.9rem' }}>
                {leader.name} {leader.isMe && <span style={{ fontSize: '0.72rem', color: 'var(--primary)' }}>(You)</span>}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{leader.area} · {leader.reports} reports</div>
            </div>
            <div style={{ fontWeight: 700, color: 'var(--warning)', fontSize: '0.9rem' }}>{leader.points.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="alert-bar" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
        🏆 You are in the <strong style={{ color: 'var(--primary)' }}>Top 15%</strong> of city contributors. Keep reporting to climb!
      </div>
    </div>
  )
}
