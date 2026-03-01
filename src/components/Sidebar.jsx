import { useState, useEffect, useRef } from 'react'
import ReportList from './ReportList'
import ReportForm from './ReportForm'
import ReportDetail from './ReportDetail'
import AuthPanel from './AuthPanel'
import FilterBar from './FilterBar'
import { supabase } from '../supabaseClient'
import { trustClass } from '../utils/trust'

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar — the left column (40% of the screen)
//
// Four tabs replace the old list + bottom-panel layout:
//   TAB 1 — NEW REPORT    : submit form (clearance 2+) or auth/gate
//   TAB 2 — INCIDENTS     : live feed list with notification dot
//   TAB 3 — PROFILE       : current user's trust stats
//   TAB 4 — LEADERBOARD   : top-10 by trust score with medal rows
//
// When `selectedReport` is set the tab content area is replaced by
// ReportDetail; the tab bar stays visible and clicking any tab closes
// the detail and returns to that tab.
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'report',      icon: '+',  label: 'NEW REPORT'  },
  { id: 'incidents',   icon: '📡', label: 'INCIDENTS'   },
  { id: 'profile',     icon: '👤', label: 'PROFILE'     },
  { id: 'leaderboard', icon: '🏆', label: 'LEADERBOARD' },
]

const MEDALS = ['🥇', '🥈', '🥉']

function Sidebar({
  session,
  reports,
  totalCount,
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
  selectedReport,
  onCloseDetail,
}) {
  const [activeTab, setActiveTab]               = useState('incidents')
  const [newIncidentNotif, setNewIncidentNotif] = useState(false)
  const [leaderboard, setLeaderboard]           = useState([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)

  // Track previous reports.length to detect incoming real-time reports
  const prevLengthRef  = useRef(null)
  // Mirror activeTab in a ref so the effect below doesn't need it as a dep
  const activeTabRef   = useRef('incidents')

  const userProfile = session ? profiles[session.user.id] : null

  // ── Notification dot ──────────────────────────────────────────────────────
  // First render: seed the ref; afterwards detect increases
  useEffect(() => {
    if (prevLengthRef.current === null) {
      prevLengthRef.current = reports.length
      return
    }
    if (reports.length > prevLengthRef.current && activeTabRef.current !== 'incidents') {
      setNewIncidentNotif(true)
    }
    prevLengthRef.current = reports.length
  }, [reports.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Leaderboard — load lazily when tab opens ───────────────────────────────
  useEffect(() => {
    if (activeTab === 'leaderboard') loadLeaderboard()
  }, [activeTab])

  async function loadLeaderboard() {
    setLeaderboardLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('trust_score', { ascending: false })
      .limit(10)
    setLeaderboard(data || [])
    setLeaderboardLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function handleTabChange(tab) {
    setActiveTab(tab)
    activeTabRef.current = tab
    if (tab === 'incidents') setNewIncidentNotif(false)
    if (selectedReport) onCloseDetail()
  }

  // ── Tab content renderers ──────────────────────────────────────────────────

  function renderNewReportTab() {
    if (!session) return <AuthPanel />

    if (clearanceLevel < 2) {
      return (
        <div className="clearance-gate">
          <div className="gate-icon">⬡</div>
          <p className="gate-title">VOLUNTEER CLEARANCE REQUIRED</p>
          <p className="gate-sub">
            Enter your clearance code in the top-right panel to submit reports.
          </p>
        </div>
      )
    }

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

  function renderIncidentsTab() {
    return (
      <>
        {/* Status bar */}
        <div className="status-bar">
          <div className="status-left">
            <span className="status-dot" />
            <span className="status-label">LIVE FEED</span>
          </div>
          <div className="status-right">
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

        {/* Filter bar */}
        <FilterBar
          activeTypes={activeTypes}
          activeStatuses={activeStatuses}
          onToggleType={onToggleType}
          onToggleStatus={onToggleStatus}
          onClearAll={onClearFilters}
        />

        {/* Scrollable report list */}
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
      </>
    )
  }

  function renderProfileTab() {
    if (!session) {
      return (
        <div className="profile-gate">
          <div className="profile-gate-icon">👤</div>
          <p className="profile-gate-msg">Sign in to view your profile.</p>
        </div>
      )
    }

    const score = userProfile?.trust_score || 0

    return (
      <div className="profile-tab">
        {/* Trust score — large and prominent */}
        <div className="profile-score-area">
          <span className={`trust-badge trust-badge--large ${trustClass(score)}`}>
            ◈ {score}
          </span>
          <div className="profile-score-label">TRUST SCORE</div>
        </div>

        <div className="profile-divider" />

        {/* Email */}
        <div className="profile-email">{session.user.email}</div>

        {/* Stats grid */}
        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat-value">
              {userProfile?.reports_submitted || 0}
            </span>
            <span className="profile-stat-label">SUBMITTED</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">
              {userProfile?.reports_verified || 0}
            </span>
            <span className="profile-stat-label">VERIFIED</span>
          </div>
        </div>

        <button className="btn-logout btn-logout--profile" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    )
  }

  function renderLeaderboardTab() {
    if (leaderboardLoading) {
      return (
        <div className="leaderboard-loading">
          <div className="loading-spinner" />
          <span className="loading-text">LOADING RANKINGS…</span>
        </div>
      )
    }

    if (leaderboard.length === 0) {
      return (
        <div className="leaderboard-empty">
          <p>No rankings yet.</p>
        </div>
      )
    }

    return (
      <div className="leaderboard-list">
        <div className="list-section-label">TOP TRUST RANKINGS</div>
        {leaderboard.map((entry, index) => {
          const rank  = index + 1
          const isMe  = session && entry.id === session.user.id
          const medal = MEDALS[index] || null

          return (
            <div
              key={entry.id}
              className={[
                'leaderboard-row',
                rank <= 3 ? `leaderboard-row--rank-${rank}` : '',
                isMe      ? 'leaderboard-row--me'            : '',
              ].join(' ')}
            >
              <span className="leaderboard-medal">
                {medal
                  ? medal
                  : <span className="leaderboard-rank-num">{rank}</span>
                }
              </span>
              <span className="leaderboard-email">
                {entry.email}
                {isMe && <span className="leaderboard-you-tag">YOU</span>}
              </span>
              <span className={`trust-badge ${trustClass(entry.trust_score)}`}>
                ◈ {entry.trust_score}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <aside className="sidebar">

      {/* ── Header ── */}
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

      {/* ── Tab bar ── */}
      <nav className="sidebar-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-tab ${activeTab === tab.id ? 'sidebar-tab--active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {tab.id === 'incidents' && newIncidentNotif && (
              <span className="tab-notif-dot" />
            )}
          </button>
        ))}
      </nav>

      {/* ── Content area — detail panel overrides tab content ── */}
      {selectedReport ? (
        <ReportDetail
          report={selectedReport}
          session={session}
          clearanceLevel={clearanceLevel}
          onClose={onCloseDetail}
          profiles={profiles}
        />
      ) : (
        <div className={`sidebar-tab-content ${
          activeTab === 'incidents'
            ? 'sidebar-tab-content--flex'
            : 'sidebar-tab-content--scroll'
        }`}>
          {activeTab === 'report'      && renderNewReportTab()}
          {activeTab === 'incidents'   && renderIncidentsTab()}
          {activeTab === 'profile'     && renderProfileTab()}
          {activeTab === 'leaderboard' && renderLeaderboardTab()}
        </div>
      )}

    </aside>
  )
}

export default Sidebar
