import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Megaphone, TrendingUp, Users, ShoppingBag } from 'lucide-react'
import api from '../api/client'

interface Campaign {
  id: string
  name: string
  status: string
  channel: string
  sent_count: number
  delivered_count: number
  opened_count: number
  clicked_count: number
  attributed_orders: number
  created_at: string
  segment: { name: string }
}

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/campaigns')
      .then(r => setCampaigns(r.data))
      .finally(() => setLoading(false))
  }, [])

  const totalSent = campaigns.reduce((s, c) => s + c.sent_count, 0)
  const totalDelivered = campaigns.reduce((s, c) => s + c.delivered_count, 0)
  const totalOrders = campaigns.reduce((s, c) => s + c.attributed_orders, 0)

  const statCards = [
    { label: 'Total Campaigns', value: campaigns.length, icon: Megaphone, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Messages Sent', value: totalSent.toLocaleString(), icon: TrendingUp, color: 'bg-green-50 text-green-600' },
    { label: 'Delivered', value: totalDelivered.toLocaleString(), icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Attributed Orders', value: totalOrders, icon: ShoppingBag, color: 'bg-orange-50 text-orange-600' },
  ]

  const deliveryRate = (c: Campaign) =>
    c.sent_count > 0 ? ((c.delivered_count / c.sent_count) * 100).toFixed(0) + '%' : '—'

  const openRate = (c: Campaign) =>
    c.delivered_count > 0 ? ((c.opened_count / c.delivered_count) * 100).toFixed(0) + '%' : '—'

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-600',
      running: 'bg-green-100 text-green-700',
      completed: 'bg-blue-100 text-blue-700'
    }
    return map[status] || 'bg-gray-100 text-gray-600'
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full text-gray-400">Loading...</div>
  )

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of all campaigns and performance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className={`inline-flex p-2 rounded-lg ${color} mb-3`}>
              <Icon size={18} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Campaign table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Campaigns</h2>
          <button
            onClick={() => navigate('/campaigns/new')}
            className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + New Campaign
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            No campaigns yet. Create your first one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wide">
              <tr>
                {['Campaign', 'Segment', 'Channel', 'Sent', 'Delivery', 'Open Rate', 'Orders', 'Status'].map(h => (
                  <th key={h} className="text-left px-6 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map(c => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/campaigns/${c.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-gray-900">{c.name}</td>
                  <td className="px-6 py-4 text-gray-500">{c.segment?.name ?? '—'}</td>
                  <td className="px-6 py-4 capitalize text-gray-500">{c.channel}</td>
                  <td className="px-6 py-4">{c.sent_count.toLocaleString()}</td>
                  <td className="px-6 py-4">{deliveryRate(c)}</td>
                  <td className="px-6 py-4">{openRate(c)}</td>
                  <td className="px-6 py-4">{c.attributed_orders}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusBadge(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
