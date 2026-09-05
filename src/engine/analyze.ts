/**
 * One call: a Run in, a Report out. Every rule runs; a rule that says it
 * cannot run on this trace is listed as silent with its reason instead of
 * quietly scoring 100.
 */

import type { Run } from '../model/trace.js'
import { ALL_RULES } from '../rules/index.js'
import { buildReport } from './score.js'
import type { Finding, Report, SilentRule } from './types.js'

function dedupe(findings: Finding[]): Finding[] {
  const seen = new Set<string>()
  return findings.filter((f) => {
    const key = `${f.ruleId}:${[...f.eventIds].sort().join(',')}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function analyze(run: Run): Report {
  const findings: Finding[] = []
  const silent: SilentRule[] = []
  for (const rule of ALL_RULES) {
    const reason = rule.requires?.(run) ?? null
    if (reason) {
      silent.push({ ruleId: rule.id, reason })
      continue
    }
    findings.push(...rule.run(run))
  }
  return buildReport(run, dedupe(findings), silent)
}
