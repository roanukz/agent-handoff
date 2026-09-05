/**
 * route-tool-not-held: a delegation names a tool, by name or by what it does,
 * that the receiving agent does not declare.
 */

import type { Rule } from '../engine/types.js'
import { sentences, toolsNamedIn } from '../engine/text.js'
import { threadOf } from '../model/trace.js'
import { delegations, excerpt, finding, startOf, toolCalls, who } from './util.js'

const ID = 'route-tool-not-held'
const NEGATED = /\b(do not|don't|never|must not|should not|shouldn't|cannot|can't|no tool|without)\b/i
/** "I will validate the supplier separately" is the sender's plan, not a request. */
const SELF = /\b(I|we)\s+(will|'ll|am going to|are going to|can|shall|have|already)\b/i

export const routeToolNotHeld: Rule = {
  id: ID,
  checkId: 'routing',
  severity: 'major',
  name: 'Delegated task names a tool the target lacks',
  description: 'A delegation names a tool, or describes what a tool does, and the receiving agent does not declare that tool.',
  requires(run) {
    if (!run.events.some((e) => e.kind === 'delegation')) return 'No delegation between threads in this trace.'
    if (!run.threads.some((t) => t.tools)) return 'No roster: declared tools per agent are unknown.'
    return null
  },
  run(run) {
    const known = new Set<string>()
    for (const t of run.threads) for (const tool of t.tools ?? []) known.add(tool)
    for (const c of toolCalls(run)) if (c.tool) known.add(c.tool)
    for (const tool of Object.keys(run.capabilities ?? {})) known.add(tool)
    const out = []
    for (const d of delegations(run)) {
      const target = d.to ? threadOf(run, d.to) : undefined
      if (!target?.tools) continue
      const named = new Set<string>()
      for (const s of sentences(d.content ?? '')) {
        if (NEGATED.test(s) || SELF.test(s)) continue
        for (const tool of toolsNamedIn(s, [...known], run.capabilities)) named.add(tool)
      }
      const missing = [...named].filter((t) => !target.tools!.includes(t))
      if (missing.length === 0) continue
      const start = startOf(run, target.id)
      out.push(
        finding(ID, 'routing', 'major', start && start.id !== d.id ? [d.id, start.id] : [d.id],
          `The delegation to ${who(run, target.id)} asks for ${missing.join(' and ')}, which ${who(run, target.id)} does not declare (it has ${target.tools.length ? target.tools.join(', ') : 'no tools'}): "${excerpt(d.content ?? '', 90)}"`,
          'A task sent to an agent without the tool for it ends in a polite report that nothing happened, or in the agent improvising.',
          `Send this task to the agent that declares ${missing.join(' and ')}, or add the tool to ${who(run, target.id)}.`)
      )
    }
    return out
  }
}

export default routeToolNotHeld
