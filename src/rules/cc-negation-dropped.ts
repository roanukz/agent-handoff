/**
 * cc-negation-dropped: "do not use X" upstream becomes silence downstream, or
 * worse, becomes "X" with the "do not" gone.
 */

import type { Rule } from '../engine/types.js'
import { words } from '../engine/text.js'
import { constraintsOf, noDelegations, sentencesCarrying, upstreamOf } from './context.js'
import { delegations, excerpt, finding, who } from './util.js'

const ID = 'cc-negation-dropped'
const NEGATION_CUE =
  /\b(do not|don't|never|avoid|must not|mustn't|should not|shouldn't|exclude|excluding|without using|not to use|not use|no longer|refrain from|other than|not)\b/i

export const ccNegationDropped: Rule = {
  id: ID,
  checkId: 'context-carried',
  severity: 'major',
  name: 'Negation dropped',
  description: 'A "do not" stated upstream is absent from the delegation, or the thing it forbade reappears downstream with the prohibition gone.',
  requires: noDelegations,
  run(run) {
    const out = []
    for (const d of delegations(run)) {
      const target = who(run, d.to ?? '')
      const text = d.content ?? ''
      const relevantWords = new Set(words(text))
      for (const { source, constraint: c } of constraintsOf(upstreamOf(run, d))) {
        if (c.kind !== 'negation' || !c.objects?.length) continue
        const present = c.objects.filter((o) => text.toLowerCase().includes(o.toLowerCase()))
        if (present.length === 0) {
          const relevant = c.topics.some((t) => relevantWords.has(t))
          if (!relevant) continue
          out.push(
            finding(ID, 'context-carried', 'major', [source.id, d.id],
              `Upstream says "${excerpt(c.text, 90)}". The delegation to ${target} is about the same thing and never mentions ${c.objects.join(' or ')}.`,
              'A prohibition that is not restated is not in force. The receiving thread cannot avoid what it was never told to avoid.',
              `Restate the "do not" about ${c.objects.join(' and ')} in the delegation to ${target}.`)
          )
          continue
        }
        const flipped = present.filter((o) => sentencesCarrying(text, o).every((s) => !NEGATION_CUE.test(s)))
        if (flipped.length) {
          out.push(
            finding(ID, 'context-carried', 'major', [source.id, d.id],
              `Upstream says "${excerpt(c.text, 90)}". The delegation to ${target} mentions ${flipped.join(' and ')} with no "do not" around it.`,
              'A negation that loses its "not" in a summary turns a prohibition into an instruction.',
              `Put the "do not" back in the same sentence as ${flipped.join(' and ')} in the delegation to ${target}.`)
          )
        }
      }
    }
    return out
  }
}

export default ccNegationDropped
