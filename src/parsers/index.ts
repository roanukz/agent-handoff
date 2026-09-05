/**
 * Format detection and the one entry point the page and the CLI share.
 */

import type { Run } from '../model/trace.js'
import { parseManaged, type ManagedOptions, type TraceFile } from './managed.js'
import { parseRoster, type Roster } from './roster.js'
import { isRunInput, parseRunInput } from './run-json.js'
import { parseSdk } from './sdk-hooklog.js'
import { isWhoWhenRecord, parseWhoWhen } from './whowhen.js'

export type Format = 'auto' | 'managed' | 'sdk' | 'whowhen' | 'run'

export interface LoadOptions {
  format?: Format
  id?: string
  roster?: Roster | string
  decisions?: ManagedOptions['decisions']
}

function base(name: string): string {
  return name.split('/').pop() ?? name
}

export function detectFormat(files: TraceFile[]): Exclude<Format, 'auto'> {
  const names = files.map((f) => base(f.name).toLowerCase())
  if (names.includes('decisions.json') || names.includes('trail.jsonl') || names.includes('case.json')) return 'sdk'
  if (files.some((f) => /\.jsonl$/i.test(f.name) || /"type":"(session|agent|user)\./.test(f.text.slice(0, 400)))) return 'managed'
  if (files.length === 1) {
    try {
      const parsed = JSON.parse(files[0]!.text) as unknown
      if (isWhoWhenRecord(parsed)) return 'whowhen'
      if (isRunInput(parsed)) return 'run'
    } catch {
      /* not JSON */
    }
  }
  throw new Error('Could not tell the format. Pass one of managed, sdk, whowhen or run.')
}

export function loadRun(files: TraceFile[], options: LoadOptions = {}): Run {
  const format = options.format && options.format !== 'auto' ? options.format : detectFormat(files)
  const roster = typeof options.roster === 'string' ? parseRoster(options.roster) : options.roster
  switch (format) {
    case 'managed':
      return parseManaged(files, { id: options.id, roster, decisions: options.decisions })
    case 'sdk': {
      const pick = (n: string) => files.find((f) => base(f.name).toLowerCase() === n)?.text
      const decisions = pick('decisions.json')
      const trail = pick('trail.jsonl')
      const recorded = pick('case.json')
      if (!decisions && !trail && !recorded) throw new Error('An SDK record needs decisions.json, trail.jsonl or case.json')
      // A session in which the agent made no call has no decisions file.
      return parseSdk({ decisions: decisions ?? '{}', trail, writes: pick('writes.jsonl'), case: recorded }, { id: options.id })
    }
    case 'whowhen': {
      const parsed = JSON.parse(files[0]!.text) as unknown
      if (!isWhoWhenRecord(parsed)) throw new Error('Not a Who&When record: needs history, mistake_step and mistake_agent')
      return parseWhoWhen(parsed, options.id ?? base(files[0]!.name).replace(/\.json$/i, ''))
    }
    case 'run': {
      const parsed = JSON.parse(files[0]!.text) as unknown
      if (!isRunInput(parsed)) throw new Error('Not a run file: needs threads and events')
      const run = parseRunInput(parsed)
      if (roster) {
        for (const t of run.threads) if (t.agentName && roster.agents[t.agentName]) t.tools = roster.agents[t.agentName]
        run.toolKinds ??= roster.toolKinds
        run.capabilities ??= roster.capabilities
      }
      return run
    }
  }
}

export { parseManaged, parseRoster, parseRunInput, parseSdk, parseWhoWhen }
export type { Roster, TraceFile }
