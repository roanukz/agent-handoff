/**
 * The agent-submit Agent SDK record to a Run.
 *
 * What agent-submit persists per session: `decisions.json` (the PreToolUse
 * classification and decision per tool-use id, in call order), `trail.jsonl`
 * (decision lines with reasons, and one line per write with before and after),
 * `writes.jsonl`, and the recorded case (`prompt`, `resultText`). There is no
 * hook log file; the hooks write to stderr. What this format lacks: tool
 * arguments for reads, and any second thread.
 */

import type { Decision, Event, Run } from '../model/trace.js'

export interface SdkFiles {
  decisions: string
  trail?: string
  writes?: string
  /** The recorded case file, when there is one. */
  case?: string
}

interface DecisionEntry {
  classification?: { rawTool?: string; tool?: string; tier?: string; reason?: string; triggers?: string[] }
  decision?: string
}

interface TrailLine {
  ts?: string
  sessionId?: string
  toolUseId?: string
  tool?: string
  field?: string | null
  before?: unknown
  after?: unknown
  tier?: string
  decision?: string
  reason?: string
  draftId?: string | null
  writeSeq?: number
}

function asDecision(value: string | undefined): Decision['decision'] | null {
  if (value === 'allow' || value === 'deny' || value === 'ask' || value === 'defer') return value
  return null
}

export function parseSdk(files: SdkFiles, options: { id?: string } = {}): Run {
  const decisions = JSON.parse(files.decisions) as Record<string, DecisionEntry>
  const trail: TrailLine[] = (files.trail ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as TrailLine)
  const recorded = files.case ? (JSON.parse(files.case) as { caseId?: string; prompt?: string; resultText?: string }) : null

  const threadId = trail.find((t) => t.sessionId)?.sessionId ?? recorded?.caseId ?? 'session'
  const events: Omit<Event, 'index'>[] = []

  if (recorded?.prompt) {
    events.push({ id: 'prompt', ts: null, threadId, kind: 'user_message', content: recorded.prompt })
  }

  const byCall = new Map<string, TrailLine[]>()
  for (const line of trail) {
    if (!line.toolUseId) continue
    const list = byCall.get(line.toolUseId) ?? []
    list.push(line)
    byCall.set(line.toolUseId, list)
  }

  for (const [toolUseId, entry] of Object.entries(decisions)) {
    const c = entry.classification ?? {}
    const lines = byCall.get(toolUseId) ?? []
    // The trail's first line is the decision as made; decisions.json holds the
    // value after a resume applied the buyer's answer.
    const first = asDecision(lines[0]?.decision) ?? asDecision(entry.decision) ?? 'allow'
    const decision: Decision = { tier: c.tier, decision: first, reason: c.reason }
    const later = lines.filter((l) => l.field === null && asDecision(l.decision) && asDecision(l.decision) !== first)
    if ((first === 'defer' || first === 'ask') && later.length) {
      const last = later[later.length - 1]!
      decision.afterBuyer = last.decision === 'allow' ? 'allow' : 'deny'
      decision.reason = last.reason ?? decision.reason
    }
    events.push({
      id: toolUseId,
      ts: lines[0]?.ts ?? null,
      threadId,
      kind: 'tool_call',
      tool: c.tool ?? c.rawTool ?? 'tool',
      // The record keeps no arguments for reads. Writes carry their payload in the trail.
      args: undefined,
      decision,
      raw: entry
    })
    let n = 0
    for (const line of lines) {
      n++
      if (line.field === null) {
        events.push({
          id: `${toolUseId}:decision:${n}`,
          ts: line.ts ?? null,
          threadId,
          kind: 'decision',
          toolCallId: toolUseId,
          tool: line.tool,
          decision: { tier: line.tier, decision: asDecision(line.decision) ?? 'allow', reason: line.reason },
          raw: line
        })
      } else {
        events.push({
          id: `${toolUseId}:write:${line.writeSeq ?? n}`,
          ts: line.ts ?? null,
          threadId,
          kind: 'tool_result',
          toolCallId: toolUseId,
          tool: line.tool,
          result: {
            content: JSON.stringify({ draftId: line.draftId, field: line.field, before: line.before, after: line.after }),
            isError: false
          },
          raw: line
        })
      }
    }
    // A write that landed carries its payload as the call's arguments too.
    const write = lines.find((l) => l.field === '*' && l.after && typeof l.after === 'object')
    if (write) events[events.findIndex((e) => e.id === toolUseId)]!.args = write.after
  }

  if (recorded?.resultText) {
    events.push({ id: 'final', ts: null, threadId, kind: 'message', content: recorded.resultText })
    events.push({ id: 'end', ts: null, threadId, kind: 'session_end', stopReason: 'end_turn' })
  }

  return {
    id: options.id ?? recorded?.caseId ?? threadId,
    format: 'sdk',
    threads: [{ id: threadId, agentName: 'requisition drafter', parentId: null }],
    events: events.map((e, index) => ({ ...e, index })),
    primaryThreadId: threadId,
    notes: [
      'The SDK record keeps tool names, tiers and decisions, not the arguments of read calls. Argument-level rules cannot fire on it.',
      'One session is one thread. The cross-thread rules cannot fire on it; it is a control.'
    ]
  }
}
