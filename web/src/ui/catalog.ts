/**
 * The rule catalog and the weights table, rendered from the registry so the
 * page can never disagree with the code.
 */

import { CHECK_DEFS } from '../../../src/engine/checks.js'
import { ALL_RULES } from '../../../src/rules/index.js'
import { el } from './dom.js'

export function renderWeights(): HTMLElement[] {
  return CHECK_DEFS.map((c) => el('tr', {}, el('td', {}, c.name), el('td', {}, `${Math.round(c.weight * 100)}%`), el('td', {}, c.why)))
}

export function renderCatalog(): HTMLElement[] {
  return CHECK_DEFS.map((c) => {
    const list = el('ul', { class: 'catalog-list' })
    for (const r of ALL_RULES.filter((r) => r.checkId === c.id)) {
      list.append(el('li', {}, el('code', {}, r.id), el('strong', {}, `${r.name}. `), `${r.description} `, el('em', {}, `Default severity: ${r.severity}.`)))
    }
    return el('div', { class: 'catalog-check' }, el('h4', {}, `${c.name} (${Math.round(c.weight * 100)}%)`), list)
  })
}
