import ReportList from './ReportList'
import ReportForm from './ReportForm'
import AuthPanel from './AuthPanel'
import { supabase } from '../supabaseClient'

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar — the left column (30% of the screen)
//
// Contains:
//   - The app header (title, status, user info)
//   - A scrollable list of submitted reports
//   - Either the AuthPanel (if logged out) or the ReportForm (if logged in)
// ─────────────────────────────────────────────────────────────────────────────

function Sidebar({ session, reports, reportsLoading, onNewReport }) {

  // Sign the current user out when they click "Sign Out"
  async function handleLogout() {
    await supabase.auth.signOut()
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

        {/* Show user email + logout button when a session is active */}
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

      {/* ── Report list — scrollable, fills available space ─────────────── */}
      {/* This div uses flex-grow so the list takes up all space between
          the header and the bottom panel */}
      <div className="sidebar-list-area">
        <ReportList reports={reports} loading={reportsLoading} />
      </div>

      {/* ── Bottom panel: auth form (logged out) or submit form (logged in) */}
      <div className="sidebar-bottom">
        {session ? (
          <ReportForm session={session} onNewReport={onNewReport} />
        ) : (
          <AuthPanel />
        )}
      </div>

    </aside>
  )
}

export default Sidebar
