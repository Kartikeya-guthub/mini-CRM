import { useState, useEffect } from 'react'
import { Sparkles, Plus, Trash2, Loader2, Users } from 'lucide-react'
import api from '../api/client'
import type { FilterDefinition, FilterRule, Segment, Customer } from '../types'

const FIELDS = [
  { value: 'total_spent', label: 'Total Spent (₹)' },
  { value: 'order_count', label: 'Order Count' },
  { value: 'last_order_at', label: 'Last Order' },
  { value: 'city', label: 'City' },
]

const OPERATORS: Record<string, { value: string; label: string }[]> = {
  total_spent:   [{ value: 'gte', label: '≥' }, { value: 'lte', label: '≤' }, { value: 'gt', label: '>' }, { value: 'lt', label: '<' }],
  order_count:   [{ value: 'gte', label: '≥' }, { value: 'lte', label: '≤' }, { value: 'gt', label: '>' }, { value: 'lt', label: '<' }],
  last_order_at: [{ value: 'days_ago_gt', label: 'more than N days ago' }, { value: 'days_ago_lt', label: 'less than N days ago' }],
  city:          [{ value: 'eq', label: 'is' }, { value: 'in', label: 'is one of' }],
}

const CITIES = ['Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad']

const emptyRule = (): FilterRule => ({ field: 'total_spent', operator: 'gte', value: 0 })

export default function Segments() {
  const [segments, setSegments] = useState<Segment[]>([])
  const [mode, setMode] = useState<'ai' | 'manual'>('ai')
  const [nlPrompt, setNlPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [filter, setFilter] = useState<FilterDefinition | null>(null)
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewSample, setPreviewSample] = useState<Customer[]>([])
  const [rules, setRules] = useState<FilterRule[]>([emptyRule()])
  const [segmentName, setSegmentName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/segments').then(r => setSegments(r.data))
  }, [])

  const runAI = async () => {
    if (!nlPrompt.trim()) return
    setAiLoading(true)
    setFilter(null)
    setPreviewCount(null)
    setPreviewSample([])
    try {
      const r = await api.post('/ai/segment', { prompt: nlPrompt })
      setFilter(r.data.filter)
      setPreviewCount(r.data.count)
      setPreviewSample(r.data.sample)
    } catch {
      alert('AI could not parse this prompt. Try rephrasing or use manual mode.')
    } finally {
      setAiLoading(false)
    }
  }

  const runManualPreview = async () => {
    const def: FilterDefinition = { combinator: 'AND', rules }
    try {
      const r = await api.post('/segments/preview', { filter: def })
      setFilter(def)
      setPreviewCount(r.data.count)
      setPreviewSample(r.data.sample)
    } catch {
      alert('Preview failed. Check your filter rules.')
    }
  }

  const saveSegment = async () => {
    if (!filter || !segmentName.trim()) return
    setSaving(true)
    try {
      await api.post('/segments', { name: segmentName, filter_definition: filter })
      const r = await api.get('/segments')
      setSegments(r.data)
      setSegmentName('')
      setFilter(null)
      setPreviewCount(null)
      setPreviewSample([])
      setNlPrompt('')
    } finally {
      setSaving(false)
    }
  }

  const updateRule = (i: number, patch: Partial<FilterRule>) => {
    setRules(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Segments</h1>
        <p className="text-gray-500 text-sm mt-1">Build audiences from customer data</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Builder */}
        <div className="col-span-2 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            {(['ai', 'manual'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  mode === m ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {m === 'ai' ? '✦ AI Builder' : 'Manual'}
              </button>
            ))}
          </div>

          {mode === 'ai' ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Describe your audience
              </label>
              <textarea
                rows={3}
                value={nlPrompt}
                onChange={e => setNlPrompt(e.target.value)}
                placeholder="e.g. High value customers who haven't ordered in 45 days"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <button
                onClick={runAI}
                disabled={aiLoading || !nlPrompt.trim()}
                className="mt-3 flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {aiLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    AI is thinking…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Generate Audience
                  </>
                )}
              </button>
              {aiLoading && (
                <p className="text-xs text-gray-400 mt-2">This may take 10–15 seconds on free tier</p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="space-y-3">
                {rules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={rule.field}
                      onChange={e => updateRule(i, { field: e.target.value, operator: OPERATORS[e.target.value][0].value, value: '' })}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>

                    <select
                      value={rule.operator}
                      onChange={e => updateRule(i, { operator: e.target.value })}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {(OPERATORS[rule.field] || []).map(op => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>

                    {rule.field === 'city' && rule.operator === 'in' ? (
                      <select
                        multiple
                        value={Array.isArray(rule.value) ? rule.value as string[] : []}
                        onChange={e => updateRule(i, { value: Array.from(e.target.selectedOptions, o => o.value) })}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : rule.field === 'city' ? (
                      <select
                        value={rule.value as string}
                        onChange={e => updateRule(i, { value: e.target.value })}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <input
                        type="number"
                        value={rule.value as number}
                        onChange={e => updateRule(i, { value: Number(e.target.value) })}
                        className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    )}

                    <button onClick={() => setRules(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={() => setRules(prev => [...prev, emptyRule()])} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
                  <Plus size={14} /> Add Rule
                </button>
                <button onClick={runManualPreview} className="ml-auto flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
                  Preview Audience
                </button>
              </div>
            </div>
          )}

          {/* Preview */}
          {previewCount !== null && filter && (
            <div className="bg-white rounded-xl border border-indigo-200 p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-50 text-indigo-700 rounded-lg px-4 py-2">
                  <span className="text-2xl font-bold">{previewCount}</span>
                  <span className="text-sm ml-1">customers matched</span>
                </div>
              </div>

              {previewCount === 0 && (
                <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  No customers match this filter. Try broadening your criteria.
                </p>
              )}

              {/* Sample */}
              {previewSample.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Sample</p>
                  <div className="space-y-1">
                    {previewSample.map(c => (
                      <div key={c.id} className="flex items-center justify-between text-sm text-gray-700 py-1 border-b border-gray-50">
                        <span>{c.name}</span>
                        <span className="text-gray-400">{c.city} · ₹{c.total_spent.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Save */}
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Segment name"
                  value={segmentName}
                  onChange={e => setSegmentName(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={saveSegment}
                  disabled={saving || !segmentName.trim()}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Segment'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Saved segments */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users size={16} /> Saved Segments
          </h3>
          {segments.length === 0 ? (
            <p className="text-sm text-gray-400">No segments saved yet.</p>
          ) : (
            <div className="space-y-3">
              {segments.map(s => (
                <div key={s.id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium text-sm text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.customer_count} customers</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
