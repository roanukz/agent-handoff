import type { Event, Run } from '../model/trace.js'
import { extractIdentifiers } from '../engine/text.js'
import { argsKey, toolCalls } from './util.js'

export function noDecisions(run: Run): string | null {
  const any = run.events.some((e) => e.decision) || run.events.some((e) => e.kind === 'tool_result' && e.result?.isError)
  return any ? null : 'No permission decisions recorded in this trace; the permission rules compare decisions across calls.'
}

export function wasEscalated(c: Event): boolean {
  return c.decision?.decision === 'ask' || c.decision?.decision === 'defer'
}

export function wasDenied(run: Run, c: Event): boolean {
  if (c.decision?.decision === 'deny' || c.decision?.afterBuyer === 'deny') return true
  const r = run.events.find((e) => e.kind === 'tool_result' && e.toolCallId === c.id)
  return !!r?.result?.isError && /reject|denied|deny|not allowed|refus|blocked/i.test(r.result.content)
}

export function wasApproved(c: Event): boolean {
  return wasEscalated(c) && c.decision?.afterBuyer === 'allow'
}

/**
 * Same arguments, or the same shape carrying the same identifiers and numbers.
 * A shared draft id alone is not the same work: every update names its draft.
 */
export function sameWork(a: Event, b: Event): boolean {
  if (a.args === undefined || b.args === undefined) return false
  if (argsKey(a) === argsKey(b)) return true
  const ja = JSON.stringify(a.args)
  const jb = JSON.stringify(b.args)
  if (keysOf(a.args) !== keysOf(b.args)) return false
  const ida = extractIdentifiers(ja)
  const idb = new Set(extractIdentifiers(jb))
  if (ida.length === 0 || !ida.every((x) => idb.has(x))) return false
  const strip = (s: string) => extractIdentifiers(s).reduce((acc, id) => acc.split(id).join(' '), s)
  const numbers = (s: string) => new Set(strip(s).match(/\d+(?:\.\d+)?/g) ?? [])
  const nb = numbers(jb)
  return [...numbers(ja)].every((n) => nb.has(n))
}

function keysOf(value: unknown): string {
  if (value === null || typeof value !== 'object') return typeof value
  if (Array.isArray(value)) return `[${value.map(keysOf).join(',')}]`
  return `{${Object.keys(value as Record<string, unknown>).sort().join(',')}}`
}

export function sharesIdentifier(a: Event, b: Event): boolean {
  const ida = extractIdentifiers(JSON.stringify(a.args ?? ''))
  const idb = new Set(extractIdentifiers(JSON.stringify(b.args ?? '')))
  return ida.some((x) => idb.has(x))
}

export function laterCalls(run: Run, c: Event): Event[] {
  return toolCalls(run).filter((x) => x.index > c.index)
}
