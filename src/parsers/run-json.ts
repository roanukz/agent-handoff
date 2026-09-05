/**
 * The internal model as a file. Fixtures use it; so does `--format run`.
 */

import type { Event, Run, RunInput } from '../model/trace.js'

export function isRunInput(value: unknown): value is RunInput {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as RunInput).events) &&
    Array.isArray((value as RunInput).threads)
  )
}

export function parseRunInput(input: RunInput): Run {
  const primaryThreadId = input.primaryThreadId ?? input.threads.find((t) => t.parentId === null)?.id ?? input.threads[0]?.id ?? 'primary'
  const ids = new Set<string>()
  const events: Event[] = input.events.map((e, index) => {
    if (ids.has(e.id)) throw new Error(`Duplicate event id ${e.id}`)
    ids.add(e.id)
    return { ...e, ts: e.ts ?? null, index }
  })
  return {
    id: input.id,
    format: 'run',
    threads: input.threads,
    events,
    primaryThreadId,
    labels: input.labels,
    toolKinds: input.toolKinds,
    capabilities: input.capabilities,
    notes: input.notes ?? []
  }
}
