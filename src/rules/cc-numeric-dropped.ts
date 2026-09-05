/**
 * cc-numeric-dropped: a count, an amount or a cap stated upstream is missing
 * from the delegation that is plainly about the same thing, or a count in the
 * delegation is missing from the first downstream call that should carry it.
 */

import type { Finding, Rule } from '../engine/types.js'
import { carries } from '../engine/text.js'
import { anchoredElsewhere, constraintsOf, delegationCarries, delegationIsAbout, expectedInCall, firstRelevantCall, noDelegations, upstreamOf } from './context.js'
import { delegations, excerpt, finding, who } from './util.js'

const ID = 'cc-numeric-dropped'
const WHY = 'The receiving thread only knows what the delegation says. A count or a cap that the coordinator summarized away cannot be recovered downstream.'

export const ccNumericDropped: Rule = {
  id: ID,
  checkId: 'context-carried',
  severity: 'major',
  name: 'Numeric constraint dropped',
  description: 'A quantity, amount or cap stated upstream is absent from a delegation about the same subject, or a quantity in the delegation is absent from the first downstream call that should carry it.',
  requires: noDelegations,
  run(run) {
    const out: Finding[] = []
    for (const d of delegations(run)) {
      const target = who(run, d.to ?? '')
      const droppedBySource = new Map<string, { source: { id: string }; texts: string[]; values: string[] }>()
      const droppedByCall = new Map<string, { call: { id: string; tool?: string; args?: unknown }; texts: string[]; expected: string[] }>()
      for (const { source, constraint: c } of constraintsOf(upstreamOf(run, d))) {
        if (c.kind !== 'amount' && c.kind !== 'quantity' && c.kind !== 'cap') continue
        if (!delegationIsAbout(d, c)) continue
        if (anchoredElsewhere(source, d)) continue
        if (!delegationCarries(d, c)) {
          const slot = droppedBySource.get(source.id) ?? { source, texts: [], values: [] }
          slot.texts.push(c.text)
          slot.values.push(c.value)
          droppedBySource.set(source.id, slot)
          continue
        }
        if (c.kind !== 'quantity') continue
        const call = firstRelevantCall(run, d, c)
        if (!call) continue
        const expected = expectedInCall(d, c)
        if (carries(JSON.stringify(call.args), { kind: c.kind, value: expected })) continue
        const slot = droppedByCall.get(call.id) ?? { call, texts: [], expected: [] }
        slot.texts.push(c.text)
        slot.expected.push(expected)
        droppedByCall.set(call.id, slot)
      }
      for (const { source, texts, values } of droppedBySource.values()) {
        out.push(
          finding(ID, 'context-carried', 'major', [source.id, d.id],
            `Upstream says ${texts.map((t) => `"${t}"`).join(' and ')}. The delegation to ${target} is about the same thing but does not carry ${values.join(' or ')}: "${excerpt(d.content ?? '', 100)}"`,
            WHY,
            `Restate ${texts.map((t) => `"${t}"`).join(' and ')} in the delegation to ${target}, or pass the upstream message through verbatim.`)
        )
      }
      for (const { call, texts, expected } of droppedByCall.values()) {
        out.push(
          finding(ID, 'context-carried', 'major', [d.id, call.id],
            `The delegation to ${target} carries ${texts.map((t) => `"${t}"`).join(' and ')}, but ${target}'s first ${call.tool} call about it does not carry ${expected.join(' or ')}: ${excerpt(JSON.stringify(call.args), 100)}`,
            WHY,
            `Have ${target} echo the count into its call, or check the call against the delegation before it runs.`)
        )
      }
    }
    return out
  }
}

export default ccNumericDropped
