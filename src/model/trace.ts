/**
 * The internal trace model. Every parser produces a Run; every rule reads
 * one. Nothing here knows about a vendor's event names.
 *
 * Events are ordered as they happened and each carries the thread it belongs
 * to. Lifecycle events (created, running, idle, terminated) carry the thread
 * they are ABOUT as their threadId, which is how the platform streams report
 * them too.
 */

export type EventKind =
  /** The human request that started the run. */
  | 'user_message'
  /** An agent's own text, including a coordinator's final answer. */
  | 'message'
  /** A task sent from one thread to another. `to` names the receiving thread. */
  | 'delegation'
  /** A message back from a thread. `from` names the sending thread. */
  | 'report'
  | 'tool_call'
  | 'tool_result'
  /** A permission decision recorded on a tool call (SDK trail lines). */
  | 'decision'
  | 'thread_created'
  | 'thread_running'
  | 'thread_idle'
  | 'thread_terminated'
  /** The session finished (idle on end_turn, or terminated). */
  | 'session_end'

export type DecisionValue = 'allow' | 'deny' | 'ask' | 'defer'

export interface Decision {
  /** The permission tier the runtime classified the call into, when known. */
  tier?: string
  decision: DecisionValue
  /** For an ask or defer: how it was resolved, when known. */
  afterBuyer?: 'allow' | 'deny'
  reason?: string
}

export interface Event {
  id: string
  /** Position in Run.events. Filled by the parser; rules sort by it. */
  index: number
  ts: string | null
  threadId: string
  kind: EventKind
  tool?: string
  args?: unknown
  /** tool_result and decision: the tool_call this belongs to. */
  toolCallId?: string
  result?: { content: string; isError: boolean }
  /** report: the sending thread. */
  from?: string
  /** delegation: the receiving thread. */
  to?: string
  content?: string
  decision?: Decision
  /** thread_idle and session_end: why the thread or session stopped. */
  stopReason?: string
  /** thread_terminated: the reason recorded, if any. */
  reason?: string
  /** The source line, kept for display. Never read by a rule. */
  raw?: unknown
}

export interface Thread {
  id: string
  agentName: string | null
  parentId: string | null
  /** Declared tools, when a roster says. Undefined means unknown, not none. */
  tools?: string[]
}

export type RunFormat = 'sdk' | 'managed' | 'whowhen' | 'run'

export interface Labels {
  /** Index into the source record's step list. */
  failingStep: number
  failingAgent: string
  reason: string
  /** The event id the failing step became. */
  failingEventId: string
}

export interface Run {
  id: string
  format: RunFormat
  threads: Thread[]
  events: Event[]
  primaryThreadId: string
  /** Present only for labeled sets. */
  labels?: Labels
  /** Read or write per tool name, when a roster says. */
  toolKinds?: Record<string, 'read' | 'write'>
  /** Phrases that mean a tool, per tool name, for the routing rules. */
  capabilities?: Record<string, string[]>
  /** Parser notes a reader should see: what this format lacks. */
  notes?: string[]
}

/** The shape a fixture file or a `--format run` input takes: a Run without the derived fields. */
export interface RunInput {
  id: string
  threads: Thread[]
  events: Array<Omit<Event, 'index' | 'ts'> & { ts?: string | null }>
  primaryThreadId?: string
  labels?: Labels
  toolKinds?: Record<string, 'read' | 'write'>
  capabilities?: Record<string, string[]>
  notes?: string[]
}

export function threadOf(run: Run, id: string): Thread | undefined {
  return run.threads.find((t) => t.id === id)
}

export function threadName(run: Run, id: string): string {
  const t = threadOf(run, id)
  return t?.agentName ?? id
}

export function eventById(run: Run, id: string): Event | undefined {
  return run.events.find((e) => e.id === id)
}

export function eventsIn(run: Run, threadId: string): Event[] {
  return run.events.filter((e) => e.threadId === threadId)
}

export function isPrimary(run: Run, threadId: string): boolean {
  return threadId === run.primaryThreadId
}

/**
 * The coordinator's final answer: the last message in the primary thread
 * before the session ended, or the last message there if nothing marks the
 * end. Null when the primary thread never spoke.
 */
export function finalMessage(run: Run): Event | null {
  const end = [...run.events].reverse().find((e) => e.kind === 'session_end')
  const messages = run.events.filter((e) => e.kind === 'message' && e.threadId === run.primaryThreadId)
  if (end) {
    const before = messages.filter((e) => e.index < end.index)
    return before.length ? before[before.length - 1]! : null
  }
  // No session end recorded: only a message that says it is final counts.
  // An orchestrator's last thought before the log stops is not an answer.
  const declared = messages.filter((e) => /(^|\n)\s*final answer\b|\bfinal answer:|\bTERMINATE\b/i.test(e.content ?? ''))
  return declared.length ? declared[declared.length - 1]! : null
}

export function resultOf(run: Run, call: Event): Event | undefined {
  return run.events.find((e) => e.kind === 'tool_result' && e.toolCallId === call.id)
}

/** Every text a reader would see on this event, for excerpting and matching. */
export function eventText(e: Event): string {
  const parts: string[] = []
  if (e.content) parts.push(e.content)
  if (e.args !== undefined) parts.push(JSON.stringify(e.args))
  if (e.result) parts.push(e.result.content)
  if (e.decision?.reason) parts.push(e.decision.reason)
  return parts.join('\n')
}
