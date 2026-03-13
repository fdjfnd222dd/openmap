import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { trustClass } from '../utils/trust'

const INCIDENT_META = {
  flood:      { label: 'FLOOD',      mod: 'flood'      },
  fire:       { label: 'FIRE',       mod: 'fire'       },
  earthquake: { label: 'EARTHQUAKE', mod: 'earthquake' },
  other:      { label: 'OTHER',      mod: 'other'      },
}

function formatShort(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatFull(iso) {
  if (!iso) return ''
  return new Date(iso).toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
}

function shortId(uuid) {
  return uuid ? uuid.split('-')[0].toUpperCase() : '—'
}

const STATUS_BADGE = {
  verified:     { label: '✓ VERIFIED',     cls: 'verdict--verified'     },
  under_review: { label: '⏳ UNDER REVIEW', cls: 'verdict--under-review' },
  false:        { label: '✗ FALSE REPORT',  cls: 'verdict--false'        },
}

function ReportDetail({ report, session, clearanceLevel, onClose, profiles, onUpdateReport, onOpenComms }) {
  const [comments, setComments]             = useState([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [newComment, setNewComment]         = useState('')
  const [submitting, setSubmitting]         = useState(false)
  const [history, setHistory]               = useState([])
  const [working, setWorking]               = useState(false)

  const meta             = INCIDENT_META[report.type] || INCIDENT_META.other
  const submitterProfile = report.user_id ? profiles?.[report.user_id] : null
  const canComment       = session && clearanceLevel >= 2
  const statusBadge      = STATUS_BADGE[report.status]

  // ── Comments ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let channel

    async function init() {
      setCommentsLoading(true)

      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('report_id', Number(report.id))
        .order('created_at', { ascending: true })

      setComments(data || [])
      setCommentsLoading(false)

      channel = supabase
        .channel(`comments-${report.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'comments',
          filter: `report_id=eq.${Number(report.id)}`,
        }, (payload) => {
          setComments(prev =>
            prev.some(c => c.id === payload.new.id) ? prev : [...prev, payload.new]
          )
        })
        .subscribe()
    }

    init()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [report.id])

  // ── Verification history (Level 3+) ────────────────────────────────────────
  useEffect(() => {
    if (clearanceLevel < 3) return
    supabase
      .from('verification_history')
      .select('*')
      .eq('report_id', Number(report.id))
      .order('created_at', { ascending: false })
      .then(({ data }) => setHistory(data || []))
  }, [report.id, clearanceLevel])

  async function applyStatus(newStatus) {
    if (working || !session) return
    setWorking(true)

    const oldStatus = report.status || 'unverified'

    const { error } = await supabase
      .from('reports')
      .update({ status: newStatus })
      .eq('id', report.id)

    if (error) { console.error(error.message); setWorking(false); return }

    await supabase.from('verification_history').insert({
      report_id:  Number(report.id),
      user_id:    session.user.id,
      old_status: oldStatus,
      new_status: newStatus,
    })

    // Refresh history
    const { data: newHistory } = await supabase
      .from('verification_history')
      .select('*')
      .eq('report_id', Number(report.id))
      .order('created_at', { ascending: false })
    setHistory(newHistory || [])

    if (onUpdateReport) onUpdateReport(report.id, newStatus)
    setWorking(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = newComment.trim()
    if (!trimmed || submitting) return

    setSubmitting(true)
    const { data: inserted, error } = await supabase
      .from('comments')
      .insert({ report_id: Number(report.id), user_id: session.user.id, content: trimmed })
      .select()
      .single()

    setSubmitting(false)
    if (!error) {
      setComments(prev => prev.some(c => c.id === inserted.id) ? prev : [...prev, inserted])
      setNewComment('')
    }
  }

  return (
    <div className="report-detail">

      <button className="detail-back-btn" onClick={onClose}>
        ‹ BACK TO LIST
      </button>

      <div className="detail-body">

        {/* Type + status + trust */}
        <div className="detail-meta">
          <span className={`badge badge--${meta.mod}`}>{meta.label}</span>
          {statusBadge && (
            <span className={`card-verdict ${statusBadge.cls}`}>{statusBadge.label}</span>
          )}
          {submitterProfile != null && (
            <span className={`trust-badge ${trustClass(submitterProfile.trust_score)}`} title="Reporter trust score">
              ◈ {submitterProfile.trust_score}
            </span>
          )}
          <time className="card-time" style={{ marginLeft: 'auto' }}>
            {formatShort(report.created_at)}
          </time>
        </div>

        <h2 className="detail-title">{report.title}</h2>

        {report.description && <p className="detail-desc">{report.description}</p>}

        {/* ── Template details (if submitted with a template) ── */}
        {report.details && Object.keys(report.details).length > 0 && (
          <div className="detail-template">
            <div className="detail-template-label">{(report.type || 'INCIDENT').toUpperCase()} DETAILS</div>
            {Object.entries(report.details).map(([key, val]) => (
              <div className="detail-template-row" key={key}>
                <span className="detail-template-key">
                  {key.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span className="detail-template-val">{val}</span>
              </div>
            ))}
          </div>
        )}

        <div className="detail-coords">
          <span className="coords-icon">⊕</span>
          <span className="coords-text">
            {parseFloat(report.latitude).toFixed(4)},&nbsp;
            {parseFloat(report.longitude).toFixed(4)}
          </span>
        </div>

        {/* Level 3+: extended + verification actions */}
        {clearanceLevel >= 3 && (
          <>
            <div className="card-details">
              <div className="card-detail-row">
                <span className="card-detail-label">REPORTER</span>
                <span className="card-detail-value">{shortId(report.user_id)}</span>
              </div>
              <div className="card-detail-row">
                <span className="card-detail-label">TIMESTAMP</span>
                <span className="card-detail-value">{formatFull(report.created_at)}</span>
              </div>
              <div className="card-detail-row">
                <span className="card-detail-label">REPORT ID</span>
                <span className="card-detail-value">#{report.id}</span>
              </div>
            </div>

            {/* Verification action buttons */}
            <div className="detail-verdict-actions">
              {clearanceLevel >= 3 && (
                <button
                  className="btn-verdict btn-verdict--review"
                  onClick={() => applyStatus('under_review')}
                  disabled={working || report.status === 'under_review'}
                >
                  ⏳ UNDER REVIEW
                </button>
              )}
              {clearanceLevel >= 5 && (
                <>
                  <button
                    className="btn-verdict btn-verdict--verified"
                    onClick={() => applyStatus('verified')}
                    disabled={working || report.status === 'verified'}
                  >
                    ✓ VERIFIED
                  </button>
                  <button
                    className="btn-verdict btn-verdict--false"
                    onClick={() => applyStatus('false')}
                    disabled={working || report.status === 'false'}
                  >
                    ✗ FALSE
                  </button>
                </>
              )}
              {onOpenComms && clearanceLevel >= 2 && (
                <button
                  className="btn-verdict btn-verdict--comms"
                  onClick={() => onOpenComms(report)}
                >
                  📡 OPEN COMMS
                </button>
              )}
            </div>

            {/* Verification history */}
            {history.length > 0 && (
              <div className="verif-history">
                <div className="verif-history-label">VERIFICATION HISTORY</div>
                {history.map(h => (
                  <div key={h.id} className="verif-history-row">
                    <span className="verif-history-who">
                      {shortId(h.user_id)}
                    </span>
                    <span className="verif-history-arrow">
                      {h.old_status || 'unverified'} → {h.new_status}
                    </span>
                    <span className="verif-history-when">{formatShort(h.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Comments */}
        <div className="comments-section">
          <div className="comments-header">
            COMMENTS
            {!commentsLoading && <span className="comments-count"> ({comments.length})</span>}
          </div>

          {commentsLoading ? (
            <div className="comment-empty">LOADING…</div>
          ) : comments.length === 0 ? (
            <div className="comment-empty">No comments yet.</div>
          ) : (
            <div className="comment-list">
              {comments.map(comment => (
                <div key={comment.id} className="comment-item">
                  <div className="comment-meta">
                    <span className="comment-author">
                      {session && comment.user_id === session.user.id ? 'YOU' : shortId(comment.user_id)}
                    </span>
                    <span className="comment-time">{formatShort(comment.created_at)}</span>
                  </div>
                  <p className="comment-content">{comment.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Comment input footer */}
      <div className="detail-footer">
        {canComment ? (
          <form className="comment-form" onSubmit={handleSubmit}>
            <input
              className="comment-input"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment…"
              disabled={submitting}
              maxLength={500}
            />
            <button
              className="comment-submit-btn"
              type="submit"
              disabled={submitting || !newComment.trim()}
            >
              SEND
            </button>
          </form>
        ) : session ? (
          <div className="comment-gate">LEVEL 2 CLEARANCE REQUIRED TO COMMENT</div>
        ) : (
          <div className="comment-gate">SIGN IN TO COMMENT</div>
        )}
      </div>

    </div>
  )
}

export default ReportDetail
