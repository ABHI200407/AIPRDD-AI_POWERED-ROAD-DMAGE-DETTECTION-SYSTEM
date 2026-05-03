import { useState } from 'react'
import { CheckCircle, Plus } from 'lucide-react'

const ACTION_TYPES = ['REPORTED', 'INSPECTED', 'PATCHED', 'RESURFACED', 'CLOSED']
const ACTION_COLORS = { REPORTED: 'badge-info', INSPECTED: 'badge-warning', PATCHED: 'badge-warning', RESURFACED: 'badge-success', CLOSED: 'badge-success' }

export default function MaintenanceHistoryTab({ tickets }) {
  const [selectedTicket, setSelectedTicket] = useState('')
  const [history, setHistory] = useState([])
  const [allHistory, setAllHistory] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ action: 'PATCHED', performed_by: 'CREW_A', notes: '', cost_inr: 5000 })
  const [loading, setLoading] = useState(false)

  const fetchHistory = async (ticketId) => {
    if (!ticketId) return
    const res = await fetch(`http://localhost:8000/api/v1/gov/history/${ticketId}`)
    const data = await res.json()
    setHistory(data.history || [])
  }

  const fetchAll = async () => {
    const res = await fetch('http://localhost:8000/api/v1/gov/history')
    const data = await res.json()
    setAllHistory(data.data || [])
  }

  useState(() => { fetchAll() }, [])

  const addHistory = async () => {
    if (!selectedTicket) { alert('Select a ticket first'); return }
    setLoading(true)
    await fetch('http://localhost:8000/api/v1/gov/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: selectedTicket, ...form })
    })
    await fetchHistory(selectedTicket)
    await fetchAll()
    setShowForm(false)
    setLoading(false)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Left: ticket selector + timeline */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3>Repair Timeline</h3>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary" style={{ padding: '6px 12px' }}>
            <Plus size={14} /> Log Action
          </button>
        </div>

        <select
          value={selectedTicket}
          onChange={e => { setSelectedTicket(e.target.value); fetchHistory(e.target.value) }}
          style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'white', marginBottom: 16 }}
        >
          <option value="">— Select Ticket —</option>
          {(tickets || []).map(t => (
            <option key={t.ticket_id} value={t.ticket_id}>
              {t.ticket_id.slice(0, 8)}… (Score: {t.priority_score?.toFixed(0)})
            </option>
          ))}
        </select>

        {showForm && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 16 }}>
            <select value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))}
              style={{ width: '100%', background: 'var(--bg-base)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'white', marginBottom: 8 }}>
              {ACTION_TYPES.map(a => <option key={a}>{a}</option>)}
            </select>
            <input placeholder="Performed by (e.g. CREW_A)" value={form.performed_by}
              onChange={e => setForm(f => ({ ...f, performed_by: e.target.value }))}
              style={{ width: '100%', background: 'var(--bg-base)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'white', marginBottom: 8 }} />
            <input placeholder="Notes" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              style={{ width: '100%', background: 'var(--bg-base)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'white', marginBottom: 8 }} />
            <input type="number" placeholder="Cost (₹)" value={form.cost_inr}
              onChange={e => setForm(f => ({ ...f, cost_inr: parseFloat(e.target.value) }))}
              style={{ width: '100%', background: 'var(--bg-base)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'white', marginBottom: 10 }} />
            <button onClick={addHistory} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Saving…' : <><CheckCircle size={14} /> Save Action</>}
            </button>
          </div>
        )}

        {history.length === 0 && selectedTicket && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No history yet for this ticket.</p>
        )}
        {!selectedTicket && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Select a ticket to view its repair timeline.</p>}

        <div style={{ position: 'relative' }}>
          {history.map((h, i) => (
            <div key={h.history_id} style={{ display: 'flex', gap: 14, paddingBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>{i + 1}</div>
                {i < history.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--glass-border)', margin: '4px 0' }} />}
              </div>
              <div style={{ paddingBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span className={`badge ${ACTION_COLORS[h.action] || 'badge-info'}`}>{h.action}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{new Date(h.created_at).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{h.performed_by}</div>
                {h.notes && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>{h.notes}</div>}
                {h.cost_inr > 0 && <div style={{ fontSize: '0.78rem', color: 'var(--success)', marginTop: 2 }}>₹{h.cost_inr.toLocaleString()}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: all recent history */}
      <div className="glass-card">
        <h3 style={{ marginBottom: 16 }}>Recent Maintenance Activity</h3>
        <table className="data-table">
          <thead><tr><th>Action</th><th>By</th><th>Cost</th><th>Date</th></tr></thead>
          <tbody>
            {allHistory.length === 0 && (
              <tr><td colSpan="4" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No maintenance actions logged yet.</td></tr>
            )}
            {allHistory.map(h => (
              <tr key={h.history_id}>
                <td><span className={`badge ${ACTION_COLORS[h.action] || 'badge-info'}`}>{h.action}</span></td>
                <td>{h.performed_by}</td>
                <td style={{ color: 'var(--success)' }}>{h.cost_inr > 0 ? `₹${h.cost_inr.toLocaleString()}` : '—'}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{new Date(h.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
