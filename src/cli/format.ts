/**
 * Plain-text rendering of a report for the terminal.
 */

import { eventById, threadName, type Event, type Run } from '../model/trace.js'
import { excerpt } from '../engine/text.js'
import type { Report } from '../engine/types.js'

/** Quoted trace text keeps its words and loses the dashes the house style bans. */
export function plain(text: string): string {
  return text.replace(/[\u2013\u2014]/g, '-')
}

export function describeEvent(run: Run, id: string): string {
  const e = eventById(run, id)
  if (!e) return `${id} (missing)`
  const who = threadName(run, e.threadId)
  const body = plain(eventBody(e))
  return `${id} [${who}] ${e.kind}${body ? `: ${body}` : ''}`
}

export function eventBody(e: Event): string {
  switch (e.kind) {
    case 'tool_call':
      return `${e.tool ?? 'tool'}${e.args === undefined ? '' : ` ${excerpt(JSON.stringify(e.args), 100)}`}${e.decision ? ` (${[e.decision.tier, e.decision.decision, e.decision.afterBuyer ? `then ${e.decision.afterBuyer}` : ''].filter(Boolean).join(' ')})` : ''}`
    case 'tool_result':
      return `${e.result?.isError ? 'error: ' : ''}${excerpt(e.result?.content ?? '', 100)}`
    case 'decision':
      return `${e.decision?.decision ?? ''} ${excerpt(e.decision?.reason ?? '', 90)}`
    case 'thread_idle':
    case 'session_end':
      return e.stopReason ?? ''
    case 'thread_terminated':
      return e.reason ?? '(no reason)'
    default:
      return excerpt(e.content ?? '', 110)
  }
}

export function renderReport(report: Report, opts: { events?: boolean } = {}): string {
  const { run } = report
  const lines: string[] = []
  const threads = run.threads.map((t) => t.agentName ?? t.id).join(', ')
  lines.push(`${run.id}  ${report.overall}/100  ${report.bandLabel}  (${run.format}, ${run.threads.length} thread${run.threads.length === 1 ? '' : 's'}: ${threads})`)
  for (const c of report.checks) {
    const n = c.findings.length
    lines.push(`  ${c.def.name.padEnd(22)} ${String(c.score).padStart(3)}  ${c.status}${n ? `  ${n} finding${n === 1 ? '' : 's'}` : ''}`)
  }
  for (const f of report.issues) {
    lines.push(`  - [${f.severity}] ${f.ruleId}${f.counted ? '' : ' (same habit, not counted)'}: ${f.message}`)
    lines.push(`      events: ${f.eventIds.join(', ')}`)
    if (opts.events) for (const id of f.eventIds) lines.push(`        ${describeEvent(run, id)}`)
  }
  if (report.silent.length) {
    const grouped = new Map<string, string[]>()
    for (const s of report.silent) grouped.set(s.reason, [...(grouped.get(s.reason) ?? []), s.ruleId])
    for (const [reason, ids] of grouped) lines.push(`  silent (${ids.length}): ${reason} [${ids.join(', ')}]`)
  }
  return lines.join('\n')
}
