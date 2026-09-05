import type { CheckStatus, Report, ScoredFinding, Severity } from '../../../src/engine/types.js'
import { eventById, threadName } from '../../../src/model/trace.js'
import { excerpt } from '../../../src/engine/text.js'
import { ALL_RULES } from '../../../src/rules/index.js'
import { el } from './dom.js'
import { icon, type IconName } from './icons.js'
import { STATUS_LABEL, eventBody, kindLabel } from './format.js'

const STATUS_ICON: Record<CheckStatus, IconName> = { pass: 'success', 'needs-work': 'warning', fail: 'error' }
const SEVERITY_ICON: Record<Severity, IconName> = { major: 'error', minor: 'warning', info: 'info' }

/** The cited events, side by side, in trace order. */
export function renderEventRow(report: Report, f: ScoredFinding, onEventClick: (id: string) => void): HTMLElement {
  const run = report.run
  const row = el('div', { class: 'event-row' })
  const events = f.eventIds.map((id) => eventById(run, id)).filter((e): e is NonNullable<typeof e> => !!e).sort((a, b) => a.index - b.index)
  for (const e of events) {
    const card = el(
      'div',
      { class: 'event-card', role: 'button', tabindex: '0', title: `Show event ${e.id} in the trace` },
      el('div', { class: 'event-card-head' }, el('span', { class: 'event-card-thread' }, threadName(run, e.threadId)), el('span', {}, `${kindLabel(e, run)} · #${e.index + 1}`)),
      el('p', { class: 'event-card-body' }, excerpt(eventBody(e), 260))
    )
    const go = () => onEventClick(e.id)
    card.addEventListener('click', go)
    card.addEventListener('keydown', (k) => {
      if (k.key === 'Enter' || k.key === ' ') {
        k.preventDefault()
        go()
      }
    })
    row.append(card)
  }
  return row
}

export function renderCheckCards(report: Report, idOf: (f: ScoredFinding) => string, onEventClick: (id: string) => void): HTMLElement[] {
  return report.checks.map((check) => {
    const card = el(
      'article',
      { class: 'card check-card', id: `check-${check.def.id}` },
      el(
        'div',
        { class: 'check-head' },
        el('h3', {}, check.def.name),
        el(
          'div',
          { class: 'check-score' },
          el('span', { class: 'check-score-num' }, `${check.score} / 100`),
          el('span', { class: `chip chip-${check.status}` }, icon(STATUS_ICON[check.status]), STATUS_LABEL[check.status] ?? check.status)
        )
      ),
      el('p', { class: 'check-why' }, check.def.why)
    )

    const silent = report.silent.filter((s) => ALL_RULES.find((r) => r.id === s.ruleId)?.checkId === check.def.id)
    if (check.findings.length === 0) {
      const ran = ALL_RULES.filter((r) => r.checkId === check.def.id).length - silent.length
      card.append(el('p', { class: 'check-clean' }, icon(ran > 0 ? 'success' : 'notice'), ran > 0 ? `Nothing found by the ${ran} rule${ran === 1 ? '' : 's'} that ran.` : 'No rule in this check could run on this trace.'))
    }
    for (const f of check.findings) {
      const top = el(
        'div',
        { class: 'finding-top' },
        el('span', { class: `sev sev-${f.severity}` }, icon(SEVERITY_ICON[f.severity]), f.severity),
        el('span', { class: 'finding-rule' }, f.ruleId)
      )
      if (!f.counted) top.append(el('span', { class: 'uncounted-tag' }, 'same habit, not counted'))
      card.append(
        el(
          'div',
          { class: 'finding', id: idOf(f) },
          top,
          el('p', { class: 'finding-message' }, f.message),
          renderEventRow(report, f, onEventClick),
          el('p', { class: 'finding-why' }, el('strong', {}, 'Why it matters: '), f.whyItMatters),
          el('p', { class: 'finding-suggestion' }, el('strong', {}, 'Try instead: '), f.suggestion)
        )
      )
    }
    for (const s of silent) {
      card.append(el('p', { class: 'check-silent' }, icon('notice'), `${s.ruleId} did not run: ${s.reason}`))
    }
    return card
  })
}
