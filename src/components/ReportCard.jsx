import { useState } from 'react'
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

// Status badge config
const STATUS_BADGE = {
  verified:     { label: '✓ VERIFIED',     cls: 'verdict--verified'     },
  under_review: { label: '⏳ UNDER REVIEW', cls: 'verdict--under-review' },
  false:        { label: '✗ FALSE REPORT',  cls: 'verdict--false'        },
}

function ReportCard({
  report, session, clearanceLevel,
  onUpdateReport, onSelectReport,
  submitterProfile, onProfileRefresh,
}) {
  const meta      = INCIDENT_META[report.type] || INCIDENT_META.other
  const [working, setWorking] = useState(false)

  async function applyStatus(newStatus) {
    if (working) return
    setWorking(true)

    const oldStatus = report.status || 'unverified'

    // Update report status
    const { error } = await supabase
      .from('reports')
      .update({ status: newStatus })
      .eq('id', report.id)

    if (error) { console.error('Status update error:', error.message); setWorking(false); return }

    // Log to verification_history
    if (session) {
      await supabase.from('verification_history').insert({
        report_id:  Number(report.id),
        user_id:    session.user.id,
        user_email: session.user.email,
        old_status: oldStatus,
        new_status: newStatus,
      })
    }

    // Trust score adjustment for verified / false
    if (report.user_id && (newStatus === 'verified' || newStatus === 'false')) {
      const currentScore    = submitterProfile?.trust_score    || 0
      const currentVerified = submitterProfile?.reports_verified || 0
      if (newStatus === 'verified') {
        await supabase.from('profiles')
          .update({ trust_score: currentScore + 10, reports_verified: currentVerified + 1 })
          .eq('id', report.user_id)
      } else {
        await supabase.from('profiles')
          .update({ trust_score: Math.max(0, currentScore - 5) })
          .eq('id', report.user_id)
      }
      onProfileRefresh(report.user_id)
    }

    onUpdateReport(report.id, newStatus)
    setWorking(false)
  }

  const statusBadge = STATUS_BADGE[report.status]

  return (
    <article
      className={`report-card report-card--${meta.mod} report-card--clickable`}
      onClick={() => onSelectReport(report)}
      title="Click to jump to this pin on the map"
    >

      {/* Top row */}
      <div className="card-meta">
        <span className={`badge badge--${meta.mod}`}>{meta.label}</span>
        <div className="card-meta-right">
          {submitterProfile != null && (
            <span
              className={`trust-badge ${trustClass(submitterProfile.trust_score)}`}
              title={`Reporter trust score: ${submitterProfile.trust_score}`}
            >
              ◈ {submitterProfile.trust_score}
            </span>
          )}
          <time className="card-time">{formatShort(report.created_at)}</time>
        </div>
      </div>

      {/* Status badge */}
      {statusBadge && (
        <div className={`card-verdict ${statusBadge.cls}`}>
          {statusBadge.label}
        </div>
      )}

      <h3 className="card-title">{report.title}</h3>

      {report.description && (
        <p className="card-description">{report.description}</p>
      )}

      <div className="card-coords">
        <span className="coords-icon">⊕</span>
        <span className="coords-text">
          {parseFloat(report.latitude).toFixed(4)},&nbsp;
          {parseFloat(report.longitude).toFixed(4)}
        </span>
      </div>

      {/* Verdict action buttons — stop propagation so card flyTo doesn't fire */}
      {clearanceLevel >= 3 && (
        <div className="card-verdict-actions" onClick={e => e.stopPropagation()}>
          {/* Level 3+: mark under review */}
          {clearanceLevel >= 3 && clearanceLevel < 5 && (
            <button
              className="btn-verdict btn-verdict--review"
              onClick={() => applyStatus('under_review')}
              disabled={working || report.status === 'under_review'}
            >
              ⏳ UNDER REVIEW
            </button>
          )}
          {/* Level 5: full verdict */}
          {clearanceLevel >= 5 && (
            <>
              <button
                className="btn-verdict btn-verdict--review"
                onClick={() => applyStatus('under_review')}
                disabled={working || report.status === 'under_review'}
              >
                ⏳ REVIEW
              </button>
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
        </div>
      )}

    </article>
  )
}

export default ReportCard
