/**
 * Disk-side loading for the CLI and the tests. The parsers never touch the
 * file system; this file does, and it also knows the shape of the copied
 * corpus: a `roster.json` in an ancestor directory, and decision sidecars in a
 * sibling `managed-results/` folder keyed by case id.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Run } from '../model/trace.js'
import { loadRun, parseRoster, type Format, type Roster, type TraceFile } from '../parsers/index.js'
import type { SidecarDecision } from '../parsers/managed.js'

export const ROOT = fileURLToPath(new URL('../..', import.meta.url))
export const CORPUS = join(ROOT, 'fixtures', 'agent-submit')

export interface LoadPathOptions {
  format?: Format
  rosterPath?: string
}

function filesIn(dir: string): TraceFile[] {
  return readdirSync(dir)
    .filter((n) => /\.(jsonl?|json)$/i.test(n))
    .map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }))
}

function findUp(start: string, name: string): string | null {
  let dir = resolve(start)
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, name)
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

const rosterCache = new Map<string, Roster>()
function rosterFor(dir: string, explicit?: string): Roster | undefined {
  const path = explicit ?? findUp(dir, 'roster.json')
  if (!path) return undefined
  if (!rosterCache.has(path)) rosterCache.set(path, parseRoster(readFileSync(path, 'utf8')))
  return rosterCache.get(path)
}

interface ResultsFile {
  results: Array<{ caseId: string; decisions: SidecarDecision[] }>
}

const sidecarCache = new Map<string, ResultsFile | null>()
function readResults(path: string): ResultsFile | null {
  if (!sidecarCache.has(path)) {
    sidecarCache.set(path, existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as ResultsFile) : null)
  }
  return sidecarCache.get(path) ?? null
}

/** Decisions for a managed trace directory, from the variant's results files when they sit beside the corpus. */
function decisionsFor(dir: string): SidecarDecision[] | undefined {
  const resultsDir = findUp(dir, 'managed-results')
  if (!resultsDir) return undefined
  const name = basename(dir)
  const m = name.match(/^([a-z]+-\d+)(?:-(coordinator|defer))?$/)
  if (!m) return undefined
  const caseId = m[1]!
  const suffix = m[2]
  if (suffix === 'defer') return undefined
  const file = suffix === 'coordinator' ? 'results-multi.json' : 'results.json'
  const parsed = readResults(join(resultsDir, file))
  return parsed?.results.find((r) => r.caseId === caseId)?.decisions
}

function isManagedDir(dir: string): boolean {
  return readdirSync(dir).some((n) => n === 'primary.jsonl')
}

function isSdkDir(dir: string): boolean {
  const names = readdirSync(dir)
  return names.includes('decisions.json') || names.includes('trail.jsonl') || names.includes('case.json')
}

/** Every run under a path: a trace directory, a file, or a folder of either. */
export function loadPath(path: string, options: LoadPathOptions = {}): Run[] {
  const full = resolve(path)
  if (!existsSync(full)) throw new Error(`No such path: ${path}`)
  if (statSync(full).isDirectory()) {
    if (isManagedDir(full)) {
      return [loadRun(filesIn(full), { format: 'managed', id: basename(full), roster: rosterFor(full, options.rosterPath), decisions: decisionsFor(full) })]
    }
    if (isSdkDir(full)) {
      return [loadRun(filesIn(full), { format: 'sdk', id: basename(full) })]
    }
    const out: Run[] = []
    for (const entry of readdirSync(full).sort()) {
      const child = join(full, entry)
      if (statSync(child).isDirectory()) {
        if (['node_modules', '.git', 'managed-results'].includes(entry)) continue
        out.push(...loadPath(child, options))
      } else if (/\.jsonl?$/i.test(entry) && entry !== 'roster.json') {
        try {
          out.push(...loadPath(child, options))
        } catch (err) {
          if (options.format && options.format !== 'auto') throw err
          // A folder walk skips files that are not traces.
        }
      }
    }
    return out
  }
  const text = readFileSync(full, 'utf8')
  const name = basename(full)
  return [loadRun([{ name, text }], { format: options.format, id: name.replace(/\.jsonl?$/i, ''), roster: rosterFor(dirname(full), options.rosterPath) })]
}

/** The copied agent-submit corpus: SDK control runs plus the Managed Agents runs. */
export function loadCorpus(): Run[] {
  return [...loadPath(join(CORPUS, 'sdk')), ...loadPath(join(CORPUS, 'managed'))]
}
