/**
 * cc-identifier-dropped: an id named upstream (a supplier, an item, a draft,
 * a URL in an instruction) is missing from a delegation that talks about that
 * kind of thing, or from the first downstream call that should carry it.
 */

import type { Finding, Rule } from '../engine/types.js'
import { carries } from '../engine/text.js'
import { anchoredElsewhere, constraintsOf, delegationCarries, delegationIsAbout, firstRelevantCall, noDelegations, upstreamOf } from './context.js'
import { delegations, excerpt, finding, who } from './util.js'

const ID = 'cc-identifier-dropped'
const WHY = 'An identifier is the one thing a summary cannot paraphrase. "The supplier" downstream is a guess; "SUP-003" is a fact.'

export const ccIdentifierDropped: Rule = {
  id: ID,
  checkId: 'context-carried',
  severity: 'major',
  name: 'Identifier dropped',
  description: 'An identifier named upstream is absent from a delegation that talks about that kind of thing, or from the first downstream call about it.',
  requires: noDelegations,
  run(run) {
    const out: Finding[] = []
    for (const d of delegations(run)) {
      const target = who(run, d.to ?? '')
      const droppedBySource = new Map<string, { source: { id: string }; values: string[] }>()
      const droppedByCall = new Map<string, { call: { id: string; tool?: string; args?: unknown }; values: string[] }>()
      for (const { source, constraint: c } of constraintsOf(upstreamOf(run, d))) {
        if (c.kind !== 'identifier') continue
        if (!delegationIsAbout(d, c)) continue
        if (anchoredElsewhere(source, d)) continue
        if (!delegationCarries(d, c)) {
          const slot = droppedBySource.get(source.id) ?? { source, values: [] }
          slot.values.push(c.value)
          droppedBySource.set(source.id, slot)
          continue
        }
        const call = firstRelevantCall(run, d, c)
        if (!call || carries(JSON.stringify(call.args), c)) continue
        const slot = droppedByCall.get(call.id) ?? { call, values: [] }
        slot.values.push(c.value)
        droppedByCall.set(call.id, slot)
      }
      for (const { source, values } of droppedBySource.values()) {
        out.push(
          finding(ID, 'context-carried', 'major', [source.id, d.id],
            `Upstream names ${values.join(' and ')}. The delegation to ${target} talks about it without naming it: "${excerpt(d.content ?? '', 100)}"`,
            WHY,
            `Name ${values.join(' and ')} in the delegation to ${target}. A description is not a substitute for the id.`)
        )
      }
      for (const { call, values } of droppedByCall.values()) {
        out.push(
          finding(ID, 'context-carried', 'major', [d.id, call.id],
            `The delegation to ${target} names ${values.join(' and ')}, but ${target}'s first ${call.tool} call about it uses something else: ${excerpt(JSON.stringify(call.args), 100)}`,
            WHY,
            `Have ${target} use the identifier it was given rather than resolving it again.`)
        )
      }
    }
    return out
  }
}

export default ccIdentifierDropped
