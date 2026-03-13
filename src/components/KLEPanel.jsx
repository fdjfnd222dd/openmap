import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const OUTCOME_CFG = {
  positive: { label: 'POSITIVE', color: '#34d399' },
  neutral:  { label: 'NEUTRAL',  color: '#6a9fc0' },
  negative: { label: 'NEGATIVE', color: '#f87171' },
}

function formatUTC(iso) {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 10)
}

function starRating(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

function exportKLE(kle) {
  const outcome = OUTCOME_CFG[kle.outcome] || OUTCOME_CFG.neutral
  const text = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'KEY LEADER ENGAGEMENT (KLE) REPORT',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `LEADER:       ${kle.leader_name}`,
    `ORGANIZATION: ${kle.organization || '—'}`,
    `LOCATION:     ${kle.location || '—'}`,
    `DATE:         ${formatUTC(kle.date_of_engagement)}`,
    `OUTCOME:      ${outcome.label}`,
    `RELIABILITY:  ${starRating(kle.reliability || 3)} (${kle.reliability}/5)`,
    '',
    'SUMMARY:',
    kle.summary || '(no summary)',
    '',
    kle.follow_up ? 'FOLLOW-UP:\n' + kle.follow_up : '',
    '',
    `LOGGED: ${new Date(kle.created_at).toISOString().slice(0, 16).replace('T', ' ')}Z`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ].filter(Boolean).join('\n')

  navigator.clipboard.writeText(text).catch(() => {})
}

function KLEPanel({ session, clearanceLevel }) {
  const [kles, setKles]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [copied, setCopied]     = useState(null)
  const [filter, setFilter]     = useState('all') // all | positive | neutral | negative
  const [form, setForm] = useState({
    leader_name: '', organization: '', location: '',
    date_of_engagement: new Date().toISOString().slice(0, 10),
    summary: '', outcome: 'neutral', follow_up: '', reliability: 3,
  })

  useEffect(() => { loadKLEs() }, [])

  async function loadKLEs() {
    setLoading(true)
    const { data } = await supabase
      .from('kle_log')
      .select('*')
      .order('date_of_engagement', { ascending: false })
      .limit(100)
    setKles(data || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!session || !form.leader_name.trim()) return
    setSubmitting(true)
    const payload = {
      leader_name:         form.leader_name.trim(),
      organization:        form.organization.trim() || null,
      location:            form.location.trim() || null,
      date_of_engagement:  form.date_of_engagement || new Date().toISOString(),
      summary:             form.summary.trim() || null,
      outcome:             form.outcome,
      follow_up:           form.follow_up.trim() || null,
      reliability:         parseInt(form.reliability),
      user_id:             session.user.id,
    }
    const { data, error } = await supabase.from('kle_log').insert(payload).select().single()
    if (!error && data) {
      setKles(prev => [data, ...prev])
      setForm({
        leader_name: '', organization: '', location: '',
        date_of_engagement: new Date().toISOString().slice(0, 10),
        summary: '', outcome: 'neutral', follow_up: '', reliability: 3,
      })
      setShowForm(false)
    }
    setSubmitting(false)
  }

  function handleExport(kle) {
    exportKLE(kle)
    setCopied(kle.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const canCreate = session && clearanceLevel >= 2

  const filtered = filter === 'all' ? kles : kles.filter(k => k.outcome === filter)

  return (
    <div className="kle-panel">

      {/* Toolbar */}
      <div className="kle-toolbar">
        <div className="kle-filter-row">
          {['all', 'positive', 'neutral', 'negative'].map(f => (
            <button
              key={f}
              className={`kle-filter-btn ${filter === f ? 'kle-filter-btn--active' : ''}`}
              onClick={() => setFilter(f)}
              style={filter === f && f !== 'all' ? { color: OUTCOME_CFG[f]?.color, borderColor: OUTCOME_CFG[f]?.color } : {}}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        {canCreate && (
          <button
            className={`kle-new-btn ${showForm ? 'kle-new-btn--active' : ''}`}
            onClick={() => setShowForm(p => !p)}
          >
            {showForm ? '✕' : '+ LOG KLE'}
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && canCreate && (
        <form className="kle-form" onSubmit={handleSubmit}>
          <div className="kle-form-grid">
            <input
              className="kle-input"
              placeholder="Leader name *"
              value={form.leader_name}
              onChange={e => setForm(p => ({ ...p, leader_name: e.target.value }))}
              required
            />
            <input
              className="kle-input"
              placeholder="Organization"
              value={form.organization}
              onChange={e => setForm(p => ({ ...p, organization: e.target.value }))}
            />
            <input
              className="kle-input"
              placeholder="Location"
              value={form.location}
              onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
            />
            <input
              className="kle-input"
              type="date"
              value={form.date_of_engagement}
              onChange={e => setForm(p => ({ ...p, date_of_engagement: e.target.value }))}
            />
          </div>

          <textarea
            className="kle-textarea"
            placeholder="Meeting summary…"
            value={form.summary}
            onChange={e => setForm(p => ({ ...p, summary: e.target.value }))}
            rows={3}
          />
          <textarea
            className="kle-textarea"
            placeholder="Follow-up actions…"
            value={form.follow_up}
            onChange={e => setForm(p => ({ ...p, follow_up: e.target.value }))}
            rows={2}
          />

          <div className="kle-form-bottom">
            <div className="kle-outcome-row">
              {['positive', 'neutral', 'negative'].map(o => {
                const cfg = OUTCOME_CFG[o]
                return (
                  <button
                    key={o}
                    type="button"
                    className={`kle-outcome-btn ${form.outcome === o ? 'kle-outcome-btn--active' : ''}`}
                    style={form.outcome === o ? { borderColor: cfg.color, color: cfg.color } : {}}
                    onClick={() => setForm(p => ({ ...p, outcome: o }))}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
            <div className="kle-reliability-row">
              <span className="kle-reliability-label">RELIABILITY</span>
              <div className="kle-stars">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`kle-star ${form.reliability >= n ? 'kle-star--on' : ''}`}
                    onClick={() => setForm(p => ({ ...p, reliability: n }))}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button className="kle-submit-btn" type="submit" disabled={submitting}>
            {submitting ? 'LOGGING…' : 'LOG ENGAGEMENT'}
          </button>
        </form>
      )}

      {!canCreate && !session && (
        <div className="kle-gate">Sign in to log Key Leader Engagements.</div>
      )}
      {!canCreate && session && (
        <div className="kle-gate">Volunteer access (L2) required to log KLEs.</div>
      )}

      {/* Stats strip */}
      {!loading && kles.length > 0 && (
        <div className="kle-stats">
          {['positive', 'neutral', 'negative'].map(o => {
            const count = kles.filter(k => k.outcome === o).length
            return (
              <div key={o} className="kle-stat">
                <span className="kle-stat-value" style={{ color: OUTCOME_CFG[o].color }}>{count}</span>
                <span className="kle-stat-label">{o.toUpperCase()}</span>
              </div>
            )
          })}
          <div className="kle-stat">
            <span className="kle-stat-value">{kles.length}</span>
            <span className="kle-stat-label">TOTAL</span>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="kle-loading"><div className="loading-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="kle-empty">
          {filter === 'all' ? 'No engagements logged yet.' : `No ${filter} engagements.`}
        </div>
      ) : (
        <div className="kle-list">
          {filtered.map(k => {
            const cfg    = OUTCOME_CFG[k.outcome] || OUTCOME_CFG.neutral
            const isOpen = expanded === k.id
            return (
              <div key={k.id} className={`kle-row ${isOpen ? 'kle-row--open' : ''}`}>
                <div className="kle-row-header" onClick={() => setExpanded(isOpen ? null : k.id)}>
                  <div className="kle-row-left">
                    <span className="kle-outcome-dot" style={{ background: cfg.color }} />
                    <div className="kle-row-info">
                      <span className="kle-leader-name">{k.leader_name}</span>
                      {k.organization && (
                        <span className="kle-org">{k.organization}</span>
                      )}
                    </div>
                  </div>
                  <div className="kle-row-right">
                    <span className="kle-date">{formatUTC(k.date_of_engagement)}</span>
                    <span className="kle-chevron">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="kle-row-body">
                    <div className="kle-detail-grid">
                      {k.location && (
                        <div className="kle-detail-item">
                          <span className="kle-detail-label">LOCATION</span>
                          <span className="kle-detail-value">{k.location}</span>
                        </div>
                      )}
                      <div className="kle-detail-item">
                        <span className="kle-detail-label">OUTCOME</span>
                        <span className="kle-detail-value" style={{ color: cfg.color }}>{cfg.label}</span>
                      </div>
                      <div className="kle-detail-item">
                        <span className="kle-detail-label">RELIABILITY</span>
                        <span className="kle-detail-value kle-stars-display">{starRating(k.reliability || 3)}</span>
                      </div>
                    </div>
                    {k.summary && (
                      <div className="kle-detail-section">
                        <div className="kle-detail-section-label">SUMMARY</div>
                        <div className="kle-detail-text">{k.summary}</div>
                      </div>
                    )}
                    {k.follow_up && (
                      <div className="kle-detail-section">
                        <div className="kle-detail-section-label">FOLLOW-UP</div>
                        <div className="kle-detail-text kle-followup">{k.follow_up}</div>
                      </div>
                    )}
                    <div className="kle-row-actions">
                      <button
                        className={`kle-action-btn ${copied === k.id ? 'kle-action-btn--copied' : ''}`}
                        onClick={() => handleExport(k)}
                      >
                        {copied === k.id ? '✓ COPIED' : '↑ EXPORT'}
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

export default KLEPanel
