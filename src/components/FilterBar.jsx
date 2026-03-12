const TYPE_FILTERS = [
  { value: 'flood',      emoji: '🌊', label: 'FLOOD',  mod: 'flood'      },
  { value: 'fire',       emoji: '🔥', label: 'FIRE',   mod: 'fire'       },
  { value: 'earthquake', emoji: '⚡', label: 'QUAKE',  mod: 'earthquake' },
  { value: 'other',      emoji: '❓', label: 'OTHER',  mod: 'other'      },
]

const STATUS_FILTERS = [
  { value: 'unverified',   label: 'UNVERIFIED'   },
  { value: 'under_review', label: 'IN REVIEW'    },
  { value: 'verified',     label: 'VERIFIED'     },
  { value: 'false',        label: 'FALSE'        },
]

function FilterBar({ activeTypes, activeStatuses, onToggleType, onToggleStatus, onClearAll }) {
  const hasActiveFilters = activeTypes.length > 0 || activeStatuses.length > 0

  return (
    <div className="filter-bar">

      <div className="filter-row">
        <span className="filter-row-label">TYPE</span>
        <div className="filter-btns">
          {TYPE_FILTERS.map((f) => {
            const isActive = activeTypes.includes(f.value)
            return (
              <button
                key={f.value}
                className={`filter-btn filter-btn--type ${isActive ? 'filter-btn--active' : `filter-btn--${f.mod}`}`}
                onClick={() => onToggleType(f.value)}
                title={`Filter by ${f.label}`}
              >
                <span className="filter-btn-emoji">{f.emoji}</span>
                <span className="filter-btn-label">{f.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-row-label">STATUS</span>
        <div className="filter-btns">
          {STATUS_FILTERS.map((f) => {
            const isActive = activeStatuses.includes(f.value)
            return (
              <button
                key={f.value}
                className={`filter-btn ${isActive ? 'filter-btn--active' : ''}`}
                onClick={() => onToggleStatus(f.value)}
                title={`Filter by ${f.label}`}
              >
                <span className="filter-btn-label">{f.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {hasActiveFilters && (
        <button className="filter-clear-btn" onClick={onClearAll}>
          × CLEAR ALL FILTERS
        </button>
      )}

    </div>
  )
}

export default FilterBar
