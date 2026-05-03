import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  BrainCircuit,
  Calendar,
  Camera,
  CheckCircle,
  ClipboardCheck,
  CloudRain,
  Database,
  DollarSign,
  Gauge,
  HardHat,
  MapPinned,
  Plane,
  RadioTower,
  Route,
  ShieldCheck,
  Truck,
  Users,
  WalletCards,
  Workflow,
  Zap
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

const fallbackTickets = [
  { ticket_id: 'AI-9001', latitude: 19.0821, longitude: 72.8742, base_severity: 5, priority_score: 94, duplicate_count: 7, status: 'OPEN' },
  { ticket_id: 'AI-9002', latitude: 19.0715, longitude: 72.8814, base_severity: 4, priority_score: 82, duplicate_count: 4, status: 'IN_PROGRESS' },
  { ticket_id: 'AI-9003', latitude: 19.0873, longitude: 72.8688, base_severity: 3, priority_score: 61, duplicate_count: 2, status: 'OPEN' },
  { ticket_id: 'AI-9004', latitude: 19.0649, longitude: 72.8896, base_severity: 2, priority_score: 44, duplicate_count: 1, status: 'OPEN' }
]

const fallbackCrews = [
  { crew: { id: 'crew-a', name: 'Crew A', specialty: 'Rapid asphalt patching', capacity: 8 }, clusters: ['North school zone', 'Station road'], total_hours: 6.5 },
  { crew: { id: 'crew-b', name: 'Crew B', specialty: 'Drainage and flooding', capacity: 6 }, clusters: ['Market flood strip'], total_hours: 4.2 },
  { crew: { id: 'crew-c', name: 'Crew C', specialty: 'Heavy equipment', capacity: 5 }, clusters: [], total_hours: 0 }
]

const inspectionData = [
  { source: 'Citizen AI', count: 124, color: '#38bdf8' },
  { source: 'Fleet Sensors', count: 61, color: '#10b981' },
  { source: 'Drone', count: 37, color: '#f59e0b' },
  { source: 'Inspector', count: 28, color: '#a78bfa' }
]

const forecastData = [
  { week: 'W1', predicted: 18, prevented: 7 },
  { week: 'W2', predicted: 24, prevented: 10 },
  { week: 'W3', predicted: 29, prevented: 14 },
  { week: 'W4', predicted: 36, prevented: 19 },
  { week: 'W5', predicted: 41, prevented: 25 },
  { week: 'W6', predicted: 47, prevented: 31 }
]

const wardScoreData = [
  { ward: 'North', backlog: 31, resolved: 24 },
  { ward: 'Central', backlog: 44, resolved: 29 },
  { ward: 'West', backlog: 18, resolved: 22 },
  { ward: 'South', backlog: 26, resolved: 19 }
]

const recommendedActions = [
  { icon: Zap, title: 'Dispatch urgent cluster', detail: 'Send Crew A to the school-zone cluster before afternoon traffic.', impact: '6 critical fixes today', tone: 'danger' },
  { icon: CloudRain, title: 'Pre-monsoon prevention', detail: 'Seal 14 cracks in Central ward before the next heavy rain window.', impact: 'Avoids INR 1.2M rework', tone: 'warning' },
  { icon: WalletCards, title: 'Budget rebalance', detail: 'Move 8% reserve from low-risk West ward to Central arterial roads.', impact: 'Cuts SLA breach risk 18%', tone: 'primary' },
  { icon: ShieldCheck, title: 'Contractor review', detail: 'Material failure rate is elevated on roads repaired by Contractor D.', impact: 'Open quality audit', tone: 'success' }
]

const automations = [
  { label: 'AI verification', value: '95.4%', detail: 'Photo realism, severity, duplicate merge, spam/fraud flags', icon: Bot },
  { label: 'Priority engine', value: 'Live', detail: 'Severity, traffic, upvotes, schools, budget, weather risk', icon: BrainCircuit },
  { label: 'Crew routing', value: '8/job run', detail: 'Geo-clusters, equipment, materials, traffic windows', icon: Route },
  { label: 'Audit trail', value: '100%', detail: 'Before/after photos, SLA clock, billing proof, citizen closure', icon: ClipboardCheck }
]

const mobileTools = [
  { icon: Camera, label: 'AR inspection overlay' },
  { icon: RadioTower, label: 'Offline sync queue' },
  { icon: Bell, label: 'Voice notes and checklists' },
  { icon: Database, label: 'GPS proof package' }
]

function getTicketSet(tickets) {
  return tickets?.length ? tickets : fallbackTickets
}

function getCrewSet(crews) {
  return crews?.length ? crews : fallbackCrews
}

function averagePriority(tickets) {
  if (!tickets.length) return 0
  return Math.round(tickets.reduce((sum, ticket) => sum + (ticket.priority_score || 0), 0) / tickets.length)
}

function countCritical(tickets) {
  return tickets.filter((ticket) => (ticket.priority_score || 0) >= 80).length
}

function moneyInLakhs(value) {
  if (!value) return '0L'
  return `${(value / 100000).toFixed(1)}L`
}

function CommandMetric({ icon: Icon, label, value, note, tone = 'primary' }) {
  return (
    <div className={`command-metric tone-${tone}`}>
      <div className="command-metric-icon"><Icon size={19} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{note}</p>
      </div>
    </div>
  )
}

function ActionCard({ action }) {
  const Icon = action.icon
  return (
    <div className={`action-card tone-${action.tone}`}>
      <div className="action-icon"><Icon size={18} /></div>
      <div>
        <h4>{action.title}</h4>
        <p>{action.detail}</p>
        <span>{action.impact}</span>
      </div>
    </div>
  )
}

function AutomationStep({ item, index }) {
  const Icon = item.icon
  return (
    <div className="automation-step">
      <div className="automation-index">{index + 1}</div>
      <div className="automation-icon"><Icon size={18} /></div>
      <div>
        <strong>{item.label}</strong>
        <span>{item.value}</span>
        <p>{item.detail}</p>
      </div>
    </div>
  )
}

export default function GovCommandCenter({
  tickets,
  crews,
  budget,
  sla,
  fraud,
  weather,
  loading,
  onRunDbscan,
  onAutoDispatch,
  onRunDroneSurvey
}) {
  const ticketSet = getTicketSet(tickets)
  const crewSet = getCrewSet(crews)
  const criticalCount = countCritical(ticketSet)
  const avgPriority = averagePriority(ticketSet)
  const activeCrews = crewSet.filter((item) => item.clusters?.length).length
  const budgetBurn = budget?.burn_rate_percent ?? 68
  const slaRate = sla?.compliance_rate ?? 84
  const fraudCount = fraud?.flagged_count ?? 3
  const rainRisk = weather?.risk_level || 'MONSOON WATCH'

  return (
    <div className="command-center">
      <section className="command-hero">
        <div>
          <div className="eyebrow"><Bot size={16} /> AI management layer</div>
          <h2>Smart road operations command center</h2>
          <p>
            One operating surface for auto-verification, priority scoring, predictive maintenance,
            crew dispatch, budget control, SLA accountability, and public transparency.
          </p>
        </div>
        <div className="command-hero-actions">
          <button className="btn-primary" onClick={onRunDbscan} disabled={loading.cluster}>
            <BrainCircuit size={16} /> Cluster Queue
          </button>
          <button className="btn-secondary" onClick={onAutoDispatch} disabled={loading.dispatch}>
            <Truck size={16} /> Auto Dispatch
          </button>
          <button className="btn-secondary" onClick={onRunDroneSurvey} disabled={loading.drone}>
            <Plane size={16} /> Drone Scan
          </button>
        </div>
      </section>

      <section className="command-metric-grid">
        <CommandMetric icon={AlertTriangle} label="Critical issues" value={criticalCount} note="Severity, traffic, and school-zone boosted" tone="danger" />
        <CommandMetric icon={Gauge} label="Avg AI priority" value={avgPriority} note="Live multi-factor queue score" tone="warning" />
        <CommandMetric icon={Users} label="Active crews" value={`${activeCrews}/${crewSet.length}`} note="Balanced by cluster and skill match" tone="success" />
        <CommandMetric icon={DollarSign} label="Budget used" value={`${budgetBurn}%`} note={`Remaining INR ${moneyInLakhs(budget?.remaining_inr || 3200000)}`} tone="primary" />
        <CommandMetric icon={ShieldCheck} label="SLA compliance" value={`${slaRate}%`} note="Critical target: 48 hour closure" tone="success" />
        <CommandMetric icon={Bot} label="Fraud flags" value={fraudCount} note="Suspicious GPS, users, and media patterns" tone="danger" />
        <CommandMetric icon={CloudRain} label="Weather risk" value={rainRisk} note="Schedules auto-adjust for rain impact" tone="warning" />
      </section>

      <section className="command-grid">
        <div className="glass-card command-panel command-span-8">
          <div className="panel-heading">
            <div>
              <span>Priority Engine</span>
              <h3>AI-ranked repair queue</h3>
            </div>
            <span className="badge badge-info">real-time re-ranking</span>
          </div>
          <div className="command-table">
            <div className="command-table-head">
              <span>Ticket</span><span>Severity</span><span>AI score</span><span>Duplicates</span><span>Status</span>
            </div>
            {ticketSet.slice(0, 5).map((ticket) => (
              <div key={ticket.ticket_id} className="command-table-row">
                <strong>{ticket.ticket_id.slice(0, 8)}</strong>
                <span>{Math.round(ticket.base_severity || 0)}/5</span>
                <span className={(ticket.priority_score || 0) >= 80 ? 'danger-text' : 'warning-text'}>{ticket.priority_score?.toFixed?.(1) || ticket.priority_score}</span>
                <span>{ticket.duplicate_count || 1} merged</span>
                <span className={`badge ${ticket.status === 'IN_PROGRESS' ? 'badge-warning' : 'badge-critical'}`}>{ticket.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card command-panel command-span-4">
          <div className="panel-heading">
            <div>
              <span>Inspection Sources</span>
              <h3>Coverage mix</h3>
            </div>
          </div>
          <div className="chart-box short">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={inspectionData} dataKey="count" nameKey="source" innerRadius={54} outerRadius={86} paddingAngle={3}>
                  {inspectionData.map((entry) => <Cell key={entry.source} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="source-list">
            {inspectionData.map((source) => (
              <div key={source.source}>
                <span style={{ background: source.color }} />
                <strong>{source.source}</strong>
                <em>{source.count}</em>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card command-panel command-span-5">
          <div className="panel-heading">
            <div>
              <span>Recommended Actions</span>
              <h3>AI decision support</h3>
            </div>
          </div>
          <div className="action-stack">
            {recommendedActions.map((action) => <ActionCard key={action.title} action={action} />)}
          </div>
        </div>

        <div className="glass-card command-panel command-span-7">
          <div className="panel-heading">
            <div>
              <span>Predictive Maintenance</span>
              <h3>Damage forecast vs prevention</h3>
            </div>
            <span className="badge badge-warning">monsoon model</span>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData}>
                <defs>
                  <linearGradient id="predictedDamage" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="preventedDamage" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="week" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12 }} />
                <Area type="monotone" dataKey="predicted" stroke="#f43f5e" fill="url(#predictedDamage)" strokeWidth={2} />
                <Area type="monotone" dataKey="prevented" stroke="#10b981" fill="url(#preventedDamage)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card command-panel command-span-6">
          <div className="panel-heading">
            <div>
              <span>Workflow Automation</span>
              <h3>From report to repair</h3>
            </div>
          </div>
          <div className="automation-flow">
            {automations.map((item, index) => <AutomationStep key={item.label} item={item} index={index} />)}
          </div>
          <div className="workflow-compare">
            <div>
              <span>Old manual cycle</span>
              <strong>10 days</strong>
              <p>8+ labor hours across call center, inspection, manual review, scheduling.</p>
            </div>
            <div>
              <span>AI-assisted cycle</span>
              <strong>&lt;8 hours</strong>
              <p>Photo upload, verification, dispatch recommendation, crew notification.</p>
            </div>
          </div>
        </div>

        <div className="glass-card command-panel command-span-6">
          <div className="panel-heading">
            <div>
              <span>Ward Performance</span>
              <h3>Backlog and closure trend</h3>
            </div>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wardScoreData}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="ward" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12 }} />
                <Bar dataKey="backlog" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                <Bar dataKey="resolved" fill="#38bdf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card command-panel command-span-4">
          <div className="panel-heading">
            <div>
              <span>Field Inspector App</span>
              <h3>Mobile tools</h3>
            </div>
          </div>
          <div className="tool-grid">
            {mobileTools.map((tool) => {
              const Icon = tool.icon
              return (
                <div key={tool.label}>
                  <Icon size={20} />
                  <span>{tool.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="glass-card command-panel command-span-4">
          <div className="panel-heading">
            <div>
              <span>Compliance</span>
              <h3>Audit health</h3>
            </div>
          </div>
          <div className="audit-stack">
            <div><CheckCircle size={17} /><span>Before/after proof required</span><strong>100%</strong></div>
            <div><Activity size={17} /><span>Reopened repairs</span><strong>5%</strong></div>
            <div><HardHat size={17} /><span>Crew quality score</span><strong>4.6/5</strong></div>
            <div><MapPinned size={17} /><span>Inspected network</span><strong>72%</strong></div>
          </div>
        </div>

        <div className="glass-card command-panel command-span-4">
          <div className="panel-heading">
            <div>
              <span>Cross-System Sync</span>
              <h3>Data integrations</h3>
            </div>
          </div>
          <div className="integration-list">
            <div><Workflow size={17} /> 311 portal sync</div>
            <div><Calendar size={17} /> Traffic work windows</div>
            <div><Plane size={17} /> Drone survey queue</div>
            <div><Database size={17} /> GIS and asset registry</div>
            <div><AlertTriangle size={17} /> Emergency services feed</div>
          </div>
        </div>
      </section>
    </div>
  )
}
