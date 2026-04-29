import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

// Get last day of a given year/month
export function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

// Convert any date string to its end-of-month
export function toEndOfMonth(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const last = lastDayOfMonth(y, m)
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

function todayEOM() {
  const now = new Date()
  return toEndOfMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
}

// Build a 360-month array from a function
const arr360 = (fn) => Array.from({ length: 360 }, (_, i) => fn(i))

const DEFAULT_FORMULAS = {
  inforce_rollforward: {
    name: 'Inforce Rollforward',
    category: 'lives',
    description: 'inforce_eop = inforce_bop * (1 - lapse_rate)',
    code: `def inforce_rollforward(inforce_bop, lapse_rate):\n    return inforce_bop * (1.0 - lapse_rate)\n`,
    inputs: ['inforce_bop', 'lapse_rate'],
    output: 'inforce_eop',
    is_builtin: true
  },
  premium: {
    name: 'Premium',
    category: 'revenue',
    description: 'premium = inforce_bop * premium_amount',
    code: `def premium(inforce_bop, premium_amount):\n    return inforce_bop * premium_amount\n`,
    inputs: ['inforce_bop', 'premium_amount'],
    output: 'premium',
    is_builtin: true
  },
  claims: {
    name: 'Claims',
    category: 'benefits',
    description: 'claims = inforce_bop * claim_cost * ccscale',
    code: `def claims(inforce_bop, claim_cost, ccscale):\n    return inforce_bop * claim_cost * ccscale\n`,
    inputs: ['inforce_bop', 'claim_cost', 'ccscale'],
    output: 'claims',
    is_builtin: true
  },
  commissions: {
    name: 'Commissions',
    category: 'expenses',
    description: 'commissions = premium * commission_rate',
    code: `def commissions(premium, commission_rate):\n    return premium * commission_rate\n`,
    inputs: ['premium', 'commission_rate'],
    output: 'commissions',
    is_builtin: true
  },
  operating_expenses: {
    name: 'Operating Expenses',
    category: 'expenses',
    description: 'expenses = inforce_bop * expense_per_policy + premium * expense_pct_prem',
    code: `def operating_expenses(inforce_bop, expense_per_policy, premium, expense_pct_prem):\n    return inforce_bop * expense_per_policy + premium * expense_pct_prem\n`,
    inputs: ['inforce_bop', 'expense_per_policy', 'premium', 'expense_pct_prem'],
    output: 'expenses',
    is_builtin: true
  },
  premium_tax: {
    name: 'Premium Tax',
    category: 'taxes',
    description: 'premium_tax = premium * prem_tax_rate',
    code: `def premium_tax(premium, prem_tax_rate):\n    return premium * prem_tax_rate\n`,
    inputs: ['premium', 'prem_tax_rate'],
    output: 'premium_tax',
    is_builtin: true
  },
  federal_income_tax: {
    name: 'Federal Income Tax',
    category: 'taxes',
    description: 'fit = max(0, pre-tax income) * fit_rate',
    code: `def federal_income_tax(premium, claims, commissions, expenses, premium_tax, fit_rate):\n    taxable = premium - claims - commissions - expenses - premium_tax\n    return max(0.0, taxable) * fit_rate\n`,
    inputs: ['premium', 'claims', 'commissions', 'expenses', 'premium_tax', 'fit_rate'],
    output: 'fit',
    is_builtin: true
  },
  reserve_change: {
    name: 'Reserve Change',
    category: 'balance_sheet',
    description: 'Simple UPR proxy: 0.5 * monthly_prem per inforce',
    code: `def reserve_change(premium, inforce_bop, inforce_eop):\n    upr_bop = inforce_bop * 0.5\n    upr_eop = inforce_eop * 0.5\n    return upr_eop - upr_bop\n`,
    inputs: ['premium', 'inforce_bop', 'inforce_eop'],
    output: 'reserve_change',
    is_builtin: true
  },
  nii: {
    name: 'Net Investment Income',
    category: 'revenue',
    description: 'nii = reserve * nii_rate',
    code: `def nii(reserve, nii_rate):\n    return reserve * nii_rate\n`,
    inputs: ['reserve', 'nii_rate'],
    output: 'nii',
    is_builtin: true
  },
  net_income: {
    name: 'Net Income',
    category: 'income_statement',
    description: 'net_income = premium - claims - commissions - expenses - premium_tax - fit',
    code: `def net_income(premium, claims, commissions, expenses, premium_tax, fit):\n    return premium - claims - commissions - expenses - premium_tax - fit\n`,
    inputs: ['premium', 'claims', 'commissions', 'expenses', 'premium_tax', 'fit'],
    output: 'net_income',
    is_builtin: true
  }
}

// Factory for a new assumption
export function makeAssumption(description, type, defaultValue, unit = '', timeStep = 'monthly') {
  return {
    description,
    unit,
    type,             // 'scalar' | 'by_duration'
    time_step: timeStep,
    dimensioning_keys: [],   // e.g. ['character_1', 'character_2']
    values: { default: defaultValue }
    // Additional keyed entries like: 'Plan F|TX': [...] added dynamically
  }
}

const DEFAULT_ASSUMPTIONS = {
  lapse: makeAssumption(
    'Monthly lapse rates by policy duration',
    'by_duration',
    arr360(i => i < 12 ? 0.005 : i < 24 ? 0.004 : i < 36 ? 0.003 : 0.002),
    '% monthly'
  ),
  claim_cost: makeAssumption(
    'Monthly claim cost per inforce life',
    'by_duration',
    arr360(i => Math.round((180 + i * 0.5) * 100) / 100),
    '$ per life'
  ),
  ccscale: makeAssumption(
    'Claim cost scalar / trend adjustment factor',
    'scalar',
    1.0,
    'multiplier'
  ),
  commission_rate: makeAssumption(
    'Commission rate as % of premium by duration',
    'by_duration',
    arr360(i => i < 12 ? 0.20 : 0.05),
    '% of premium'
  ),
  expense_per_policy: makeAssumption(
    'Monthly per-policy operating expense',
    'scalar',
    12.50,
    '$ per policy'
  ),
  expense_pct_prem: makeAssumption(
    'Operating expenses as % of premium',
    'scalar',
    0.03,
    '% of premium'
  ),
  prem_tax_rate: makeAssumption(
    'State premium tax rate',
    'scalar',
    0.02,
    '% of premium'
  ),
  fit_rate: makeAssumption(
    'Federal income tax rate on pre-tax income',
    'scalar',
    0.21,
    '% of pre-tax income'
  ),
  nii_rate: makeAssumption(
    'Monthly NII rate on average reserve',
    'scalar',
    0.004,
    '% monthly of reserve'
  ),
}

const DEFAULT_META = {
  model_name: 'Medicare Supplement Projection Model',
  valuation_date: todayEOM(),
  proj_start: todayEOM(),
  proj_months: 360,
  time_step: 'monthly',   // 'monthly' | 'annual'
  notes: 'Initial model setup. Built with Gecko Actuarial Platform.',
  char_definitions: {
    character_1: 'Plan',
    character_2: 'State',
    character_3: 'Gender',
    character_4: 'Issue Age Band',
    character_5: 'Tobacco Status',
    character_6: 'Distribution Channel',
    character_7: 'Rating Area',
    character_8: 'Benefit Period',
    character_9: 'Network Type',
    character_10: 'Custom 10'
  }
}

const useScenarioStore = create(
  persist(
    (set, get) => ({
      meta: { ...DEFAULT_META },
      setMeta: (updates) => set((s) => ({ meta: { ...s.meta, ...updates } })),

      policies: [],
      setPolicies: (policies) => set({ policies }),
      updatePolicy: (idx, updates) => set((s) => {
        const p = [...s.policies]
        p[idx] = { ...p[idx], ...updates }
        return { policies: p }
      }),

      assumptions: JSON.parse(JSON.stringify(DEFAULT_ASSUMPTIONS)),
      setAssumption: (key, data) => set((s) => ({
        assumptions: { ...s.assumptions, [key]: { ...s.assumptions[key], ...data } }
      })),
      setAssumptions: (assumptions) => set({ assumptions }),
      addAssumption: (key, assumption) => set((s) => ({
        assumptions: { ...s.assumptions, [key]: assumption }
      })),
      removeAssumption: (key) => set((s) => {
        const next = { ...s.assumptions }
        delete next[key]
        return { assumptions: next }
      }),

      formulas: JSON.parse(JSON.stringify(DEFAULT_FORMULAS)),
      setFormula: (key, data) => set((s) => ({
        formulas: { ...s.formulas, [key]: { ...s.formulas[key], ...data } }
      })),
      setFormulas: (formulas) => set({ formulas }),
      addFormula: (key, formula) => set((s) => ({
        formulas: { ...s.formulas, [key]: formula }
      })),
      removeFormula: (key) => set((s) => {
        const next = { ...s.formulas }
        delete next[key]
        return { formulas: next }
      }),

      outputs: null,
      setOutputs: (outputs) => set({ outputs }),
      clearOutputs: () => set({ outputs: null }),

      runStatus: null,
      runProgress: 0,
      runError: null,
      setRunStatus: (status, progress = 0, error = null) =>
        set({ runStatus: status, runProgress: progress, runError: error }),

      snapshots: [],
      addSnapshot: (note) => {
        const state = get()
        const snapshot = {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          note,
          meta: { ...state.meta },
          policies: [...state.policies],
          assumptions: JSON.parse(JSON.stringify(state.assumptions)),
          formulas: JSON.parse(JSON.stringify(state.formulas)),
        }
        set((s) => ({ snapshots: [snapshot, ...s.snapshots].slice(0, 20) }))
        return snapshot
      },
      restoreSnapshot: (id) => {
        const snap = get().snapshots.find(s => s.id === id)
        if (snap) {
          set({ meta: snap.meta, policies: snap.policies, assumptions: snap.assumptions, formulas: snap.formulas, outputs: null })
        }
      },

      resetScenario: () => set({
        meta: { ...DEFAULT_META },
        policies: [],
        assumptions: JSON.parse(JSON.stringify(DEFAULT_ASSUMPTIONS)),
        formulas: JSON.parse(JSON.stringify(DEFAULT_FORMULAS)),
        outputs: null,
        runStatus: null,
        runProgress: 0,
        runError: null
      }),

      importScenario: (data) => set({
        meta: data.meta || DEFAULT_META,
        policies: data.policies || [],
        assumptions: data.assumptions || JSON.parse(JSON.stringify(DEFAULT_ASSUMPTIONS)),
        formulas: data.formulas || JSON.parse(JSON.stringify(DEFAULT_FORMULAS)),
        outputs: null
      })
    }),
    {
      name: 'gecko-medsupp-scenario-v3',
      partialize: (state) => ({
        meta: state.meta,
        policies: state.policies,
        assumptions: state.assumptions,
        formulas: state.formulas,
        snapshots: state.snapshots
      })
    }
  )
)

export default useScenarioStore
export { DEFAULT_ASSUMPTIONS, DEFAULT_FORMULAS, DEFAULT_META, todayEOM }
