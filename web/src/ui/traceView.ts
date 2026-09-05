/**
 * The whole trace as a table, one row per event, with the cited rows marked.
 * Thread lanes are colored by position, and the color always sits beside the
 * thread's name.
 */

import type { Report } from '../../../src/engine/types.js'
import { threadName } from '../../../src/model/trace.js'
import { excerpt } from '../../../src/engine/text.js'
import { el } from './dom.js'
import { eventBody, kindLabel } from './format.js'

const LANES = ['var(--primary-500)', 'var(--success-600)', 'var(--warning-600)', 'var(--info-600)', 'var(--error-600)', 'var(--notice-600)']

export function rowId(eventId: string): string {
  return `ev-${eventId.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

export function renderTraceView(report: Report): HTMLElement[] {
  const run = report.run
  const cited = new Set(report.issues.flatMap((f) => f.eventIds))
  const laneOf = new Map(run.threads.map((t, i) => [t.id, LANES[i % LANES.length]!]))
  const table = el('table', { class: 'trace' })
  table.append(el('thead', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, 'Thread'), el('th', {}, 'Event'), el('th', {}, 'Detail'))))
  const body = el('tbody')
  for (const e of run.events) {
    const tr = el('tr', { id: rowId(e.id), class: cited.has(e.id) ? 'cited' : '' })
    const lane = el('span', { class: 'lane', style: `background: ${laneOf.get(e.threadId) ?? LANES[0]}` })
    tr.append(
      el('td', { class: 'num' }, String(e.index + 1)),
      el('td', { class: 'thread' }, lane, threadName(run, e.threadId)),
      el('td', { class: 'kind' }, kindLabel(e, run)),
      el('td', { class: 'detail' }, excerpt(eventBody(e), 220))
    )
    body.append(tr)
  }
  table.append(body)
  const out: HTMLElement[] = [
    el('h2', {}, 'The trace'),
    el('p', { class: 'trace-sub' }, `${run.events.length} events in order. Rows a finding cites are marked. Click an event in a finding to jump here.`)
  ]
  if ((run.notes ?? []).length) out.push(el('p', { class: 'trace-sub' }, run.notes!.join(' ')))
  out.push(el('div', { class: 'trace-scroll' }, table))
  return out
}

export function focusEvent(host: HTMLElement, eventId: string): void {
  for (const row of host.querySelectorAll('tr.focus')) row.classList.remove('focus')
  const row = host.querySelector(`#${CSS.escape(rowId(eventId))}`)
  if (!row) return
  row.classList.add('focus')
  row.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
