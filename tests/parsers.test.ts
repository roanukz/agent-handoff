import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { detectFormat, loadRun, parseManaged, parseRoster, parseSdk, parseWhoWhen } from '../src/parsers/index.js'
import type { WhoWhenRecord } from '../src/parsers/whowhen.js'
import { analyze } from '../src/engine/analyze.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CORPUS = join(ROOT, 'fixtures', 'agent-submit')

function dirFiles(dir: string) {
  return readdirSync(dir).map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }))
}

const roster = parseRoster(readFileSync(join(CORPUS, 'roster.json'), 'utf8'))

describe('managed parser', () => {
  const dir = join(CORPUS, 'managed', 'tc-01-coordinator')
  const multi = JSON.parse(readFileSync(join(CORPUS, 'managed-results', 'results-multi.json'), 'utf8')) as {
    results: Array<{ caseId: string; decisions: Array<{ tool: string; tier: string; decision: 'allow' | 'deny' | 'ask' | 'defer'; afterBuyer?: 'allow' | 'deny'; threadId: string | null }> }>
  }
  const decisions = multi.results.find((r) => r.caseId === 'tc-01')!.decisions
  const run = parseManaged(dirFiles(dir), { id: 'tc-01-coordinator', roster, decisions })

  it('finds the coordinator and two child threads, named from the stream', () => {
    expect(run.threads.length).toBe(3)
    expect(run.threads.find((t) => t.id === run.primaryThreadId)?.agentName).toBe('agent-submit coordinator')
    expect(run.threads.map((t) => t.agentName).sort()).toEqual(['agent-submit coordinator', 'agent-submit drafter', 'agent-submit supplier checker'])
  })

  it('turns thread messages into delegations and reports on the primary thread, once each', () => {
    const delegations = run.events.filter((e) => e.kind === 'delegation')
    const reports = run.events.filter((e) => e.kind === 'report')
    expect(delegations.length).toBe(2)
    expect(reports.length).toBe(2)
    for (const d of delegations) expect(d.threadId).toBe(run.primaryThreadId)
    for (const r of reports) expect(r.threadId).toBe(run.primaryThreadId)
  })

  it('puts child tool calls in the child thread with arguments and results', () => {
    const calls = run.events.filter((e) => e.kind === 'tool_call')
    expect(calls.length).toBe(4)
    for (const c of calls) {
      expect(c.threadId).not.toBe(run.primaryThreadId)
      expect(c.args).toBeDefined()
      expect(run.events.some((r) => r.kind === 'tool_result' && r.toolCallId === c.id)).toBe(true)
    }
    const draft = calls.find((c) => c.tool === 'draft_requisition')!
    expect(draft.decision).toEqual({ tier: 'C', decision: 'defer', afterBuyer: 'allow' })
  })

  it('attaches declared tools from the roster', () => {
    expect(run.threads.find((t) => t.agentName === 'agent-submit supplier checker')?.tools).toEqual(['supplier_check', 'escalate_to_buyer'])
  })

  it('keeps event order by processed_at and indexes it', () => {
    run.events.forEach((e, i) => expect(e.index).toBe(i))
    const stamped = run.events.filter((e) => e.ts)
    for (let i = 1; i < stamped.length; i++) expect(stamped[i]!.ts! >= stamped[i - 1]!.ts!).toBe(true)
  })

  it('reads a single-agent run with the primary stream alone', () => {
    const single = parseManaged(dirFiles(join(CORPUS, 'managed', 'db-01')), { roster })
    expect(single.threads.length).toBe(1)
    expect(single.events.some((e) => e.kind === 'user_message')).toBe(true)
    expect(single.events.filter((e) => e.kind === 'tool_call').length).toBeGreaterThan(0)
  })

  it('reads a deny out of an error result when no sidecar is given', () => {
    const run = parseManaged(dirFiles(join(CORPUS, 'managed', 'dr-02')))
    const denied = run.events.filter((e) => e.kind === 'tool_call' && e.decision?.decision === 'deny')
    expect(denied.length).toBeGreaterThan(0)
    expect(run.notes?.some((n) => /No decision sidecar/.test(n))).toBe(true)
  })
})

describe('sdk parser', () => {
  const dir = join(CORPUS, 'sdk', 'dr-01')
  const run = parseSdk({
    decisions: readFileSync(join(dir, 'decisions.json'), 'utf8'),
    trail: readFileSync(join(dir, 'trail.jsonl'), 'utf8'),
    case: readFileSync(join(dir, 'case.json'), 'utf8')
  })

  it('is one thread with the prompt, the calls in order, and the final answer', () => {
    expect(run.threads.length).toBe(1)
    expect(run.events[0]!.kind).toBe('user_message')
    expect(run.events.filter((e) => e.kind === 'tool_call').map((e) => e.tool)).toEqual([
      'threshold_policy', 'catalog_lookup', 'supplier_check', 'draft_requisition', 'escalate_to_buyer'
    ])
    expect(run.events.at(-2)!.kind).toBe('message')
    expect(run.events.at(-1)!.kind).toBe('session_end')
  })

  it('folds the trail into the decision: deferred, then approved', () => {
    const draft = run.events.find((e) => e.kind === 'tool_call' && e.tool === 'draft_requisition')!
    expect(draft.decision?.tier).toBe('C')
    expect(draft.decision?.decision).toBe('defer')
    expect(draft.decision?.afterBuyer).toBe('allow')
    expect(draft.args).toBeDefined()
    const read = run.events.find((e) => e.kind === 'tool_call' && e.tool === 'catalog_lookup')!
    expect(read.args).toBeUndefined()
  })
})

describe('whowhen parser', () => {
  it('maps a hand-crafted log to orchestrator delegations and agent reports, one step one event', () => {
    const record = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'whowhen-handcrafted.json'), 'utf8')) as WhoWhenRecord
    const run = parseWhoWhen(record, 'hc')
    expect(run.primaryThreadId).toBe('orchestrator')
    expect(run.events.filter((e) => e.kind === 'delegation').length).toBe(2)
    expect(run.events.filter((e) => e.kind === 'report').length).toBe(2)
    expect(run.events.find((e) => e.id === 'step-6-call')?.tool).toBe('clicked')
    expect(run.labels).toEqual({ failingStep: 5, failingAgent: 'Orchestrator', reason: record.mistake_reason, failingEventId: 'step-5' })
    expect(run.events.find((e) => e.id === 'step-5')?.kind).toBe('delegation')
    const report = analyze(run)
    expect(report.issues.some((f) => f.ruleId === 'route-target-lacks-tool' && f.eventIds.includes('step-5'))).toBe(true)
    expect(report.issues.some((f) => f.ruleId === 'cc-identifier-dropped' && f.eventIds.includes('step-5'))).toBe(true)
  })

  it('maps a generated group chat to per-agent threads with code as tool calls', () => {
    const record = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'whowhen-generated.json'), 'utf8')) as WhoWhenRecord
    const run = parseWhoWhen(record, 'ag')
    expect(run.events[0]!.kind).toBe('user_message')
    const calls = run.events.filter((e) => e.kind === 'tool_call')
    expect(calls.length).toBe(2)
    expect(calls.map((c) => c.threadId)).toEqual(['data-expert', 'verification-expert'])
    const results = run.events.filter((e) => e.kind === 'tool_result')
    expect(results.map((r) => r.toolCallId)).toEqual(['step-1-call', 'step-3-call'])
    const report = analyze(run)
    expect(report.issues.some((f) => f.ruleId === 'dup-cross-thread' && f.eventIds.includes('step-3-call'))).toBe(true)
  })
})

describe('format detection and the shared loader', () => {
  it('detects each format from file names and shapes', () => {
    expect(detectFormat(dirFiles(join(CORPUS, 'sdk', 'dr-01')))).toBe('sdk')
    expect(detectFormat(dirFiles(join(CORPUS, 'managed', 'db-01')))).toBe('managed')
    expect(detectFormat([{ name: 'x.json', text: readFileSync(join(ROOT, 'tests', 'fixtures', 'whowhen-generated.json'), 'utf8') }])).toBe('whowhen')
    expect(detectFormat([{ name: 'x.json', text: readFileSync(join(ROOT, 'fixtures', 'fires', 'term-orphan-thread.json'), 'utf8') }])).toBe('run')
  })

  it('loads through one entry point with a roster', () => {
    const run = loadRun(dirFiles(join(CORPUS, 'managed', 'hp-04-coordinator')), { roster })
    expect(run.format).toBe('managed')
    expect(run.threads.some((t) => t.tools?.length)).toBe(true)
  })
})
