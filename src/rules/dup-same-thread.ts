/**
 * dup-same-thread: one thread repeats a call with the same arguments, the
 * first attempt did not fail, and nothing was written in between.
 */

import type { Rule } from '../engine/types.js'
import { eventsIn } from '../model/trace.js'
import { duplicatePairs, noArgs } from './dup-shared.js'
import { describeCall, finding, kindOf, resultFor, who } from './util.js'

const ID = 'dup-same-thread'

export const dupSameThread: Rule = {
  id: ID,
  checkId: 'no-duplicate-work',
  severity: 'minor',
  name: 'Same-thread retry with no error',
  description: 'One thread called the same read or write with the same arguments twice, the first call did not fail, and no write happened between them.',
  requires: noArgs,
  run(run) {
    const out = []
    for (const [a, b] of duplicatePairs(run)) {
      if (a.threadId !== b.threadId) continue
      // A browser click or a scroll repeated is paging, not a lost result; only
      // tools known to read or write are judged here.
      const kind = kindOf(run, a.tool ?? '')
      if (kind === 'unknown') continue
      const first = resultFor(run, a)
      if (first?.result?.isError) continue
      const between = eventsIn(run, a.threadId).filter((e) => e.kind === 'tool_call' && e.index > a.index && e.index < b.index)
      if (between.some((e) => kindOf(run, e.tool ?? '') === 'write')) continue
      out.push(
        finding(ID, 'no-duplicate-work', kind === 'write' ? 'major' : 'minor', [a.id, b.id],
          `${who(run, a.threadId)} called ${describeCall(a)} twice with nothing changed in between and no error on the first call.${kind === 'write' ? ' That is a write, so it happened twice.' : ''}`,
          'A repeated call with no failure and no state change in between is a thread that lost track of what it already had.',
          'Keep the first result in the thread\'s working context, or have the runtime return the cached result.')
      )
    }
    return out
  }
}

export default dupSameThread
