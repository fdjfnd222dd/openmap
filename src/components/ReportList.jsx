import ReportCard from './ReportCard'

// ─────────────────────────────────────────────────────────────────────────────
// ReportList — renders the scrollable list of incident reports
//
// Now passes `clearanceLevel` and `onUpdateReport` down to each ReportCard
// so cards can show level-gated content.
// ─────────────────────────────────────────────────────────────────────────────

function ReportList({ reports, loading, clearanceLevel, onUpdateReport, onSelectReport }) {

  if (loading) {
    return (
      <div className="report-list">
        <div className="list-section-label">RECENT INCIDENTS</div>
        <div className="skeleton-card" />
        <div className="skeleton-card" />
        <div className="skeleton-card" />
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="report-list">
        <div className="list-section-label">RECENT INCIDENTS</div>
        <div className="empty-state">
          <div className="empty-icon">◎</div>
          <p className="empty-title">No incidents reported</p>
          <p className="empty-sub">All clear — the map is quiet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="report-list">
      <div className="list-section-label">RECENT INCIDENTS</div>
      {reports.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
          clearanceLevel={clearanceLevel}
          onUpdateReport={onUpdateReport}
          onSelectReport={onSelectReport}
        />
      ))}
    </div>
  )
}

export default ReportList
