/**
 * cc-report-dropped: a report back names an id and an amount; the
 * coordinator's next delegation about the same draft carries the draft id and
 * loses the rest. The "step 14" case from the PRD.
 */

import type { Rule } from '../engine/types.js'
import { carries, extractConstraints, mentionsTopic } from '../engine/text.js'
import { noDelegations } from './context.js'
import { delegations, excerpt, finding, reports, who } from './util.js'

const ID = 'cc-report-dropped'

export const ccReportDropped: Rule = {
  id: ID,
  checkId: 'context-carried',
  severity: 'minor',
  name: 'Report detail dropped in the next delegation',
  description: 'A later delegation refers to something a report described, and drops another identifier the report stated about it.',
  requires: noDelegations,
  run(run) {
    const out = []
    for (const r of reports(run)) {
      // Identifiers only. A report's figures are outputs (a unit price, a running
      // total), and the next delegation is entitled to leave them out.
      const stated = extractConstraints(r.content ?? '', 'report').filter((c) => c.kind === 'identifier')
      const anchors = stated
      if (stated.length < 2) continue
      for (const d of delegations(run)) {
        if (d.index <= r.index || d.threadId !== r.threadId) continue
        const text = d.content ?? ''
        const shared = anchors.filter((a) => carries(text, a))
        if (shared.length === 0) continue
        const dropped = stated.filter((c) => !carries(text, c) && mentionsTopic(text, c))
        if (dropped.length === 0) continue
        out.push(
          finding(ID, 'context-carried', 'minor', [r.id, d.id],
            `${who(run, r.from ?? '')} reported ${shared.map((s) => s.value).join(', ')} with ${dropped.map((c) => c.text).join(' and ')}. The next delegation to ${who(run, d.to ?? '')} carries ${shared.map((s) => s.value).join(', ')} and drops ${dropped.map((c) => c.value).join(', ')}: "${excerpt(text, 90)}"`,
            'The coordinator is the only thread that read the report. What it leaves out of the next message is gone for the thread that acts on it.',
            'Forward the report, or copy every id from it into the delegation that depends on it.')
        )
      }
    }
    return out
  }
}

export default ccReportDropped
