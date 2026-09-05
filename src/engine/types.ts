/**
 * Core types for the scoring engine. Pure data, no DOM, so the whole engine
 * runs in Node and in the browser alike.
 */

import type { Run } from '../model/trace.js'

export type Severity = 'major' | 'minor' | 'info'

export type CheckId =
  | 'context-carried'
  | 'no-duplicate-work'
  | 'routing'
  | 'termination'
  | 'permission-continuity'

export interface Finding {
  ruleId: string
  checkId: CheckId
  severity: Severity
  /** The events the rule fired on. At least two where a comparison is involved. */
  eventIds: string[]
  /** One sentence, specific to these events. */
  message: string
  /** The handoff principle this finding violates. */
  whyItMatters: string
  /** What to change in the prompt or the topology. */
  suggestion: string
}

export interface Rule {
  id: string
  checkId: CheckId
  severity: Severity
  name: string
  /** One sentence for the catalog. */
  description: string
  /** A reason this rule cannot run on this trace, or null when it can. */
  requires?(run: Run): string | null
  run(run: Run): Finding[]
}

export interface CheckDef {
  id: CheckId
  name: string
  /** Fraction of the overall score. */
  weight: number
  /** The reader-facing explainer sentence. */
  why: string
}

export interface ScoredFinding extends Finding {
  /** Points this finding deducts from its check (25 major, 10 minor, 0 info). */
  deduction: number
  /** False past the per-rule cap: listed, tagged as the same habit, not counted. */
  counted: boolean
  /** Weighted overall points this finding costs when counted. */
  impact: number
  /** Overall points recovered by fixing this one finding, cap-aware and floor-aware. */
  recovery: number
}

export type CheckStatus = 'pass' | 'needs-work' | 'fail'

export interface CheckResult {
  def: CheckDef
  score: number
  status: CheckStatus
  findings: ScoredFinding[]
}

export type Band = 'handed-off' | 'needs-attention' | 'broke'

export interface SilentRule {
  ruleId: string
  reason: string
}

export interface Report {
  run: Run
  overall: number
  band: Band
  bandLabel: string
  checks: CheckResult[]
  weakestCheck: CheckResult
  floored: boolean
  /** All findings, in event order. */
  issues: ScoredFinding[]
  /** Top findings ranked by recovery, max 5. */
  fixes: ScoredFinding[]
  issueCount: number
  checksWithIssues: number
  topFixRecovery: number
  /** Rules that could not run on this trace, with the reason. */
  silent: SilentRule[]
}
