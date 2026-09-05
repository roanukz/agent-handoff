import { describe, expect, it } from 'vitest'
import { bandFor, buildReport, CHECK_FLOOR, checkStatus, deductionFor, PER_RULE_CAP } from '../src/engine/score.js'
import { CHECK_DEFS } from '../src/engine/checks.js'
import type { Finding } from '../src/engine/types.js'
import { parseRunInput } from '../src/parsers/run-json.js'

const run = parseRunInput({
  id: 'score',
  threads: [{ id: 't0', agentName: 'c', parentId: null }],
  events: Array.from({ length: 12 }, (_, i) => ({ id: `e${i}`, threadId: 't0', kind: 'message' as const, content: String(i) }))
})

const f = (ruleId: string, checkId: Finding['checkId'], severity: Finding['severity'], ...eventIds: string[]): Finding => ({
  ruleId,
  checkId,
  severity,
  eventIds,
  message: 'm',
  whyItMatters: 'w',
  suggestion: 's'
})

describe('scoring', () => {
  it('weights sum to one', () => {
    expect(CHECK_DEFS.reduce((n, c) => n + c.weight, 0)).toBeCloseTo(1)
  })

  it('deducts 25 per major and 10 per minor, floors at 0', () => {
    expect(deductionFor('major')).toBe(25)
    expect(deductionFor('minor')).toBe(10)
    expect(deductionFor('info')).toBe(0)
    const r = buildReport(run, [f('a', 'routing', 'major', 'e1'), f('b', 'routing', 'minor', 'e2')])
    expect(r.checks.find((c) => c.def.id === 'routing')!.score).toBe(65)
  })

  it('counts only the first three findings of one rule', () => {
    const many = Array.from({ length: 6 }, (_, i) => f('same', 'termination', 'major', `e${i}`))
    const r = buildReport(run, many)
    const check = r.checks.find((c) => c.def.id === 'termination')!
    expect(check.score).toBe(25)
    expect(check.findings.filter((x) => x.counted).length).toBe(PER_RULE_CAP)
  })

  it('bands on the unrounded composite and never certifies a run with a check below the floor', () => {
    expect(checkStatus(85)).toBe('pass')
    expect(checkStatus(60)).toBe('needs-work')
    expect(checkStatus(59)).toBe('fail')
    expect(bandFor(84.75)).toBe('needs-attention')
    expect(bandFor(85, CHECK_FLOOR - 1)).toBe('needs-attention')
    expect(bandFor(85, CHECK_FLOOR)).toBe('handed-off')
    expect(bandFor(59)).toBe('broke')
  })

  it('a clean run scores 100 and lists no silent rules unless told', () => {
    const r = buildReport(run, [])
    expect(r.overall).toBe(100)
    expect(r.band).toBe('handed-off')
    expect(r.silent).toEqual([])
  })

  it('orders findings by the first event they cite', () => {
    const r = buildReport(run, [f('b', 'routing', 'minor', 'e9', 'e2'), f('a', 'routing', 'minor', 'e5')])
    expect(r.issues.map((x) => x.ruleId)).toEqual(['b', 'a'])
  })
})
