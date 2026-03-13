const OWM_API_KEY = import.meta.env.VITE_OWM_API_KEY

// Hawaii bounding box for USGS filter
const HI_BOUNDS = { minLat: 18.5, maxLat: 22.5, minLng: -161.0, maxLng: -154.5 }

import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, useMapEvents, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'react-leaflet-cluster/lib/assets/MarkerCluster.css'
import { supabase } from '../supabaseClient'

// ── Map click handler ──────────────────────────────────────────────────────────
function MapClickHandler({ onMapClick }) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng) } })
  return null
}

// ── Incident emoji icons ───────────────────────────────────────────────────────
const ICON_CONFIG = {
  flood:      { emoji: '🌊', bg: '#1d4ed8', border: '#3b82f6' },
  fire:       { emoji: '🔥', bg: '#991b1b', border: '#ef4444' },
  earthquake: { emoji: '⚡', bg: '#7c2d12', border: '#f97316' },
  other:      { emoji: '❓', bg: '#1e293b', border: '#94a3b8' },
}

function createEmojiIcon(type) {
  const cfg  = ICON_CONFIG[type] || ICON_CONFIG.other
  const html = `
    <div style="width:36px;height:36px;border-radius:50%;
      background:${cfg.bg};border:2px solid ${cfg.border};
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.7),0 0 0 1.5px rgba(255,255,255,0.2);">
      <span style="font-size:16px;line-height:1;display:block;user-select:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.8));">
        ${cfg.emoji}
      </span>
    </div>`
  return L.divIcon({ html, className: '', iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -22] })
}

// ── USGS seismic icon ──────────────────────────────────────────────────────────
function createSeismicIcon(mag) {
  const size  = Math.max(24, Math.min(56, Math.round(mag * 12)))
  const color = mag >= 5 ? '#ef4444' : mag >= 4 ? '#f97316' : mag >= 3 ? '#f59e0b' : mag >= 2 ? '#a3e635' : '#94a3b8'
  const glow  = `0 0 ${Math.max(6, mag * 5)}px ${color}99, 0 0 0 2px rgba(255,255,255,0.25)`
  const html  = `
    <div style="width:${size}px;height:${size}px;border:2px solid ${color};border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      background:${color}28;box-shadow:${glow};">
      <span style="font-size:${Math.max(8, Math.round(size/2.6))}px;color:#fff;
        font-family:monospace;font-weight:700;line-height:1;text-shadow:0 1px 3px rgba(0,0,0,0.9);">
        ${mag.toFixed(1)}
      </span>
    </div>`
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size/2, size/2], popupAnchor: [0, -(size/2 + 6)] })
}

// ── HTML entity escaper — used for any DB-sourced string in divIcon HTML ──────
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── CAT team (Blue Force) icon ─────────────────────────────────────────────────
const BFT_STATUS = {
  ACTIVE:    { color: '#22d3ee', label: 'ACTIVE'    },
  RTB:       { color: '#a3e635', label: 'RTB'       },
  HOLD:      { color: '#f59e0b', label: 'HOLD'      },
  COMMS_OUT: { color: '#f43f5e', label: 'COMMS OUT' },
}

function createBFTIcon(teamName, status) {
  const cfg    = BFT_STATUS[status] || BFT_STATUS.HOLD
  const abbrev = escHtml(teamName.replace('CAT-', '').split(' ')[0])
  const html   = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="width:12px;height:12px;border-radius:50%;background:${cfg.color};
        box-shadow:0 0 8px ${cfg.color}99,0 0 0 2px rgba(0,0,0,0.6);"></div>
      <span style="font-size:9px;font-family:monospace;font-weight:700;color:${cfg.color};
        text-shadow:0 1px 3px rgba(0,0,0,0.9);white-space:nowrap;letter-spacing:0.04em;">
        ${abbrev}
      </span>
    </div>`
  return L.divIcon({ html, className: '', iconSize: [40, 28], iconAnchor: [20, 6], popupAnchor: [0, -16] })
}

// ── CA Simulation: CMOC / FOB / JBCP icons ────────────────────────────────────

function createCMOCIcon() {
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="width:20px;height:20px;background:transparent;border:2px solid #f43f5e;
        display:flex;align-items:center;justify-content:center;">
        <span style="font-size:7px;color:#f43f5e;font-family:monospace;font-weight:900;">C</span>
      </div>
      <span style="font-size:8px;color:#f43f5e;font-family:monospace;font-weight:700;
        text-shadow:0 1px 3px rgba(0,0,0,0.9);white-space:nowrap;">CMOC</span>
    </div>`
  return L.divIcon({ html, className: '', iconSize: [44, 30], iconAnchor: [22, 10], popupAnchor: [0, -18] })
}

function createFOBIcon() {
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="width:16px;height:16px;background:transparent;border:2px solid #fb923c;
        display:flex;align-items:center;justify-content:center;">
        <span style="font-size:6px;color:#fb923c;font-family:monospace;font-weight:900;">F</span>
      </div>
      <span style="font-size:8px;color:#fb923c;font-family:monospace;font-weight:700;
        text-shadow:0 1px 3px rgba(0,0,0,0.9);white-space:nowrap;">FOB</span>
    </div>`
  return L.divIcon({ html, className: '', iconSize: [36, 28], iconAnchor: [18, 8], popupAnchor: [0, -16] })
}

function createJBCPIcon(num) {
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="width:10px;height:10px;border-radius:50%;background:transparent;border:2px solid #22d3ee;"></div>
      <span style="font-size:8px;color:#22d3ee;font-family:monospace;font-weight:700;
        text-shadow:0 1px 3px rgba(0,0,0,0.9);white-space:nowrap;">JBCP-${num}</span>
    </div>`
  return L.divIcon({ html, className: '', iconSize: [44, 26], iconAnchor: [22, 5], popupAnchor: [0, -14] })
}

// Hardcoded CA simulation positions — Big Island Hawaii
const CA_LOCATIONS = [
  {
    id: 'cmoc-hilo',
    type: 'CMOC',
    name: 'CMOC HILO',
    lat: 19.7200, lng: -155.0860,
    desc: 'Civil-Military Operations Center — County EOC co-location. Primary coordination node for all CA activities.',
    status: 'ACTIVE',
  },
  {
    id: 'fob-hilo',
    type: 'FOB',
    name: 'FOB HILO',
    lat: 19.7195, lng: -155.0476,
    desc: 'Forward Operating Base — Hilo Airport. Staging area for CAT teams and logistics.',
    status: 'ACTIVE',
  },
  {
    id: 'jbcp-1',
    type: 'JBCP',
    num: 1,
    name: 'JBCP-1 KEAAU',
    lat: 19.5947, lng: -155.0300,
    desc: 'Joint Boundary Coordination Point — Keaau. Southern approach corridor checkpoint.',
    status: 'ACTIVE',
  },
  {
    id: 'jbcp-2',
    type: 'JBCP',
    num: 2,
    name: 'JBCP-2 PAHOA',
    lat: 19.4950, lng: -154.9435,
    desc: 'Joint Boundary Coordination Point — Pahoa. Lower Puna sector access control.',
    status: 'HOLD',
  },
  {
    id: 'jbcp-3',
    type: 'JBCP',
    num: 3,
    name: 'JBCP-3 HONOKAA',
    lat: 20.0750, lng: -155.4799,
    desc: 'Joint Boundary Coordination Point — Honokaa. Hamakua coast northern sector.',
    status: 'ACTIVE',
  },
  {
    id: 'jbcp-4',
    type: 'JBCP',
    num: 4,
    name: 'JBCP-4 NAALEHU',
    lat: 19.0650, lng: -155.5920,
    desc: 'Joint Boundary Coordination Point — Naalehu. Ka\'u district southern perimeter.',
    status: 'COMMS_OUT',
  },
]

const JBCP_STATUS_COLORS = { ACTIVE: '#22d3ee', HOLD: '#f59e0b', COMMS_OUT: '#f43f5e' }

// ── AO Sector Boundaries (hardcoded, demo) ─────────────────────────────────────
const AO_SECTORS = [
  {
    id: 'ao-hilo',
    name: 'CAT-A · HILO SECTOR',
    color: '#22d3ee',
    positions: [
      [20.27, -155.45], [20.27, -154.82], [19.40, -154.82],
      [19.40, -155.05], [19.75, -155.25], [19.85, -155.45],
    ],
  },
  {
    id: 'ao-puna',
    name: 'CAT-B · PUNA SECTOR',
    color: '#a3e635',
    positions: [
      [19.40, -155.05], [19.40, -154.82], [18.95, -155.05],
      [19.00, -155.45], [19.35, -155.25],
    ],
  },
  {
    id: 'ao-kau',
    name: 'CAT-D · KAU SECTOR',
    color: '#f59e0b',
    positions: [
      [19.00, -155.45], [18.95, -155.05], [18.91, -155.68],
      [19.10, -155.90], [19.25, -155.75],
    ],
  },
  {
    id: 'ao-kona',
    name: 'CAT-C · KONA SECTOR',
    color: '#fb923c',
    positions: [
      [19.85, -155.45], [19.75, -155.25], [19.35, -155.25],
      [19.25, -155.75], [19.10, -155.90], [19.40, -156.05],
      [19.85, -156.05],
    ],
  },
  {
    id: 'ao-kohala',
    name: 'CAT-E · KOHALA SECTOR',
    color: '#f43f5e',
    positions: [
      [20.27, -155.45], [19.85, -155.45], [19.85, -156.05],
      [20.05, -155.90], [20.27, -155.90],
    ],
  },
]

// ── Preview pin ────────────────────────────────────────────────────────────────
const previewIcon = L.divIcon({
  html: '<div class="preview-pin-inner"></div>',
  className: '', iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -18],
})

// ── Fly controller ─────────────────────────────────────────────────────────────
function FlyController({ flyTarget }) {
  const map = useMap()
  useEffect(() => {
    if (!flyTarget) return
    const lat = parseFloat(flyTarget.latitude)
    const lng = parseFloat(flyTarget.longitude)
    if (!isNaN(lat) && !isNaN(lng)) map.flyTo([lat, lng], 13, { duration: 1.2 })
  }, [flyTarget, map])
  return null
}

// ── Cluster icon ───────────────────────────────────────────────────────────────
function createClusterIcon(cluster) {
  const count = cluster.getChildCount()
  return L.divIcon({
    html: `<div class="cluster-icon"><span>${count}</span></div>`,
    className: '', iconSize: L.point(32, 32), iconAnchor: L.point(16, 16),
  })
}

// ── Heatmap ────────────────────────────────────────────────────────────────────
function HeatmapLayer({ reports }) {
  return (
    <>
      {reports.map(r => {
        const lat = parseFloat(r.latitude), lng = parseFloat(r.longitude)
        if (isNaN(lat) || isNaN(lng)) return null
        return (
          <Circle key={`heat-${r.id}`} center={[lat, lng]} radius={7000}
            pathOptions={{ fillColor: '#ef4444', fillOpacity: 0.06, stroke: false }}
          />
        )
      })}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function formatQuakeTime(ts) {
  const d = new Date(ts)
  return d.toISOString().slice(11, 16) + 'Z ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const TILE_LAYERS = {
  street: {
    url:   'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr:  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
  },
  satellite: {
    url:   'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr:  'Tiles &copy; Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, GIS User Community',
  },
}

const NWS_COLOR = { Extreme: '#f43f5e', Severe: '#f97316', Moderate: '#f59e0b', Minor: '#6a9fc0' }

function MapView({ reports, clearanceLevel, previewCoords, onMapClick, flyTarget, onSelectReport, nwsAlerts, nwsDismissed, onNwsDismiss }) {

  const [mapStyle, setMapStyle] = useState('street') // 'street' | 'satellite'

  // Layer visibility
  const [showHeatmap,    setShowHeatmap]    = useState(false)
  const [showTeams,      setShowTeams]      = useState(false)
  const [showAOBoundaries, setShowAOBoundaries] = useState(false)
  const [showCAInfra,    setShowCAInfra]    = useState(false)
  const [showWeather,    setShowWeather]    = useState(false)
  const [showSeismic,    setShowSeismic]    = useState(false)
  const [layerPanelOpen, setLayerPanelOpen] = useState(false)

  // Layer data
  const [teamsData,      setTeamsData]      = useState([])
  const [usgsQuakes,     setUsgsQuakes]     = useState([])
  const [usgsUpdated,    setUsgsUpdated]    = useState(null)

  const usgsIntervalRef = useRef(null)

  // ── USGS live earthquake feed ────────────────────────────────────────────────
  async function fetchUSGS() {
    try {
      const res  = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson')
      const json = await res.json()
      const quakes = (json.features || [])
        .filter(f => {
          const [lng, lat] = f.geometry.coordinates
          return lat >= HI_BOUNDS.minLat && lat <= HI_BOUNDS.maxLat
              && lng >= HI_BOUNDS.minLng && lng <= HI_BOUNDS.maxLng
              && f.properties.mag >= 1.5
        })
        .map(f => ({
          id:    f.id,
          mag:   f.properties.mag,
          place: f.properties.place,
          time:  f.properties.time,
          depth: f.geometry.coordinates[2],
          lat:   f.geometry.coordinates[1],
          lng:   f.geometry.coordinates[0],
        }))
      setUsgsQuakes(quakes)
      setUsgsUpdated(new Date())
    } catch (e) {
      console.warn('USGS fetch failed', e)
    }
  }

  useEffect(() => {
    fetchUSGS()
    usgsIntervalRef.current = setInterval(fetchUSGS, 5 * 60 * 1000) // refresh every 5 min
    return () => clearInterval(usgsIntervalRef.current)
  }, [])

  // ── CAT team positions (from team_status) ────────────────────────────────────
  useEffect(() => {
    supabase.from('team_status').select('*').then(({ data }) => setTeamsData(data || []))

    const sub = supabase
      .channel('team-status-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_status' }, () => {
        supabase.from('team_status').select('*').then(({ data }) => setTeamsData(data || []))
      })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  const CENTER = [19.7241, -155.0868]
  const ZOOM   = 9
  const hasWeatherKey = OWM_API_KEY !== 'YOUR_OWM_API_KEY'

  return (
    <div className="map-wrapper">

      {/* ── Pin hint ── */}
      {previewCoords && (
        <div className="map-pin-hint">⊕ Location pinned — fill in the form and submit</div>
      )}

      {/* ── USGS status badge ── */}
      {showSeismic && usgsUpdated && (
        <div className="usgs-badge" onClick={e => e.stopPropagation()}>
          <span className="usgs-dot" />
          <span className="usgs-label">USGS LIVE</span>
          <span className="usgs-count">{usgsQuakes.length} events</span>
        </div>
      )}

      {/* ── Incident type legend ── */}
      <div className="map-legend" onClick={e => e.stopPropagation()}>
        {[
          { color: '#3b82f6', label: 'FLOOD' },
          { color: '#ef4444', label: 'FIRE'  },
          { color: '#f97316', label: 'QUAKE' },
          { color: '#94a3b8', label: 'OTHER' },
        ].map(({ color, label }) => (
          <div key={label} className="map-legend-row">
            <span className="map-legend-dot" style={{ background: color }} />
            <span className="map-legend-label">{label}</span>
          </div>
        ))}
      </div>

      {/* ── NWS compact alert ── */}
      {nwsAlerts?.length > 0 && !nwsDismissed && (() => {
        const top = nwsAlerts[0]
        const color = NWS_COLOR[top.severity] || '#f59e0b'
        return (
          <div className="nws-compact" onClick={e => e.stopPropagation()}>
            <span className="nws-compact-icon" style={{ color }}>⚠</span>
            <span className="nws-compact-event" style={{ color }}>{top.event}</span>
            {nwsAlerts.length > 1 && (
              <span className="nws-compact-more">+{nwsAlerts.length - 1}</span>
            )}
            <button className="nws-compact-dismiss" onClick={onNwsDismiss}>✕</button>
          </div>
        )
      })()}

      {/* ── Layer control ── */}
      <div className="layer-control" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
        <button
          className="layer-control-toggle"
          onClick={() => setLayerPanelOpen(p => !p)}
        >
          ⊙ LAYERS
        </button>

        {layerPanelOpen && (
          <div className="layer-panel">

            {/* Tile style toggle */}
            <div className="layer-tile-toggle">
              <button
                className={`layer-tile-btn ${mapStyle === 'street' ? 'layer-tile-btn--active' : ''}`}
                onClick={() => setMapStyle('street')}
              >⊞ STREET</button>
              <button
                className={`layer-tile-btn ${mapStyle === 'satellite' ? 'layer-tile-btn--active' : ''}`}
                onClick={() => setMapStyle('satellite')}
              >◉ SAT</button>
            </div>

            <div className="layer-divider" />

            <div className="layer-row layer-row--always">
              <span className="layer-check layer-check--on">☑</span>
              <span className="layer-label">Incidents</span>
              <span className="layer-badge" style={{ background: '#3b82f6' }} />
            </div>

            {/* Seismic — always on, no gate */}
            <div className="layer-row">
              <input type="checkbox" id="lyr-seismic" checked={showSeismic}
                onChange={e => setShowSeismic(e.target.checked)} />
              <label htmlFor="lyr-seismic" className="layer-label">
                Seismic (USGS Live)
              </label>
              <span className="layer-badge" style={{ background: '#f59e0b' }} />
            </div>

            {/* AO Boundaries — always visible */}
            <div className="layer-row">
              <input type="checkbox" id="lyr-ao" checked={showAOBoundaries}
                onChange={e => setShowAOBoundaries(e.target.checked)} />
              <label htmlFor="lyr-ao" className="layer-label">AO Sector Boundaries</label>
              <span className="layer-badge" style={{ background: '#22d3ee' }} />
            </div>

            {/* CA Infrastructure (CMOC/FOB/JBCP) — always visible */}
            <div className="layer-row">
              <input type="checkbox" id="lyr-ca" checked={showCAInfra}
                onChange={e => setShowCAInfra(e.target.checked)} />
              <label htmlFor="lyr-ca" className="layer-label">CMOC / FOB / JBCP</label>
              <span className="layer-badge" style={{ background: '#f43f5e' }} />
            </div>

            {/* Teams — L2+ */}
            <div className={`layer-row ${clearanceLevel < 2 ? 'layer-row--locked' : ''}`}>
              <input type="checkbox" id="lyr-teams" checked={showTeams}
                onChange={e => clearanceLevel >= 2 && setShowTeams(e.target.checked)}
                disabled={clearanceLevel < 2} />
              <label htmlFor="lyr-teams" className="layer-label">CAT Team BFT</label>
              {clearanceLevel < 2
                ? <span className="layer-gate">②</span>
                : <span className="layer-badge" style={{ background: '#22d3ee' }} />}
            </div>

            {/* Weather — L4+ */}
            <div className={`layer-row ${clearanceLevel < 4 ? 'layer-row--locked' : ''}`}>
              <input type="checkbox" id="lyr-wx" checked={showWeather}
                onChange={e => clearanceLevel >= 4 && setShowWeather(e.target.checked)}
                disabled={clearanceLevel < 4} />
              <label htmlFor="lyr-wx" className="layer-label">
                Weather Overlay
                {!hasWeatherKey && <span className="layer-no-key"> (no key)</span>}
              </label>
              {clearanceLevel < 4 && <span className="layer-gate">④</span>}
            </div>

            {/* Heatmap — L4+ */}
            <div className={`layer-row ${clearanceLevel < 4 ? 'layer-row--locked' : ''}`}>
              <input type="checkbox" id="lyr-heat" checked={showHeatmap}
                onChange={e => clearanceLevel >= 4 && setShowHeatmap(e.target.checked)}
                disabled={clearanceLevel < 4} />
              <label htmlFor="lyr-heat" className="layer-label">Density Heatmap</label>
              {clearanceLevel < 4 && <span className="layer-gate">④</span>}
            </div>

          </div>
        )}
      </div>

      <MapContainer center={CENTER} zoom={ZOOM} scrollWheelZoom className="leaflet-map">

        <TileLayer
          key={mapStyle}
          url={TILE_LAYERS[mapStyle].url}
          attribution={TILE_LAYERS[mapStyle].attr}
        />

        {/* Weather tile (L4+) */}
        {clearanceLevel >= 4 && showWeather && hasWeatherKey && (
          <TileLayer
            url={`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`}
            opacity={0.6}
            attribution="OpenWeatherMap"
          />
        )}

        <MapClickHandler onMapClick={onMapClick} />
        <FlyController flyTarget={flyTarget} />

        {/* Heatmap */}
        {clearanceLevel >= 4 && showHeatmap && <HeatmapLayer reports={reports} />}

        {/* ── USGS Live seismic events ── */}
        {showSeismic && usgsQuakes.map(q => (
          <Marker key={q.id} position={[q.lat, q.lng]} icon={createSeismicIcon(q.mag)}>
            <Popup>
              <div className="map-popup">
                <span className="popup-badge" style={{
                  background: q.mag >= 4 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                  color: q.mag >= 4 ? '#ef4444' : '#f59e0b',
                  borderColor: q.mag >= 4 ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)',
                }}>
                  SEISMIC · M{q.mag.toFixed(1)}
                </span>
                <strong className="popup-title">{q.place}</strong>
                <p className="popup-desc">Depth: {q.depth.toFixed(1)} km</p>
                <span className="popup-coords">{formatQuakeTime(q.time)}</span>
                <span className="popup-coords" style={{ color: '#4e7a9a' }}>USGS LIVE FEED</span>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* ── CAT Team Blue Force positions ── */}
        {showTeams && clearanceLevel >= 2 && teamsData.map(team => {
          const lat = parseFloat(team.grid_lat), lng = parseFloat(team.grid_lng)
          if (isNaN(lat) || isNaN(lng)) return null
          const cfg = BFT_STATUS[team.status] || BFT_STATUS.HOLD
          return (
            <Marker key={`bft-${team.id}`} position={[lat, lng]} icon={createBFTIcon(team.team_name, team.status)}>
              <Popup>
                <div className="map-popup">
                  <span className="popup-badge" style={{
                    color: cfg.color,
                    borderColor: cfg.color + '66',
                    background: cfg.color + '18',
                  }}>
                    BFT · {cfg.label}
                  </span>
                  <strong className="popup-title">{team.team_name}</strong>
                  {team.notes && <p className="popup-desc">{team.notes}</p>}
                  <span className="popup-coords">
                    {lat.toFixed(4)}°, {lng.toFixed(4)}°
                  </span>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* ── AO Sector Boundaries ── */}
        {showAOBoundaries && AO_SECTORS.map(sector => (
          <Polygon
            key={sector.id}
            positions={sector.positions}
            pathOptions={{
              color: sector.color,
              weight: 1.5,
              opacity: 0.35,
              fillColor: sector.color,
              fillOpacity: 0.04,
            }}
          >
            <Popup>
              <div className="map-popup">
                <strong className="popup-title">{sector.name}</strong>
                <span className="popup-coords">AO BOUNDARY</span>
              </div>
            </Popup>
          </Polygon>
        ))}

        {/* ── CA Simulation: CMOC, FOB, JBCPs ── */}
        {showCAInfra && CA_LOCATIONS.map(loc => {
          const icon = loc.type === 'CMOC' ? createCMOCIcon()
                     : loc.type === 'FOB'  ? createFOBIcon()
                     : createJBCPIcon(loc.num)
          const statusColor = JBCP_STATUS_COLORS[loc.status] || '#22d3ee'
          return (
            <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={icon} zIndexOffset={500}>
              <Popup>
                <div className="map-popup">
                  <span className="popup-badge" style={{
                    color: statusColor,
                    borderColor: statusColor + '66',
                    background: statusColor + '18',
                  }}>
                    {loc.type} · {loc.status}
                  </span>
                  <strong className="popup-title">{loc.name}</strong>
                  <p className="popup-desc">{loc.desc}</p>
                  <span className="popup-coords">{loc.lat.toFixed(4)}°, {loc.lng.toFixed(4)}°</span>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* Incident report pins */}
        <MarkerClusterGroup iconCreateFunction={createClusterIcon} showCoverageOnHover={false} maxClusterRadius={80}>
          {reports.map(report => {
            const lat = parseFloat(report.latitude), lng = parseFloat(report.longitude)
            if (isNaN(lat) || isNaN(lng)) return null
            return (
              <Marker key={report.id} position={[lat, lng]} icon={createEmojiIcon(report.type)}>
                <Popup>
                  <div className="map-popup">
                    <span className={`popup-badge popup-badge--${report.type || 'other'}`}>
                      {(report.type || 'other').toUpperCase()}
                    </span>
                    {report.status && report.status !== 'unverified' && (
                      <span className={`popup-status popup-status--${report.status}`}>
                        {report.status === 'verified'     ? '✓ VERIFIED'     :
                         report.status === 'under_review' ? '⏳ UNDER REVIEW' : '✗ FALSE REPORT'}
                      </span>
                    )}
                    <strong className="popup-title">{report.title}</strong>
                    {report.description && <p className="popup-desc">{report.description}</p>}
                    <span className="popup-coords">{lat.toFixed(4)}°, {lng.toFixed(4)}°</span>
                    <button className="popup-detail-btn" onClick={() => onSelectReport(report)}>
                      VIEW DETAILS ›
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MarkerClusterGroup>

        {/* Preview pin */}
        {previewCoords && (
          <Marker position={[previewCoords.lat, previewCoords.lng]} icon={previewIcon} zIndexOffset={1000}>
            <Popup>
              <div className="map-popup">
                <strong className="popup-title">📍 Pending report</strong>
                <span className="popup-coords">
                  {previewCoords.lat.toFixed(4)}°,&nbsp;{previewCoords.lng.toFixed(4)}°
                </span>
              </div>
            </Popup>
          </Marker>
        )}

      </MapContainer>
    </div>
  )
}

export default MapView
