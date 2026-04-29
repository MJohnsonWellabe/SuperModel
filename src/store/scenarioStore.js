import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

const DEFAULT_FORMULAS = {
  inforce_rollforward: {
    name: 'Inforce Rollforward',
    category: 'lives',
    description: 'Calculates remaining inforce at end of period after lapses.',
    code: `# inforce_rollforward
# Inputs: inforce_bop (float), lapse_rate (float)
# Returns: inforce_eop (float)
def inforce_rollforward(inforce_bop, lapse_rate):
    return inforce_bop * (1.0 - lapse_rate)
`,
    inputs: ['inforce_bop', 'lapse_rate'],
    output: 'inforce_eop',
    is_builtin: true
  },
  premium: {
    name: 'Premium',
    category: 'revenue',
    description: 'Monthly premium = inforce BOP * policy premium amount.',
    code: `# premium
# Inputs: inforce_bop (float), premium_amount (float)
# Returns: premium (float)
def premium(inforce_bop, premium_amount):
    return inforce_bop * premium_amount
`,
    inputs: ['inforce_bop', 'premium_amount'],
    output: 'premium',
    is_builtin: true
  },
  claims: {
    name: 'Claims',
    category: 'benefits',
    description: 'Monthly claims = inforce BOP * claim cost rate.',
    code: `# claims
# Inputs: inforce_bop (float), claim_cost (float)
# Returns: claims (float)
def claims(inforce_bop, claim_cost):
    return inforce_bop * claim_cost
`,
    inputs: ['inforce_bop', 'claim_cost'],
    output: 'claims',
    is_builtin: true
  },
  commissions: {
    name: 'Commissions',
    category: 'expenses',
    description: 'Monthly commissions = premium * commission rate.',
    code: `# commissions
# Inputs: premium (float), commission_rate (float)
# Returns: commissions (float)
def commissions(premium, commission_rate):
    return premium * commission_rate
`,
    inputs: ['premium', 'commission_rate'],
    output: 'commissions',
    is_builtin: true
  },
  operating_expenses: {
    name: 'Operating Expenses',
    category: 'expenses',
    description: 'Per-policy expense + pct-of-premium expense.',
    code: `# operating_expenses
# Inputs: inforce_bop (float), expense_per_policy (float), premium (float), expense_pct_prem (float)
# Returns: expenses (float)
def operating_expenses(inforce_bop, expense_per_policy, premium, expense_pct_prem):
    return inforce_bop * expense_per_policy + premium * expense_pct_prem
`,
    inputs: ['inforce_bop', 'expense_per_policy', 'premium', 'expense_pct_prem'],
    output: 'expenses',
    is_builtin: true
  },
  premium_tax: {
    name: 'Premium Tax',
    category: 'taxes',
    description: 'Premium tax = premium * state premium tax rate.',
    code: `# premium_tax
# Inputs: premium (float), prem_tax_rate (float)
# Returns: premium_tax (float)
def premium_tax(premium, prem_tax_rate):
    return premium * prem_tax_rate
`,
    inputs: ['premium', 'prem_tax_rate'],
    output: 'premium_tax',
    is_builtin: true
  },
  federal_income_tax: {
    name: 'Federal Income Tax (Placeholder)',
    category: 'taxes',
    description: 'FIT placeholder: taxable income * FIT rate.',
    code: `# federal_income_tax
# Inputs: premium (float), claims (float), commissions (float), expenses (float), 
#         premium_tax (float), fit_rate (float)
# Returns: fit (float)
def federal_income_tax(premium, claims, commissions, expenses, premium_tax, fit_rate):
    taxable_income = premium - claims - commissions - expenses - premium_tax
    return max(0.0, taxable_income) * fit_rate
`,
    inputs: ['premium', 'claims', 'commissions', 'expenses', 'premium_tax', 'fit_rate'],
    output: 'fit',
    is_builtin: true
  },
  reserve_change: {
    name: 'Reserve Change (Placeholder)',
    category: 'balance_sheet',
    description: 'Simplified reserve: unearned premium proxy = 0.5 * monthly premium.',
    code: `# reserve_change
# Inputs: premium (float), inforce_bop (float), inforce_eop (float)
# Returns: reserve_change (float)
def reserve_change(premium, inforce_bop, inforce_eop):
    # Simple UPR proxy: half month of premium for policies at EOP
    upr_bop = inforce_bop * 0.5  # placeholder
    upr_eop = inforce_eop * 0.5  # placeholder
    return upr_eop - upr_bop
`,
    inputs: ['premium', 'inforce_bop', 'inforce_eop'],
    output: 'reserve_change',
    is_builtin: true
  },
  net_income: {
    name: 'Net Income',
    category: 'income_statement',
    description: 'Net income = premium - claims - commissions - expenses - premium_tax - fit.',
    code: `# net_income
# Inputs: premium, claims, commissions, expenses, premium_tax, fit
# Returns: net_income (float)
def net_income(premium, claims, commissions, expenses, premium_tax, fit):
    return premium - claims - commissions - expenses - premium_tax - fit
`,
    inputs: ['premium', 'claims', 'commissions', 'expenses', 'premium_tax', 'fit'],
    output: 'net_income',
    is_builtin: true
  },
  nii: {
    name: 'Net Investment Income (Placeholder)',
    category: 'revenue',
    description: 'Simplified NII placeholder — returns zero until assets are modeled.',
    code: `# nii
# Inputs: reserve (float), nii_rate (float)
# Returns: nii (float)
def nii(reserve, nii_rate):
    # Placeholder: invest reserves at simple monthly rate
    return reserve * nii_rate
`,
    inputs: ['reserve', 'nii_rate'],
    output: 'nii',
    is_builtin: true
  }
}

const DEFAULT_ASSUMPTIONS = {
  lapse: {
    description: 'Monthly lapse rates by duration',
    dimensioning_keys: [],
    time_basis: 'duration',
    type: 'by_duration',
    values: {
      default: [0.005, 0.005, 0.005, 0.005, 0.005, 0.005,
                0.004, 0.004, 0.004, 0.004, 0.004, 0.004,
                0.003, 0.003, 0.003, 0.003, 0.003, 0.003,
                0.002, 0.002, 0.002, 0.002, 0.002, 0.002]
    }
  },
  claim_cost: {
    description: 'Monthly claim cost per inforce life',
    dimensioning_keys: [],
    time_basis: 'duration',
    type: 'by_duration',
    values: {
      default: [180, 182, 184, 186, 188, 190,
                192, 194, 196, 198, 200, 202,
                204, 206, 208, 210, 212, 214,
                216, 218, 220, 222, 224, 226]
    }
  },
  commission_rate: {
    description: 'Commission rate as % of premium',
    dimensioning_keys: [],
    time_basis: 'duration',
    type: 'by_duration',
    values: {
      default: [0.20, 0.20, 0.20, 0.20, 0.20, 0.20,
                0.20, 0.20, 0.20, 0.20, 0.20, 0.20,
                0.05, 0.05, 0.05, 0.05, 0.05, 0.05,
                0.05, 0.05, 0.05, 0.05, 0.05, 0.05]
    }
  },
  expense_per_policy: {
    description: 'Monthly per-policy operating expense',
    dimensioning_keys: [],
    time_basis: 'scalar',
    type: 'scalar',
    values: { default: 12.50 }
  },
  expense_pct_prem: {
    description: 'Operating expenses as % of premium',
    dimensioning_keys: [],
    time_basis: 'scalar',
    type: 'scalar',
    values: { default: 0.03 }
  },
  prem_tax_rate: {
    description: 'State premium tax rate',
    dimensioning_keys: [],
    time_basis: 'scalar',
    type: 'scalar',
    values: { default: 0.02 }
  },
  fit_rate: {
    description: 'Federal income tax rate on pre-tax income',
    dimensioning_keys: [],
    time_basis: 'scalar',
    type: 'scalar',
    values: { default: 0.21 }
  },
  nii_rate: {
    description: 'Monthly net investment income rate on reserves',
    dimensioning_keys: [],
    time_basis: 'scalar',
    type: 'scalar',
    values: { default: 0.004 }
  }
}

const DEFAULT_META = {
  model_name: 'Medicare Supplement Projection Model',
  valuation_date: new Date().toISOString().split('T')[0],
  proj_start: new Date().toISOString().split('T')[0],
  proj_months: 24,
  time_step: 'monthly',
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
      // Meta
      meta: { ...DEFAULT_META },
      setMeta: (updates) => set((s) => ({ meta: { ...s.meta, ...updates } })),

      // Inputs (policies)
      policies: [],
      setPolicies: (policies) => set({ policies }),
      updatePolicy: (idx, updates) => set((s) => {
        const p = [...s.policies]
        p[idx] = { ...p[idx], ...updates }
        return { policies: p }
      }),

      // Assumptions
      assumptions: { ...DEFAULT_ASSUMPTIONS },
      setAssumption: (key, data) => set((s) => ({
        assumptions: { ...s.assumptions, [key]: { ...s.assumptions[key], ...data } }
      })),
      setAssumptions: (assumptions) => set({ assumptions }),

      // Formulas
      formulas: { ...DEFAULT_FORMULAS },
      setFormula: (key, data) => set((s) => ({
        formulas: { ...s.formulas, [key]: { ...s.formulas[key], ...data } }
      })),
      setFormulas: (formulas) => set({ formulas }),

      // Outputs
      outputs: null,
      setOutputs: (outputs) => set({ outputs }),
      clearOutputs: () => set({ outputs: null }),

      // Run status
      runStatus: null, // null | 'running' | 'done' | 'error'
      runProgress: 0,
      runError: null,
      setRunStatus: (status, progress = 0, error = null) =>
        set({ runStatus: status, runProgress: progress, runError: error }),

      // Snapshots
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
          set({
            meta: snap.meta,
            policies: snap.policies,
            assumptions: snap.assumptions,
            formulas: snap.formulas,
            outputs: null
          })
        }
      },

      // Reset
      resetScenario: () => set({
        meta: { ...DEFAULT_META },
        policies: [],
        assumptions: { ...DEFAULT_ASSUMPTIONS },
        formulas: { ...DEFAULT_FORMULAS },
        outputs: null,
        runStatus: null,
        runProgress: 0,
        runError: null
      }),

      // Import
      importScenario: (data) => {
        set({
          meta: data.meta || DEFAULT_META,
          policies: data.policies || [],
          assumptions: data.assumptions || DEFAULT_ASSUMPTIONS,
          formulas: data.formulas || DEFAULT_FORMULAS,
          outputs: null
        })
      }
    }),
    {
      name: 'gecko-medsupp-scenario',
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
export { DEFAULT_ASSUMPTIONS, DEFAULT_FORMULAS, DEFAULT_META }
