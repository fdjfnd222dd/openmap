import ReportCard from './ReportCard'

function ReportList({
  reports, loading, clearanceLevel, session,
  onUpdateReport, onSelectReport, profiles, onProfileRefresh,
}) {

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
          session={session}
          clearanceLevel={clearanceLevel}
          onUpdateReport={onUpdateReport}
          onSelectReport={onSelectReport}
          submitterProfile={profiles?.[report.user_id]}
          onProfileRefresh={onProfileRefresh}
        />
      ))}
    </div>
  )
}

export default ReportList
