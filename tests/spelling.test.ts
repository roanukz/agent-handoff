import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * US spelling, in everything this project writes: prose, headings, code
 * identifiers, comments, and any string that renders to a reader.
 *
 * Two rules, because one list rots. The -ise/-isation family is caught
 * generically and filtered against the words American English legitimately
 * spells that way; everything else is named explicitly. Neither list anchors
 * on a word boundary immediately before the stem, because a prefix hides it.
 *
 * The copied corpus and the fetched labeled set are data (model output and
 * platform events), not our text, and are skipped. Our generated results are
 * our text and are checked.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', '.vite', 'agent-submit', 'assets', 'whowhen'])
const SKIP_FILES = new Set(['package-lock.json', 'spelling.test.ts', 'style.test.ts'])
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.md', '.json', '.svg']

const US_ISE = `advertise advise apprise arise chastise circumcise comprise
compromise concise cruise bruise demise despise devise disguise enterprise
excise exercise expertise franchise fundraise guise improvise incise
merchandise noise paradise poise praise appraise braise precise premise prise
promise raise revise rise sunrise supervise surmise surprise televise treatise
malaise valise reprise anise turquoise tortoise porpoise`.split(/\s+/)

const PREFIXES = ['un', 're', 'dis', 'mis', 'over', 'under', 'pre', 'non', 'de', 'co', 'inter']

const NOT_A_SUFFIX = ['disable', 'disabled', 'disables', 'disabling', 'disablement', 'advisable', 'database', 'databases', 'miser', 'misers', 'wiser', 'wisest']

const US_ISE_FORMS = new Set(
  NOT_A_SUFFIX.concat(
    ...US_ISE.flatMap((word) => {
      const stem = word.slice(0, -1)
      return [word, `${word}s`, `${stem}ed`, `${stem}ing`, `${stem}er`, `${stem}ers`, `${stem}able`, `${stem}ation`, `${stem}ations`]
    })
  )
)

const ISE = /\b\w*?is(?:e|es|ed|ing|er|ers|ation|ations|ational|able|ability)\b/gi

const BRITISH = new RegExp(
  '\\b\\w*?(' +
    'colour\\w*|behaviour\\w*|favour\\w*|honour\\w*|labour\\w*|neighbour\\w*' +
    '|humour\\w*|rumour\\w*|flavour\\w*|harbour\\w*|armour\\w*|endeavour\\w*' +
    '|vapour\\w*|savour\\w*|odour\\w*|vigour\\w*|rigour\\w*|candour|clamour' +
    '|demeanour|saviour|splendour|parlour|valour|tumour' +
    '|labelled|labelling|unlabelled|modelling|modelled|cancelled|cancelling' +
    '|totalling|levelled|levelling|travelled|travelling|traveller\\w*' +
    '|marvellous|counsellor\\w*|signalled|signalling|fuelled|fuelling' +
    '|channelled|channelling|jewellery|woollen' +
    '|centre[sd]?|centring|metre[s]?|litre[s]?|fibre[s]?|theatre[s]?' +
    '|calibre|sombre|spectre|lustre|manoeuvre[sd]?' +
    '|licence[sd]?|defence[s]?|offence[s]?|pretence|practise\\w*' +
    '|analyse|analysed|analysing|analyser|paralyse\\w*|catalyse\\w*' +
    '|analogue[s]?|catalogue[sd]?|programme[s]?|judgement[s]?' +
    '|acknowledgement[s]?|grey|greys|greyed|greyish|greyscale\\w*' +
    '|whilst|amongst|maths|aluminium|ageing|sceptic\\w*|artefact[s]?' +
    '|enquir\\w*|speciality|specialities|fulfil|fulfils|instalment[s]?' +
    '|skilful\\w*|wilful\\w*|storey[s]?|kerb\\w*|cheque[s]?|moustache' +
    '|mediaeval|encyclopaedia|sulphur\\w*|tranquillity' +
    '|learnt|burnt|spelt|dreamt' +
    ')\\b',
  'gi'
)

const EXEMPT = ['aria-labelledby', 'labelledby', 'CancelledError']

function scrub(text: string): string {
  return EXEMPT.reduce((acc, token) => acc.split(token).join(' '), text)
}

function allowedIse(word: string): boolean {
  if (word.endsWith('wise') || word.endsWith('oise')) return true
  if (US_ISE_FORMS.has(word)) return true
  return PREFIXES.some((pre) => word.startsWith(pre) && US_ISE_FORMS.has(word.slice(pre.length)))
}

function offenses(rel: string, body: string): string[] {
  const found: string[] = []
  const lineOf = (index: number) => body.slice(0, index).split('\n').length
  for (const match of body.matchAll(BRITISH)) found.push(`${rel}:${lineOf(match.index)} ${match[0]}`)
  for (const match of body.matchAll(ISE)) {
    if (allowedIse(match[0].toLowerCase())) continue
    found.push(`${rel}:${lineOf(match.index)} ${match[0]}`)
  }
  return found
}

export function sources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) sources(full, acc)
    } else if (!SKIP_FILES.has(entry) && EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      acc.push(full)
    }
  }
  return acc
}

describe('spelling', () => {
  it('uses US spelling in everything this project writes', () => {
    const offenders = sources(ROOT).flatMap((path) => offenses(relative(ROOT, path), scrub(readFileSync(path, 'utf8'))))
    expect(offenders).toEqual([])
  })

  it('catches the forms a narrower list would miss', () => {
    const british = ['judgement', 'neighbouring', 'theatre', 'itemised', 'visualisation', 'linearise', 'totalling', 'recolour', 'unlabelled', 'normalised', 'prioritise', 'behaviour', 'whilst', 'summarise', 'authorise']
    expect(british.filter((w) => offenses('x', w).length === 0)).toEqual([])
  })

  it('leaves American words that only look British alone', () => {
    const american = ['otherwise', 'raised', 'surprising', 'promising', 'exercises', 'supervised', 'revised', 'noise', 'expertise', 'analysis', 'emphasis', 'specialist', 'realistic', 'cancellation', 'premises', 'aria-labelledby']
    expect(american.filter((w) => offenses('x', scrub(w)).length > 0)).toEqual([])
  })
})
