import React, { useState, useMemo } from 'react'
import { Calculator, Info, ChevronDown, ChevronRight, Search } from 'lucide-react'
import useScenarioStore from '../store/scenarioStore.js'
import { projectPolicy, getAssumptionValue, monthsElapsed, parseDate, fmt, fmtPct, fmtCurrency } from '../engine/projection.js'

const BASE_COLUMNS = [
  { key: 'duration_month', label: 'Dur Mo', format: v => fmt(v, 0) },
  { key: 'cal_year',       label: 'Year',   format: v => v },
  { key: 'cal_month',      label: 'Mo',     format: v => v },
  { key: 'inforce_bop',    label: 'Inforce BOP', format: v => fmt(v, 4) },
  { key: 'lapse_rate',     label: 'Lapse Rate',  format: v => fmtPct(v, 3) },
  { key: 'effective_lapse',label: 'Eff Lapse',   format: v => fmtPct(v, 3) },
  { key: 'inforce_eop',    label: 'Inforce EOP', format: v => fmt(v, 4) },
  { key: 'premium',        label: 'Premium',     format: v => fmtCurrency(v) },
  { key: 'claim_cost',     label: 'Claim Cost',  format: v => fmtCurrency(v) },
  { key: 'ccscale',        label: 'CC Scale',    format: v => fmt(v, 4) },
  { key: 'claims',         label: 'Claims',      format: v => fmtCurrency(v) },
  { key: 'commission_rate',label: 'Comm %',      format: v => fmtPct(v, 1) },
  { key: 'commissions',    label: 'Commissions', format: v => fmtCurrency(v) },
  { key: 'expenses',       label: 'Expenses',    format: v => fmtCurrency(v) },
  { key: 'premium_tax',    label: 'Prem Tax',    format: v => fmtCurrency(v) },
  { key: 'nii',            label: 'NII',         format: v => fmtCurrency(v) },
  { key: 'reserve_change', label: 'Δ Reserve',   format: v => fmtCurrency(v) },
  { key: 'pretax_income',  label: 'Pre-Tax',     format: v => fmtCurrency(v) },
  { key: 'fit',            label: 'FIT',         format: v => fmtCurrency(v) },
  { key: 'net_income',     label: 'Net Income',  format: v => fmtCurrency(v) },
]

const FORMULA_DESCRIPTIONS = {
  inforce_bop:    'Starting inforce this period. At valuation date, = 1.0 per policy.',
  lapse_rate:     'Monthly lapse rate from Assumptions at policy duration t.',
  effective_lapse:'For annual step: 1-(1-monthly_lapse)^12. Monthly: same as lapse_rate.',
  inforce_eop:    'inforce_bop × (1 − effective_lapse)',
  premium:        'inforce_bop × policy.premium_amount × step_months',
  claim_cost:     'Monthly claim cost per inforce from Assumptions at duration t.',
  ccscale:        'Claim cost scalar from Assumptions (supports keyed overrides).',
  claims:         'inforce_bop × claim_cost × ccscale × step_months',
  commission_rate:'Commission rate from Assumptions at duration t.',
  commissions:    'premium × commission_rate',
  expenses:       'inforce_bop × expense_per_policy + premium × expense_pct_prem',
  premium_tax:    'premium × prem_tax_rate',
  nii:            '((reserve_bop + reserve_eop) / 2) × nii_rate × step_months',
  reserve_change: 'reserve_eop − reserve_bop  [UPR proxy = 0.5 × monthly_prem × inforce]',
  pretax_income:  'premium + nii − claims − commissions − expenses − premium_tax − reserve_change',
  fit:            'max(0, pretax_income) × fit_rate',
  net_income:     'pretax_income − fit',
}

function PolicyInfo({ policy, meta, startDuration }) {
  const charDefs = meta.char_definitions || {}
  return (
    <div className="gecko-card p-4">
      <h3 className="gecko-label mb-3">Policy Inputs</h3>
      <div className="grid grid-cols-5 gap-2 text-xs">
        <div><span className="text-gecko-600">Policy #</span><div className="font-mono text-gecko-200">{policy.policy_number}</div></div>
        <div><span className="text-gecko-600">Issue Year</span><div className="font-mono text-gecko-200">{policy.issue_year}</div></div>
        <div><span className="text-gecko-600">Issue Month</span><div className="font-mono text-gecko-200">{policy.issue_month}</div></div>
        <div><span className="text-gecko-600">Premium $</span><div className="font-mono text-gecko-300">${parseFloat(policy.premium_amount || 0).toFixed(2)}/mo</div></div>
        <div>
          <span className="text-gecko-600">Start Duration</span>
          <div className="font-mono text-gecko-300">Month {startDuration + 1}</div>
          <div className="text-gecko-600 text-[10px]">at valuation date</div>
        </div>
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

export default function CalculationsPage() {
  const meta = useScenarioStore(s => s.meta)
  const policies = useScenarioStore(s => s.policies)
  const assumptions = useScenarioStore(s => s.assumptions)

  const [selectedPolicy, setSelectedPolicy] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCell, setSelectedCell] = useState(null)
  const [showAssumptions, setShowAssumptions] = useState(false)

  const valDate = meta.valuation_date
  const timeStep = meta.time_step || 'monthly'

  const filteredPolicies = useMemo(() => {
    if (!searchQuery) return policies
    return policies.filter(p =>
      String(p.policy_number).toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [policies, searchQuery])

  const policy = useMemo(() =>
    policies.find(p => String(p.policy_number) === selectedPolicy) || null,
    [policies, selectedPolicy]
  )

  // Calculate what duration this policy starts at
  const startDuration = useMemo(() => {
    if (!policy) return 0
    const { year: vy, month: vm } = parseDate(valDate)
    return monthsElapsed(
      parseInt(policy.issue_year) || vy,
      parseInt(policy.issue_month) || vm,
      vy, vm
    )
  }, [policy, valDate])

  const projectionResults = useMemo(() => {
    if (!policy) return []
    return projectPolicy(policy, assumptions, meta.proj_months || 360, valDate, timeStep)
  }, [policy, assumptions, meta.proj_months, valDate, timeStep])

  const selectedRow = selectedCell ? projectionResults[selectedCell.rowIdx] : null

  // Dynamic columns: add any custom assumption columns
  const customAssumptionKeys = Object.keys(assumptions).filter(k =>
    !['lapse','claim_cost','ccscale','commission_rate','expense_per_policy',
      'expense_pct_prem','prem_tax_rate','fit_rate','nii_rate'].includes(k)
  )
  const resultColumns = [
    ...BASE_COLUMNS,
    ...customAssumptionKeys.map(k => ({
      key: k,
      label: k,
      format: v => fmt(v, 4)
    }))
  ]

  // Assumption slices for this policy at duration startDuration
  const assumptionSlices = useMemo(() => {
    if (!policy) return []
    return Object.keys(assumptions).map(k => ({
      key: k,
      label: assumptions[k].description || k,
      value: getAssumptionValue(assumptions[k], policy, startDuration)
    }))
  }, [policy, assumptions, startDuration])

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-2 mb-1">
          <Calculator size={20} className="text-gecko-500" />
          <h1 className="page-title">Single Policy Calculator</h1>
        </div>
        <p className="page-subtitle">
          Select a policy to see its month-by-month projection starting from the valuation date.
          Click any cell to see its formula.
        </p>
      </div>

      {policies.length === 0 ? (
        <div className="gecko-card p-8 text-center">
          <Calculator size={36} className="text-gecko-700 mx-auto mb-3" />
          <div className="text-gecko-500">No policies loaded. Go to Liability Inputs to upload or load sample data.</div>
        </div>
      ) : (
        <>
          <div className="gecko-card p-4 mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gecko-600" />
                <input className="gecko-input pl-8 w-48" placeholder="Search policy #..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <select className="gecko-select flex-1 max-w-sm" value={selectedPolicy}
                onChange={e => { setSelectedPolicy(e.target.value); setSelectedCell(null) }}>
                <option value="">— Select a policy —</option>
                {filteredPolicies.slice(0, 200).map(p => (
                  <option key={p.policy_number} value={p.policy_number}>
                    {p.policy_number} — {p.character_1 || ''} {p.character_2 || ''} ${parseFloat(p.premium_amount || 0).toFixed(0)}/mo
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 text-xs text-gecko-500">
                <span>Val Date: <strong className="text-gecko-300">{valDate}</strong></span>
                <span>Step: <strong className="text-gecko-300">{timeStep}</strong></span>
              </div>
            </div>
          </div>

          {policy && (
            <>
              <PolicyInfo policy={policy} meta={meta} startDuration={startDuration} />

              {/* Assumption slices */}
              <div className="gecko-card p-4 mt-3">
                <button className="w-full flex items-center justify-between text-left"
                  onClick={() => setShowAssumptions(v => !v)}>
                  <h3 className="gecko-label">Applied Assumption Values at Duration Month {startDuration + 1}</h3>
                  {showAssumptions
                    ? <ChevronDown size={13} className="text-gecko-500" />
                    : <ChevronRight size={13} className="text-gecko-500" />}
                </button>
                {showAssumptions && (
                  <div className="mt-3 grid grid-cols-5 gap-2 animate-fade-in">
                    {assumptionSlices.map(({ key, label, value }) => (
                      <div key={key} className="bg-[#1a1008] rounded-lg p-2 border border-[#2a1c0e]">
                        <div className="text-[10px] text-gecko-600 truncate">{label}</div>
                        <div className="text-xs font-mono text-gecko-300">{typeof value === 'number' ? value.toFixed(4) : value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Projection table */}
              <div className="gecko-card mt-3 overflow-hidden">
                <div className="p-3 border-b border-[#2a1c0e] flex items-center justify-between">
                  <h3 className="font-display text-base text-gecko-200">
                    Projection: {projectionResults.length} {timeStep === 'annual' ? 'annual' : 'monthly'} steps
                    {' '}(policy starts at duration month {startDuration + 1})
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-gecko-500">
                    <Info size={11} /> Click cell for formula
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="gecko-table text-xs">
                    <thead>
                      <tr>
                        {resultColumns.map(col => <th key={col.key}>{col.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {projectionResults.map((row, rowIdx) => (
                        <tr key={rowIdx} className={selectedCell?.rowIdx === rowIdx ? 'bg-gecko-900/20' : ''}>
                          {resultColumns.map(col => {
                            const isSelected = selectedCell?.rowIdx === rowIdx && selectedCell?.colKey === col.key
                            const val = row[col.key]
                            const isNeg = typeof val === 'number' && val < 0
                            return (
                              <td key={col.key}
                                className={`cursor-pointer text-right font-mono transition-colors
                                  ${isSelected ? 'bg-gecko-600/20 text-gecko-100' : ''}
                                  ${isNeg ? 'text-red-400' : ''}
                                  hover:bg-gecko-700/10`}
                                onClick={() => setSelectedCell(isSelected ? null : { colKey: col.key, rowIdx })}
                              >
                                {col.format(val)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gecko-700/50">
                        <td className="px-3 py-2 font-semibold text-gecko-300 font-mono text-xs" colSpan={7}>TOTAL</td>
                        {resultColumns.slice(7).map(col => {
                          const isFlow = ['premium','claims','commissions','expenses','premium_tax','nii','reserve_change','pretax_income','fit','net_income'].includes(col.key)
                          const sum = isFlow ? projectionResults.reduce((s, r) => s + (typeof r[col.key] === 'number' ? r[col.key] : 0), 0) : null
                          return (
                            <td key={col.key} className="px-3 py-2 text-right font-mono text-xs font-semibold text-gecko-300">
                              {sum !== null ? fmtCurrency(sum) : '—'}
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
                <div className="gecko-card p-3 mt-2 animate-fade-in border-gecko-700/30">
                  <div className="text-xs font-semibold text-gecko-300 mb-1 font-mono">{selectedCell.colKey}</div>
                  <div className="text-xs text-gecko-500 mb-2">
                    {FORMULA_DESCRIPTIONS[selectedCell.colKey] || 'User-defined assumption variable'}
                  </div>
                  <div className="code-block text-xs">
                    {`value at step ${selectedRow.step} (dur month ${selectedRow.duration_month}) = ${
                      selectedRow[selectedCell.colKey] !== undefined
                        ? (typeof selectedRow[selectedCell.colKey] === 'number'
                          ? selectedRow[selectedCell.colKey].toFixed(6)
                          : selectedRow[selectedCell.colKey])
                        : '—'
                    }`}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
