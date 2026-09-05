import type { Event, Run } from '../model/trace.js'
import { toolCalls } from './util.js'

export function noArgs(run: Run): string | null {
  return toolCalls(run).some((c) => c.args !== undefined)
    ? null
    : 'No tool arguments recorded in this trace; the duplicate-work rules compare arguments.'
}

/**
 * Pairs of calls, earlier first, with the same tool and deep-equal arguments.
 * Each call pairs with its most recent identical predecessor only, so five
 * repeats are four findings, not ten.
 */
export function duplicatePairs(run: Run): Array<[Event, Event]> {
  const calls = toolCalls(run).filter((c) => c.args !== undefined)
  const pairs: Array<[Event, Event]> = []
  const last = new Map<string, Event>()
  for (const b of calls) {
    const key = `${b.tool}:${JSON.stringify(sortKeys(b.args))}`
    const a = last.get(key)
    if (a) pairs.push([a, b])
    last.set(key, b)
  }
  return pairs
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortKeys)
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(value as Record<string, unknown>).sort()) out[k] = sortKeys((value as Record<string, unknown>)[k])
  return out
}

/** A later call in the parent thread that repeats a child's call after the child reported back. */
export function isAfterReport(run: Run, a: Event, b: Event): boolean {
  if (a.threadId === b.threadId) return false
  return run.events.some((e) => e.kind === 'report' && e.from === a.threadId && e.index > a.index && e.index < b.index && e.threadId === b.threadId)
}
