import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

// ─────────────────────────────────────────────────────────────────────────────
// ReportDetail — expanded view of a single report, shown in the sidebar
//
// Displays full report info (type, title, description, coords, level-gated
// details) plus a real-time comment thread at the bottom.
//
// Level 2+ logged-in users can post new comments.
// Real-time subscription keeps the list live without a page refresh.
// ─────────────────────────────────────────────────────────────────────────────

const INCIDENT_META = {
  flood:      { label: 'FLOOD',      mod: 'flood'      },
  fire:       { label: 'FIRE',       mod: 'fire'       },
  earthquake: { label: 'EARTHQUAKE', mod: 'earthquake' },
  other:      { label: 'OTHER',      mod: 'other'      },
}

function formatShort(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatFull(iso) {
  if (!iso) return ''
  return new Date(iso).toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
}

function shortId(uuid) {
  return uuid ? uuid.split('-')[0].toUpperCase() : '—'
}

function ReportDetail({ report, session, clearanceLevel, onClose, profiles }) {
  const [comments, setComments]             = useState([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [newComment, setNewComment]         = useState('')
  const [submitting, setSubmitting]         = useState(false)

  const meta             = INCIDENT_META[report.type] || INCIDENT_META.other
  const submitterProfile = report.user_id ? profiles?.[report.user_id] : null
  const canComment       = session && clearanceLevel >= 2

  // ── Load comments + subscribe to new ones ─────────────────────────────────
  useEffect(() => {
    let channel

    async function init() {
      setCommentsLoading(true)

      // report.id is bigint — coerce to Number so the eq filter matches correctly
      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('report_id', Number(report.id))
        .order('created_at', { ascending: true })

      setComments(data || [])
      setCommentsLoading(false)

      // Subscribe to inserts on this report only (filtered subscription)
      channel = supabase
        .channel(`comments-${report.id}`)
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'comments',
            filter: `report_id=eq.${Number(report.id)}`,
          },
          (payload) => {
            setComments((prev) => {
              // Deduplicate — the optimistic insert fires before the subscription
              if (prev.some((c) => c.id === payload.new.id)) return prev
              return [...prev, payload.new]
            })
          }
        )
        .subscribe()
    }

    init()

    return () => { if (channel) supabase.removeChannel(channel) }
  }, [report.id])

  // ── Submit a new comment ───────────────────────────────────────────────────
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
      // Optimistically add the comment before the subscription fires
      setComments((prev) => {
        if (prev.some((c) => c.id === inserted.id)) return prev
        return [...prev, inserted]
      })
      setNewComment('')
    } else {
      console.error('Comment error:', error.message)
    }
  }

  return (
    <div className="report-detail">

      {/* ── Back button ── */}
      <button className="detail-back-btn" onClick={onClose}>
        ‹ BACK TO LIST
      </button>

      {/* ── Scrollable body: report info + comments ── */}
      <div className="detail-body">

        {/* Type badge + verdict + trust score */}
        <div className="detail-meta">
          <span className={`badge badge--${meta.mod}`}>{meta.label}</span>
          {report.status && (
            <span className={`card-verdict card-verdict--${report.status}`}>
              {report.status === 'verified' ? '✓ VERIFIED' : '✗ FALSE REPORT'}
            </span>
          )}
          {submitterProfile != null && (
            <span className="trust-badge" title="Reporter trust score">
              ◈ {submitterProfile.trust_score}
            </span>
          )}
          <time className="card-time" style={{ marginLeft: 'auto' }}>
            {formatShort(report.created_at)}
          </time>
        </div>

        {/* Title */}
        <h2 className="detail-title">{report.title}</h2>

        {/* Description */}
        {report.description && (
          <p className="detail-desc">{report.description}</p>
        )}

        {/* Coordinates */}
        <div className="detail-coords">
          <span className="coords-icon">⊕</span>
          <span className="coords-text">
            {parseFloat(report.latitude).toFixed(4)},&nbsp;
            {parseFloat(report.longitude).toFixed(4)}
          </span>
        </div>

        {/* Level 3+ extended details */}
        {clearanceLevel >= 3 && (
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
        )}

        {/* ── Comments ── */}
        <div className="comments-section">
          <div className="comments-header">
            COMMENTS
            {!commentsLoading && (
              <span className="comments-count"> ({comments.length})</span>
            )}
          </div>

          {commentsLoading ? (
            <div className="comment-empty">LOADING…</div>
          ) : comments.length === 0 ? (
            <div className="comment-empty">No comments yet.</div>
          ) : (
            <div className="comment-list">
              {comments.map((comment) => (
                <div key={comment.id} className="comment-item">
                  <div className="comment-meta">
                    <span className="comment-author">
                      {session && comment.user_id === session.user.id
                        ? 'YOU'
                        : shortId(comment.user_id)}
                    </span>
                    <span className="comment-time">
                      {formatShort(comment.created_at)}
                    </span>
                  </div>
                  <p className="comment-content">{comment.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>{/* end detail-body */}

      {/* ── Fixed footer: comment input ── */}
      <div className="detail-footer">
        {canComment ? (
          <form className="comment-form" onSubmit={handleSubmit}>
            <input
              className="comment-input"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
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
          <div className="comment-gate">
            LEVEL 2 CLEARANCE REQUIRED TO COMMENT
          </div>
        ) : (
          <div className="comment-gate">
            SIGN IN TO COMMENT
          </div>
        )}
      </div>

    </div>
  )
}

export default ReportDetail
