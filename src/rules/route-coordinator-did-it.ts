/**
 * route-coordinator-did-it: the coordinator delegated a task and then made
 * the delegated call itself.
 */

import type { Rule } from '../engine/types.js'
import { sentences, toolsNamedIn } from '../engine/text.js'
import { eventsIn } from '../model/trace.js'
import { delegations, describeCall, finding, toolCalls, who } from './util.js'

const ID = 'route-coordinator-did-it'

export const routeCoordinatorDidIt: Rule = {
  id: ID,
  checkId: 'routing',
  severity: 'minor',
  name: 'Coordinator did the delegated work itself',
  description: 'After delegating a task, the delegating thread called the tool that task needed.',
  requires(run) {
    return run.events.some((e) => e.kind === 'delegation') ? null : 'No delegation between threads in this trace.'
  },
  run(run) {
    const known = [...new Set(toolCalls(run).map((c) => c.tool ?? '').concat(Object.keys(run.capabilities ?? {})))]
    const out = []
    for (const d of delegations(run)) {
      if (!d.to) continue
      const named = new Set<string>()
      for (const s of sentences(d.content ?? '')) for (const t of toolsNamedIn(s, known, run.capabilities)) named.add(t)
      for (const c of eventsIn(run, d.to)) if (c.kind === 'tool_call' && c.index > d.index && c.tool) named.add(c.tool)
      const own = eventsIn(run, d.threadId).filter((e) => e.kind === 'tool_call' && e.index > d.index && e.tool && named.has(e.tool))
      for (const call of own) {
        const childCall = eventsIn(run, d.to).find((e) => e.kind === 'tool_call' && e.tool === call.tool && e.index > d.index)
        out.push(
          finding(ID, 'routing', 'minor', childCall ? [d.id, call.id, childCall.id] : [d.id, call.id],
            `${who(run, d.threadId)} delegated to ${who(run, d.to)} and then called ${describeCall(call)} itself.`,
            'A coordinator that does the work it delegated pays for the delegation and gets two answers to reconcile.',
            'Either delegate and wait for the report, or keep the task; not both.')
        )
      }
    }
    return out
  }
}

export default routeCoordinatorDidIt
