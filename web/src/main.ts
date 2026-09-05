/**
 * UI wiring only. Parsing and scoring live in src/ and run unchanged in the
 * CLI and the tests.
 */

import '../tokens.css'
import '../styles.css'
import { analyze } from '../../src/engine/analyze.js'
import type { Report, ScoredFinding } from '../../src/engine/types.js'
import { loadRun, type Format, type TraceFile } from '../../src/parsers/index.js'
import type { SidecarDecision } from '../../src/parsers/managed.js'
import { SAMPLES } from './samples.js'
import { renderCatalog, renderWeights } from './ui/catalog.js'
import { renderCheckCards } from './ui/checkCards.js'
import { clear, el } from './ui/dom.js'
import { renderFixList } from './ui/fixList.js'
import { icon } from './ui/icons.js'
import { buildMarkdownReport } from './ui/reportMarkdown.js'
import { renderScorePanel } from './ui/scorePanel.js'
import { showToast } from './ui/toast.js'
import { focusEvent, renderTraceView } from './ui/traceView.js'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const editor = $<HTMLTextAreaElement>('editor')
const filesInput = $<HTMLInputElement>('files')
const filesHint = $<HTMLElement>('files-hint')
const formatSelect = $<HTMLSelectElement>('format')
const rosterInput = $<HTMLTextAreaElement>('roster')
const scoreBtn = $<HTMLButtonElement>('score')
const backBtn = $<HTMLButtonElement>('back')
const copyBtn = $<HTMLButtonElement>('copy-report')
const inputView = $<HTMLElement>('input-view')
const resultsView = $<HTMLElement>('results-view')
const inputNotices = $<HTMLElement>('input-notices')
const noticesHost = $<HTMLElement>('results-notices')
const scoreHost = $<HTMLElement>('score-panel')
const fixHost = $<HTMLElement>('fix-list')
const cardsHost = $<HTMLElement>('check-cards')
const traceHost = $<HTMLElement>('trace-view')

let chosenFiles: TraceFile[] = []
let sampleDecisions: SidecarDecision[] | undefined
let currentReport: Report | null = null

function notice(kind: 'notice' | 'warn' | 'error', text: string): HTMLElement {
  const body = el('div', {})
  if (kind === 'notice') body.append(el('p', { class: 'notice-label' }, 'Good to know'))
  body.append(el('p', { class: 'notice-body' }, text))
  return el('div', { class: `notice notice-${kind}` }, icon(kind === 'warn' ? 'warning' : kind === 'error' ? 'error' : 'notice'), body)
}

function syncButton(): void {
  scoreBtn.disabled = editor.value.trim() === '' && chosenFiles.length === 0
}

editor.addEventListener('input', () => {
  if (editor.value.trim()) {
    chosenFiles = []
    sampleDecisions = undefined
    filesInput.value = ''
    filesHint.textContent = 'primary.jsonl plus each thread\'s .jsonl, or decisions.json plus trail.jsonl, or one .json record.'
  }
  syncButton()
})

filesInput.addEventListener('change', async () => {
  const list = filesInput.files
  if (!list || list.length === 0) return
  chosenFiles = await Promise.all([...list].map(async (f) => ({ name: f.name, text: await f.text() })))
  sampleDecisions = undefined
  editor.value = ''
  filesHint.textContent = `${chosenFiles.length} file${chosenFiles.length === 1 ? '' : 's'} chosen: ${chosenFiles.map((f) => f.name).join(', ')}`
  syncButton()
})

for (const btn of document.querySelectorAll<HTMLButtonElement>('button.sample')) {
  btn.addEventListener('click', () => {
    const sample = SAMPLES[btn.dataset.sample ?? '']
    if (!sample) return
    chosenFiles = sample.files
    sampleDecisions = sample.decisions
    editor.value = ''
    formatSelect.value = sample.format
    rosterInput.value = sample.roster ?? ''
    filesInput.value = ''
    filesHint.textContent = `Sample loaded: ${sample.label} (${sample.files.map((f) => f.name).join(', ')})`
    clear(inputNotices)
    inputNotices.append(notice('notice', sample.note))
    syncButton()
    scoreBtn.focus()
  })
}

function pastedFiles(): TraceFile[] {
  const text = editor.value
  const trimmed = text.trim()
  const isJsonl = trimmed.startsWith('{') && trimmed.includes('\n{') && !trimmed.endsWith('}]') && !/^\{\s*"(history|events|threads)"/.test(trimmed)
  return [{ name: isJsonl ? 'pasted.jsonl' : 'pasted.json', text }]
}

scoreBtn.addEventListener('click', () => {
  const files = chosenFiles.length ? chosenFiles : pastedFiles()
  const format = formatSelect.value as Format
  clear(inputNotices)
  let report: Report
  try {
    const run = loadRun(files, { format, roster: rosterInput.value.trim() || undefined, decisions: sampleDecisions })
    report = analyze(run)
  } catch (err) {
    inputNotices.append(notice('error', `Could not score that: ${err instanceof Error ? err.message : String(err)}`))
    return
  }
  render(report)
})

function render(report: Report): void {
  currentReport = report
  inputView.hidden = true
  resultsView.hidden = false
  for (const host of [noticesHost, scoreHost, fixHost, cardsHost, traceHost]) clear(host)

  const ids = new Map<ScoredFinding, string>()
  report.issues.forEach((f, i) => ids.set(f, `f${i}`))
  const idOf = (f: ScoredFinding): string => ids.get(f) ?? ''
  const goToFinding = (id: string) => {
    const node = document.getElementById(id)
    node?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
  const goToEvent = (eventId: string) => focusEvent(traceHost, eventId)

  for (const n of report.run.notes ?? []) noticesHost.append(notice('notice', n))
  if (report.silent.length) {
    const reasons = new Map<string, number>()
    for (const s of report.silent) reasons.set(s.reason, (reasons.get(s.reason) ?? 0) + 1)
    for (const [reason, n] of reasons) noticesHost.append(notice('warn', `${n} rule${n === 1 ? '' : 's'} could not run: ${reason}`))
  }

  scoreHost.append(...renderScorePanel(report))
  const fixes = renderFixList(report, idOf, goToFinding)
  fixHost.hidden = fixes.length === 0
  fixHost.append(...fixes)
  cardsHost.append(...renderCheckCards(report, idOf, goToEvent))
  traceHost.append(...renderTraceView(report))
  window.scrollTo({ top: 0 })
}

backBtn.addEventListener('click', () => {
  resultsView.hidden = true
  inputView.hidden = false
  editor.focus()
})

copyBtn.addEventListener('click', async () => {
  if (!currentReport) return
  try {
    await navigator.clipboard.writeText(buildMarkdownReport(currentReport))
    const original = copyBtn.textContent
    copyBtn.textContent = 'Copied'
    window.setTimeout(() => {
      copyBtn.textContent = original
    }, 1600)
  } catch {
    showToast('Could not copy, because the browser blocked clipboard access.')
  }
})

$<HTMLElement>('weights-body').append(...renderWeights())
$<HTMLElement>('catalog').append(...renderCatalog())
syncButton()
