import React, { useState, useCallback } from 'react'
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Search, X, Edit3 } from 'lucide-react'
import * as XLSX from 'xlsx'
import useScenarioStore from '../store/scenarioStore.js'

const REQUIRED_COLS = ['policy_number', 'issue_year', 'issue_month', 'premium_amount']

function generateSampleData() {
  const plans = ['Plan F', 'Plan G', 'Plan N', 'Plan A', 'Plan B']
  const states = ['TX', 'FL', 'CA', 'NY', 'IL', 'OH', 'PA', 'GA', 'NC', 'AZ']
  const genders = ['M', 'F']
  const tobaccos = ['NT', 'T']

  return Array.from({ length: 50 }, (_, i) => ({
    policy_number: `POL${String(i + 1).padStart(5, '0')}`,
    issue_year: 2018 + Math.floor(i / 12),
    issue_month: (i % 12) + 1,
    premium_amount: Math.round((150 + Math.random() * 200) * 100) / 100,
    character_1: plans[i % plans.length],
    character_2: states[i % states.length],
    character_3: genders[i % 2],
    character_4: ['60-64', '65-69', '70-74', '75+'][i % 4],
    character_5: tobaccos[i % 2],
    character_6: ['Agent', 'Direct', 'Broker'][i % 3],
    character_7: `Region ${(i % 5) + 1}`,
    character_8: '12 months',
    character_9: 'Traditional',
    character_10: `Group ${(i % 3) + 1}`
  }))
}

export default function InputsPage() {
  const meta = useScenarioStore(s => s.meta)
  const policies = useScenarioStore(s => s.policies)
  const setPolicies = useScenarioStore(s => s.setPolicies)
  const updatePolicy = useScenarioStore(s => s.updatePolicy)

  const [dragOver, setDragOver] = useState(false)
  const [errors, setErrors] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [editingCell, setEditingCell] = useState(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25

  const charDefs = meta.char_definitions || {}

  const COLUMNS = [
    { key: 'policy_number', label: 'Policy #', width: 100 },
    { key: 'issue_year', label: 'Issue Yr', width: 70 },
    { key: 'issue_month', label: 'Issue Mo', width: 70 },
    { key: 'premium_amount', label: 'Premium $', width: 90 },
    ...Array.from({ length: 10 }, (_, i) => ({
      key: `character_${i + 1}`,
      label: charDefs[`character_${i + 1}`] || `Char ${i + 1}`,
      width: 90
    }))
  ]

  const processFile = useCallback((file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' })

        const errs = []
        REQUIRED_COLS.forEach(col => {
          if (data.length > 0 && !Object.keys(data[0]).includes(col)) {
            errs.push(`Missing required column: ${col}`)
          }
        })

        if (errs.length > 0) {
          setErrors(errs)
          return
        }

        // Normalize
        const normalized = data.map(row => {
          const obj = { ...row }
          REQUIRED_COLS.forEach(c => { obj[c] = obj[c] !== undefined ? obj[c] : '' })
          for (let i = 1; i <= 10; i++) {
            if (obj[`character_${i}`] === undefined) obj[`character_${i}`] = ''
          }
          return obj
        })

        // Dedupe check
        const policyNums = normalized.map(p => p.policy_number)
        const dupes = policyNums.filter((v, i) => policyNums.indexOf(v) !== i)
        if (dupes.length > 0) {
          errs.push(`Duplicate policy numbers: ${[...new Set(dupes)].slice(0, 5).join(', ')}`)
        }

        setErrors(errs)
        setPolicies(normalized)
      } catch (err) {
        setErrors([`Parse error: ${err.message}`])
      }
    }
    reader.readAsBinaryString(file)
  }, [setPolicies])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileInput = (e) => {
    const file = e.target.files[0]
    if (file) processFile(file)
  }

  const handleLoadSample = () => {
    setErrors([])
    setPolicies(generateSampleData())
  }

  const filteredPolicies = searchTerm
    ? policies.filter(p =>
        Object.values(p).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : policies

  const pagePolicies = filteredPolicies.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filteredPolicies.length / PAGE_SIZE)

  const handleCellEdit = (idx, key, val) => {
    updatePolicy(page * PAGE_SIZE + idx, { [key]: val })
    setEditingCell(null)
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-2 mb-1">
          <Upload size={20} className="text-gecko-500" />
          <h1 className="page-title">Liability Inputs</h1>
        </div>
        <p className="page-subtitle">Upload an Excel file with seriatim policy data, or load the sample dataset.</p>
      </div>

      {/* Upload Zone */}
      {policies.length === 0 && (
        <div
          className={`drop-zone p-12 text-center mb-6 ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <FileSpreadsheet size={48} className="text-gecko-600 mx-auto mb-4" />
          <h2 className="font-display text-xl text-gecko-200 mb-2">Drop Excel File Here</h2>
          <p className="text-gecko-500 text-sm mb-6">
            Required columns: <span className="font-mono text-gecko-300">policy_number, issue_year, issue_month, premium_amount</span><br/>
            Optional: <span className="font-mono text-gecko-400">character_1 … character_10</span>
          </p>
          <div className="flex justify-center gap-3">
            <label className="gecko-btn-primary cursor-pointer">
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileInput} />
              Choose File
            </label>
            <button onClick={handleLoadSample} className="gecko-btn-secondary">
              Load Sample Data (50 policies)
            </button>
          </div>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="gecko-card border-red-800/40 bg-red-900/10 p-4 mb-4 flex gap-3">
          <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-red-300 mb-1">Validation Issues</div>
            {errors.map((e, i) => <div key={i} className="text-xs text-red-400">{e}</div>)}
          </div>
        </div>
      )}

      {/* Loaded */}
      {policies.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="gecko-badge-green flex items-center gap-1">
                <CheckCircle size={10} /> {policies.length.toLocaleString()} policies loaded
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gecko-600" />
                <input
                  className="gecko-input pl-8 w-48"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setPage(0) }}
                />
              </div>
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-gecko-600 hover:text-gecko-300">
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="gecko-btn-secondary text-xs py-1.5 cursor-pointer">
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileInput} />
                Replace File
              </label>
              <button onClick={handleLoadSample} className="gecko-btn-ghost text-xs py-1.5">
                Reset to Sample
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="gecko-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="gecko-table">
                <thead>
                  <tr>
                    <th className="w-8">#</th>
                    {COLUMNS.map(col => (
                      <th key={col.key} style={{ minWidth: col.width }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagePolicies.map((policy, idx) => (
                    <tr key={idx}>
                      <td className="text-gecko-700 font-mono text-xs">{page * PAGE_SIZE + idx + 1}</td>
                      {COLUMNS.map(col => (
                        <td
                          key={col.key}
                          className={`editable-cell ${col.key === 'premium_amount' ? 'text-right font-mono' : ''}`}
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={e => {
                            const newVal = e.target.textContent.trim()
                            if (newVal !== String(policy[col.key])) {
                              handleCellEdit(idx, col.key, newVal)
                            }
                          }}
                        >
                          {col.key === 'premium_amount'
                            ? parseFloat(policy[col.key] || 0).toFixed(2)
                            : policy[col.key] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="gecko-btn-secondary text-xs py-1 disabled:opacity-40"
              >
                ‹ Prev
              </button>
              <span className="text-xs text-gecko-500">
                Page {page + 1} of {totalPages} ({filteredPolicies.length} policies)
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="gecko-btn-secondary text-xs py-1 disabled:opacity-40"
              >
                Next ›
              </button>
            </div>
          )}
        </>
      )}

      {/* Schema Reference */}
      <div className="gecko-card p-4 mt-6">
        <h3 className="font-display text-base text-gecko-200 mb-3">Expected Schema</h3>
        <div className="code-block text-xs">
{`policy_number   | string  | REQUIRED — unique policy identifier
issue_year      | integer | REQUIRED — policy issue year (e.g. 2022)
issue_month     | integer | REQUIRED — policy issue month 1–12
premium_amount  | float   | REQUIRED — monthly premium amount ($)
character_1     | string  | OPTIONAL — e.g. Plan (Plan F, Plan G, etc.)
character_2     | string  | OPTIONAL — e.g. State (TX, FL, CA...)
character_3     | string  | OPTIONAL — e.g. Gender (M/F)
character_4     | string  | OPTIONAL — e.g. Age Band
character_5..10 | string  | OPTIONAL — user-defined labels`}
        </div>
      </div>
    </div>
  )
}
