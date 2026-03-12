import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const TEAMS = ['CAT-A HILO', 'CAT-B PUNA', 'CAT-C KONA', 'CAT-D KAU', 'CAT-E KOHALA']

const STATUS_CFG = {
  GREEN: { color: '#22d3ee', label: 'GREEN' },
  AMBER: { color: '#f59e0b', label: 'AMBER' },
  RED:   { color: '#f43f5e', label: 'RED'   },
}

function timeAgo(ts) {
  const mins = Math.floor((Date.now() - new Date(ts)) / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function PERSTATPanel({ session }) {
  const [rows,       setRows]       = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [form, setForm] = useState({ team_name: TEAMS[0], pax_present: '', status: 'GREEN', notes: '' })

  useEffect(() => {
    fetchPerstat()
    const ch = supabase.channel('perstat-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'perstat' }, () => fetchPerstat())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function fetchPerstat() {
    const { data } = await supabase
      .from('perstat').select('*').order('created_at', { ascending: false })
    if (!data) return
    // Keep only the most recent submission per team
    const latest = {}
    data.forEach(row => { if (!latest[row.team_name]) latest[row.team_name] = row })
    setRows(Object.values(latest).sort((a, b) => a.team_name.localeCompare(b.team_name)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!session || !form.pax_present) return
    setSubmitting(true)
    await supabase.from('perstat').insert({
      team_name:   form.team_name,
      pax_present: parseInt(form.pax_present),
      status:      form.status,
      notes:       form.notes.trim() || null,
      submitted_by: session.user.id,
    })
    setSubmitting(false)
    setSubmitted(true)
    setShowForm(false)
    setForm(f => ({ ...f, pax_present: '', notes: '' }))
    setTimeout(() => setSubmitted(false), 3000)
    fetchPerstat()
  }

  const totalPax = rows.reduce((sum, r) => sum + (r.pax_present || 0), 0)
  const worstStatus = rows.some(r => r.status === 'RED') ? 'RED'
                    : rows.some(r => r.status === 'AMBER') ? 'AMBER' : 'GREEN'
  const worstColor = STATUS_CFG[worstStatus]?.color || '#22d3ee'

  return (
    <div className="perstat-panel">

      {/* Summary strip */}
      <div className="perstat-summary">
        <div className="perstat-summary-left">
          <span className="perstat-dot" style={{ background: worstColor, boxShadow: `0 0 8px ${worstColor}` }} />
          <span className="perstat-total-label">TOTAL PAX</span>
          <span className="perstat-total-count">{totalPax}</span>
        </div>
        <span className="perstat-team-count">{rows.length} / {TEAMS.length} TEAMS REPORTED</span>
      </div>

      {/* Team rows */}
      <div className="perstat-list">
        {TEAMS.map(teamName => {
          const row = rows.find(r => r.team_name === teamName)
          const cfg = row ? (STATUS_CFG[row.status] || STATUS_CFG.GREEN) : null
          return (
            <div key={teamName} className={`perstat-row ${!row ? 'perstat-row--missing' : ''}`}>
              <span className="perstat-team-name">{teamName}</span>
              {row ? (
                <>
                  <span className="perstat-status-dot" style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }} />
                  <span className="perstat-status-label" style={{ color: cfg.color }}>{cfg.label}</span>
                  <span className="perstat-pax">{row.pax_present} PAX</span>
                  <span className="perstat-time">{timeAgo(row.created_at)}</span>
                </>
              ) : (
                <span className="perstat-no-report">NO REPORT</span>
              )}
              {row?.notes && (
                <div className="perstat-notes">{row.notes}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Submit */}
      {session && (
        <div className="perstat-submit-area">
          {submitted && <div className="perstat-submitted">✓ STATUS SUBMITTED</div>}
          {!showForm ? (
            <button className="perstat-open-btn" onClick={() => setShowForm(true)}>
              + SUBMIT TEAM STATUS
            </button>
          ) : (
            <form className="perstat-form" onSubmit={handleSubmit}>
              <select className="perstat-input" value={form.team_name}
                onChange={e => setForm(f => ({ ...f, team_name: e.target.value }))}>
                {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <div className="perstat-status-row">
                {['GREEN', 'AMBER', 'RED'].map(s => (
                  <button key={s} type="button"
                    className={`perstat-status-btn ${form.status === s ? 'perstat-status-btn--active' : ''}`}
                    style={form.status === s ? { color: STATUS_CFG[s].color, borderColor: STATUS_CFG[s].color } : {}}
                    onClick={() => setForm(f => ({ ...f, status: s }))}>
                    {s}
                  </button>
                ))}
              </div>

              <input className="perstat-input" type="number" min="0" max="99"
                placeholder="PAX present" value={form.pax_present}
                onChange={e => setForm(f => ({ ...f, pax_present: e.target.value }))}
                required />

              <input className="perstat-input" type="text" maxLength={120}
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

              <div className="perstat-form-btns">
                <button type="submit" className="perstat-submit-btn" disabled={submitting}>
                  {submitting ? 'SENDING…' : 'SUBMIT'}
                </button>
                <button type="button" className="perstat-cancel-btn" onClick={() => setShowForm(false)}>
                  CANCEL
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
