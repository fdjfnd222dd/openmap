// ─────────────────────────────────────────────────────────────────────────────
// ReportCard — a single incident card in the report list
//
// Each incident type gets a distinct color badge so you can
// quickly scan the list and identify what kind of event it is.
// ─────────────────────────────────────────────────────────────────────────────

// Maps incident type strings to display labels and CSS modifier classes.
// The CSS classes (e.g. "badge--flood") are defined in index.css.
const INCIDENT_META = {
  flood:      { label: 'FLOOD',       mod: 'flood'      },
  fire:       { label: 'FIRE',        mod: 'fire'       },
  earthquake: { label: 'EARTHQUAKE',  mod: 'earthquake' },
  other:      { label: 'OTHER',       mod: 'other'      },
}

// Formats a date string into a short human-readable form like "Mar 1 · 14:32"
function formatDate(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleString('en-US', {
    month: 'short',
    day:   'numeric',
    hour:  '2-digit',
    minute:'2-digit',
    hour12: false,
  })
}

function ReportCard({ report }) {
  const meta = INCIDENT_META[report.type] || INCIDENT_META.other

  return (
    <article className={`report-card report-card--${meta.mod}`}>
      {/* Top row: incident type badge + timestamp */}
      <div className="card-meta">
        <span className={`badge badge--${meta.mod}`}>{meta.label}</span>
        <time className="card-time">{formatDate(report.created_at)}</time>
      </div>

      {/* Incident title */}
      <h3 className="card-title">{report.title}</h3>

      {/* Optional description — only shown if it exists */}
      {report.description && (
        <p className="card-description">{report.description}</p>
      )}

      {/* Coordinates displayed in monospace font */}
      <div className="card-coords">
        <span className="coords-icon">⊕</span>
        <span className="coords-text">
          {parseFloat(report.latitude).toFixed(4)},&nbsp;
          {parseFloat(report.longitude).toFixed(4)}
        </span>
      </div>
    </article>
  )
}

export default ReportCard
