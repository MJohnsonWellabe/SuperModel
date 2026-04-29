import JSZip from 'jszip'

/**
 * Export current scenario to a downloadable zip bundle
 */
export async function exportScenarioBundle(state) {
  const zip = new JSZip()

  const meta = {
    ...state.meta,
    exported_at: new Date().toISOString(),
    version: '1.0.0'
  }

  zip.file('scenario.json', JSON.stringify(meta, null, 2))
  zip.file('assumptions.json', JSON.stringify(state.assumptions, null, 2))
  zip.file('formulas.json', JSON.stringify(state.formulas, null, 2))

  if (state.policies && state.policies.length > 0) {
    const csvLines = [
      Object.keys(state.policies[0]).join(','),
      ...state.policies.map(p => Object.values(p).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    ]
    zip.file('inputs.csv', csvLines.join('\n'))
  }

  if (state.outputs && state.outputs.length > 0) {
    const csvLines = [
      Object.keys(state.outputs[0]).join(','),
      ...state.outputs.map(r => Object.values(r).map(v => typeof v === 'number' ? v.toFixed(4) : v).join(','))
    ]
    zip.file('outputs.csv', csvLines.join('\n'))
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gecko_medsupp_scenario_${new Date().toISOString().split('T')[0]}.zip`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Import scenario from zip bundle
 */
export async function importScenarioBundle(file) {
  const zip = await JSZip.loadAsync(file)

  const readFile = async (name) => {
    const f = zip.file(name)
    return f ? f.async('string') : null
  }

  const metaStr = await readFile('scenario.json')
  const assumptionsStr = await readFile('assumptions.json')
  const formulasStr = await readFile('formulas.json')
  const inputsStr = await readFile('inputs.csv')

  const meta = metaStr ? JSON.parse(metaStr) : {}
  const assumptions = assumptionsStr ? JSON.parse(assumptionsStr) : {}
  const formulas = formulasStr ? JSON.parse(formulasStr) : {}

  let policies = []
  if (inputsStr) {
    const lines = inputsStr.trim().split('\n')
    const headers = lines[0].split(',')
    policies = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.replace(/^"|"$/g, ''))
      const obj = {}
      headers.forEach((h, i) => { obj[h.trim()] = vals[i] ?? '' })
      return obj
    })
  }

  return { meta, assumptions, formulas, policies }
}

/**
 * Download a CSV string as a file
 */
export function downloadCSV(data, filename) {
  if (!data || data.length === 0) return
  const headers = Object.keys(data[0])
  const rows = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const v = row[h]
      if (typeof v === 'number') return v.toFixed(4)
      return `"${String(v ?? '').replace(/"/g, '""')}"`
    }).join(','))
  ]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
