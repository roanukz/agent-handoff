/**
 * Text and argument helpers the rules share. Pure functions, no state.
 *
 * The extractors are deliberately literal: an identifier is a code with a
 * dash and digits or a URL, an amount is a currency figure, a quantity is a
 * count followed by a noun. Anything cleverer would need a model, and the
 * product is that it does not.
 */

const STOP = new Set(
  `a an the and or of to for in on at by with from as is are was were be been
  it its this that these those there here into onto over under per each every
  any all some more most less than then so if not no yes we you i he she they
  them our your their his her who what which when where how why do does did
  done has have had will would should could can may might must shall about
  after before again also just only very such via etc am pm inch inches gb mb
  tb ghz mhz percent pct usd dollars dollar cents hour hours minute minutes
  second seconds day days week weeks month months year years step steps
  characters tokens words lines items item unit units pieces piece`.split(/\s+/)
)

/** Nouns a count can attach to that are units of time, size or money, not things. */
const UNIT_NOUNS = new Set(
  `inch inches gb mb tb ghz mhz percent pct usd dollars dollar cents hour hours
  minute minutes second seconds day days week weeks month months year years
  am pm characters tokens words lines`.split(/\s+/)
)

export type ConstraintKind = 'identifier' | 'amount' | 'quantity' | 'cap' | 'negation'

export interface Constraint {
  kind: ConstraintKind
  /** Normalized value: digits for numbers, the literal for identifiers. */
  value: string
  /** The words as they appeared, for the explanation. */
  text: string
  /** Words near the constraint that say what it is about, lowercased. */
  topics: string[]
  /** negation only: the things the sentence says not to use. */
  objects?: string[]
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value as Record<string, unknown>).sort()
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(',')}}`
}

export function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}

export function normalizeNumber(text: string): string {
  return text.replace(/[$,\s]/g, '').replace(/^USD/i, '').replace(/\.0+$/, '')
}

export function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z][a-z0-9-]*/g) ?? []
}

function topicsAround(text: string, start: number, end: number, window = 4): string[] {
  const before = words(text.slice(Math.max(0, start - 60), start)).slice(-window)
  const after = words(text.slice(end, end + 40)).slice(0, 2)
  return [...before, ...after].filter((w) => w.length > 2 && !STOP.has(w))
}

const MONEY_WORDS = new Set(['total', 'amount', 'price', 'cost', 'budget', 'sum', 'fee', 'unit', 'subtotal', 'value', 'cap', 'limit', 'threshold'])
const IDENTIFIER = /\b[A-Z]{2,8}-\d{2,}[A-Z0-9-]*\b/g
const URL = /https?:\/\/[^\s)\]'">,]+/g
const AMOUNT = /(?:\$|USD\s?)\s?(\d[\d,]*(?:\.\d+)?)\b/g
const QUANTITY = /(?<![\d,.])(\d{1,6})\s*(?:x\s*)?([A-Za-z][A-Za-z-]{2,}(?:\s[a-z][a-z-]{2,}){0,2}|[A-Z]{2,8}-\d{2,}[A-Z0-9-]*)\b/g
const QTY_LABEL = /\b(?:quantity|qty|count|units?)\s*(?:of|:|=)?\s*(\d{1,6})\b/gi
const CAP =
  /\b(under|below|at most|no more than|not more than|up to|maximum of|maximum|max|limit(?:ed)? to|within|not (?:to )?exceed(?:ing)?|over|above|at least|minimum of|minimum)[ \t]+(?:\$[ \t]?)?(\d[\d,]*(?:\.\d+)?)\b/gi
const NEGATION_CUE =
  /\b(do not|don't|never|avoid|must not|mustn't|should not|shouldn't|exclude|excluding|without using|not to use|not use|no longer|refrain from|other than)\b/i
const PROPER_NAME = /\b[A-Z][a-z]+(?: [A-Z][a-z]+)+\b/g
const QUOTED = /"([^"]{2,60})"|'([^']{2,60})'/g

export function extractIdentifiers(text: string): string[] {
  const found = new Set<string>()
  for (const m of text.matchAll(IDENTIFIER)) found.add(m[0])
  for (const m of text.matchAll(URL)) found.add(m[0].replace(/[.:;]+$/, ''))
  return [...found]
}

/**
 * What counts as a constraint depends on who said it. An instruction (the
 * request, a delegation) can carry any kind. A report carries outputs, and
 * only its identifiers and currency figures are read as constraints: a web
 * surfer's URLs and a price list's counts are data, not requirements.
 */
export type ConstraintScope = 'instruction' | 'report'

export function extractConstraints(text: string, scope: ConstraintScope = 'instruction'): Constraint[] {
  const out: Constraint[] = []
  const seen = new Set<string>()
  const push = (c: Constraint) => {
    const key = `${c.kind}:${c.value}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(c)
  }
  for (const m of text.matchAll(IDENTIFIER)) {
    push({ kind: 'identifier', value: m[0], text: m[0], topics: topicsAround(text, m.index, m.index + m[0].length) })
  }
  for (const m of text.matchAll(URL)) {
    if (scope === 'report') break
    const v = m[0].replace(/[.:;]+$/, '')
    push({ kind: 'identifier', value: v, text: v, topics: topicsAround(text, m.index, m.index + m[0].length) })
  }
  for (const m of text.matchAll(CAP)) {
    if (scope === 'report') break
    push({
      kind: 'cap',
      value: normalizeNumber(m[2]!),
      text: m[0],
      topics: [m[1]!.toLowerCase(), ...topicsAround(text, m.index, m.index + m[0].length)]
    })
  }
  for (const m of text.matchAll(AMOUNT)) {
    const value = normalizeNumber(m[1]!)
    // A figure that is a cap ("under $12,000") is reported once, as the cap.
    if (seen.has(`cap:${value}`)) continue
    const topics = topicsAround(text, m.index, m.index + m[0].length)
    // A report's figure is a constraint only when the report calls it one:
    // a total or a price, not a number that happened to be on a web page.
    if (scope === 'report' && !topics.some((t) => MONEY_WORDS.has(t))) continue
    push({ kind: 'amount', value, text: m[0].trim(), topics })
  }
  for (const m of text.matchAll(QUANTITY)) {
    if (scope === 'report') break
    const noun = m[2]!
    const lower = noun.toLowerCase()
    if (UNIT_NOUNS.has(lower) || STOP.has(lower)) continue
    // A number followed by a code ("8x CAT-1001") is a quantity of that item.
    const isCode = /^[A-Z]{2,8}-\d/.test(noun)
    if (!isCode && !/^[a-z]/.test(noun)) continue
    // "8 laptops for the" reads badly; the phrase ends at the last content word.
    const phrase = noun.split(/\s+/)
    while (phrase.length > 1 && STOP.has(phrase[phrase.length - 1]!.toLowerCase())) phrase.pop()
    push({ kind: 'quantity', value: m[1]!, text: `${m[1]} ${phrase.join(' ')}`, topics: [isCode ? noun : singular(lower.split(/\s/)[0]!)] })
  }
  for (const m of text.matchAll(QTY_LABEL)) {
    if (scope === 'report') break
    push({ kind: 'quantity', value: m[1]!, text: m[0], topics: ['quantity', ...topicsAround(text, m.index, m.index + m[0].length)] })
  }
  for (const sentence of sentences(text)) {
    if (scope === 'report') break
    const cue = sentence.match(NEGATION_CUE)
    if (!cue) continue
    const objects = new Set<string>()
    for (const id of extractIdentifiers(sentence)) objects.add(id)
    for (const q of sentence.matchAll(QUOTED)) objects.add((q[1] ?? q[2])!)
    for (const n of sentence.matchAll(PROPER_NAME)) objects.add(n[0])
    if (objects.size === 0) continue
    push({
      kind: 'negation',
      value: [...objects].join('|'),
      text: sentence.trim().slice(0, 160),
      topics: words(sentence).filter((w) => w.length > 2 && !STOP.has(w)),
      objects: [...objects]
    })
  }
  return out
}

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function singular(noun: string): string {
  if (noun.endsWith('ies')) return `${noun.slice(0, -3)}y`
  if (noun.endsWith('ses') || noun.endsWith('xes') || noun.endsWith('ches') || noun.endsWith('shes')) return noun.slice(0, -2)
  if (noun.endsWith('s') && !noun.endsWith('ss')) return noun.slice(0, -1)
  return noun
}

/** Does the text or serialized arguments carry this value? */
export function carries(text: string, c: Pick<Constraint, 'kind' | 'value'>): boolean {
  if (c.kind === 'identifier') return text.toLowerCase().includes(c.value.toLowerCase())
  if (c.kind === 'negation') return false
  const flat = text.replace(/,(?=\d{3}\b)/g, '')
  const n = c.value.replace(/^0+(?=\d)/, '')
  return new RegExp(`(?<![\\d.])${escapeRegExp(n)}(?!\\d|\\.\\d)`).test(flat)
}

/** Does the text talk about the same thing the constraint is about? */
export function mentionsTopic(text: string, c: Constraint): boolean {
  const ws = new Set(words(text).map(singular))
  if (c.kind === 'identifier') {
    // The family of a code says what it is: SUP- is a supplier, CAT- an item.
    // Neighbors in the sentence are not used for codes; they name other things.
    const family = c.value.match(/^([A-Z]{2,8})-/)?.[1]?.toLowerCase()
    if (family) return [...ws].some((w) => w.startsWith(family))
  }
  return c.topics.some((t) => ws.has(singular(t)))
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const READ_HINT = /(lookup|look_up|search|find|get|fetch|read|list|check|query|policy|status|view|describe|inspect|browse|retrieve)/i
const WRITE_HINT = /(create|draft|update|write|set|delete|remove|submit|send|post|escalate|route|approve|reject|execute|run|apply|save|edit|patch|insert)/i

export type ToolKind = 'read' | 'write' | 'unknown'

export function toolKind(name: string, overrides?: Record<string, 'read' | 'write'>): ToolKind {
  if (overrides?.[name]) return overrides[name]!
  if (WRITE_HINT.test(name)) return 'write'
  if (READ_HINT.test(name)) return 'read'
  return 'unknown'
}

/** Short excerpt for a message, single line. */
export function excerpt(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`
}

/** Phrases in a delegation that name a tool, by tool name or by capability phrase. */
export function toolsNamedIn(text: string, tools: string[], capabilities?: Record<string, string[]>): string[] {
  const lower = text.toLowerCase()
  const out = new Set<string>()
  for (const tool of tools) {
    const spaced = tool.replace(/[_-]+/g, ' ').toLowerCase()
    if (lower.includes(tool.toLowerCase()) || lower.includes(spaced)) out.add(tool)
    for (const phrase of capabilities?.[tool] ?? []) {
      if (lower.includes(phrase.toLowerCase())) out.add(tool)
    }
  }
  return [...out]
}
