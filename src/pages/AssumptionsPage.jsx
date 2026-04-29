import React, { useState } from 'react'
import { Sliders, ChevronDown, ChevronRight, Plus, Info } from 'lucide-react'
import useScenarioStore from '../store/scenarioStore.js'

const ASSUMPTION_KEYS = [
  { key: 'lapse', label: 'Lapse Rate', unit: '% monthly', category: 'Decrement' },
  { key: 'claim_cost', label: 'Claim Cost', unit: '$ per inforce', category: 'Benefits' },
  { key: 'commission_rate', label: 'Commission Rate', unit: '% of premium', category: 'Expense' },
  { key: 'expense_per_policy', label: 'Expense Per Policy', unit: '$ monthly', category: 'Expense' },
  { key: 'expense_pct_prem', label: 'Expense % Premium', unit: '% of premium', category: 'Expense' },
  { key: 'prem_tax_rate', label: 'Premium Tax Rate', unit: '% of premium', category: 'Tax' },
  { key: 'fit_rate', label: 'FIT Rate', unit: '% of pre-tax income', category: 'Tax' },
  { key: 'nii_rate', label: 'NII Rate', unit: '% monthly of reserve', category: 'Investment' },
]

const ASSUMPTION_TYPES = [
  { value: 'scalar', label: 'Scalar (single value)' },
  { value: 'by_duration', label: 'By Duration (vector)' },
]

function NumberInput({ value, onChange, step = 0.001, min, className = '' }) {
  return (
    <input
      type="number"
      className={`gecko-input text-right font-mono ${className}`}
      value={value}
      step={step}
      min={min}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
    />
  )
}

function DurationEditor({ values, onChange, label }) {
  const arr = Array.isArray(values) ? values : []
  const months = Math.max(arr.length, 24)

  const handleChange = (idx, val) => {
    const newArr = [...arr]
    while (newArr.length <= idx) newArr.push(0)
    newArr[idx] = parseFloat(val) || 0
    onChange(newArr)
  }

  const handleAddYear = () => {
    const newArr = [...arr, ...Array(12).fill(arr[arr.length - 1] || 0)]
    onChange(newArr)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gecko-500">Month-by-month values (last value repeats beyond)</span>
        <button onClick={handleAddYear} className="gecko-btn-ghost text-xs py-1 flex items-center gap-1">
          <Plus size={11} /> Add Year
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              {Array.from({ length: Math.ceil(arr.length / 12) || 2 }, (_, yr) => (
                <th key={yr} colSpan={12} className="text-center px-1 py-1 text-gecko-600 font-semibold">
                  Year {yr + 1}
                </th>
              ))}
            </tr>
            <tr>
              {Array.from({ length: arr.length || 24 }, (_, i) => (
                <th key={i} className="px-1 py-0.5 text-gecko-700 font-normal text-center min-w-[56px]">
                  Mo {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {Array.from({ length: arr.length || 24 }, (_, i) => (
                <td key={i} className="px-1 py-0.5">
                  <input
                    type="number"
                    className="w-14 bg-[#0a0704] border border-[#2a1c0e] rounded px-1 py-0.5 text-center text-gecko-200 font-mono text-xs focus:outline-none focus:border-gecko-500"
                    value={arr[i] ?? 0}
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

function AssumptionPanel({ assumptionKey, label, unit, category }) {
  const assumption = useScenarioStore(s => s.assumptions[assumptionKey])
  const setAssumption = useScenarioStore(s => s.setAssumption)
  const meta = useScenarioStore(s => s.meta)
  const [open, setOpen] = useState(false)

  if (!assumption) return null

  const { type, values, description } = assumption

  const handleTypeChange = (newType) => {
    let newValues = { ...values }
    if (newType === 'scalar' && typeof values.default !== 'number') {
      newValues = { default: Array.isArray(values.default) ? values.default[0] : 0 }
    } else if (newType === 'by_duration' && !Array.isArray(values.default)) {
      newValues = { default: Array(24).fill(typeof values.default === 'number' ? values.default : 0) }
    }
    setAssumption(assumptionKey, { type: newType, values: newValues })
  }

  const handleScalarChange = (val) => {
    setAssumption(assumptionKey, { values: { ...values, default: val } })
  }

  const handleDurationChange = (arr) => {
    setAssumption(assumptionKey, { values: { ...values, default: arr } })
  }

  const categoryColors = {
    'Decrement': 'text-red-400',
    'Benefits': 'text-orange-400',
    'Expense': 'text-yellow-400',
    'Tax': 'text-blue-400',
    'Investment': 'text-green-400'
  }

  return (
    <div className="gecko-card overflow-hidden">
      <button
        className="w-full p-4 flex items-center justify-between text-left hover:bg-[#241810] transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={14} className="text-gecko-500" /> : <ChevronRight size={14} className="text-gecko-500" />}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gecko-100">{label}</span>
              <span className={`gecko-badge text-[10px] border ${categoryColors[category] || 'text-gecko-400'} border-current bg-transparent`}>
                {category}
              </span>
            </div>
            <div className="text-xs text-gecko-600 mt-0.5">{description}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-gecko-500">
          <span className="font-mono">{unit}</span>
          <span className="gecko-badge-orange">{type}</span>
          {type === 'scalar' && (
            <span className="font-mono text-gecko-300">{
              typeof values.default === 'number'
                ? unit.includes('%') ? (values.default * 100).toFixed(3) + '%' : values.default.toFixed(2)
                : '—'
            }</span>
          )}
          {type === 'by_duration' && Array.isArray(values.default) && (
            <span className="font-mono text-gecko-300">{values.default.length} months</span>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-[#2a1c0e] p-4 space-y-4 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="gecko-label mb-1 block">Description</label>
              <input
                className="gecko-input"
                value={description}
                onChange={e => setAssumption(assumptionKey, { description: e.target.value })}
              />
            </div>
            <div>
              <label className="gecko-label mb-1 block">Type</label>
              <select
                className="gecko-select w-48"
                value={type}
                onChange={e => handleTypeChange(e.target.value)}
              >
                {ASSUMPTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {type === 'scalar' && (
            <div className="flex items-center gap-3">
              <label className="gecko-label">Value ({unit})</label>
              <input
                type="number"
                className="gecko-input w-40 font-mono text-right"
                value={typeof values.default === 'number' ? values.default : 0}
                step={0.0001}
                onChange={e => handleScalarChange(parseFloat(e.target.value) || 0)}
              />
              {unit.includes('%') && (
                <span className="text-sm text-gecko-400">
                  = {((typeof values.default === 'number' ? values.default : 0) * 100).toFixed(3)}%
                </span>
              )}
            </div>
          )}

          {type === 'by_duration' && (
            <DurationEditor
              values={values.default}
              onChange={handleDurationChange}
              label={label}
            />
          )}

          <div className="flex items-center gap-2 text-xs text-gecko-600">
            <Info size={12} />
            <span>Dimensioning keys: Policy duration months start at t=0. Last value in vector repeats beyond its length.</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AssumptionsPage() {
  const categories = [...new Set(ASSUMPTION_KEYS.map(k => k.category))]

  return (
    <div className="animate-fade-in max-w-5xl">
      <div className="page-header">
        <div className="flex items-center gap-2 mb-1">
          <Sliders size={20} className="text-gecko-500" />
          <h1 className="page-title">Assumptions</h1>
        </div>
        <p className="page-subtitle">Configure lapse, claim, commission, expense, and tax assumptions. Click any row to expand and edit.</p>
      </div>

      {categories.map(cat => (
        <div key={cat} className="mb-6">
          <h2 className="gecko-label mb-3">{cat} Assumptions</h2>
          <div className="space-y-2">
            {ASSUMPTION_KEYS.filter(k => k.category === cat).map(({ key, label, unit, category }) => (
              <AssumptionPanel
                key={key}
                assumptionKey={key}
                label={label}
                unit={unit}
                category={category}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="gecko-card p-4 mt-4 bg-[#1a1008] border-gecko-800/30">
        <h3 className="font-display text-sm text-gecko-300 mb-2">📐 Assumption Notation</h3>
        <div className="grid grid-cols-2 gap-4 text-xs text-gecko-500">
          <div>
            <div className="font-semibold text-gecko-400 mb-1">Index Variables</div>
            <div>t = policy duration month (0-indexed)</div>
            <div>y, m = calendar year / month</div>
            <div>i, j = projection step</div>
          </div>
          <div>
            <div className="font-semibold text-gecko-400 mb-1">Units Convention</div>
            <div>Rates: monthly decimals (0.005 = 0.5%/mo)</div>
            <div>Costs: dollars per inforce life per month</div>
            <div>Last vector value repeats at all later durations</div>
          </div>
        </div>
      </div>
    </div>
  )
}
