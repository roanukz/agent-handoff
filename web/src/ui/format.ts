/**
 * Shared formatting for the result views and the copied report.
 */

import { eventById, threadName, type Event, type Run } from '../../../src/model/trace.js'
import { excerpt } from '../../../src/engine/text.js'
import type { Report, ScoredFinding } from '../../../src/engine/types.js'

export const STATUS_LABEL: Record<string, string> = { pass: 'pass', 'needs-work': 'needs work', fail: 'fail' }

export function fmtPoints(points: number): string {
  const rounded = Math.round(points * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function summaryLine(report: Report): string {
  if (report.issueCount === 0) {
    return report.silent.length ? `No findings. ${report.silent.length} of ${report.silent.length + countRan(report)} rules could not run on this trace; see the notes.` : 'No findings. Every rule ran and every check passed.'
  }
  const issues = `${report.issueCount} finding${report.issueCount === 1 ? '' : 's'}`
  const checks = `${report.checksWithIssues} check${report.checksWithIssues === 1 ? '' : 's'}`
  if (report.fixes.length === 0 || report.topFixRecovery === 0) return `${issues} across ${checks}.`
  const top = Math.min(3, report.fixes.length)
  return `${issues} across ${checks}. The top ${top} fix${top === 1 ? '' : 'es'} below recover ~${report.topFixRecovery} points.`
}

function countRan(report: Report): number {
  const ran = new Set(report.issues.map((f) => f.ruleId))
  return Math.max(ran.size, 18 - report.silent.length)
}

export function eventBody(e: Event): string {
  switch (e.kind) {
    case 'tool_call':
      return `${e.tool ?? 'tool'}${e.args === undefined ? '' : ` ${JSON.stringify(e.args)}`}${e.decision ? `\n[${[e.decision.tier, e.decision.decision, e.decision.afterBuyer ? `then ${e.decision.afterBuyer}` : ''].filter(Boolean).join(' ')}]` : ''}`
    case 'tool_result':
      return `${e.result?.isError ? 'error: ' : ''}${e.result?.content ?? ''}`
    case 'decision':
      return `${e.decision?.decision ?? ''} ${e.decision?.reason ?? ''}`
    case 'thread_idle':
    case 'session_end':
      return e.stopReason ?? ''
    case 'thread_terminated':
      return e.reason ?? '(no reason recorded)'
    default:
      return e.content ?? ''
  }
}

export function kindLabel(e: Event, run: Run): string {
  switch (e.kind) {
    case 'delegation':
      return `delegation to ${threadName(run, e.to ?? '')}`
    case 'report':
      return `report from ${threadName(run, e.from ?? '')}`
    case 'user_message':
      return 'request'
    case 'tool_call':
      return 'tool call'
    case 'tool_result':
      return 'tool result'
    case 'session_end':
      return 'session end'
    default:
      return e.kind.replace(/_/g, ' ')
  }
}

export function describeEvent(run: Run, id: string, max = 110): string {
  const e = eventById(run, id)
  if (!e) return `${id} (missing)`
  return `${id} [${threadName(run, e.threadId)}] ${kindLabel(e, run)}: ${excerpt(eventBody(e), max)}`
}

export function actionFor(f: ScoredFinding): string {
  return f.suggestion
}
