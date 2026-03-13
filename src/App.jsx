import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import ClearancePanel from './components/ClearancePanel'
import { FragordBanner, FragordBroadcast } from './components/FragordPanel'
import AuthPanel from './components/AuthPanel'

function UTCClock() {
  const [time, setTime] = useState(() => new Date().toISOString().slice(11, 19) + 'Z')
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toISOString().slice(11, 19) + 'Z'), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <>
      <span className="topnav-clock">{time}</span>
      <span className="topnav-tz">UTC</span>
    </>
  )
}

// Severity order for NWS alert sorting
const NWS_SEVERITY = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 }

const IS_PUBLIC_VIEW = new URLSearchParams(window.location.search).get('view') === 'public'

function App() {
  const [session, setSession]               = useState(null)
  const [authLoading, setAuthLoading]       = useState(true)
  const [reports, setReports]               = useState([])
  const [reportsLoading, setReportsLoading] = useState(true)

  // ── Clearance ──────────────────────────────────────────────────────────────
  const [clearanceLevel, setClearanceLevel] = useState(() => {
    document.documentElement.setAttribute('data-clearance', 1)
    return 1
  })

  // ── Map state ──────────────────────────────────────────────────────────────
  const [previewCoords, setPreviewCoords]   = useState(null)
  const [flyTarget, setFlyTarget]           = useState(null)
  const [selectedReport, setSelectedReport] = useState(null)

  // ── Filters ───────────────────────────────────────────────────────────────
  const [activeTypes,    setActiveTypes]    = useState([])
  const [activeStatuses, setActiveStatuses] = useState([])

  // ── Profiles ──────────────────────────────────────────────────────────────
  const [profiles, setProfiles] = useState({})

  // ── FRAGORD ───────────────────────────────────────────────────────────────
  const [activeFragord, setActiveFragord]   = useState(null)
  const [fragordAcked,  setFragordAcked]    = useState(() => {
    try { return JSON.parse(localStorage.getItem('hilo_acked_fragord') || 'null') } catch { return null }
  })

  // ── NWS weather alerts ────────────────────────────────────────────────────
  const [nwsAlerts,      setNwsAlerts]      = useState([])
  const [nwsDismissed,   setNwsDismissed]   = useState(false)

  // ── Sidebar fullscreen toggle ─────────────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // ── Comms channel pending (set by handleOpenComms) ─────────────────────────
  const [pendingCommsChannelId, setPendingCommsChannelId] = useState(null)

  // ── Filtered + clearance-gated reports ────────────────────────────────────
  const filteredReports = reports.filter(report => {
    if (activeTypes.length > 0 && !activeTypes.includes(report.type)) return false
    if (activeStatuses.length > 0) {
      const status = report.status || 'unverified'
      if (!activeStatuses.includes(status)) return false
    }
    return true
  })
  const leveledReports = clearanceLevel >= 2
    ? filteredReports
    : filteredReports.filter(r => r.status === 'verified')

  // ── Sync clearance accent ──────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-clearance', clearanceLevel)
  }, [clearanceLevel])

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      if (event === 'SIGNED_IN' && session) {
        await supabase.from('profiles').upsert(
          { id: session.user.id, email: session.user.email, trust_score: 0, reports_submitted: 0, reports_verified: 0 },
          { onConflict: 'id', ignoreDuplicates: true }
        )
        refreshProfile(session.user.id)
      }
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load reports ───────────────────────────────────────────────────────────
  useEffect(() => { fetchReports() }, [])

  async function fetchReports() {
    setReportsLoading(true)
    const { data, error } = await supabase
      .from('reports').select('*').order('created_at', { ascending: false })
    if (error) { console.error(error.message); setReportsLoading(false); return }
    setReports(data || [])
    const userIds = [...new Set((data || []).map(r => r.user_id).filter(Boolean))]
    if (userIds.length > 0) {
      const { data: profileRows } = await supabase.from('profiles').select('*').in('id', userIds)
      if (profileRows) {
        const map = {}; profileRows.forEach(p => { map[p.id] = p })
        setProfiles(prev => ({ ...prev, ...map }))
      }
    }
    setReportsLoading(false)
  }

  async function refreshProfile(userId) {
    if (!userId) return
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) setProfiles(prev => ({ ...prev, [data.id]: data }))
  }

  // ── Realtime reports ───────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel('reports-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, payload => {
        const inc = payload.new
        setReports(prev => prev.some(r => r.id === inc.id) ? prev : [inc, ...prev])
        if (inc.user_id) refreshProfile(inc.user_id)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports' }, payload => {
        const upd = payload.new
        setReports(prev => prev.map(r => r.id === upd.id ? { ...r, ...upd } : r))
        setSelectedReport(prev => prev?.id === upd.id ? { ...prev, ...upd } : prev)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── FRAGORD fetch + realtime ───────────────────────────────────────────────
  useEffect(() => {
    supabase.from('fragrods').select('*').eq('active', true)
      .order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setActiveFragord(data[0]) })

    const ch = supabase.channel('fragrods-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fragrods' }, payload => {
        if (payload.new.active) { setActiveFragord(payload.new); setFragordAcked(null) }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fragrods' }, () => {
        supabase.from('fragrods').select('*').eq('active', true)
          .order('created_at', { ascending: false }).limit(1)
          .then(({ data }) => setActiveFragord(data?.[0] || null))
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  function handleAcknowledgeFragord() {
    if (!activeFragord) return
    localStorage.setItem('hilo_acked_fragord', JSON.stringify(activeFragord.id))
    setFragordAcked(activeFragord.id)
  }

  // ── NWS Hawaii County alerts (zone HIZ023 = Hawaii Island) ────────────────
  useEffect(() => {
    async function fetchNWS() {
      try {
        const res  = await fetch('https://api.weather.gov/alerts/active?zone=HIZ023', {
          headers: { 'User-Agent': 'ProjectHILO/1.0 (ca-ops@example.com)' }
        })
        const json = await res.json()
        const alerts = (json.features || [])
          .filter(f => ['Warning', 'Watch', 'Advisory'].includes(f.properties.messageType)
                    || f.properties.severity === 'Extreme' || f.properties.severity === 'Severe')
          .sort((a, b) =>
            (NWS_SEVERITY[a.properties.severity] ?? 9) -
            (NWS_SEVERITY[b.properties.severity] ?? 9)
          )
          .slice(0, 3)
          .map(f => ({
            id:       f.properties.id,
            event:    f.properties.event,
            severity: f.properties.severity,
            headline: f.properties.headline,
          }))
        setNwsAlerts(alerts)
      } catch (e) {
        // NWS API occasionally unreachable — fail silently
      }
    }
    fetchNWS()
    const id = setInterval(fetchNWS, 10 * 60 * 1000) // refresh every 10 min
    return () => clearInterval(id)
  }, [])

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleMapClick(lat, lng)       { setPreviewCoords({ lat, lng }) }
  function handleCloseDetail()            { setSelectedReport(null) }
  function handleSelectReport(report)     { setFlyTarget(report); setSelectedReport(report) }
  function handleNewReport(r)             { setReports(prev => [r, ...prev]); setPreviewCoords(null) }

  function handleUpdateReport(reportId, status) {
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r))
    setSelectedReport(prev => prev?.id === reportId ? { ...prev, status } : prev)
  }

  function handleToggleType(type) {
    setActiveTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }
  function handleToggleStatus(status) {
    setActiveStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status])
  }
  function handleClearFilters() { setActiveTypes([]); setActiveStatuses([]) }

  async function handleOpenComms(report) {
    if (!report) { setPendingCommsChannelId(null); return }
    const { data: existing } = await supabase.from('channels').select('*')
      .eq('incident_id', report.id).maybeSingle()
    if (existing) { setPendingCommsChannelId(existing.id); return }
    const { data: created } = await supabase.from('channels').insert({
      name:        `INC-${report.id}: ${(report.title || 'Incident').slice(0, 30)}`,
      type:        'incident',
      incident_id: report.id,
    }).select().single()
    if (created) setPendingCommsChannelId(created.id)
  }

  const showFragord = activeFragord && activeFragord.active && fragordAcked !== activeFragord.id
  const topNwsAlert = nwsAlerts[0]
  const showNws     = topNwsAlert && !nwsDismissed

  const nwsSeverityColor = {
    Extreme:  '#f43f5e',
    Severe:   '#f97316',
    Moderate: '#f59e0b',
    Minor:    '#6a9fc0',
  }

  if (authLoading) return (
    <div className="app-loading">
      <div className="loading-spinner" />
      <span className="loading-text">INITIALIZING HILO</span>
    </div>
  )

  if (!session && !IS_PUBLIC_VIEW) return (
    <div className="login-screen">
      <div className="login-screen-grid" />
      <div className="login-screen-inner">
        <div className="login-brand">
          <span className="login-brand-mark">⬡</span>
          <div className="login-brand-text">
            <span className="login-brand-name">PROJECT HILO</span>
            <span className="login-brand-sub">321st CA · Civil Affairs Platform</span>
          </div>
        </div>
        <div className="login-card">
          <AuthPanel />
        </div>
        <div className="login-footer">
          <span className="login-footer-text">321st CA BN · Big Island Civil Affairs Platform</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="app-layout">

      {/* ── Top nav ── */}
      <nav className="app-topnav">
        <div className="topnav-brand">
          <span className="topnav-brand-mark">⬡</span>
          <span className="topnav-brand-name">PROJECT HILO</span>
          <span className="topnav-brand-sep">|</span>
          <span className="topnav-brand-sub">321st CA · Civil Affairs Platform</span>
        </div>

        <div className="topnav-center">
          <span className="topnav-live-dot" />
          <span className="topnav-live-label">LIVE</span>
          <span className="topnav-divider" />
          <UTCClock />
        </div>

        <div className="topnav-actions">
          {/* FRAGORD broadcast — L5 only, not in public view */}
          {!IS_PUBLIC_VIEW && clearanceLevel >= 5 && session && (
            <FragordBroadcast session={session} />
          )}

          <button
            className={`topnav-fullscreen-btn ${sidebarCollapsed ? 'topnav-fullscreen-btn--active' : ''}`}
            onClick={() => setSidebarCollapsed(p => !p)}
            title={sidebarCollapsed ? 'Show panel' : 'Fullscreen map'}
          >
            {sidebarCollapsed ? '◧ PANEL' : '⛶ FULLSCREEN'}
          </button>

          <button
            className="topnav-download-btn"
            onClick={() => alert('Offline package download coming soon.')}
            title="Download for offline use"
          >
            ↓ OFFLINE
          </button>

          <ClearancePanel
            clearanceLevel={clearanceLevel}
            onLevelChange={setClearanceLevel}
          />
        </div>
      </nav>

      {/* ── Public view banner ── */}
      {IS_PUBLIC_VIEW && (
        <div className="public-view-banner">
          <span className="public-view-text">
            ⬡ READ-ONLY · Showing verified incidents only
          </span>
          <a className="public-view-signin" href={window.location.origin}>
            Sign in for full access →
          </a>
        </div>
      )}

      {/* ── FRAGORD banner — full width below topnav ── */}
      {!IS_PUBLIC_VIEW && showFragord && (
        <FragordBanner
          fragord={activeFragord}
          onAcknowledge={handleAcknowledgeFragord}
        />
      )}


      {/* ── Main content ── */}
      <div className="app-content">
        <Sidebar
          collapsed={sidebarCollapsed}
          session={session}
          reports={leveledReports}
          totalCount={reports.length}
          reportsLoading={reportsLoading}
          onNewReport={handleNewReport}
          onUpdateReport={handleUpdateReport}
          onSelectReport={handleSelectReport}
          onProfileRefresh={refreshProfile}
          clearanceLevel={clearanceLevel}
          previewCoords={previewCoords}
          profiles={profiles}
          activeTypes={activeTypes}
          activeStatuses={activeStatuses}
          onToggleType={handleToggleType}
          onToggleStatus={handleToggleStatus}
          onClearFilters={handleClearFilters}
          selectedReport={selectedReport}
          onCloseDetail={handleCloseDetail}
          onOpenComms={handleOpenComms}
          pendingCommsChannelId={pendingCommsChannelId}
          onCommsClear={() => setPendingCommsChannelId(null)}
        />

        <MapView
          reports={leveledReports}
          clearanceLevel={clearanceLevel}
          previewCoords={previewCoords}
          onMapClick={handleMapClick}
          flyTarget={flyTarget}
          onSelectReport={handleSelectReport}
          nwsAlerts={nwsAlerts}
          nwsDismissed={nwsDismissed}
          onNwsDismiss={() => setNwsDismissed(true)}
          sidebarCollapsed={sidebarCollapsed}
        />
      </div>

    </div>
  )
}

export default App
