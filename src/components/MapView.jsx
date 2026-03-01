import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
// Base cluster CSS — needed for spiderfy animation when pins are stacked on the same spot.
// We skip MarkerCluster.Default.css because we provide our own cluster icon below.
import 'react-leaflet-cluster/lib/assets/MarkerCluster.css'

// ─────────────────────────────────────────────────────────────────────────────
// MapView — the full-height interactive map (right column, 70% of screen)
//
// New in this version:
//   - Clicking the map places a preview pin and fills in the lat/lng form fields
//   - Incident pins now use emoji icons (🌊 🔥 ⚡ ❓) instead of plain colored dots
//   - Level 4+ users can toggle a heatmap density layer
// ─────────────────────────────────────────────────────────────────────────────

// ── Map click handler ─────────────────────────────────────────────────────────
// This component must live INSIDE <MapContainer> because `useMapEvents` needs
// access to the Leaflet map context that MapContainer provides.
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      // e.latlng is the Leaflet LatLng object for wherever the user clicked
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  // This component renders nothing visible — it only listens for map clicks
  return null
}

// ── Emoji incident icons ──────────────────────────────────────────────────────
// Each type gets a diamond-shaped badge with an emoji that is clearly visible
// on the map without needing to click. The outer div is rotated 45° to form a
// pointed shape; the emoji span is counter-rotated so it stays upright.
const ICON_CONFIG = {
  flood:      { emoji: '🌊', bg: '#1d4ed8', border: '#3b82f6' },
  fire:       { emoji: '🔥', bg: '#991b1b', border: '#ef4444' },
  earthquake: { emoji: '⚡', bg: '#7c2d12', border: '#f97316' },
  other:      { emoji: '❓', bg: '#1e293b', border: '#94a3b8' },
}

function createEmojiIcon(type) {
  const cfg = ICON_CONFIG[type] || ICON_CONFIG.other

  const html = `
    <div style="
      width: 34px;
      height: 34px;
      background: ${cfg.bg};
      border: 2px solid ${cfg.border};
      border-radius: 50% 50% 50% 4px;
      transform: rotate(45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1);
    ">
      <span style="
        font-size: 16px;
        line-height: 1;
        display: block;
        transform: rotate(-45deg);
        user-select: none;
      ">${cfg.emoji}</span>
    </div>
  `

  return L.divIcon({
    html,
    className:   '',       // prevents Leaflet adding a white background box
    iconSize:    [34, 34],
    iconAnchor:  [17, 34], // the bottom-tip of the diamond sits on the coordinates
    popupAnchor: [0, -38],
  })
}

// ── Preview pin ───────────────────────────────────────────────────────────────
// Shown at the map click location before the user submits the form.
// The `.preview-pin-inner` CSS class (in index.css) gives it a pulsing animation.
const previewIcon = L.divIcon({
  html:        '<div class="preview-pin-inner"></div>',
  className:   '',
  iconSize:    [22, 22],
  iconAnchor:  [11, 11], // centered on the coordinates (not a teardrop)
  popupAnchor: [0, -18],
})

// ── Fly controller (jump-to-pin) ──────────────────────────────────────────────
// This component lives inside MapContainer so it can access the Leaflet map
// instance via useMap(). When `flyTarget` changes, it calls map.flyTo() to
// smoothly pan and zoom to that report's location.
function FlyController({ flyTarget }) {
  const map = useMap()

  useEffect(() => {
    if (!flyTarget) return
    const lat = parseFloat(flyTarget.latitude)
    const lng = parseFloat(flyTarget.longitude)
    if (isNaN(lat) || isNaN(lng)) return

    // flyTo smoothly animates the map to the target coordinates.
    // zoom 13 is a good street-level view; duration is in seconds.
    map.flyTo([lat, lng], 13, { duration: 1.2 })
  }, [flyTarget, map])

  return null
}

// ── Custom cluster icon ───────────────────────────────────────────────────────
// Called by MarkerClusterGroup to render the grouped badge when pins overlap.
// Uses a CSS class so it picks up the accent color CSS variable automatically —
// this means the cluster badge changes color with the clearance level.
function createClusterIcon(cluster) {
  const count = cluster.getChildCount()
  return L.divIcon({
    // The inner div's styling comes from the .cluster-icon CSS class in index.css
    html:      `<div class="cluster-icon"><span>${count}</span></div>`,
    className: '',
    iconSize:  L.point(40, 40),
    iconAnchor:L.point(20, 20),
  })
}

// ── Heatmap layer (Level 4+) ──────────────────────────────────────────────────
// Renders a large semi-transparent circle at each report location.
// Where many reports are clustered, the circles overlap and create a
// density / hotspot effect — no extra library needed.
function HeatmapLayer({ reports }) {
  return (
    <>
      {reports.map((report) => {
        const lat = parseFloat(report.latitude)
        const lng = parseFloat(report.longitude)
        if (isNaN(lat) || isNaN(lng)) return null
        return (
          <Circle
            key={`heat-${report.id}`}
            center={[lat, lng]}
            radius={7000} // ~7 km radius per report
            pathOptions={{
              fillColor:   '#ef4444',
              fillOpacity: 0.11,
              stroke:      false,
            }}
          />
        )
      })}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function MapView({ reports, clearanceLevel, previewCoords, onMapClick, flyTarget }) {
  // Local state for the heatmap toggle (only relevant at level 4+)
  const [showHeatmap, setShowHeatmap] = useState(false)

  const CENTER = [19.7241, -155.0868] // Hilo, Hawaii
  const ZOOM   = 7

  return (
    <div className="map-wrapper">

      {/* ── Heatmap toggle button — only shown at Level 4+ ── */}
      {clearanceLevel >= 4 && (
        <button
          className={`heatmap-toggle ${showHeatmap ? 'heatmap-toggle--on' : ''}`}
          onClick={() => setShowHeatmap((h) => !h)}
        >
          <span className="heatmap-toggle-icon">◉</span>
          DENSITY
        </button>
      )}

      {/* ── Hint banner — shown while a preview pin is active ── */}
      {previewCoords && (
        <div className="map-pin-hint">
          ⊕ Location pinned — fill in the form below and submit
        </div>
      )}

      <MapContainer
        center={CENTER}
        zoom={ZOOM}
        scrollWheelZoom={true}
        className="leaflet-map"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
        />

        {/* Listens for map clicks and calls onMapClick(lat, lng) */}
        <MapClickHandler onMapClick={onMapClick} />

        {/* Watches flyTarget and calls map.flyTo() when a card is clicked */}
        <FlyController flyTarget={flyTarget} />

        {/* Heatmap circles — only rendered when toggled on at level 4+ */}
        {clearanceLevel >= 4 && showHeatmap && (
          <HeatmapLayer reports={reports} />
        )}

        {/* ── Submitted report pins — wrapped in MarkerClusterGroup ── */}
        {/*
          MarkerClusterGroup automatically groups nearby pins into a single
          numbered badge. Clicking a cluster zooms in to reveal the individual
          pins. The custom iconCreateFunction gives the clusters our dark theme.
        */}
        <MarkerClusterGroup
          iconCreateFunction={createClusterIcon}
          showCoverageOnHover={false}
          maxClusterRadius={60}
        >
          {reports.map((report) => {
            const lat = parseFloat(report.latitude)
            const lng = parseFloat(report.longitude)
            if (isNaN(lat) || isNaN(lng)) return null

            return (
              <Marker
                key={report.id}
                position={[lat, lng]}
                icon={createEmojiIcon(report.type)}
              >
                <Popup>
                  <div className="map-popup">
                    <span className={`popup-badge popup-badge--${report.type || 'other'}`}>
                      {(report.type || 'other').toUpperCase()}
                    </span>

                    {report.status && (
                      <span className={`popup-status popup-status--${report.status}`}>
                        {report.status === 'verified' ? '✓ VERIFIED' : '✗ FALSE REPORT'}
                      </span>
                    )}

                    <strong className="popup-title">{report.title}</strong>

                    {report.description && (
                      <p className="popup-desc">{report.description}</p>
                    )}

                    <span className="popup-coords">
                      {lat.toFixed(4)}°, {lng.toFixed(4)}°
                    </span>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MarkerClusterGroup>

        {/* ── Preview pin — shown at the click location before submission ── */}
        {previewCoords && (
          <Marker
            position={[previewCoords.lat, previewCoords.lng]}
            icon={previewIcon}
            zIndexOffset={1000} // floats above all submitted-report pins
          >
            <Popup>
              <div className="map-popup">
                <strong className="popup-title">📍 Pending report</strong>
                <span className="popup-coords">
                  {previewCoords.lat.toFixed(4)}°,&nbsp;
                  {previewCoords.lng.toFixed(4)}°
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
