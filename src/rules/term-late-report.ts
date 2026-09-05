/**
 * term-late-report: a report arrived after the coordinator's final answer.
 */

import type { Rule } from '../engine/types.js'
import { finalMessage } from '../model/trace.js'
import { childThreads, excerpt, finding, reports, who } from './util.js'

const ID = 'term-late-report'

export const termLateReport: Rule = {
  id: ID,
  checkId: 'termination',
  severity: 'major',
  name: 'Report received after the final answer',
  description: 'A thread reported back after the coordinator had already given its final answer.',
  requires(run) {
    return childThreads(run).length ? null : 'No child thread in this trace.'
  },
  run(run) {
    const final = finalMessage(run) ?? run.events.find((e) => e.kind === 'session_end')
    if (!final) return []
    const out = []
    for (const r of reports(run)) {
      if (r.index <= final.index) continue
      out.push(
        finding(ID, 'termination', 'major', [final.id, r.id],
          `${who(run, r.from ?? '')} reported back after the final answer: "${excerpt(r.content ?? '', 90)}"`,
          'A report that lands after the answer was given is a result nobody read.',
          'Answer only after every delegated thread has reported, or say in the answer which thread is still out.')
      )
    }
    return out
  }
}

export default termLateReport
