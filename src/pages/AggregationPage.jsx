import React, { useMemo, useState } from 'react'
import { TrendingUp, Download, BarChart3, LineChart } from 'lucide-react'
import {
  BarChart, Bar, LineChart as RLineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts'
import useScenarioStore from '../store/scenarioStore.js'
import { aggregateResults, fmtCurrency, fmtPct, fmt } from '../engine/projection.js'
import { downloadCSV } from '../utils/exportImport.js'

const CHART_COLORS = {
  premium: '#f97316',
  claims: '#ef4444',
  commissions: '#eab308',
  expenses: '#a855f7',
  net_income: '#22c55e',
  pretax_income: '#3b82f6',
  premium_tax: '#f472b6',
  nii: '#06b6d4',
  reserve_change: '#8b5cf6'
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="gecko-card p-3 text-xs shadow-xl">
      <div className="font-semibold text-gecko-200 mb-2">{label}</div>
      {payload.map(entry => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-mono text-gecko-100">{fmtCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function AggregationPage() {
  const outputs = useScenarioStore(s => s.outputs)
  const meta = useScenarioStore(s => s.meta)
  const [activeChart, setActiveChart] = useState('bar')
  const [view, setView] = useState('is') // is | bs

  const monthly = useMemo(() => {
    if (!outputs || outputs.length === 0) return []
    return aggregateResults(outputs)
  }, [outputs])

  const totals = useMemo(() => {
    if (!monthly.length) return null
    return monthly.reduce((acc, row) => {
      ['premium', 'claims', 'commissions', 'expenses', 'premium_tax', 'nii', 'pretax_income', 'fit', 'net_income', 'reserve_change'].forEach(k => {
        acc[k] = (acc[k] || 0) + row[k]
      })
      return acc
    }, {})
  }, [monthly])

  const chartData = useMemo(() => {
    return monthly.map(row => ({
      period: `${row.cal_year}-${String(row.cal_month).padStart(2, '0')}`,
      Premium: row.premium,
      Claims: row.claims,
      Commissions: row.commissions,
      Expenses: row.expenses,
      'Net Income': row.net_income,
      NII: row.nii,
    }))
  }, [monthly])

  const incomeStatementLines = [
    { key: 'premium', label: 'Premiums', sign: '+', style: 'text-green-400' },
    { key: 'nii', label: 'Net Investment Income', sign: '+', style: 'text-cyan-400' },
    { key: 'claims', label: 'Claims / Benefits', sign: '−', style: 'text-red-400' },
    { key: 'commissions', label: 'Commissions', sign: '−', style: 'text-yellow-400' },
    { key: 'expenses', label: 'Operating Expenses', sign: '−', style: 'text-purple-400' },
    { key: 'premium_tax', label: 'Premium Taxes', sign: '−', style: 'text-pink-400' },
    { key: 'reserve_change', label: 'Reserve Change (Δ)', sign: '−', style: 'text-indigo-400' },
    { key: 'pretax_income', label: 'Pre-Tax Income', sign: '=', style: 'text-blue-300 font-semibold border-t border-[#3d2710]' },
    { key: 'fit', label: 'Federal Income Tax', sign: '−', style: 'text-orange-400' },
    { key: 'net_income', label: 'Net Income', sign: '=', style: 'text-gecko-300 font-bold border-t-2 border-gecko-600/50' },
  ]

  if (!outputs || outputs.length === 0) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={20} className="text-gecko-500" />
            <h1 className="page-title">Aggregation</h1>
          </div>
        </div>
        <div className="gecko-card p-12 text-center">
          <TrendingUp size={36} className="text-gecko-700 mx-auto mb-3" />
          <div className="text-gecko-500">Run the model on the Outputs page first to generate aggregated results.</div>
        </div>
      </div>
    )
  }

  const lossRatio = totals?.premium > 0 ? totals.claims / totals.premium : 0
  const expenseRatio = totals?.premium > 0 ? (totals.commissions + totals.expenses) / totals.premium : 0
  const combinedRatio = lossRatio + expenseRatio

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={20} className="text-gecko-500" />
          <h1 className="page-title">Aggregation — Financial Statements</h1>
        </div>
        <p className="page-subtitle">Aggregated Income Statement and Balance Sheet from seriatim model results.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total Premium', value: fmtCurrency(totals.premium) },
          { label: 'Total Claims', value: fmtCurrency(totals.claims) },
          { label: 'Net Income', value: fmtCurrency(totals.net_income) },
          { label: 'Loss Ratio', value: fmtPct(lossRatio, 1) },
          { label: 'Expense Ratio', value: fmtPct(expenseRatio, 1) },
          { label: 'Combined Ratio', value: fmtPct(combinedRatio, 1) },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card">
            <div className="stat-value text-xl">{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Income Statement Table */}
        <div className="col-span-2">
          <div className="gecko-card overflow-hidden">
            <div className="p-3 border-b border-[#2a1c0e] flex items-center justify-between">
              <h2 className="font-display text-base text-gecko-200">Income Statement</h2>
              <button
                onClick={() => downloadCSV(monthly, `medsupp_income_statement_${meta.valuation_date}.csv`)}
                className="gecko-btn-ghost text-xs py-1 flex items-center gap-1"
              >
                <Download size={11} /> CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="gecko-table text-xs">
                <thead>
                  <tr>
                    <th className="text-left">Line Item</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Avg/Mo</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeStatementLines.map(({ key, label, sign, style }) => (
                    <tr key={key}>
                      <td className={`${style}`}>
                        <span className="text-gecko-600 mr-2 font-mono">{sign}</span>
                        {label}
                      </td>
                      <td className={`text-right font-mono ${style} ${totals[key] < 0 ? 'text-red-400' : ''}`}>
                        {fmtCurrency(totals[key])}
                      </td>
                      <td className={`text-right font-mono text-gecko-500`}>
                        {monthly.length > 0 ? fmtCurrency(totals[key] / monthly.length) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Balance Sheet (simplified) */}
          <div className="gecko-card mt-4 overflow-hidden">
            <div className="p-3 border-b border-[#2a1c0e]">
              <h2 className="font-display text-base text-gecko-200">Balance Sheet (Simplified)</h2>
            </div>
            <div className="p-4 space-y-2 text-xs">
              <div className="font-semibold text-gecko-400 uppercase tracking-wider mb-2">Assets</div>
              <div className="flex justify-between">
                <span className="text-gecko-500">Cash / Assets (Placeholder)</span>
                <span className="font-mono text-gecko-300">{fmtCurrency(Math.max(0, totals.net_income))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gecko-500">Reserve (UPR Proxy)</span>
                <span className="font-mono text-gecko-300">{fmtCurrency(Math.abs(totals.reserve_change))}</span>
              </div>
              <div className="gecko-divider" />
              <div className="font-semibold text-gecko-400 uppercase tracking-wider mb-2">Liabilities</div>
              <div className="flex justify-between">
                <span className="text-gecko-500">Policy Reserves</span>
                <span className="font-mono text-gecko-300">{fmtCurrency(Math.abs(totals.reserve_change))}</span>
              </div>
              <div className="gecko-divider" />
              <div className="font-semibold text-gecko-400 uppercase tracking-wider mb-2">Equity</div>
              <div className="flex justify-between font-semibold">
                <span className="text-gecko-300">Retained Earnings</span>
                <span className={`font-mono ${totals.net_income >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtCurrency(totals.net_income)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="col-span-3 space-y-4">
          <div className="gecko-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base text-gecko-200">Monthly Revenue vs Claims</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveChart('bar')}
                  className={`gecko-btn text-xs py-1 ${activeChart === 'bar' ? 'gecko-btn-primary' : 'gecko-btn-ghost'}`}
                >
                  <BarChart3 size={12} />
                </button>
                <button
                  onClick={() => setActiveChart('line')}
                  className={`gecko-btn text-xs py-1 ${activeChart === 'line' ? 'gecko-btn-primary' : 'gecko-btn-ghost'}`}
                >
                  <LineChart size={12} />
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              {activeChart === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a1c0e" />
                  <XAxis dataKey="period" tick={{ fill: '#8a6040', fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#8a6040', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#8a6040' }} />
                  <Bar dataKey="Premium" fill={CHART_COLORS.premium} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Claims" fill={CHART_COLORS.claims} radius={[2, 2, 0, 0]} />
                </BarChart>
              ) : (
                <RLineChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a1c0e" />
                  <XAxis dataKey="period" tick={{ fill: '#8a6040', fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#8a6040', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#8a6040' }} />
                  <Line type="monotone" dataKey="Premium" stroke={CHART_COLORS.premium} dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="Claims" stroke={CHART_COLORS.claims} dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="Net Income" stroke={CHART_COLORS.net_income} dot={false} strokeWidth={2} strokeDasharray="4 2" />
                </RLineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Net Income chart */}
          <div className="gecko-card p-4">
            <h2 className="font-display text-base text-gecko-200 mb-4">Net Income by Month</h2>
            <ResponsiveContainer width="100%" height={180}>
              <RLineChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a1c0e" />
                <XAxis dataKey="period" tick={{ fill: '#8a6040', fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#8a6040', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="Net Income" stroke={CHART_COLORS.net_income} dot={false} strokeWidth={2.5} />
              </RLineChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly IS table */}
          <div className="gecko-card overflow-hidden">
            <div className="p-3 border-b border-[#2a1c0e] flex items-center justify-between">
              <h2 className="font-display text-sm text-gecko-200">Monthly Income Statement</h2>
              <button
                onClick={() => downloadCSV(monthly, `medsupp_monthly_${meta.valuation_date}.csv`)}
                className="gecko-btn-ghost text-xs py-1 flex items-center gap-1"
              >
                <Download size={11} /> CSV
              </button>
            </div>
            <div className="overflow-x-auto max-h-48">
              <table className="gecko-table text-xs">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th className="text-right">Inforce</th>
                    <th className="text-right">Premium</th>
                    <th className="text-right">Claims</th>
                    <th className="text-right">Exp+Comm</th>
                    <th className="text-right">Net Inc</th>
                    <th className="text-right">LR%</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((row) => {
                    const lr = row.premium > 0 ? row.claims / row.premium : 0
                    return (
                      <tr key={row.period}>
                        <td className="font-mono">{row.period}</td>
                        <td className="text-right font-mono">{fmt(row.policies_inforce, 1)}</td>
                        <td className="text-right font-mono">{fmtCurrency(row.premium)}</td>
                        <td className="text-right font-mono">{fmtCurrency(row.claims)}</td>
                        <td className="text-right font-mono">{fmtCurrency(row.commissions + row.expenses)}</td>
                        <td className={`text-right font-mono ${row.net_income < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {fmtCurrency(row.net_income)}
                        </td>
                        <td className={`text-right font-mono ${lr > 0.85 ? 'text-red-400' : ''}`}>
                          {fmtPct(lr, 1)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
