/**
 * Claude Managed Agents session traces to a Run.
 *
 * Input is the captured per-thread JSONL: `primary.jsonl` (the session-level
 * stream, where the coordinator's own events and everything cross-posted
 * from child threads live) plus one `<thread id>.jsonl` per child thread.
 * The primary stream carries a child's tool calls only when they were
 * cross-posted to the client, and never a child's own messages, so the
 * context rules need the per-thread files.
 *
 * Event names were verified against the platform reference on 2026-09-05:
 * session.thread_created, session.thread_status_running/idle/terminated,
 * agent.thread_message_sent/received, agent.custom_tool_use,
 * user.custom_tool_result, session.status_idle/terminated.
 */

import type { Decision, Event, EventKind, Run, Thread } from '../model/trace.js'
import type { Roster } from './roster.js'

export interface TraceFile {
  name: string
  text: string
}

/** One entry of the variant's results file: the client's decision on a call. */
export interface SidecarDecision {
  tool: string
  tier?: string
  decision: Decision['decision']
  afterBuyer?: 'allow' | 'deny'
  threadId: string | null
}

export interface ManagedOptions {
  id?: string
  decisions?: SidecarDecision[]
  roster?: Roster
}

interface RawEvent {
  id?: string
  type: string
  processed_at?: string | null
  session_thread_id?: string
  agent_name?: string
  from_session_thread_id?: string
  from_agent_name?: string
  to_session_thread_id?: string
  to_agent_name?: string
  content?: Array<{ type: string; text?: string }>
  name?: string
  input?: unknown
  custom_tool_use_id?: string
  is_error?: boolean
  stop_reason?: { type?: string; reason?: string }
  reason?: string
  [key: string]: unknown
}

interface Located {
  raw: RawEvent
  file: string
  order: number
}

function textOf(content: RawEvent['content']): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter((b) => b && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('\n')
}

function parseLines(file: TraceFile, order: { n: number }): Located[] {
  const out: Located[] = []
  for (const line of file.text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let raw: RawEvent
    try {
      raw = JSON.parse(trimmed) as RawEvent
    } catch {
      continue
    }
    if (!raw || typeof raw.type !== 'string') continue
    out.push({ raw, file: file.name, order: order.n++ })
  }
  return out
}

function baseName(name: string): string {
  const last = name.split('/').pop() ?? name
  return last.replace(/\.jsonl?$/i, '')
}

export function parseManaged(files: TraceFile[], options: ManagedOptions = {}): Run {
  const order = { n: 0 }
  const primaryFile =
    files.find((f) => /(^|\/)primary\.jsonl$/i.test(f.name)) ??
    files.find((f) => /"type":"(user\.message|session\.status_running)"/.test(f.text)) ??
    files[0]
  if (!primaryFile) throw new Error('No trace files given')

  const located: Located[] = []
  for (const f of [primaryFile, ...files.filter((x) => x !== primaryFile)]) located.push(...parseLines(f, order))

  const primaryLines = located.filter((l) => l.file === primaryFile.name)
  const childIds = new Set(
    primaryLines
      .filter((l) => l.raw.type === 'session.thread_created' && l.raw.session_thread_id)
      .map((l) => l.raw.session_thread_id as string)
  )
  const primaryThreadId =
    primaryLines.find((l) => l.raw.type === 'session.thread_status_running' && l.raw.session_thread_id && !childIds.has(l.raw.session_thread_id))
      ?.raw.session_thread_id ?? 'primary'

  const threads = new Map<string, Thread>()
  const ensureThread = (id: string, agentName?: string | null): Thread => {
    let t = threads.get(id)
    if (!t) {
      t = { id, agentName: agentName ?? null, parentId: id === primaryThreadId ? null : primaryThreadId }
      threads.set(id, t)
    } else if (agentName && !t.agentName) t.agentName = agentName
    return t
  }
  ensureThread(primaryThreadId)

  // Which thread each file's own events belong to.
  const fileThread = new Map<string, string>()
  fileThread.set(primaryFile.name, primaryThreadId)
  for (const f of files) {
    if (f === primaryFile) continue
    fileThread.set(f.name, baseName(f.name))
  }

  // What the primary stream already carries. A delegation is thread_message_sent
  // on the sender's stream and thread_message_received on the receiver's; each
  // message is kept once, from the primary stream when it has it.
  const sentFromPrimary = new Set<string>()
  const receivedByPrimary = new Set<string>()
  const sentFromChildren = new Set<string>()
  for (const l of located) {
    const r = l.raw
    const stream = fileThread.get(l.file) ?? primaryThreadId
    if (l.file === primaryFile.name) {
      if (r.type === 'agent.thread_message_sent') sentFromPrimary.add(`${r.to_session_thread_id}:${textOf(r.content)}`)
      if (r.type === 'agent.thread_message_received') receivedByPrimary.add(`${r.from_session_thread_id}:${textOf(r.content)}`)
    } else if (r.type === 'agent.thread_message_sent') {
      sentFromChildren.add(`${stream}>${r.to_session_thread_id}:${textOf(r.content)}`)
    }
  }

  const seenIds = new Set<string>()
  const pending: Array<{ e: Omit<Event, 'index'>; sort: string; order: number }> = []
  const push = (e: Omit<Event, 'index'>, sort: string, ord: number) => pending.push({ e, sort, order: ord })

  for (const l of located) {
    const r = l.raw
    const id = r.id ?? `${l.file}:${l.order}`
    if (seenIds.has(id)) continue
    const stream = fileThread.get(l.file) ?? primaryThreadId
    const ts = typeof r.processed_at === 'string' ? r.processed_at : null
    const sort = ts ?? ''
    const own = r.session_thread_id && r.session_thread_id !== stream ? r.session_thread_id : stream
    const base = { id, ts, raw: r }
    let mapped: Omit<Event, 'index'> | null = null

    switch (r.type) {
      case 'user.message':
        mapped = { ...base, threadId: stream, kind: 'user_message', content: textOf(r.content) }
        break
      case 'agent.message':
        mapped = { ...base, threadId: own, kind: 'message', content: textOf(r.content) }
        break
      case 'agent.custom_tool_use':
      case 'agent.tool_use':
      case 'agent.mcp_tool_use':
        ensureThread(own)
        mapped = { ...base, threadId: own, kind: 'tool_call', tool: r.name ?? 'tool', args: r.input ?? {} }
        break
      case 'user.custom_tool_result':
      case 'user.tool_result':
        mapped = {
          ...base,
          threadId: own,
          kind: 'tool_result',
          toolCallId: (r.custom_tool_use_id as string | undefined) ?? (r.tool_use_id as string | undefined),
          result: { content: textOf(r.content), isError: r.is_error === true }
        }
        break
      case 'agent.thread_message_sent': {
        const to = r.to_session_thread_id ?? 'unknown'
        const text = textOf(r.content)
        ensureThread(to, r.to_agent_name)
        if (stream !== primaryThreadId && to === primaryThreadId) {
          // A child's report, as the child's stream saw it.
          if (receivedByPrimary.has(`${stream}:${text}`)) break
          mapped = { ...base, threadId: primaryThreadId, kind: 'report', from: stream, content: text }
          break
        }
        mapped = { ...base, threadId: stream, kind: 'delegation', to, content: text }
        break
      }
      case 'agent.thread_message_received': {
        const from = r.from_session_thread_id ?? 'unknown'
        const text = textOf(r.content)
        ensureThread(from, r.from_agent_name)
        if (stream === primaryThreadId) {
          mapped = { ...base, threadId: primaryThreadId, kind: 'report', from, content: text }
          break
        }
        // A child's copy of what it was sent.
        if (from === primaryThreadId) {
          if (sentFromPrimary.has(`${stream}:${text}`)) break
          mapped = { ...base, threadId: primaryThreadId, kind: 'delegation', to: stream, content: text }
          break
        }
        if (sentFromChildren.has(`${from}>${stream}:${text}`)) break
        mapped = { ...base, threadId: from, kind: 'delegation', to: stream, content: text }
        break
      }
      case 'session.thread_created': {
        const t = r.session_thread_id ?? 'unknown'
        ensureThread(t, r.agent_name)
        mapped = { ...base, threadId: t, kind: 'thread_created' }
        break
      }
      case 'session.thread_status_running': {
        const t = r.session_thread_id ?? stream
        ensureThread(t, r.agent_name)
        mapped = { ...base, threadId: t, kind: 'thread_running' }
        break
      }
      case 'session.thread_status_idle': {
        const t = r.session_thread_id ?? stream
        ensureThread(t, r.agent_name)
        mapped = { ...base, threadId: t, kind: 'thread_idle', stopReason: r.stop_reason?.type ?? undefined }
        break
      }
      case 'session.thread_status_terminated': {
        const t = r.session_thread_id ?? stream
        ensureThread(t, r.agent_name)
        mapped = { ...base, threadId: t, kind: 'thread_terminated', reason: r.reason ?? r.stop_reason?.reason ?? undefined }
        break
      }
      case 'session.status_idle':
        if (r.stop_reason?.type === 'end_turn') mapped = { ...base, threadId: primaryThreadId, kind: 'session_end', stopReason: 'end_turn' }
        break
      case 'session.status_terminated':
        mapped = { ...base, threadId: primaryThreadId, kind: 'session_end', stopReason: 'terminated' }
        break
      default:
        break
    }
    if (!mapped) continue
    seenIds.add(id)
    push(mapped, sort, l.order)
  }

  pending.sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : a.order - b.order))
  const events: Event[] = pending.map((p, i) => ({ ...p.e, index: i }))

  // Decisions from the client that answered the calls.
  const notes: string[] = []
  if (options.decisions) {
    const unused = [...options.decisions]
    for (const e of events) {
      if (e.kind !== 'tool_call') continue
      const idx = unused.findIndex(
        (d) => d.tool === e.tool && ((d.threadId ?? primaryThreadId) === e.threadId || (d.threadId === null && e.threadId === primaryThreadId))
      )
      if (idx === -1) continue
      const d = unused.splice(idx, 1)[0]!
      e.decision = { tier: d.tier, decision: d.decision, afterBuyer: d.afterBuyer }
    }
  } else {
    notes.push('No decision sidecar: a tool result marked as an error with a rejection message reads as a deny, everything else as an allow with no recorded tier.')
  }
  for (const e of events) {
    if (e.kind !== 'tool_result' || e.decision) continue
    const call = events.find((c) => c.kind === 'tool_call' && c.id === e.toolCallId)
    if (!call || call.decision) continue
    if (e.result?.isError && /reject|denied|deny|not allowed|refus|blocked/i.test(e.result.content)) {
      call.decision = { decision: 'deny', reason: e.result.content.slice(0, 160) }
    }
  }

  if (options.roster) {
    for (const t of threads.values()) {
      if (t.agentName && options.roster.agents[t.agentName]) t.tools = options.roster.agents[t.agentName]
    }
  } else {
    notes.push('No roster: declared tools per agent are unknown, so the routing rules that need them stay silent.')
  }
  if (files.length === 1) {
    notes.push('Only the primary stream was given. A child thread appears through what was cross-posted to the client: its tool calls, not its messages.')
  }

  return {
    id: options.id ?? baseName(primaryFile.name === 'primary.jsonl' ? 'run' : primaryFile.name),
    format: 'managed',
    threads: [...threads.values()],
    events,
    primaryThreadId,
    toolKinds: options.roster?.toolKinds,
    capabilities: options.roster?.capabilities,
    notes
  }
}

/** Kinds this parser can produce, for the format explainer. */
export const MANAGED_KINDS: EventKind[] = [
  'user_message', 'message', 'delegation', 'report', 'tool_call', 'tool_result',
  'thread_created', 'thread_running', 'thread_idle', 'thread_terminated', 'session_end'
]
