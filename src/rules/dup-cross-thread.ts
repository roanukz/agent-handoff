/**
 * dup-cross-thread: the same tool with the same arguments from two threads.
 */

import type { Rule } from '../engine/types.js'
import { duplicatePairs, isAfterReport, noArgs } from './dup-shared.js'
import { describeCall, finding, kindOf, who } from './util.js'

const ID = 'dup-cross-thread'

export const dupCrossThread: Rule = {
  id: ID,
  checkId: 'no-duplicate-work',
  severity: 'minor',
  name: 'Cross-thread duplicate',
  description: 'Two threads called the same tool with deep-equal arguments.',
  requires: noArgs,
  run(run) {
    const out = []
    for (const [a, b] of duplicatePairs(run)) {
      if (a.threadId === b.threadId) continue
      if (isAfterReport(run, a, b)) continue
      const write = kindOf(run, a.tool ?? '') === 'write'
      out.push(
        finding(ID, 'no-duplicate-work', write ? 'major' : 'minor', [a.id, b.id],
          `${who(run, a.threadId)} and ${who(run, b.threadId)} both called ${describeCall(a)}.${write ? ' That is a write, so it may have happened twice.' : ''}`,
          'Two threads doing the same lookup means neither knew the other had it; two threads doing the same write is the same action twice.',
          write ? 'Give one thread the write and have the other ask it for the result.' : 'Pass the result across the handoff instead of the instruction to fetch it.')
      )
    }
    return out
  }
}

export default dupCrossThread
