import { describe, expect, it } from 'vitest'
import { analyze } from '../src/engine/analyze.js'
import { loadCorpus } from '../src/cli/load.js'
import { CHECK_DEFS } from '../src/engine/checks.js'

/**
 * Every trace from agent-submit and its Managed Agents variant parses and
 * scores without error. Success criterion 2 of the PRD.
 */
describe('the agent-submit corpus', () => {
  const runs = loadCorpus()

  it('has 112 Managed Agents runs and 9 SDK runs', () => {
    expect(runs.filter((r) => r.format === 'managed').length).toBe(112)
    expect(runs.filter((r) => r.format === 'sdk').length).toBe(9)
  })

  it('scores every run with five checks and cites only events that exist', () => {
    for (const run of runs) {
      const report = analyze(run)
      expect(report.checks.length).toBe(CHECK_DEFS.length)
      expect(report.overall).toBeGreaterThanOrEqual(0)
      expect(report.overall).toBeLessThanOrEqual(100)
      const ids = new Set(run.events.map((e) => e.id))
      for (const f of report.issues) for (const id of f.eventIds) expect(ids.has(id), `${run.id} ${f.ruleId} ${id}`).toBe(true)
    }
  })

  it('gives every coordinator run its threads, each named and carrying its declared tools', () => {
    const multi = runs.filter((r) => r.id.endsWith('-coordinator'))
    expect(multi.length).toBe(15)
    // The coordinator did not always delegate to both agents; the variant's
    // escalation table counts one to three threads per case.
    for (const run of multi) {
      expect(run.threads.length).toBeGreaterThanOrEqual(1)
      expect(run.threads.length).toBeLessThanOrEqual(3)
      expect(run.threads.every((t) => t.agentName && t.tools !== undefined)).toBe(true)
    }
    expect(multi.filter((r) => r.threads.length === 3).length).toBeGreaterThan(0)
  })

  it('treats the SDK runs as a control: cross-thread rules are silent with a reason', () => {
    for (const run of runs.filter((r) => r.format === 'sdk')) {
      const report = analyze(run)
      const silent = new Set(report.silent.map((s) => s.ruleId))
      for (const id of ['cc-numeric-dropped', 'term-orphan-thread', 'route-tool-not-held']) expect(silent.has(id), `${run.id} ${id}`).toBe(true)
      // The permission rules run wherever a decision was recorded; a session with no call has none.
      const anyCall = run.events.some((e) => e.kind === 'tool_call')
      expect(silent.has('perm-escalation-bypassed'), run.id).toBe(!anyCall)
    }
  })
})
