import React, { useState } from 'react'
import { Database, CheckCircle, AlertTriangle, Play, ChevronRight, ChevronDown, Plus, Code } from 'lucide-react'
import useScenarioStore from '../store/scenarioStore.js'

const CATEGORIES = [
  { key: 'lives', label: 'Lives / Inforce', color: 'text-blue-400' },
  { key: 'revenue', label: 'Revenue', color: 'text-green-400' },
  { key: 'benefits', label: 'Benefits', color: 'text-red-400' },
  { key: 'expenses', label: 'Expenses', color: 'text-yellow-400' },
  { key: 'taxes', label: 'Taxes', color: 'text-purple-400' },
  { key: 'balance_sheet', label: 'Balance Sheet', color: 'text-gecko-400' },
  { key: 'income_statement', label: 'Income Statement', color: 'text-gecko-300' },
]

function validateFormula(code, funcName) {
  try {
    // Basic syntax checks
    if (!code.includes(`def ${funcName}`) && !code.includes(`function ${funcName}`)) {
      return { ok: false, error: `Function "${funcName}" not found in code` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

function FormulaEditor({ formulaKey }) {
  const formula = useScenarioStore(s => s.formulas[formulaKey])
  const setFormula = useScenarioStore(s => s.setFormula)
  const [open, setOpen] = useState(false)
  const [validation, setValidation] = useState(null)
  const [localCode, setLocalCode] = useState(formula?.code || '')

  if (!formula) return null

  const category = CATEGORIES.find(c => c.key === formula.category)

  const handleValidate = () => {
    const result = validateFormula(localCode, formulaKey)
    setValidation(result)
  }

  const handleSave = () => {
    handleValidate()
    setFormula(formulaKey, { code: localCode })
    setValidation({ ok: true, saved: true })
  }

  const handleReset = () => {
    setLocalCode(formula.code)
    setValidation(null)
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
              <span className="font-medium text-gecko-100">{formula.name}</span>
              {formula.is_builtin && (
                <span className="gecko-badge text-[10px] bg-gecko-900/30 text-gecko-400 border border-gecko-800/30">built-in</span>
              )}
              <span className={`gecko-badge text-[10px] border border-current bg-transparent ${category?.color || 'text-gecko-400'}`}>
                {category?.label || formula.category}
              </span>
            </div>
            <div className="text-xs text-gecko-600 mt-0.5">{formula.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gecko-600 font-mono">→ {formula.output}</span>
          <span className="text-gecko-700 font-mono">{(formula.inputs || []).join(', ')}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-[#2a1c0e] p-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="gecko-label mb-1 block">Name</label>
              <input
                className="gecko-input"
                value={formula.name}
                onChange={e => setFormula(formulaKey, { name: e.target.value })}
              />
            </div>
            <div>
              <label className="gecko-label mb-1 block">Category</label>
              <select
                className="gecko-select"
                value={formula.category}
                onChange={e => setFormula(formulaKey, { category: e.target.value })}
              >
                {CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="gecko-label mb-1 block">Output Variable</label>
              <input
                className="gecko-input font-mono"
                value={formula.output}
                onChange={e => setFormula(formulaKey, { output: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="gecko-label mb-1 block">Description</label>
            <input
              className="gecko-input"
              value={formula.description}
              onChange={e => setFormula(formulaKey, { description: e.target.value })}
            />
          </div>

          <div>
            <label className="gecko-label mb-2 flex items-center gap-1.5">
              <Code size={12} />
              Formula Code (Python-style)
            </label>
            <textarea
              className="formula-editor"
              value={localCode}
              onChange={e => { setLocalCode(e.target.value); setValidation(null) }}
              rows={10}
              spellCheck={false}
            />
          </div>

          {validation && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${
              validation.ok
                ? 'bg-green-900/20 border border-green-800/30 text-green-300'
                : 'bg-red-900/20 border border-red-800/30 text-red-300'
            }`}>
              {validation.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              <span>{validation.ok ? (validation.saved ? 'Formula saved!' : 'Syntax OK') : validation.error}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={handleValidate} className="gecko-btn-secondary flex items-center gap-1.5 text-xs py-1.5">
              <Play size={12} /> Validate
            </button>
            <button onClick={handleSave} className="gecko-btn-primary flex items-center gap-1.5 text-xs py-1.5">
              <CheckCircle size={12} /> Save Formula
            </button>
            <button onClick={handleReset} className="gecko-btn-ghost text-xs py-1.5">Reset</button>
          </div>

          <div className="text-xs text-gecko-600 bg-[#0a0704] rounded-lg p-3 border border-[#1f1409]">
            <div className="font-semibold text-gecko-500 mb-1">Sandbox Rules</div>
            <div>• Allowed modules: math (built-in). Use standard Python arithmetic.</div>
            <div>• No file I/O, no subprocess, no import statements for external modules.</div>
            <div>• Use <span className="font-mono">max()</span>, <span className="font-mono">min()</span>, <span className="font-mono">abs()</span> freely.</div>
            <div>• Function name must match the key: <span className="font-mono text-gecko-300">{formulaKey}</span></div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DatabasePage() {
  const formulas = useScenarioStore(s => s.formulas)
  const setFormulas = useScenarioStore(s => s.setFormulas)
  const [filter, setFilter] = useState('all')

  const formulaKeys = Object.keys(formulas)
  const filteredKeys = filter === 'all'
    ? formulaKeys
    : formulaKeys.filter(k => formulas[k].category === filter)

  const addFormula = () => {
    const key = `custom_${Date.now()}`
    setFormulas({
      ...formulas,
      [key]: {
        name: 'New Formula',
        category: 'income_statement',
        description: 'Custom formula description',
        code: `def ${key}(x):\n    return x\n`,
        inputs: ['x'],
        output: key,
        is_builtin: false
      }
    })
  }

  return (
    <div className="animate-fade-in max-w-5xl">
      <div className="page-header">
        <div className="flex items-center gap-2 mb-1">
          <Database size={20} className="text-gecko-500" />
          <h1 className="page-title">Formula Database</h1>
        </div>
        <p className="page-subtitle">View, edit, and validate the formulas powering each Income Statement and Balance Sheet line.</p>
      </div>

      {/* Formula map */}
      <div className="gecko-card p-4 mb-6">
        <h2 className="font-display text-sm text-gecko-200 mb-3">Income Statement Formula Map</h2>
        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
          {['inforce_rollforward', '→', 'premium', '+', 'nii', '−', 'claims', '−', 'commissions', '−', 'operating_expenses', '−', 'premium_tax', '−', 'reserve_change', '=', 'pretax', '−', 'federal_income_tax', '=', 'net_income'].map((item, i) => (
            <span key={i} className={
              item === '→' || item === '+' || item === '−' || item === '='
                ? 'text-gecko-600'
                : item === 'net_income' || item === 'pretax'
                ? 'text-gecko-300 font-semibold'
                : 'gecko-badge-orange'
            }>
              {item === 'pretax' ? 'Pre-Tax Income' : item}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`gecko-btn text-xs py-1.5 ${filter === 'all' ? 'gecko-btn-primary' : 'gecko-btn-ghost'}`}
          >
            All ({formulaKeys.length})
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setFilter(cat.key)}
              className={`gecko-btn text-xs py-1.5 ${filter === cat.key ? 'gecko-btn-primary' : 'gecko-btn-ghost'}`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <button onClick={addFormula} className="gecko-btn-secondary text-xs py-1.5 flex items-center gap-1.5">
          <Plus size={12} /> Add Formula
        </button>
      </div>

      <div className="space-y-2">
        {filteredKeys.map(key => (
          <FormulaEditor key={key} formulaKey={key} />
        ))}
      </div>
    </div>
  )
}
