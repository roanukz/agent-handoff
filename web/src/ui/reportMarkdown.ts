/**
 * "Copy report" output: a markdown summary with every finding and its events.
 */

import type { Report } from '../../../src/engine/types.js'
import { CHECK_FLOOR } from '../../../src/engine/score.js'
import { STATUS_LABEL, describeEvent, fmtPoints, summaryLine } from './format.js'

export function buildMarkdownReport(report: Report): string {
  const lines: string[] = []
  lines.push('# Did My Agents Hand Off? Report')
  lines.push('')
  lines.push(`Trace: ${report.run.id} (${report.run.format}, ${report.run.threads.length} thread${report.run.threads.length === 1 ? '' : 's'}, ${report.run.events.length} events)`)
  lines.push('')
  lines.push(`**Score: ${report.overall}/100. ${report.bandLabel}**`)
  lines.push('')
  lines.push(`Weakest check: ${report.weakestCheck.def.name}, ${report.weakestCheck.score}/100.`)
  if (report.floored) {
    lines.push('')
    lines.push(`Not handed off cleanly despite a composite of ${report.overall}: no run is with a check below ${CHECK_FLOOR}.`)
  }
  lines.push('')
  lines.push(summaryLine(report))
  lines.push('')
  lines.push('## Checks')
  lines.push('')
  lines.push('| Check | Weight | Score | Status |')
  lines.push('| --- | --- | --- | --- |')
  for (const c of report.checks) lines.push(`| ${c.def.name} | ${Math.round(c.def.weight * 100)}% | ${c.score} | ${STATUS_LABEL[c.status] ?? c.status} |`)
  if (report.fixes.length > 0) {
    lines.push('')
    lines.push('## Fix these first')
    lines.push('')
    report.fixes.forEach((f, i) => lines.push(`${i + 1}. ${f.suggestion} _(+${fmtPoints(f.impact)} points, ${f.ruleId})_`))
  }
  if (report.issues.length > 0) {
    lines.push('')
    lines.push('## Findings')
    lines.push('')
    for (const f of report.issues) {
      lines.push(`- **${f.ruleId}** (${f.severity}${f.counted ? '' : ', same habit, not counted'}): ${f.message}`)
      for (const id of f.eventIds) lines.push(`  - ${describeEvent(report.run, id, 160)}`)
    }
  }
  if (report.silent.length > 0) {
    lines.push('')
    lines.push('## Rules that could not run')
    lines.push('')
    for (const s of report.silent) lines.push(`- ${s.ruleId}: ${s.reason}`)
  }
  lines.push('')
  lines.push('_Scored locally by Did My Agents Hand Off? No model was called and no text left the browser._')
  return lines.join('\n')
}
