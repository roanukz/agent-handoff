/**
 * dup-after-report: a child looked something up and reported it; the
 * coordinator then looked it up again.
 */

import type { Rule } from '../engine/types.js'
import { duplicatePairs, isAfterReport, noArgs } from './dup-shared.js'
import { describeCall, finding, who } from './util.js'

const ID = 'dup-after-report'

export const dupAfterReport: Rule = {
  id: ID,
  checkId: 'no-duplicate-work',
  severity: 'minor',
  name: 'Lookup repeated after the report',
  description: 'A thread repeated a call another thread had already made and reported back on.',
  requires: noArgs,
  run(run) {
    const out = []
    for (const [a, b] of duplicatePairs(run)) {
      if (!isAfterReport(run, a, b)) continue
      const report = run.events.find((e) => e.kind === 'report' && e.from === a.threadId && e.index > a.index && e.index < b.index)!
      out.push(
        finding(ID, 'no-duplicate-work', 'minor', [a.id, report.id, b.id],
          `${who(run, a.threadId)} called ${describeCall(a)} and reported back; ${who(run, b.threadId)} then made the same call itself.`,
          'A coordinator that redoes a delegated lookup did not trust, or did not read, the report it asked for.',
          'Have the report carry the result in a form the coordinator can use directly, and check the coordinator prompt for "verify" instructions that mean "redo".')
      )
    }
    return out
  }
}

export default dupAfterReport
