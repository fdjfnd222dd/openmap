import ReportList from './ReportList'
import ReportForm from './ReportForm'
import AuthPanel from './AuthPanel'
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
  reports,
  reportsLoading,
  onNewReport,
  onUpdateReport,
  onSelectReport,
  clearanceLevel,
  previewCoords,
}) {
  async function handleLogout() {
    await supabase.auth.signOut()
  }

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
          <span className="status-count">{reports.length}</span>
          <span className="status-count-label">REPORTS</span>
        </div>
      </div>

      {/* ── Scrollable report list ───────────────────────────────────────── */}
      <div className="sidebar-list-area">
        <ReportList
          reports={reports}
          loading={reportsLoading}
          clearanceLevel={clearanceLevel}
          onUpdateReport={onUpdateReport}
          onSelectReport={onSelectReport}
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
