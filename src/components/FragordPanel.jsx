import { useState } from 'react'
import { supabase } from '../supabaseClient'

const PRIORITY_CFG = {
  ROUTINE:   { color: '#6a9fc0', glow: 'rgba(106,159,192,0.3)' },
  PRIORITY:  { color: '#f59e0b', glow: 'rgba(245,158,11,0.4)'  },
  IMMEDIATE: { color: '#f97316', glow: 'rgba(249,115,22,0.4)'  },
  FLASH:     { color: '#f43f5e', glow: 'rgba(244,63,94,0.5)'   },
}

// Banner shown to all users when an active FRAGORD exists
export function FragordBanner({ fragord, onAcknowledge }) {
  if (!fragord) return null
  const cfg = PRIORITY_CFG[fragord.priority] || PRIORITY_CFG.ROUTINE
  return (
    <div
      className="fragord-banner"
      style={{ borderColor: cfg.color, boxShadow: `0 0 20px ${cfg.glow}` }}
    >
      <div className="fragord-banner-left">
        <span className="fragord-priority-badge" style={{ color: cfg.color, borderColor: cfg.color }}>
          ⬡ {fragord.priority}
        </span>
        <span className="fragord-banner-title">{fragord.title}</span>
        <span className="fragord-banner-sep">—</span>
        <span className="fragord-banner-content">{fragord.content}</span>
      </div>
      <div className="fragord-banner-right">
        {fragord.issued_by_email && (
          <span className="fragord-issuer">ISSUED: {fragord.issued_by_email.split('@')[0].toUpperCase()}</span>
        )}
        <button className="fragord-ack-btn" onClick={onAcknowledge}>
          ACKNOWLEDGED ✓
        </button>
      </div>
    </div>
  )
}

// Broadcast button + dropdown form for L5 commanders
export function FragordBroadcast({ session }) {
  const [open, setOpen]         = useState(false)
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [form, setForm] = useState({
    title: '', content: '', priority: 'PRIORITY',
  })

  async function handleSend(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim() || !session) return
    setSending(true)

    // Deactivate previous fragrods
    await supabase.from('fragrods').update({ active: false }).eq('active', true)

    // Insert new one
    await supabase.from('fragrods').insert({
      title:           form.title.trim(),
      content:         form.content.trim(),
      priority:        form.priority,
      issued_by:       session.user.id,
      issued_by_email: session.user.email,
      active:          true,
    })

    setSending(false)
    setSent(true)
    setForm({ title: '', content: '', priority: 'PRIORITY' })
    setTimeout(() => { setSent(false); setOpen(false) }, 1500)
  }

  const cfg = PRIORITY_CFG[form.priority] || PRIORITY_CFG.PRIORITY

  return (
    <div className="fragord-broadcast-wrap" onClick={e => e.stopPropagation()}>
      <button
        className={`fragord-broadcast-btn ${open ? 'fragord-broadcast-btn--active' : ''}`}
        onClick={() => setOpen(p => !p)}
        title="Issue FRAGORD broadcast"
      >
        ⬡ BROADCAST
      </button>

      {open && (
        <div className="fragord-form-dropdown">
          <div className="fragord-form-header">ISSUE FRAGORD</div>
          {sent ? (
            <div className="fragord-sent">✓ BROADCAST TRANSMITTED</div>
          ) : (
            <form onSubmit={handleSend} className="fragord-form">
              <div className="fragord-priority-row">
                {['ROUTINE', 'PRIORITY', 'IMMEDIATE', 'FLASH'].map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`fragord-pri-btn ${form.priority === p ? 'fragord-pri-btn--active' : ''}`}
                    style={form.priority === p
                      ? { color: PRIORITY_CFG[p].color, borderColor: PRIORITY_CFG[p].color }
                      : {}}
                    onClick={() => setForm(f => ({ ...f, priority: p }))}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input
                className="fragord-input"
                placeholder="Subject / Task title…"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
                maxLength={100}
                style={{ borderColor: open ? cfg.color + '55' : undefined }}
              />
              <textarea
                className="fragord-textarea"
                placeholder="Order content…"
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                required
                rows={4}
                maxLength={500}
              />
              <button
                type="submit"
                className="fragord-send-btn"
                disabled={sending}
                style={{ background: cfg.color }}
              >
                {sending ? 'TRANSMITTING…' : `TRANSMIT ${form.priority}`}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
