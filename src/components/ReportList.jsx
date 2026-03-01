import ReportCard from './ReportCard'

// ─────────────────────────────────────────────────────────────────────────────
// ReportList — renders the scrollable list of incident reports
//
// Props:
//   reports : array of report objects from Supabase
//   loading : boolean — true while reports are being fetched from the database
// ─────────────────────────────────────────────────────────────────────────────

function ReportList({ reports, loading }) {

  // While loading, show placeholder "skeleton" cards as a visual indicator
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

  // If there are no reports yet, show a friendly empty state
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

  // Render one card per report
  return (
    <div className="report-list">
      <div className="list-section-label">RECENT INCIDENTS</div>
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  )
}

export default ReportList
