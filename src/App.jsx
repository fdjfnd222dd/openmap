import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import ClearancePanel from './components/ClearancePanel'

// ─────────────────────────────────────────────────────────────────────────────
// App — the root component
//
// Manages three pieces of global state:
//   1. `session`        — whether a user is logged in
//   2. `reports`        — the list of all incidents
//   3. `clearanceLevel` — the user's current access level (1–5)
//   4. `previewCoords`  — coordinates of a pending (not yet submitted) pin
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
        reports={reports}
        reportsLoading={reportsLoading}
        onNewReport={handleNewReport}
        onUpdateReport={handleUpdateReport}
        clearanceLevel={clearanceLevel}
        previewCoords={previewCoords}
      />

      {/* RIGHT: full-height interactive map */}
      <MapView
        reports={reports}
        clearanceLevel={clearanceLevel}
        previewCoords={previewCoords}
        onMapClick={handleMapClick}
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
