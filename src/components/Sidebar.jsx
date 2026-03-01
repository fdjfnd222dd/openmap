import ReportList from './ReportList'
import ReportForm from './ReportForm'
import AuthPanel from './AuthPanel'
import FilterBar from './FilterBar'
import { supabase } from '../supabaseClient'

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar — the left column (30% of the screen)
//
// The bottom panel now depends on both login status AND clearance level:
//   - Not logged in → show AuthPanel
//   - Logged in + level 1 → show upgrade nudge (can't submit without level 2)
//   - Logged in + level 2+ → show ReportForm
// ─────────────────────────────────────────────────────────────────────────────

function Sidebar({
  session,
  reports,        // already filtered — used for the list
  totalCount,     // unfiltered count — used in the status bar
  reportsLoading,
  onNewReport,
  onUpdateReport,
  onSelectReport,
  onProfileRefresh,
  clearanceLevel,
  previewCoords,
  profiles,
  activeTypes,
  activeStatuses,
  onToggleType,
  onToggleStatus,
  onClearFilters,
}) {
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  // The current user's own profile — needed by ReportForm for trust score display
  const userProfile = session ? profiles[session.user.id] : null

  // Decide what to render in the bottom panel
  function renderBottomPanel() {
    if (!session) {
      // Not logged in — show login/signup form
      return <AuthPanel />
    }

    if (clearanceLevel < 2) {
      // Logged in but public clearance — can't submit yet
      return (
        <div className="clearance-gate">
          <div className="gate-icon">⬡</div>
          <p className="gate-title">VOLUNTEER CLEARANCE REQUIRED</p>
          <p className="gate-sub">
            Enter your clearance code in the panel (top-right) to submit reports.
          </p>
        </div>
      )
    }

    // Logged in + level 2+ — show the full report form
    return (
      <ReportForm
        session={session}
        onNewReport={onNewReport}
        previewCoords={previewCoords}
        userProfile={userProfile}
        onProfileRefresh={onProfileRefresh}
      />
    )
  }

  return (
    <aside className="sidebar">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sidebar-header">
        <div className="header-brand">
          <div className="brand-eyebrow">PROJECT</div>
          <h1 className="brand-title">HILO</h1>
          <div className="brand-tagline">Incident Reporting Platform</div>
        </div>

        {session && (
          <div className="header-user">
            <div className="user-indicator">
              <span className="user-dot" />
              <span className="user-email">{session.user.email}</span>
            </div>
            <button className="btn-logout" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        )}
      </header>

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <div className="status-bar">
        <div className="status-left">
          <span className="status-dot" />
          <span className="status-label">LIVE FEED</span>
        </div>
        <div className="status-right">
          {/* Show "filtered / total" when filters are active, otherwise just total */}
          {reports.length < totalCount ? (
            <span className="status-count">{reports.length}
              <span className="status-count-total"> / {totalCount}</span>
            </span>
          ) : (
            <span className="status-count">{totalCount}</span>
          )}
          <span className="status-count-label">REPORTS</span>
        </div>
      </div>

      {/* ── Filter bar — sits between status bar and list, does not scroll ── */}
      <FilterBar
        activeTypes={activeTypes}
        activeStatuses={activeStatuses}
        onToggleType={onToggleType}
        onToggleStatus={onToggleStatus}
        onClearAll={onClearFilters}
      />

      {/* ── Scrollable report list ───────────────────────────────────────── */}
      <div className="sidebar-list-area">
        <ReportList
          reports={reports}
          loading={reportsLoading}
          clearanceLevel={clearanceLevel}
          onUpdateReport={onUpdateReport}
          onSelectReport={onSelectReport}
          profiles={profiles}
          onProfileRefresh={onProfileRefresh}
        />
      </div>

      {/* ── Bottom panel ────────────────────────────────────────────────── */}
      <div className="sidebar-bottom">
        {renderBottomPanel()}
      </div>

    </aside>
  )
}

export default Sidebar
