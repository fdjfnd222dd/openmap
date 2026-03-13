import { useState } from 'react'

const LEVELS = {
  1: { name: 'PUBLIC',      color: '#64748b' },
  2: { name: 'VOLUNTEER',   color: '#22d3ee' },
  3: { name: 'COORDINATOR', color: '#a3e635' },
  4: { name: 'RESPONDER',   color: '#fb923c' },
  5: { name: 'ADMIN',       color: '#f43f5e' },
}

function ClearancePanel({ clearanceLevel, onLevelChange }) {
  const [expanded, setExpanded] = useState(false)
  const current = LEVELS[clearanceLevel]

  return (
    <div className="clearance-panel" style={{ '--level-color': current.color }}>

      <button
        className="clearance-badge"
        onClick={() => setExpanded((e) => !e)}
        title={expanded ? 'Collapse' : 'Change access level'}
      >
        <span className="clearance-pip" />
        <span className="clearance-lvl">ROLE</span>
        <span className="clearance-name">{current.name}</span>
        <span className="clearance-chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="clearance-body">
          <div className="clearance-ladder">
            {Object.entries(LEVELS).map(([lvl, cfg]) => {
              const n      = parseInt(lvl)
              const active = n === clearanceLevel
              return (
                <button
                  key={lvl}
                  className={`clearance-rung clearance-rung--btn ${active ? 'rung--active' : ''}`}
                  style={active ? { '--level-color': cfg.color } : {}}
                  onClick={() => { onLevelChange(n); setExpanded(false) }}
                >
                  <span className="rung-dot" style={{ background: cfg.color }} />
                  <span className="rung-num">{lvl}</span>
                  <span className="rung-name">{cfg.name}</span>
                  {active && <span className="rung-check">✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default ClearancePanel
