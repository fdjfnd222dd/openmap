import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { supabase } from '../supabaseClient'
import { trustClass } from '../utils/trust'

// ─────────────────────────────────────────────────────────────────────────────
// GraphView — full-screen ontology relationship graph
//
// Displays four node types (reports, sitreps, users, zones) pulled from
// Supabase, connected by edges from the `relationships` table plus auto-
// derived edges (SUBMITTED BY, LINKED TO, CREATED BY).
//
// Architecture:
//   GraphView (outer)         — wraps everything in ReactFlowProvider
//   └─ GraphViewInner         — the actual component (needs useReactFlow hook)
// ─────────────────────────────────────────────────────────────────────────────

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_EMOJI = { flood: '🌊', fire: '🔥', earthquake: '⚡', other: '📍' }

// Auto-edge colors keyed by label; fallback for manual relationships
const AUTO_EDGE_COLORS = {
  'SUBMITTED BY': '#22c55e',
  'LINKED TO':    '#3b82f6',
  'CREATED BY':   '#a855f7',
}
const MANUAL_EDGE_COLOR = '#4a5068'

// Initial cluster origins for the force simulation seed positions
const TYPE_ORIGINS = {
  report:  { x: 250, y: 200 },
  sitrep:  { x: 950, y: 200 },
  user:    { x: 250, y: 750 },
  zone:    { x: 950, y: 750 },
}

// ── Edge factory ──────────────────────────────────────────────────────────────

function makeEdge(id, source, target, label) {
  const color = AUTO_EDGE_COLORS[label] ?? MANUAL_EDGE_COLOR
  return {
    id,
    source,
    target,
    label,
    type: 'smoothstep',
    animated: true,
    style:        { stroke: color, strokeWidth: 1.5 },
    labelStyle:   { fill: '#b0bcd4', fontSize: 10, fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.04em' },
    labelBgStyle: { fill: '#0d1017', fillOpacity: 0.92 },
    labelBgPadding: [5, 3],
    labelBgBorderRadius: 3,
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 12, height: 12 },
  }
}

// ── Force-directed layout ─────────────────────────────────────────────────────
// A simple spring-repulsion simulation. Runs synchronously so we get stable
// positions in a single pass without needing an animation loop.

function computeForceLayout(nodeList, edgeList, seedPositions = {}) {
  if (nodeList.length === 0) return {}

  const IDEAL_LEN  = 200    // spring rest length (px)
  const REPULSION  = 20000  // electrostatic repulsion coefficient
  const DAMPING    = 0.70   // velocity damping per step
  const ITERATIONS = 200    // simulation steps

  const pos = {}
  const vel = {}

  // Initialise — reuse saved positions for known nodes, cluster-seed new ones
  nodeList.forEach((n) => {
    if (seedPositions[n.id]) {
      pos[n.id] = { ...seedPositions[n.id] }
    } else {
      const origin = TYPE_ORIGINS[n.data.nodeType] ?? { x: 600, y: 475 }
      pos[n.id] = {
        x: origin.x + (Math.random() - 0.5) * 280,
        y: origin.y + (Math.random() - 0.5) * 280,
      }
    }
    vel[n.id] = { x: 0, y: 0 }
  })

  for (let it = 0; it < ITERATIONS; it++) {
    const force = {}
    nodeList.forEach((n) => { force[n.id] = { x: 0, y: 0 } })

    // Coulomb repulsion (O(n²) — fine for ≤200 nodes)
    for (let i = 0; i < nodeList.length; i++) {
      for (let j = i + 1; j < nodeList.length; j++) {
        const a = nodeList[i].id
        const b = nodeList[j].id
        const dx = pos[b].x - pos[a].x
        const dy = pos[b].y - pos[a].y
        const d  = Math.max(Math.hypot(dx, dy), 1)
        const f  = REPULSION / (d * d)
        force[a].x -= (f * dx) / d;  force[a].y -= (f * dy) / d
        force[b].x += (f * dx) / d;  force[b].y += (f * dy) / d
      }
    }

    // Hooke attraction (edges)
    edgeList.forEach((e) => {
      const a = pos[e.source]
      const b = pos[e.target]
      if (!a || !b) return
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d  = Math.max(Math.hypot(dx, dy), 1)
      const f  = (d - IDEAL_LEN) * 0.04
      force[e.source].x += (f * dx) / d;  force[e.source].y += (f * dy) / d
      force[e.target].x -= (f * dx) / d;  force[e.target].y -= (f * dy) / d
    })

    // Integrate
    nodeList.forEach((n) => {
      vel[n.id].x = (vel[n.id].x + force[n.id].x) * DAMPING
      vel[n.id].y = (vel[n.id].y + force[n.id].y) * DAMPING
      pos[n.id].x += vel[n.id].x
      pos[n.id].y += vel[n.id].y
    })
  }

  return pos
}

// ── Custom node components ────────────────────────────────────────────────────
// Each component must be defined OUTSIDE the main component so React Flow
// doesn't recreate them on every render (causes flickering / lost state).

function ReportNode({ data, selected }) {
  const emoji   = TYPE_EMOJI[data.type] ?? '📍'
  const verdict =
    data.status === 'verified' ? { text: '✓ VERIFIED', cls: 'gnode-verdict--verified' } :
    data.status === 'false'    ? { text: '✗ FALSE',    cls: 'gnode-verdict--false'    } : null
  return (
    <div className={`gnode gnode--report${selected ? ' gnode--selected' : ''}`}>
      <Handle type="target" position={Position.Left}  className="gnode-handle" />
      <Handle type="source" position={Position.Right} className="gnode-handle" />
      <div className="gnode-eyebrow">
        <span className="gnode-emoji">{emoji}</span>
        <span className="gnode-typelabel">REPORT</span>
      </div>
      <div className="gnode-title">{data.title}</div>
      {verdict && <span className={`gnode-verdict ${verdict.cls}`}>{verdict.text}</span>}
    </div>
  )
}

function SitrepNode({ data, selected }) {
  return (
    <div className={`gnode gnode--sitrep${selected ? ' gnode--selected' : ''}`}>
      <Handle type="target" position={Position.Left}  className="gnode-handle" />
      <Handle type="source" position={Position.Right} className="gnode-handle" />
      <div className="gnode-eyebrow">
        <span className="gnode-emoji">📋</span>
        <span className="gnode-typelabel">SITREP</span>
      </div>
      <div className="gnode-title">{data.title}</div>
      {data.status && (
        <span className={`gnode-sitrep-status gnode-sitrep-status--${data.status}`}>
          {data.status.toUpperCase()}
        </span>
      )}
    </div>
  )
}

function UserNode({ data, selected }) {
  const score = data.trust_score ?? 0
  return (
    <div className={`gnode gnode--user${selected ? ' gnode--selected' : ''}`}>
      <Handle type="target" position={Position.Left}  className="gnode-handle" />
      <Handle type="source" position={Position.Right} className="gnode-handle" />
      <div className="gnode-eyebrow">
        <span className="gnode-emoji">👤</span>
        <span className="gnode-typelabel">USER</span>
      </div>
      <div className="gnode-email" title={data.email}>{data.email}</div>
      <span className={`trust-badge ${trustClass(score)}`}>◈ {score}</span>
    </div>
  )
}

function ZoneNode({ data, selected }) {
  return (
    <div className={`gnode gnode--zone${selected ? ' gnode--selected' : ''}`}>
      <Handle type="target" position={Position.Left}  className="gnode-handle" />
      <Handle type="source" position={Position.Right} className="gnode-handle" />
      <div className="gnode-eyebrow">
        <span className="gnode-emoji">📐</span>
        <span className="gnode-typelabel">ZONE</span>
      </div>
      <div className="gnode-title">{data.name ?? 'Unnamed Zone'}</div>
    </div>
  )
}

// Must be defined outside the component (stable reference required by React Flow)
const NODE_TYPES = { report: ReportNode, sitrep: SitrepNode, user: UserNode, zone: ZoneNode }

// ── Node type toggle config ───────────────────────────────────────────────────

const TYPE_CONFIG = [
  { key: 'report', label: 'REPORTS', color: '#3b82f6' },
  { key: 'sitrep', label: 'SITREPS', color: '#a855f7' },
  { key: 'user',   label: 'USERS',   color: '#22c55e' },
  { key: 'zone',   label: 'ZONES',   color: '#f97316' },
]

// ── GraphViewInner ────────────────────────────────────────────────────────────
// Placed inside ReactFlowProvider so we can use the useReactFlow hook.

function GraphViewInner({ session, clearanceLevel }) {
  const { fitView } = useReactFlow()

  // React Flow node/edge state
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Raw data fetched from Supabase
  const [rawData, setRawData]   = useState(null) // null = not yet loaded
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(null)

  // Persisted node positions — survives filter changes and new-relationship adds
  const savedPositions = useRef({})

  // Triggers layout re-run on Reset (incrementing forces the effect to re-fire)
  const [resetKey, setResetKey] = useState(0)

  // ── Filter & UI state ─────────────────────────────────────────────────────
  const [visibleTypes, setVisibleTypes] = useState(
    { report: true, sitrep: true, user: true, zone: true }
  )
  const [searchInput, setSearchInput]   = useState('')
  const [searchQuery, setSearchQuery]   = useState('')

  // ── Detail panel state ────────────────────────────────────────────────────
  const [selectedNode, setSelectedNode] = useState(null)
  const [showAddRel,   setShowAddRel]   = useState(false)
  const [relTargetId,  setRelTargetId]  = useState('')
  const [relLabel,     setRelLabel]     = useState('')
  const [addingRel,    setAddingRel]    = useState(false)
  const [relError,     setRelError]     = useState(null)

  // ── Debounce search input ─────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 250)
    return () => clearTimeout(t)
  }, [searchInput])

  // ── Load data from Supabase ───────────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setLoadError(null)
      try {
        // Fetch all four data sources in parallel.
        // sitreps and relationships may not exist yet — treat errors as empty.
        const [rRes, sRes, pRes, relRes] = await Promise.all([
          supabase.from('reports')      .select('*').order('created_at', { ascending: false }),
          supabase.from('sitreps')      .select('*').order('created_at', { ascending: false }),
          supabase.from('profiles')     .select('*'),
          supabase.from('relationships').select('*'),
        ])
        setRawData({
          reports:       rRes.data   ?? [],
          sitreps:       sRes.data   ?? [],
          profiles:      pRes.data   ?? [],
          relationships: relRes.data ?? [],
        })
      } catch (err) {
        setLoadError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // ── Rebuild graph when data, filters, or resetKey changes ─────────────────
  useEffect(() => {
    if (!rawData) return
    const { nodes: builtNodes, edges: builtEdges } = buildGraphData(rawData, visibleTypes)
    setNodes(builtNodes)
    setEdges(builtEdges)
    setTimeout(() => fitView({ padding: 0.18, duration: 400 }), 80)
  }, [rawData, visibleTypes, resetKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Search highlight — cheap style-only update, no layout recompute ────────
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase()
    setNodes((prev) =>
      prev.map((n) => {
        if (!q) return { ...n, style: undefined }
        const haystack = (n.data.title ?? n.data.name ?? n.data.email ?? '').toLowerCase()
        return {
          ...n,
          style: haystack.includes(q)
            ? { opacity: 1, filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.25))' }
            : { opacity: 0.18 },
        }
      })
    )
  }, [searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build nodes + edges from raw data ─────────────────────────────────────
  function buildGraphData(data, vTypes) {
    const { reports, sitreps, profiles, relationships } = data
    const rawNodes = []

    if (vTypes.report) {
      reports.forEach((r) => rawNodes.push({
        id:       `report-${r.id}`,
        type:     'report',
        data:     { nodeType: 'report', ...r },
        position: { x: 0, y: 0 },
      }))
    }
    if (vTypes.sitrep) {
      sitreps.forEach((s) => rawNodes.push({
        id:       `sitrep-${s.id}`,
        type:     'sitrep',
        data:     { nodeType: 'sitrep', ...s },
        position: { x: 0, y: 0 },
      }))
    }
    if (vTypes.user) {
      profiles.forEach((p) => rawNodes.push({
        id:       `user-${p.id}`,
        type:     'user',
        data:     { nodeType: 'user', ...p },
        position: { x: 0, y: 0 },
      }))
    }

    const nodeIds  = new Set(rawNodes.map((n) => n.id))
    const rawEdges = []

    // ── Auto-derived edges ────────────────────────────────────────────────
    // Report → User (SUBMITTED BY)
    reports.forEach((r) => {
      const src = `report-${r.id}`, tgt = `user-${r.user_id}`
      if (r.user_id && nodeIds.has(src) && nodeIds.has(tgt))
        rawEdges.push(makeEdge(`auto-rsu-${r.id}`, src, tgt, 'SUBMITTED BY'))
    })

    // Sitrep → Report (LINKED TO)
    sitreps.forEach((s) => {
      const src = `sitrep-${s.id}`, tgt = `report-${s.report_id}`
      if (s.report_id && nodeIds.has(src) && nodeIds.has(tgt))
        rawEdges.push(makeEdge(`auto-srl-${s.id}`, src, tgt, 'LINKED TO'))
    })

    // Sitrep → User (CREATED BY)
    sitreps.forEach((s) => {
      const src = `sitrep-${s.id}`, tgt = `user-${s.user_id}`
      if (s.user_id && nodeIds.has(src) && nodeIds.has(tgt))
        rawEdges.push(makeEdge(`auto-suc-${s.id}`, src, tgt, 'CREATED BY'))
    })

    // ── Manual relationships from DB ──────────────────────────────────────
    relationships.forEach((rel) => {
      const src = `${rel.source_type}-${rel.source_id}`
      const tgt = `${rel.target_type}-${rel.target_id}`
      if (nodeIds.has(src) && nodeIds.has(tgt))
        rawEdges.push(makeEdge(`rel-${rel.id}`, src, tgt, rel.label))
    })

    // ── Force layout — reuse saved positions as seeds ─────────────────────
    const positions = computeForceLayout(rawNodes, rawEdges, savedPositions.current)
    rawNodes.forEach((n) => {
      n.position = positions[n.id] ?? { x: 0, y: 0 }
      savedPositions.current[n.id] = n.position
    })

    return { nodes: rawNodes, edges: rawEdges }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const onNodeClick = useCallback((_evt, node) => {
    setSelectedNode(node)
    setShowAddRel(false)
    setRelTargetId('')
    setRelLabel('')
    setRelError(null)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setShowAddRel(false)
  }, [])

  // Save positions when user drags nodes so they survive filter toggles
  const onNodeDragStop = useCallback((_evt, node) => {
    savedPositions.current[node.id] = node.position
  }, [])

  function toggleType(type) {
    setVisibleTypes((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  function handleReset() {
    savedPositions.current = {}
    setResetKey((k) => k + 1)
  }

  // ── Add relationship ──────────────────────────────────────────────────────

  async function handleAddRelationship(e) {
    e.preventDefault()
    if (!selectedNode || !relTargetId || !relLabel.trim()) return
    if (!session) return

    setAddingRel(true)
    setRelError(null)

    // Parse node IDs back to type + id
    // Node IDs are like "report-42" or "user-550e8400-e29b-…"
    // Split on the first hyphen to get type, remainder is the ID
    const firstDash = selectedNode.id.indexOf('-')
    const srcType   = selectedNode.id.slice(0, firstDash)
    const srcId     = selectedNode.id.slice(firstDash + 1)

    const firstDashT = relTargetId.indexOf('-')
    const tgtType    = relTargetId.slice(0, firstDashT)
    const tgtId      = relTargetId.slice(firstDashT + 1)

    const { data: inserted, error } = await supabase
      .from('relationships')
      .insert({
        source_type: srcType,
        source_id:   srcId,
        target_type: tgtType,
        target_id:   tgtId,
        label:       relLabel.trim().toUpperCase(),
        created_by:  session.user.id,
      })
      .select()
      .single()

    setAddingRel(false)

    if (error) {
      setRelError(error.message)
      return
    }

    // Patch raw data and rebuild the graph without a full re-fetch
    setRawData((prev) => ({
      ...prev,
      relationships: [...prev.relationships, inserted],
    }))
    setShowAddRel(false)
    setRelTargetId('')
    setRelLabel('')
  }

  // ── Dropdown nodes (all nodes except the selected one) ────────────────────
  const allOtherNodes = useMemo(() => {
    if (!rawData) return []
    const { reports, sitreps, profiles } = rawData
    const items = [
      ...reports.map((r)  => ({ id: `report-${r.id}`,  label: `[REPORT] ${r.title}` })),
      ...sitreps.map((s)  => ({ id: `sitrep-${s.id}`,  label: `[SITREP] ${s.title}` })),
      ...profiles.map((p) => ({ id: `user-${p.id}`,    label: `[USER] ${p.email}` })),
    ]
    return items.filter((n) => n.id !== selectedNode?.id)
  }, [rawData, selectedNode])

  // ── Detail panel ──────────────────────────────────────────────────────────

  function renderDetail() {
    if (!selectedNode) return null
    const d    = selectedNode.data
    const type = d.nodeType

    return (
      <>
        {/* Header */}
        <div className="gdp-header">
          <div className={`gdp-typebadge gdp-typebadge--${type}`}>
            {type === 'report' && (TYPE_EMOJI[d.type] ?? '📍')}
            {type === 'sitrep' && '📋'}
            {type === 'user'   && '👤'}
            {type === 'zone'   && '📐'}
            {' '}{type.toUpperCase()}
          </div>
          <button className="gdp-close" onClick={() => setSelectedNode(null)}>✕</button>
        </div>

        {/* Body by type */}
        {type === 'report' && (
          <>
            <div className="gdp-title">{d.title}</div>
            {d.description && <p className="gdp-desc">{d.description}</p>}
            {d.status && (
              <span className={`card-verdict card-verdict--${d.status}`}>
                {d.status === 'verified' ? '✓ VERIFIED' : '✗ FALSE REPORT'}
              </span>
            )}
            <div className="gdp-row">
              <span className="gdp-lbl">TYPE</span>
              <span className="gdp-val">{d.type?.toUpperCase() ?? '—'}</span>
            </div>
            {d.latitude != null && (
              <div className="gdp-row">
                <span className="gdp-lbl">COORDS</span>
                <span className="gdp-val gdp-mono">
                  {parseFloat(d.latitude).toFixed(4)}, {parseFloat(d.longitude).toFixed(4)}
                </span>
              </div>
            )}
            {d.created_at && (
              <div className="gdp-row">
                <span className="gdp-lbl">REPORTED</span>
                <span className="gdp-val gdp-mono">
                  {new Date(d.created_at).toLocaleString('en-US', {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: false,
                  })}
                </span>
              </div>
            )}
          </>
        )}

        {type === 'sitrep' && (
          <>
            <div className="gdp-title">{d.title}</div>
            {d.content && <p className="gdp-desc">{d.content}</p>}
            <div className="gdp-row">
              <span className="gdp-lbl">STATUS</span>
              <span className="gdp-val">{d.status?.toUpperCase() ?? '—'}</span>
            </div>
            {d.report_id && (
              <div className="gdp-row">
                <span className="gdp-lbl">LINKED REPORT</span>
                <span className="gdp-val gdp-mono">#{d.report_id}</span>
              </div>
            )}
            {d.created_at && (
              <div className="gdp-row">
                <span className="gdp-lbl">CREATED</span>
                <span className="gdp-val gdp-mono">
                  {new Date(d.created_at).toLocaleString('en-US', {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: false,
                  })}
                </span>
              </div>
            )}
          </>
        )}

        {type === 'user' && (
          <>
            <div className="gdp-title">{d.email}</div>
            <div className="gdp-row">
              <span className="gdp-lbl">TRUST</span>
              <span className={`trust-badge ${trustClass(d.trust_score ?? 0)}`}>
                ◈ {d.trust_score ?? 0}
              </span>
            </div>
            <div className="gdp-row">
              <span className="gdp-lbl">SUBMITTED</span>
              <span className="gdp-val">{d.reports_submitted ?? 0}</span>
            </div>
            <div className="gdp-row">
              <span className="gdp-lbl">VERIFIED</span>
              <span className="gdp-val">{d.reports_verified ?? 0}</span>
            </div>
          </>
        )}

        {type === 'zone' && (
          <>
            <div className="gdp-title">{d.name ?? 'Unnamed Zone'}</div>
            <p className="gdp-desc gdp-placeholder">Zone functionality not yet implemented.</p>
          </>
        )}

        <div className="gdp-divider" />

        {/* Add Relationship */}
        {!showAddRel ? (
          <button
            className="gdp-add-rel-btn"
            onClick={() => { setShowAddRel(true); setRelError(null) }}
            disabled={!session}
            title={!session ? 'Sign in to add relationships' : undefined}
          >
            + Add Relationship
          </button>
        ) : (
          <form className="gdp-rel-form" onSubmit={handleAddRelationship}>
            <div className="gdp-rel-form-title">ADD RELATIONSHIP</div>
            <select
              className="gdp-rel-select"
              value={relTargetId}
              onChange={(e) => setRelTargetId(e.target.value)}
              required
            >
              <option value="">— select target node —</option>
              {allOtherNodes.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
            <input
              className="gdp-rel-input"
              placeholder="Relationship label (e.g. CAUSED BY)"
              value={relLabel}
              onChange={(e) => setRelLabel(e.target.value)}
              maxLength={80}
              required
            />
            {relError && <div className="gdp-rel-error">{relError}</div>}
            <div className="gdp-rel-actions">
              <button type="submit" className="gdp-rel-save" disabled={addingRel}>
                {addingRel ? 'SAVING…' : 'SAVE'}
              </button>
              <button type="button" className="gdp-rel-cancel" onClick={() => setShowAddRel(false)}>
                CANCEL
              </button>
            </div>
          </form>
        )}
      </>
    )
  }

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="graph-fullscreen graph-loading-state">
        <div className="loading-spinner" />
        <span className="loading-text">LOADING ONTOLOGY…</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="graph-fullscreen graph-loading-state">
        <span className="loading-text" style={{ color: 'var(--error)' }}>
          ERROR: {loadError}
        </span>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="graph-fullscreen">

      {/* ── Toolbar ── */}
      <div className="graph-toolbar">
        <div className="graph-toolbar-left">
          <span className="graph-toolbar-label">SHOW</span>
          {TYPE_CONFIG.map((tc) => (
            <button
              key={tc.key}
              className={`graph-type-toggle ${visibleTypes[tc.key] ? 'graph-type-toggle--on' : ''}`}
              style={{ '--type-color': tc.color }}
              onClick={() => toggleType(tc.key)}
            >
              {tc.label}
            </button>
          ))}
        </div>

        <div className="graph-toolbar-center">
          <input
            className="graph-search"
            placeholder="🔍  Search nodes…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="graph-toolbar-right">
          <button className="graph-reset-btn" onClick={handleReset}>
            ↺ RESET LAYOUT
          </button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div className="graph-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={NODE_TYPES}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodeDragStop={onNodeDragStop}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.15}
          maxZoom={3}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1e2235" gap={28} size={1} variant="dots" />
          <Controls
            style={{ background: '#141720', border: '1px solid #22273a', borderRadius: 4 }}
          />
        </ReactFlow>

        {/* Detail panel — sits over the right edge of the canvas */}
        {selectedNode && (
          <div className="graph-detail-panel">
            <div className="gdp-scroll">
              {renderDetail()}
            </div>
          </div>
        )}

        {/* Stats badge — bottom left */}
        <div className="graph-stats-badge">
          {nodes.length} NODES · {edges.length} EDGES
        </div>
      </div>

    </div>
  )
}

// ── GraphView (exported) ──────────────────────────────────────────────────────
// Wraps GraphViewInner in ReactFlowProvider so useReactFlow() works inside.

function GraphView(props) {
  return (
    <ReactFlowProvider>
      <GraphViewInner {...props} />
    </ReactFlowProvider>
  )
}

export default GraphView
