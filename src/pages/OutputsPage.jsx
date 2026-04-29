import React, { useState, useMemo } from 'react'
import { BarChart3, Play, Download, CheckCircle, AlertTriangle, Loader } from 'lucide-react'
import useScenarioStore from '../store/scenarioStore.js'
import { runFullModel, computeSummaryStats, fmt, fmtCurrency, fmtPct } from '../engine/projection.js'
import { downloadCSV } from '../utils/exportImport.js'

const OUTPUT_COLUMNS = [
  { key: 'policy_number', label: 'Policy #', always: true },
  { key: 't', label: 'Duration (t)', always: false },
  { key: 'cal_year', label: 'Cal Year', always: false },
  { key: 'cal_month', label: 'Cal Month', always: false },
  { key: 'duration_month', label: 'Duration Mo', always: false },
  { key: 'inforce_bop', label: 'Inforce BOP', always: false },
  { key: 'inforce_eop', label: 'Inforce EOP', always: false },
  { key: 'premium', label: 'Premium', always: true },
  { key: 'claims', label: 'Claims', always: true },
  { key: 'commissions', label: 'Commissions', always: false },
  { key: 'expenses', label: 'Expenses', always: false },
  { key: 'premium_tax', label: 'Prem Tax', always: false },
  { key: 'nii', label: 'NII', always: false },
  { key: 'reserve_change', label: 'Δ Reserve', always: false },
  { key: 'pretax_income', label: 'Pre-Tax Income', always: false },
  { key: 'fit', label: 'FIT', always: false },
  { key: 'net_income', label: 'Net Income', always: true },
  { key: 'lapse_rate', label: 'Lapse Rate', always: false },
]

export default function OutputsPage() {
  const meta = useScenarioStore(s => s.meta)
  const policies = useScenarioStore(s => s.policies)
  const assumptions = useScenarioStore(s => s.assumptions)
  const outputs = useScenarioStore(s => s.outputs)
  const setOutputs = useScenarioStore(s => s.setOutputs)
  const runStatus = useScenarioStore(s => s.runStatus)
  const runProgress = useScenarioStore(s => s.runProgress)
  const runError = useScenarioStore(s => s.runError)
  const setRunStatus = useScenarioStore(s => s.setRunStatus)

  const [selectedCols, setSelectedCols] = useState(
    new Set(OUTPUT_COLUMNS.filter(c => c.always).map(c => c.key))
  )
  const [previewPage, setPreviewPage] = useState(0)
  const PREVIEW_SIZE = 50

  const stats = useMemo(() => computeSummaryStats(outputs), [outputs])

  const handleRun = async () => {
    if (policies.length === 0) return
    setRunStatus('running', 0)
    try {
      const results = await runFullModel(
        policies,
        assumptions,
        meta.proj_months || 24,
        (pct) => setRunStatus('running', pct)
      )
      setOutputs(results)
      setRunStatus('done', 100)
    } catch (err) {
      setRunStatus('error', 0, err.message)
    }
  }

  const toggleCol = (key) => {
    const next = new Set(selectedCols)
    if (next.has(key)) {
      if (!OUTPUT_COLUMNS.find(c => c.key === key)?.always) next.delete(key)
    } else {
      next.add(key)
    }
    setSelectedCols(next)
  }

  const visibleCols = OUTPUT_COLUMNS.filter(c => selectedCols.has(c.key))
  const previewRows = outputs ? outputs.slice(previewPage * PREVIEW_SIZE, (previewPage + 1) * PREVIEW_SIZE) : []
  const totalPreviewPages = outputs ? Math.ceil(outputs.length / PREVIEW_SIZE) : 0

  const handleDownload = () => {
    if (!outputs) return
    const filtered = outputs.map(row => {
      const obj = {}
      OUTPUT_COLUMNS.filter(c => selectedCols.has(c.key)).forEach(c => {
        obj[c.key] = row[c.key]
      })
      return obj
    })
    downloadCSV(filtered, `medsupp_seriatim_${meta.valuation_date || 'output'}.csv`)
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={20} className="text-gecko-500" />
          <h1 className="page-title">Outputs — Seriatim Results</h1>
        </div>
        <p className="page-subtitle">Run the full projection model for all policies and download the seriatim output.</p>
      </div>

      {/* Control panel */}
      <div className="gecko-card p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-sm font-medium text-gecko-100">{policies.length.toLocaleString()} Policies</div>
              <div className="text-xs text-gecko-600">{meta.proj_months} months × {policies.length} = {(meta.proj_months * policies.length).toLocaleString()} rows</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {outputs && (
              <button onClick={handleDownload} className="gecko-btn-secondary flex items-center gap-1.5">
                <Download size={14} /> Download CSV
              </button>
            )}
            <button
              onClick={handleRun}
              disabled={policies.length === 0 || runStatus === 'running'}
              className="gecko-btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {runStatus === 'running' ? (
                <><Loader size={14} className="animate-spin" /> Running {runProgress}%</>
              ) : (
                <><Play size={14} /> Run All Policies</>
              )}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {runStatus === 'running' && (
          <div className="bg-[#0a0704] rounded-full h-1.5 mt-2">
            <div className="progress-bar" style={{ width: `${runProgress}%` }} />
          </div>
        )}

        {runStatus === 'error' && (
          <div className="flex items-center gap-2 mt-2 text-red-400 text-xs">
            <AlertTriangle size={13} />
            <span>Error: {runError}</span>
          </div>
        )}

        {runStatus === 'done' && (
          <div className="flex items-center gap-2 mt-2 text-green-400 text-xs">
            <CheckCircle size={13} />
            <span>Run complete — {outputs?.length?.toLocaleString()} rows generated</span>
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-3 mb-4">
          {[
            { label: 'Policies', value: stats.policies.toLocaleString() },
            { label: 'Total Premium', value: fmtCurrency(stats.totalPrem) },
            { label: 'Total Claims', value: fmtCurrency(stats.totalClaims) },
            { label: 'Loss Ratio', value: fmtPct(stats.lossRatio, 1) },
            { label: 'Net Income', value: fmtCurrency(stats.totalNetIncome) },
          ].map(({ label, value }) => (
            <div key={label} className="stat-card">
              <div className="stat-value text-xl">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Column selector */}
      {outputs && (
        <div className="gecko-card p-4 mb-4">
          <h3 className="gecko-label mb-3">Output Columns</h3>
          <div className="flex flex-wrap gap-2">
            {OUTPUT_COLUMNS.map(col => (
              <button
                key={col.key}
                onClick={() => toggleCol(col.key)}
                className={`gecko-btn text-xs py-1 px-2.5 ${selectedCols.has(col.key) ? 'gecko-btn-primary' : 'gecko-btn-ghost'} ${col.always ? 'opacity-70 cursor-not-allowed' : ''}`}
                disabled={col.always}
              >
                {col.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview table */}
      {outputs && outputs.length > 0 && (
        <div className="gecko-card overflow-hidden">
          <div className="p-3 border-b border-[#2a1c0e] flex items-center justify-between">
            <h3 className="font-display text-base text-gecko-200">
              Preview — {outputs.length.toLocaleString()} rows total
            </h3>
            <span className="text-xs text-gecko-500">Page {previewPage + 1} of {totalPreviewPages}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="gecko-table text-xs">
              <thead>
                <tr>
                  {visibleCols.map(col => <th key={col.key}>{col.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    {visibleCols.map(col => {
                      const val = row[col.key]
                      const isNum = typeof val === 'number'
                      const isNeg = isNum && val < 0
                      return (
                        <td
                          key={col.key}
                          className={`${isNum ? 'text-right font-mono' : ''} ${isNeg ? 'text-red-400' : ''}`}
                        >
                          {col.key === 'policy_number' ? val
                            : col.key.includes('rate') ? fmtPct(val, 3)
                            : col.key === 't' || col.key === 'cal_year' || col.key === 'cal_month' || col.key === 'duration_month'
                            ? val
                            : isNum ? fmtCurrency(val)
                            : val}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-[#2a1c0e] flex items-center justify-center gap-3">
            <button
              onClick={() => setPreviewPage(p => Math.max(0, p - 1))}
              disabled={previewPage === 0}
              className="gecko-btn-secondary text-xs py-1 disabled:opacity-40"
            >‹ Prev</button>
            <span className="text-xs text-gecko-500">Showing rows {previewPage * PREVIEW_SIZE + 1}–{Math.min((previewPage + 1) * PREVIEW_SIZE, outputs.length)} of {outputs.length.toLocaleString()}</span>
            <button
              onClick={() => setPreviewPage(p => Math.min(totalPreviewPages - 1, p + 1))}
              disabled={previewPage >= totalPreviewPages - 1}
              className="gecko-btn-secondary text-xs py-1 disabled:opacity-40"
            >Next ›</button>
          </div>
        </div>
      )}

      {!outputs && policies.length > 0 && (
        <div className="gecko-card p-12 text-center">
          <Play size={36} className="text-gecko-700 mx-auto mb-3" />
          <div className="text-gecko-500">Click "Run All Policies" to generate seriatim results.</div>
        </div>
      )}

      {policies.length === 0 && (
        <div className="gecko-card p-12 text-center">
          <BarChart3 size={36} className="text-gecko-700 mx-auto mb-3" />
          <div className="text-gecko-500">Load policies in the Liability Inputs page first.</div>
        </div>
      )}
    </div>
  )
}
