import { useState, useEffect, useRef } from 'react'
import ReportList from './ReportList'
import ReportForm from './ReportForm'
import ReportDetail from './ReportDetail'
import AuthPanel from './AuthPanel'
import FilterBar from './FilterBar'
import SitrepPanel from './SitrepPanel'
import KLEPanel from './KLEPanel'
import ChatSidebar from './ChatSidebar'
import AnalyticsDashboard from './AnalyticsDashboard'
import PERSTATPanel from './PERSTATPanel'
import { supabase } from '../supabaseClient'
import { trustClass } from '../utils/trust'

const MEDALS = ['🥇', '🥈', '🥉']

function Sidebar({
  collapsed,
  session, reports, totalCount, reportsLoading,
  onNewReport, onUpdateReport, onSelectReport, onProfileRefresh,
  clearanceLevel, previewCoords, profiles,
  activeTypes, activeStatuses, onToggleType, onToggleStatus, onClearFilters,
  selectedReport, onCloseDetail, onOpenComms,
  pendingCommsChannelId, onCommsClear,
}) {
  const [activeTab, setActiveTab]               = useState('incidents')
  const [newIncidentNotif, setNewIncidentNotif] = useState(false)
  const [leaderboard, setLeaderboard]           = useState([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [logsSubTab, setLogsSubTab]             = useState('sitrep') // 'sitrep' | 'kle'

  const prevLengthRef = useRef(null)
  const activeTabRef  = useRef('incidents')
  const userProfile   = session ? profiles[session.user.id] : null

  // When a comms channel is requested externally (from report detail), switch to COMMS tab
  useEffect(() => {
    if (pendingCommsChannelId !== null && pendingCommsChannelId !== undefined) {
      setActiveTab('comms')
      activeTabRef.current = 'comms'
    }
  }, [pendingCommsChannelId])

  // Dynamic tab list based on clearance
  const TABS = [
    { id: 'incidents',   icon: '●',  label: 'FEED'     },
    ...(clearanceLevel >= 2 ? [{ id: 'report', icon: '+', label: 'REPORT' }] : []),
    ...(clearanceLevel >= 2 ? [{ id: 'comms',   icon: '◈', label: 'COMMS'   }] : []),
    ...(clearanceLevel >= 2 ? [{ id: 'logs',    icon: '≡', label: 'LOGS'    }] : []),
    ...(clearanceLevel >= 5 ? [{ id: 'intel',   icon: '∑', label: 'INTEL'   }] : []),
    { id: 'profile', icon: '◯', label: 'PROFILE' },
  ]

  // Notification dot for new incidents
  useEffect(() => {
    if (prevLengthRef.current === null) { prevLengthRef.current = reports.length; return }
    if (reports.length > prevLengthRef.current && activeTabRef.current !== 'incidents') {
      setNewIncidentNotif(true)
    }
    prevLengthRef.current = reports.length
  }, [reports.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Leaderboard lazy load
  useEffect(() => {
    if (activeTab === 'leaderboard') loadLeaderboard()
  }, [activeTab])

  async function loadLeaderboard() {
    setLeaderboardLoading(true)
    const { data } = await supabase
      .from('profiles').select('*').order('trust_score', { ascending: false }).limit(10)
    setLeaderboard(data || [])
    setLeaderboardLoading(false)
  }

  async function handleLogout() { await supabase.auth.signOut() }

  function handleTabChange(tab) {
    setActiveTab(tab)
    activeTabRef.current = tab
    if (tab === 'incidents') setNewIncidentNotif(false)
    if (selectedReport) onCloseDetail()
    if (tab !== 'comms' && onCommsClear) onCommsClear()
  }

  // ── Tab renderers ──────────────────────────────────────────────────────────

  function renderFeedTab() {
    return (
      <>
        <div className="status-bar">
          <div className="status-left">
            <span className="status-dot" />
            <span className="status-label">LIVE FEED</span>
          </div>
          <div className="status-right">
            {reports.length < totalCount ? (
              <span className="status-count">
                {reports.length}<span className="status-count-total"> / {totalCount}</span>
              </span>
            ) : (
              <span className="status-count">{totalCount}</span>
            )}
            <span className="status-count-label">REPORTS</span>
          </div>
        </div>

        {clearanceLevel >= 2 && (
          <FilterBar
            activeTypes={activeTypes}
            activeStatuses={activeStatuses}
            onToggleType={onToggleType}
            onToggleStatus={onToggleStatus}
            onClearAll={onClearFilters}
          />
        )}

        <div className="sidebar-list-area">
          <ReportList
            reports={reports}
            loading={reportsLoading}
            session={session}
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

  function renderReportTab() {
    if (!session) return <AuthPanel />
    if (clearanceLevel < 2) {
      return (
        <div className="clearance-gate">
          <div className="gate-icon">⬡</div>
          <p className="gate-title">VOLUNTEER CLEARANCE REQUIRED</p>
          <p className="gate-sub">Enter your clearance code in the top-right panel.</p>
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

  function renderProfileTab() {
    if (!session) {
      return (
        <div className="profile-gate">
          <div className="profile-gate-icon">◯</div>
          <p className="profile-gate-msg">Sign in to view your profile.</p>
          <AuthPanel />
        </div>
      )
    }

    const score = userProfile?.trust_score || 0
    return (
      <div className="profile-tab">
        <div className="profile-score-area">
          <span className={`trust-badge trust-badge--large ${trustClass(score)}`}>◈ {score}</span>
          <div className="profile-score-label">TRUST SCORE</div>
        </div>
        <div className="profile-divider" />
        <div className="profile-email">{session.user.email}</div>
        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat-value">{userProfile?.reports_submitted || 0}</span>
            <span className="profile-stat-label">SUBMITTED</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">{userProfile?.reports_verified || 0}</span>
            <span className="profile-stat-label">VERIFIED</span>
          </div>
        </div>
        <button className="btn-logout btn-logout--profile" onClick={handleLogout}>Sign Out</button>
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
      return <div className="leaderboard-empty"><p>No rankings yet.</p></div>
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
                {medal ? medal : <span className="leaderboard-rank-num">{rank}</span>}
              </span>
              <span className="leaderboard-email">
                {entry.email}
                {isMe && <span className="leaderboard-you-tag">YOU</span>}
              </span>
              <span className={`trust-badge ${trustClass(entry.trust_score)}`}>◈ {entry.trust_score}</span>
            </div>
          )
        })}
      </div>
    )
  }

  const isScrollTab = activeTab !== 'incidents'

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>

      {/* ── Compact top strip ── */}
      <div className="sidebar-topstrip">
        <div className="strip-brand">
          <span className="strip-hex">⬡</span>
          <span className="strip-name">HILO</span>
          <span className="strip-unit">321st CA · CAT OPS</span>
        </div>
        {session && (
          <div className="strip-user">
            <span className="strip-live-dot" />
            <span className="strip-email">{session.user.email.split('@')[0]}</span>
            <button className="strip-signout" onClick={handleLogout}>OUT</button>
          </div>
        )}
      </div>

      {/* ── Navigation tabs ── */}
      <nav className="sidebar-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`sidebar-tab ${activeTab === tab.id ? 'sidebar-tab--active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
            title={tab.label}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {tab.id === 'incidents' && newIncidentNotif && <span className="tab-notif-dot" />}
          </button>
        ))}
      </nav>

      {/* ── Content area ── */}
      {selectedReport ? (
        <ReportDetail
          report={selectedReport}
          session={session}
          clearanceLevel={clearanceLevel}
          onClose={onCloseDetail}
          profiles={profiles}
          onUpdateReport={onUpdateReport}
          onOpenComms={onOpenComms}
        />
      ) : (
        <div className={`sidebar-tab-content ${isScrollTab ? 'sidebar-tab-content--scroll' : 'sidebar-tab-content--flex'}`}>
          {activeTab === 'incidents'   && renderFeedTab()}
          {activeTab === 'report'      && renderReportTab()}
          {activeTab === 'comms'       && (
            <ChatSidebar
              inline
              session={session}
              clearanceLevel={clearanceLevel}
              isOpen={true}
              initialChannelId={pendingCommsChannelId}
            />
          )}
          {activeTab === 'logs' && (
            <>
              <div className="logs-subtabs">
                <button className={`logs-subtab ${logsSubTab === 'sitrep' ? 'logs-subtab--active' : ''}`} onClick={() => setLogsSubTab('sitrep')}>SITREP</button>
                <button className={`logs-subtab ${logsSubTab === 'kle' ? 'logs-subtab--active' : ''}`} onClick={() => setLogsSubTab('kle')}>KLE</button>
                <button className={`logs-subtab ${logsSubTab === 'perstat' ? 'logs-subtab--active' : ''}`} onClick={() => setLogsSubTab('perstat')}>PERSTAT</button>
              </div>
              {logsSubTab === 'sitrep'  && <SitrepPanel session={session} reports={reports} clearanceLevel={clearanceLevel} />}
              {logsSubTab === 'kle'     && <KLEPanel session={session} clearanceLevel={clearanceLevel} />}
              {logsSubTab === 'perstat' && <PERSTATPanel session={session} />}
            </>
          )}
          {activeTab === 'intel'       && (
            <AnalyticsDashboard inline isOpen={true} />
          )}
          {activeTab === 'profile'     && (
            <>
              {renderProfileTab()}
              <div className="profile-divider" style={{ margin: '4px 0' }} />
              {renderLeaderboardTab()}
            </>
          )}
        </div>
      )}
    </aside>
  )
}

export default Sidebar
