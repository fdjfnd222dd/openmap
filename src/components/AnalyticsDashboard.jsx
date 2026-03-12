import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line,
  PieChart, Pie, Legend,
} from 'recharts'

const TYPE_COLORS = {
  flood: '#3b82f6', fire: '#ef4444', earthquake: '#f97316', other: '#94a3b8',
}
const STATUS_COLORS = {
  verified: '#22c55e', under_review: '#eab308', false: '#ef4444', unverified: '#475569',
}

const TOOLTIP_STYLE = {
  contentStyle: { background: '#141720', border: '1px solid #1e2535', borderRadius: 4, color: '#e2e8f0', fontSize: 12 },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
}

function AnalyticsDashboard({ isOpen, onClose, inline = false }) {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return
    loadStats()
  }, [isOpen])

  async function loadStats() {
    setLoading(true)
    const { data: reports } = await supabase
      .from('reports')
      .select('id, type, status, created_at')
      .order('created_at', { ascending: true })

    if (!reports) { setLoading(false); return }

    const total       = reports.length
    const verified    = reports.filter(r => r.status === 'verified').length
    const underReview = reports.filter(r => r.status === 'under_review').length
    const falsed      = reports.filter(r => r.status === 'false').length
    const unverified  = reports.filter(r => !r.status || r.status === 'unverified').length

    const byType = ['flood', 'fire', 'earthquake', 'other'].map(t => ({
      name:  t.toUpperCase(),
      count: reports.filter(r => r.type === t).length,
    }))

    const byStatus = [
      { name: 'UNVERIFIED',   value: unverified,  color: STATUS_COLORS.unverified   },
      { name: 'UNDER REVIEW', value: underReview,  color: STATUS_COLORS.under_review },
      { name: 'VERIFIED',     value: verified,     color: STATUS_COLORS.verified     },
      { name: 'FALSE',        value: falsed,       color: STATUS_COLORS.false        },
    ].filter(s => s.value > 0)

    // Last 7 days
    const now  = new Date()
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d        = new Date(now)
      d.setDate(d.getDate() - i)
      const label    = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const dayEnd   = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1)
      days.push({
        name:    label,
        reports: reports.filter(r => {
          const t = new Date(r.created_at)
          return t >= dayStart && t < dayEnd
        }).length,
      })
    }

    setStats({ total, verified, underReview, falsed, unverified, byType, byStatus, days })
    setLoading(false)
  }

  if (!isOpen && !inline) return null

  const verifiedPct = stats ? ((stats.verified / Math.max(stats.total, 1)) * 100).toFixed(0) : 0

  return (
    <div className={inline ? 'analytics-panel-inline' : 'analytics-panel'}>

      {!inline && (
        <div className="analytics-header">
          <span className="analytics-title">∑ COMMAND INTEL</span>
          <button className="analytics-close-btn" onClick={onClose}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="analytics-loading">
          <div className="loading-spinner" />
          <span className="loading-text">COMPILING…</span>
        </div>
      ) : !stats ? (
        <div className="analytics-loading">
          <span className="loading-text">NO DATA</span>
        </div>
      ) : (
        <div className="analytics-body">

          {/* KPI tiles */}
          <div className="analytics-kpis">
            <div className="analytics-kpi">
              <span className="kpi-value">{stats.total}</span>
              <span className="kpi-label">TOTAL</span>
            </div>
            <div className="analytics-kpi">
              <span className="kpi-value" style={{ color: '#22c55e' }}>{verifiedPct}%</span>
              <span className="kpi-label">VERIFIED</span>
            </div>
            <div className="analytics-kpi">
              <span className="kpi-value" style={{ color: '#eab308' }}>{stats.underReview}</span>
              <span className="kpi-label">IN REVIEW</span>
            </div>
            <div className="analytics-kpi">
              <span className="kpi-value" style={{ color: '#ef4444' }}>{stats.falsed}</span>
              <span className="kpi-label">FALSE</span>
            </div>
          </div>

          {/* Reports by type */}
          <div className="analytics-chart-block">
            <div className="analytics-chart-label">REPORTS BY TYPE</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={stats.byType} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {stats.byType.map(entry => (
                    <Cell key={entry.name} fill={TYPE_COLORS[entry.name.toLowerCase()] || '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 7-day trend */}
          <div className="analytics-chart-block">
            <div className="analytics-chart-label">LAST 7 DAYS</div>
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={stats.days} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Line
                  type="monotone"
                  dataKey="reports"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Status pie */}
          {stats.byStatus.length > 0 && (
            <div className="analytics-chart-block">
              <div className="analytics-chart-label">STATUS BREAKDOWN</div>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={stats.byStatus}
                    cx="50%"
                    cy="45%"
                    innerRadius={38}
                    outerRadius={62}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {stats.byStatus.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend
                    iconSize={8}
                    formatter={val => <span style={{ color: '#94a3b8', fontSize: 10 }}>{val}</span>}
                  />
                  <Tooltip {...TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

export default AnalyticsDashboard
