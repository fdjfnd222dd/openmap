import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '../supabaseClient'
import { coordsToW3W, w3wToCoords } from '../utils/w3w'

const INCIDENT_TYPES = [
  { value: 'flood',      label: 'Flood'      },
  { value: 'fire',       label: 'Fire'       },
  { value: 'earthquake', label: 'Earthquake' },
  { value: 'other',      label: 'Other'      },
]

// ── Type-specific template field definitions ───────────────────────────────────
const TEMPLATES = {
  flood: [
    { key: 'water_depth',    label: 'Water Depth',        type: 'select',
      options: ['Unknown', 'Shallow (<1 ft)', 'Moderate (1–3 ft)', 'Severe (>3 ft)'] },
    { key: 'road_closures',  label: 'Road Closures',      type: 'text',    placeholder: 'e.g. Kamehameha Ave, Hwy 11' },
    { key: 'evacuation',     label: 'Evacuation Status',  type: 'select',
      options: ['None', 'Advisory', 'Mandatory'] },
    { key: 'shelter_needed', label: 'Shelter Needed',     type: 'select',
      options: ['Unknown', 'No', 'Yes'] },
  ],
  fire: [
    { key: 'fire_size',      label: 'Estimated Size',     type: 'select',
      options: ['Unknown', 'Small (<1 acre)', 'Medium (1–10 acres)', 'Large (>10 acres)'] },
    { key: 'structures',     label: 'Structures Threatened', type: 'text', placeholder: 'e.g. 12 residential' },
    { key: 'evacuation',     label: 'Evacuation Orders',  type: 'select',
      options: ['None', 'Advisory', 'Mandatory'] },
    { key: 'active_spread',  label: 'Active Spread',      type: 'select',
      options: ['Unknown', 'Contained', 'Spreading'] },
  ],
  earthquake: [
    { key: 'damage_level',   label: 'Structural Damage',  type: 'select',
      options: ['None observed', 'Minor', 'Moderate', 'Severe'] },
    { key: 'injuries',       label: 'Injuries Reported',  type: 'select',
      options: ['None', 'Possible', 'Confirmed'] },
    { key: 'infra_affected', label: 'Infrastructure Affected', type: 'text', placeholder: 'e.g. Power out, Hwy 130 cracked' },
  ],
  other: [
    { key: 'category',       label: 'Category',           type: 'select',
      options: ['Humanitarian', 'Medical', 'Security', 'Logistics', 'Communications', 'Other'] },
    { key: 'pop_affected',   label: 'Population Affected', type: 'text', placeholder: 'e.g. ~200 residents' },
    { key: 'immediate_needs',label: 'Immediate Needs',    type: 'text', placeholder: 'e.g. Water, generators, medical' },
    { key: 'authority_notified', label: 'Local Authority Notified', type: 'select',
      options: ['Unknown', 'No', 'Yes'] },
  ],
}

function ReportForm({ session, onNewReport, previewCoords, userProfile, onProfileRefresh }) {
  const [submitting, setSubmitting]       = useState(false)
  const [submitError, setSubmitError]     = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [selectedType, setSelectedType]   = useState('')
  const [details, setDetails]             = useState({})
  const [w3wDisplay, setW3wDisplay]       = useState(null)
  const [w3wInput, setW3wInput]           = useState('')
  const [w3wLooking, setW3wLooking]       = useState(false)
  const [w3wError, setW3wError]           = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm()

  useEffect(() => {
    if (previewCoords) {
      setValue('latitude',  previewCoords.lat, { shouldValidate: true, shouldDirty: true })
      setValue('longitude', previewCoords.lng, { shouldValidate: true, shouldDirty: true })
      setW3wDisplay(null)
      coordsToW3W(previewCoords.lat, previewCoords.lng).then(words => setW3wDisplay(words))
    }
  }, [previewCoords, setValue])

  async function handleW3wLookup(e) {
    e.preventDefault()
    if (!w3wInput.trim()) return
    setW3wLooking(true)
    setW3wError(null)
    const coords = await w3wToCoords(w3wInput.trim())
    setW3wLooking(false)
    if (!coords) {
      setW3wError('Address not found. Use format: ///word.word.word')
      return
    }
    setValue('latitude',  coords.lat, { shouldValidate: true, shouldDirty: true })
    setValue('longitude', coords.lng, { shouldValidate: true, shouldDirty: true })
    setW3wDisplay(w3wInput.replace(/^\/\/\//, '').trim().toLowerCase())
    setW3wInput('')
  }

  function handleTypeChange(e) {
    setSelectedType(e.target.value)
    setDetails({})
  }

  function setDetail(key, value) {
    setDetails(prev => ({ ...prev, [key]: value }))
  }

  async function onSubmit(data) {
    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    const { data: inserted, error } = await supabase
      .from('reports')
      .insert([{
        title:       data.title,
        description: data.description,
        type:        data.type,
        latitude:    parseFloat(data.latitude),
        longitude:   parseFloat(data.longitude),
        user_id:     session.user.id,
        details:     Object.keys(details).length > 0 ? details : null,
      }])
      .select()
      .single()

    setSubmitting(false)

    if (error) {
      console.error('Submit error:', error.message)
      setSubmitError(error.message)
      return
    }

    await supabase.rpc('increment_reports_submitted', { uid: session.user.id })
    onProfileRefresh(session.user.id)
    onNewReport(inserted)
    setSubmitSuccess(true)
    reset()
    setSelectedType('')
    setDetails({})
    setTimeout(() => setSubmitSuccess(false), 3000)
  }

  const templateFields = TEMPLATES[selectedType] || []

  return (
    <div className="report-form-wrapper">

      <div className="form-section-header">
        <span className="form-section-icon">＋</span>
        <span className="form-section-label">SUBMIT INCIDENT REPORT</span>
        {userProfile != null && (
          <div className="form-trust-badge" title="Your current trust score">
            <span className="form-trust-icon">◈</span>
            <span className="form-trust-value">{userProfile.trust_score}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="report-form" noValidate>

        {/* ── Title ── */}
        <div className="field-group">
          <label className="field-label" htmlFor="title">TITLE</label>
          <input
            id="title"
            className={`field-input ${errors.title ? 'field-input--error' : ''}`}
            placeholder="e.g. Bridge flooding on Hwy 11"
            {...register('title', {
              required: 'Title is required',
              maxLength: { value: 120, message: 'Title must be 120 characters or fewer' },
            })}
          />
          {errors.title && <span className="field-error-msg">{errors.title.message}</span>}
        </div>

        {/* ── Incident type ── */}
        <div className="field-group">
          <label className="field-label" htmlFor="type">TYPE</label>
          <select
            id="type"
            className={`field-input field-select ${errors.type ? 'field-input--error' : ''}`}
            {...register('type', { required: 'Please select an incident type' })}
            onChange={handleTypeChange}
          >
            <option value="">— Select incident type —</option>
            {INCIDENT_TYPES.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {errors.type && <span className="field-error-msg">{errors.type.message}</span>}
        </div>

        {/* ── Description ── */}
        <div className="field-group">
          <label className="field-label" htmlFor="description">
            DESCRIPTION <span className="field-optional">(optional)</span>
          </label>
          <textarea
            id="description"
            className="field-input field-textarea"
            placeholder="Severity, affected area, road closures…"
            rows={3}
            {...register('description', {
              maxLength: { value: 1000, message: 'Description must be 1000 characters or fewer' },
            })}
          />
        </div>

        {/* ── Template fields (type-specific) ── */}
        {templateFields.length > 0 && (
          <div className="template-section">
            <div className="template-section-label">
              {selectedType.toUpperCase()} DETAILS
            </div>
            {templateFields.map(field => (
              <div className="field-group" key={field.key}>
                <label className="field-label">{field.label}</label>
                {field.type === 'select' ? (
                  <select
                    className="field-input field-select"
                    value={details[field.key] || ''}
                    onChange={e => setDetail(field.key, e.target.value)}
                  >
                    <option value="">— Select —</option>
                    {field.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="field-input"
                    placeholder={field.placeholder}
                    value={details[field.key] || ''}
                    onChange={e => setDetail(field.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Location ── */}
        <div className="field-group">
          <label className="field-label">LOCATION</label>

          {/* What3Words lookup */}
          <form className="w3w-lookup-row" onSubmit={handleW3wLookup}>
            <input
              className="field-input w3w-input"
              value={w3wInput}
              onChange={e => { setW3wInput(e.target.value); setW3wError(null) }}
              placeholder="///word.word.word"
              autoComplete="off"
            />
            <button className="w3w-lookup-btn" type="submit" disabled={w3wLooking || !w3wInput.trim()}>
              {w3wLooking ? '…' : 'LOCATE'}
            </button>
          </form>
          {w3wError && <span className="field-error-msg">{w3wError}</span>}

          {w3wDisplay && (
            <a
              className="w3w-display"
              href={`https://what3words.com/${w3wDisplay}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in What3Words"
            >
              <span className="w3w-slashes">///</span>{w3wDisplay}
            </a>
          )}
        </div>

        {/* ── Coordinates ── */}
        <div className="field-row">
          <div className="field-group">
            <label className="field-label" htmlFor="latitude">
              LATITUDE {previewCoords && <span className="field-pin-hint"> ⊕</span>}
            </label>
            <input
              id="latitude" type="number" step="any"
              className={`field-input ${errors.latitude ? 'field-input--error' : ''}`}
              placeholder="e.g. 19.7241"
              {...register('latitude', {
                required: 'Required',
                min: { value: -90,  message: '−90 to 90' },
                max: { value:  90,  message: '−90 to 90' },
              })}
            />
            {errors.latitude && <span className="field-error-msg">{errors.latitude.message}</span>}
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="longitude">LONGITUDE</label>
            <input
              id="longitude" type="number" step="any"
              className={`field-input ${errors.longitude ? 'field-input--error' : ''}`}
              placeholder="e.g. −155.09"
              {...register('longitude', {
                required: 'Required',
                min: { value: -180, message: '−180 to 180' },
                max: { value:  180, message: '−180 to 180' },
              })}
            />
            {errors.longitude && <span className="field-error-msg">{errors.longitude.message}</span>}
          </div>
        </div>

        {!previewCoords && (
          <div className="form-map-tip">
            💡 Click the map to pin a location, or enter a ///what3words address above
          </div>
        )}

        {submitError && (
          <div className="form-feedback form-feedback--error">⚠ {submitError}</div>
        )}
        {submitSuccess && (
          <div className="form-feedback form-feedback--success">✓ Report submitted. Pin placed on map.</div>
        )}

        <button type="submit" className="btn-submit" disabled={submitting}>
          {submitting ? 'TRANSMITTING…' : 'SUBMIT REPORT'}
        </button>

      </form>
    </div>
  )
}

export default ReportForm
