import type { Report, ScoredFinding } from '../../../src/engine/types.js'
import { el } from './dom.js'
import { fmtPoints } from './format.js'

export function renderFixList(report: Report, idOf: (f: ScoredFinding) => string, onFindingClick: (id: string) => void): HTMLElement[] {
  if (report.fixes.length === 0) return []
  const out: HTMLElement[] = [
    el('h2', {}, 'Fix these first'),
    el('p', { class: 'fix-sub' }, 'Ranked by how many points each fix recovers. Click one to jump to the finding.')
  ]
  report.fixes.forEach((f, i) => {
    const item = el(
      'div',
      { class: 'fix-item', role: 'button', tabindex: '0' },
      el('div', { class: 'fix-rank' }, String(i + 1)),
      el(
        'div',
        {},
        el('p', { class: 'fix-action' }, f.suggestion),
        el('p', { class: 'fix-points' }, `+${fmtPoints(f.impact)} points · ${f.severity} · ${f.ruleId} · ${report.checks.find((c) => c.def.id === f.checkId)?.def.name ?? ''}`)
      )
    )
    const go = () => onFindingClick(idOf(f))
    item.addEventListener('click', go)
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        go()
      }
    })
    out.push(item)
  })
  return out
}
