import React, { useState, useMemo } from 'react'
import { Calculator, Info, ChevronDown, ChevronRight, Search } from 'lucide-react'
import useScenarioStore from '../store/scenarioStore.js'
import { projectPolicy, getAssumptionValue, fmt, fmtPct, fmtCurrency } from '../engine/projection.js'

const RESULT_COLUMNS = [
  { key: 'duration_month', label: 'Mo', format: v => v, width: 40 },
  { key: 'cal_year', label: 'Year', format: v => v, width: 50 },
  { key: 'cal_month', label: 'Mo', format: v => v, width: 40 },
  { key: 'inforce_bop', label: 'Inforce BOP', format: v => fmt(v, 4), width: 90 },
  { key: 'lapse_rate', label: 'Lapse Rate', format: v => fmtPct(v, 3), width: 80 },
  { key: 'inforce_eop', label: 'Inforce EOP', format: v => fmt(v, 4), width: 90 },
  { key: 'premium', label: 'Premium', format: v => fmtCurrency(v), width: 90 },
  { key: 'claim_cost', label: 'Claim Cost', format: v => fmtCurrency(v), width: 85 },
  { key: 'claims', label: 'Claims', format: v => fmtCurrency(v), width: 85 },
  { key: 'commission_rate', label: 'Comm %', format: v => fmtPct(v, 1), width: 70 },
  { key: 'commissions', label: 'Commissions', format: v => fmtCurrency(v), width: 95 },
  { key: 'expenses', label: 'Expenses', format: v => fmtCurrency(v), width: 85 },
  { key: 'premium_tax', label: 'Prem Tax', format: v => fmtCurrency(v), width: 80 },
  { key: 'nii', label: 'NII', format: v => fmtCurrency(v), width: 75 },
  { key: 'reserve_change', label: 'Δ Reserve', format: v => fmtCurrency(v), width: 85 },
  { key: 'pretax_income', label: 'Pre-Tax', format: v => fmtCurrency(v), width: 85 },
  { key: 'fit', label: 'FIT', format: v => fmtCurrency(v), width: 75 },
  { key: 'net_income', label: 'Net Income', format: v => fmtCurrency(v), width: 95 },
]

const FORMULA_DESCRIPTIONS = {
  inforce_bop: 'Starting inforce for this month. At t=0, equals 1.0 per policy.',
  lapse_rate: 'Monthly lapse rate from Assumptions table (by duration t).',
  inforce_eop: 'inforce_bop × (1 − lapse_rate)',
  premium: 'inforce_bop × policy.premium_amount',
  claim_cost: 'Monthly claim cost per inforce from Assumptions (by duration t).',
  claims: 'inforce_bop × claim_cost',
  commission_rate: 'Commission rate from Assumptions (by duration t).',
  commissions: 'premium × commission_rate',
  expenses: 'inforce_bop × expense_per_policy + premium × expense_pct_prem',
  premium_tax: 'premium × prem_tax_rate',
  nii: '((reserve_bop + reserve_eop) / 2) × nii_rate',
  reserve_change: 'reserve_eop − reserve_bop  [UPR proxy = 0.5 × monthly_prem × inforce]',
  pretax_income: 'premium + nii − claims − commissions − expenses − premium_tax − reserve_change',
  fit: 'max(0, pretax_income) × fit_rate',
  net_income: 'pretax_income − fit',
}

function PolicyInfo({ policy, meta }) {
  const charDefs = meta.char_definitions || {}
  return (
    <div className="gecko-card p-4">
      <h3 className="gecko-label mb-3">Policy Inputs</h3>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div><span className="text-gecko-600">Policy #</span><div className="font-mono text-gecko-200">{policy.policy_number}</div></div>
        <div><span className="text-gecko-600">Issue Year</span><div className="font-mono text-gecko-200">{policy.issue_year}</div></div>
        <div><span className="text-gecko-600">Issue Month</span><div className="font-mono text-gecko-200">{policy.issue_month}</div></div>
        <div><span className="text-gecko-600">Premium $</span><div className="font-mono text-gecko-300">${parseFloat(policy.premium_amount || 0).toFixed(2)}/mo</div></div>
        {Array.from({ length: 10 }, (_, i) => {
          const key = `character_${i + 1}`
          const val = policy[key]
          if (!val) return null
          return (
            <div key={key}>
              <span className="text-gecko-600">{charDefs[key] || `Char ${i + 1}`}</span>
              <div className="font-mono text-gecko-200">{val}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CellDetail({ colKey, rowData }) {
  const desc = FORMULA_DESCRIPTIONS[colKey]
  return (
    <div className="gecko-card p-3 mt-2 animate-fade-in border-gecko-700/30">
      <div className="text-xs font-semibold text-gecko-300 mb-1 font-mono">{colKey}</div>
      {desc && <div className="text-xs text-gecko-500 mb-2">{desc}</div>}
      <div className="code-block text-xs">
        {`value = ${rowData?.[colKey] !== undefined ? rowData[colKey] : '—'}`}
      </div>
    </div>
  )
}

export default function CalculationsPage() {
  const meta = useScenarioStore(s => s.meta)
  const policies = useScenarioStore(s => s.policies)
  const assumptions = useScenarioStore(s => s.assumptions)

  const [selectedPolicy, setSelectedPolicy] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCell, setSelectedCell] = useState(null) // { colKey, rowIdx }
  const [showAssumptions, setShowAssumptions] = useState(false)

  const filteredPolicies = useMemo(() => {
    if (!searchQuery) return policies
    return policies.filter(p =>
      String(p.policy_number).toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [policies, searchQuery])

  const policy = useMemo(() => {
    return policies.find(p => String(p.policy_number) === selectedPolicy) || null
  }, [policies, selectedPolicy])

  const projectionResults = useMemo(() => {
    if (!policy) return []
    return projectPolicy(policy, assumptions, meta.proj_months || 24)
  }, [policy, assumptions, meta.proj_months])

  const selectedRow = selectedCell ? projectionResults[selectedCell.rowIdx] : null

  // Assumption slices for this policy
  const assumptionSlices = useMemo(() => {
    if (!policy) return []
    return [
      { label: 'Lapse Rate (t=0)', value: fmtPct(getAssumptionValue(assumptions.lapse, policy, 0), 3) },
      { label: 'Claim Cost (t=0)', value: `$${getAssumptionValue(assumptions.claim_cost, policy, 0).toFixed(2)}` },
      { label: 'Comm Rate (t=0)', value: fmtPct(getAssumptionValue(assumptions.commission_rate, policy, 0), 1) },
      { label: 'Exp/Policy', value: `$${getAssumptionValue(assumptions.expense_per_policy, policy, 0).toFixed(2)}` },
      { label: 'Exp % Prem', value: fmtPct(getAssumptionValue(assumptions.expense_pct_prem, policy, 0), 2) },
      { label: 'Prem Tax', value: fmtPct(getAssumptionValue(assumptions.prem_tax_rate, policy, 0), 2) },
      { label: 'FIT Rate', value: fmtPct(getAssumptionValue(assumptions.fit_rate, policy, 0), 1) },
    ]
  }, [policy, assumptions])

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-2 mb-1">
          <Calculator size={20} className="text-gecko-500" />
          <h1 className="page-title">Single Policy Calculator</h1>
        </div>
        <p className="page-subtitle">Select a policy to view its month-by-month projection. Click any cell to see the formula and inputs.</p>
      </div>

      {policies.length === 0 ? (
        <div className="gecko-card p-8 text-center">
          <Calculator size={36} className="text-gecko-700 mx-auto mb-3" />
          <div className="text-gecko-500">No policies loaded. Go to Liability Inputs to upload or load sample data.</div>
        </div>
      ) : (
        <>
          {/* Policy selector */}
          <div className="gecko-card p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gecko-600" />
                <input
                  className="gecko-input pl-8"
                  placeholder="Search policy number..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="gecko-select flex-1 max-w-xs"
                value={selectedPolicy}
                onChange={e => { setSelectedPolicy(e.target.value); setSelectedCell(null) }}
              >
                <option value="">— Select a policy —</option>
                {filteredPolicies.slice(0, 200).map(p => (
                  <option key={p.policy_number} value={p.policy_number}>
                    {p.policy_number} — {p.character_1 || ''} {p.character_2 || ''} ${parseFloat(p.premium_amount || 0).toFixed(0)}/mo
                  </option>
                ))}
              </select>
              {filteredPolicies.length > 200 && (
                <span className="text-xs text-gecko-600">Showing first 200 of {filteredPolicies.length}</span>
              )}
            </div>
          </div>

          {policy && (
            <>
              <PolicyInfo policy={policy} meta={meta} />

              {/* Assumption slices */}
              <div className="gecko-card p-4 mt-4">
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => setShowAssumptions(v => !v)}
                >
                  <h3 className="gecko-label">Applied Assumptions (t=0 values)</h3>
                  {showAssumptions ? <ChevronDown size={14} className="text-gecko-500" /> : <ChevronRight size={14} className="text-gecko-500" />}
                </button>
                {showAssumptions && (
                  <div className="mt-3 grid grid-cols-4 gap-2 animate-fade-in">
                    {assumptionSlices.map(({ label, value }) => (
                      <div key={label} className="bg-[#1a1008] rounded-lg p-2 border border-[#2a1c0e]">
                        <div className="text-[10px] text-gecko-600">{label}</div>
                        <div className="text-sm font-mono text-gecko-300">{value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Projection table */}
              <div className="gecko-card mt-4 overflow-hidden">
                <div className="p-3 border-b border-[#2a1c0e] flex items-center justify-between">
                  <h3 className="font-display text-base text-gecko-200">
                    Month-by-Month Projection ({projectionResults.length} months)
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-gecko-500">
                    <Info size={12} />
                    Click any cell to see formula details
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="gecko-table text-xs">
                    <thead>
                      <tr>
                        {RESULT_COLUMNS.map(col => (
                          <th key={col.key} style={{ minWidth: col.width }}>{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {projectionResults.map((row, rowIdx) => (
                        <tr key={rowIdx} className={selectedCell?.rowIdx === rowIdx ? 'bg-gecko-900/20' : ''}>
                          {RESULT_COLUMNS.map(col => {
                            const isSelected = selectedCell?.rowIdx === rowIdx && selectedCell?.colKey === col.key
                            const val = row[col.key]
                            const isNegative = typeof val === 'number' && val < 0
                            return (
                              <td
                                key={col.key}
                                className={`cursor-pointer text-right font-mono transition-colors ${
                                  isSelected ? 'bg-gecko-600/20 text-gecko-100' : ''
                                } ${isNegative ? 'text-red-400' : ''} hover:bg-gecko-700/10`}
                                onClick={() => setSelectedCell(
                                  isSelected ? null : { colKey: col.key, rowIdx }
                                )}
                              >
                                {col.format(val)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                    {/* Totals */}
                    <tfoot>
                      <tr className="border-t-2 border-gecko-700/50">
                        <td className="px-3 py-2 font-semibold text-gecko-300 font-mono text-xs" colSpan={6}>TOTAL</td>
                        {RESULT_COLUMNS.slice(6).map(col => {
                          const sum = projectionResults.reduce((s, r) => s + (typeof r[col.key] === 'number' ? r[col.key] : 0), 0)
                          return (
                            <td key={col.key} className="px-3 py-2 text-right font-mono text-xs font-semibold text-gecko-300">
                              {col.key.includes('rate') || col.key.includes('inforce') || col.key.includes('cost')
                                ? '—'
                                : fmtCurrency(sum)
                              }
                            </td>
                          )
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Cell detail */}
              {selectedCell && selectedRow && (
                <CellDetail colKey={selectedCell.colKey} rowData={selectedRow} />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
