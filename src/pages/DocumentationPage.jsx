import React, { useState } from 'react'
import { BookOpen, Clock, FileText, Info, Tag, ChevronDown, AlertTriangle } from 'lucide-react'
import useScenarioStore, { toEndOfMonth } from '../store/scenarioStore.js'

function EOMDateInput({ label, value, onChange }) {
  const [raw, setRaw] = useState(value)
  const [warn, setWarn] = useState('')

  const handleBlur = () => {
    if (!raw) return
    const eom = toEndOfMonth(raw)
    if (eom !== raw) {
      setWarn(`Adjusted to end of month: ${eom}`)
      setRaw(eom)
      onChange(eom)
    } else {
      setWarn('')
      onChange(eom)
    }
  }

  return (
    <div>
      <label className="gecko-label mb-1 block">{label}</label>
      <input
        type="date"
        className="gecko-input"
        value={raw}
        onChange={e => { setRaw(e.target.value); setWarn('') }}
        onBlur={handleBlur}
      />
      {warn && (
        <div className="flex items-center gap-1 mt-1 text-xs text-yellow-400">
          <AlertTriangle size={11} /> {warn}
        </div>
      )}
    </div>
  )
}

function SnapshotCard({ snap, onRestore }) {
  return (
    <div className="gecko-card p-3 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gecko-200 font-medium truncate">{snap.note}</div>
        <div className="text-xs text-gecko-600 mt-0.5 font-mono">{new Date(snap.timestamp).toLocaleString()}</div>
        <div className="text-xs text-gecko-700">{snap.id.slice(0, 8)}…</div>
      </div>
      <button onClick={() => onRestore(snap.id)} className="gecko-btn-secondary text-xs py-1 flex-shrink-0">Restore</button>
    </div>
  )
}

export default function DocumentationPage() {
  const meta = useScenarioStore(s => s.meta)
  const setMeta = useScenarioStore(s => s.setMeta)
  const snapshots = useScenarioStore(s => s.snapshots)
  const restoreSnapshot = useScenarioStore(s => s.restoreSnapshot)
  const policies = useScenarioStore(s => s.policies)
  const assumptions = useScenarioStore(s => s.assumptions)
  const formulas = useScenarioStore(s => s.formulas)

  const [showSnapshots, setShowSnapshots] = useState(false)

  const projYears = Math.round((meta.proj_months || 360) / 12)

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="page-header">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen size={20} className="text-gecko-500" />
          <h1 className="page-title">Model Documentation</h1>
        </div>
        <p className="page-subtitle">Configure model metadata, projection parameters, and scenario information.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="stat-card">
          <div className="stat-value">{policies.length.toLocaleString()}</div>
          <div className="stat-label">Policies Loaded</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{meta.proj_months}</div>
          <div className="stat-label">Proj Months ({projYears} yrs)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{Object.keys(assumptions).length}</div>
          <div className="stat-label">Assumption Tables</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{Object.keys(formulas).length}</div>
          <div className="stat-label">Formulas</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Model Info */}
        <div className="gecko-card p-4 space-y-4">
          <h2 className="font-display text-lg text-gecko-200 flex items-center gap-2">
            <FileText size={16} className="text-gecko-500" /> Model Information
          </h2>

          <div className="space-y-3">
            <div>
              <label className="gecko-label mb-1 block">Model Name</label>
              <input className="gecko-input" value={meta.model_name}
                onChange={e => setMeta({ model_name: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <EOMDateInput
                label="Valuation Date (end of month)"
                value={meta.valuation_date}
                onChange={v => setMeta({ valuation_date: v, proj_start: v })}
              />
              <EOMDateInput
                label="Projection Start"
                value={meta.proj_start}
                onChange={v => setMeta({ proj_start: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="gecko-label mb-1 block">Projection Months</label>
                <input type="number" className="gecko-input" value={meta.proj_months}
                  min={1} max={600}
                  onChange={e => setMeta({ proj_months: parseInt(e.target.value) || 360 })} />
                <div className="text-xs text-gecko-600 mt-1">
                  = {Math.round((parseInt(meta.proj_months) || 360) / 12)} years
                </div>
              </div>
              <div>
                <label className="gecko-label mb-1 block">Time Step</label>
                <select className="gecko-select" value={meta.time_step || 'monthly'}
                  onChange={e => setMeta({ time_step: e.target.value })}>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
                <div className="text-xs text-gecko-600 mt-1">
                  {meta.time_step === 'annual'
                    ? 'Annual: lapses compounded, flows × 12'
                    : 'Monthly: one row per policy per month'}
                </div>
              </div>
            </div>

            <div>
              <label className="gecko-label mb-1 block">Notes / Metadata</label>
              <textarea className="gecko-input resize-none h-20" value={meta.notes}
                onChange={e => setMeta({ notes: e.target.value })}
                placeholder="Model description, version notes, change history..." />
            </div>
          </div>
        </div>

        {/* Character Definitions */}
        <div className="gecko-card p-4 space-y-3">
          <h2 className="font-display text-lg text-gecko-200 flex items-center gap-2">
            <Tag size={16} className="text-gecko-500" /> Character Definitions
          </h2>
          <p className="text-xs text-gecko-500">
            Name the 10 policy characteristic fields. These names appear in the Assumptions dimensioning key selectors.
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {Array.from({ length: 10 }, (_, i) => {
              const key = `character_${i + 1}`
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gecko-600 w-16 flex-shrink-0">char_{i + 1}</span>
                  <input className="gecko-input" value={meta.char_definitions?.[key] || ''}
                    onChange={e => setMeta({
                      char_definitions: { ...meta.char_definitions, [key]: e.target.value }
                    })}
                    placeholder={`Character ${i + 1}`} />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Duration note */}
      <div className="gecko-card p-4 mt-4 border-gecko-700/20 bg-[#1a1008]">
        <div className="flex items-start gap-2">
          <Info size={15} className="text-gecko-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gecko-400 space-y-1">
            <div className="font-semibold text-gecko-300">Policy Duration Handling</div>
            <div>Each policy starts projection at the <strong>valuation date</strong>, not at duration 1.
              A policy issued 6 months before the valuation date begins at duration month 7, picking up
              assumptions from that point in the duration vector. Policies issued after the valuation date
              start at duration 1.</div>
            <div className="text-gecko-500">Valuation dates are enforced as end-of-month dates (e.g. Jan 31, Feb 28, etc.).</div>
          </div>
        </div>
      </div>

      {/* Model flow */}
      <div className="gecko-card p-4 mt-4">
        <h2 className="font-display text-lg text-gecko-200 flex items-center gap-2 mb-3">
          <Info size={16} className="text-gecko-500" /> Income Statement Flow
        </h2>
        <div className="grid grid-cols-3 gap-4 text-xs">
          {[
            { title: 'Revenue', color: 'text-green-400', items: ['Premium = Inforce × Premium Amount', 'Net Investment Income (NII)'] },
            { title: 'Benefits & Expenses', color: 'text-red-400', items: ['Claims = Inforce × Claim Cost × ccscale', 'Commissions = Premium × Comm Rate', 'Operating Expenses (fixed + % prem)', 'Premium Tax = Premium × Tax Rate'] },
            { title: 'Net Income', color: 'text-gecko-300', items: ['Pre-Tax = Revenue − Benefits − Expenses', 'FIT = max(0, Pre-Tax) × 21%', 'Net Income = Pre-Tax − FIT', 'Reserve Change → Balance Sheet'] }
          ].map(({ title, color, items }) => (
            <div key={title} className="bg-[#1a1008] rounded-lg p-3 border border-[#2a1c0e]">
              <div className={`font-semibold mb-2 uppercase tracking-wider text-[10px] ${color}`}>{title}</div>
              {items.map(item => (
                <div key={item} className="text-gecko-500 mb-1 flex items-start gap-1.5">
                  <span className="text-gecko-700 mt-0.5">›</span><span>{item}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Snapshots */}
      <div className="gecko-card mt-4">
        <button className="w-full p-4 flex items-center justify-between text-left"
          onClick={() => setShowSnapshots(v => !v)}>
          <h2 className="font-display text-lg text-gecko-200 flex items-center gap-2">
            <Clock size={16} className="text-gecko-500" /> Saved Snapshots ({snapshots.length})
          </h2>
          <ChevronDown size={16} className={`text-gecko-500 transition-transform ${showSnapshots ? 'rotate-180' : ''}`} />
        </button>
        {showSnapshots && (
          <div className="px-4 pb-4">
            {snapshots.length === 0 ? (
              <p className="text-sm text-gecko-600 italic">No snapshots saved. Use "Save Snapshot" in the top bar.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {snapshots.map(snap => (
                  <SnapshotCard key={snap.id} snap={snap}
                    onRestore={() => { if (confirm('Restore this snapshot? Current state will be overwritten.')) restoreSnapshot(snap.id) }} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
