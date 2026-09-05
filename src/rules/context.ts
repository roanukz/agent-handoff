/**
 * Shared machinery for the context-carried rules: what counts as upstream of
 * a delegation, and how a constraint is checked against the message that
 * crossed the handoff and the first call that should have carried it.
 */

import { eventsIn, type Event, type Run } from '../model/trace.js'
import { carries, extractConstraints, mentionsTopic, sentences, type Constraint } from '../engine/text.js'

const IDENTIFIER_IN_ARGS = /[A-Z]{2,8}-\d{2,}|https?:\/\//

/**
 * Events the sender of a delegation had read before sending it: the request,
 * tasks given to it, and the latest report it received. Only the latest
 * report, because a coordinator twenty steps in is summarizing the last thing
 * it heard, not everything it ever heard.
 */
export function upstreamOf(run: Run, d: Event): Event[] {
  const instructions = run.events.filter(
    (e) =>
      e.index < d.index &&
      ((e.kind === 'user_message' && e.threadId === d.threadId) || (e.kind === 'delegation' && e.to === d.threadId))
  )
  const lastReport = [...run.events].reverse().find((e) => e.kind === 'report' && e.threadId === d.threadId && e.index < d.index)
  return lastReport ? [...instructions, lastReport].sort((a, b) => a.index - b.index) : instructions
}

/**
 * A report-sourced constraint is cc-report-dropped's case when the delegation
 * carries another identifier from the same report: the two rules would
 * otherwise charge one omission twice.
 */
export function anchoredElsewhere(source: Event, d: Event): boolean {
  if (source.kind !== 'report') return false
  const ids = extractConstraints(source.content ?? '').filter((c) => c.kind === 'identifier')
  return ids.some((c) => carries(d.content ?? '', c))
}

export function constraintsOf(events: Event[]): Array<{ source: Event; constraint: Constraint }> {
  const out: Array<{ source: Event; constraint: Constraint }> = []
  const seen = new Set<string>()
  for (const source of events) {
    for (const constraint of extractConstraints(source.content ?? '', source.kind === 'report' ? 'report' : 'instruction')) {
      const key = `${constraint.kind}:${constraint.value}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ source, constraint })
    }
  }
  return out
}

/**
 * The first tool call in the receiving thread, after the delegation, whose
 * arguments are about the constraint AND carry a value of its kind. A catalog
 * lookup has no number in it, so it is not the call that should carry "8".
 */
export function firstRelevantCall(run: Run, d: Event, c: Constraint): Event | undefined {
  if (!d.to) return undefined
  return eventsIn(run, d.to).find((e) => {
    if (e.kind !== 'tool_call' || e.index <= d.index || e.args === undefined) return false
    const json = JSON.stringify(e.args)
    if (!mentionsTopic(json, c)) return false
    if (c.kind === 'identifier') return IDENTIFIER_IN_ARGS.test(json)
    const stripped = json.replace(/[A-Z]{2,8}-\d{2,}[A-Z0-9-]*/g, '')
    return /\d/.test(stripped)
  })
}

/**
 * "Change the quantity from 6 to 7": the delegation carries 6 and the call
 * should carry 7. The value the downstream call is expected to hold.
 */
export function expectedInCall(d: Event, c: Constraint): string {
  for (const m of (d.content ?? '').matchAll(/from\s+\$?(\d[\d,]*)\s+to\s+\$?(\d[\d,]*)/gi)) {
    if (m[1]!.replace(/,/g, '') === c.value) return m[2]!.replace(/,/g, '')
  }
  return c.value
}

export function delegationCarries(d: Event, c: Constraint): boolean {
  return carries(d.content ?? '', c)
}

export function delegationIsAbout(d: Event, c: Constraint): boolean {
  return mentionsTopic(d.content ?? '', c)
}

/** Sentences of a text that carry the value, for the flipped-negation check. */
export function sentencesCarrying(text: string, value: string): string[] {
  return sentences(text).filter((s) => s.toLowerCase().includes(value.toLowerCase()))
}

export function noDelegations(run: Run): string | null {
  return run.events.some((e) => e.kind === 'delegation') ? null : 'No delegation between threads in this trace; the context-carried rules compare a delegation to what came before it.'
}
