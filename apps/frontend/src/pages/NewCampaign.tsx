import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Loader2 } from 'lucide-react'
import api from '../api/client'
import type { Segment } from '../types'

const CHANNELS = ['email', 'sms', 'whatsapp', 'rcs']

export default function NewCampaign() {
  const navigate = useNavigate()
  const [segments, setSegments] = useState<Segment[]>([])
  const [segmentId, setSegmentId] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [channel, setChannel] = useState('email')
  const [aiLoading, setAiLoading] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    api.get('/segments').then(r => {
      setSegments(r.data)
      if (r.data.length > 0) setSegmentId(r.data[0].id)
    })
  }, [])

  const suggestMessage = async () => {
    const seg = segments.find(s => s.id === segmentId)
    if (!seg) return
    setAiLoading(true)
    try {
      const r = await api.post('/ai/message', { segment_name: seg.name, channel })
      setMessage(r.data.message)
    } catch (err: any) {
      console.error(err)
      const errorDetail = err.response?.data?.detail || err.response?.data?.error || err.message
      alert(`AI message generation failed: ${errorDetail}`)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!name || !segmentId || !message) return alert('Fill in all fields')
    setSending(true)
    try {
      const created = await api.post('/campaigns', { name, segment_id: segmentId, message, channel })
      await api.post(`/campaigns/${created.data.id}/send`)
      navigate(`/campaigns/${created.data.id}`)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to send campaign')
      setSending(false)
    }
  }

  const selectedSegment = segments.find(s => s.id === segmentId)

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Campaign</h1>
        <p className="text-gray-500 text-sm mt-1">Choose an audience and craft your message</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Campaign name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Campaign Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Re-engage Mumbai Shoppers"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Segment selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Audience Segment</label>
          <select
            value={segmentId}
            onChange={e => setSegmentId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {segments.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.customer_count} customers)</option>
            ))}
          </select>
          {selectedSegment && (
            <p className="text-xs text-gray-400 mt-1">
              This campaign will reach {selectedSegment.customer_count} customers
            </p>
          )}
        </div>

        {/* Channel */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Channel</label>
          <div className="flex gap-2">
            {CHANNELS.map(c => (
              <button
                key={c}
                onClick={() => setChannel(c)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                  channel === c
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-700">Message</label>
            <button
              onClick={suggestMessage}
              disabled={aiLoading || !segmentId}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {aiLoading ? 'Generating…' : 'Suggest with AI'}
            </button>
          </div>
          <textarea
            rows={4}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Write your message or use AI to generate one"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">{message.length} characters</p>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={sending || !name || !segmentId || !message}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? 'Sending Campaign…' : `Send to ${selectedSegment?.customer_count ?? 0} customers`}
        </button>
      </div>
    </div>
  )
}
