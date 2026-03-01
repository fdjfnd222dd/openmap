import { useState } from 'react'
import { supabase } from '../supabaseClient'

// ─────────────────────────────────────────────────────────────────────────────
// ReportCard — a single incident in the sidebar list
//
// Clearance-gated content:
//   Level 1–2 : title, type badge, short timestamp, description, coordinates
//   Level 3+  : also shows user ID and exact full timestamp
//   Level 5   : also shows "Mark Verified" and "Mark False" action buttons
//
// NOTE: The "Mark Verified / Mark False" feature requires a `status` column
// in your Supabase `reports` table. Add it with:
//   ALTER TABLE reports ADD COLUMN status text;
// ─────────────────────────────────────────────────────────────────────────────

const INCIDENT_META = {
  flood:      { label: 'FLOOD',      mod: 'flood'      },
  fire:       { label: 'FIRE',       mod: 'fire'       },
  earthquake: { label: 'EARTHQUAKE', mod: 'earthquake' },
  other:      { label: 'OTHER',      mod: 'other'      },
}

// Short timestamp for standard view: "Mar 1 · 14:32"
function formatShort(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', {
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// Full timestamp for level 3+ view: "2026-03-01 14:32:05 UTC"
function formatFull(iso) {
  if (!iso) return ''
  return new Date(iso).toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
}

// Shortens a UUID for display: "a1b2c3d4-..." → "a1b2c3d4"
function shortId(uuid) {
  return uuid ? uuid.split('-')[0].toUpperCase() : '—'
}

function ReportCard({ report, clearanceLevel, onUpdateReport, onSelectReport }) {
  const meta = INCIDENT_META[report.type] || INCIDENT_META.other

  const [verifying, setVerifying] = useState(false)

  // Called by level 5 users to mark a report verified or false
  async function handleVerdict(status) {
    setVerifying(true)

    const { error } = await supabase
      .from('reports')
      .update({ status })
      .eq('id', report.id)

    setVerifying(false)

    if (error) {
      console.error('Verdict error:', error.message)
    } else {
      // Update the parent's state so the card reflects the change instantly
      onUpdateReport(report.id, status)
    }
  }

  return (
    // Clicking the card calls onSelectReport, which triggers the map to fly
    // to this report's pin via FlyController in MapView.
    <article
      className={`report-card report-card--${meta.mod} report-card--clickable`}
      onClick={() => onSelectReport(report)}
      title="Click to jump to this pin on the map"
    >

      {/* ── Top row: type badge + timestamp ── */}
      <div className="card-meta">
        <span className={`badge badge--${meta.mod}`}>{meta.label}</span>
        <time className="card-time">{formatShort(report.created_at)}</time>
      </div>

      {/* ── Verification status badge (if set) ── */}
      {report.status && (
        <div className={`card-verdict card-verdict--${report.status}`}>
          {report.status === 'verified' ? '✓ VERIFIED' : '✗ FALSE REPORT'}
        </div>
      )}

      {/* ── Title ── */}
      <h3 className="card-title">{report.title}</h3>

      {/* ── Description ── */}
      {report.description && (
        <p className="card-description">{report.description}</p>
      )}

      {/* ── Standard coordinates ── */}
      <div className="card-coords">
        <span className="coords-icon">⊕</span>
        <span className="coords-text">
          {parseFloat(report.latitude).toFixed(4)},&nbsp;
          {parseFloat(report.longitude).toFixed(4)}
        </span>
      </div>

      {/* ── Level 3+: extended details ── */}
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

      {/* ── Level 5: verify / false action buttons ── */}
      {/* stopPropagation prevents the card's onClick (flyTo) from firing
          when the user clicks one of these buttons */}
      {clearanceLevel >= 5 && (
        <div className="card-verdict-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="btn-verdict btn-verdict--verified"
            onClick={() => handleVerdict('verified')}
            disabled={verifying || report.status === 'verified'}
          >
            ✓ VERIFIED
          </button>
          <button
            className="btn-verdict btn-verdict--false"
            onClick={() => handleVerdict('false')}
            disabled={verifying || report.status === 'false'}
          >
            ✗ FALSE
          </button>
        </div>
      )}

    </article>
  )
}

export default ReportCard
