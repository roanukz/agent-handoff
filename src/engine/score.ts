/**
 * Findings to per-check scores to an overall score. Reused from agent-answer.
 *
 * Per check: start at 100, subtract 25 per major and 10 per minor; info costs
 * nothing. Only the first 3 findings per rule count toward the deduction; the
 * rest are listed and tagged as the same habit. Scores floor at 0. The overall
 * score is the weighted average of the five checks, and a check below the
 * floor caps the band whatever the average says. Same input, same score.
 */

import type { Run } from '../model/trace.js'
import { BAND_LABELS, CHECK_DEFS } from './checks.js'
import type {
  Band,
  CheckResult,
  CheckStatus,
  Finding,
  Report,
  ScoredFinding,
  Severity,
  SilentRule
} from './types.js'

export function deductionFor(severity: Severity): number {
  if (severity === 'major') return 25
  if (severity === 'minor') return 10
  return 0
}

export function checkStatus(score: number): CheckStatus {
  if (score >= 85) return 'pass'
  if (score >= 60) return 'needs-work'
  return 'fail'
}

/** No run is handed off cleanly with any check below this. */
export const CHECK_FLOOR = 60

export function bandFor(overall: number, weakestScore = 100): Band {
  if (overall >= 85 && weakestScore >= CHECK_FLOOR) return 'handed-off'
  if (overall >= 60) return 'needs-attention'
  return 'broke'
}

export const PER_RULE_CAP = 3

export function buildReport(run: Run, findings: Finding[], silent: SilentRule[] = []): Report {
  const position = new Map(run.events.map((e) => [e.id, e.index]))
  const firstIndex = (f: Finding): number =>
    Math.min(...f.eventIds.map((id) => position.get(id) ?? Number.MAX_SAFE_INTEGER))

  const ordered = [...findings].sort(
    (a, b) => firstIndex(a) - firstIndex(b) || a.ruleId.localeCompare(b.ruleId)
  )

  const perRuleCount = new Map<string, number>()
  const scored: ScoredFinding[] = ordered.map((f) => {
    const seen = perRuleCount.get(f.ruleId) ?? 0
    perRuleCount.set(f.ruleId, seen + 1)
    return { ...f, deduction: deductionFor(f.severity), counted: seen < PER_RULE_CAP, impact: 0, recovery: 0 }
  })

  const cappedDeduction = (own: ScoredFinding[], excluded: ReadonlySet<ScoredFinding>): number => {
    const count = new Map<string, number>()
    let total = 0
    for (const f of own) {
      if (excluded.has(f)) continue
      const seen = count.get(f.ruleId) ?? 0
      count.set(f.ruleId, seen + 1)
      if (seen < PER_RULE_CAP) total += f.deduction
    }
    return total
  }

  const NONE: ReadonlySet<ScoredFinding> = new Set()
  const checks: CheckResult[] = CHECK_DEFS.map((def) => {
    const own = scored.filter((f) => f.checkId === def.id)
    const score = Math.max(0, 100 - cappedDeduction(own, NONE))
    for (const f of own) {
      if (!f.counted || f.deduction === 0) continue
      f.impact = f.deduction * def.weight
      const without = Math.max(0, 100 - cappedDeduction(own, new Set([f])))
      f.recovery = (without - score) * def.weight
    }
    return { def, score, status: checkStatus(score), findings: own }
  })

  const overallRaw = checks.reduce((n, c) => n + c.score * c.def.weight, 0)
  const overall = Math.round(overallRaw)
  const weakestCheck = checks.reduce((worst, c) => (c.score < worst.score ? c : worst))
  const band = bandFor(overallRaw, weakestCheck.score)
  const floored = overallRaw >= 85 && weakestCheck.score < CHECK_FLOOR

  const fixes = [...scored]
    .sort(
      (a, b) =>
        b.impact - a.impact ||
        deductionFor(b.severity) - deductionFor(a.severity) ||
        firstIndex(a) - firstIndex(b)
    )
    .filter((f) => f.impact > 0)
    .slice(0, 5)
  const topSet = new Set(fixes.slice(0, 3))
  const topFixRecovery = checks.reduce((sum, c) => {
    const withoutTop = Math.max(0, 100 - cappedDeduction(c.findings, topSet))
    return sum + (withoutTop - c.score) * c.def.weight
  }, 0)

  return {
    run,
    overall,
    band,
    bandLabel: BAND_LABELS[band],
    checks,
    weakestCheck,
    floored,
    issues: scored,
    fixes,
    issueCount: scored.length,
    checksWithIssues: checks.filter((c) => c.findings.length > 0).length,
    topFixRecovery: Math.round(topFixRecovery),
    silent
  }
}
