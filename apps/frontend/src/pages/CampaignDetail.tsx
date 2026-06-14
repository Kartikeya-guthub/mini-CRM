import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, CheckCircle, XCircle, Eye, BookOpen, MousePointer, ShoppingBag, Sparkles, Loader2, ArrowRight } from 'lucide-react'
import { io, Socket } from 'socket.io-client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import api from '../api/client'
import type { Campaign } from '../types'

interface Communication {
  id: string
  status: string
  channel: string
  customer: { name: string; email: string; city: string }
  events: { event_type: string; created_at: string }[]
}

interface CampaignDetailData extends Campaign {
  rates: { delivery: string; read: string; open: string; click: string }
  segment: { name: string; filter_definition: any }
}

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const statusColor: Record<string, string> = {
  queued:    'bg-gray-100 text-gray-600',
  sent:      'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
  read:      'bg-teal-100 text-teal-700',
  opened:    'bg-purple-100 text-purple-700',
  clicked:   'bg-indigo-100 text-indigo-700'
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [campaign, setCampaign] = useState<CampaignDetailData | null>(null)
  const [communications, setCommunications] = useState<Communication[]>([])
  const [loading, setLoading] = useState(true)
  
  const [insights, setInsights] = useState<{ summary: string; recommendation: string; suggested_filter: any } | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [creatingSegment, setCreatingSegment] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!id) return

    // Initial data load
    Promise.all([
      api.get(`/campaigns/${id}`),
      api.get(`/campaigns/${id}/communications?limit=50`)
    ]).then(([campRes, commRes]) => {
      setCampaign(campRes.data)
      setCommunications(commRes.data.data)
    }).finally(() => setLoading(false))

    // Socket.IO — live stats
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join_campaign', id)
      console.log('[SOCKET] Joined campaign room:', id)
    })

    socket.on('stats_update', (data) => {
      setCampaign(prev => prev ? {
        ...prev,
        sent_count: data.sent_count ?? prev.sent_count,
        delivered_count: data.delivered_count,
        failed_count: data.failed_count,
        read_count: data.read_count ?? 0,
        opened_count: data.opened_count,
        clicked_count: data.clicked_count,
        attributed_orders: data.attributed_orders,
        status: data.status ?? prev.status,
        rates: {
          delivery: (data.sent_count ?? prev.sent_count) > 0
            ? ((data.delivered_count / (data.sent_count ?? prev.sent_count)) * 100).toFixed(1) + '%'
            : '0%',
          read: data.delivered_count > 0
            ? (((data.read_count ?? 0) / data.delivered_count) * 100).toFixed(1) + '%'
            : '0%',
          open: data.delivered_count > 0
            ? ((data.opened_count / data.delivered_count) * 100).toFixed(1) + '%'
            : '0%',
          click: data.opened_count > 0
            ? ((data.clicked_count / data.opened_count) * 100).toFixed(1) + '%'
            : '0%'
        }
      } : prev)
    })

    socket.on('comm_update', (data) => {
      setCommunications(prev => prev.map(c => {
        if (c.id === data.id) {
          // Prevent duplicate events
          if (c.events.some(e => e.event_type === data.event_type)) return c
          return {
            ...c,
            status: data.status,
            events: [...c.events, { event_type: data.event_type, created_at: data.created_at }]
          }
        }
        return c
      }))
    })

    return () => {
      socket.disconnect()
    }
  }, [id])

  const handleAnalyze = async () => {
    if (!campaign) return
    setAnalyzing(true)
    try {
      const { data } = await api.post('/ai/insights', {
        campaign_name: campaign.name,
        segment_name: campaign.segment.name,
        sent: campaign.sent_count,
        delivered: campaign.delivered_count,
        opened: campaign.opened_count,
        clicked: campaign.clicked_count,
        attributed_orders: 0
      })
      setInsights(data)
    } catch (err) {
      console.error('Failed to get insights', err)
      alert('Failed to generate insights')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleCreateFollowUp = async () => {
    if (!insights?.suggested_filter) return
    setCreatingSegment(true)
    try {
      const { data } = await api.post('/segments', {
        name: `${campaign?.name} - Follow Up`,
        filter_definition: insights.suggested_filter
      })
      navigate('/campaigns/new', { state: { segment_id: data.id } })
    } catch (err) {
      console.error(err)
      alert('Failed to create follow-up segment')
      setCreatingSegment(false)
    }
  }

  if (loading || !campaign) {
    return <div className="flex items-center justify-center h-full text-gray-400">Loading…</div>
  }

  const funnel = [
    { label: 'Sent',      value: campaign.sent_count,       icon: Send,         color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Delivered', value: campaign.delivered_count,  icon: CheckCircle,  color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Failed',    value: campaign.failed_count,     icon: XCircle,      color: 'text-red-500',    bg: 'bg-red-50' },
    { label: 'Read',      value: campaign.read_count ?? 0,  icon: BookOpen,     color: 'text-teal-600',   bg: 'bg-teal-50' },
    { label: 'Opened',    value: campaign.opened_count,     icon: Eye,          color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Clicked',   value: campaign.clicked_count,    icon: MousePointer, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Attributed Orders', value: campaign.attributed_orders, icon: ShoppingBag, color: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5"
      >
        <ArrowLeft size={14} /> Back to Dashboard
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {campaign.segment.name} · {campaign.channel.toUpperCase()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
            campaign.status === 'running' ? 'bg-green-100 text-green-700' :
            campaign.status === 'completed' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {campaign.status}
          </span>
          {campaign.status === 'running' && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
      </div>

      {/* Funnel stats */}
      <div className="grid grid-cols-7 gap-3 mb-6">
        {funnel.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className={`inline-flex p-2 rounded-lg ${bg} ${color} mb-2`}>
              <Icon size={16} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Funnel Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Engagement Funnel</h2>
        <div className="w-full">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={[
                { name: 'Sent', count: campaign.sent_count, fill: '#3b82f6' },
                { name: 'Delivered', count: campaign.delivered_count, fill: '#10b981' },
                { name: 'Opened', count: campaign.opened_count, fill: '#8b5cf6' },
                { name: 'Clicked', count: campaign.clicked_count, fill: '#6366f1' },
              ]} 
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {[
                  { fill: '#3b82f6' },
                  { fill: '#10b981' },
                  { fill: '#8b5cf6' },
                  { fill: '#6366f1' },
                ].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Insights Section */}
      {campaign.status === 'completed' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50/50 to-indigo-50/50">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-purple-600" />
              <h2 className="font-semibold text-gray-900">Post-Campaign AI Insights</h2>
            </div>
            {!insights && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="text-sm px-4 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {analyzing ? 'Analyzing...' : 'Generate Insights'}
              </button>
            )}
          </div>
          {insights && (
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">Summary</h3>
                  <p className="text-sm text-gray-600">{insights.summary}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">Recommendation</h3>
                  <p className="text-sm text-gray-600">{insights.recommendation}</p>
                </div>
                {insights.suggested_filter && (
                  <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-sm text-gray-500">AI suggests a follow-up segment targeting engaged customers.</span>
                    <button
                      onClick={handleCreateFollowUp}
                      disabled={creatingSegment}
                      className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {creatingSegment ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                      {creatingSegment ? 'Creating...' : 'Create Follow-up Segment'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rate cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Delivery Rate', value: campaign.rates?.delivery ?? '—' },
          { label: 'Read Rate', value: campaign.rates?.read ?? '—' },
          { label: 'Open Rate', value: campaign.rates?.open ?? '—' },
          { label: 'Click Rate', value: campaign.rates?.click ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">{label}</span>
            <span className="text-xl font-bold text-gray-900">{value}</span>
          </div>
        ))}
      </div>

      {/* Communications table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Communications</h2>
          <p className="text-xs text-gray-400 mt-0.5">Individual delivery status per customer</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wide">
            <tr>
              {['Customer', 'City', 'Channel', 'Status', 'Events'].map(h => (
                <th key={h} className="text-left px-6 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {communications.map(c => (
              <tr key={c.id}>
                <td className="px-6 py-3">
                  <div className="font-medium text-gray-900">{c.customer.name}</div>
                  <div className="text-gray-400 text-xs">{c.customer.email}</div>
                </td>
                <td className="px-6 py-3 text-gray-500">{c.customer.city}</td>
                <td className="px-6 py-3 capitalize text-gray-500">{c.channel}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColor[c.status] || 'bg-gray-100 text-gray-600'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <div className="flex gap-1">
                    {c.events.map(e => (
                      <span key={e.event_type} className={`px-1.5 py-0.5 rounded text-xs ${statusColor[e.event_type] || 'bg-gray-100 text-gray-600'}`}>
                        {e.event_type}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
