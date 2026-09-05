/**
 * route-target-lacks-tool: the receiving thread's report says it lacks the
 * tool, access or ability the task needed.
 */

import type { Rule } from '../engine/types.js'
import { delegations, excerpt, finding, reports, who } from './util.js'

const ID = 'route-target-lacks-tool'
const LACK = [
  /\b(I|we)\s+(do not|don't|cannot|can't|am unable to|am not able to|are unable to|have no|lack|don't have|do not have)\b[^.\n]{0,80}\b(tool|tools|access|ability|capability|permission|function|means|way)\b/i,
  /\b(no|without a|not have a|lack the)\s+(tool|means|access)\b/i,
  /\boutside (of )?(my|the) (tools|capabilit|scope|remit)/i,
  /\bnot (available|possible) (to|for) me\b/i,
  /\b(I|we) (can only|am only able to)\b/i
]

export const routeTargetLacksTool: Rule = {
  id: ID,
  checkId: 'routing',
  severity: 'major',
  name: 'Target reports it lacks the tool',
  description: 'A thread reports back that it does not have a tool, access or ability the delegated task needed.',
  requires(run) {
    return run.events.some((e) => e.kind === 'report') ? null : 'No report back from a delegated thread in this trace.'
  },
  run(run) {
    const out = []
    for (const r of reports(run)) {
      const text = r.content ?? ''
      if (!LACK.some((re) => re.test(text))) continue
      const d = [...delegations(run)].reverse().find((e) => e.to === r.from && e.index < r.index)
      if (!d) continue
      out.push(
        finding(ID, 'routing', 'major', [d.id, r.id],
          `${who(run, r.from ?? '')} answered the delegation with "${excerpt(text.match(LACK.find((re) => re.test(text))!)?.[0] ?? text, 90)}".`,
          'The runtime routed a task to a thread that could only say no. The round trip cost a turn and the task is still undone.',
          'Route by declared tools, not by agent name. If the agent is right and the tool is missing, add the tool.')
      )
    }
    return out
  }
}

export default routeTargetLacksTool
