import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

// IMPORTANT: Always import Leaflet's CSS. Without this the map tiles
// will look broken and controls will be mispositioned.
import 'leaflet/dist/leaflet.css'

// ─────────────────────────────────────────────────────────────────────────────
// MapView — the full-height interactive map (right column, 70% of screen)
//
// Uses react-leaflet (a React wrapper around Leaflet.js) to display
// an OpenStreetMap base layer and a colored pin for each incident report.
// ─────────────────────────────────────────────────────────────────────────────

// ── Custom colored map pin icons ─────────────────────────────────────────────
// Leaflet's default marker images often break in Vite projects because of how
// assets are bundled. We work around this by creating our own SVG icons using
// L.divIcon, which lets us embed SVG directly as HTML.

function createPinIcon(color) {
  // An SVG teardrop-shaped map pin with a white dot in the center.
  // The `filter` element adds a subtle drop shadow.
  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40" width="28" height="40">
      <defs>
        <filter id="pin-shadow" x="-30%" y="-10%" width="160%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5"
                        flood-color="rgba(0,0,0,0.45)" />
        </filter>
      </defs>
      <!-- The pin body -->
      <path
        d="M14 0C6.268 0 0 6.268 0 14c0 9.625 14 26 14 26S28 23.625 28 14C28 6.268 21.732 0 14 0z"
        fill="${color}"
        filter="url(#pin-shadow)"
      />
      <!-- The inner white circle -->
      <circle cx="14" cy="14" r="5.5" fill="white" opacity="0.92" />
    </svg>
  `

  return L.divIcon({
    html:        svgMarkup,
    className:   '',          // '' prevents Leaflet adding a white background box
    iconSize:    [28, 40],    // width × height of the icon in pixels
    iconAnchor:  [14, 40],    // the point that sits exactly on the lat/lng coordinate
    popupAnchor: [0, -44],    // where the popup appears relative to the icon
  })
}

// One color per incident type — matches the badge colors in index.css
const PIN_COLORS = {
  flood:      '#3b82f6',   // blue
  fire:       '#ef4444',   // red
  earthquake: '#f97316',   // orange
  other:      '#94a3b8',   // slate gray
}

// ─────────────────────────────────────────────────────────────────────────────

function MapView({ reports }) {
  // Initial map center: Hilo, Hawaii — thematically appropriate for the app name!
  // Change these coordinates to center the map on your area of interest.
  const CENTER = [19.7241, -155.0868]
  const ZOOM   = 7

  return (
    <div className="map-wrapper">
      {/*
        MapContainer is the root Leaflet component.
        - center: [latitude, longitude] for the initial map view
        - zoom:   initial zoom level (1=world, 18=street level)
        - scrollWheelZoom: lets users zoom in/out with the mouse wheel
        - style:  must have explicit height, otherwise the map renders as 0px tall
      */}
      <MapContainer
        center={CENTER}
        zoom={ZOOM}
        scrollWheelZoom={true}
        className="leaflet-map"
      >
        {/*
          TileLayer loads the actual map tiles from OpenStreetMap.
          The {s}, {z}, {x}, {y} placeholders are filled by Leaflet automatically
          as you pan and zoom.
          Attribution is required by OpenStreetMap's usage policy.
        */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
        />

        {/*
          Render a Marker for every report that has valid coordinates.
          Each marker has a Popup that shows the report details when clicked.
        */}
        {reports.map((report) => {
          const lat = parseFloat(report.latitude)
          const lng = parseFloat(report.longitude)

          // Skip any report with missing or non-numeric coordinates
          if (isNaN(lat) || isNaN(lng)) return null

          const icon = createPinIcon(PIN_COLORS[report.type] || PIN_COLORS.other)

          return (
            <Marker
              key={report.id}
              position={[lat, lng]}
              icon={icon}
            >
              {/* The popup appears when the user clicks the pin */}
              <Popup>
                <div className="map-popup">
                  <span className={`popup-badge popup-badge--${report.type || 'other'}`}>
                    {(report.type || 'other').toUpperCase()}
                  </span>
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

      </MapContainer>
    </div>
  )
}

export default MapView
