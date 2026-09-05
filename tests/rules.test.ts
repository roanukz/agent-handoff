import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { analyze } from '../src/engine/analyze.js'
import { parseRunInput } from '../src/parsers/run-json.js'
import { ALL_RULES, RULE_IDS } from '../src/rules/index.js'
import type { RunInput } from '../src/model/trace.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function fixture(kind: 'fires' | 'quiet', id: string) {
  const raw = JSON.parse(readFileSync(join(ROOT, 'fixtures', kind, `${id}.json`), 'utf8')) as RunInput & { synthetic?: boolean }
  return { raw, run: parseRunInput(raw) }
}

describe('rule catalog', () => {
  it('has at least 15 rules across all five checks', () => {
    expect(ALL_RULES.length).toBeGreaterThanOrEqual(15)
    const checks = new Set(ALL_RULES.map((r) => r.checkId))
    expect([...checks].sort()).toEqual(['context-carried', 'no-duplicate-work', 'permission-continuity', 'routing', 'termination'])
  })

  it('has unique ids and a fixture pair for every rule, and nothing else in the fixture folders', () => {
    expect(new Set(RULE_IDS).size).toBe(RULE_IDS.length)
    for (const kind of ['fires', 'quiet'] as const) {
      const files = readdirSync(join(ROOT, 'fixtures', kind)).map((f) => f.replace(/\.json$/, '')).sort()
      expect(files).toEqual([...RULE_IDS].sort())
    }
  })
})

for (const rule of ALL_RULES) {
  describe(rule.id, () => {
    it('fires on its fixture and cites events that exist', () => {
      const { raw, run } = fixture('fires', rule.id)
      expect(raw.synthetic).toBe(true)
      expect(rule.requires?.(run) ?? null).toBeNull()
      const findings = rule.run(run)
      expect(findings.length).toBeGreaterThan(0)
      const ids = new Set(run.events.map((e) => e.id))
      for (const f of findings) {
        expect(f.ruleId).toBe(rule.id)
        expect(f.checkId).toBe(rule.checkId)
        expect(f.eventIds.length).toBeGreaterThan(0)
        for (const id of f.eventIds) expect(ids.has(id), `${rule.id} cites ${id}`).toBe(true)
        expect(f.message.length).toBeGreaterThan(10)
        expect(f.whyItMatters.length).toBeGreaterThan(10)
        expect(f.suggestion.length).toBeGreaterThan(10)
      }
      // The full analysis carries the same findings; nothing dedupes them away.
      const report = analyze(run)
      expect(report.issues.some((f) => f.ruleId === rule.id)).toBe(true)
    })

    it('is quiet on its near miss, and actually ran', () => {
      const { raw, run } = fixture('quiet', rule.id)
      expect(raw.synthetic).toBe(true)
      expect(rule.requires?.(run) ?? null).toBeNull()
      expect(rule.run(run)).toEqual([])
    })
  })
}

describe('comparisons cite at least two events', () => {
  const single = new Set(['term-terminated-without-reason'])
  for (const rule of ALL_RULES) {
    if (single.has(rule.id)) continue
    it(rule.id, () => {
      const { run } = fixture('fires', rule.id)
      for (const f of rule.run(run)) expect(f.eventIds.length).toBeGreaterThanOrEqual(2)
    })
  }
})
