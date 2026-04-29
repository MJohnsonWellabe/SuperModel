#!/usr/bin/env node
/**
 * Gecko MedSupp — Sample Data Generator
 * Generates a sample Excel (.xlsx) file with 100 policy records.
 * Run: node generate-sample-data.js
 */

import * as XLSX from 'xlsx'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { writeFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PLANS = ['Plan F', 'Plan G', 'Plan N', 'Plan A', 'Plan B', 'Plan C', 'Plan D']
const STATES = ['TX', 'FL', 'CA', 'NY', 'IL', 'OH', 'PA', 'GA', 'NC', 'AZ', 'MI', 'WA']
const GENDERS = ['M', 'F']
const AGE_BANDS = ['60-64', '65-69', '70-74', '75-79', '80+']
const TOBACCO = ['NT', 'T']
const CHANNELS = ['Agent', 'Direct', 'Broker', 'Online']
const REGIONS = ['Region 1', 'Region 2', 'Region 3', 'Region 4', 'Region 5']

function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randBetween(min, max) { return min + Math.random() * (max - min) }

const policies = Array.from({ length: 100 }, (_, i) => ({
  policy_number: `MED${String(i + 1).padStart(5, '0')}`,
  issue_year: 2018 + Math.floor(Math.random() * 6),
  issue_month: Math.ceil(Math.random() * 12),
  premium_amount: Math.round(randBetween(120, 380) * 100) / 100,
  character_1: randItem(PLANS),
  character_2: randItem(STATES),
  character_3: randItem(GENDERS),
  character_4: randItem(AGE_BANDS),
  character_5: randItem(TOBACCO),
  character_6: randItem(CHANNELS),
  character_7: randItem(REGIONS),
  character_8: '12 months',
  character_9: 'Traditional',
  character_10: `Group ${Math.ceil(Math.random() * 5)}`
}))

// Create workbook
const wb = XLSX.utils.book_new()

// Policies sheet
const ws = XLSX.utils.json_to_sheet(policies)
XLSX.utils.book_append_sheet(wb, ws, 'Policies')

// Schema reference sheet
const schema = [
  { Column: 'policy_number', Type: 'string', Required: 'YES', Description: 'Unique policy identifier' },
  { Column: 'issue_year', Type: 'integer', Required: 'YES', Description: 'Policy issue year (e.g. 2022)' },
  { Column: 'issue_month', Type: 'integer', Required: 'YES', Description: 'Policy issue month 1–12' },
  { Column: 'premium_amount', Type: 'float', Required: 'YES', Description: 'Monthly premium in dollars' },
  { Column: 'character_1', Type: 'string', Required: 'NO', Description: 'Plan type (e.g. Plan F, Plan G)' },
  { Column: 'character_2', Type: 'string', Required: 'NO', Description: 'State (e.g. TX, FL)' },
  { Column: 'character_3', Type: 'string', Required: 'NO', Description: 'Gender (M/F)' },
  { Column: 'character_4', Type: 'string', Required: 'NO', Description: 'Issue Age Band' },
  { Column: 'character_5', Type: 'string', Required: 'NO', Description: 'Tobacco Status (NT/T)' },
  { Column: 'character_6', Type: 'string', Required: 'NO', Description: 'Distribution Channel' },
  { Column: 'character_7', Type: 'string', Required: 'NO', Description: 'Rating Region' },
  { Column: 'character_8', Type: 'string', Required: 'NO', Description: 'Benefit Period' },
  { Column: 'character_9', Type: 'string', Required: 'NO', Description: 'Network Type' },
  { Column: 'character_10', Type: 'string', Required: 'NO', Description: 'Custom characteristic 10' },
]
const ws2 = XLSX.utils.json_to_sheet(schema)
XLSX.utils.book_append_sheet(wb, ws2, 'Schema')

const outputPath = join(__dirname, 'sample-data', 'sample_policies.xlsx')
XLSX.writeFile(wb, outputPath)
console.log(`✅ Sample data written to: ${outputPath}`)
console.log(`   ${policies.length} policies generated`)
