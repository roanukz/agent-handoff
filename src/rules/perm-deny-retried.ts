/**
 * perm-deny-retried: a denied call was made again with the same arguments and
 * went through.
 */

import type { Rule } from '../engine/types.js'
import { laterCalls, noDecisions, sameWork, wasDenied, wasEscalated } from './perm-shared.js'
import { describeCall, executed, finding, toolCalls, who } from './util.js'

const ID = 'perm-deny-retried'

export const permDenyRetried: Rule = {
  id: ID,
  checkId: 'permission-continuity',
  severity: 'major',
  name: 'Deny retried and executed',
  description: 'A call that was denied was made again with the same arguments and executed.',
  requires: noDecisions,
  run(run) {
    const out = []
    for (const a of toolCalls(run)) {
      if (!wasDenied(run, a)) continue
      for (const b of laterCalls(run, a)) {
        if (b.tool !== a.tool || !sameWork(a, b) || !executed(run, b)) continue
        // A retry that was held and decided on its own is not a deny bypassed.
        if (wasDenied(run, b) || wasEscalated(b)) continue
        out.push(
          finding(ID, 'permission-continuity', 'major', [a.id, b.id],
            `${describeCall(a)} was denied in ${who(run, a.threadId)}; ${who(run, b.threadId)} made the same call again and it executed.`,
            'A deny that a retry gets past is a delay, not a deny.',
            'Make a deny sticky on the arguments, not only on the attempt.')
        )
      }
    }
    return out
  }
}

export default permDenyRetried
