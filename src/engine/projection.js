/**
 * Gecko MedSupp Projection Engine
 *
 * Key features:
 * - Policies start at valuation date, picking up at their actual policy duration
 * - Annual or monthly time step
 * - Assumption lookup by dimensioning keys (e.g. Plan, State)
 * - Dynamic assumption variables
 */

/**
 * Calculate months elapsed between two end-of-month dates.
 * issueYear/issueMonth = policy issue date
 * valYear/valMonth     = valuation date
 * Returns integer months (0 if issued this month, negative clamped to 0)
 */
export function monthsElapsed(issueYear, issueMonth, valYear, valMonth) {
  const months = (valYear - issueYear) * 12 + (valMonth - issueMonth)
  return Math.max(0, months)
}

/**
 * Parse a valuation date string into { year, month }
 */
export function parseDate(dateStr) {
  if (!dateStr) return { year: new Date().getFullYear(), month: new Date().getMonth() + 1 }
  const d = new Date(dateStr + 'T00:00:00')
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

/**
 * Build the lookup key for a policy given a set of dimensioning keys
 * e.g. dimensioning_keys = ['character_1','character_2']
 * policy = { character_1: 'Plan F', character_2: 'TX', ... }
 * returns 'Plan F|TX'
 */
export function buildDimKey(policy, dimensioning_keys) {
  if (!dimensioning_keys || dimensioning_keys.length === 0) return 'default'
  return dimensioning_keys.map(k => String(policy[k] ?? '')).join('|')
}

/**
 * Look up assumption value for a policy at duration index t (0-based months from issue)
 * Falls back: exact key → partial keys → default
 */
export function getAssumptionValue(assumption, policy, t) {
  if (!assumption) return 0
  const { type, values, dimensioning_keys, time_step } = assumption

  // Try to find the best matching key
  const exactKey = buildDimKey(policy, dimensioning_keys)
  let val
  if (values[exactKey] !== undefined) {
    val = values[exactKey]
  } else {
    val = values['default']
  }

  if (val === undefined) return 0

  // Annual assumptions: index by year (floor of month/12)
  const idx = (time_step === 'annual') ? Math.floor(t / 12) : t

  if (type === 'scalar') {
    return typeof val === 'number' ? val : (Array.isArray(val) ? val[0] : 0)
  }

  if (type === 'by_duration') {
    if (Array.isArray(val)) {
      const i = Math.min(idx, val.length - 1)
      return val[i] ?? val[val.length - 1] ?? 0
    }
    return typeof val === 'number' ? val : 0
  }

  return 0
}

/**
 * Project a single policy.
 * startDuration = months already elapsed at valuation date (policy's age in months)
 */
export function projectPolicy(policy, assumptions, proj_months, valDate, timeStep = 'monthly') {
  const results = []

  const { year: valYear, month: valMonth } = parseDate(valDate)
  const issueYear  = parseInt(policy.issue_year)  || valYear
  const issueMonth = parseInt(policy.issue_month) || valMonth
  const premiumAmount = parseFloat(policy.premium_amount) || 0

  // How many months into the policy are we at the valuation date?
  const startDuration = monthsElapsed(issueYear, issueMonth, valYear, valMonth)

  // Step size in months
  const stepMonths = timeStep === 'annual' ? 12 : 1
  const steps = Math.ceil(proj_months / stepMonths)

  let inforce_bop = 1.0

  for (let step = 0; step < steps; step++) {
    // t = policy duration in months at start of this step
    const t = startDuration + step * stepMonths

    // Calendar date at start of this step
    const calTotalMonth = (valMonth - 1) + step * stepMonths
    const calYear  = valYear + Math.floor(calTotalMonth / 12)
    const calMonth = (calTotalMonth % 12) + 1

    // Fetch all assumption values at duration t
    const lapse_rate       = getAssumptionValue(assumptions.lapse,              policy, t)
    const claim_cost       = getAssumptionValue(assumptions.claim_cost,         policy, t)
    const ccscale          = getAssumptionValue(assumptions.ccscale,            policy, t)
    const commission_rate  = getAssumptionValue(assumptions.commission_rate,    policy, t)
    const expense_per_policy = getAssumptionValue(assumptions.expense_per_policy, policy, t)
    const expense_pct_prem = getAssumptionValue(assumptions.expense_pct_prem,   policy, t)
    const prem_tax_rate    = getAssumptionValue(assumptions.prem_tax_rate,      policy, t)
    const fit_rate         = getAssumptionValue(assumptions.fit_rate,           policy, t)
    const nii_rate         = getAssumptionValue(assumptions.nii_rate,           policy, t)

    // For annual steps, compound the lapse over 12 months
    const effectiveLapse = timeStep === 'annual'
      ? 1 - Math.pow(1 - lapse_rate, 12)
      : lapse_rate

    // Core calculations (scale by step size for flows)
    const inforce_eop = inforce_bop * (1.0 - effectiveLapse)
    const prem     = inforce_bop * premiumAmount * stepMonths
    const claim    = inforce_bop * claim_cost * ccscale * stepMonths
    const comm     = prem * commission_rate
    const exp_amt  = (inforce_bop * expense_per_policy + prem * expense_pct_prem) * (timeStep === 'annual' ? 1 : 1)
    const ptx      = prem * prem_tax_rate

    const reserve_bop = inforce_bop * premiumAmount * 0.5
    const reserve_eop = inforce_eop * premiumAmount * 0.5
    const reserve_change = reserve_eop - reserve_bop
    const nii = ((reserve_bop + reserve_eop) / 2) * nii_rate * stepMonths

    const pretax_income = prem + nii - claim - comm - exp_amt - ptx - reserve_change
    const fit = Math.max(0, pretax_income) * fit_rate
    const net_income = pretax_income - fit

    // Collect any extra assumption values (user-defined)
    const extraAssumptions = {}
    Object.keys(assumptions).forEach(k => {
      if (!['lapse','claim_cost','ccscale','commission_rate','expense_per_policy',
            'expense_pct_prem','prem_tax_rate','fit_rate','nii_rate'].includes(k)) {
        extraAssumptions[k] = getAssumptionValue(assumptions[k], policy, t)
      }
    })

    results.push({
      step,
      t,
      cal_year: calYear,
      cal_month: calMonth,
      duration_month: t + 1,
      inforce_bop,
      inforce_eop,
      lapse_rate,
      effective_lapse: effectiveLapse,
      claim_cost,
      ccscale,
      commission_rate,
      expense_per_policy,
      expense_pct_prem,
      prem_tax_rate,
      fit_rate,
      premium: prem,
      claims: claim,
      commissions: comm,
      expenses: exp_amt,
      premium_tax: ptx,
      reserve_bop,
      reserve_eop,
      reserve_change,
      nii,
      pretax_income,
      fit,
      net_income,
      ...extraAssumptions
    })

    inforce_bop = inforce_eop
    if (inforce_bop < 0.0001) break  // lapsed out
  }

  return results
}

/**
 * Run full model for all policies
 */
export async function runFullModel(policies, assumptions, proj_months, valDate, timeStep, onProgress) {
  const seriatimResults = []
  const total = policies.length

  for (let i = 0; i < total; i++) {
    const policy = policies[i]
    const monthlyRows = projectPolicy(policy, assumptions, proj_months, valDate, timeStep)

    monthlyRows.forEach(row => {
      seriatimResults.push({ policy_number: policy.policy_number, ...row })
    })

    if (onProgress) onProgress(Math.round(((i + 1) / total) * 100))

    if (i % 25 === 0) await new Promise(r => setTimeout(r, 0))
  }

  return seriatimResults
}

/**
 * Aggregate seriatim to monthly/annual income statement
 */
export function aggregateResults(seriatimResults) {
  const byPeriod = {}

  seriatimResults.forEach(row => {
    const key = `${row.cal_year}-${String(row.cal_month).padStart(2, '0')}`
    if (!byPeriod[key]) {
      byPeriod[key] = {
        cal_year: row.cal_year,
        cal_month: row.cal_month,
        period: key,
        policies_inforce: 0,
        premium: 0, claims: 0, commissions: 0, expenses: 0,
        premium_tax: 0, reserve_change: 0, nii: 0,
        pretax_income: 0, fit: 0, net_income: 0
      }
    }
    const m = byPeriod[key]
    m.policies_inforce += row.inforce_bop
    m.premium          += row.premium
    m.claims           += row.claims
    m.commissions      += row.commissions
    m.expenses         += row.expenses
    m.premium_tax      += row.premium_tax
    m.reserve_change   += row.reserve_change
    m.nii              += row.nii
    m.pretax_income    += row.pretax_income
    m.fit              += row.fit
    m.net_income       += row.net_income
  })

  return Object.values(byPeriod).sort((a, b) => a.period.localeCompare(b.period))
}

export function computeSummaryStats(seriatimResults) {
  if (!seriatimResults || seriatimResults.length === 0) return null
  const policies = new Set(seriatimResults.map(r => r.policy_number)).size
  const totalPrem    = seriatimResults.reduce((s, r) => s + r.premium, 0)
  const totalClaims  = seriatimResults.reduce((s, r) => s + r.claims, 0)
  const totalNetIncome = seriatimResults.reduce((s, r) => s + r.net_income, 0)
  const lossRatio    = totalPrem > 0 ? totalClaims / totalPrem : 0
  return { policies, totalRows: seriatimResults.length, totalPrem, totalClaims, totalNetIncome, lossRatio }
}

// Formatting helpers
export function fmt(n, decimals = 0) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n)
}

export function fmtPct(n, decimals = 1) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return (n * 100).toFixed(decimals) + '%'
}

export function fmtCurrency(n) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}
