import { useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// ClearancePanel — floating overlay in the top-right corner of the screen
//
// Displays the user's current clearance level and lets them enter a password
// to upgrade. Each level unlocks additional features in the app.
//
// Level 1 PUBLIC      — view map and reports (default for everyone)
// Level 2 VOLUNTEER   — can submit incident reports
// Level 3 COORDINATOR — sees extended report details (user ID, exact timestamp)
// Level 4 RESPONDER   — can toggle a heatmap density layer on the map
// Level 5 COMMAND     — can mark any report as verified or false in Supabase
// ─────────────────────────────────────────────────────────────────────────────

// Hardcoded level definitions.
// In a real app you would verify passwords server-side — never expose secrets
// in frontend code for a production system. For this personal tool, hardcoded
// passwords are fine.
const LEVELS = {
  1: { name: 'PUBLIC',      color: '#64748b', password: null           },
  2: { name: 'VOLUNTEER',   color: '#22d3ee', password: 'volunteer2'   },
  3: { name: 'COORDINATOR', color: '#a3e635', password: 'coordinator3' },
  4: { name: 'RESPONDER',   color: '#fb923c', password: 'responder4'   },
  5: { name: 'COMMAND',     color: '#f43f5e', password: 'command5'     },
}

function ClearancePanel({ clearanceLevel, onLevelChange }) {
  const [expanded, setExpanded]   = useState(false)
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState(null)

  const current    = LEVELS[clearanceLevel]
  const isMaxLevel = clearanceLevel >= 5

  // Try to upgrade using the entered password.
  // Accepts passwords for any level above the current one — so entering
  // "command5" while at level 1 will jump directly to level 5.
  function handleUpgrade() {
    setError(null)

    const match = Object.entries(LEVELS).find(
      ([lvl, cfg]) => parseInt(lvl) > clearanceLevel && cfg.password === password
    )

    if (match) {
      onLevelChange(parseInt(match[0]))
      setPassword('')
      setExpanded(false)
    } else {
      setError('Invalid clearance code')
    }
  }

  // Reset all the way back to level 1 (PUBLIC)
  function handleRevoke() {
    onLevelChange(1)
    setPassword('')
    setError(null)
  }

  return (
    // `--level-color` is a local CSS variable used to tint elements in this
    // component with the current level's color. This is separate from the
    // global --accent variable (which is set via data-clearance on :root).
    <div className="clearance-panel" style={{ '--level-color': current.color }}>

      {/* ── Badge — always visible, click to expand/collapse ── */}
      <button
        className="clearance-badge"
        onClick={() => setExpanded((e) => !e)}
        title={expanded ? 'Collapse' : 'Enter clearance code'}
      >
        <span className="clearance-pip" />
        <span className="clearance-lvl">LVL {clearanceLevel}</span>
        <span className="clearance-name">{current.name}</span>
        <span className="clearance-chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* ── Expanded panel ── */}
      {expanded && (
        <div className="clearance-body">

          {/* Level ladder — shows which levels are unlocked */}
          <div className="clearance-ladder">
            {Object.entries(LEVELS).map(([lvl, cfg]) => {
              const n       = parseInt(lvl)
              const active  = n === clearanceLevel
              const unlocked = n < clearanceLevel
              return (
                <div
                  key={lvl}
                  className={`clearance-rung ${active ? 'rung--active' : ''} ${unlocked ? 'rung--unlocked' : ''}`}
                >
                  <span
                    className="rung-dot"
                    style={{ background: n <= clearanceLevel ? cfg.color : undefined }}
                  />
                  <span className="rung-num">{lvl}</span>
                  <span className="rung-name">{cfg.name}</span>
                  {n <= clearanceLevel && <span className="rung-check">✓</span>}
                </div>
              )
            })}
          </div>

          {/* Password entry — hidden when already at max level */}
          {!isMaxLevel && (
            <div className="clearance-input-row">
              <input
                type="password"
                className="clearance-input"
                placeholder="Enter clearance code…"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handleUpgrade()}
                autoComplete="off"
              />
              <button className="clearance-submit-btn" onClick={handleUpgrade}>
                ↑
              </button>
            </div>
          )}

          {error && <div className="clearance-error">⚠ {error}</div>}

          {/* Revoke button — only shown if above level 1 */}
          {clearanceLevel > 1 && (
            <button className="clearance-revoke-btn" onClick={handleRevoke}>
              REVOKE ACCESS
            </button>
          )}

        </div>
      )}
    </div>
  )
}

export default ClearancePanel
