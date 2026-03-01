import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'

// ─────────────────────────────────────────────────────────────────────────────
// App — the root component
//
// This component is responsible for:
//   1. Tracking whether the user is logged in (the "session")
//   2. Loading all incident reports from Supabase on startup
//   3. Passing data down to the Sidebar (left panel) and MapView (right panel)
// ─────────────────────────────────────────────────────────────────────────────

function App() {
  // `session` holds the logged-in user's session object, or null if logged out.
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // `reports` is the list of incident objects shown in the sidebar list and on the map.
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(true)

  // ── Step 1: Check if the user is already logged in when the app opens ──────
  useEffect(() => {
    // getSession() reads any saved session from localStorage (so users stay
    // logged in after refreshing the page).
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })

    // onAuthStateChange fires whenever the user logs in or out.
    // This keeps our `session` state in sync automatically.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    // Cleanup: unsubscribe when the App component unmounts (good practice).
    return () => subscription.unsubscribe()
  }, []) // The empty array means this runs once when the app first loads.

  // ── Step 2: Load all reports from the database when the app opens ──────────
  useEffect(() => {
    fetchReports()
  }, [])

  // Fetches all rows from the "reports" table, ordered newest-first.
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

  // ── Step 3: Handle a newly submitted report ────────────────────────────────
  // When a user submits the form, we add the new report to the front of the
  // list immediately (optimistic update), so it appears without a page refresh.
  function handleNewReport(newReport) {
    setReports((prev) => [newReport, ...prev])
  }

  // Show a loading screen while we check for a saved session
  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <span className="loading-text">INITIALIZING HILO</span>
      </div>
    )
  }

  return (
    // The top-level layout: a two-column flexbox container
    <div className="app-layout">
      {/* LEFT COLUMN (30%): report list + auth panel or submission form */}
      <Sidebar
        session={session}
        reports={reports}
        reportsLoading={reportsLoading}
        onNewReport={handleNewReport}
      />

      {/* RIGHT COLUMN (70%): the interactive Leaflet map */}
      <MapView reports={reports} />
    </div>
  )
}

export default App
