import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '../supabaseClient'

// ─────────────────────────────────────────────────────────────────────────────
// AuthPanel — shown in the sidebar when the user is NOT logged in
//
// Lets users either sign in to an existing account or create a new one.
// Toggles between "login" and "signup" mode with a button at the bottom.
//
// Once a user logs in, Supabase fires the onAuthStateChange event in App.jsx,
// which updates the session — so this panel disappears and ReportForm appears
// automatically. No extra code needed here for that.
// ─────────────────────────────────────────────────────────────────────────────

function AuthPanel() {
  // Toggle between 'login' and 'signup' modes
  const [mode, setMode] = useState('login')

  const [loading, setLoading]       = useState(false)
  const [authError, setAuthError]   = useState(null)
  const [authSuccess, setAuthSuccess] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm()

  // Handles both sign-in and sign-up depending on the current mode
  async function onSubmit({ email, password }) {
    setLoading(true)
    setAuthError(null)
    setAuthSuccess(null)

    if (mode === 'login') {
      // Sign in with an existing email + password
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setAuthError(error.message)
      }
      // On success: App.jsx's onAuthStateChange listener automatically
      // receives the new session and updates the UI.

    } else {
      // Create a new account
      const { error } = await supabase.auth.signUp({ email, password })

      if (error) {
        setAuthError(error.message)
      } else {
        // Supabase may require email confirmation depending on your project settings.
        // If "Confirm email" is disabled in your Supabase Auth settings, the user
        // will be logged in immediately. If enabled, they need to check their email.
        setAuthSuccess(
          'Account created! Check your email to confirm, then sign in.'
        )
        reset()
      }
    }

    setLoading(false)
  }

  // Switch between login ↔ signup mode and clear any messages
  function toggleMode() {
    setMode((m) => (m === 'login' ? 'signup' : 'login'))
    setAuthError(null)
    setAuthSuccess(null)
    reset()
  }

  return (
    <div className="auth-panel">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="auth-header">
        <div className="auth-lock">⬡</div>
        <div className="auth-title">
          {mode === 'login' ? 'SECURE ACCESS' : 'CREATE ACCOUNT'}
        </div>
        <div className="auth-subtitle">
          {mode === 'login'
            ? 'Sign in to access the platform'
            : 'Contact your coordinator for an invite'}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>

        {/* ── Email ───────────────────────────────────────────────────── */}
        <div className="field-group">
          <label className="field-label" htmlFor="auth-email">EMAIL</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            className={`field-input ${errors.email ? 'field-input--error' : ''}`}
            placeholder="you@example.com"
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value:   /^\S+@\S+\.\S+$/,
                message: 'Enter a valid email address',
              },
            })}
          />
          {errors.email && (
            <span className="field-error-msg">{errors.email.message}</span>
          )}
        </div>

        {/* ── Password ────────────────────────────────────────────────── */}
        <div className="field-group">
          <label className="field-label" htmlFor="auth-password">PASSWORD</label>
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className={`field-input ${errors.password ? 'field-input--error' : ''}`}
            placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
            {...register('password', {
              required: 'Password is required',
              // Only enforce the min-length rule when signing up
              ...(mode === 'signup' && {
                minLength: {
                  value:   6,
                  message: 'Password must be at least 6 characters',
                },
              }),
            })}
          />
          {errors.password && (
            <span className="field-error-msg">{errors.password.message}</span>
          )}
        </div>

        {/* ── Feedback messages ───────────────────────────────────────── */}
        {authError   && <div className="form-feedback form-feedback--error">⚠ {authError}</div>}
        {authSuccess && <div className="form-feedback form-feedback--success">✓ {authSuccess}</div>}

        {/* ── Submit ──────────────────────────────────────────────────── */}
        <button type="submit" className="btn-submit" disabled={loading}>
          {loading
            ? 'CONNECTING…'
            : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
        </button>

      </form>

      {/* ── Toggle between login and signup ─────────────────────────────── */}
      <p className="auth-toggle">
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button className="auth-toggle-btn" type="button" onClick={toggleMode}>
          {mode === 'login' ? 'Sign up free' : 'Sign in'}
        </button>
      </p>

    </div>
  )
}

export default AuthPanel
