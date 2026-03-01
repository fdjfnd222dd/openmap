import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '../supabaseClient'

// ─────────────────────────────────────────────────────────────────────────────
// ReportForm — lets a logged-in user submit a new incident report
//
// We use React Hook Form (useForm) to manage the form state and validation.
// This is much cleaner than managing each field with useState manually.
//
// Props:
//   session   : the current Supabase auth session (contains the user's ID)
//   onNewReport : callback to add the new report to the map + list instantly
// ─────────────────────────────────────────────────────────────────────────────

const INCIDENT_TYPES = [
  { value: 'flood',       label: 'Flood'       },
  { value: 'fire',        label: 'Fire'        },
  { value: 'earthquake',  label: 'Earthquake'  },
  { value: 'other',       label: 'Other'       },
]

function ReportForm({ session, onNewReport }) {
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // useForm returns helpers we use to wire up our form:
  //   register   — connects an input to React Hook Form
  //   handleSubmit — wraps our submit function with validation
  //   reset      — clears all fields after a successful submit
  //   formState.errors — contains validation error messages
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm()

  // This function runs only when all fields pass validation.
  async function onSubmit(data) {
    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    // Insert the new report into the Supabase "reports" table.
    // .select().single() returns the newly created row so we can
    // add it to the map right away without refetching everything.
    const { data: inserted, error } = await supabase
      .from('reports')
      .insert([{
        title:       data.title,
        description: data.description,
        type:        data.type,
        latitude:    parseFloat(data.latitude),
        longitude:   parseFloat(data.longitude),
        user_id:     session.user.id,   // ties the report to the logged-in user
      }])
      .select()
      .single()

    setSubmitting(false)

    if (error) {
      console.error('Submit error:', error.message)
      setSubmitError(error.message)
      return
    }

    // Tell the parent (App.jsx) about the new report so it appears
    // on the map and in the list without a page refresh.
    onNewReport(inserted)
    setSubmitSuccess(true)
    reset()  // clear the form fields

    // Auto-hide the success message after 3 seconds
    setTimeout(() => setSubmitSuccess(false), 3000)
  }

  return (
    <div className="report-form-wrapper">
      <div className="form-section-header">
        <span className="form-section-icon">＋</span>
        <span className="form-section-label">SUBMIT INCIDENT REPORT</span>
      </div>

      {/* noValidate tells the browser not to show its own validation UI —
          we handle validation ourselves with React Hook Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="report-form" noValidate>

        {/* ── Incident Title ──────────────────────────────────────────── */}
        <div className="field-group">
          <label className="field-label" htmlFor="title">TITLE</label>
          <input
            id="title"
            className={`field-input ${errors.title ? 'field-input--error' : ''}`}
            placeholder="e.g. Bridge flooding on Hwy 11"
            // register connects this input to React Hook Form and sets the
            // "required" validation rule
            {...register('title', { required: 'Title is required' })}
          />
          {errors.title && (
            <span className="field-error-msg">{errors.title.message}</span>
          )}
        </div>

        {/* ── Incident Type ───────────────────────────────────────────── */}
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

        {/* ── Description (optional) ──────────────────────────────────── */}
        <div className="field-group">
          <label className="field-label" htmlFor="description">
            DESCRIPTION <span className="field-optional">(optional)</span>
          </label>
          <textarea
            id="description"
            className="field-input field-textarea"
            placeholder="Additional details — severity, affected area, road closures..."
            rows={3}
            {...register('description')}
          />
        </div>

        {/* ── Coordinates — lat and lng side by side ───────────────────── */}
        <div className="field-row">
          <div className="field-group">
            <label className="field-label" htmlFor="latitude">LATITUDE</label>
            <input
              id="latitude"
              type="number"
              step="any"
              className={`field-input ${errors.latitude ? 'field-input--error' : ''}`}
              placeholder="e.g. 19.7241"
              {...register('latitude', {
                required: 'Required',
                min: { value: -90,  message: '−90 to 90'   },
                max: { value:  90,  message: '−90 to 90'   },
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
              placeholder="e.g. -155.0868"
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

        {/* ── Feedback messages ───────────────────────────────────────── */}
        {submitError && (
          <div className="form-feedback form-feedback--error">
            ⚠ {submitError}
          </div>
        )}
        {submitSuccess && (
          <div className="form-feedback form-feedback--success">
            ✓ Report submitted. Pin placed on map.
          </div>
        )}

        {/* ── Submit button ───────────────────────────────────────────── */}
        <button type="submit" className="btn-submit" disabled={submitting}>
          {submitting ? 'TRANSMITTING…' : 'SUBMIT REPORT'}
        </button>

      </form>
    </div>
  )
}

export default ReportForm
