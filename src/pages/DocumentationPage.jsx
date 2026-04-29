import React, { useState } from 'react'
import { BookOpen, Clock, Calendar, FileText, Info, Tag, ChevronDown } from 'lucide-react'
import useScenarioStore from '../store/scenarioStore.js'

function SnapshotCard({ snap, onRestore }) {
  return (
    <div className="gecko-card p-3 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gecko-200 font-medium truncate">{snap.note}</div>
        <div className="text-xs text-gecko-600 mt-0.5 font-mono">{new Date(snap.timestamp).toLocaleString()}</div>
        <div className="text-xs text-gecko-600">{snap.id.slice(0, 8)}...</div>
      </div>
      <button onClick={() => onRestore(snap.id)} className="gecko-btn-secondary text-xs py-1">Restore</button>
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

  return (
    <div className="animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen size={20} className="text-gecko-500" />
          <h1 className="page-title">Model Documentation</h1>
        </div>
        <p className="page-subtitle">Configure model metadata, projection parameters, and scenario information.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="stat-card">
          <div className="stat-value">{policies.length.toLocaleString()}</div>
          <div className="stat-label">Policies Loaded</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{meta.proj_months}</div>
          <div className="stat-label">Projection Months</div>
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
            <FileText size={16} className="text-gecko-500" />
            Model Information
          </h2>

          <div className="space-y-3">
            <div>
              <label className="gecko-label mb-1 block">Model Name</label>
              <input
                className="gecko-input"
                value={meta.model_name}
                onChange={e => setMeta({ model_name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="gecko-label mb-1 block">Valuation Date</label>
                <input
                  type="date"
                  className="gecko-input"
                  value={meta.valuation_date}
                  onChange={e => setMeta({ valuation_date: e.target.value })}
                />
              </div>
              <div>
                <label className="gecko-label mb-1 block">Projection Start</label>
                <input
                  type="date"
                  className="gecko-input"
                  value={meta.proj_start}
                  onChange={e => setMeta({ proj_start: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="gecko-label mb-1 block">Projection Months</label>
                <input
                  type="number"
                  className="gecko-input"
                  value={meta.proj_months}
                  min={1}
                  max={360}
                  onChange={e => setMeta({ proj_months: parseInt(e.target.value) || 24 })}
                />
              </div>
              <div>
                <label className="gecko-label mb-1 block">Time Step</label>
                <div className="gecko-input bg-[#1f1409] text-gecko-500 cursor-not-allowed">Monthly</div>
              </div>
            </div>

            <div>
              <label className="gecko-label mb-1 block">Notes / Metadata</label>
              <textarea
                className="gecko-input resize-none h-24"
                value={meta.notes}
                onChange={e => setMeta({ notes: e.target.value })}
                placeholder="Model description, version notes, change history..."
              />
            </div>
          </div>
        </div>

        {/* Character Definitions */}
        <div className="gecko-card p-4 space-y-4">
          <h2 className="font-display text-lg text-gecko-200 flex items-center gap-2">
            <Tag size={16} className="text-gecko-500" />
            Character Definitions
          </h2>
          <p className="text-xs text-gecko-500">Name the 10 policy characteristic fields used in assumptions dimensioning.</p>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {Array.from({ length: 10 }, (_, i) => {
              const key = `character_${i + 1}`
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gecko-600 w-20 flex-shrink-0">char_{i + 1}</span>
                  <input
                    className="gecko-input"
                    value={meta.char_definitions?.[key] || ''}
                    onChange={e => setMeta({
                      char_definitions: { ...meta.char_definitions, [key]: e.target.value }
                    })}
                    placeholder={`Character ${i + 1}`}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Model Architecture */}
      <div className="gecko-card p-4 mt-4">
        <h2 className="font-display text-lg text-gecko-200 flex items-center gap-2 mb-3">
          <Info size={16} className="text-gecko-500" />
          Model Architecture & Income Statement Flow
        </h2>
        <div className="grid grid-cols-3 gap-4 text-xs">
          {[
            {
              title: 'Revenue',
              color: 'text-green-400',
              items: ['Premium = Inforce × Premium Amount', 'Net Investment Income (NII)']
            },
            {
              title: 'Benefits & Expenses',
              color: 'text-red-400',
              items: ['Claims = Inforce × Claim Cost Rate', 'Commissions = Premium × Comm Rate', 'Operating Expenses (fixed + % prem)', 'Premium Tax = Premium × Tax Rate']
            },
            {
              title: 'Net Income',
              color: 'text-gecko-300',
              items: ['Pre-Tax = Revenue − Benefits − Expenses', 'Federal Income Tax (21% on pre-tax)', 'Net Income = Pre-Tax − FIT', 'Reserve Change (Balance Sheet)']
            }
          ].map(({ title, color, items }) => (
            <div key={title} className="bg-[#1a1008] rounded-lg p-3 border border-[#2a1c0e]">
              <div className={`font-semibold mb-2 uppercase tracking-wider text-[10px] ${color}`}>{title}</div>
              {items.map(item => (
                <div key={item} className="text-gecko-500 mb-1 flex items-start gap-1.5">
                  <span className="text-gecko-700 mt-0.5">›</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Snapshots */}
      <div className="gecko-card mt-4">
        <button
          className="w-full p-4 flex items-center justify-between text-left"
          onClick={() => setShowSnapshots(v => !v)}
        >
          <h2 className="font-display text-lg text-gecko-200 flex items-center gap-2">
            <Clock size={16} className="text-gecko-500" />
            Saved Snapshots ({snapshots.length})
          </h2>
          <ChevronDown size={16} className={`text-gecko-500 transition-transform ${showSnapshots ? 'rotate-180' : ''}`} />
        </button>

        {showSnapshots && (
          <div className="px-4 pb-4">
            {snapshots.length === 0 ? (
              <p className="text-sm text-gecko-600 italic">No snapshots saved yet. Use "Save Snapshot" in the top bar.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {snapshots.map(snap => (
                  <SnapshotCard
                    key={snap.id}
                    snap={snap}
                    onRestore={() => {
                      if (confirm('Restore this snapshot? Current state will be overwritten.')) {
                        restoreSnapshot(snap.id)
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
