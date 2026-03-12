import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const STATUS_CFG = {
  draft:    { label: 'DRAFT',    color: '#6a9fc0' },
  active:   { label: 'ACTIVE',   color: '#22d3ee' },
  resolved: { label: 'RESOLVED', color: '#34d399' },
}

function formatUTC(iso) {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 16).replace('T', ' ') + 'Z'
}

function exportSitrep(sitrep, linkedReport) {
  const linked = linkedReport
    ? `INC-${linkedReport.id}: ${linkedReport.title}`
    : 'NONE'
  const text = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'SITUATION REPORT (SITREP)',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `TITLE:   ${sitrep.title}`,
    `STATUS:  ${(sitrep.status || 'draft').toUpperCase()}`,
    `DTG:     ${formatUTC(sitrep.created_at)}`,
    `LINKED:  ${linked}`,
    '',
    'SITUATION:',
    sitrep.content || '(no content)',
    '',
    `PREPARED BY: Project HILO — ${formatUTC(new Date().toISOString())}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ].join('\n')

  navigator.clipboard.writeText(text).catch(() => {})
}

function SitrepPanel({ session, reports = [], clearanceLevel }) {
  const [sitreps, setSitreps]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded]   = useState(null)
  const [copied, setCopied]       = useState(null)
  const [form, setForm] = useState({
    title: '', status: 'draft', report_id: '', content: '',
  })

  useEffect(() => { loadSitreps() }, [])

  async function loadSitreps() {
    setLoading(true)
    const { data } = await supabase
      .from('sitreps')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setSitreps(data || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!session || !form.title.trim()) return
    setSubmitting(true)
    const payload = {
      title:    form.title.trim(),
      status:   form.status,
      content:  form.content.trim(),
      user_id:  session.user.id,
      report_id: form.report_id ? parseInt(form.report_id) : null,
    }
    const { data, error } = await supabase.from('sitreps').insert(payload).select().single()
    if (!error && data) {
      setSitreps(prev => [data, ...prev])
      setForm({ title: '', status: 'draft', report_id: '', content: '' })
      setShowForm(false)
    }
    setSubmitting(false)
  }

  function handleExport(sitrep) {
    const linked = reports.find(r => r.id === sitrep.report_id)
    exportSitrep(sitrep, linked)
    setCopied(sitrep.id)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleStatusChange(sitrep, newStatus) {
    const { error } = await supabase
      .from('sitreps').update({ status: newStatus }).eq('id', sitrep.id)
    if (!error) {
      setSitreps(prev => prev.map(s => s.id === sitrep.id ? { ...s, status: newStatus } : s))
    }
  }

  const canCreate = session && clearanceLevel >= 3

  return (
    <div className="sitrep-panel">

      {/* Toolbar */}
      <div className="sp-toolbar">
        <div className="sp-toolbar-left">
          <span className="sp-count">{sitreps.length} SITREPS</span>
        </div>
        {canCreate && (
          <button
            className={`sp-new-btn ${showForm ? 'sp-new-btn--active' : ''}`}
            onClick={() => setShowForm(p => !p)}
          >
            {showForm ? '✕ CANCEL' : '+ NEW SITREP'}
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && canCreate && (
        <form className="sp-form" onSubmit={handleSubmit}>
          <input
            className="sp-input"
            placeholder="SITREP title…"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            required
            maxLength={120}
          />
          <div className="sp-form-row">
            <select
              className="sp-select"
              value={form.status}
              onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
            >
              <option value="draft">DRAFT</option>
              <option value="active">ACTIVE</option>
              <option value="resolved">RESOLVED</option>
            </select>
            <select
              className="sp-select"
              value={form.report_id}
              onChange={e => setForm(p => ({ ...p, report_id: e.target.value }))}
            >
              <option value="">No linked incident</option>
              {reports.map(r => (
                <option key={r.id} value={r.id}>
                  INC-{r.id}: {(r.title || 'Incident').slice(0, 35)}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="sp-textarea"
            placeholder="Situation narrative…"
            value={form.content}
            onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            rows={5}
          />
          <button className="sp-submit-btn" type="submit" disabled={submitting}>
            {submitting ? 'FILING…' : 'FILE SITREP'}
          </button>
        </form>
      )}

      {!canCreate && !session && (
        <div className="sp-gate">Sign in with COORDINATOR clearance to file SITREPs.</div>
      )}
      {!canCreate && session && clearanceLevel < 3 && (
        <div className="sp-gate">COORDINATOR clearance (L3) required to file SITREPs.</div>
      )}

      {/* List */}
      {loading ? (
        <div className="sp-loading">
          <div className="loading-spinner" />
        </div>
      ) : sitreps.length === 0 ? (
        <div className="sp-empty">No SITREPs filed yet.</div>
      ) : (
        <div className="sp-list">
          {sitreps.map(s => {
            const cfg     = STATUS_CFG[s.status] || STATUS_CFG.draft
            const linked  = reports.find(r => r.id === s.report_id)
            const isOpen  = expanded === s.id
            return (
              <div key={s.id} className={`sp-row ${isOpen ? 'sp-row--open' : ''}`}>
                <div className="sp-row-header" onClick={() => setExpanded(isOpen ? null : s.id)}>
                  <div className="sp-row-left">
                    <span className="sp-status-dot" style={{ background: cfg.color }} />
                    <span className="sp-row-title">{s.title}</span>
                  </div>
                  <div className="sp-row-right">
                    <span className="sp-status-badge" style={{ color: cfg.color, borderColor: cfg.color }}>
                      {cfg.label}
                    </span>
                    <span className="sp-chevron">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="sp-row-body">
                    <div className="sp-meta-row">
                      <span className="sp-meta-dtg">{formatUTC(s.created_at)}</span>
                      {linked && (
                        <span className="sp-meta-link">
                          ↳ INC-{linked.id}: {(linked.title || '').slice(0, 30)}
                        </span>
                      )}
                    </div>
                    {s.content && <div className="sp-content">{s.content}</div>}
                    <div className="sp-row-actions">
                      {canCreate && s.status !== 'active' && (
                        <button
                          className="sp-action-btn"
                          onClick={() => handleStatusChange(s, 'active')}
                        >
                          ACTIVATE
                        </button>
                      )}
                      {canCreate && s.status !== 'resolved' && (
                        <button
                          className="sp-action-btn"
                          onClick={() => handleStatusChange(s, 'resolved')}
                        >
                          RESOLVE
                        </button>
                      )}
                      <button
                        className={`sp-action-btn sp-action-btn--export ${copied === s.id ? 'sp-action-btn--copied' : ''}`}
                        onClick={() => handleExport(s)}
                      >
                        {copied === s.id ? '✓ COPIED' : '↑ EXPORT'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default SitrepPanel
