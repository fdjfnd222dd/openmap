import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import ClearancePanel from './components/ClearancePanel'

// ─────────────────────────────────────────────────────────────────────────────
// App — the root component
//
// Manages global state:
//   1. `session`         — whether a user is logged in
//   2. `reports`         — the full unfiltered list of all incidents
//   3. `clearanceLevel`  — the user's current access level (1–5)
//   4. `previewCoords`   — coordinates of a pending (not yet submitted) pin
//   5. `flyTarget`       — report the map should fly to when a card is clicked
//   6. `activeTypes`     — type filters currently active (empty = show all)
//   7. `activeStatuses`  — status filters currently active (empty = show all)
//   8. `profiles`        — map of { userId → profile } for trust score display
//
// `filteredReports` is computed (not stored) from reports + active filters.
// ─────────────────────────────────────────────────────────────────────────────

function App() {
  const [session, setSession]               = useState(null)
  const [authLoading, setAuthLoading]       = useState(true)
  const [reports, setReports]               = useState([])
  const [reportsLoading, setReportsLoading] = useState(true)

  // ── Clearance level ───────────────────────────────────────────────────────
  const [clearanceLevel, setClearanceLevel] = useState(() => {
    document.documentElement.setAttribute('data-clearance', 1)
    return 1
  })

  // ── Map interaction state ─────────────────────────────────────────────────
  const [previewCoords, setPreviewCoords]     = useState(null)
  const [flyTarget, setFlyTarget]             = useState(null)
  // selectedReport drives the detail panel — set when any card or map pin is clicked
  const [selectedReport, setSelectedReport]   = useState(null)

  // ── Filter state ──────────────────────────────────────────────────────────
  const [activeTypes,    setActiveTypes]    = useState([])
  const [activeStatuses, setActiveStatuses] = useState([])

  // ── Profiles — keyed by user ID ───────────────────────────────────────────
  // Stores trust score, reports_submitted, and reports_verified for each
  // user whose reports we've loaded. Updated after submissions and verdicts.
  const [profiles, setProfiles] = useState({})

  // Computed filtered reports (not stored in state)
  const filteredReports = reports.filter((report) => {
    if (activeTypes.length > 0 && !activeTypes.includes(report.type)) return false
    if (activeStatuses.length > 0) {
      const status = report.status || 'unverified'
      if (!activeStatuses.includes(status)) return false
    }
    return true
  })

  // ── CSS accent color for clearance level ─────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-clearance', clearanceLevel)
  }, [clearanceLevel])

  // ── Auth — listen for login/logout events ─────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)

      // When a user signs in for the first time, create their profile row.
      // `ignoreDuplicates: true` means if the row already exists, do nothing —
      // so existing trust scores are never accidentally reset.
      if (event === 'SIGNED_IN' && session) {
        await supabase.from('profiles').upsert(
          {
            id:                session.user.id,
            email:             session.user.email,
            trust_score:       0,
            reports_submitted: 0,
            reports_verified:  0,
          },
          { onConflict: 'id', ignoreDuplicates: true }
        )
        // Load this user's profile into state (creates or loads existing)
        refreshProfile(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load reports ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchReports()
  }, [])

  async function fetchReports() {
    setReportsLoading(true)

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching reports:', error.message)
      setReportsLoading(false)
      return
    }

    setReports(data || [])

    // Batch-fetch profiles for every unique submitter in one query.
    // This powers the trust score badges on each report card.
    const userIds = [...new Set((data || []).map(r => r.user_id).filter(Boolean))]
    if (userIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)

      if (profileRows) {
        const map = {}
        profileRows.forEach(p => { map[p.id] = p })
        setProfiles(prev => ({ ...prev, ...map }))
      }
    }

    setReportsLoading(false)
  }

  // Fetches and caches a single profile by user ID.
  // Called after submissions and verdicts to keep scores current.
  async function refreshProfile(userId) {
    if (!userId) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) {
      setProfiles(prev => ({ ...prev, [data.id]: data }))
    }
  }

  // ── Real-time subscription ────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('reports-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports' },
        (payload) => {
          const incoming = payload.new
          setReports((prev) => {
            if (prev.some((r) => r.id === incoming.id)) return prev
            return [incoming, ...prev]
          })
          // Also ensure the submitter's profile is loaded for the trust badge
          if (incoming.user_id) {
            refreshProfile(incoming.user_id)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleMapClick(lat, lng) { setPreviewCoords({ lat, lng }) }

  // Fly the map to the report AND open the detail panel
  function handleSelectReport(report) {
    setFlyTarget(report)
    setSelectedReport(report)
  }

  function handleCloseDetail() { setSelectedReport(null) }

  function handleNewReport(newReport) {
    setReports((prev) => [newReport, ...prev])
    setPreviewCoords(null)
  }

  function handleUpdateReport(reportId, status) {
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status } : r))
    )
    // Keep the detail panel in sync if the updated report is currently open
    setSelectedReport((prev) =>
      prev && prev.id === reportId ? { ...prev, status } : prev
    )
  }

  function handleToggleType(type) {
    setActiveTypes((prev) =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  function handleToggleStatus(status) {
    setActiveStatuses((prev) =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    )
  }

  function handleClearFilters() {
    setActiveTypes([])
    setActiveStatuses([])
  }

  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <span className="loading-text">INITIALIZING HILO</span>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar
        session={session}
        reports={filteredReports}
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
      />

      <MapView
        reports={filteredReports}
        clearanceLevel={clearanceLevel}
        previewCoords={previewCoords}
        onMapClick={handleMapClick}
        flyTarget={flyTarget}
        onSelectReport={handleSelectReport}
      />

      <ClearancePanel
        clearanceLevel={clearanceLevel}
        onLevelChange={setClearanceLevel}
      />
    </div>
  )
}

export default App
