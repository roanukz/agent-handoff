import type { Band, CheckStatus, Report } from '../../../src/engine/types.js'
import { CHECK_FLOOR } from '../../../src/engine/score.js'
import { el } from './dom.js'
import { icon, type IconName } from './icons.js'
import { STATUS_LABEL, summaryLine } from './format.js'

const BAND_ICON: Record<Band, IconName> = { 'handed-off': 'success', 'needs-attention': 'warning', broke: 'error' }
const STATUS_ICON: Record<CheckStatus, IconName> = { pass: 'success', 'needs-work': 'warning', fail: 'error' }

function weakestRow(report: Report): HTMLElement {
  const check = report.weakestCheck
  return el(
    'p',
    { class: 'score-weakest' },
    el('span', { class: 'score-weakest-label' }, 'Weakest check'),
    el('span', { class: 'score-weakest-name' }, check.def.name),
    el('span', { class: 'score-weakest-num' }, `${check.score} / 100`),
    el('span', { class: `chip chip-${check.status}` }, icon(STATUS_ICON[check.status]), STATUS_LABEL[check.status] ?? check.status)
  )
}

export function renderScorePanel(report: Report): HTMLElement[] {
  const meter = el('div', { class: 'score-meter' })
  meter.append(el('div', { class: 'score-meter-fill', style: `width: ${Math.max(0, Math.min(100, report.overall))}%` }))
  const hero = el('div', { class: 'score-hero' }, el('div', { class: 'score-number' }, String(report.overall), el('small', {}, ' / 100')), meter)

  const band = el('p', { class: `score-band band-${report.band}` })
  band.append(icon(BAND_ICON[report.band]), document.createTextNode(report.bandLabel))

  const meta = el('div', { class: 'score-meta' }, band, weakestRow(report), el('p', { class: 'score-summary' }, summaryLine(report)))
  const out = [hero, meta]

  const run = report.run
  const threads = run.threads.map((t) => `${t.agentName ?? t.id}${t.tools ? ` (${t.tools.length} tool${t.tools.length === 1 ? '' : 's'})` : ''}`).join(', ')
  out.push(el('p', { class: 'score-threads' }, `${run.format} trace, ${run.events.length} events, ${run.threads.length} thread${run.threads.length === 1 ? '' : 's'}: ${threads}`))

  if (report.floored) {
    out.push(
      el(
        'p',
        { class: 'score-floor-note' },
        icon('warning'),
        `Scored ${report.overall}, but not handed off cleanly: ${report.weakestCheck.def.name} is at ${report.weakestCheck.score}, below the floor of ${CHECK_FLOOR}. One check this far down decides the answer on its own, whatever the average says.`
      )
    )
  }
  return out
}
