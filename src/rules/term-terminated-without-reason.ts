/**
 * term-terminated-without-reason: a thread was terminated with no reason
 * recorded and had not reported back.
 */

import type { Rule } from '../engine/types.js'
import { childThreads, finding, startOf, who } from './util.js'

const ID = 'term-terminated-without-reason'

export const termTerminatedWithoutReason: Rule = {
  id: ID,
  checkId: 'termination',
  severity: 'minor',
  name: 'Terminated with no reason',
  description: 'A thread that never reported back was terminated and no reason was recorded.',
  requires(run) {
    return childThreads(run).length ? null : 'No child thread in this trace.'
  },
  run(run) {
    const out = []
    for (const e of run.events) {
      if (e.kind !== 'thread_terminated' || e.reason) continue
      const reported = run.events.some((r) => r.kind === 'report' && r.from === e.threadId && r.index < e.index)
      if (reported) continue
      const start = startOf(run, e.threadId)
      out.push(
        finding(ID, 'termination', 'minor', start ? [start.id, e.id] : [e.id],
          `${who(run, e.threadId)} was terminated without a recorded reason and had not reported back.`,
          'A termination with no reason cannot be told apart from a crash, a timeout or a decision.',
          'Record why a thread was stopped when stopping it.')
      )
    }
    return out
  }
}

export default termTerminatedWithoutReason
