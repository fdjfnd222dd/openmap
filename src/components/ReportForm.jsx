import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '../supabaseClient'

// ─────────────────────────────────────────────────────────────────────────────
// ReportForm — lets a logged-in user (clearance level 2+) submit a report
//
// Props:
//   session          — the Supabase auth session (for user.id)
//   onNewReport      — callback(report) adds the new report to the list
//   previewCoords    — {lat, lng} from a map click; auto-fills lat/lng fields
//   userProfile      — the current user's profile row (for trust score display)
//   onProfileRefresh — fn(userId) refreshes the profile cache after submit
// ─────────────────────────────────────────────────────────────────────────────

const INCIDENT_TYPES = [
  { value: 'flood',      label: 'Flood'      },
  { value: 'fire',       label: 'Fire'       },
  { value: 'earthquake', label: 'Earthquake' },
  { value: 'other',      label: 'Other'      },
]

function ReportForm({ session, onNewReport, previewCoords, userProfile, onProfileRefresh }) {
  const [submitting, setSubmitting]       = useState(false)
  const [submitError, setSubmitError]     = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,           // lets us programmatically set a field's value
    formState: { errors },
  } = useForm()

  // ── Auto-fill lat/lng when the user clicks the map ────────────────────────
  useEffect(() => {
    if (previewCoords) {
      setValue('latitude',  previewCoords.lat, { shouldValidate: true, shouldDirty: true })
      setValue('longitude', previewCoords.lng, { shouldValidate: true, shouldDirty: true })
    }
  }, [previewCoords, setValue])

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
      }])
      .select()
      .single()

    setSubmitting(false)

    if (error) {
      console.error('Submit error:', error.message)
      setSubmitError(error.message)
      return
    }

    // Increment the submitter's reports_submitted count in their profile
    const newCount = (userProfile?.reports_submitted || 0) + 1
    await supabase
      .from('profiles')
      .update({ reports_submitted: newCount })
      .eq('id', session.user.id)

    // Refresh the cached profile so the trust badge reflects the new count
    onProfileRefresh(session.user.id)

    // Notify the parent — adds the report to the list and clears the preview pin
    onNewReport(inserted)
    setSubmitSuccess(true)
    reset()

    setTimeout(() => setSubmitSuccess(false), 3000)
  }

  return (
    <div className="report-form-wrapper">

      {/* ── Section header with trust score badge ── */}
      <div className="form-section-header">
        <span className="form-section-icon">＋</span>
        <span className="form-section-label">SUBMIT INCIDENT REPORT</span>

        {/* Trust score — shown when the profile has loaded */}
        {userProfile != null && (
          <div className="form-trust-badge" title="Your current trust score">
            <span className="form-trust-icon">◈</span>
            <span className="form-trust-value">{userProfile.trust_score}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="report-form" noValidate>

        {/* ── Title ───────────────────────────────────────────────────── */}
        <div className="field-group">
          <label className="field-label" htmlFor="title">TITLE</label>
          <input
            id="title"
            className={`field-input ${errors.title ? 'field-input--error' : ''}`}
            placeholder="e.g. Bridge flooding on Hwy 11"
            {...register('title', { required: 'Title is required' })}
          />
          {errors.title && (
            <span className="field-error-msg">{errors.title.message}</span>
          )}
        </div>

        {/* ── Incident type ───────────────────────────────────────────── */}
        <div className="field-group">
          <label className="field-label" htmlFor="type">TYPE</label>
          <select
            id="type"
            className={`field-input field-select ${errors.type ? 'field-input--error' : ''}`}
            {...register('type', { required: 'Please select an incident type' })}
          >
            <option value="">— Select incident type —</option>
            {INCIDENT_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {errors.type && (
            <span className="field-error-msg">{errors.type.message}</span>
          )}
        </div>

        {/* ── Description ─────────────────────────────────────────────── */}
        <div className="field-group">
          <label className="field-label" htmlFor="description">
            DESCRIPTION <span className="field-optional">(optional)</span>
          </label>
          <textarea
            id="description"
            className="field-input field-textarea"
            placeholder="Severity, affected area, road closures…"
            rows={3}
            {...register('description')}
          />
        </div>

        {/* ── Coordinates ─────────────────────────────────────────────── */}
        {/* These fields are auto-filled when the user clicks the map,
            but can also be typed in manually. */}
        <div className="field-row">
          <div className="field-group">
            <label className="field-label" htmlFor="latitude">
              LATITUDE
              {previewCoords && <span className="field-pin-hint"> ⊕</span>}
            </label>
            <input
              id="latitude"
              type="number"
              step="any"
              className={`field-input ${errors.latitude ? 'field-input--error' : ''}`}
              placeholder="e.g. 19.7241"
              {...register('latitude', {
                required: 'Required',
                min: { value: -90,  message: '−90 to 90'  },
                max: { value:  90,  message: '−90 to 90'  },
              })}
            />
            {errors.latitude && (
              <span className="field-error-msg">{errors.latitude.message}</span>
            )}
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="longitude">LONGITUDE</label>
            <input
              id="longitude"
              type="number"
              step="any"
              className={`field-input ${errors.longitude ? 'field-input--error' : ''}`}
              placeholder="e.g. −155.09"
              {...register('longitude', {
                required: 'Required',
                min: { value: -180, message: '−180 to 180' },
                max: { value:  180, message: '−180 to 180' },
              })}
            />
            {errors.longitude && (
              <span className="field-error-msg">{errors.longitude.message}</span>
            )}
          </div>
        </div>

        {/* ── Tip when no preview coords are set ── */}
        {!previewCoords && (
          <div className="form-map-tip">
            💡 Click anywhere on the map to auto-fill coordinates
          </div>
        )}

        {submitError && (
          <div className="form-feedback form-feedback--error">⚠ {submitError}</div>
        )}
        {submitSuccess && (
          <div className="form-feedback form-feedback--success">
            ✓ Report submitted. Pin placed on map.
          </div>
        )}

        <button type="submit" className="btn-submit" disabled={submitting}>
          {submitting ? 'TRANSMITTING…' : 'SUBMIT REPORT'}
        </button>

      </form>
    </div>
  )
}

export default ReportForm
