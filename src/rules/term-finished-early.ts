/**
 * term-finished-early: the coordinator gave its final answer while a child
 * thread was still running.
 */

import type { Rule } from '../engine/types.js'
import { finalMessage } from '../model/trace.js'
import { childThreads, finding, who } from './util.js'

const ID = 'term-finished-early'

export const termFinishedEarly: Rule = {
  id: ID,
  checkId: 'termination',
  severity: 'major',
  name: 'Coordinator finished while a thread was running',
  description: 'The coordinator gave its final answer while a child thread was still running.',
  requires(run) {
    if (!childThreads(run).length) return 'No child thread in this trace.'
    if (!run.events.some((e) => e.kind === 'thread_running' || e.kind === 'thread_idle')) return 'No thread lifecycle events in this trace.'
    return null
  },
  run(run) {
    const final = finalMessage(run)
    if (!final) return []
    const out = []
    for (const t of childThreads(run)) {
      const status = [...run.events]
        .filter((e) => e.threadId === t && e.index < final.index && (e.kind === 'thread_running' || e.kind === 'thread_idle' || e.kind === 'thread_terminated'))
        .pop()
      if (!status || status.kind !== 'thread_running') continue
      out.push(
        finding(ID, 'termination', 'major', [status.id, final.id],
          `${who(run, t)} was still running when ${who(run, final.threadId)} gave its final answer.`,
          'An answer given while a delegated thread is running does not include that thread\'s result, and the thread will finish into nothing.',
          'Wait for every running thread to go idle, or terminate it with a reason, before answering.')
      )
    }
    return out
  }
}

export default termFinishedEarly
