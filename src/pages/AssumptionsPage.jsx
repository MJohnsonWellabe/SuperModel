import React, { useState } from 'react'
import { Sliders, ChevronDown, ChevronRight, Plus, Trash2, Info, Tag, X } from 'lucide-react'
import useScenarioStore, { makeAssumption } from '../store/scenarioStore.js'

const ASSUMPTION_TYPES = [
  { value: 'scalar',      label: 'Scalar (single value)' },
  { value: 'by_duration', label: 'By Duration (vector)' },
]

const TIME_STEPS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual',  label: 'Annual' },
]

const CATEGORY_COLORS = {
  'Decrement': 'text-red-400 border-red-800/40',
  'Benefits':  'text-orange-400 border-orange-800/40',
  'Expense':   'text-yellow-400 border-yellow-800/40',
  'Tax':       'text-blue-400 border-blue-800/40',
  'Investment':'text-green-400 border-green-800/40',
  'Custom':    'text-purple-400 border-purple-800/40',
}

const BUILTIN_CATEGORIES = {
  lapse:              'Decrement',
  claim_cost:         'Benefits',
  ccscale:            'Benefits',
  commission_rate:    'Expense',
  expense_per_policy: 'Expense',
  expense_pct_prem:   'Expense',
  prem_tax_rate:      'Tax',
  fit_rate:           'Tax',
  nii_rate:           'Investment',
}

// ─── Duration vector editor ────────────────────────────────────────────────
function DurationEditor({ values, onChange, timeStep }) {
  const arr = Array.isArray(values) ? values : []
  const unit = timeStep === 'annual' ? 'Year' : 'Mo'
  const blockSize = timeStep === 'annual' ? 5 : 12
  const defaultLen = timeStep === 'annual' ? 30 : 360

  const handleChange = (idx, val) => {
    const newArr = [...arr]
    while (newArr.length <= idx) newArr.push(arr[arr.length - 1] ?? 0)
    newArr[idx] = parseFloat(val) || 0
    onChange(newArr)
  }

  const handleFill = (startIdx, val) => {
    const newArr = [...arr]
    for (let i = startIdx; i < newArr.length; i++) newArr[i] = parseFloat(val) || 0
    onChange(newArr)
  }

  const currentLen = arr.length || defaultLen
  const displayLen = Math.min(currentLen, timeStep === 'annual' ? 30 : 120)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gecko-500">
          {displayLen} {unit.toLowerCase()}s shown (last value repeats beyond). Showing first {displayLen} of {arr.length}.
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const last = arr[arr.length - 1] ?? 0
              onChange([...arr, ...Array(blockSize).fill(last)])
            }}
            className="gecko-btn-ghost text-xs py-0.5 flex items-center gap-1"
          >
            <Plus size={10} /> Add {timeStep === 'annual' ? '5yr' : 'Year'}
          </button>
          <button
            onClick={() => onChange(arr.slice(0, Math.max(blockSize, arr.length - blockSize)))}
            className="gecko-btn-ghost text-xs py-0.5"
            disabled={arr.length <= blockSize}
          >
            − Remove Last
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              {Array.from({ length: Math.ceil(displayLen / blockSize) }, (_, grp) => (
                <th key={grp} colSpan={blockSize}
                  className="text-center px-1 py-1 text-gecko-600 font-semibold border-b border-[#2a1c0e]">
                  {timeStep === 'annual' ? `Yr ${grp * blockSize + 1}–${(grp + 1) * blockSize}` : `Year ${grp + 1}`}
                </th>
              ))}
            </tr>
            <tr>
              {Array.from({ length: displayLen }, (_, i) => (
                <th key={i} className="px-0.5 py-0.5 text-gecko-700 font-normal text-center" style={{ minWidth: 52 }}>
                  {unit}{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {Array.from({ length: displayLen }, (_, i) => (
                <td key={i} className="px-0.5 py-0.5">
                  <input
                    type="number"
                    className="w-12 bg-[#0a0704] border border-[#2a1c0e] rounded px-1 py-0.5 text-center text-gecko-200 font-mono text-xs focus:outline-none focus:border-gecko-500"
                    value={arr[i] ?? arr[arr.length - 1] ?? 0}
                    step={0.0001}
                    onChange={e => handleChange(i, e.target.value)}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Keyed value manager (for dimensioning) ─────────────────────────────────
function KeyedValuesEditor({ assumption, assumptionKey, onUpdate, charDefs }) {
  const { values, dimensioning_keys, type, time_step } = assumption
  const [newKeyParts, setNewKeyParts] = useState({})
  const [showAdd, setShowAdd] = useState(false)

  const existingKeys = Object.keys(values).filter(k => k !== 'default')

  const buildNewKey = () =>
    (dimensioning_keys || []).map(k => newKeyParts[k] || '').join('|')

  const handleAddKey = () => {
    const key = buildNewKey()
    if (!key || key.replace(/\|/g, '').trim() === '') return
    const defaultVal = values.default
    const newVal = type === 'scalar'
      ? (typeof defaultVal === 'number' ? defaultVal : 0)
      : (Array.isArray(defaultVal) ? [...defaultVal] : [0])
    onUpdate({ values: { ...values, [key]: newVal } })
    setNewKeyParts({})
    setShowAdd(false)
  }

  const handleRemoveKey = (key) => {
    const next = { ...values }
    delete next[key]
    onUpdate({ values: next })
  }

  const handleValueChange = (key, newVal) => {
    onUpdate({ values: { ...values, [key]: newVal } })
  }

  return (
    <div className="space-y-3">
      {/* Default row */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gecko-400">DEFAULT (all others)</span>
        </div>
        {type === 'scalar' ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="gecko-input w-36 font-mono text-right"
              value={typeof values.default === 'number' ? values.default : 0}
              step={0.0001}
              onChange={e => handleValueChange('default', parseFloat(e.target.value) || 0)}
            />
          </div>
        ) : (
          <DurationEditor
            values={values.default}
            onChange={v => handleValueChange('default', v)}
            timeStep={time_step}
          />
        )}
      </div>

      {/* Keyed rows */}
      {existingKeys.map(key => (
        <div key={key} className="border border-[#3d2710] rounded-lg p-3 space-y-2 bg-[#1a1008]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag size={12} className="text-gecko-500" />
              {(dimensioning_keys || []).map((dk, i) => {
                const parts = key.split('|')
                return (
                  <span key={dk} className="gecko-badge-orange text-xs">
                    {charDefs[dk] || dk}: <strong>{parts[i] || '?'}</strong>
                  </span>
                )
              })}
            </div>
            <button onClick={() => handleRemoveKey(key)} className="text-red-500 hover:text-red-300 p-1">
              <Trash2 size={12} />
            </button>
          </div>
          {type === 'scalar' ? (
            <input
              type="number"
              className="gecko-input w-36 font-mono text-right"
              value={typeof values[key] === 'number' ? values[key] : 0}
              step={0.0001}
              onChange={e => handleValueChange(key, parseFloat(e.target.value) || 0)}
            />
          ) : (
            <DurationEditor
              values={values[key]}
              onChange={v => handleValueChange(key, v)}
              timeStep={time_step}
            />
          )}
        </div>
      ))}

      {/* Add new key combo */}
      {(dimensioning_keys || []).length > 0 && (
        <div>
          {!showAdd ? (
            <button onClick={() => setShowAdd(true)} className="gecko-btn-ghost text-xs py-1 flex items-center gap-1">
              <Plus size={11} /> Add keyed override ({(dimensioning_keys || []).map(k => charDefs[k] || k).join(' × ')})
            </button>
          ) : (
            <div className="border border-gecko-700/40 rounded-lg p-3 bg-[#1a1008] space-y-2 animate-fade-in">
              <div className="text-xs text-gecko-400 font-semibold">New key combination</div>
              <div className="flex items-end gap-2 flex-wrap">
                {(dimensioning_keys || []).map(dk => (
                  <div key={dk}>
                    <label className="gecko-label mb-1 block">{charDefs[dk] || dk}</label>
                    <input
                      className="gecko-input w-32"
                      placeholder={`e.g. Plan F`}
                      value={newKeyParts[dk] || ''}
                      onChange={e => setNewKeyParts(p => ({ ...p, [dk]: e.target.value }))}
                    />
                  </div>
                ))}
                <button onClick={handleAddKey} className="gecko-btn-primary text-xs py-2">Add</button>
                <button onClick={() => setShowAdd(false)} className="gecko-btn-ghost text-xs py-2">Cancel</button>
              </div>
              <div className="text-xs text-gecko-600">Key will be: <span className="font-mono text-gecko-300">{buildNewKey() || '(fill fields above)'}</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Single assumption panel ─────────────────────────────────────────────────
function AssumptionPanel({ assumptionKey, isBuiltin }) {
  const assumption = useScenarioStore(s => s.assumptions[assumptionKey])
  const setAssumption = useScenarioStore(s => s.setAssumption)
  const removeAssumption = useScenarioStore(s => s.removeAssumption)
  const meta = useScenarioStore(s => s.meta)
  const charDefs = meta.char_definitions || {}
  const [open, setOpen] = useState(false)

  if (!assumption) return null

  const { type, description, unit, time_step, dimensioning_keys } = assumption
  const category = BUILTIN_CATEGORIES[assumptionKey] || 'Custom'
  const colorCls = CATEGORY_COLORS[category] || CATEGORY_COLORS.Custom

  const onUpdate = (updates) => setAssumption(assumptionKey, updates)

  const handleDimKeyToggle = (charKey) => {
    const current = dimensioning_keys || []
    const next = current.includes(charKey)
      ? current.filter(k => k !== charKey)
      : [...current, charKey]
    onUpdate({ dimensioning_keys: next })
  }

  const scalarVal = typeof assumption.values?.default === 'number'
    ? assumption.values.default
    : Array.isArray(assumption.values?.default) ? assumption.values.default[0] : 0

  const keyedCount = Object.keys(assumption.values || {}).filter(k => k !== 'default').length

  return (
    <div className="gecko-card overflow-hidden">
      <button
        className="w-full p-3 flex items-center justify-between text-left hover:bg-[#241810] transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2.5">
          {open ? <ChevronDown size={13} className="text-gecko-500" /> : <ChevronRight size={13} className="text-gecko-500" />}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gecko-100 text-sm">{description || assumptionKey}</span>
              <span className={`gecko-badge text-[10px] border bg-transparent ${colorCls}`}>{category}</span>
              {keyedCount > 0 && <span className="gecko-badge text-[10px] bg-gecko-900/30 text-gecko-400 border border-gecko-800/30">{keyedCount} keyed</span>}
              {(dimensioning_keys || []).length > 0 && (
                <span className="gecko-badge text-[10px] bg-indigo-900/30 text-indigo-300 border border-indigo-800/30">
                  by {(dimensioning_keys).map(k => charDefs[k] || k).join(' × ')}
                </span>
              )}
            </div>
            <div className="text-xs text-gecko-600 font-mono mt-0.5">{assumptionKey}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-gecko-500">{unit}</span>
          <span className="gecko-badge-orange">{time_step || 'monthly'}</span>
          <span className="gecko-badge-orange">{type}</span>
          {type === 'scalar' && <span className="font-mono text-gecko-300">{scalarVal}</span>}
        </div>
      </button>

      {open && (
        <div className="border-t border-[#2a1c0e] p-4 space-y-5 animate-fade-in">
          {/* Metadata row */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="gecko-label mb-1 block">Description</label>
              <input className="gecko-input" value={description} onChange={e => onUpdate({ description: e.target.value })} />
            </div>
            <div>
              <label className="gecko-label mb-1 block">Unit / Label</label>
              <input className="gecko-input" value={unit} onChange={e => onUpdate({ unit: e.target.value })} />
            </div>
            <div>
              {!isBuiltin && (
                <div className="flex flex-col gap-2 mt-4">
                  <button
                    onClick={() => { if (confirm(`Delete assumption "${assumptionKey}"?`)) removeAssumption(assumptionKey) }}
                    className="gecko-btn-danger text-xs py-1.5 flex items-center gap-1"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="gecko-label mb-1 block">Value Type</label>
              <select className="gecko-select" value={type}
                onChange={e => {
                  const newType = e.target.value
                  let newDefault = assumption.values.default
                  if (newType === 'scalar' && Array.isArray(newDefault)) newDefault = newDefault[0] ?? 0
                  if (newType === 'by_duration' && !Array.isArray(newDefault)) {
                    newDefault = Array(360).fill(typeof newDefault === 'number' ? newDefault : 0)
                  }
                  onUpdate({ type: newType, values: { ...assumption.values, default: newDefault } })
                }}
              >
                {ASSUMPTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="gecko-label mb-1 block">Time Step</label>
              <select className="gecko-select" value={time_step || 'monthly'}
                onChange={e => onUpdate({ time_step: e.target.value })}>
                {TIME_STEPS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Dimensioning keys */}
          <div>
            <label className="gecko-label mb-2 flex items-center gap-1.5">
              <Tag size={12} /> Vary By (Dimensioning Keys)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {Array.from({ length: 10 }, (_, i) => {
                const k = `character_${i + 1}`
                const label = charDefs[k] || `Char ${i + 1}`
                const active = (dimensioning_keys || []).includes(k)
                return (
                  <button
                    key={k}
                    onClick={() => handleDimKeyToggle(k)}
                    className={`gecko-btn text-xs py-1 px-2.5 ${active ? 'gecko-btn-primary' : 'gecko-btn-ghost'}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {(dimensioning_keys || []).length > 0 && (
              <div className="text-xs text-gecko-500 flex items-center gap-1">
                <Info size={11} />
                Varying by: <strong className="text-gecko-300">{(dimensioning_keys).map(k => charDefs[k] || k).join(' × ')}</strong>.
                Add keyed overrides below; unmatched policies use Default.
              </div>
            )}
          </div>

          {/* Values editor */}
          <div>
            <label className="gecko-label mb-2 block">Values</label>
            <KeyedValuesEditor
              assumption={assumption}
              assumptionKey={assumptionKey}
              onUpdate={onUpdate}
              charDefs={charDefs}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add new assumption modal ────────────────────────────────────────────────
function AddAssumptionModal({ onClose }) {
  const addAssumption = useScenarioStore(s => s.addAssumption)
  const [key, setKey] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('scalar')
  const [unit, setUnit] = useState('')
  const [defaultVal, setDefaultVal] = useState('1.0')
  const [error, setError] = useState('')

  const handleAdd = () => {
    const k = key.trim().replace(/\s+/g, '_').toLowerCase()
    if (!k) { setError('Variable name is required'); return }
    if (!/^[a-z][a-z0-9_]*$/.test(k)) { setError('Name must start with a letter, use only letters, numbers, underscores'); return }

    const val = parseFloat(defaultVal) || 0
    const assumption = makeAssumption(
      description || k,
      type,
      type === 'scalar' ? val : Array(360).fill(val),
      unit
    )
    addAssumption(k, assumption)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="gecko-card p-6 w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-gecko-200">Add New Assumption Variable</h2>
          <button onClick={onClose} className="text-gecko-600 hover:text-gecko-300"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="gecko-label mb-1 block">Variable Name <span className="text-red-400">*</span></label>
            <input className="gecko-input font-mono" placeholder="e.g. ccscale, trend_factor" value={key} onChange={e => setKey(e.target.value)} />
            <div className="text-xs text-gecko-600 mt-1">This is how you'll reference it in formulas: <span className="font-mono text-gecko-400">{key || 'variable_name'}</span></div>
          </div>

          <div>
            <label className="gecko-label mb-1 block">Description</label>
            <input className="gecko-input" placeholder="What does this assumption represent?" value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="gecko-label mb-1 block">Type</label>
              <select className="gecko-select" value={type} onChange={e => setType(e.target.value)}>
                {ASSUMPTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="gecko-label mb-1 block">Unit / Label</label>
              <input className="gecko-input" placeholder="e.g. multiplier, %" value={unit} onChange={e => setUnit(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="gecko-label mb-1 block">Default Value</label>
            <input type="number" className="gecko-input font-mono" value={defaultVal} step={0.0001} onChange={e => setDefaultVal(e.target.value)} />
            {type === 'by_duration' && <div className="text-xs text-gecko-600 mt-1">This value will fill all 360 months as the starting default. You can edit individual months after creating.</div>}
          </div>

          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={handleAdd} className="gecko-btn-primary flex-1">Add Assumption</button>
          <button onClick={onClose} className="gecko-btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function AssumptionsPage() {
  const assumptions = useScenarioStore(s => s.assumptions)
  const [showAddModal, setShowAddModal] = useState(false)
  const [filter, setFilter] = useState('all')

  const builtinKeys = Object.keys(BUILTIN_CATEGORIES)
  const allKeys = Object.keys(assumptions)
  const customKeys = allKeys.filter(k => !builtinKeys.includes(k))

  const categories = [
    { key: 'all', label: 'All' },
    { key: 'Decrement', label: 'Decrement' },
    { key: 'Benefits', label: 'Benefits' },
    { key: 'Expense', label: 'Expense' },
    { key: 'Tax', label: 'Tax' },
    { key: 'Investment', label: 'Investment' },
    { key: 'Custom', label: 'Custom' },
  ]

  const filteredKeys = allKeys.filter(k => {
    if (filter === 'all') return true
    const cat = BUILTIN_CATEGORIES[k] || 'Custom'
    return cat === filter
  })

  return (
    <div className="animate-fade-in max-w-5xl">
      <div className="page-header">
        <div className="flex items-center gap-2 mb-1">
          <Sliders size={20} className="text-gecko-500" />
          <h1 className="page-title">Assumptions</h1>
        </div>
        <p className="page-subtitle">
          Configure all assumption variables. Vary any assumption by policy characteristics (Plan, State, etc.) by selecting dimensioning keys.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {categories.map(c => (
            <button key={c.key} onClick={() => setFilter(c.key)}
              className={`gecko-btn text-xs py-1.5 ${filter === c.key ? 'gecko-btn-primary' : 'gecko-btn-ghost'}`}>
              {c.label}
              {c.key === 'Custom' && customKeys.length > 0 && (
                <span className="ml-1 gecko-badge-orange text-[10px]">{customKeys.length}</span>
              )}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAddModal(true)} className="gecko-btn-primary flex items-center gap-1.5 text-xs py-1.5">
          <Plus size={13} /> Add Variable
        </button>
      </div>

      {/* Assumption panels */}
      <div className="space-y-2">
        {filteredKeys.map(key => (
          <AssumptionPanel
            key={key}
            assumptionKey={key}
            isBuiltin={builtinKeys.includes(key)}
          />
        ))}
        {filteredKeys.length === 0 && (
          <div className="gecko-card p-8 text-center text-gecko-500 text-sm">
            No assumptions in this category. {filter === 'Custom' && 'Click "Add Variable" to create one.'}
          </div>
        )}
      </div>

      {/* Reference box */}
      <div className="gecko-card p-4 mt-6 bg-[#1a1008] border-gecko-800/20">
        <h3 className="font-display text-sm text-gecko-300 mb-2">📐 How Dimensioning Keys Work</h3>
        <div className="grid grid-cols-2 gap-4 text-xs text-gecko-500">
          <div>
            <div className="font-semibold text-gecko-400 mb-1">Example: Lapse by State</div>
            <div>1. Open the Lapse assumption</div>
            <div>2. Click "State" in the Vary By section</div>
            <div>3. Click "Add keyed override"</div>
            <div>4. Enter e.g. <span className="font-mono text-gecko-300">TX</span> and set TX-specific rates</div>
            <div>5. Policies in TX use TX rates; all others use Default</div>
          </div>
          <div>
            <div className="font-semibold text-gecko-400 mb-1">Example: ccscale by Plan × State</div>
            <div>1. Add a custom variable named <span className="font-mono text-gecko-300">ccscale</span></div>
            <div>2. Select both "Plan" and "State" as keys</div>
            <div>3. Add overrides like <span className="font-mono text-gecko-300">Plan F | TX → 1.05</span></div>
            <div>4. Reference in Claims formula: <span className="font-mono text-gecko-300">claim_cost * ccscale</span></div>
          </div>
        </div>
      </div>

      {showAddModal && <AddAssumptionModal onClose={() => setShowAddModal(false)} />}
    </div>
  )
}
