/**
 * A Who&When record to a Run plus labels.
 *
 * Two subsets, two shapes. Hand-crafted (Magentic-One style): `history`
 * entries carry `role` values like "human", "Orchestrator (thought)",
 * "Orchestrator (-> WebSurfer)" and the agent's own name. Algorithm-generated
 * (CaptainAgent group chats): entries carry `role` (assistant or user) and
 * `name`, with "Computer_terminal" returning code output.
 *
 * Each history entry becomes exactly one event with id `step-N`, so a label
 * on step N is a label on event `step-N`. An action inside an entry (a code
 * block, an "I clicked ..." line) becomes a derived `step-N-call` event.
 * Labels index the list from zero; checked against the labeled agent.
 */

import type { Event, Run, Thread } from '../model/trace.js'

interface HistoryEntry {
  content: string
  role: string
  name?: string
}

export interface WhoWhenRecord {
  history: HistoryEntry[]
  question?: string
  ground_truth?: string
  mistake_agent: string
  mistake_step: string | number
  mistake_reason: string
  question_ID?: string
  is_correct?: boolean
  is_corrected?: boolean
}

const CODE_BLOCK = /```(\w+)?\n([\s\S]*?)```/
const ACTION = /^I (clicked|typed|scrolled|visited|opened|navigated to|searched for|hovered|selected|pressed|downloaded)\b(.*)$/im

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent'
}

export function isWhoWhenRecord(value: unknown): value is WhoWhenRecord {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as WhoWhenRecord).history) &&
    'mistake_step' in (value as object) &&
    'mistake_agent' in (value as object)
  )
}

export function parseWhoWhen(record: WhoWhenRecord, id: string): Run {
  const handCrafted = record.history.some((h) => /^Orchestrator/.test(h.role))
  const threads = new Map<string, Thread>()
  const primaryThreadId = handCrafted ? 'orchestrator' : 'group'
  threads.set(primaryThreadId, { id: primaryThreadId, agentName: handCrafted ? 'Orchestrator' : 'Group chat', parentId: null })
  const ensure = (name: string): string => {
    const tid = slug(name)
    if (!threads.has(tid)) threads.set(tid, { id: tid, agentName: name, parentId: primaryThreadId })
    return tid
  }

  const events: Omit<Event, 'index'>[] = []
  let openCall: { id: string; threadId: string } | null = null

  record.history.forEach((h, i) => {
    const id = `step-${i}`
    const content = typeof h.content === 'string' ? h.content : JSON.stringify(h.content)
    const base = { id, ts: null, raw: { role: h.role, name: h.name, step: i } }

    if (handCrafted) {
      const to = h.role.match(/^Orchestrator \(-> (.+)\)$/)
      if (h.role === 'human') {
        events.push({ ...base, threadId: primaryThreadId, kind: 'user_message', content })
      } else if (to) {
        const target = ensure(to[1]!)
        events.push({ ...base, threadId: primaryThreadId, kind: 'delegation', to: target, content })
      } else if (/^Orchestrator/.test(h.role)) {
        events.push({ ...base, threadId: primaryThreadId, kind: 'message', content })
      } else {
        const from = ensure(h.role)
        const action = content.match(ACTION)
        if (action) {
          events.push({ ...base, id: `${id}-call`, threadId: from, kind: 'tool_call', tool: action[1]!.toLowerCase().replace(/\s+/g, '_'), args: { target: action[2]!.trim().slice(0, 200) } })
        }
        const code = content.match(CODE_BLOCK)
        if (code && !action) {
          events.push({ ...base, id: `${id}-call`, threadId: from, kind: 'tool_call', tool: code[1] ?? 'code', args: { code: code[2]!.trim() } })
        }
        events.push({ ...base, threadId: primaryThreadId, kind: 'report', from, content })
      }
      return
    }

    // Algorithm-generated group chats.
    const name = h.name ?? h.role
    if (i === 0 || /^You are given/.test(content)) {
      events.push({ ...base, threadId: primaryThreadId, kind: 'user_message', content })
      if (h.name) ensure(h.name)
      return
    }
    if (name === 'Computer_terminal' || /^exitcode:/.test(content)) {
      events.push({
        ...base,
        threadId: openCall?.threadId ?? primaryThreadId,
        kind: 'tool_result',
        toolCallId: openCall?.id,
        result: { content, isError: /exitcode: [1-9]|execution failed|Error/.test(content) }
      })
      openCall = null
      return
    }
    const tid = ensure(name)
    const code = content.match(CODE_BLOCK)
    if (code) {
      const callId = `${id}-call`
      events.push({ ...base, id: callId, threadId: tid, kind: 'tool_call', tool: code[1] ?? 'code', args: { code: code[2]!.trim() } })
      openCall = { id: callId, threadId: tid }
    }
    events.push({ ...base, threadId: tid, kind: 'message', content })
  })

  const step = Number(record.mistake_step)
  return {
    id,
    format: 'whowhen',
    threads: [...threads.values()],
    events: events.map((e, index) => ({ ...e, index })),
    primaryThreadId,
    labels: {
      failingStep: step,
      failingAgent: record.mistake_agent,
      reason: record.mistake_reason,
      failingEventId: `step-${step}`
    },
    notes: [
      handCrafted
        ? 'Hand-crafted Who&When log: orchestrator turns and agent replies, no structured tool calls. Actions are read out of the reply text.'
        : 'Algorithm-generated Who&When log: a group chat with a code executor. Code blocks are the tool calls.'
    ]
  }
}
