/**
 * calibrate: run every rule over the Who&When labeled set and report, per
 * rule, how often it fires on the labeled failing step (true positive),
 * elsewhere (false positive), and stays silent on a labeled failure of its
 * kind (false negative).
 *
 * The labels mark the failing step and agent, not the failure kind. Recall
 * per rule is therefore measured against a keyword mapping from the label's
 * free-text reason to a check, and that mapping is published with the
 * numbers. A record whose reason maps to no check counts toward precision
 * only.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { analyze } from '../engine/analyze.js'
import { CHECK_DEFS } from '../engine/checks.js'
import type { CheckId } from '../engine/types.js'
import { parseWhoWhen, type WhoWhenRecord } from '../parsers/whowhen.js'
import { ALL_RULES } from '../rules/index.js'
import { ROOT } from './load.js'
import { plain } from './format.js'

const DATA = process.argv[2] ?? join(ROOT, 'data', 'whowhen')

/** Which check a labeled reason describes. Published in the teardown as the mapping recall is measured against. */
export const REASON_MAP: Record<CheckId, RegExp> = {
  'context-carried':
    /ignor|overlook|forg[eo]t|omit|dropp?|miss(?:ed|es|ing)? (?:the |a |an )?(?:constraint|requirement|detail|instruction|condition|criteri|specif)|(?:did not|didn't|does not|doesn't|not) (?:include|consider|follow|account for|pass|use the (?:provided|given)|take into account)|criteri|constraint|requirement|misunderst|misinterpret|incorrect(?:ly)? (?:interpret|assum|understood)|wrong (?:assumption|parameter|input|value|keyword|query|search term)|keyword|search term|hallucinat|fabricat|made up|assum(?:ed|es|ing) (?:that|the|a)/i,
  'no-duplicate-work': /repeat|again|redundant|same (?:search|query|action|code|request|step|page)|loop|duplicate|re-?run|once more|stuck/i,
  routing:
    /wrong (?:agent|tool|expert|direction|website|source)|should (?:have )?(?:use|ask|delegat|instruct|call|assign|let|refer|visit)|delegat|instruct|navigat\w* the agents|third-party|instead|inappropriate|irrelevant (?:website|page|tool|link|source)|not (?:the )?(?:right|appropriate|correct) (?:agent|tool|expert|website|source)|(?:tool|function|website|search) (?:it|that|does|doesn't|cannot|can't|is not)|rel(?:y|ies|ied|ys) on/i,
  termination:
    /terminat|stop(?:ped|s)? (?:early|prematurely|before)|prematur|(?:did not|didn't|does not|doesn't) (?:report|return|finish|complete|verify|check|continue|wait|retrieve|extract|provide|find|actually)|gave up|incomplete|not (?:yet )?(?:been )?(?:fully )?(?:complet|address|gather|satisf)|has not yet|without (?:finishing|verifying|completing|checking|confirming|performing|gathering)|ended (?:the|without)|conclu(?:de|sion)|directly (?:reach|conclud|provid|answer|g[ai]ve|draw)|draw a conclusion|no further|halt|guess|not (?:fully )?shown|only displayed|failed to (?:access|retrieve|extract|find|provide|transcribe|locate|return)|unable to|inability|not return|did not return|error|404/i,
  'permission-continuity': /permission|approv|authoriz|without (?:asking|confirm|consent)|unauthori|bypass|not allowed|forbidden|policy/i
}

function mapReason(reason: string): CheckId[] {
  return CHECK_DEFS.map((c) => c.id).filter((id) => REASON_MAP[id].test(reason))
}

function listRecords(): Array<{ path: string; subset: string }> {
  const out: Array<{ path: string; subset: string }> = []
  for (const subset of ['Hand-Crafted', 'Algorithm-Generated']) {
    const dir = join(DATA, subset)
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.json')).sort((a, b) => Number.parseInt(a) - Number.parseInt(b))) out.push({ path: join(dir, name), subset })
  }
  return out
}

const records = listRecords()
if (records.length === 0) {
  console.error(`No records under ${DATA}. Run \`npm run fetch:whowhen\` first.`)
  process.exit(2)
}

interface RuleTally {
  tp: number
  fp: number
  fn: number
  firedRecords: number
  findings: number
  hitsByMapped: number
  mappedRecords: number
}
const tally: Record<string, RuleTally> = {}
for (const r of ALL_RULES) tally[r.id] = { tp: 0, fp: 0, fn: 0, firedRecords: 0, findings: 0, hitsByMapped: 0, mappedRecords: 0 }
const checkTally: Record<string, { mapped: number; hit: number; anyFired: number }> = {}
for (const c of CHECK_DEFS) checkTally[c.id] = { mapped: 0, hit: 0, anyFired: 0 }

let stepHits = 0
let agentHits = 0
let anyFinding = 0
let silentAll = 0
let unmapped = 0
let totalSteps = 0
let totalFindings = 0
const perSubset: Record<string, { records: number; stepHits: number; agentHits: number }> = {}
const stepHitExamples: Array<{ id: string; ruleId: string; reason: string }> = []
const falsePositiveSamples: Record<string, Array<{ id: string; message: string }>> = {}

for (const rec of records) {
  const raw = JSON.parse(readFileSync(rec.path, 'utf8')) as WhoWhenRecord
  const id = `${rec.subset}/${rec.path.split('/').pop()!.replace(/\.json$/, '')}`
  const run = parseWhoWhen(raw, id)
  const report = analyze(run)
  const labels = run.labels!
  const failing = new Set(run.events.filter((e) => e.id === labels.failingEventId || e.id === `${labels.failingEventId}-call`).map((e) => e.id))
  const failingThread = run.events.find((e) => e.id === labels.failingEventId)
  const failingAgentThreads = new Set(
    run.threads.filter((t) => (t.agentName ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') === labels.failingAgent.toLowerCase().replace(/[^a-z0-9]/g, '')).map((t) => t.id)
  )
  if (failingThread?.kind === 'report' && failingThread.from) failingAgentThreads.add(failingThread.from)
  const mapped = mapReason(labels.reason)
  if (mapped.length === 0) unmapped++
  totalSteps += raw.history.length
  totalFindings += report.issues.length
  perSubset[rec.subset] ??= { records: 0, stepHits: 0, agentHits: 0 }
  perSubset[rec.subset]!.records++
  if (report.issues.length) anyFinding++
  if (report.silent.length === ALL_RULES.length) silentAll++

  const hitStep = report.issues.some((f) => f.eventIds.some((e) => failing.has(e)))
  const hitAgent = report.issues.some((f) =>
    f.eventIds.some((e) => {
      const ev = run.events.find((x) => x.id === e)
      return ev && (failingAgentThreads.has(ev.threadId) || (ev.kind === 'report' && ev.from && failingAgentThreads.has(ev.from)) || (ev.kind === 'delegation' && ev.to && failingAgentThreads.has(ev.to)))
    })
  )
  if (hitStep) {
    stepHits++
    perSubset[rec.subset]!.stepHits++
  }
  if (hitAgent) {
    agentHits++
    perSubset[rec.subset]!.agentHits++
  }

  for (const c of mapped) checkTally[c]!.mapped++
  for (const rule of ALL_RULES) {
    const t = tally[rule.id]!
    const own = report.issues.filter((f) => f.ruleId === rule.id)
    const ruleMapped = mapped.includes(rule.checkId)
    if (ruleMapped) t.mappedRecords++
    if (own.length === 0) {
      if (ruleMapped) t.fn++
      continue
    }
    t.firedRecords++
    t.findings += own.length
    const hit = own.some((f) => f.eventIds.some((e) => failing.has(e)))
    if (hit) {
      t.tp++
      if (ruleMapped) t.hitsByMapped++
      stepHitExamples.push({ id, ruleId: rule.id, reason: plain(labels.reason.slice(0, 140)) })
    } else {
      t.fp++
      if (ruleMapped) t.fn++
      const list = (falsePositiveSamples[rule.id] ??= [])
      if (list.length < 3) list.push({ id, message: plain(own[0]!.message.slice(0, 160)) })
    }
  }
  for (const c of mapped) {
    const own = report.issues.filter((f) => f.checkId === c)
    if (own.length) checkTally[c]!.anyFired++
    if (own.some((f) => f.eventIds.some((e) => failing.has(e)))) checkTally[c]!.hit++
  }
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null)
const rows = ALL_RULES.map((rule) => {
  const t = tally[rule.id]!
  return {
    ruleId: rule.id,
    checkId: rule.checkId,
    firedRecords: t.firedRecords,
    findings: t.findings,
    tp: t.tp,
    fp: t.fp,
    fn: t.fn,
    mappedRecords: t.mappedRecords,
    precision: pct(t.tp, t.tp + t.fp),
    recall: pct(t.hitsByMapped, t.mappedRecords)
  }
})

const result = {
  generatedAt: new Date().toISOString(),
  source: 'Who&When (Zhang et al., ICML 2025, arXiv:2505.00212), fetched by npm run fetch:whowhen',
  records: records.length,
  subsets: perSubset,
  meanSteps: Math.round((totalSteps / records.length) * 10) / 10,
  randomStepBaseline: Math.round((records.length / totalSteps) * 1000) / 10,
  recordsWithAnyFinding: anyFinding,
  recordsAllRulesSilent: silentAll,
  findingsPerRecord: Math.round((totalFindings / records.length) * 10) / 10,
  stepHitRate: stepHits / records.length,
  agentHitRate: agentHits / records.length,
  stepHits,
  agentHits,
  unmappedReasons: unmapped,
  reasonMap: Object.fromEntries(Object.entries(REASON_MAP).map(([k, v]) => [k, v.source])),
  checks: CHECK_DEFS.map((c) => ({ id: c.id, mappedRecords: checkTally[c.id]!.mapped, firedOnMapped: checkTally[c.id]!.anyFired, hitOnMapped: checkTally[c.id]!.hit })),
  rules: rows,
  stepHitExamples: stepHitExamples.slice(0, 40),
  falsePositiveSamples
}

mkdirSync(join(ROOT, 'results'), { recursive: true })
writeFileSync(join(ROOT, 'results', 'calibration.json'), `${JSON.stringify(result, null, 2)}\n`)

const md: string[] = []
md.push('# Calibration against Who&When')
md.push('')
md.push(`Generated ${result.generatedAt} by \`npm run calibrate\` over ${result.records} labeled failure records (${Object.entries(perSubset).map(([k, v]) => `${v.records} ${k}`).join(', ')}). Mean ${result.meanSteps} steps per record; a rule that picked one step at random would hit the labeled step ${result.randomStepBaseline}% of the time.`)
md.push('')
md.push('Labels mark the failing step and agent, not the failure kind. "Hit" means a finding cites the labeled step\'s event (or the action derived from it). Recall is measured against the reason-to-check mapping below, which is a keyword map over the free-text reason and is published here so the number can be argued with.')
md.push('')
md.push('| Measure | Value |')
md.push('|---|---|')
md.push(`| Records where some rule cites the labeled step | ${stepHits} of ${records.length} (${Math.round(result.stepHitRate * 1000) / 10}%) |`)
md.push(`| Records where some rule cites an event in the labeled agent's thread | ${agentHits} of ${records.length} (${Math.round(result.agentHitRate * 1000) / 10}%) |`)
md.push(`| Records with at least one finding | ${anyFinding} |`)
md.push(`| Records where every rule was silent for lack of structure | ${silentAll} |`)
md.push(`| Findings per record | ${result.findingsPerRecord} |`)
md.push(`| Records whose reason maps to no check | ${unmapped} |`)
md.push('')
md.push('## Per rule')
md.push('')
md.push('| Rule | Check | Records fired | Findings | TP | FP | FN | Mapped records | Precision | Recall |')
md.push('|---|---|---|---|---|---|---|---|---|---|')
for (const r of rows) md.push(`| ${r.ruleId} | ${r.checkId} | ${r.firedRecords} | ${r.findings} | ${r.tp} | ${r.fp} | ${r.fn} | ${r.mappedRecords} | ${r.precision === null ? 'n/a' : `${r.precision}%`} | ${r.recall === null ? 'n/a' : `${r.recall}%`} |`)
md.push('')
md.push('Precision: of the records where the rule fired, the share where a finding cites the labeled step. Recall: of the records whose reason maps to the rule\'s check, the share where this rule cites the labeled step. n/a means the denominator is zero.')
md.push('')
md.push('## Per check')
md.push('')
md.push('| Check | Records mapped to it | Fired on those | Cited the labeled step on those |')
md.push('|---|---|---|---|')
for (const c of result.checks) md.push(`| ${c.id} | ${c.mappedRecords} | ${c.firedOnMapped} | ${c.hitOnMapped} |`)
md.push('')
md.push('## The reason-to-check mapping')
md.push('')
for (const [k, v] of Object.entries(result.reasonMap)) md.push(`- **${k}**: \`${v}\``)
md.push('')
md.push('## Labeled steps a rule cited')
md.push('')
for (const ex of result.stepHitExamples) md.push(`- ${ex.id}, ${ex.ruleId}: "${ex.reason}"`)
md.push('')
md.push('## False positive samples')
md.push('')
for (const [ruleId, list] of Object.entries(falsePositiveSamples)) {
  md.push(`- **${ruleId}**`)
  for (const s of list) md.push(`  - ${s.id}: ${s.message}`)
}
md.push('')
writeFileSync(join(ROOT, 'results', 'calibration.md'), `${md.join('\n')}\n`)
console.log(md.slice(0, 30).join('\n'))
console.log('\nWrote results/calibration.json and results/calibration.md')
