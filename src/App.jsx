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
//
// `filteredReports` is computed (not stored) from reports + active filters
// and is what gets passed to the Sidebar list and MapView pins.
// ─────────────────────────────────────────────────────────────────────────────

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(true)

  // ── Clearance level (1–5, default is PUBLIC = 1) ──────────────────────────
  // We use a lazy initializer (the function passed to useState) to set the
  // data-clearance attribute on the root element SYNCHRONOUSLY on the very
  // first render — this prevents any brief flash of the wrong accent color.
  const [clearanceLevel, setClearanceLevel] = useState(() => {
    document.documentElement.setAttribute('data-clearance', 1)
    return 1
  })

  // ── Preview pin — set when the user clicks the map ───────────────────────
  // { lat: number, lng: number } or null when there is no pending pin.
  const [previewCoords, setPreviewCoords] = useState(null)

  // ── Fly target — set when the user clicks a report card ──────────────────
  // MapView watches this and calls Leaflet's flyTo() to pan/zoom to the report.
  const [flyTarget, setFlyTarget] = useState(null)

  // ── Filter state ──────────────────────────────────────────────────────────
  // Each is an array of active filter values. Empty array = no filter (show all).
  const [activeTypes,    setActiveTypes]    = useState([])
  const [activeStatuses, setActiveStatuses] = useState([])

  // Derived value: the filtered subset of reports shown in the list and on the map.
  // This is computed on every render — no need to store it in state.
  const filteredReports = reports.filter((report) => {
    // Type filter: skip if this type is not in the active set
    if (activeTypes.length > 0 && !activeTypes.includes(report.type)) return false

    // Status filter: treat null/undefined status as 'unverified'
    if (activeStatuses.length > 0) {
      const status = report.status || 'unverified'
      if (!activeStatuses.includes(status)) return false
    }

    return true
  })

  // Whenever the clearance level changes, update the CSS data attribute so that
  // the accent color CSS variables switch instantly across the whole UI.
  useEffect(() => {
    document.documentElement.setAttribute('data-clearance', clearanceLevel)
  }, [clearanceLevel])

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Load reports ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchReports()
  }, [])

  // ── Real-time subscription ─────────────────────────────────────────────────
  // Listens for INSERT events on the reports table so new reports from ANY
  // user appear on the map and in the list without a page refresh.
  //
  // IMPORTANT: For this to work you must enable Realtime for your reports table
  // in Supabase. Go to: Database → Replication → select the `reports` table.
  useEffect(() => {
    const channel = supabase
      .channel('reports-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports' },
        (payload) => {
          const incoming = payload.new
          // Avoid adding duplicates: if THIS user just submitted the report,
          // handleNewReport already added it optimistically, so we skip it.
          setReports((prev) => {
            if (prev.some((r) => r.id === incoming.id)) return prev
            return [incoming, ...prev]
          })
        }
      )
      .subscribe()

    // Unsubscribe when the component unmounts to avoid memory leaks
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchReports() {
    setReportsLoading(true)

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching reports:', error.message)
    } else {
      setReports(data || [])
    }

    setReportsLoading(false)
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  // Called when the user clicks on the map — places a preview pin
  function handleMapClick(lat, lng) {
    setPreviewCoords({ lat, lng })
  }

  // Called when the form is submitted — adds the report to the list,
  // removes the preview pin, and clears it from the map.
  function handleNewReport(newReport) {
    setReports((prev) => [newReport, ...prev])
    setPreviewCoords(null)
  }

  // Called when a user clicks a report card — triggers the map to fly to it.
  function handleSelectReport(report) {
    setFlyTarget(report)
  }

  // Toggle a type in or out of the active type filters
  function handleToggleType(type) {
    setActiveTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  // Toggle a status in or out of the active status filters
  function handleToggleStatus(status) {
    setActiveStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
  }

  // Clear all active filters at once
  function handleClearFilters() {
    setActiveTypes([])
    setActiveStatuses([])
  }

  // Called by Level 5 users to mark a report as 'verified' or 'false'.
  // Updates the local state optimistically so the UI responds instantly.
  function handleUpdateReport(reportId, status) {
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status } : r))
    )
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
      {/* LEFT: report list + auth or submit form */}
      <Sidebar
        session={session}
        reports={filteredReports}
        totalCount={reports.length}
        reportsLoading={reportsLoading}
        onNewReport={handleNewReport}
        onUpdateReport={handleUpdateReport}
        onSelectReport={handleSelectReport}
        clearanceLevel={clearanceLevel}
        previewCoords={previewCoords}
        activeTypes={activeTypes}
        activeStatuses={activeStatuses}
        onToggleType={handleToggleType}
        onToggleStatus={handleToggleStatus}
        onClearFilters={handleClearFilters}
      />

      {/* RIGHT: full-height interactive map — uses filteredReports so pins match the list */}
      <MapView
        reports={filteredReports}
        clearanceLevel={clearanceLevel}
        previewCoords={previewCoords}
        onMapClick={handleMapClick}
        flyTarget={flyTarget}
      />

      {/* OVERLAY: clearance level panel — floats over the top-right of the map */}
      <ClearancePanel
        clearanceLevel={clearanceLevel}
        onLevelChange={setClearanceLevel}
      />
    </div>
  )
}

export default App
