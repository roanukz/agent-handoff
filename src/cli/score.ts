/**
 * score <path...> [--format auto|managed|sdk|whowhen|run] [--roster file] [--json] [--events]
 *
 * A path is a trace directory (primary.jsonl plus thread files, or an SDK
 * record with decisions.json), a single file, or a folder of either.
 */

import { analyze } from '../engine/analyze.js'
import type { Format } from '../parsers/index.js'
import { renderReport } from './format.js'
import { loadPath } from './load.js'

function parseArgs(argv: string[]) {
  const paths: string[] = []
  let format: Format = 'auto'
  let rosterPath: string | undefined
  let json = false
  let events = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--format') format = argv[++i] as Format
    else if (a.startsWith('--format=')) format = a.slice('--format='.length) as Format
    else if (a === '--roster') rosterPath = argv[++i]
    else if (a === '--json') json = true
    else if (a === '--events') events = true
    else if (a === '--help' || a === '-h') {
      console.log('score <path...> [--format auto|managed|sdk|whowhen|run] [--roster file] [--json] [--events]')
      process.exit(0)
    } else paths.push(a)
  }
  return { paths, format, rosterPath, json, events }
}

const args = parseArgs(process.argv.slice(2))
if (args.paths.length === 0) {
  console.error('score: give at least one trace path')
  process.exit(2)
}

const runs = args.paths.flatMap((p) => loadPath(p, { format: args.format, rosterPath: args.rosterPath }))
const reports = runs.map((run) => analyze(run))

if (args.json) {
  const out = reports.map((r) => ({
    id: r.run.id,
    format: r.run.format,
    overall: r.overall,
    band: r.band,
    checks: r.checks.map((c) => ({ id: c.def.id, score: c.score, status: c.status })),
    findings: r.issues.map((f) => ({ ruleId: f.ruleId, checkId: f.checkId, severity: f.severity, counted: f.counted, eventIds: f.eventIds, message: f.message })),
    silent: r.silent
  }))
  console.log(JSON.stringify(out, null, 2))
} else {
  for (const r of reports) {
    console.log(renderReport(r, { events: args.events }))
    console.log('')
  }
  if (reports.length > 1) {
    const mean = reports.reduce((n, r) => n + r.overall, 0) / reports.length
    const withIssues = reports.filter((r) => r.issueCount > 0).length
    console.log(`${reports.length} runs, mean ${mean.toFixed(1)}, ${withIssues} with at least one finding.`)
  }
}
