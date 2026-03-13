import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'

const CLEARANCE_COLORS = {
  1: '#94a3b8', 2: '#22c55e', 3: '#eab308', 4: '#f97316', 5: '#ef4444',
}
const CLEARANCE_NAMES = {
  1: 'PUB', 2: 'VOL', 3: 'COORD', 4: 'RESP', 5: 'CMD',
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function ChatSidebar({ session, clearanceLevel, isOpen, onClose, initialChannelId, inline = false }) {
  const [channels, setChannels]         = useState([])
  const [activeChannelId, setActiveChannelId] = useState(null)
  const [messages, setMessages]         = useState([])
  const [newMessage, setNewMessage]     = useState('')
  const [sending, setSending]           = useState(false)
  const [channelView, setChannelView]   = useState('region') // 'region' | 'incident'
  const [loadingMsgs, setLoadingMsgs]   = useState(false)
  const messagesEndRef = useRef(null)

  const canSend = session && clearanceLevel >= 2

  // ── Load channels ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    async function loadChannels() {
      const { data } = await supabase
        .from('channels')
        .select('*')
        .order('type', { ascending: true })
        .order('created_at', { ascending: true })

      const list = data || []
      setChannels(list)

      if (initialChannelId) {
        setActiveChannelId(initialChannelId)
        const ch = list.find(c => c.id === initialChannelId)
        if (ch) setChannelView(ch.type === 'incident' ? 'incident' : 'region')
      } else if (!activeChannelId) {
        const first = list.find(c => c.type === 'region') || list[0]
        if (first) setActiveChannelId(first.id)
      }
    }
    loadChannels()
  }, [isOpen, initialChannelId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load messages + realtime sub ─────────────────────────────────────────────
  useEffect(() => {
    if (!activeChannelId) return
    setLoadingMsgs(true)
    let sub

    async function init() {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', activeChannelId)
        .order('created_at', { ascending: true })
        .limit(100)
      setMessages(data || [])
      setLoadingMsgs(false)

      sub = supabase
        .channel(`msgs-${activeChannelId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `channel_id=eq.${activeChannelId}`,
        }, (payload) => {
          setMessages(prev =>
            prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]
          )
        })
        .subscribe()
    }

    init()
    return () => { if (sub) supabase.removeChannel(sub) }
  }, [activeChannelId])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    const trimmed = newMessage.trim()
    if (!trimmed || sending || !canSend || !activeChannelId) return

    setSending(true)
    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({
        channel_id:      activeChannelId,
        user_id:         session.user.id,
        user_email:      session.user.email,
        clearance_level: clearanceLevel,
        content:         trimmed,
      })
      .select()
      .single()

    setSending(false)
    if (!error) {
      setMessages(prev => prev.some(m => m.id === inserted.id) ? prev : [...prev, inserted])
      setNewMessage('')
    }
  }

  const regionalChannels = channels.filter(c => c.type === 'region')
  const incidentChannels = channels.filter(c => c.type === 'incident')
  const activeChannel    = channels.find(c => c.id === activeChannelId)

  if (!isOpen && !inline) return null

  return (
    <div className={inline ? 'chat-panel-inline' : 'chat-sidebar'}>

      {/* Header — only in overlay mode */}
      {!inline && (
        <div className="chat-header">
          <div className="chat-header-left">
            <span className="chat-header-icon">◈</span>
            <span className="chat-header-title">COMMS</span>
          </div>
          <button className="chat-close-btn" onClick={onClose}>✕</button>
        </div>
      )}

      {/* Channel type tabs */}
      <div className="chat-type-tabs">
        <button
          className={`chat-type-tab ${channelView === 'region' ? 'chat-type-tab--active' : ''}`}
          onClick={() => setChannelView('region')}
        >
          REGIONAL ({regionalChannels.length})
        </button>
        <button
          className={`chat-type-tab ${channelView === 'incident' ? 'chat-type-tab--active' : ''}`}
          onClick={() => setChannelView('incident')}
        >
          INCIDENTS ({incidentChannels.length})
        </button>
      </div>

      {/* Channel list */}
      <div className="chat-channel-list">
        {(channelView === 'region' ? regionalChannels : incidentChannels).map(ch => (
          <button
            key={ch.id}
            className={`chat-channel-item ${ch.id === activeChannelId ? 'chat-channel-item--active' : ''}`}
            onClick={() => setActiveChannelId(ch.id)}
          >
            <span className="chat-channel-hash">#</span>
            <span className="chat-channel-name">{ch.name}</span>
          </button>
        ))}
        {channelView === 'incident' && incidentChannels.length === 0 && (
          <div className="chat-empty-channels">
            Open a report and click OPEN COMMS to start an incident thread.
          </div>
        )}
      </div>

      {/* Active channel label */}
      {activeChannel && (
        <div className="chat-active-label">
          <span className="chat-active-hash">#</span>
          {activeChannel.name}
          {activeChannel.description && (
            <span className="chat-active-desc"> — {activeChannel.description}</span>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {loadingMsgs ? (
          <div className="chat-no-messages">LOADING…</div>
        ) : messages.length === 0 ? (
          <div className="chat-no-messages">No messages yet. Be first to transmit.</div>
        ) : (
          messages.map(msg => {
            const isMe      = session && msg.user_id === session.user.id
            const lvlColor  = CLEARANCE_COLORS[msg.clearance_level] || '#94a3b8'
            const lvlName   = CLEARANCE_NAMES[msg.clearance_level]  || 'PUB'
            return (
              <div key={msg.id} className={`chat-msg ${isMe ? 'chat-msg--me' : ''}`}>
                <div className="chat-msg-header">
                  <span
                    className="chat-msg-badge"
                    style={{ borderColor: lvlColor, color: lvlColor }}
                  >
                    {lvlName}
                  </span>
                  <span className="chat-msg-author">
                    {isMe ? 'YOU' : msg.user_email.split('@')[0]}
                  </span>
                  <span className="chat-msg-time">{formatTime(msg.created_at)}</span>
                </div>
                <div className="chat-msg-content">{msg.content}</div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        {canSend ? (
          <form className="chat-form" onSubmit={handleSend}>
            <input
              className="chat-input"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder={`Transmit on ${activeChannel?.name || '…'}`}
              disabled={sending || !activeChannelId}
              maxLength={500}
              autoComplete="off"
            />
            <button
              className="chat-send-btn"
              type="submit"
              disabled={sending || !newMessage.trim() || !activeChannelId}
            >
              TX
            </button>
          </form>
        ) : session ? (
          <div className="chat-locked">⬡ VOLUNTEER ACCESS REQUIRED TO TRANSMIT</div>
        ) : (
          <div className="chat-locked">⬡ SIGN IN TO ACCESS COMMS</div>
        )}
      </div>

    </div>
  )
}

export default ChatSidebar
