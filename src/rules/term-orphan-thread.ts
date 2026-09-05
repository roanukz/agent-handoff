/**
 * term-orphan-thread: a thread was started and never reported back or was
 * terminated with a reason.
 */

import type { Rule } from '../engine/types.js'
import { childThreads, delegations, finding, startOf, who } from './util.js'

const ID = 'term-orphan-thread'

export const termOrphanThread: Rule = {
  id: ID,
  checkId: 'termination',
  severity: 'major',
  name: 'Orphaned thread',
  description: 'A thread was created or delegated to and neither reported back nor was terminated.',
  requires(run) {
    return childThreads(run).length ? null : 'No child thread in this trace.'
  },
  run(run) {
    const out = []
    for (const t of childThreads(run)) {
      const reported = run.events.some((e) => e.kind === 'report' && e.from === t)
      const terminated = run.events.some((e) => e.kind === 'thread_terminated' && e.threadId === t)
      if (reported || terminated) continue
      const start = startOf(run, t)
      const last = [...delegations(run)].reverse().find((d) => d.to === t)
      const ids = [start?.id, last?.id].filter((x): x is string => !!x)
      out.push(
        finding(ID, 'termination', 'major', [...new Set(ids)],
          `${who(run, t)} was ${start?.kind === 'thread_created' ? 'created' : 'delegated to'} and never reported back or was terminated.`,
          'Work with no report is work the coordinator did not include in its answer, and cannot know whether it happened.',
          'Have every delegated thread end with a report, and terminate abandoned threads with a reason.')
      )
    }
    return out
  }
}

export default termOrphanThread
