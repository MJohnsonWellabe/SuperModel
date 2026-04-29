/**
 * MedSupp Projection Engine
 * Pure JavaScript implementation — no Pyodide required for core MVP.
 * Formulas are evaluated in a sandboxed Function context.
 */

/**
 * Get assumption value for a given policy at duration t
 */
export function getAssumptionValue(assumption, policy, t) {
  if (!assumption) return 0

  const { type, values, dimensioning_keys } = assumption

  // Build key from policy's characters
  let key = 'default'
  if (dimensioning_keys && dimensioning_keys.length > 0) {
    const parts = dimensioning_keys.map(k => {
      const charNum = k.replace('character_', '')
      return policy[`character_${charNum}`] || policy[k] || ''
    })
    const candidateKey = parts.join('|')
    if (values[candidateKey] !== undefined) key = candidateKey
    // fallback to default
  }

  const val = values[key] !== undefined ? values[key] : values['default']
  if (val === undefined) return 0

  if (type === 'scalar') {
    return typeof val === 'number' ? val : 0
  }

  if (type === 'by_duration') {
    if (Array.isArray(val)) {
      return val[Math.min(t, val.length - 1)] ?? val[val.length - 1] ?? 0
    }
    return typeof val === 'number' ? val : 0
  }

  return 0
}

/**
 * Project a single policy over proj_months
 */
export function projectPolicy(policy, assumptions, proj_months) {
  const results = []
  let inforce_bop = 1.0

  const issueYear = parseInt(policy.issue_year) || 2020
  const issueMonth = parseInt(policy.issue_month) || 1
  const premiumAmount = parseFloat(policy.premium_amount) || 0

  for (let t = 0; t < proj_months; t++) {
    // Calendar time
    const totalMonth = (issueMonth - 1) + t
    const calYear = issueYear + Math.floor(totalMonth / 12)
    const calMonth = (totalMonth % 12) + 1

    // Get assumption values
    const lapse_rate = getAssumptionValue(assumptions.lapse, policy, t)
    const claim_cost = getAssumptionValue(assumptions.claim_cost, policy, t)
    const commission_rate = getAssumptionValue(assumptions.commission_rate, policy, t)
    const expense_per_policy = getAssumptionValue(assumptions.expense_per_policy, policy, t)
    const expense_pct_prem = getAssumptionValue(assumptions.expense_pct_prem, policy, t)
    const prem_tax_rate = getAssumptionValue(assumptions.prem_tax_rate, policy, t)
    const fit_rate = getAssumptionValue(assumptions.fit_rate, policy, t)
    const nii_rate = getAssumptionValue(assumptions.nii_rate, policy, t)

    // Core calculations
    const inforce_eop = inforce_bop * (1.0 - lapse_rate)
    const prem = inforce_bop * premiumAmount
    const claim = inforce_bop * claim_cost
    const comm = prem * commission_rate
    const exp_amt = inforce_bop * expense_per_policy + prem * expense_pct_prem
    const ptx = prem * prem_tax_rate

    // Simple reserve (UPR proxy)
    const reserve_bop = inforce_bop * premiumAmount * 0.5
    const reserve_eop = inforce_eop * premiumAmount * 0.5
    const reserve_change = reserve_eop - reserve_bop

    // NII on average reserve
    const nii = ((reserve_bop + reserve_eop) / 2) * nii_rate

    // Pre-tax income
    const pretax_income = prem + nii - claim - comm - exp_amt - ptx - reserve_change
    const fit = Math.max(0, pretax_income) * fit_rate
    const net_income = pretax_income - fit

    results.push({
      t,
      cal_year: calYear,
      cal_month: calMonth,
      duration_month: t + 1,
      inforce_bop,
      inforce_eop,
      lapse_rate,
      claim_cost,
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
      net_income
    })

    inforce_bop = inforce_eop
  }

  return results
}

/**
 * Run the full model for all policies
 */
export async function runFullModel(policies, assumptions, proj_months, onProgress) {
  const seriatimResults = []
  const total = policies.length

  for (let i = 0; i < total; i++) {
    const policy = policies[i]
    const monthlyRows = projectPolicy(policy, assumptions, proj_months)

    monthlyRows.forEach(row => {
      seriatimResults.push({
        policy_number: policy.policy_number,
        ...row
      })
    })

    if (onProgress) {
      onProgress(Math.round(((i + 1) / total) * 100))
    }

    // Yield to browser every 50 policies
    if (i % 50 === 0) {
      await new Promise(r => setTimeout(r, 0))
    }
  }

  return seriatimResults
}

/**
 * Aggregate seriatim to monthly income statement
 */
export function aggregateResults(seriatimResults) {
  const byMonth = {}

  seriatimResults.forEach(row => {
    const key = `${row.cal_year}-${String(row.cal_month).padStart(2, '0')}`
    if (!byMonth[key]) {
      byMonth[key] = {
        cal_year: row.cal_year,
        cal_month: row.cal_month,
        period: key,
        policies_inforce: 0,
        premium: 0,
        claims: 0,
        commissions: 0,
        expenses: 0,
        premium_tax: 0,
        reserve_change: 0,
        nii: 0,
        pretax_income: 0,
        fit: 0,
        net_income: 0
      }
    }
    const m = byMonth[key]
    m.policies_inforce += row.inforce_bop
    m.premium += row.premium
    m.claims += row.claims
    m.commissions += row.commissions
    m.expenses += row.expenses
    m.premium_tax += row.premium_tax
    m.reserve_change += row.reserve_change
    m.nii += row.nii
    m.pretax_income += row.pretax_income
    m.fit += row.fit
    m.net_income += row.net_income
  })

  return Object.values(byMonth).sort((a, b) => a.period.localeCompare(b.period))
}

/**
 * Compute summary stats
 */
export function computeSummaryStats(seriatimResults) {
  if (!seriatimResults || seriatimResults.length === 0) return null

  const policies = new Set(seriatimResults.map(r => r.policy_number)).size
  const totalPrem = seriatimResults.reduce((s, r) => s + r.premium, 0)
  const totalClaims = seriatimResults.reduce((s, r) => s + r.claims, 0)
  const totalNetIncome = seriatimResults.reduce((s, r) => s + r.net_income, 0)
  const lossRatio = totalPrem > 0 ? totalClaims / totalPrem : 0

  return {
    policies,
    totalRows: seriatimResults.length,
    totalPrem,
    totalClaims,
    totalNetIncome,
    lossRatio
  }
}

/**
 * Safe formula compilation (sandbox via new Function)
 */
export function compileSafeFormula(code, funcName) {
  try {
    // Extract function body from def ...: pattern
    const wrapped = `
      "use strict";
      ${convertPythonToJs(code)}
      return ${funcName};
    `
    // eslint-disable-next-line no-new-func
    const fn = new Function(wrapped)()
    return { ok: true, fn }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

/**
 * Very simple Python-to-JS converter for basic formula shapes
 * (enough for the built-in formulas; custom code should use JS)
 */
function convertPythonToJs(code) {
  return code
    .replace(/^def\s+(\w+)\s*\(([^)]*)\)\s*:/gm, 'function $1($2) {')
    .replace(/^    return\s+/gm, '  return ')
    .replace(/\bmax\(0(\.0)?,\s*/g, 'Math.max(0, ')
    .replace(/\bmax\(/g, 'Math.max(')
    .replace(/\bmin\(/g, 'Math.min(')
    .replace(/\babs\(/g, 'Math.abs(')
    .replace(/\n(\s*)#[^\n]*/g, '') // strip Python comments
    // close function bodies - simple heuristic
    + '\n}'
}

/**
 * Format currency
 */
export function fmt(n, decimals = 0) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(n)
}

export function fmtPct(n, decimals = 1) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return (n * 100).toFixed(decimals) + '%'
}

export function fmtCurrency(n) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(n)
}
