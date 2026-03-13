import { escHtml } from './escape'

export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function toGeoJSON(reports) {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: reports.map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [parseFloat(r.longitude), parseFloat(r.latitude)] },
      properties: {
        id: r.id, title: r.title, description: r.description || '',
        type: r.type, status: r.status || 'unverified', created_at: r.created_at,
      },
    })),
  }, null, 2)
}

export function toKML(reports) {
  const dtg = new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z'
  const placemarks = reports.map(r => `  <Placemark>
    <name>${escHtml(r.title)}</name>
    <description>Type: ${r.type} | Status: ${r.status || 'unverified'}&#10;${escHtml(r.description || '')}</description>
    <styleUrl>#${r.type || 'other'}</styleUrl>
    <Point><coordinates>${parseFloat(r.longitude)},${parseFloat(r.latitude)},0</coordinates></Point>
  </Placemark>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>HILO Incidents — ${dtg}</name>
  <Style id="flood"><IconStyle><color>ffff0000</color></IconStyle></Style>
  <Style id="fire"><IconStyle><color>ff0000ff</color></IconStyle></Style>
  <Style id="earthquake"><IconStyle><color>ff0080ff</color></IconStyle></Style>
  <Style id="other"><IconStyle><color>ff888888</color></IconStyle></Style>
${placemarks}
</Document>
</kml>`
}

export function toCSV(reports) {
  const header = 'id,title,type,status,latitude,longitude,created_at,description'
  const rows = reports.map(r => [
    r.id,
    `"${(r.title || '').replace(/"/g, '""')}"`,
    r.type,
    r.status || 'unverified',
    r.latitude,
    r.longitude,
    r.created_at,
    `"${(r.description || '').replace(/"/g, '""')}"`,
  ].join(','))
  return [header, ...rows].join('\n')
}
