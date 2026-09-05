/**
 * perm-escalation-bypassed: a call was escalated in one thread, and the same
 * work executed in another thread without its own decision.
 */

import type { Rule } from '../engine/types.js'
import { laterCalls, noDecisions, sameWork, wasEscalated } from './perm-shared.js'
import { describeCall, executed, finding, toolCalls, who } from './util.js'

const ID = 'perm-escalation-bypassed'

export const permEscalationBypassed: Rule = {
  id: ID,
  checkId: 'permission-continuity',
  severity: 'major',
  name: 'Escalation bypassed by another thread',
  description: 'A call was escalated for a human decision in one thread, and the same call executed in another thread with no decision of its own.',
  requires: noDecisions,
  run(run) {
    const out = []
    for (const a of toolCalls(run)) {
      if (!wasEscalated(a)) continue
      for (const b of laterCalls(run, a)) {
        if (b.threadId === a.threadId || b.tool !== a.tool) continue
        if (!sameWork(a, b) || !executed(run, b)) continue
        if (wasEscalated(b)) continue
        out.push(
          finding(ID, 'permission-continuity', 'major', [a.id, b.id],
            `${who(run, a.threadId)}'s ${describeCall(a)} was held for a decision${a.decision?.afterBuyer ? ` and ${a.decision.afterBuyer === 'allow' ? 'approved' : 'rejected'}` : ''}; ${who(run, b.threadId)} then executed the same call with no decision recorded.`,
            'A permission model enforced on one thread and not the next is not a permission model. The escalation cost a human\'s attention and bought nothing.',
            'Classify every call in every thread with the same policy engine, and key the decision on the call, not the thread.')
        )
      }
    }
    return out
  }
}

export default permEscalationBypassed
