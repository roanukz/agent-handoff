/**
 * Helpers every rule reaches for. Kept small so a rule file reads top to bottom.
 */

import { threadName, type Event, type Run } from '../model/trace.js'
import { excerpt, stableStringify, toolKind, type ToolKind } from '../engine/text.js'
import type { CheckId, Finding, Severity } from '../engine/types.js'

export function toolCalls(run: Run): Event[] {
  return run.events.filter((e) => e.kind === 'tool_call')
}

export function delegations(run: Run): Event[] {
  return run.events.filter((e) => e.kind === 'delegation')
}

export function reports(run: Run): Event[] {
  return run.events.filter((e) => e.kind === 'report')
}

export function resultFor(run: Run, call: Event): Event | undefined {
  return run.events.find((e) => e.kind === 'tool_result' && e.toolCallId === call.id && e.index > call.index)
}

/** A call that got a result the runtime did not mark as an error. */
export function executed(run: Run, call: Event): boolean {
  const r = resultFor(run, call)
  if (r) return !r.result?.isError
  // A write recorded in the SDK trail counts as executed even without a result event.
  return call.decision?.decision === 'allow' || call.decision?.afterBuyer === 'allow'
}

export function argsKey(call: Event): string {
  return stableStringify(call.args ?? null)
}

export function kindOf(run: Run, tool: string): ToolKind {
  return toolKind(tool, run.toolKinds)
}

export function who(run: Run, threadId: string): string {
  return threadName(run, threadId)
}

/** Threads that were delegated to or created: what "a child thread" means across formats. */
export function childThreads(run: Run): string[] {
  const ids = new Set<string>()
  for (const e of run.events) {
    if (e.kind === 'thread_created' && e.threadId !== run.primaryThreadId) ids.add(e.threadId)
    if (e.kind === 'delegation' && e.to && e.to !== run.primaryThreadId) ids.add(e.to)
  }
  return [...ids]
}

/** The event that stands for a thread's start: its creation, else the first delegation to it. */
export function startOf(run: Run, threadId: string): Event | undefined {
  return (
    run.events.find((e) => e.kind === 'thread_created' && e.threadId === threadId) ??
    run.events.find((e) => e.kind === 'delegation' && e.to === threadId)
  )
}

export function describeCall(call: Event): string {
  const args = call.args === undefined ? '' : ` ${excerpt(JSON.stringify(call.args), 90)}`
  return `${call.tool ?? 'tool'}${args}`
}

export function finding(
  ruleId: string,
  checkId: CheckId,
  severity: Severity,
  eventIds: string[],
  message: string,
  whyItMatters: string,
  suggestion: string
): Finding {
  return { ruleId, checkId, severity, eventIds, message, whyItMatters, suggestion }
}

export { excerpt }
