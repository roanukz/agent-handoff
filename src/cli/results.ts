/**
 * Score the copied agent-submit corpus and write results/agent-submit.json and
 * results/agent-submit.md. Every corpus number on the teardown comes from here.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { analyze } from '../engine/analyze.js'
import { CHECK_DEFS } from '../engine/checks.js'
import type { Report } from '../engine/types.js'
import { ALL_RULES } from '../rules/index.js'
import { describeEvent, plain } from './format.js'
import { loadCorpus, ROOT } from './load.js'

const runs = loadCorpus()
const reports = runs.map((run) => analyze(run))

type Group = { name: string; key: string; reports: Report[] }
const groups: Group[] = [
  { name: 'SDK control (one thread each)', key: 'sdk', reports: reports.filter((r) => r.run.format === 'sdk') },
  { name: 'Managed Agents, single agent', key: 'managed-single', reports: reports.filter((r) => r.run.format === 'managed' && r.run.threads.length === 1) },
  { name: 'Managed Agents, coordinator plus roster', key: 'managed-coordinator', reports: reports.filter((r) => r.run.format === 'managed' && r.run.threads.length > 1) }
]

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const round1 = (x: number) => Math.round(x * 10) / 10

function ruleHits(rs: Report[]) {
  const hits: Record<string, { findings: number; runs: number }> = {}
  for (const rule of ALL_RULES) hits[rule.id] = { findings: 0, runs: 0 }
  for (const r of rs) {
    const seen = new Set<string>()
    for (const f of r.issues) {
      hits[f.ruleId]!.findings++
      seen.add(f.ruleId)
    }
    for (const id of seen) hits[id]!.runs++
  }
  return hits
}

function silentCounts(rs: Report[]) {
  const counts: Record<string, number> = {}
  for (const r of rs) for (const s of r.silent) counts[s.ruleId] = (counts[s.ruleId] ?? 0) + 1
  return counts
}

const summary = {
  generatedAt: new Date().toISOString(),
  runs: reports.length,
  ruleCount: ALL_RULES.length,
  formats: { sdk: groups[0]!.reports.length, managed: groups[1]!.reports.length + groups[2]!.reports.length },
  groups: groups.map((g) => ({
    key: g.key,
    name: g.name,
    runs: g.reports.length,
    meanOverall: round1(mean(g.reports.map((r) => r.overall))),
    withFindings: g.reports.filter((r) => r.issueCount > 0).length,
    bands: {
      'handed-off': g.reports.filter((r) => r.band === 'handed-off').length,
      'needs-attention': g.reports.filter((r) => r.band === 'needs-attention').length,
      broke: g.reports.filter((r) => r.band === 'broke').length
    },
    checkMeans: Object.fromEntries(CHECK_DEFS.map((c) => [c.id, round1(mean(g.reports.map((r) => r.checks.find((x) => x.def.id === c.id)!.score)))])),
    ruleHits: ruleHits(g.reports),
    silent: silentCounts(g.reports)
  })),
  runsTable: reports
    .filter((r) => r.run.threads.length > 1 || r.issueCount > 0)
    .map((r) => ({ id: r.run.id, format: r.run.format, threads: r.run.threads.length, overall: r.overall, band: r.band, findings: r.issues.map((f) => f.ruleId) })),
  examples: reports
    .flatMap((r) => r.issues.map((f) => ({ run: r.run.id, ruleId: f.ruleId, severity: f.severity, message: plain(f.message), events: f.eventIds.map((id) => describeEvent(r.run, id)) })))
    .slice(0, 60)
}

mkdirSync(join(ROOT, 'results'), { recursive: true })
writeFileSync(join(ROOT, 'results', 'agent-submit.json'), `${JSON.stringify(summary, null, 2)}\n`)

const md: string[] = []
md.push('# Scores on the agent-submit corpus')
md.push('')
md.push(`Generated ${summary.generatedAt} by \`npm run results\`. ${summary.runs} runs: ${summary.formats.sdk} SDK control runs and ${summary.formats.managed} Managed Agents runs, scored by ${summary.ruleCount} rules. No model, no network.`)
md.push('')
md.push('| Group | Runs | Mean score | Runs with a finding | Handed off | Needs attention | Broke |')
md.push('|---|---|---|---|---|---|---|')
for (const g of summary.groups) md.push(`| ${g.name} | ${g.runs} | ${g.meanOverall} | ${g.withFindings} | ${g.bands['handed-off']} | ${g.bands['needs-attention']} | ${g.bands.broke} |`)
md.push('')
md.push('## Rule hits by group')
md.push('')
md.push(`| Rule | ${summary.groups.map((g) => `${g.name} (findings / runs)`).join(' | ')} |`)
md.push(`|---|${summary.groups.map(() => '---').join('|')}|`)
for (const rule of ALL_RULES) {
  md.push(`| ${rule.id} | ${summary.groups.map((g) => `${g.ruleHits[rule.id]!.findings} / ${g.ruleHits[rule.id]!.runs}`).join(' | ')} |`)
}
md.push('')
md.push('## Silent rules by group')
md.push('')
md.push('A rule is silent when the trace lacks what it compares: a second thread, tool arguments, a roster, or a recorded decision. Silent is not clean; the count says how often the format could not answer.')
md.push('')
md.push(`| Rule | ${summary.groups.map((g) => g.name).join(' | ')} |`)
md.push(`|---|${summary.groups.map(() => '---').join('|')}|`)
for (const rule of ALL_RULES) md.push(`| ${rule.id} | ${summary.groups.map((g) => g.silent[rule.id] ?? 0).join(' | ')} |`)
md.push('')
md.push('## Runs with more than one thread, or with a finding')
md.push('')
md.push('| Run | Format | Threads | Score | Band | Findings |')
md.push('|---|---|---|---|---|---|')
for (const r of summary.runsTable) md.push(`| ${r.id} | ${r.format} | ${r.threads} | ${r.overall} | ${r.band} | ${r.findings.join(', ') || 'none'} |`)
md.push('')
md.push('## Findings, with the events they cite')
md.push('')
for (const ex of summary.examples) {
  md.push(`- **${ex.run}**, ${ex.ruleId} (${ex.severity}): ${ex.message}`)
  for (const e of ex.events) md.push(`  - ${e}`)
}
md.push('')
writeFileSync(join(ROOT, 'results', 'agent-submit.md'), `${md.join('\n')}\n`)

console.log(md.slice(0, 12).join('\n'))
console.log(`\nWrote results/agent-submit.json and results/agent-submit.md (${summary.examples.length} findings listed).`)
