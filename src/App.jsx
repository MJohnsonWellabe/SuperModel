import React, { useState } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import {
  BookOpen, Database, Upload, Sliders, Calculator,
  BarChart3, TrendingUp, Menu, X, Save, Download,
  RefreshCw, AlertTriangle, CheckCircle, ChevronRight
} from 'lucide-react'
import useScenarioStore from './store/scenarioStore.js'
import { exportScenarioBundle, importScenarioBundle } from './utils/exportImport.js'

// Pages
import DocumentationPage from './pages/DocumentationPage.jsx'
import DatabasePage from './pages/DatabasePage.jsx'
import InputsPage from './pages/InputsPage.jsx'
import AssumptionsPage from './pages/AssumptionsPage.jsx'
import CalculationsPage from './pages/CalculationsPage.jsx'
import OutputsPage from './pages/OutputsPage.jsx'
import AggregationPage from './pages/AggregationPage.jsx'

const NAV_ITEMS = [
  { path: '/', icon: BookOpen, label: 'Documentation', exact: true },
  { path: '/database', icon: Database, label: 'Database' },
  { path: '/inputs', icon: Upload, label: 'Liability Inputs' },
  { path: '/assumptions', icon: Sliders, label: 'Assumptions' },
  { path: '/calculations', icon: Calculator, label: 'Calculations' },
  { path: '/outputs', icon: BarChart3, label: 'Outputs' },
  { path: '/aggregation', icon: TrendingUp, label: 'Aggregation' },
]

function GeckoLogo() {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="logo-glow flex-shrink-0">
        <ellipse cx="16" cy="16" rx="14" ry="14" fill="#1a1008" stroke="#ea580c" strokeWidth="1.5"/>
        {/* gecko body */}
        <path d="M16 8 Q18 11 16 14 Q14 17 16 20 Q18 23 16 25" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        {/* legs */}
        <path d="M16 12 Q12 10 10 12" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M16 12 Q20 10 22 12" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M16 18 Q11 17 9 19" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M16 18 Q21 17 23 19" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round"/>
        {/* eye */}
        <circle cx="16" cy="8.5" r="1.5" fill="#f97316"/>
        <circle cx="16" cy="8.5" r="0.6" fill="#fff7ed"/>
      </svg>
      <div>
        <div className="font-display text-base text-gecko-300 leading-none">Gecko</div>
        <div className="text-[10px] text-gecko-600 uppercase tracking-widest leading-none mt-0.5">MedSupp Model</div>
      </div>
    </div>
  )
}

function Sidebar({ collapsed, onToggle }) {
  const location = useLocation()
  const meta = useScenarioStore(s => s.meta)
  const policies = useScenarioStore(s => s.policies)
  const outputs = useScenarioStore(s => s.outputs)

  return (
    <aside className={`flex flex-col border-r border-[#2a1c0e] bg-[#0f0a06] transition-all duration-200 ${collapsed ? 'w-14' : 'w-56'} flex-shrink-0 h-screen sticky top-0`}>
      {/* Logo */}
      {!collapsed && <GeckoLogo />}
      {collapsed && (
        <div className="flex justify-center py-3">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" className="logo-glow">
            <ellipse cx="16" cy="16" rx="14" ry="14" fill="#1a1008" stroke="#ea580c" strokeWidth="1.5"/>
            <path d="M16 8 Q18 11 16 14 Q14 17 16 20 Q18 23 16 25" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <path d="M16 12 Q12 10 10 12" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M16 12 Q20 10 22 12" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M16 18 Q11 17 9 19" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M16 18 Q21 17 23 19" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="16" cy="8.5" r="1.5" fill="#f97316"/>
          </svg>
        </div>
      )}

      <div className="border-t border-[#2a1c0e] mt-1" />

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ path, icon: Icon, label, exact }) => {
          const isActive = exact
            ? location.pathname === path
            : location.pathname.startsWith(path) && path !== '/'

          return (
            <NavLink
              key={path}
              to={path}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-gecko-700/30 text-gecko-300 border border-gecko-700/30'
                  : 'text-[#8a6040] hover:text-gecko-200 hover:bg-[#1f1409]'
              }`}
              title={collapsed ? label : undefined}
            >
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Status bar */}
      {!collapsed && (
        <div className="border-t border-[#2a1c0e] px-3 py-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-gecko-600">Policies</span>
            <span className="text-xs text-gecko-300 font-mono">{policies.length.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-gecko-600">Run</span>
            <span className={`text-[10px] font-medium ${outputs ? 'text-green-400' : 'text-gecko-600'}`}>
              {outputs ? '✓ Done' : 'Not run'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-gecko-600">Months</span>
            <span className="text-xs text-gecko-300 font-mono">{meta.proj_months}</span>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="border-t border-[#2a1c0e] p-3 flex items-center justify-center text-gecko-600 hover:text-gecko-300 hover:bg-[#1f1409] transition-colors"
      >
        {collapsed ? <ChevronRight size={14} /> : <Menu size={14} />}
      </button>
    </aside>
  )
}

function TopBar() {
  const meta = useScenarioStore(s => s.meta)
  const addSnapshot = useScenarioStore(s => s.addSnapshot)
  const resetScenario = useScenarioStore(s => s.resetScenario)
  const importScenario = useScenarioStore(s => s.importScenario)
  const state = useScenarioStore(s => s)
  const [saveNote, setSaveNote] = useState('')
  const [showSave, setShowSave] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSave = () => {
    if (!saveNote.trim()) return
    addSnapshot(saveNote.trim())
    setSaveNote('')
    setShowSave(false)
    showToast('Snapshot saved!')
  }

  const handleExport = async () => {
    await exportScenarioBundle(state)
    showToast('Scenario exported!')
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zip'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      try {
        const data = await importScenarioBundle(file)
        importScenario(data)
        showToast('Scenario imported!')
      } catch (err) {
        showToast('Import failed: ' + err.message, 'error')
      }
    }
    input.click()
  }

  return (
    <header className="border-b border-[#2a1c0e] bg-[#0f0a06] px-4 py-2 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <span className="font-display text-gecko-200 text-sm">{meta.model_name}</span>
        <span className="text-[#3d2710]">|</span>
        <span className="text-xs text-gecko-600">Val Date: {meta.valuation_date}</span>
        <span className="text-[#3d2710]">|</span>
        <span className="text-xs text-gecko-600">{meta.proj_months}mo projection</span>
      </div>

      <div className="flex items-center gap-2">
        {toast && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium animate-fade-in ${
            toast.type === 'error' ? 'bg-red-900/30 text-red-300 border border-red-800/40' : 'bg-green-900/30 text-green-300 border border-green-800/40'
          }`}>
            {toast.type === 'error' ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
            {toast.msg}
          </div>
        )}

        {showSave && (
          <div className="flex items-center gap-2 animate-fade-in">
            <input
              className="gecko-input w-48 text-xs"
              placeholder="Change note..."
              value={saveNote}
              onChange={e => setSaveNote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <button onClick={handleSave} className="gecko-btn-primary text-xs py-1.5">Save</button>
            <button onClick={() => setShowSave(false)} className="gecko-btn-ghost text-xs py-1.5">
              <X size={12} />
            </button>
          </div>
        )}

        {!showSave && (
          <button onClick={() => setShowSave(true)} className="gecko-btn-secondary flex items-center gap-1.5 text-xs py-1.5">
            <Save size={12} /> Save Snapshot
          </button>
        )}

        <button onClick={handleExport} className="gecko-btn-secondary flex items-center gap-1.5 text-xs py-1.5">
          <Download size={12} /> Export
        </button>

        <button onClick={handleImport} className="gecko-btn-ghost flex items-center gap-1.5 text-xs py-1.5">
          <Upload size={12} /> Import
        </button>

        <button
          onClick={() => { if (confirm('Reset all scenario data?')) resetScenario() }}
          className="gecko-btn-danger flex items-center gap-1.5 text-xs py-1.5"
        >
          <RefreshCw size={12} /> Reset
        </button>
      </div>
    </header>
  )
}

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f0a06]">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v => !v)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<DocumentationPage />} />
            <Route path="/database" element={<DatabasePage />} />
            <Route path="/inputs" element={<InputsPage />} />
            <Route path="/assumptions" element={<AssumptionsPage />} />
            <Route path="/calculations" element={<CalculationsPage />} />
            <Route path="/outputs" element={<OutputsPage />} />
            <Route path="/aggregation" element={<AggregationPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
